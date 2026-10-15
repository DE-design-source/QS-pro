// Chạy migration PostgreSQL theo thứ tự số trong infra/db/migrations/NNNN_ten.sql - bản chuyển của infra/scripts/migrate.js,
// dùng CHUNG thư mục migration, bảng schema_migrations và cách tính checksum nên chạy lẫn với bản Node được.
//
//	go run ./cmd/migrate              chạy các file chưa áp dụng (mỗi file 1 transaction)
//	go run ./cmd/migrate --status     chỉ liệt kê
//	go run ./cmd/migrate --baseline   đánh dấu MỌI file là đã áp dụng mà không chạy
//	                                  (dùng cho database dựng từ infra/db/schema.sql)
//
// Database đích: DATABASE_URL trong .env, hoặc --url=postgresql://...
// Thư mục file: --dir=..., không có thì MIGRATIONS_DIR, mặc định ../infra/db/migrations (tính từ backend/, thư mục chạy).
// File đã áp dụng mà bị sửa nội dung -> từ chối chạy (lệch checksum). Sai thì viết file mới.
// CHÚ Ý: lệnh chạy thẳng trên database ở DATABASE_URL (dòng "Database:" in ra đầu tiên). Sao lưu trước khi chạy
// trên database có dữ liệu thật: một số migration xoá cột / bảng và chỉ quay lui được bằng bản sao lưu.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"qspro-backend/internal/config"
)

type file struct{ version, name, sql, checksum string }

var reName = regexp.MustCompile(`^\d{4}_[a-z0-9_]+\.sql$`)

func files(dir string) ([]file, error) {
	ents, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := []file{}
	for _, e := range ents {
		f := e.Name()
		if e.IsDir() || !reName.MatchString(f) {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			return nil, err
		}
		// bỏ khác biệt xuống dòng (CRLF/LF) để checksum không lệch giữa các máy
		sql := strings.ReplaceAll(string(b), "\r\n", "\n")
		sum := sha256.Sum256([]byte(sql))
		out = append(out, file{version: f[:4], name: strings.TrimSuffix(f, ".sql"), sql: sql, checksum: hex.EncodeToString(sum[:])})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].name < out[j].name })
	return out, nil
}

type options struct {
	status, baseline bool
	url              string
	urlSet           bool // đã truyền --url= (kể cả rỗng): như Node, không lấy DATABASE_URL thay
	dir              string
}

// defaultDir: MIGRATIONS_DIR (image Docker đặt /app/migrations), không có thì ../infra/db/migrations tính từ backend/.
func defaultDir() string {
	if v := os.Getenv("MIGRATIONS_DIR"); v != "" {
		return v
	}
	return filepath.Join("..", "infra", "db", "migrations")
}

// parseArgs đọc tham số dòng lệnh như infra/scripts/migrate.js (thêm --dir của bản Go).
// Nhiều --url=: lấy cái ĐẦU TIÊN (process.argv.find).
func parseArgs(args []string) (options, error) {
	o := options{dir: defaultDir()}
	bad := []string{}
	for _, a := range args {
		switch {
		case a == "--status":
			o.status = true
		case a == "--baseline":
			o.baseline = true
		case strings.HasPrefix(a, "--url="):
			if !o.urlSet {
				o.url, o.urlSet = a[6:], true
			}
		case strings.HasPrefix(a, "--dir="):
			o.dir = a[6:]
		default:
			bad = append(bad, a)
		}
	}
	if len(bad) > 0 {
		return o, errors.New("Tham số không hợp lệ: " + strings.Join(bad, " ") + " (chỉ nhận --status, --baseline, --url=..., --dir=...)")
	}
	return o, nil
}

