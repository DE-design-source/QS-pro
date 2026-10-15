package purchasing

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

/* Hành vi chỉ bản Go của module (không có golden Node): người / ngày duyệt đơn (M15.1), kết quả gửi Lark (M9.1),
   route GET /my-proposals/:code (M13.1) và các khoá kết quả nối cuối. */

func js(v any) string {
	s, err := omap.MarshalString(v)
	if err != nil {
		return "LỖI: " + err.Error()
	}
	return s
}

// lastKeys: n khoá cuối của object (kiểm "nối khoá CUỐI").
func lastKeys(m *omap.Map, n int) string {
	ks := m.Keys()
	if len(ks) < n {
		return strings.Join(ks, ",")
	}
	return strings.Join(ks[len(ks)-n:], ",")
}

func TestResolvePurchaseWritesResolver(t *testing.T) {
	ctx := context.Background()
	at := time.Date(2026, 10, 15, 3, 4, 5, 678e6, time.UTC)
	order := omap.Of("ma_don", "MH-1", "nha_cung_cap", "NCC A", "requester_id", "u-9", "nguoi_gui", "Mai")

	// thành công: lệnh riêng SAU lệnh đổi trạng thái, tên = ho_ten || username
	repo := &fakeRepo{order: order, updN: 1}
	s, _, nt, _ := unitSvc(repo, "")
	s.users = fakeUsers{row: omap.Of("ho_ten", "", "username", "lan")}
	s.now = func() time.Time { return at }
	logs := captureLog(t, func() {
		if r, err := s.ResolvePurchaseRequest(ctx, testActor, "MH-1", true); err != nil || js(r) != `{"ok":true}` {
			t.Errorf("r = %s err = %v", js(r), err)
		}
	})
	if got := strings.Join(repo.calls, "|"); got != "updateStatus from Chờ duyệt|patchOrder MH-1" {
		t.Errorf("calls = %s", got)
	}
	if got := js(repo.patches); got != `[{"ma":"MH-1","patch":{"nguoi_duyet":"lan","ngay_duyet":"2026-10-15T03:04:05.678Z"}}]` {
		t.Errorf("patches = %s", got)
	}
	if len(logs) != 0 || len(nt.recs) != 1 {
		t.Errorf("logs = %q notif = %s", logs, js(nt.recs))
	}

	// không đọc được tài khoản -> username của phiên
	repo = &fakeRepo{order: order, updN: 1}
	s, _, _, _ = unitSvc(repo, "")
	if _, err := s.ResolvePurchaseRequest(ctx, testActor, "MH-1", false); err != nil ||
		jsval.S(jsval.Get(jsval.Get(repo.patches[0], "patch"), "nguoi_duyet")) != "mai" {
		t.Errorf("err = %v patches = %s", err, js(repo.patches))
	}

	// database chưa migrate: lệnh riêng lỗi -> chỉ ghi log, việc duyệt vẫn thành công và vẫn báo người gửi
	repo = &fakeRepo{order: order, updN: 1, failPatch: errors.New(`DB PATCH don_mua_hang -> 400 {"code":"42703"}`)}
	s, _, nt, au := unitSvc(repo, "")
	logs = captureLog(t, func() {
		if r, err := s.ResolvePurchaseRequest(ctx, testActor, "MH-1", true); err != nil || js(r) != `{"ok":true}` {
			t.Errorf("r = %s err = %v", js(r), err)
		}
	})
	if strings.Join(logs, "|") != `[mua hàng] ghi người duyệt lỗi: DB PATCH don_mua_hang -> 400 {"code":"42703"}` ||
		len(nt.recs) != 1 || len(au.recs) != 1 {
		t.Errorf("logs = %q notif = %d audit = %d", logs, len(nt.recs), len(au.recs))
	}

	// đơn đã xử lý: không ghi gì thêm
	repo = &fakeRepo{order: order}
	s, _, _, _ = unitSvc(repo, "")
	if _, err := s.ResolvePurchaseRequest(ctx, testActor, "MH-1", true); err == nil || err.Error() != errDonDaXuLy || len(repo.patches) != 0 {
		t.Errorf("err = %v patches = %s", err, js(repo.patches))
	}
}

