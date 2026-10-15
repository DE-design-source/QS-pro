package database

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// Test transaction (D-13): cần TEST_DATABASE_URL (qspro_gotest). Dòng thử có action / mã tiền tố ZZ_TX_.

const txMark = "ZZ_TX_GOTEST"

func txClean(t *testing.T, d *DB) {
	t.Helper()
	bg := context.Background()
	if _, err := d.Remove(bg, "audit_log", "action=like."+txMark+"*", Opt{NoScope: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := d.Remove(bg, "db_san_pham", "ma_sp=like."+txMark+"*", Opt{NoScope: true}); err != nil {
		t.Fatal(err)
	}
}

func txCount(t *testing.T, d *DB, ctx context.Context, action string) int {
	t.Helper()
	rows, err := d.Select(ctx, "audit_log", SelectOpt{Filter: Eq("action", action), NoScope: true})
	if err != nil {
		t.Fatal(err)
	}
	return len(rows)
}

func txLog(d *DB, ctx context.Context, action string) error {
	_, err := d.InsertOne(ctx, "audit_log", omap.Of("action", action, "detail", "tx"))
	return err
}

func txSetup(t *testing.T) *DB {
	d := testDB(t)
	txClean(t, d)
	t.Cleanup(func() { txClean(t, d) })
	return d
}

func TestTxCommit(t *testing.T) {
	d := txSetup(t)
	bg := context.Background()
	ran := []string{}
	err := d.Tx(bg, func(ctx context.Context) error {
		if !d.InTx(ctx) || d.InTx(bg) {
			t.Error("InTx sai")
		}
		if err := txLog(d, ctx, txMark+"_C"); err != nil {
			return err
		}
		d.AfterCommit(ctx, func(c context.Context) {
			if d.InTx(c) {
				t.Error("AfterCommit phải nhận ctx ngoài transaction")
			}
			// chạy sau commit -> kết nối khác đã thấy dữ liệu
			ran = append(ran, "after:"+strings.Repeat("x", txCount(t, d, c, txMark+"_C")))
		})
		// đọc-sau-ghi trong tx thấy dòng chưa commit; kết nối khác (bg) chưa thấy
		if n := txCount(t, d, ctx, txMark+"_C"); n != 1 {
			t.Errorf("trong tx thấy %d dòng, cần 1", n)
		}
		if n := txCount(t, d, bg, txMark+"_C"); n != 0 {
			t.Errorf("ngoài tx đã thấy %d dòng trước commit", n)
		}
		ran = append(ran, "fn")
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if n := txCount(t, d, bg, txMark+"_C"); n != 1 {
		t.Fatalf("sau commit có %d dòng", n)
	}
	if strings.Join(ran, ",") != "fn,after:x" {
		t.Errorf("thứ tự: %v", ran)
	}
	// ngoài transaction AfterCommit chạy ngay
	now := false
	d.AfterCommit(bg, func(context.Context) { now = true })
	if !now {
		t.Error("AfterCommit ngoài tx phải chạy ngay")
	}
}

func TestTxRollbackOnError(t *testing.T) {
	d := txSetup(t)
	bg := context.Background()
	sentinel := errors.New("lỗi tiêm giữa chừng")
	after := false
	err := d.Tx(bg, func(ctx context.Context) error {
		if err := txLog(d, ctx, txMark+"_E1"); err != nil {
			return err
		}
		if _, err := d.Update(ctx, "audit_log", Eq("action", txMark+"_E1"), omap.Of("detail", "sửa")); err != nil {
			return err
		}
		if err := txLog(d, ctx, txMark+"_E2"); err != nil {
			return err
		}
		d.AfterCommit(ctx, func(context.Context) { after = true })
		return sentinel
	})
	if err != sentinel {
		t.Fatalf("phải trả nguyên lỗi của fn, được %v", err)
	}
	if txCount(t, d, bg, txMark+"_E1")+txCount(t, d, bg, txMark+"_E2") != 0 {
		t.Fatal("rollback sót dữ liệu")
	}
	if after {
		t.Error("AfterCommit không được chạy khi rollback")
	}
}

func TestTxRollbackOnPanic(t *testing.T) {
	d := txSetup(t)
	bg := context.Background()
	func() {
		defer func() {
			if r := recover(); r != "nổ" {
				t.Fatalf("panic phải được ném lại nguyên vẹn, được %v", r)
			}
		}()
		_ = d.Tx(bg, func(ctx context.Context) error {
			if err := txLog(d, ctx, txMark+"_P"); err != nil {
				t.Fatal(err)
			}
			panic("nổ")
		})
	}()
	if n := txCount(t, d, bg, txMark+"_P"); n != 0 {
		t.Fatalf("panic mà vẫn còn %d dòng", n)
	}
	// kết nối đã trả về pool sạch: dùng tiếp bình thường
	if err := txLog(d, bg, txMark+"_P2"); err != nil {
		t.Fatal(err)
	}
}

func TestTxNested(t *testing.T) {
	d := txSetup(t)
	bg := context.Background()
	inner := errors.New("tx trong hỏng")
	innerAfter, outerAfter := false, false
	err := d.Tx(bg, func(ctx context.Context) error {
		if err := txLog(d, ctx, txMark+"_N_OUT"); err != nil {
			return err
		}
		// Tx trong hỏng -> chỉ huỷ phần của nó; Tx ngoài nuốt lỗi và commit
		if err := d.Tx(ctx, func(ctx2 context.Context) error {
			if err := txLog(d, ctx2, txMark+"_N_IN"); err != nil {
				return err
			}
			d.AfterCommit(ctx2, func(context.Context) { innerAfter = true })
			if n := txCount(t, d, ctx2, txMark+"_N_OUT"); n != 1 {
				t.Errorf("Tx trong phải thấy dòng của Tx ngoài, thấy %d", n)
			}
			return inner
		}); err != inner {
			t.Errorf("Tx trong trả %v", err)
		}
		// Tx trong thành công -> giữ lại, việc sau commit chờ Tx ngoài
		if err := d.Tx(ctx, func(ctx2 context.Context) error {
			d.AfterCommit(ctx2, func(context.Context) { outerAfter = true })
			return txLog(d, ctx2, txMark+"_N_IN2")
		}); err != nil {
			return err
		}
		if outerAfter {
			t.Error("AfterCommit của Tx trong chạy trước khi Tx ngoài commit")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	got := []int{txCount(t, d, bg, txMark+"_N_OUT"), txCount(t, d, bg, txMark+"_N_IN"), txCount(t, d, bg, txMark+"_N_IN2")}
	if got[0] != 1 || got[1] != 0 || got[2] != 1 {
		t.Fatalf("lồng nhau: ngoài/trong-hỏng/trong-xong = %v, cần [1 0 1]", got)
	}
	if innerAfter || !outerAfter {
		t.Errorf("AfterCommit lồng nhau: trong-hỏng=%v trong-xong=%v", innerAfter, outerAfter)
	}

	// Tx trong thành công nhưng Tx ngoài hỏng -> mất hết
	_ = d.Tx(bg, func(ctx context.Context) error {
		_ = d.Tx(ctx, func(ctx2 context.Context) error { return txLog(d, ctx2, txMark+"_N2") })
		return errors.New("ngoài hỏng")
	})
	if n := txCount(t, d, bg, txMark+"_N2"); n != 0 {
		t.Fatal("Tx ngoài hỏng mà dòng của Tx trong vẫn còn")
	}
}

// Lệnh database hỏng mà code nuốt lỗi: transaction vẫn dùng tiếp được (giống khi chưa có transaction).
func TestTxSwallowedStatementError(t *testing.T) {
	d := txSetup(t)
	bg := context.Background()
	err := d.Tx(bg, func(ctx context.Context) error {
		rows, err := d.InsertOne(ctx, "audit_log", omap.Of("action", txMark+"_S1", "detail", "a"))
		if err != nil {
			return err
		}
		// trùng khoá chính -> 23505 / 409, đúng dạng lỗi như ngoài transaction
		_, err = d.InsertOne(ctx, "audit_log", omap.Of("id", rows[0].Val("id"), "action", txMark+"_S1", "detail", "trùng"))
		if CodeOf(err) != "23505" || StatusOf(err) != 409 || !strings.HasPrefix(err.Error(), "DB POST audit_log -> 409 ") {
			t.Errorf("lỗi trùng khoá trong tx: %v", err)
		}
		return txLog(d, ctx, txMark+"_S2")
	})
	if err != nil {
		t.Fatalf("lỗi đã nuốt làm hỏng transaction: %v", err)
	}
	if txCount(t, d, bg, txMark+"_S1") != 1 || txCount(t, d, bg, txMark+"_S2") != 1 {
		t.Fatal("thiếu dòng sau commit")
	}
}

// Lọc công ty áp dụng y nguyên trong transaction; bảng tách (db_san_pham = lõi + bảng thông số) rollback trọn.
func TestTxTenantAndSplitTable(t *testing.T) {
	d := txSetup(t)
	bg := context.Background()
	cts, err := d.Select(bg, "cong_ty", SelectOpt{Select: "id", Order: "id.asc", Limit: 2, NoScope: true})
	if err != nil || len(cts) < 2 {
		t.Skipf("cần 2 công ty trong database thử: %v", err)
	}
	ctA, ctB := cts[0].Val("id"), cts[1].Val("id")
	ctxA := tenant.With(bg, tenant.Ctx{Role: "admin", CongTyID: ctA})
	ctxB := tenant.With(bg, tenant.Ctx{Role: "admin", CongTyID: ctB})
	ma := txMark + "_SP"
	sentinel := errors.New("tiêm lỗi sau khi ghi sản phẩm")
	err = d.Tx(ctxA, func(ctx context.Context) error {
		if err := txLog(d, ctx, txMark+"_T"); err != nil {
			return err
		}
		rows, err := d.Select(ctx, "audit_log", SelectOpt{Filter: Eq("action", txMark+"_T")})
		if err != nil || len(rows) != 1 || jsval.ToString(rows[0].Val("cong_ty_id")) != jsval.ToString(ctA) {
			t.Errorf("công ty A trong tx: %v %v", rows, err)
		}
		// cùng transaction nhưng ngữ cảnh công ty B -> không thấy dòng của A
		ctxBtx := tenant.With(ctx, tenant.Ctx{Role: "admin", CongTyID: ctB})
		if !d.InTx(ctxBtx) {
			t.Error("ctx con phải còn transaction")
		}
		if rows, _ := d.Select(ctxBtx, "audit_log", SelectOpt{Filter: Eq("action", txMark+"_T")}); len(rows) != 0 {
			t.Errorf("công ty B thấy dòng của A trong tx: %d", len(rows))
		}
		if _, err := d.Update(ctxBtx, "audit_log", Eq("action", txMark+"_T"), omap.Of("detail", "B sửa")); err != nil {
			return err
		}
		// bảng tách: chèn + sửa + đọc trong tx
		if _, err := d.InsertOne(ctx, "db_san_pham", omap.Of("ma_sp", ma, "ten_sp", "ZZ tx đèn", "nganh", "den",
			"nhiet_do_mau_k", "4000K", "gia_ban_le", 100.0)); err != nil {
			return err
		}
		if _, err := d.Update(ctx, "db_san_pham", Eq("ma_sp", ma), omap.Of("nhiet_do_mau_k", "3000K", "gia_ban_le", 200.0)); err != nil {
			return err
		}
		sp, err := d.Select(ctx, "db_san_pham", SelectOpt{Filter: Eq("ma_sp", ma)})
		if err != nil || len(sp) != 1 || sp[0].Val("nhiet_do_mau_k") != "3000K" || sp[0].Val("gia_ban_le") != 200.0 {
			t.Errorf("đọc sản phẩm trong tx: %v %v", sp, err)
		}
		if sp, _ := d.Select(ctxB, "db_san_pham", SelectOpt{Filter: Eq("ma_sp", ma)}); len(sp) != 0 {
			t.Error("kết nối khác thấy sản phẩm chưa commit")
		}
		return sentinel
	})
	if err != sentinel {
		t.Fatal(err)
	}
	if n := txCount(t, d, bg, txMark+"_T"); n != 0 {
		t.Fatal("rollback sót audit_log")
	}
	if sp, _ := d.Select(bg, "db_san_pham", SelectOpt{Filter: Eq("ma_sp", ma), NoScope: true}); len(sp) != 0 {
		t.Fatal("rollback sót sản phẩm (lõi / bảng thông số)")
	}
	// commit thật trên bảng tách rồi xoá trong tx khác
	if err := d.Tx(ctxA, func(ctx context.Context) error {
		_, err := d.InsertOne(ctx, "db_san_pham", omap.Of("ma_sp", ma, "ten_sp", "ZZ tx đèn", "nganh", "den", "nhiet_do_mau_k", "4000K"))
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if sp, _ := d.Select(ctxA, "db_san_pham", SelectOpt{Filter: Eq("ma_sp", ma)}); len(sp) != 1 || sp[0].Val("nhiet_do_mau_k") != "4000K" {
		t.Fatalf("sau commit: %v", sp)
	}
	if err := d.Tx(ctxA, func(ctx context.Context) error {
		if del, err := d.Remove(ctx, "db_san_pham", Eq("ma_sp", ma)); err != nil || len(del) != 1 {
			t.Errorf("xoá trong tx: %v %v", del, err)
		}
		return errors.New("huỷ xoá")
	}); err == nil {
		t.Fatal("phải trả lỗi")
	}
	if sp, _ := d.Select(ctxA, "db_san_pham", SelectOpt{Filter: Eq("ma_sp", ma)}); len(sp) != 1 {
		t.Fatal("xoá đã rollback mà sản phẩm mất")
	}
}

// Nhiều goroutine dùng chung ctx của 1 transaction: lệnh được xếp hàng, không làm hỏng kết nối.
func TestTxConcurrentUse(t *testing.T) {
	d := txSetup(t)
	bg := context.Background()
	err := d.Tx(bg, func(ctx context.Context) error {
		var wg sync.WaitGroup
		errs := make(chan error, 8)
		for i := 0; i < 8; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				errs <- txLog(d, ctx, txMark+"_G")
			}()
		}
		wg.Wait()
		close(errs)
		for e := range errs {
			if e != nil {
				return e
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if n := txCount(t, d, bg, txMark+"_G"); n != 8 {
		t.Fatalf("có %d dòng, cần 8", n)
	}
	// ctx của tx đã kết thúc -> báo lỗi, KHÔNG lặng lẽ ghi ngoài transaction
	var leaked context.Context
	_ = d.Tx(bg, func(ctx context.Context) error { leaked = ctx; return nil })
	if err := txLog(d, leaked, txMark+"_LEAK"); err == nil {
		t.Error("ghi bằng ctx của tx đã đóng phải lỗi")
	}
	if n := txCount(t, d, bg, txMark+"_LEAK"); n != 0 {
		t.Error("ghi lọt ra ngoài transaction")
	}
}
