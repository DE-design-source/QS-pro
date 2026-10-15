package database

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// Nạp danh mục bảng / cột: đúng luật của catalog_ trong server/supa.js (dòng 132-136, 278, 296).

func lui(d *DB, dt time.Duration) {
	d.catMu.Lock()
	d.catAt = d.catAt.Add(-dt)
	d.catMu.Unlock()
}

// Đã có danh mục: không fresh thì dùng lại; fresh trong vòng 3 giây kể từ lần nạp cuối cũng dùng lại.
func TestCatalogThrottle(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	c1, err := d.catalog(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if n := d.catLoads.Load(); n != 1 {
		t.Fatalf("lần đầu phải nạp đúng 1 lần, được %d", n)
	}
	for i := 0; i < 3; i++ {
		if _, err = d.catalog(ctx, false); err != nil {
			t.Fatal(err)
		}
		if _, err = d.catalog(ctx, true); err != nil {
			t.Fatal(err)
		}
	}
	if n := d.catLoads.Load(); n != 1 {
		t.Errorf("fresh trong 3 giây không được nạp lại, đã nạp %d lần", n)
	}
	// bảng lạ: table() gọi catalog(fresh) - vẫn trong 3 giây nên không nạp, báo PGRST205
	if _, err = d.Select(ctx, "zz_bang_khong_co", SelectOpt{}); CodeOf(err) != "PGRST205" || d.catLoads.Load() != 1 {
		t.Errorf("bảng lạ trong 3 giây: %v, nạp %d lần", err, d.catLoads.Load())
	}
	lui(d, 4*time.Second)
	if _, err = d.catalog(ctx, false); err != nil || d.catLoads.Load() != 1 {
		t.Errorf("không fresh thì danh mục cũ vẫn dùng lại: %v, nạp %d lần", err, d.catLoads.Load())
	}
	c2, err := d.catalog(ctx, true)
	if err != nil || d.catLoads.Load() != 2 {
		t.Fatalf("fresh sau 3 giây phải nạp lại: %v, nạp %d lần", err, d.catLoads.Load())
	}
	if c2["cong_ty"] == nil || c2["cong_ty"] == c1["cong_ty"] {
		t.Error("nạp lại phải ra danh mục mới")
	}
	// bảng lạ khi danh mục đã cũ: nạp lại 1 lần rồi mới báo thiếu
	lui(d, 4*time.Second)
	if _, err = d.Select(ctx, "zz_bang_khong_co", SelectOpt{}); CodeOf(err) != "PGRST205" || d.catLoads.Load() != 3 {
		t.Errorf("bảng lạ sau 3 giây: %v, nạp %d lần", err, d.catLoads.Load())
	}
	// RefreshCatalog bỏ qua khoảng 3 giây
	if err = d.RefreshCatalog(ctx); err != nil || d.catLoads.Load() != 4 {
		t.Errorf("RefreshCatalog: %v, nạp %d lần", err, d.catLoads.Load())
	}
}

// Nhiều lời gọi cùng lúc khi chưa có danh mục: dùng chung MỘT lượt nạp (_catLoading của Node).
func TestCatalogSingleFlight(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	const n = 40
	var wg sync.WaitGroup
	cats := make([]map[string]*table, n)
	errs := make([]error, n)
	start := make(chan struct{})
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			cats[i], errs[i] = d.catalog(ctx, i%2 == 0)
		}(i)
	}
	close(start)
	wg.Wait()
	for i := range cats {
		if errs[i] != nil || cats[i]["cong_ty"] == nil {
			t.Fatalf("lời gọi %d: %v", i, errs[i])
		}
		if cats[i]["cong_ty"] != cats[0]["cong_ty"] {
			t.Errorf("lời gọi %d nhận danh mục khác", i)
		}
	}
	if got := d.catLoads.Load(); got != 1 {
		t.Errorf("%d lời gọi cùng lúc phải nạp đúng 1 lần, đã nạp %d", n, got)
	}
	// lượt nạp đang chạy dở + fresh (danh mục đã cũ): các lời gọi chờ chung lượt đó
	lui(d, 4*time.Second)
	start = make(chan struct{})
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			_, errs[i] = d.catalog(ctx, true)
		}(i)
	}
	close(start)
	wg.Wait()
	for i := range errs {
		if errs[i] != nil {
			t.Fatalf("lời gọi %d: %v", i, errs[i])
		}
	}
	if got := d.catLoads.Load(); got != 2 {
		t.Errorf("nạp lại cùng lúc phải đúng 1 lần nữa, tổng %d", got)
	}
}