func TestSendWritesLarkResult(t *testing.T) {
	ctx := context.Background()
	reply := `{"code":0}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = io.WriteString(w, reply)
	}))
	defer srv.Close()
	two := omap.Of("orders", []any{omap.Of("supplier", "A"), omap.Of("supplier", "B")})

	for _, c := range []struct{ reply, want string }{{`{"code":0}`, "ok"}, {`{"code":9,"msg":"bad"}`, "loi"}} {
		reply = c.reply
		repo := &fakeRepo{}
		s, _, _, _ := unitSvc(repo, srv.URL)
		var res *omap.Map
		_ = captureLog(t, func() { res, _ = s.SendPurchaseRequest(ctx, testActor, two) })
		want := `[{"ma":"<ma>","patch":{"ket_qua_gui":"` + c.want + `"}},{"ma":"<ma>","patch":{"ket_qua_gui":"` + c.want + `"}}]`
		if got := js(repo.patches); got != want || res.Val("lark") != (c.want == "ok") {
			t.Errorf("%s: patches = %s res = %s", c.reply, got, js(res))
		}
		// lệnh lưu vẫn ghi "pending" như Node; kết quả thật đến từ lệnh riêng sau khi gửi
		if jsval.S(repo.orders[0].Val("ket_qua_gui")) != "pending" {
			t.Errorf("lệnh lưu: %s", js(repo.orders[0]))
		}
	}

	// không có webhook: "loi"
	repo := &fakeRepo{}
	s, _, _, _ := unitSvc(repo, "")
	_ = captureLog(t, func() { _, _ = s.SendPurchaseRequest(ctx, testActor, two) })
	if len(repo.patches) != 2 || !strings.Contains(js(repo.patches), `"loi"`) {
		t.Errorf("patches = %s", js(repo.patches))
	}

	// không lưu đơn nào: không ghi
	repo = &fakeRepo{}
	s, _, _, _ = unitSvc(repo, srv.URL)
	_ = captureLog(t, func() { _, _ = s.SendPurchaseRequest(ctx, testActor, omap.Of("orders", []any{})) })
	if len(repo.patches) != 0 {
		t.Errorf("patches = %s", js(repo.patches))
	}

	// lệnh riêng lỗi: 1 dòng log, dừng ở mã đầu, vẫn {ok: true}
	reply = `{"code":0}`
	repo = &fakeRepo{failPatch: errors.New("boom")}
	s, _, _, _ = unitSvc(repo, srv.URL)
	var res *omap.Map
	var err error
	logs := captureLog(t, func() { res, err = s.SendPurchaseRequest(ctx, testActor, two) })
	if err != nil || res.Val("ok") != true || res.Val("lark") != true || len(repo.patches) != 1 ||
		strings.Join(logs, "|") != "[mua hàng] ghi kết quả gửi Lark lỗi: boom" {
		t.Errorf("res = %s err = %v patches = %d logs = %q", js(res), err, len(repo.patches), logs)
	}
}

func TestGetMyDeXuat(t *testing.T) {
	ctx := context.Background()
	staff := &actor.Actor{UID: "u-2", U: "nv", R: "staff"}
	mine := omap.Of("ma_de_xuat", "CK-1", "loai", "ck", "requester_id", "u-2", "trang_thai", "Chờ duyệt")
	other := omap.Of("ma_de_xuat", "CK-2", "loai", "ck", "requester_id", "u-3")
	noReq := omap.Of("ma_de_xuat", "CK-3", "loai", "ck", "requester_id", nil)

	s, _, _, _ := unitSvc(&fakeRepo{proposal: mine}, "")
	if r, err := s.GetMyDeXuat(ctx, staff, "CK-1"); err != nil || r.Val("ma") != "CK-1" || r.Val("status") != "Chờ duyệt" {
		t.Errorf("phiếu của mình: %s %v", js(r), err)
	}
	for _, p := range []*omap.Map{other, noReq, nil} {
		s, _, _, _ = unitSvc(&fakeRepo{proposal: p}, "")
		if _, err := s.GetMyDeXuat(ctx, staff, "CK-x"); err == nil || err.Error() != errKhongThayPhieu {
			t.Errorf("%s: err = %v", js(p), err)
		}
	}
	// admin / super: mọi phiếu của công ty (như getDeXuat)
	for _, a := range []*actor.Actor{testActor, {UID: "s", U: "sup", R: "super"}} {
		s, _, _, _ = unitSvc(&fakeRepo{proposal: other}, "")
		if r, err := s.GetMyDeXuat(ctx, a, "CK-2"); err != nil || r.Val("ma") != "CK-2" {
			t.Errorf("%s: %s %v", a.R, js(r), err)
		}
		s, _, _, _ = unitSvc(&fakeRepo{}, "")
		if _, err := s.GetMyDeXuat(ctx, a, "CK-x"); err == nil || err.Error() != errKhongThayDX {
			t.Errorf("%s: err = %v", a.R, err)
		}
	}
	if _, err := s.GetMyDeXuat(ctx, nil, "CK-1"); err == nil {
		t.Error("không có actor phải lỗi")
	}
}

func TestGoOnlyResultKeys(t *testing.T) {
	ctx := context.Background()
	row := omap.Of("ma_don", "MH-1", "trang_thai", "Đã duyệt", "kenh_gui", "Lark", "ket_qua_gui", "loi",
		"nguoi_duyet", "Lan", "ngay_duyet", "2026-10-15T03:04:05.678+00:00")
	repo := &fakeRepo{orders: []*omap.Map{row}, order: row}
	s, _, _, _ := unitSvc(repo, "")

	list, err := s.GetPurchaseOrders(ctx, "DA")
	if err != nil || len(list) != 1 {
		t.Fatalf("getPurchaseOrders: %v", err)
	}
	if m := list[0].(*omap.Map); lastKeys(m, 4) != "items,nguoiDuyet,ngayDuyet,ketQuaGui" || m.Val("ketQuaGui") != "loi" || m.Val("nguoiDuyet") != "Lan" {
		t.Errorf("getPurchaseOrders: %s", js(m))
	}
	reqs, _ := s.ListPurchaseRequests(ctx, testActor)
	if m := reqs[0].(*omap.Map); lastKeys(m, 3) != "at,resolver,resolvedAt" || m.Val("resolver") != "Lan" {
		t.Errorf("listPurchaseRequests: %s", js(m))
	}
	one, _ := s.GetPurchaseOrder(ctx, testActor, "MH-1")
	if lastKeys(one, 3) != "items,kenhGui,ketQuaGui" || one.Val("kenhGui") != "Lark" || one.Val("ketQuaGui") != "loi" {
		t.Errorf("getPurchaseOrder: %s", js(one))
	}
}
