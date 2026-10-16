package database

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// Lỗi cột / bảng (42703 / 42P01) trong Tx: nạp lại danh mục chạy nền, không chờ kết nối thứ 2 khi Tx đang giữ 1 kết nối.
// Pool 1 kết nối: chờ đồng bộ thì treo tới hết hạn ctx (pool cạn).
func TestTxStaleCatalogKhongChoKetNoi(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	d := New(Config{URL: url, PoolMax: 1})
	t.Cleanup(d.Close)
	bg := context.Background()
	if _, err := d.Select(bg, "cong_ty", SelectOpt{Select: "ma", Limit: 1, NoScope: true}); err != nil {
		t.Fatal(err)
	}
	before := d.catLoads.Load()
	err := d.Tx(bg, func(ctx context.Context) error {
		d.catMu.Lock()
		d.catAt = time.Now().Add(-4 * time.Second)
		d.catMu.Unlock()
		c, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		t0 := time.Now()
		d.staleCatalog(c, &pgconn.PgError{Code: "42703"})
		if dt := time.Since(t0); dt > 500*time.Millisecond {
			t.Errorf("staleCatalog trong Tx chờ %v (phải trả ngay)", dt)
		}
		_, err := d.Select(ctx, "cong_ty", SelectOpt{Select: "ma", Limit: 1, NoScope: true})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 50 && d.catLoads.Load() == before; i++ {
		time.Sleep(100 * time.Millisecond)
	}
	if d.catLoads.Load() == before {
		t.Error("sau commit phải nạp lại danh mục (chạy nền)")
	}
}