func run() (exit int, err error) {
	o, err := parseArgs(os.Args[1:])
	if err != nil {
		return 1, err
	}
	status, baseline, dbURL, dir := o.status, o.baseline, o.url, o.dir
	if !o.urlSet {
		config.LoadDotenv()
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		return 1, errors.New("Thiếu DATABASE_URL (hoặc --url=...)")
	}
	if u, e := url.Parse(dbURL); e == nil && u.Hostname() != "" {
		port := u.Port()
		if port == "" {
			port = "5432"
		}
		fmt.Println("Database: " + u.Hostname() + ":" + port + u.Path)
	}
	ctx := context.Background()
	cc, err := pgx.ParseConfig(dbURL)
	if err != nil {
		return 1, err
	}
	cc.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol // file migration có nhiều câu lệnh
	db, err := pgx.ConnectConfig(ctx, cc)
	if err != nil {
		return 1, err
	}
	defer db.Close(ctx)

	if _, err = db.Exec(ctx, "select pg_advisory_lock(7460123)"); err != nil { // không cho 2 tiến trình migrate cùng lúc
		return 1, err
	}
	if _, err = db.Exec(ctx, "create table if not exists schema_migrations (version text primary key, name text not null, checksum text not null, applied_at timestamptz not null default now())"); err != nil {
		return 1, err
	}
	done := map[string]string{}
	rows, err := db.Query(ctx, "select version, checksum from schema_migrations")
	if err != nil {
		return 1, err
	}
	for rows.Next() {
		var v, c string
		if err = rows.Scan(&v, &c); err != nil {
			return 1, err
		}
		done[v] = c
	}
	rows.Close()
	list, err := files(dir)
	if err != nil {
		return 1, err
	}
	pending := []file{}
	for _, f := range list {
		c, ok := done[f.version]
		if ok && c != f.checksum {
			return 1, errors.New("File " + f.name + ".sql đã áp dụng nhưng nội dung bị sửa. Không sửa migration cũ — hãy viết file mới.")
		}
		if !ok {
			pending = append(pending, f)
		}
	}
	if status {
		for _, f := range list {
			if _, ok := done[f.version]; ok {
				fmt.Println("đã chạy " + f.name)
			} else {
				fmt.Println("CHƯA    " + f.name)
			}
		}
		return 0, nil
	}
	const mark = "insert into schema_migrations (version, name, checksum) values ($1, $2, $3)"
	for _, f := range pending {
		if baseline {
			if _, err = db.Exec(ctx, mark, f.version, f.name, f.checksum); err != nil {
				return 1, err
			}
			fmt.Println("đánh dấu  " + f.name)
			continue
		}
		if _, err = db.Exec(ctx, "begin"); err != nil {
			return 1, err
		}
		_, err = db.Exec(ctx, f.sql)
		if err == nil {
			_, err = db.Exec(ctx, mark, f.version, f.name, f.checksum)
		}
		if err == nil {
			_, err = db.Exec(ctx, "commit")
		}
		if err != nil {
			_, _ = db.Exec(ctx, "rollback")
			msg := f.name + ": " + err.Error()
			var pe *pgconn.PgError
			if errors.As(err, &pe) {
				msg = f.name + ": " + pe.Message
				if pe.Detail != "" {
					msg += " | " + pe.Detail
				}
				if pe.Where != "" {
					msg += " | " + strings.Split(pe.Where, "\n")[0]
				}
			}
			return 1, errors.New(msg)
		}
		fmt.Println("đã chạy   " + f.name)
	}
	if len(pending) == 0 {
		fmt.Println("Không có migration mới.")
	} else if !baseline {
		fmt.Println("Đã đổi cấu trúc database: hãy KHỞI ĐỘNG LẠI server để nạp lại danh mục bảng / cột.")
	}
	// view product_catalog chốt danh sách cột lúc tạo: thêm cột vào products / product_*_specs mà quên tạo lại view thì app không thấy cột
	rows, err = db.Query(ctx, `select column_name::text c from information_schema.columns where table_schema = 'public' and (table_name = 'products' or (table_name like 'product\_%\_specs' and column_name <> 'product_id')) and exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'product_catalog') except select column_name::text from information_schema.columns where table_schema = 'public' and table_name = 'product_catalog'`)
	if err != nil {
		return 1, err
	}
	lech := []string{}
	for rows.Next() {
		var c string
		if err = rows.Scan(&c); err != nil {
			return 1, err
		}
		lech = append(lech, c)
	}
	rows.Close()
	if len(lech) > 0 {
		fmt.Fprintln(os.Stderr, "CẢNH BÁO: view product_catalog thiếu cột "+strings.Join(lech, ", ")+" — viết migration DROP VIEW + CREATE VIEW lại.")
		return 1, nil
	}
	return 0, nil
}

func main() {
	code, err := run()
	if err != nil {
		fmt.Fprintln(os.Stderr, "LỖI: "+err.Error())
		os.Exit(1)
	}
	os.Exit(code)
}
