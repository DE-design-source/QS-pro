package takeoff

import (
	"context"
	"errors"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

/* Giá trị mong đợi trong testdata/ đều do mã Node THẬT sinh ra:
   - unit.json (gen_unit.js): hàm của store_supa.js / auth.js chạy trên tầng supa giả, ghi lại từng lệnh trên db_bao_gia + kết quả
   - diff.json (gen_diff.js): kịch bản chạy trên database thử qspro_nodetest; TestDiffDB chạy lại trên qspro_gotest */

func loadJSON(t *testing.T, name string) any {
	t.Helper()
	b, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	s, err := omap.MarshalString(v)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func ctxOf(v any) context.Context {
	m := jsval.AsMap(v)
	if m == nil {
		return context.Background()
	}
	return tenant.With(context.Background(), tenant.Ctx{UID: jsval.Or(m.Val("uid"), nil), Role: jsval.AsString(m.Val("role")),
		CongTyID: jsval.Or(m.Val("congTyId"), nil), ViewAs: jsval.Or(m.Val("viewAs"), nil)})
}

func actorOf(v any) *actor.Actor {
	if m := jsval.AsMap(v); m != nil {
		return actor.FromMap(m)
	}
	return nil
}

func resultOf(res any, err error) *omap.Map {
	if err != nil {
		return omap.Of("error", err.Error())
	}
	if jsval.IsNullish(res) {
		res = nil
	}
	return omap.Of("result", res)
}

// ───────────── repository giả ─────────────

type fakeRepo struct {
	log       []any
	ret, errs *omap.Map
}

func (f *fakeRepo) call(m string, a []any, dflt func() []*omap.Map) ([]*omap.Map, error) {
	f.log = append(f.log, omap.Of("m", m, "a", omap.DeepClone(a)))
	if e, ok := f.errs.Get(m); ok {
		return nil, errors.New(jsval.ToString(e))
	}
	if v, ok := f.ret.Get(m); ok {
		arr := jsval.AsArray(omap.DeepClone(v))
		out := make([]*omap.Map, len(arr))
		for i := range arr {
			out[i] = jsval.AsMap(arr[i])
		}
		return out, nil
	}
	if dflt != nil {
		return dflt(), nil
	}
	return []*omap.Map{}, nil
}

func str(v any) string { return jsval.ToString(v) }

func (f *fakeRepo) ListLines(_ context.Context, maDA any) ([]*omap.Map, error) {
	return f.call("ListLines", []any{str(maDA)}, nil)
}
func (f *fakeRepo) MaxSortNo(_ context.Context, maDA any) ([]*omap.Map, error) {
	return f.call("MaxSortNo", []any{str(maDA)}, nil)
}
func (f *fakeRepo) InsertLine(_ context.Context, row *omap.Map) ([]*omap.Map, error) {
	return f.call("InsertLine", []any{row}, func() []*omap.Map {
		return []*omap.Map{omap.Assign(omap.Of("id", 900.0), jsval.AsMap(omap.DeepClone(row)))}
	})
}
func (f *fakeRepo) FindLine(_ context.Context, lineID any) ([]*omap.Map, error) {
	return f.call("FindLine", []any{str(lineID)}, nil)
}
func (f *fakeRepo) UpdateLine(_ context.Context, lineID any, patch *omap.Map) ([]*omap.Map, error) {
	return f.call("UpdateLine", []any{str(lineID), patch}, func() []*omap.Map {
		cur := omap.New()
		if arr := jsval.AsArray(f.ret.Val("FindLine")); len(arr) > 0 {
			cur = jsval.AsMap(omap.DeepClone(arr[0]))
		}
		return []*omap.Map{omap.Assign(cur, jsval.AsMap(omap.DeepClone(patch)))}
	})
}
func (f *fakeRepo) DeleteLine(_ context.Context, lineID any) error {
	_, err := f.call("DeleteLine", []any{str(lineID)}, nil)
	return err
}

// ───────────── module materials (giả) ─────────────

// stubPerms: spPerms_ chỉ trả edit=false khi không có actor (A:518); có actor thì luôn sửa được.
type stubPerms struct{ err error }

func (p stubPerms) SpPerms(_ context.Context, a *actor.Actor) (bool, bool, bool, error) {
	return a != nil, a != nil, a.IsAdmin(), p.err
}

type stubSaver struct {
	ret   *omap.Map
	err   error
	calls int
	a     *actor.Actor
	data  *omap.Map
	opts  *omap.Map
}

func (s *stubSaver) SaveDbProduct(_ context.Context, a *actor.Actor, data, opts *omap.Map) (*omap.Map, error) {
	s.calls++
	s.a, s.data, s.opts = a, data, opts
	return s.ret, s.err
}

func newSvc(f *fakeRepo, sv *stubSaver) (*Service, *rpc.Registry) {
	svc := New(Deps{Repo: f, Perms: stubPerms{}, Saver: sv})
	reg := rpc.NewRegistry()
	svc.RegisterRPC(reg)
	return svc, reg
}

// ───────────── test đơn vị ─────────────

func TestUnitGolden(t *testing.T) {
	for _, cv := range jsval.AsArray(loadJSON(t, "unit.json")) {
		c := jsval.AsMap(cv)
		name := jsval.AsString(c.Val("name"))
		f := &fakeRepo{log: []any{}, ret: jsval.AsMap(jsval.GetPath(c, "fake", "ret")), errs: jsval.AsMap(jsval.GetPath(c, "fake", "err"))}
		sv := &stubSaver{ret: jsval.AsMap(c.Val("saver"))}
		if e, ok := c.Val("saverErr").(string); ok {
			sv.err = errors.New(e)
		}
		_, reg := newSvc(f, sv)
		a := actorOf(c.Val("actor"))
		res, err := reg.Call(ctxOf(c.Val("ctx")), jsval.AsString(c.Val("fn")), a, jsval.AsArray(c.Val("args"))...)
		got := omap.Assign(omap.Of("log", f.log), resultOf(res, err))
		if g, w := mustJSON(t, got), mustJSON(t, c.Val("expect")); g != w {
			t.Errorf("%s\n  go:   %s\n  node: %s", name, g, w)
		}
		// người thao tác mà saveDbProduct của Node đã đóng dấu (nguoi_tao / nguoi_sua)
		if who, ok := c.Val("who").(string); ok && (sv.a == nil || sv.a.U != who) {
			t.Errorf("%s: saver nhận actor %+v, node đóng dấu %q", name, sv.a, who)
		}
	}
}

func TestRPCNames(t *testing.T) {
	_, reg := newSvc(&fakeRepo{}, &stubSaver{})
	want := []string{"getLines", "addLine", "addBlankLine", "updateLine", "deleteLine", "saveLineAsProduct"}
	if len(reg.Names()) != len(want) {
		t.Fatalf("số hàm rpc = %d, cần %d", len(reg.Names()), len(want))
	}
	for _, n := range want {
		if p, ok := reg.PermOf(n); !ok || p != rpc.Login {
			t.Errorf("%s: quyền %v, có %v", n, p, ok)
		}
	}
}

// Dữ liệu gửi sang saveDbProduct (S:958-961): 10 nhãn theo đúng thứ tự, giá trị lấy thô từ dòng.
// Phần này chỉ đối chiếu bằng cách đọc mã Node (data nằm trong store_supa.js, không chặn được từ ngoài).
func TestSaveLineAsProductData(t *testing.T) {
	a := &actor.Actor{UID: "u1", U: "tester", R: "admin", CT: "c1", Exp: 1}
	run := func(a *actor.Actor, args ...any) (*stubSaver, any, error) {
		sv := &stubSaver{ret: omap.Of("created", true, "ma", "M", "ten", "T", "id", 5.0)}
		_, reg := newSvc(&fakeRepo{}, sv)
		r, err := reg.Call(context.Background(), "saveLineAsProduct", a, args...)
		return sv, r, err
	}
	sv, r, err := run(a, omap.Of("ten", "Đèn", "ma", 12.0, "nhom", "N", "hangMuc", "HM", "thuongHieu", "TH", "ncc", "NCC", "dvt", "Bộ",
		"gia", 0.0, "donGiaBan", 99.0, "moTa", "mt", "hinhAnh", "h.png"))
	if err != nil {
		t.Fatal(err)
	}
	if got, want := mustJSON(t, sv.data), `{"TÊN SẢN PHẨM":"Đèn","MÃ SẢN PHẨM":12,"DÒNG SẢN PHẨM":"N","HẠNG MỤC":"HM","THƯƠNG HIỆU":"TH","NHÀ CUNG CẤP":"NCC","ĐƠN VỊ TÍNH":"Bộ","GIÁ BÁN LẺ":0,"GHI CHÚ":"mt","ẢNH SẢN PHẨM":"h.png"}`; got != want {
		t.Errorf("data:\n  %s\n  %s", got, want)
	}
	if sv.a != a || sv.opts != nil {
		t.Errorf("actor / opts: %+v %v", sv.a, sv.opts)
	}
	if got, want := mustJSON(t, r), `{"ten":"T","ma":"M","thuongHieu":"TH","ncc":"NCC","nhom":"N","hangMuc":"HM","dvt":"Bộ","donGiaVon":0,"donGiaBan":0,"hinhAnh":"h.png","created":true,"id":5}`; got != want {
		t.Errorf("kết quả:\n  %s\n  %s", got, want)
	}
	// gia null / thiếu -> lấy donGiaBan; khoá thiếu vẫn có mặt trong data (giá trị undefined, saveDbProduct bỏ qua)
	sv, _, _ = run(a, omap.Of("ten", "Đèn", "gia", nil, "donGiaBan", "1.500"))
	if got, want := mustJSON(t, sv.data), `{"TÊN SẢN PHẨM":"Đèn","GIÁ BÁN LẺ":"1.500"}`; got != want || sv.data.Len() != 10 {
		t.Errorf("data (gia null): %s, %d khoá", got, sv.data.Len())
	}
	if keys := strings.Join(sv.data.Keys(), "|"); keys != "TÊN SẢN PHẨM|MÃ SẢN PHẨM|DÒNG SẢN PHẨM|HẠNG MỤC|THƯƠNG HIỆU|NHÀ CUNG CẤP|ĐƠN VỊ TÍNH|GIÁ BÁN LẺ|GHI CHÚ|ẢNH SẢN PHẨM" {
		t.Errorf("thứ tự khoá: %s", keys)
	}
	// client không gửi tham số: actor thành dữ liệu, lưu không kèm người thao tác (S:956)
	sv, _, _ = run(a)
	if sv.calls != 1 || sv.a != nil || !jsval.IsUndefined(sv.data.Val("TÊN SẢN PHẨM")) {
		t.Errorf("thiếu tham số: gọi %d lần, actor %+v, data %s", sv.calls, sv.a, mustJSON(t, sv.data))
	}
	// null tường minh: vẫn giữ actor
	sv, _, _ = run(a, nil)
	if sv.calls != 1 || sv.a != a {
		t.Errorf("null: gọi %d lần, actor %+v", sv.calls, sv.a)
	}
	// không có quyền: không gọi saveDbProduct
	sv, _, err = run(nil, omap.Of("ten", "X"))
	if sv.calls != 0 || err == nil || err.Error() != "Tài khoản không có quyền thêm sản phẩm vào danh mục" {
		t.Errorf("không quyền: gọi %d lần, lỗi %v", sv.calls, err)
	}
	// lỗi đọc quyền được trả nguyên
	svc := New(Deps{Repo: &fakeRepo{}, Perms: stubPerms{err: errors.New("đọc users hỏng")}, Saver: &stubSaver{}})
	if _, err = svc.SaveLineAsProductGated(context.Background(), a, omap.Of("ten", "X")); err == nil || err.Error() != "đọc users hỏng" {
		t.Errorf("lỗi quyền: %v", err)
	}
}

// ───────────── đối chiếu trên database thử ─────────────

var (
	reTpl     = regexp.MustCompile(`\{\{(\w+)\}\}`)
	reDigits  = regexp.MustCompile(`^\d+$`)
	reID      = regexp.MustCompile(`"id":\d+`)
	reLineID  = regexp.MustCompile(`"lineId":"\d+"`)
	reFailRow = regexp.MustCompile(`Failing row contains \(\d+,`)
	reTime    = regexp.MustCompile(`\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d(:\d\d)?)`)
)

type diffRun struct {
	t     *testing.T
	db    *database.DB
	reg   *rpc.Registry
	actor *actor.Actor
	names []string
	saved map[string]string
}

func (d *diffRun) norm(v any) string {
	s := mustJSON(d.t, v)
	for _, n := range d.names {
		// id dạng số không thay theo chuỗi (dễ trùng với số khác); đã có các mẫu "id" / "lineId" bên dưới
		if !reDigits.MatchString(d.saved[n]) {
			s = strings.ReplaceAll(s, d.saved[n], "<"+n+">")
		}
	}
	s = reID.ReplaceAllString(s, `"id":"<id>"`)
	s = reLineID.ReplaceAllString(s, `"lineId":"<id>"`)
	s = reFailRow.ReplaceAllString(s, "Failing row contains (<id>,")
	return reTime.ReplaceAllString(s, "<ts>")
}

func (d *diffRun) fill(raw *omap.Map) *omap.Map {
	in := raw.Clone()
	in.Delete("out")
	s := reTpl.ReplaceAllStringFunc(mustJSON(d.t, in), func(m string) string {
		if v, ok := d.saved[m[2:len(m)-2]]; ok {
			return v
		}
		return "MISSING"
	})
	v, err := omap.DecodeString(s)
	if err != nil {
		d.t.Fatal(err)
	}
	return jsval.AsMap(v)
}

func (d *diffRun) step(ctx context.Context, st *omap.Map) (*omap.Map, error) {
	table, filter := jsval.AsString(st.Val("table")), jsval.AsString(st.Val("filter"))
	noScope := jsval.Truthy(st.Val("noScope"))
	switch jsval.AsString(st.Val("op")) {
	case "insert":
		arr := jsval.AsArray(st.Val("rows"))
		rows := make([]*omap.Map, len(arr))
		for i := range arr {
			rows[i] = jsval.AsMap(arr[i])
		}
		if _, err := d.db.Insert(ctx, table, rows, database.Opt{NoScope: noScope}); err != nil {
			return nil, err
		}
		return omap.Of("ok", true), nil
	case "remove":
		if _, err := d.db.Remove(ctx, table, filter, database.Opt{NoScope: noScope}); err != nil {
			return nil, err
		}
		return omap.Of("ok", true), nil
	case "rows":
		rows, err := d.db.Select(ctx, table, database.SelectOpt{Filter: filter, Select: jsval.AsString(st.Val("select")),
			Order: jsval.AsString(st.Val("order")), NoScope: noScope})
		if err != nil {
			return nil, err
		}
		return omap.Of("rows", jsval.Rows(rows)), nil
	}
	res, err := d.reg.Call(ctx, jsval.AsString(st.Val("fn")), d.actor, jsval.AsArray(st.Val("args"))...)
	if err != nil {
		return nil, err
	}
	if jsval.IsNullish(res) {
		res = nil
	}
	if sv := jsval.AsMap(st.Val("save")); sv != nil {
		n := jsval.AsString(sv.Val("name"))
		d.names = append(d.names, n)
		d.saved[n] = jsval.ToString(jsval.Get(res, jsval.AsString(sv.Val("key"))))
	}
	return omap.Of("result", res), nil
}

func TestDiffDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	t.Cleanup(db.Close)
	// lưới an toàn: test hỏng giữa chừng cũng không để lại dòng ZZ_takeoff_ (dòng bóc tách xoá theo khoá ngoại)
	t.Cleanup(func() {
		if pool, err := db.Pool(); err == nil {
			_, _ = pool.Exec(context.Background(), `delete from projects where project_code like 'ZZ\_takeoff\_%'`)
		}
	})
	spec := jsval.AsMap(loadJSON(t, "diff.json"))
	svc := New(Deps{DB: db, Perms: stubPerms{}, Saver: &stubSaver{}})
	reg := rpc.NewRegistry()
	svc.RegisterRPC(reg)
	d := &diffRun{t: t, db: db, reg: reg, actor: actorOf(spec.Val("actor")), saved: map[string]string{}}
	contexts := jsval.AsMap(spec.Val("contexts"))
	for i, raw := range jsval.AsArray(spec.Val("steps")) {
		st := d.fill(jsval.AsMap(raw))
		out, err := d.step(ctxOf(contexts.Val(jsval.AsString(st.Val("ctx")))), st)
		if err != nil {
			out = omap.Of("error", err.Error())
		}
		want := jsval.AsString(jsval.Get(raw, "out"))
		if got := d.norm(out); got != want {
			t.Errorf("bước %d (%s %s%s)\n  go:   %s\n  node: %s", i, jsval.AsString(st.Val("op")), jsval.AsString(st.Val("fn")), jsval.AsString(st.Val("table")), got, want)
		}
	}
}

// Route REST: đăng ký không panic (trùng tham số / trùng đường dẫn) và đủ 6 route của PORTING_MAP mục A.
func TestRESTRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	e := gin.New()
	svc, _ := newSvc(&fakeRepo{}, &stubSaver{})
	svc.RegisterRoutes(e.Group("/api/v1"))
	got := map[string]bool{}
	for _, r := range e.Routes() {
		got[r.Method+" "+r.Path] = true
	}
	want := []string{"GET /api/v1/projects/:id/lines", "POST /api/v1/projects/:id/lines", "POST /api/v1/projects/:id/lines/blank",
		"PATCH /api/v1/lines/:id", "DELETE /api/v1/lines/:id", "POST /api/v1/lines/save-as-product"}
	if len(got) != len(want) {
		t.Errorf("số route = %d, cần %d", len(got), len(want))
	}
	for _, w := range want {
		if !got[w] {
			t.Errorf("thiếu route %s", w)
		}
	}
}
