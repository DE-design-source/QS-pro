package purchasing

import (
	"context"
	"errors"
	"os"
	"regexp"
	"testing"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// D-13 trên DB thật (qspro_gotest): tiêm lỗi ở bước ghi thứ 2 sau khi bước 1 đã ghi -> DB không đổi, kể cả khi lệnh
// xoá bù trừ cũng hỏng. Đối chứng: cùng kịch bản chạy không transaction (db nil) thì còn phiếu dở - chứng tỏ test đo
// đúng thứ cần đo.

const txPrefix = "ZZ_D13_purchasing_"

// tiemLoi: bọc repo thật, lần gọi thứ failAt của InsertOrderItems / InsertProposalItems trả lỗi (trước đó đọc lại
// trong cùng ctx để chắc bước trước đã ghi).
type tiemLoi struct {
	Repository
	db     *database.DB
	failAt int
	xoaLoi bool // DeleteOrder (bù trừ) trả lỗi
	n      int
	thay   int // số phiếu thấy được ngay trước khi tiêm lỗi
}

var errTiem = errors.New("lỗi tiêm D-13")

func (r *tiemLoi) dem(ctx context.Context, table, col string) int {
	rows, _ := r.db.Select(ctx, table, database.SelectOpt{Filter: col + "=like." + txPrefix + "*"})
	return len(rows)
}

func (r *tiemLoi) InsertOrderItems(ctx context.Context, rows []*omap.Map) error {
	if r.n++; r.n == r.failAt {
		r.thay = r.dem(ctx, tblDon, "ma_du_an")
		return errTiem
	}
	return r.Repository.InsertOrderItems(ctx, rows)
}

func (r *tiemLoi) DeleteOrder(ctx context.Context, maDon any) error {
	if r.xoaLoi {
		return errors.New("xoá bù trừ hỏng (tiêm)")
	}
	return r.Repository.DeleteOrder(ctx, maDon)
}

func (r *tiemLoi) InsertProposalItems(ctx context.Context, table string, rows []*omap.Map) error {
	if r.n++; r.n == r.failAt {
		r.thay = r.dem(ctx, tblDeXuat, "ma_du_an")
		return errTiem
	}
	return r.Repository.InsertProposalItems(ctx, table, rows)
}

func TestSaveTxRollback(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	defer db.Close()
	bg := context.Background()
	us, err := db.Select(bg, "users", database.SelectOpt{Filter: "username=eq.zz_fe_admin", Limit: 1, NoScope: true})
	if err != nil || len(us) == 0 || us[0].Val("cong_ty_id") == nil {
		t.Fatalf("thiếu tài khoản zz_fe_admin có công ty: %v", err)
	}
	ctx := tenant.With(bg, tenant.Ctx{UID: us[0].Val("id"), Role: "admin", CongTyID: us[0].Val("cong_ty_id")})

	like := "ma_du_an=like." + txPrefix + "*"
	no := database.Opt{NoScope: true}
	type dem struct{ don, donCT, dx, dxCK, dxTT int }
	demDB := func() dem {
		t.Helper()
		n := func(table, filter string) int {
			rows, err := db.Select(bg, table, database.SelectOpt{Filter: filter, NoScope: true})
			if err != nil {
				t.Fatalf("đọc %s: %v", table, err)
			}
			return len(rows)
		}
		return dem{n(tblDon, like), n(tblDonCT, "ten_sp=like."+txPrefix+"*"), n(tblDeXuat, like),
			n(tblDxCK, "ten_sp=like."+txPrefix+"*"), n(tblDxTT, "ghi_chu=like."+txPrefix+"*")}
	}
	cleanup := func() {
		rm := func(table, filter string) {
			if _, err := db.Remove(bg, table, filter, no); err != nil {
				t.Errorf("dọn %s: %v", table, err)
			}
		}
		rm(tblDonCT, "ten_sp=like."+txPrefix+"*")
		rm(tblDxCK, "ten_sp=like."+txPrefix+"*")
		rm(tblDxTT, "ghi_chu=like."+txPrefix+"*")
		rm(tblDon, like)
		rm(tblDeXuat, like)
	}
	cleanup()
	defer cleanup()
	if got := demDB(); got != (dem{}) {
		t.Fatalf("dữ liệu cũ chưa dọn: %+v", got)
	}

	item := func(ten string) any { return omap.Of("ma", "SP1", "ten", txPrefix+ten, "sl", 2.0, "donGia", 10.0) }
	order := omap.Of("maDA", txPrefix+"DA", "project", txPrefix+"P", "orders", []any{
		omap.Of("supplier", "A", "total", 20.0, "items", []any{item("a")}),
		omap.Of("supplier", "B", "total", 20.0, "items", []any{item("b")}),
	})
	dxCK := omap.Of("loai", "ck", "maDA", txPrefix+"DA", "project", txPrefix+"P", "items", []any{item("c")})
	dxTT := omap.Of("loai", "tt", "maDA", txPrefix+"DA", "project", txPrefix+"P",
		"dots", []any{omap.Of("tien", 5.0, "gc", txPrefix+"d1")})

	// mỗi đơn 1 transaction: lỗi ở dòng hàng của đơn thứ 2 (đơn 1 đã commit) -> đơn 2 rollback, đơn 1 gỡ bằng bù trừ.
	// Ca này chủ yếu kiểm bù trừ cũ còn chạy (không có Tx bù trừ cũng dọn hết); ca kế (bù trừ hỏng) mới chứng minh Tx.
	r := &tiemLoi{Repository: newPgRepo(db), db: db, failAt: 2}
	s := New(Deps{DB: db, Repo: r})
	if _, err := s.SavePurchaseOrder(ctx, order); err != errTiem {
		t.Fatalf("SavePurchaseOrder err = %v, muốn lỗi tiêm nguyên vẹn", err)
	}
	if r.thay != 2 {
		t.Errorf("trong transaction đơn 2 phải thấy 2 đơn (1 đã commit + 1 đang ghi), thấy %d", r.thay)
	}
	if got := demDB(); got != (dem{}) {
		t.Errorf("SavePurchaseOrder lỗi ở đơn 2 còn dữ liệu: %+v", got)
	}
	// lỗi ở đơn 2 VÀ bù trừ hỏng -> đơn 1 (đã commit, đủ dòng hàng) còn nguyên, đơn 2 không còn gì (không có Tx thì
	// còn phiếu đơn 2 thiếu dòng hàng: 2 đơn, 1 dòng). Chưa nguyên tử giữa các đơn - giới hạn đã ghi ở service.go.
	r = &tiemLoi{Repository: newPgRepo(db), db: db, failAt: 2, xoaLoi: true}
	s = New(Deps{DB: db, Repo: r})
	if _, err := s.SavePurchaseOrder(ctx, order); err != errTiem {
		t.Fatalf("SavePurchaseOrder err = %v", err)
	}
	if got := demDB(); got != (dem{don: 1, donCT: 1}) {
		t.Errorf("lỗi ở đơn 2, bù trừ hỏng: muốn còn đúng đơn 1 (1 phiếu, 1 dòng), có %+v", got)
	}
	if rows, err := db.Select(bg, tblDon, database.SelectOpt{Filter: like + "&nha_cung_cap=eq.A", NoScope: true}); err != nil || len(rows) != 1 {
		t.Errorf("đơn còn lại phải là đơn 1 (NCC A): %d dòng, %v", len(rows), err)
	}
	cleanup()
	// lỗi ở dòng hàng của đơn 1 VÀ lệnh xoá bù trừ cũng hỏng -> chỉ còn transaction lo: không còn phiếu thiếu dòng hàng
	r = &tiemLoi{Repository: newPgRepo(db), db: db, failAt: 1, xoaLoi: true}
	s = New(Deps{DB: db, Repo: r})
	if _, err := s.SavePurchaseOrder(ctx, order); err != errTiem {
		t.Fatalf("SavePurchaseOrder err = %v", err)
	}
	if r.thay != 1 {
		t.Errorf("trong transaction phải thấy phiếu vừa chèn, thấy %d", r.thay)
	}
	if got := demDB(); got != (dem{}) {
		t.Errorf("SavePurchaseOrder lỗi giữa chừng (bù trừ hỏng) còn phiếu dở: %+v", got)
	}
	// lỗi ở dòng của phiếu đề xuất (phiếu đã chèn) -> không còn phiếu rỗng, cả ck lẫn tt
	for _, dx := range []*omap.Map{dxCK, dxTT} {
		r = &tiemLoi{Repository: newPgRepo(db), db: db, failAt: 1}
		s = New(Deps{DB: db, Repo: r})
		if _, err := s.SaveDeXuat(ctx, dx); err != errTiem {
			t.Fatalf("SaveDeXuat(%s) err = %v", jsval.S(dx.Val("loai")), err)
		}
		if r.thay != 1 {
			t.Errorf("SaveDeXuat(%s): trong transaction phải thấy phiếu đã chèn, thấy %d", jsval.S(dx.Val("loai")), r.thay)
		}
		if got := demDB(); got != (dem{}) {
			t.Errorf("SaveDeXuat(%s) lỗi giữa chừng còn dữ liệu dở: %+v", jsval.S(dx.Val("loai")), got)
		}
	}

	// đối chứng không transaction (db nil), bù trừ hỏng: phải còn phiếu thiếu dòng hàng
	s = New(Deps{Repo: &tiemLoi{Repository: newPgRepo(db), db: db, failAt: 1, xoaLoi: true}})
	_, _ = s.SavePurchaseOrder(ctx, order)
	if got := demDB(); got.don != 1 || got.donCT != 0 {
		t.Errorf("đối chứng không transaction: muốn còn 1 đơn, 0 dòng, có %+v", got)
	}
	cleanup()

	// thành công: ghi đủ, kết quả như trước
	s = New(Deps{DB: db})
	res, err := s.SavePurchaseOrder(ctx, order)
	if err != nil || len(arrOf(res.Val("saved"))) != 2 {
		t.Fatalf("SavePurchaseOrder = %v, %v", res, err)
	}
	for _, dx := range []*omap.Map{dxCK, dxTT} {
		if _, err := s.SaveDeXuat(ctx, dx); err != nil {
			t.Fatalf("SaveDeXuat: %v", err)
		}
	}
	if got := demDB(); got != (dem{2, 2, 2, 1, 1}) {
		t.Errorf("sau khi lưu thành công: %+v", got)
	}
}
