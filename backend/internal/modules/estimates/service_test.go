package estimates

import (
	"context"
	"errors"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

/* Giá trị mong đợi trong testdata/golden.json lấy bằng cách chạy mã Node thật (testdata/gen.js). */

func golden(t *testing.T) *omap.Map {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", "golden.json"))
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	return jsval.AsMap(v)
}

// {"$undef":true} -> undefined
func undef(v any) any {
	switch x := v.(type) {
	case []any:
		out := make([]any, len(x))
		for i, it := range x {
			out[i] = undef(it)
		}
		return out
	case *omap.Map:
		if x.Has("$undef") {
			return jsval.Undefined
		}
		out := omap.New()
		x.Each(func(k string, it any) { out.Set(k, undef(it)) })
		return out
	}
	return v
}

func js(t *testing.T, v any) string {
	t.Helper()
	s, err := omap.MarshalString(v)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func errText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

/*** repository + phụ thuộc giả ***/

type fakeRepo struct {
	list    func() ([]*omap.Map, error)
	get     func(id any) (*omap.Map, error)
	insert  func(rows []*omap.Map) ([]*omap.Map, error)
	update  func(id any, patch *omap.Map) ([]*omap.Map, error)
	remove  func(id any) ([]*omap.Map, error)
	insHist func(rows []*omap.Map) error
	hist    func(id any) ([]*omap.Map, error)
	calls   []string
}

func (f *fakeRepo) ListCongTac(context.Context) ([]*omap.Map, error) {
	f.calls = append(f.calls, "list")
	return f.list()
}
func (f *fakeRepo) GetCongTac(_ context.Context, id any) (*omap.Map, error) {
	f.calls = append(f.calls, "get")
	if f.get == nil {
		return nil, nil
	}
	return f.get(id)
}
func (f *fakeRepo) InsertCongTac(_ context.Context, rows []*omap.Map) ([]*omap.Map, error) {
	f.calls = append(f.calls, "insert")
	return f.insert(rows)
}
func (f *fakeRepo) UpdateCongTac(_ context.Context, id any, patch *omap.Map) ([]*omap.Map, error) {
	f.calls = append(f.calls, "update")
	return f.update(id, patch)
}
func (f *fakeRepo) RemoveCongTac(_ context.Context, id any) ([]*omap.Map, error) {
	f.calls = append(f.calls, "remove")
	return f.remove(id)
}
func (f *fakeRepo) InsertHistory(_ context.Context, rows []*omap.Map) error {
	f.calls = append(f.calls, "insHist")
	if f.insHist == nil {
		return nil
	}
	return f.insHist(rows)
}
func (f *fakeRepo) ListHistory(_ context.Context, id any) ([]*omap.Map, error) {
	f.calls = append(f.calls, "hist")
	return f.hist(id)
}

type fakePerms struct {
	edit, duyet bool
	err         error
}

func (p fakePerms) SpPerms(context.Context, *actor.Actor) (bool, bool, bool, error) {
	return p.edit, p.duyet, false, p.err
}

type auditRec struct{ uid, user, action, detail string }

type fakeAudit struct{ recs []auditRec }

func (f *fakeAudit) Audit(_ context.Context, a *actor.Actor, action, detail string, congTyID any) {
	r := auditRec{action: action, detail: detail}
	if a != nil {
		r.uid, r.user = jsval.S(a.UID), a.U
	}
	f.recs = append(f.recs, r)
}

func newSvc(repo Repository, p fakePerms) (*Service, *fakeAudit) {
	au := &fakeAudit{}
	return New(Deps{Repo: repo, Perms: p, Auditor: au}), au
}

var testActor = &actor.Actor{UID: "u-1", U: "mai", R: "user"}

const (
	errMissNCC = `DB POST cong_tac -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the 'nha_cung_cap' column of 'cong_tac' in the schema cache"}`
	errMissFav = `DB PATCH cong_tac -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the 'yeu_thich' column of 'cong_tac' in the schema cache"}`
	errNoTable = `DB GET cong_tac -> 404 {"code":"PGRST205","details":null,"hint":null,"message":"Could not find the table 'public.cong_tac' in the schema cache"}`
	errNoHist  = `DB POST cong_tac_history -> 404 {"code":"PGRST205","details":null,"hint":null,"message":"Could not find the table 'public.cong_tac_history' in the schema cache"}`
)

/*** hàm thuần - đối chiếu với Node ***/

func TestCtToObjGolden(t *testing.T) {
	for i, c := range jsval.AsArray(golden(t).Val("toObj")) {
		m := jsval.AsMap(c)
		if got, want := js(t, ctToObj(jsval.AsMap(m.Val("in")))), js(t, m.Val("out")); got != want {
			t.Errorf("ca %d:\n go:   %s\n node: %s", i, got, want)
		}
	}
}

func TestCtToRowGolden(t *testing.T) {
	for i, c := range jsval.AsArray(golden(t).Val("toRow")) {
		m := jsval.AsMap(c)
		row, err := ctToRow(undef(m.Val("in")))
		if m.Has("err") {
			if errText(err) != jsval.AsString(m.Val("err")) {
				t.Errorf("ca %d: lỗi go %q, node %q", i, errText(err), m.Val("err"))
			}
			continue
		}
		if err != nil {
			t.Errorf("ca %d: lỗi không mong đợi %v", i, err)
			continue
		}
		if got, want := js(t, row), js(t, m.Val("out")); got != want {
			t.Errorf("ca %d:\n go:   %s\n node: %s", i, got, want)
		}
	}
}

func TestCtDiffGolden(t *testing.T) {
	for i, c := range jsval.AsArray(golden(t).Val("diff")) {
		m := jsval.AsMap(c)
		out := []any{}
		for _, ch := range ctDiff(jsval.AsMap(m.Val("cur")), jsval.AsMap(m.Val("row"))) {
			out = append(out, omap.Of("field", ch.Field, "old", ch.Old, "new", ch.New))
		}
		if got, want := js(t, out), js(t, m.Val("out")); got != want {
			t.Errorf("ca %d:\n go:   %s\n node: %s", i, got, want)
		}
	}
}

func TestCtErrGolden(t *testing.T) {
	for i, c := range jsval.AsArray(golden(t).Val("err")) {
		m := jsval.AsMap(c)
		e := errors.New(jsval.AsString(m.Val("msg")))
		if got := ctErr(e).Error(); got != m.Val("ctErr") {
			t.Errorf("ca %d ctErr: go %q, node %q", i, got, m.Val("ctErr"))
		}
		if got := ctMissingCol(e); got != m.Val("missingCol") {
			t.Errorf("ca %d ctMissingCol: go %q, node %q", i, got, m.Val("missingCol"))
		}
		if got := ctHistThieu(e); got != m.Val("histThieu") {
			t.Errorf("ca %d ctHistThieu: go %v, node %v", i, got, m.Val("histThieu"))
		}
		// ctList / ctGetHistory thật của Node với đúng lỗi này: {"out":[]} = nuốt, {"err":...} = ném lại
		repo := &fakeRepo{
			list: func() ([]*omap.Map, error) { return nil, e },
			hist: func(any) ([]*omap.Map, error) { return nil, e },
		}
		s, _ := newSvc(repo, fakePerms{})
		attempt := func(r []any, err error) string {
			if err != nil {
				return js(t, omap.Of("err", err.Error()))
			}
			return js(t, omap.Of("out", r))
		}
		if got, want := attempt(s.CtList(context.Background())), js(t, m.Val("ctList")); got != want {
			t.Errorf("ca %d ctList: go %s, node %s", i, got, want)
		}
		if got, want := attempt(s.CtGetHistory(context.Background(), "x")), js(t, m.Val("ctGetHistory")); got != want {
			t.Errorf("ca %d ctGetHistory: go %s, node %s", i, got, want)
		}
	}
}

func TestGatesGolden(t *testing.T) {
	g := jsval.AsMap(golden(t).Val("gates"))
	ctx := context.Background()
	repo := &fakeRepo{}
	s, au := newSvc(repo, fakePerms{})
	_, e1 := s.CtSaveGated(ctx, nil, []any{omap.Of("ten", "x")})
	_, e2 := s.CtUpdateGated(ctx, nil, "id", omap.New())
	_, e3 := s.CtDeleteGated(ctx, nil, []any{"id"})
	_, e4 := s.CtDuyetGated(ctx, nil, []any{"id"}, true)
	for k, e := range map[string]error{"ctSave": e1, "ctUpdate": e2, "ctDelete": e3, "ctDuyet": e4} {
		if errText(e) != g.Val(k) {
			t.Errorf("%s: go %q, node %q", k, errText(e), g.Val(k))
		}
	}
	if len(repo.calls) != 0 || len(au.recs) != 0 {
		t.Errorf("bị từ chối mà vẫn chạm kho dữ liệu: %v %v", repo.calls, au.recs)
	}
	// lỗi của spPerms_ đi thẳng ra ngoài
	boom := errors.New("DB GET users -> 500 {}")
	s, _ = newSvc(repo, fakePerms{err: boom})
	if _, err := s.CtSaveGated(ctx, testActor, omap.Of("ten", "x")); err != boom {
		t.Errorf("lỗi quyền: %v", err)
	}
	// chỉ có quyền sửa: duyệt bị từ chối, sửa thì qua
	s, _ = newSvc(&fakeRepo{update: func(any, *omap.Map) ([]*omap.Map, error) { return nil, nil }}, fakePerms{edit: true})
	if _, err := s.CtDuyetGated(ctx, testActor, "id", true); errText(err) != g.Val("ctDuyet") {
		t.Errorf("duyệt khi chỉ có quyền sửa: %v", err)
	}
	if _, err := s.CtUpdateGated(ctx, testActor, "id", omap.New()); errText(err) != "Không tìm thấy công tác để sửa" {
		t.Errorf("sửa khi có quyền sửa: %v", err)
	}
}

func TestNoDbGolden(t *testing.T) {
	g := jsval.AsMap(golden(t).Val("noDb"))
	ctx := context.Background()
	repo := &fakeRepo{}
	s, _ := newSvc(repo, fakePerms{edit: true, duyet: true})
	a := &actor.Actor{U: "a"}
	_, e1 := s.CtSave(ctx, a, []any{omap.Of("ten", "  "), nil, "", omap.New()})
	_, e2 := s.CtSave(ctx, a, jsval.Undefined)
	_, e3 := s.CtUpdate(ctx, a, 0.0, omap.New())
	_, e4 := s.CtUpdate(ctx, a, "x", nil)
	_, e5 := s.CtUpdate(ctx, a, "x", jsval.Undefined)
	for k, e := range map[string]error{"ctSaveEmpty": e1, "ctSaveUndef": e2, "ctUpdateNoId": e3, "ctUpdateNullPatch": e4, "ctUpdateUndefPatch": e5} {
		if errText(e) != g.Val(k) {
			t.Errorf("%s: go %q, node %q", k, errText(e), g.Val(k))
		}
	}
	h, err := s.CtGetHistory(ctx, "")
	if err != nil || js(t, h) != js(t, g.Val("ctHistoryNoId")) {
		t.Errorf("ctGetHistory(''): %v %v", h, err)
	}
	if len(repo.calls) != 0 {
		t.Errorf("các ca này không được chạm kho dữ liệu: %v", repo.calls)
	}
}

/*** nhánh lỗi chỉ dựng được bằng repository giả (đối chiếu với Node bằng cách đọc mã: S:1342-1353, 1368, 1389, 1502) ***/

func TestCtSaveRetryMissingColumn(t *testing.T) {
	var bodies [][]*omap.Map
	repo := &fakeRepo{
		insert: func(rows []*omap.Map) ([]*omap.Map, error) {
			bodies = append(bodies, rows)
			if rows[0].Has("nha_cung_cap") {
				return nil, errors.New(errMissNCC)
			}
			return []*omap.Map{omap.Of("id", "i1", "ten", rows[0].Val("ten")), omap.Of("ten", "không id")}, nil
		},
		insHist: func([]*omap.Map) error { return errors.New("mất mạng") }, // bị nuốt
	}
	s, au := newSvc(repo, fakePerms{edit: true})
	out, err := s.CtSave(context.Background(), testActor, []any{omap.Of("ten", "A", "ncc", "X"), omap.Of("ten", "B")})
	if err != nil {
		t.Fatal(err)
	}
	if len(bodies) != 2 || !bodies[0][1].Has("nha_cung_cap") || bodies[1][0].Has("nha_cung_cap") || bodies[1][1].Has("nha_cung_cap") {
		t.Fatalf("phải ghi lại đúng 1 lần, bỏ cột thiếu ở mọi dòng (bản gốc giữ nguyên)")
	}
	if got := strings.Join(bodies[1][0].Keys(), ","); got != "loai,che_do,ma_nhom,hang_muc,de_muc,ten,dvt,khoi_luong,dien_tich,he_so,don_gia_nha_thau,don_gia,ghi_chu,hinh_anh,thong_so,pham_vi,link_tai_lieu,nguoi_tao,ngay_tao,da_duyet" {
		t.Errorf("thứ tự cột: %s", got)
	}
	if out.Val("ok") != 2.0 || len(jsval.AsArray(out.Val("rows"))) != 2 {
		t.Errorf("kết quả: %s", js(t, out))
	}
	if strings.Join(repo.calls, ",") != "insert,insert,insHist" {
		t.Errorf("thứ tự gọi: %v", repo.calls)
	}
	if len(au.recs) != 1 || au.recs[0] != (auditRec{"u-1", "mai", "them_cong_tac", "Thêm 2 công tác: A, B"}) {
		t.Errorf("audit: %+v", au.recs)
	}
	// lần ghi lại vẫn lỗi -> lỗi đó đi qua ctErr_; không ghi lại lần thứ ba
	n := 0
	repo.insert = func([]*omap.Map) ([]*omap.Map, error) {
		n++
		if n == 1 {
			return nil, errors.New(errMissNCC)
		}
		return nil, errors.New(errNoTable)
	}
	if _, err := s.CtSave(context.Background(), testActor, omap.Of("ten", "A")); n != 2 || errText(err) != `Chưa có bảng cong_tac. Hãy chạy "npm run migrate" rồi khởi động lại server.` {
		t.Errorf("n=%d err=%v", n, err)
	}
	// cột thiếu không nằm trong dòng ghi -> không ghi lại
	n = 0
	repo.insert = func([]*omap.Map) ([]*omap.Map, error) { n++; return nil, errors.New(errMissFav) }
	if _, err := s.CtSave(context.Background(), testActor, omap.Of("ten", "A")); n != 1 || errText(err) != errMissFav {
		t.Errorf("n=%d err=%v", n, err)
	}
}

func TestCtListAndHistorySwallowMissingTable(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{
		list: func() ([]*omap.Map, error) { return nil, errors.New(errNoTable) },
		hist: func(any) ([]*omap.Map, error) { return nil, errors.New(errNoHist) },
	}
	s, _ := newSvc(repo, fakePerms{})
	if r, err := s.CtList(ctx); err != nil || js(t, r) != "[]" {
		t.Errorf("ctList: %v %v", r, err)
	}
	if r, err := s.CtGetHistory(ctx, "x"); err != nil || js(t, r) != "[]" {
		t.Errorf("ctGetHistory: %v %v", r, err)
	}
	boom := errors.New("DB GET cong_tac -> 500 {}")
	repo.list = func() ([]*omap.Map, error) { return nil, boom }
	repo.hist = func(any) ([]*omap.Map, error) { return nil, boom }
	if _, err := s.CtList(ctx); err != boom {
		t.Errorf("ctList phải trả nguyên lỗi khác: %v", err)
	}
	if _, err := s.CtGetHistory(ctx, "x"); err != boom {
		t.Errorf("ctGetHistory phải trả nguyên lỗi khác: %v", err)
	}
	repo.list = func() ([]*omap.Map, error) { return nil, nil }
	if r, err := s.CtList(ctx); err != nil || js(t, r) != "[]" {
		t.Errorf("ctList rỗng phải ra []: %v %v", r, err)
	}
}

func TestCtFavMissingColumnAborts(t *testing.T) {
	n := 0
	repo := &fakeRepo{update: func(id any, _ *omap.Map) ([]*omap.Map, error) {
		n++
		if id == "b" {
			return nil, errors.New(errMissFav)
		}
		return []*omap.Map{omap.New()}, nil
	}}
	s, au := newSvc(repo, fakePerms{})
	_, err := s.CtFavGated(context.Background(), testActor, []any{"a", "b", "c"}, jsval.Undefined)
	if n != 2 || errText(err) != `Chưa có cột "yêu thích" trong bảng cong_tac. Hãy chạy "npm run migrate" rồi khởi động lại server.` {
		t.Errorf("n=%d err=%v", n, err)
	}
	if len(au.recs) != 0 {
		t.Errorf("ctFav không ghi audit: %+v", au.recs)
	}
}

func TestKhacFalse(t *testing.T) {
	for _, v := range []any{jsval.Undefined, nil, true, 0.0, "", "false", omap.New()} {
		if !khacFalse(v) {
			t.Errorf("%v !== false phải là true", v)
		}
	}
	if khacFalse(false) {
		t.Error("false !== false phải là false")
	}
}

/*** cổng rpc + REST ***/

func TestRegisterRPC(t *testing.T) {
	reg := rpc.NewRegistry()
	var gotID, gotPatch any
	var gotFlag *omap.Map
	repo := &fakeRepo{
		update: func(id any, patch *omap.Map) ([]*omap.Map, error) {
			gotID, gotFlag = id, patch
			return []*omap.Map{omap.Of("id", id)}, nil
		},
		hist: func(id any) ([]*omap.Map, error) { gotPatch = id; return nil, nil },
	}
	s, _ := newSvc(repo, fakePerms{edit: true, duyet: true})
	s.RegisterRPC(reg)
	want := []string{"ctDelete", "ctDuyet", "ctFav", "ctHistory", "ctList", "ctSave", "ctUpdate"}
	if got := reg.Names(); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("tên hàm: %v", got)
	}
	for _, n := range want {
		if p, _ := reg.PermOf(n); p != rpc.Login {
			t.Errorf("%s: quyền %v, phải là Login", n, p)
		}
	}
	ctx := context.Background()
	// thiếu tham số approve / on -> undefined !== false -> true
	if _, err := reg.Call(ctx, "ctDuyet", testActor, "i1"); err != nil || gotID != "i1" || gotFlag.Val("da_duyet") != true || gotFlag.Val("nguoi_duyet") != "mai" {
		t.Errorf("ctDuyet(id): %v %v %s", err, gotID, js(t, gotFlag))
	}
	if _, err := reg.Call(ctx, "ctDuyet", testActor, "i1", false); err != nil || js(t, gotFlag) != `{"da_duyet":false,"nguoi_duyet":null,"ngay_duyet":null}` {
		t.Errorf("ctDuyet(id, false): %v %s", err, js(t, gotFlag))
	}
	if _, err := reg.Call(ctx, "ctFav", testActor, "i2"); err != nil || js(t, gotFlag) != `{"yeu_thich":true}` {
		t.Errorf("ctFav(id): %v %s", err, js(t, gotFlag))
	}
	if _, err := reg.Call(ctx, "ctFav", testActor, "i2", false); err != nil || js(t, gotFlag) != `{"yeu_thich":false}` {
		t.Errorf("ctFav(id, false): %v %s", err, js(t, gotFlag))
	}
	if r, err := reg.Call(ctx, "ctHistory", testActor, "h1"); err != nil || gotPatch != "h1" || js(t, r) != "[]" {
		t.Errorf("ctHistory: %v %v", r, err)
	}
	if _, err := reg.Call(ctx, "ctUpdate", testActor); errText(err) != "Thiếu id công tác" {
		t.Errorf("ctUpdate(): %v", err)
	}
}

func testEngine(s *Service) *gin.Engine {
	gin.SetMode(gin.TestMode)
	e := gin.New()
	login := func(c *gin.Context) {
		if c.GetHeader("X-Test-Login") != "" {
			actor.Set(c, testActor)
		}
	}
	e.Use(middleware.JSONBody(middleware.JSONBodyLimit), login)
	s.RegisterRoutes(e.Group("/api/v1"))
	s.RegisterRoot(e.Group(""))
	return e
}

func do(e *gin.Engine, method, path, body string, login bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if login {
		req.Header.Set("X-Test-Login", "1")
	}
	w := httptest.NewRecorder()
	e.ServeHTTP(w, req)
	return w
}

func TestRESTRoutes(t *testing.T) {
	var lastID any
	var lastPatch *omap.Map
	repo := &fakeRepo{
		list: func() ([]*omap.Map, error) { return nil, nil },
		hist: func(id any) ([]*omap.Map, error) { lastID = id; return nil, nil },
		update: func(id any, p *omap.Map) ([]*omap.Map, error) {
			lastID, lastPatch = id, p
			return []*omap.Map{omap.Of("id", id, "ten", "T")}, nil
		},
		remove: func(id any) ([]*omap.Map, error) { lastID = id; return []*omap.Map{omap.New()}, nil },
		insert: func(rows []*omap.Map) ([]*omap.Map, error) { return rows, nil },
	}
	s, _ := newSvc(repo, fakePerms{edit: true, duyet: true})
	e := testEngine(s)

	if w := do(e, "GET", "/api/v1/work-items", "", false); w.Code != 401 || w.Body.String() != `{"error":"Chưa đăng nhập","code":"NOAUTH"}` {
		t.Errorf("chưa đăng nhập: %d %s", w.Code, w.Body)
	}
	if w := do(e, "GET", "/api/v1/work-items", "", true); w.Code != 200 || w.Body.String() != `{"ok":true,"result":[]}` {
		t.Errorf("GET /work-items: %d %s", w.Code, w.Body)
	}
	if w := do(e, "GET", "/api/v1/work-items/abc/history", "", true); w.Code != 200 || lastID != "abc" || w.Body.String() != `{"ok":true,"result":[]}` {
		t.Errorf("GET history: %d %s %v", w.Code, w.Body, lastID)
	}
	if w := do(e, "POST", "/api/v1/work-items", `[{"ten":"A","thuTu":2},{"ten":""}]`, true); w.Code != 200 || !strings.HasPrefix(w.Body.String(), `{"ok":true,"result":{"ok":1,"rows":[{"loai":"kt_chitiet"`) {
		t.Errorf("POST /work-items: %d %s", w.Code, w.Body)
	}
	if w := do(e, "POST", "/api/v1/work-items", `{"ten":" "}`, true); w.Code != 500 || w.Body.String() != `{"error":"Chưa có công tác nào để lưu (thiếu tên công việc)"}` {
		t.Errorf("POST /work-items thiếu tên: %d %s", w.Code, w.Body)
	}
	if w := do(e, "PATCH", "/api/v1/work-items/id-9", `{"dg":"12.500","la":1}`, true); w.Code != 200 || lastID != "id-9" ||
		strings.Join(lastPatch.Keys(), ",") != "don_gia,nguoi_sua,ngay_cap_nhat,da_duyet,nguoi_duyet,ngay_duyet" || lastPatch.Val("don_gia") != 12500.0 {
		t.Errorf("PATCH: %d %s %s", w.Code, w.Body, js(t, lastPatch))
	}
	if w := do(e, "POST", "/api/v1/work-items/delete", `{"ids":["a","b"]}`, true); w.Code != 200 || w.Body.String() != `{"ok":true,"result":{"ok":2}}` {
		t.Errorf("delete: %d %s", w.Code, w.Body)
	}
	if w := do(e, "POST", "/api/v1/work-items/approval", `{"ids":"a"}`, true); w.Code != 200 || lastPatch.Val("da_duyet") != true {
		t.Errorf("approval mặc định phải là duyệt: %d %s", w.Code, w.Body)
	}
	if w := do(e, "POST", "/api/v1/work-items/approval", `{"ids":"a","approve":false}`, true); w.Code != 200 || lastPatch.Val("da_duyet") != false {
		t.Errorf("approval false: %d %s", w.Code, w.Body)
	}
	if w := do(e, "POST", "/api/v1/work-items/favorites", `{"ids":["a"],"on":false}`, true); w.Code != 200 || js(t, lastPatch) != `{"yeu_thich":false}` {
		t.Errorf("favorites: %d %s", w.Code, w.Body)
	}
}

/*** xuất Excel ***/

func exportRows(t *testing.T) []any {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", "export-rows.json"))
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	return jsval.AsArray(v)
}

// Kiểu + giá trị từng ô phải khớp bản ExcelJS đọc lại từ file của Node (golden.export.cells).
func TestExportCellsGolden(t *testing.T) {
	g := jsval.AsMap(golden(t).Val("export"))
	s, _ := newSvc(&fakeRepo{}, fakePerms{})
	res, err := s.ExportCongTacXlsx(jsval.AsArray(g.Val("rows")))
	if err != nil {
		t.Fatal(err)
	}
	if res.Name != g.Val("name") || float64(res.Count) != g.Val("count") {
		t.Errorf("name / count: %s %d", res.Name, res.Count)
	}
	f, err := excelize.OpenReader(strings.NewReader(string(res.Buf)))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if got := f.GetSheetList(); len(got) != 1 || got[0] != g.Val("sheet") {
		t.Fatalf("sheet: %v", got)
	}
	rows, err := f.GetRows(exportSheet)
	if err != nil || float64(len(rows)) != g.Val("rowCount") {
		t.Fatalf("số dòng: %d (%v), node %v", len(rows), err, g.Val("rowCount"))
	}
	for _, c := range jsval.AsArray(g.Val("cells")) {
		m := jsval.AsMap(c)
		a := jsval.AsString(m.Val("a"))
		raw, _ := f.GetCellValue(exportSheet, a, excelize.Options{RawCellValue: true})
		typ, _ := f.GetCellType(exportSheet, a)
		st, _ := f.GetCellStyle(exportSheet, a)
		if st == 0 {
			t.Errorf("%s: ô phải tồn tại và mang style", a)
		}
		switch m.Val("type") {
		case 0.0: // Null
			if raw != "" || typ != excelize.CellTypeUnset {
				t.Errorf("%s: phải trống, go %q (%v)", a, raw, typ)
			}
		case 2.0: // Number
			if jsval.IsString(m.Val("value")) {
				// Số vô hạn ("1e999"): ExcelJS ghi <v>Infinity</v> vào ô SỐ (file không hợp lệ với Excel); bản Go ghi y hệt
				// (fixSheetXML đổi ô inlineStr của excelize về ô số) - hồi quy của bộ so vi sai area2/05.
				if raw != m.Val("value") || (typ != excelize.CellTypeUnset && typ != excelize.CellTypeNumber) {
					t.Errorf("%s: số vô hạn go %q (%v)", a, raw, typ)
				}
				continue
			}
			if want := jsval.S(m.Val("value")); raw != want || (typ != excelize.CellTypeUnset && typ != excelize.CellTypeNumber) {
				t.Errorf("%s: số go %q (%v), node %q", a, raw, typ, want)
			}
		case 3.0: // String
			if raw != m.Val("value") || (typ != excelize.CellTypeSharedString && typ != excelize.CellTypeInlineString) {
				t.Errorf("%s: chuỗi go %.80q (dài %d, %v), node %.80q (dài %d)", a, raw, len(raw), typ, m.Val("value"), len(jsval.AsString(m.Val("value"))))
			}
		case 9.0: // Boolean
			want := "0"
			if m.Val("value") == true {
				want = "1"
			}
			if raw != want || typ != excelize.CellTypeBool {
				t.Errorf("%s: boolean go %q (%v), node %v", a, raw, typ, m.Val("value"))
			}
		default:
			t.Errorf("%s: kiểu ô lạ trong golden: %v", a, m.Val("type"))
		}
	}
	for i, c := range jsval.AsArray(g.Val("errs")) {
		m := jsval.AsMap(c)
		if _, err := s.ExportCongTacXlsx(jsval.AsArray(m.Val("rows"))); errText(err) != m.Val("err") {
			t.Errorf("ca lỗi %d: go %q, node %q", i, errText(err), m.Val("err"))
		}
	}
}

// Ghi file để testdata/xlsx-parity.js so với file của Node (style, cột, khung...). Bỏ qua khi chưa đặt ESTIMATES_XLSX_OUT.
func TestExportWriteFile(t *testing.T) {
	out := os.Getenv("ESTIMATES_XLSX_OUT")
	if out == "" {
		t.Skip("chưa đặt ESTIMATES_XLSX_OUT")
	}
	s, _ := newSvc(&fakeRepo{}, fakePerms{})
	res, err := s.ExportCongTacXlsx(exportRows(t))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(out, res.Buf, 0o644); err != nil {
		t.Fatal(err)
	}
}

// Route: mã trạng thái, thân và header theo index.js:728-743 (đối chiếu bằng cách đọc mã).
func TestExportRoute(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{})
	e := testEngine(s)
	if w := do(e, "POST", "/export/cong-tac", `{"rows":[{"stt":1}]}`, false); w.Code != 401 || w.Body.String() != `{"error":"Chưa đăng nhập"}` {
		t.Errorf("chưa đăng nhập: %d %s", w.Code, w.Body)
	}
	for _, body := range []string{``, `{}`, `{"rows":[]}`, `{"rows":"x"}`, `{"rows":{"0":1}}`, `[{"stt":1}]`} {
		if w := do(e, "POST", "/export/cong-tac", body, true); w.Code != 400 || w.Body.String() != `{"error":"Không có dòng nào để xuất"}` {
			t.Errorf("thân %q: %d %s", body, w.Code, w.Body)
		}
	}
	if w := do(e, "POST", "/export/cong-tac", `{"rows":[{"stt":1},null]}`, true); w.Code != 500 || w.Body.String() != `{"error":"Cannot read properties of null (reading 'stt')"}` {
		t.Errorf("dòng null: %d %s", w.Code, w.Body)
	}
	w := do(e, "POST", "/export/cong-tac", `{"rows":[{"stt":1,"noiDung":"A"},{"stt":2},"x"]}`, true)
	h := w.Header()
	if w.Code != 200 || h.Get("Content-Type") != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
		h.Get("Content-Disposition") != `attachment; filename="cong-tac-xay-dung.xlsx"` || h.Get("X-Row-Count") != "3" ||
		!strings.HasPrefix(h.Get("ETag"), `W/"`) || !strings.HasPrefix(w.Body.String(), "PK") {
		t.Errorf("200: %d %v", w.Code, h)
	}
	// quá 5000 dòng thì cắt
	big := `{"rows":[` + strings.Repeat(`{"stt":1},`, 5003) + `{"stt":2}]}`
	if w := do(e, "POST", "/export/cong-tac", big, true); w.Code != 200 || w.Header().Get("X-Row-Count") != "5000" {
		t.Errorf("cắt 5000: %d %s", w.Code, w.Header().Get("X-Row-Count"))
	}
}
