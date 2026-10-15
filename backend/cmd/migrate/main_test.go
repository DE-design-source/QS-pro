package main

import (
	"os"
	"path/filepath"
	"testing"
)

// Tham số dòng lệnh như infra/scripts/migrate.js.
func TestParseArgs(t *testing.T) {
	t.Setenv("MIGRATIONS_DIR", "")
	o, err := parseArgs(nil)
	if err != nil || o.status || o.baseline || o.urlSet || o.url != "" || o.dir != filepath.Join("..", "infra", "db", "migrations") {
		t.Errorf("không tham số: %+v %v", o, err)
	}
	t.Setenv("MIGRATIONS_DIR", "/app/migrations")
	if o, _ = parseArgs(nil); o.dir != "/app/migrations" {
		t.Errorf("MIGRATIONS_DIR: %+v", o)
	}
	o, err = parseArgs([]string{"--status", "--baseline", "--url=postgresql://a/b", "--url=postgresql://c/d", "--dir=x"})
	if err != nil || !o.status || !o.baseline || !o.urlSet || o.url != "postgresql://a/b" || o.dir != "x" {
		t.Errorf("đủ tham số (nhiều --url lấy cái đầu): %+v %v", o, err)
	}
	// --url= rỗng: Node coi là ĐÃ truyền (không lấy DATABASE_URL) rồi báo thiếu
	if o, err = parseArgs([]string{"--url="}); err != nil || !o.urlSet || o.url != "" {
		t.Errorf("--url= rỗng: %+v %v", o, err)
	}
	_, err = parseArgs([]string{"--status", "x", "--URL=a", "-h"})
	if want := "Tham số không hợp lệ: x --URL=a -h (chỉ nhận --status, --baseline, --url=..., --dir=...)"; err == nil || err.Error() != want {
		t.Errorf("tham số lạ: %v", err)
	}
}

// --url= rỗng phải dừng với lỗi của Node dù DATABASE_URL có đặt.
func TestEmptyURLFlagDoesNotFallBack(t *testing.T) {
	old := os.Args
	defer func() { os.Args = old }()
	t.Setenv("DATABASE_URL", "postgresql://u:p@127.0.0.1:9/khong-duoc-dung")
	os.Args = []string{"migrate", "--status", "--url="}
	code, err := run()
	if code != 1 || err == nil || err.Error() != "Thiếu DATABASE_URL (hoặc --url=...)" {
		t.Errorf("code %d, lỗi %v", code, err)
	}
}

// Thư mục mặc định (chạy từ backend/) là infra/db/migrations dùng chung với bản Node: phải đọc được và có file.
// Không có thư mục (vd build trong image chỉ có backend/) thì bỏ qua.
func TestDefaultDirHasMigrations(t *testing.T) {
	dir := filepath.Join("..", "..", "..", "infra", "db", "migrations")
	if _, err := os.Stat(dir); err != nil {
		t.Skip("không có infra/db/migrations")
	}
	list, err := files(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) == 0 {
		t.Fatal("infra/db/migrations không có file NNNN_ten.sql nào")
	}
	for i, f := range list {
		if i > 0 && f.version == list[i-1].version {
			t.Errorf("trùng số phiên bản %s: %s, %s", f.version, list[i-1].name, f.name)
		}
	}
}
