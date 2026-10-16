package quotations

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

/* D-13: SaveCover chạy đọc id cũ + chèn bản mới + xoá bản cũ trong 1 transaction. Lỗi tiêm SAU khi chèn và xoá đã chạy
   thật -> database phải y như trước lần lưu (không còn cả bản mới lẫn bản cũ). Đối chứng: cùng lỗi tiêm mà không có
   transaction (db nil) thì bản cũ đã bị xoá, chỉ còn bản mới - database đổi, chứng minh phép kiểm bắt được.
   Chạy trên qspro_gotest (TEST_DATABASE_URL). */

// repoTiemLoi: repo thật, RemoveCover chạy xoá thật rồi trả lỗi tiêm; ghi lại có đang trong transaction không.
type repoTiemLoi struct {
	*pgRepo
	loi       error
	chen, xoa bool
	trongTx   bool
}

func (r *repoTiemLoi) InsertCover(ctx context.Context, rows []*omap.Map) error {
	err := r.pgRepo.InsertCover(ctx, rows)
	r.chen = err == nil
	return err
}

func (r *repoTiemLoi) RemoveCover(ctx context.Context, ids string) error {
	r.trongTx = r.db.InTx(ctx)
	if err := r.pgRepo.RemoveCover(ctx, ids); err != nil {
		return err
	}
	r.xoa = true
	return r.loi
}

func TestSaveCoverTxRollback(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !strings.Contains(url, "/qspro_gotest") {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	defer db.Close()
	bg := context.Background()
	no := database.Opt{NoScope: true}

	us, err := db.Select(bg, "users", database.SelectOpt{Filter: database.Eq("username", "zz_fe_admin") + "&cong_ty_id=not.is.null", Limit: 1, NoScope: true})
	if err != nil || len(us) == 0 {
		t.Fatalf("database thử không có tài khoản zz_fe_admin thuộc công ty: %v", err)
	}
	ctx := tenant.With(bg, tenant.Ctx{UID: us[0].Val("id"), Role: "admin", CongTyID: us[0].Val("cong_ty_id")})
	ma := "ZZ_D13Q_" + strconv.FormatInt(time.Now().UnixNano(), 36)
	cleanup := func() {
		if _, err := db.Remove(bg, "khai_toan", "ma_da=like.ZZ_D13Q_*", no); err != nil {
			t.Errorf("dọn khai_toan: %v", err)
		}
		if _, err := db.Remove(bg, "du_an", "ma_da=like.ZZ_D13Q_*", no); err != nil {
			t.Errorf("dọn du_an: %v", err)
		}
	}
	defer cleanup()
	if _, err := db.InsertOne(ctx, "du_an", omap.Of("ma_da", ma, "ten_du_an", "ZZ_D13Q du an thu")); err != nil {
		t.Fatal(err)
	}
	chup := func() string {
		rows, err := db.Select(ctx, "khai_toan", database.SelectOpt{Filter: database.Eq("ma_da", ma), Order: "sort_no.asc"})
		if err != nil {
			t.Fatal(err)
		}
		s, err := omap.MarshalString(rows)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	dong := func(tag string, n int) []any {
		out := make([]any, n)
		for i := range out {
			out[i] = omap.Of("stt", strconv.Itoa(i+1), "hangMuc", "ZZ "+tag, "moTa", "", "chiPhi", float64(100*(i+1)))
		}
		return out
	}

	// Bản đầu: lưu thành công qua transaction, kết quả = tờ bìa đọc lại.
	svc := New(Deps{DB: db})
	r1, err := svc.SaveCover(ctx, ma, dong("cu", 3))
	if err != nil || len(r1) != 3 {
		t.Fatalf("lưu bản đầu: %v (%d dòng)", err, len(r1))
	}
	truoc := chup()
	if strings.Count(truoc, `"id"`) != 3 {
		t.Fatalf("bản đầu phải có 3 dòng: %s", truoc)
	}

	// Lỗi tiêm sau khi chèn + xoá đã chạy thật -> rollback, lỗi trả nguyên, database không đổi.
	loi := errors.New("ZZ lỗi tiêm giữa chừng")
	tiem := &repoTiemLoi{pgRepo: newPgRepo(db), loi: loi}
	svcTiem := New(Deps{DB: db, Repo: tiem})
	if _, err := svcTiem.SaveCover(ctx, ma, dong("moi", 2)); err != loi {
		t.Fatalf("lỗi phải trả nguyên: %v", err)
	}
	if !tiem.chen || !tiem.xoa || !tiem.trongTx {
		t.Fatalf("chèn / xoá phải chạy thật trong transaction: chen=%v xoa=%v trongTx=%v", tiem.chen, tiem.xoa, tiem.trongTx)
	}
	if sau := chup(); sau != truoc {
		t.Fatalf("rollback hỏng: database đổi sau lỗi giữa chừng\n  trước: %s\n  sau:   %s", truoc, sau)
	}

	// Chi phí âm: chèn hỏng (ck_cost_estimate_lines_cost) -> lỗi, database không đổi.
	am := dong("am", 2)
	am[1].(*omap.Map).Set("chiPhi", -5.0)
	if _, err := svc.SaveCover(ctx, ma, am); err == nil || !strings.Contains(err.Error(), "ck_cost_estimate_lines_cost") {
		t.Fatalf("chi phí âm phải báo lỗi ràng buộc: %v", err)
	}
	if sau := chup(); sau != truoc {
		t.Fatalf("database đổi sau lỗi chi phí âm\n  trước: %s\n  sau:   %s", truoc, sau)
	}

	// Đối chứng: không có transaction (db nil) thì cùng lỗi tiêm để lại bản mới, bản cũ đã bị xoá -> database đổi.
	tiem2 := &repoTiemLoi{pgRepo: newPgRepo(db), loi: loi}
	if _, err := New(Deps{Repo: tiem2}).SaveCover(ctx, ma, dong("moi", 2)); err != loi {
		t.Fatalf("đối chứng: %v", err)
	}
	if tiem2.trongTx {
		t.Fatal("đối chứng không được chạy trong transaction")
	}
	if sau := chup(); sau == truoc {
		t.Fatal("đối chứng: không transaction mà database không đổi - phép kiểm không bắt được gì")
	}

	// Lưu lại thành công sau các lần lỗi: thay trọn bản cũ.
	r2, err := svc.SaveCover(ctx, ma, dong("cuoi", 4))
	if err != nil || len(r2) != 4 {
		t.Fatalf("lưu sau lỗi: %v (%d dòng)", err, len(r2))
	}
	if s := chup(); strings.Count(s, `"id"`) != 4 || strings.Contains(s, "ZZ moi") {
		t.Fatalf("lưu sau lỗi phải còn đúng 4 dòng mới: %s", s)
	}
}
