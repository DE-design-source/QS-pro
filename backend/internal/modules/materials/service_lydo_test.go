package materials

import (
	"context"
	"errors"
	"strings"
	"testing"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/omap"
)

/* Lý do xoá / lý do từ chối của yêu cầu xoá sản phẩm (M15.2, chỉ bản Go - không có golden Node). */

// lyDoRepo: kho giả ghi lại mọi lệnh; Select trả dòng theo bảng.
type lyDoRepo struct {
	rows      map[string][]*omap.Map
	calls     []string
	failPatch error
}

func (r *lyDoRepo) Select(_ context.Context, table string, opt ...database.SelectOpt) ([]*omap.Map, error) {
	r.calls = append(r.calls, "select "+table)
	return r.rows[table], nil
}
func (r *lyDoRepo) Insert(_ context.Context, table string, rows []*omap.Map, _ ...database.Opt) ([]*omap.Map, error) {
	r.calls = append(r.calls, "insert "+table+" "+js(rows))
	return rows, nil
}
func (r *lyDoRepo) InsertOne(_ context.Context, table string, row *omap.Map, _ ...database.Opt) ([]*omap.Map, error) {
	r.calls = append(r.calls, "insert "+table+" "+js(row))
	return []*omap.Map{row.Clone().Set("id", 7.0)}, nil
}
func (r *lyDoRepo) Update(_ context.Context, table, filter string, patch *omap.Map, _ ...database.Opt) ([]*omap.Map, error) {
	r.calls = append(r.calls, "update "+table+" "+filter+" "+js(patch))
	if _, ok := patch.Get("resolution_note"); ok && r.failPatch != nil {
		return nil, r.failPatch
	}
	return []*omap.Map{patch}, nil
}
func (r *lyDoRepo) Remove(_ context.Context, table, filter string, _ ...database.Opt) ([]*omap.Map, error) {
	r.calls = append(r.calls, "remove "+table+" "+filter)
	return nil, nil
}

// thongBao: thân các thông báo đã ghi (stubDeps.Notify chèn vào bảng notifications).
func (r *lyDoRepo) thongBao() []string {
	out := []string{}
	for _, c := range r.calls {
		if strings.HasPrefix(c, "insert notifications ") {
			m, _ := omap.DecodeString(strings.TrimPrefix(c, "insert notifications "))
			out = append(out, js(m.(*omap.Map).Val("body")))
		}
	}
	return out
}

var staffA = &actor.Actor{UID: "U2", U: "nv", R: "staff"}

func TestRequestDeleteLyDo(t *testing.T) {
	ctx := context.Background()
	items := []any{omap.Of("maSP", "M7", "ten", "SP 7")}
	base := map[string][]*omap.Map{"users": {omap.Of("id", "A1", "username", "ad", "ho_ten", "Nhân Viên", "role", "admin", "active", true)}}

	// không có lý do / rỗng / không phải chuỗi: lệnh chèn y như Node (không có khoá note), thông báo như cũ
	for _, v := range []any{nil, "", "   ", 5.0} {
		r := &lyDoRepo{rows: base}
		s, _ := newSvc(r, &fakeUploader{})
		if _, err := s.RequestDeleteProducts(ctx, staffA, items, v); err != nil {
			t.Fatalf("%v: %v", v, err)
		}
		for _, c := range r.calls {
			if strings.HasPrefix(c, "insert delete_requests") && strings.Contains(c, `"note"`) {
				t.Errorf("%v: không được ghi note: %s", v, c)
			}
		}
		if got := strings.Join(r.thongBao(), "|"); got != `"Nhân Viên yêu cầu xóa 1 sản phẩm"` {
			t.Errorf("%v: thông báo %s", v, got)
		}
	}

	// có lý do: trim, ghi vào note trong CÙNG lệnh chèn (khoá cuối), nối vào thông báo
	r := &lyDoRepo{rows: base}
	s, _ := newSvc(r, &fakeUploader{})
	if _, err := s.RequestDeleteProducts(ctx, staffA, items, "  trùng mã  "); err != nil {
		t.Fatal(err)
	}
	ins := ""
	for _, c := range r.calls {
		if strings.HasPrefix(c, "insert delete_requests") {
			ins = c
		}
	}
	if !strings.HasSuffix(ins, `"status":"pending","note":"trùng mã"}`) {
		t.Errorf("lệnh chèn: %s", ins)
	}
	if got := strings.Join(r.thongBao(), "|"); got != `"Nhân Viên yêu cầu xóa 1 sản phẩm: trùng mã"` {
		t.Errorf("thông báo %s", got)
	}

	// quá 500 ký tự: lỗi, không ghi gì
	r = &lyDoRepo{rows: base}
	s, _ = newSvc(r, &fakeUploader{})
	if _, err := s.RequestDeleteProducts(ctx, staffA, items, strings.Repeat("ạ", 501)); err == nil || err.Error() != "Lý do tối đa 500 ký tự" || len(r.calls) != 0 {
		t.Errorf("err = %v calls = %v", err, r.calls)
	}
	if _, err := s.RequestDeleteProducts(ctx, staffA, items, strings.Repeat("ạ", 500)); err != nil {
		t.Errorf("500 ký tự phải được: %v", err)
	}
}

