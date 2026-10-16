package materials

import (
	"context"
	"errors"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// D-13 (transaction) cho SetCombo / SetBienThe / DeleteDbProduct: tiêm lỗi ở lệnh ghi thứ 2 trở đi -> database không đổi;
// đối chứng không có transaction (Deps.DB = nil) -> còn dữ liệu dở dang (chứng minh test nhạy). Chạy trên qspro_gotest,
// dữ liệu tiền tố ZZ_D13SP, tự dọn.

var loiTiem = errors.New("ZZ lỗi tiêm D-13")

// hongRepo: Repository bọc database thật; hong(op, bảng) trả lỗi (hoặc panic) để tiêm lỗi trước khi lệnh ghi chạy.
type hongRepo struct {
	Repository
	hong func(op, table string) error
	// sai: trả filter thay thế cho Remove (chạy THẬT xuống Postgres, lỗi DB thật); "" -> giữ filter. loiDB ghi lỗi thật nhận được.
	sai   func(table string) string
	loiDB []error
}

func (r *hongRepo) Insert(ctx context.Context, table string, rows []*omap.Map, opt ...database.Opt) ([]*omap.Map, error) {
	if err := r.hong("insert", table); err != nil {
		return nil, err
	}
	return r.Repository.Insert(ctx, table, rows, opt...)
}

func (r *hongRepo) Update(ctx context.Context, table, filter string, patch *omap.Map, opt ...database.Opt) ([]*omap.Map, error) {
	if err := r.hong("update", table); err != nil {
		return nil, err
	}
	return r.Repository.Update(ctx, table, filter, patch, opt...)
}

func (r *hongRepo) Remove(ctx context.Context, table, filter string, opt ...database.Opt) ([]*omap.Map, error) {
	if err := r.hong("remove", table); err != nil {
		return nil, err
	}
	if r.sai != nil {
		if f := r.sai(table); f != "" {
			out, err := r.Repository.Remove(ctx, table, f, opt...)
			r.loiDB = append(r.loiDB, err)
			return out, err
		}
	}
	return r.Repository.Remove(ctx, table, filter, opt...)
}

// txFix: công ty ZZ + 4 sản phẩm A..D trên qspro_gotest.
type txFix struct {
	t    *testing.T
	db   *database.DB
	root context.Context
	ctx  context.Context
	ctID any
	ids  map[string]any // A..D -> id
}

var txMa = []string{"ZZ_D13SP_A", "ZZ_D13SP_B", "ZZ_D13SP_C", "ZZ_D13SP_D"}

func newTxFix(t *testing.T) *txFix {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	f := &txFix{t: t, db: db, root: tenant.With(context.Background(), tenant.Ctx{Role: "super"}), ids: map[string]any{}}
	f.don()
	t.Cleanup(func() { f.don(); db.Close() })
	ns := database.Opt{NoScope: true}
	ct, err := db.InsertOne(f.root, "cong_ty", omap.Of("ten", "ZZ_D13SP", "ma", "zz-d13sp"), ns)
	if err != nil {
		t.Fatal(err)
	}
	f.ctID = ct[0].Val("id")
	f.ctx = tenant.With(context.Background(), tenant.Ctx{Role: "admin", CongTyID: f.ctID})
	for i, ma := range txMa {
		r, err := db.InsertOne(f.root, "db_san_pham", omap.Of("ma_sp", ma, "ten_sp", "ZZ sp "+ma[len(ma)-1:], "cong_ty_id", f.ctID,
			"nganh", "den", "gia_ban_le", float64(1000*(i+1))), ns)
		if err != nil {
			t.Fatal(err)
		}
		f.ids[ma[len(ma)-1:]] = r[0].Val("id")
	}
	return f
}

func (f *txFix) don() {
	ns := database.Opt{NoScope: true}
	ct, _ := f.db.Select(f.root, "cong_ty", database.SelectOpt{Select: "id", Filter: database.Eq("ma", "zz-d13sp"), NoScope: true})
	sp, _ := f.db.Select(f.root, "db_san_pham", database.SelectOpt{Select: "id", Filter: "ma_sp=in.(" + strings.Join(txMa, ",") + ")", NoScope: true})
	if len(sp) > 0 {
		ids := []any{}
		for _, r := range sp {
			ids = append(ids, r.Val("id"))
		}
		_, _ = f.db.Remove(f.root, "sp_combo", "sp_id=in.("+joinIDs(ids)+")", ns)
		_, _ = f.db.Remove(f.root, "sp_combo", "sp_kem_id=in.("+joinIDs(ids)+")", ns)
	}
	_, _ = f.db.Remove(f.root, "db_san_pham", "ma_sp=in.("+strings.Join(txMa, ",")+")", ns)
	_, _ = f.db.Remove(f.root, "db_san_pham_history", "ma_sp=in.("+strings.Join(txMa, ",")+")", ns)
	for _, c := range ct {
		_, _ = f.db.Remove(f.root, "sp_yeu_thich", database.Eq("cong_ty_id", c.Val("id")), ns)
		_, _ = f.db.Remove(f.root, "audit_log", database.Eq("cong_ty_id", c.Val("id")), ns)
		_, _ = f.db.Remove(f.root, "cong_ty", database.Eq("id", c.Val("id")), ns)
	}
}

func (f *txFix) idList() string {
	return joinIDs([]any{f.ids["A"], f.ids["B"], f.ids["C"], f.ids["D"]})
}

// chup: ảnh chụp mọi dòng liên quan (sản phẩm, combo, yêu thích, lịch sử, audit) để so trước / sau.
func (f *txFix) chup() string {
	f.t.Helper()
	sel := func(table, cols, filter string) []*omap.Map {
		rows, err := f.db.Select(f.root, table, database.SelectOpt{Select: cols, Filter: filter, Order: "id.asc", NoScope: true})
		if err != nil {
			f.t.Fatal(err)
		}
		return rows
	}
	ct := database.Eq("cong_ty_id", f.ctID)
	return js(omap.Of(
		"sp", sel("db_san_pham", "id,ma_sp,ten_sp,nhom_bt", "ma_sp=in.("+strings.Join(txMa, ",")+")"),
		"combo1", sel("sp_combo", "id,sp_id,sp_kem_id,so_luong,ghi_chu,sort_no", "sp_id=in.("+f.idList()+")"),
		"combo2", sel("sp_combo", "id,sp_id,sp_kem_id,so_luong,ghi_chu,sort_no", "sp_kem_id=in.("+f.idList()+")"),
		"yt", sel("sp_yeu_thich", "id,sp_id", ct),
		"ls", sel("db_san_pham_history", "id,ma_sp,field", "ma_sp=in.("+strings.Join(txMa, ",")+")"),
		"audit", sel("audit_log", "id,action", ct)))
}

func (f *txFix) svc(coTx bool, hong func(op, table string) error) *Service {
	deps := stubDeps{repo: f.db}
	d := Deps{Repo: &hongRepo{Repository: f.db, hong: hong}, Auditor: deps, Users: deps, UserFmt: deps, Notifier: deps,
		Admins: deps, Uploader: &fakeUploader{}}
	if coTx {
		d.DB = f.db
	}
	return New(d)
}

func (f *txFix) combo(sp, kem string, sl float64) {
	f.t.Helper()
	if _, err := f.db.InsertOne(f.root, "sp_combo", omap.Of("sp_id", f.ids[sp], "sp_kem_id", f.ids[kem], "so_luong", sl,
		"ghi_chu", "ZZ", "sort_no", 0.0), database.Opt{NoScope: true}); err != nil {
		f.t.Fatal(err)
	}
}

var txActor = &actor.Actor{U: "zz_d13sp_admin", R: "admin"}

// hongLan: lỗi ở lần thứ n gặp (op, bảng); các lệnh khác chạy bình thường.
func hongLan(op, table string, n int, loi func() error) func(string, string) error {
	dem := 0
	return func(o, tb string) error {
		if o == op && tb == table {
			if dem++; dem == n {
				return loi()
			}
		}
		return nil
	}
}

func TestTxSetComboRollback(t *testing.T) {
	f := newTxFix(t)
	f.combo("A", "B", 2)
	f.combo("A", "C", 1)
	f.combo("B", "A", 1) // liên kết bên kia đặt -> bị xoá ở lệnh ghi 1
	items := []any{omap.Of("id", f.ids["D"], "soLuong", 1.0)}
	truoc := f.chup()
	// lệnh ghi 1: Remove sp_combo (B->A); lệnh ghi 2: Insert sp_combo (A->D) -> hỏng
	_, err := f.svc(true, hongLan("insert", "sp_combo", 1, func() error { return loiTiem })).SetCombo(f.ctx, txActor, f.ids["A"], items)
	if err != loiTiem {
		t.Fatalf("lỗi trả về phải là lỗi tiêm nguyên vẹn, nhận %v", err)
	}
	if sau := f.chup(); sau != truoc {
		t.Fatalf("rollback không sạch:\n trước %s\n sau   %s", truoc, sau)
	}
	// đối chứng: không transaction -> B->A đã mất (dữ liệu dở dang)
	if _, err := f.svc(false, hongLan("insert", "sp_combo", 1, func() error { return loiTiem })).SetCombo(f.ctx, txActor, f.ids["A"], items); err != loiTiem {
		t.Fatalf("đối chứng: %v", err)
	}
	if f.chup() == truoc {
		t.Fatal("đối chứng không transaction phải để lại dữ liệu dở - test không nhạy")
	}
	// thành công trong transaction: kết quả + dữ liệu như cũ
	out, err := f.svc(true, func(string, string) error { return nil }).SetCombo(f.ctx, txActor, f.ids["A"], items)
	if err != nil || js(out) != `{"ok":true,"count":1}` {
		t.Fatalf("thành công: %v %s", err, js(out))
	}
	c1, _ := f.db.Select(f.root, "sp_combo", database.SelectOpt{Select: "sp_id,sp_kem_id,so_luong", Filter: "sp_id=in.(" + f.idList() + ")", NoScope: true})
	c2, _ := f.db.Select(f.root, "sp_combo", database.SelectOpt{Select: "sp_id", Filter: "sp_kem_id=in.(" + f.idList() + ")", NoScope: true})
	if len(c1) != 1 || jsval.ToString(c1[0].Val("sp_kem_id")) != jsval.ToString(f.ids["D"]) || len(c2) != 1 {
		t.Errorf("combo sau khi lưu: %s / %s", js(c1), js(c2))
	}
	ls, _ := f.db.Select(f.root, "db_san_pham_history", database.SelectOpt{Filter: database.Eq("ma_sp", "ZZ_D13SP_A") + "&" + database.Eq("field", "SẢN PHẨM ĐI KÈM"), NoScope: true})
	if len(ls) != 1 {
		t.Errorf("lịch sử combo: %d dòng (chỉ lần thành công mới ghi)", len(ls))
	}
}

func TestTxSetBienTheRollback(t *testing.T) {
	f := newTxFix(t)
	ns := database.Opt{NoScope: true}
	if _, err := f.db.Update(f.root, "db_san_pham", "id=in.("+joinIDs([]any{f.ids["A"], f.ids["B"]})+")", omap.Of("nhom_bt", "ZZ_D13_BT"), ns); err != nil {
		t.Fatal(err)
	}
	ids := []any{f.ids["C"]}
	truoc := f.chup()
	// lệnh ghi 1: Update B nhom_bt=null; lệnh ghi 2: Update A,C nhom_bt=ZZ_D13_BT -> hỏng
	_, err := f.svc(true, hongLan("update", "db_san_pham", 2, func() error { return loiTiem })).SetBienThe(f.ctx, txActor, f.ids["A"], ids)
	if err != loiTiem {
		t.Fatalf("lỗi trả về phải là lỗi tiêm nguyên vẹn, nhận %v", err)
	}
	if sau := f.chup(); sau != truoc {
		t.Fatalf("rollback không sạch:\n trước %s\n sau   %s", truoc, sau)
	}
	if _, err := f.svc(false, hongLan("update", "db_san_pham", 2, func() error { return loiTiem })).SetBienThe(f.ctx, txActor, f.ids["A"], ids); err != loiTiem {
		t.Fatalf("đối chứng: %v", err)
	}
	if f.chup() == truoc {
		t.Fatal("đối chứng không transaction phải để lại dữ liệu dở - test không nhạy")
	}
	// đưa B về nhóm rồi chạy thành công
	if _, err := f.db.Update(f.root, "db_san_pham", database.Eq("id", f.ids["B"]), omap.Of("nhom_bt", "ZZ_D13_BT"), ns); err != nil {
		t.Fatal(err)
	}
	out, err := f.svc(true, func(string, string) error { return nil }).SetBienThe(f.ctx, txActor, f.ids["A"], ids)
	if err != nil || js(out) != `{"ok":true,"count":1}` {
		t.Fatalf("thành công: %v %s", err, js(out))
	}
	sp, _ := f.db.Select(f.root, "db_san_pham", database.SelectOpt{Select: "ma_sp,nhom_bt", Filter: "ma_sp=in.(" + strings.Join(txMa, ",") + ")", Order: "ma_sp.asc", NoScope: true})
	if js(sp) != `[{"ma_sp":"ZZ_D13SP_A","nhom_bt":"ZZ_D13_BT"},{"ma_sp":"ZZ_D13SP_B","nhom_bt":null},{"ma_sp":"ZZ_D13SP_C","nhom_bt":"ZZ_D13_BT"},{"ma_sp":"ZZ_D13SP_D","nhom_bt":null}]` {
		t.Errorf("nhóm sau khi lưu: %s", js(sp))
	}
}

func TestTxDeleteDbProductRollback(t *testing.T) {
	f := newTxFix(t)
	f.combo("A", "B", 1)
	f.combo("C", "A", 1)
	if _, err := f.db.InsertOne(f.root, "sp_yeu_thich", omap.Of("cong_ty_id", f.ctID, "sp_id", f.ids["A"], "ma_sp", "ZZ_D13SP_A",
		"nguoi_tao", "zz"), database.Opt{NoScope: true}); err != nil {
		t.Fatal(err)
	}
	truoc := f.chup()
	key := jsval.ToString(f.ids["A"])
	// Lệnh dọn liên kết cố ý nuốt lỗi -> chỉ panic (sập giữa chừng) mới làm hỏng thao tác. Hỏng ở lệnh cuối (sp_yeu_thich):
	// SP + combo đã xoá trong transaction -> rollback hết.
	xoa := func(coTx bool) (rec any) {
		defer func() { rec = recover() }()
		_, _ = f.svc(coTx, hongLan("remove", "sp_yeu_thich", 1, func() error { panic(loiTiem) })).DeleteDbProduct(f.ctx, txActor, key)
		return nil
	}
	if rec := xoa(true); rec != loiTiem {
		t.Fatalf("panic phải đi nguyên qua Tx, nhận %v", rec)
	}
	if sau := f.chup(); sau != truoc {
		t.Fatalf("rollback không sạch:\n trước %s\n sau   %s", truoc, sau)
	}
	if rec := xoa(false); rec != loiTiem {
		t.Fatalf("đối chứng: %v", rec)
	}
	if f.chup() == truoc {
		t.Fatal("đối chứng không transaction phải để lại dữ liệu dở - test không nhạy")
	}
	// dựng lại A rồi xoá thành công; lỗi ở lệnh dọn combo vẫn bị nuốt như Node (transaction không hỏng theo)
	f = newTxFix(t)
	f.combo("A", "B", 1)
	if _, err := f.db.InsertOne(f.root, "sp_yeu_thich", omap.Of("cong_ty_id", f.ctID, "sp_id", f.ids["A"], "ma_sp", "ZZ_D13SP_A",
		"nguoi_tao", "zz"), database.Opt{NoScope: true}); err != nil {
		t.Fatal(err)
	}
	// Lệnh dọn combo thứ 2 chạy THẬT xuống Postgres với filter sai kiểu (22P02): lỗi DB thật bị nuốt, transaction vẫn
	// dùng tiếp được (lệnh sp_yeu_thich sau đó chạy + commit), không thành 25P02.
	dem := 0
	hr := &hongRepo{Repository: f.db, hong: func(string, string) error { return nil }, sai: func(table string) string {
		if table == "sp_combo" {
			if dem++; dem == 2 {
				return "sp_kem_id=eq.zz-khong-phai-so"
			}
		}
		return ""
	}}
	deps := stubDeps{repo: f.db}
	sv := New(Deps{DB: f.db, Repo: hr, Auditor: deps, Users: deps, UserFmt: deps, Notifier: deps, Admins: deps, Uploader: &fakeUploader{}})
	out, err := sv.DeleteDbProduct(f.ctx, txActor, jsval.ToString(f.ids["A"]))
	if err != nil || js(out) != `{"ok":true,"ma":"ZZ_D13SP_A","ten":"ZZ sp A"}` {
		t.Fatalf("thành công: %v %s", err, js(out))
	}
	var de *database.Error
	if len(hr.loiDB) != 1 || !errors.As(hr.loiDB[0], &de) || !strings.HasPrefix(de.Code, "22") {
		t.Fatalf("lệnh dọn combo thứ 2 phải hỏng THẬT ở Postgres (22xxx), nhận %v", hr.loiDB)
	}
	sp, _ := f.db.Select(f.root, "db_san_pham", database.SelectOpt{Select: "id", Filter: database.Eq("ma_sp", "ZZ_D13SP_A"), NoScope: true})
	yt, _ := f.db.Select(f.root, "sp_yeu_thich", database.SelectOpt{Select: "id", Filter: database.Eq("cong_ty_id", f.ctID), NoScope: true})
	ls, _ := f.db.Select(f.root, "db_san_pham_history", database.SelectOpt{Select: "id", Filter: database.Eq("ma_sp", "ZZ_D13SP_A") + "&" + database.Eq("field", "XOÁ SẢN PHẨM"), NoScope: true})
	au, _ := f.db.Select(f.root, "audit_log", database.SelectOpt{Select: "id", Filter: database.Eq("cong_ty_id", f.ctID) + "&" + database.Eq("action", "xoa_sp"), NoScope: true})
	if len(sp) != 0 || len(yt) != 0 || len(ls) != 1 || len(au) != 1 {
		t.Errorf("sau khi xoá: sp %d, yêu thích %d, lịch sử %d, audit %d", len(sp), len(yt), len(ls), len(au))
	}
}

// Bọc Tx làm khoá dòng giữ tới commit: 2 người cùng sửa 1 nhóm biến thể theo thứ tự ngược -> deadlock THẬT (40P01).
// Nhóm {A,B,C,D}: T1 = SetBienThe(A,[B]) khoá C,D rồi chờ A,B; T2 = SetBienThe(C,[D]) khoá A,B rồi chờ C,D.
// s.tx KHÔNG chạy lại: bên bị Postgres huỷ nhận loiTranhChap (không lỗi DB thô), bên kia ok; dữ liệu = chỉ bên thắng
// (bên huỷ rollback sạch, không đè nhóm bên thắng vừa lưu); lịch sử / audit chỉ của bên thắng.
func TestTxSetBienTheDeadlock(t *testing.T) {
	f := newTxFix(t)
	ns := database.Opt{NoScope: true}
	if _, err := f.db.Update(f.root, "db_san_pham", "id=in.("+f.idList()+")", omap.Of("nhom_bt", "ZZ_D13_BT"), ns); err != nil {
		t.Fatal(err)
	}
	// rao: cả 2 đã chạy xong lệnh ghi 1 (giữ khoá) rồi mới cùng sang lệnh ghi 2 -> chắc chắn deadlock ở lần đầu
	var rao sync.WaitGroup
	rao.Add(2)
	var tong atomic.Int32
	hook := func() func(string, string) error {
		dem := 0
		return func(op, tb string) error {
			if op == "update" && tb == "db_san_pham" {
				tong.Add(1)
				if dem++; dem == 2 {
					rao.Done()
					cho := make(chan struct{})
					go func() { rao.Wait(); close(cho) }()
					select {
					case <-cho:
					case <-time.After(10 * time.Second):
					}
				}
			}
			return nil
		}
	}
	type kq struct {
		ma  string
		out *omap.Map
		err error
	}
	ch := make(chan kq, 2)
	for _, p := range [][2]string{{"A", "B"}, {"C", "D"}} {
		sv := f.svc(true, hook())
		go func(p [2]string) {
			out, err := sv.SetBienThe(f.ctx, txActor, f.ids[p[0]], []any{f.ids[p[1]]})
			ch <- kq{p[0], out, err}
		}(p)
	}
	thang := ""
	for i := 0; i < 2; i++ {
		r := <-ch
		switch {
		case r.err == nil && js(r.out) == `{"ok":true,"count":1}`:
			if thang != "" {
				t.Fatal("cả 2 cùng thành công - không có deadlock, test không nhạy")
			}
			thang = r.ma
		case r.err != nil && r.err.Error() == loiTranhChap && r.out == nil:
		default:
			t.Fatalf("SetBienThe song song (%s): %v %s", r.ma, r.err, js(r.out))
		}
	}
	if thang == "" {
		t.Fatal("không bên nào thành công")
	}
	// 2 lệnh ghi mỗi bên, không chạy lại -> 4
	if n := tong.Load(); n != 4 {
		t.Fatalf("số lệnh update = %d, cần 4 (deadlock, không chạy lại)", n)
	}
	sp, _ := f.db.Select(f.root, "db_san_pham", database.SelectOpt{Select: "ma_sp,nhom_bt", Filter: "ma_sp=in.(" + strings.Join(txMa, ",") + ")", Order: "ma_sp.asc", NoScope: true})
	nhom := func(ab, cd any) string {
		return js([]*omap.Map{omap.Of("ma_sp", "ZZ_D13SP_A", "nhom_bt", ab), omap.Of("ma_sp", "ZZ_D13SP_B", "nhom_bt", ab),
			omap.Of("ma_sp", "ZZ_D13SP_C", "nhom_bt", cd), omap.Of("ma_sp", "ZZ_D13SP_D", "nhom_bt", cd)})
	}
	can := nhom("ZZ_D13_BT", nil) // A thắng: C,D ra khỏi nhóm
	if thang == "C" {
		can = nhom(nil, "ZZ_D13_BT")
	}
	if g := js(sp); g != can {
		t.Errorf("nhóm phải = chỉ bên thắng (%s): cần %s, nhận %s", thang, can, g)
	}
	ct := database.Eq("cong_ty_id", f.ctID)
	ls, _ := f.db.Select(f.root, "db_san_pham_history", database.SelectOpt{Select: "ma_sp", Filter: "ma_sp=in.(" + strings.Join(txMa, ",") + ")", NoScope: true})
	au, _ := f.db.Select(f.root, "audit_log", database.SelectOpt{Select: "id", Filter: ct + "&" + database.Eq("action", "sua_bien_the"), NoScope: true})
	if len(ls) != 1 || jsval.S(ls[0].Val("ma_sp")) != "ZZ_D13SP_"+thang || len(au) != 1 {
		t.Errorf("lịch sử / audit chỉ của bên thắng: lịch sử %s, audit %d", js(ls), len(au))
	}
}