// Người chờ có ctx huỷ được thì thôi chờ; lượt nạp vẫn xong cho lời gọi sau.
func TestCatalogWaiterCancel(t *testing.T) {
	d := testDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := d.catalog(ctx, false); !errors.Is(err, context.Canceled) {
		t.Fatalf("ctx đã huỷ: %v", err)
	}
	if c, err := d.catalog(context.Background(), false); err != nil || c["cong_ty"] == nil {
		t.Fatalf("lời gọi sau: %v", err)
	}
	if got := d.catLoads.Load(); got != 1 {
		t.Errorf("phải nạp đúng 1 lần, đã nạp %d", got)
	}
}

// Lệnh chạy báo 42703 / 42P01 (danh mục đang nhớ không còn đúng): nạp lại cho lệnh gọi SAU,
// nhưng chỉ khi lần nạp cuối đã quá 3 giây; lỗi khác không nạp lại.
func TestStaleCatalogReload(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	if _, err := d.Select(ctx, "cong_ty", SelectOpt{Select: "ma", Limit: 1}); err != nil {
		t.Fatal(err)
	}
	// giả lập bảng vừa bị đổi tên bằng migration: danh mục đang nhớ trỏ tới bảng không còn
	hong := func() {
		d.catMu.Lock()
		cp := *d.cat["cong_ty"]
		cp.en = "zz_database_bang_da_mat"
		d.cat["cong_ty"] = &cp
		d.catMu.Unlock()
	}
	hong()
	_, err := d.Select(ctx, "cong_ty", SelectOpt{Select: "ma", Limit: 1})
	if CodeOf(err) != "42P01" || d.catLoads.Load() != 1 {
		t.Fatalf("trong 3 giây: lỗi %v (muốn 42P01), nạp %d lần (muốn 1)", err, d.catLoads.Load())
	}
	if _, err = d.Select(ctx, "cong_ty", SelectOpt{Select: "ma", Limit: 1}); CodeOf(err) != "42P01" {
		t.Errorf("chưa nạp lại thì lệnh sau vẫn lỗi, nhận %v", err)
	}
	lui(d, 4*time.Second)
	if _, err = d.Select(ctx, "cong_ty", SelectOpt{Select: "ma", Limit: 1}); CodeOf(err) != "42P01" {
		t.Errorf("lệnh gặp lỗi vẫn phải trả 42P01, nhận %v", err)
	}
	if got := d.catLoads.Load(); got != 2 {
		t.Fatalf("sau 3 giây phải nạp lại 1 lần, tổng %d", got)
	}
	if _, err = d.Select(ctx, "cong_ty", SelectOpt{Select: "ma", Limit: 1}); err != nil {
		t.Errorf("lệnh sau phải dùng danh mục mới: %v", err)
	}

	// gọi thẳng: mã lỗi nào mới nạp lại
	for _, c := range []struct {
		err  error
		old  bool
		want int64
	}{
		{&pgconn.PgError{Code: "42703"}, false, 0},
		{&pgconn.PgError{Code: "42703"}, true, 1},
		{&pgconn.PgError{Code: "42P01"}, true, 1},
		{&pgconn.PgError{Code: "23505"}, true, 0},
		{errors.New("mất kết nối"), true, 0},
	} {
		d.catMu.Lock()
		d.catAt = time.Now()
		if c.old {
			d.catAt = d.catAt.Add(-4 * time.Second)
		}
		d.catMu.Unlock()
		before := d.catLoads.Load()
		d.staleCatalog(ctx, c.err)
		if got := d.catLoads.Load() - before; got != c.want {
			t.Errorf("%v (cũ=%v): nạp thêm %d lần, muốn %d", c.err, c.old, got, c.want)
		}
	}
}

// db-map.json nhúng trong gói là bản chép của server/db-map.json: phải giống nhau (bỏ khác biệt CRLF).
// Migration và schema.sql không còn bản chép: bản Go đọc thẳng infra/db/.
// Không có file của bản Node (vd build trong image chỉ có backend/) thì bỏ qua.
func TestCopiesInSyncWithNode(t *testing.T) {
	root := filepath.Join("..", "..", "..", "..")
	for _, c := range [][2]string{
		{filepath.Join(root, "server", "db-map.json"), "db-map.json"},
	} {
		node, err := os.ReadFile(c[0])
		if err != nil {
			t.Logf("không có %s, bỏ qua", c[0])
			continue
		}
		mine, err := os.ReadFile(c[1])
		if err != nil {
			t.Fatal(err)
		}
		lf := func(b []byte) []byte { return bytes.ReplaceAll(b, []byte("\r\n"), []byte("\n")) }
		if !bytes.Equal(lf(node), lf(mine)) {
			t.Errorf("%s lệch với bản gốc %s", c[1], c[0])
		}
	}
}