func TestResolveDeleteLyDo(t *testing.T) {
	ctx := context.Background()
	adm := &actor.Actor{UID: "A1", U: "ad", R: "admin"}
	rows := func() map[string][]*omap.Map {
		return map[string][]*omap.Map{
			"delete_requests": {omap.Of("id", 7.0, "status", "pending", "requester_id", "U2", "items", `[{"maSP":"M7","id":"","ten":""}]`)},
			"users":           {omap.Of("id", "A1", "username", "ad", "ho_ten", "Admin A")},
		}
	}

	// từ chối có lý do: lệnh RIÊNG ghi resolution_note sau lệnh giành quyền, thông báo nối lý do
	r := &lyDoRepo{rows: rows()}
	s, _ := newSvc(r, &fakeUploader{})
	if res, err := s.ResolveDeleteRequest(ctx, adm, 7.0, false, " hàng còn dùng "); err != nil || js(res) != `{"ok":true}` {
		t.Fatalf("res = %s err = %v", js(res), err)
	}
	upd := []string{}
	for _, c := range r.calls {
		if strings.HasPrefix(c, "update delete_requests") {
			upd = append(upd, c)
		}
	}
	if len(upd) != 2 || !strings.Contains(upd[0], "status=eq.pending") || upd[1] != `update delete_requests id=eq.7 {"resolution_note":"hàng còn dùng"}` {
		t.Errorf("updates = %q", upd)
	}
	if got := strings.Join(r.thongBao(), "|"); got != `"Yêu cầu xóa 1 sản phẩm không được duyệt: hàng còn dùng"` {
		t.Errorf("thông báo %s", got)
	}

	// từ chối không lý do: không có lệnh riêng, thông báo như Node
	r = &lyDoRepo{rows: rows()}
	s, _ = newSvc(r, &fakeUploader{})
	if _, err := s.ResolveDeleteRequest(ctx, adm, 7.0, false, nil); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(strings.Join(r.calls, "|"), "resolution_note") ||
		strings.Join(r.thongBao(), "|") != `"Yêu cầu xóa 1 sản phẩm không được duyệt"` {
		t.Errorf("calls = %q", r.calls)
	}

	// database chưa migrate (lệnh riêng lỗi): chỉ ghi log, việc từ chối vẫn xong và vẫn báo người gửi
	r = &lyDoRepo{rows: rows(), failPatch: errors.New(`DB PATCH delete_requests -> 400 {"code":"PGRST204"}`)}
	s, _ = newSvc(r, &fakeUploader{})
	if res, err := s.ResolveDeleteRequest(ctx, adm, 7.0, false, "x"); err != nil || js(res) != `{"ok":true}` || len(r.thongBao()) != 1 {
		t.Errorf("res = %s err = %v", js(res), err)
	}

	// duyệt: lý do bị bỏ qua
	r = &lyDoRepo{rows: rows()}
	s, _ = newSvc(r, &fakeUploader{})
	_, _ = s.ResolveDeleteRequest(ctx, adm, 7.0, true, "x")
	if strings.Contains(strings.Join(r.calls, "|"), "resolution_note") {
		t.Errorf("duyệt không ghi lý do: %q", r.calls)
	}

	// lý do quá dài: lỗi trước khi giành quyền
	r = &lyDoRepo{rows: rows()}
	s, _ = newSvc(r, &fakeUploader{})
	if _, err := s.ResolveDeleteRequest(ctx, adm, 7.0, false, strings.Repeat("a", 501)); err == nil ||
		strings.Contains(strings.Join(r.calls, "|"), "update") {
		t.Errorf("err = %v calls = %q", err, r.calls)
	}
}

func TestListDeleteRequestsLyDo(t *testing.T) {
	r := &lyDoRepo{rows: map[string][]*omap.Map{"delete_requests": {
		omap.Of("id", 7.0, "requester_name", "nv", "items", "[]", "status", "rejected", "created_at", "t", "resolved_at", "t2",
			"resolver_name", "ad", "note", "trùng mã", "resolution_note", "còn dùng"),
		omap.Of("id", 8.0, "requester_name", "nv", "items", "[]", "status", "pending", "created_at", "t", "resolved_at", nil,
			"resolver_name", nil, "note", nil, "resolution_note", nil),
	}}}
	s, _ := newSvc(r, &fakeUploader{})
	out, err := s.ListDeleteRequests(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	want := `[{"id":7,"requester":"nv","items":[],"status":"rejected","at":"t","resolvedAt":"t2","resolver":"ad","lyDo":"trùng mã","lyDoTuChoi":"còn dùng"},` +
		`{"id":8,"requester":"nv","items":[],"status":"pending","at":"t","resolvedAt":null,"resolver":null,"lyDo":null,"lyDoTuChoi":null}]`
	if got := js(out); got != want {
		t.Errorf("\n got:  %s\n want: %s", got, want)
	}
}
