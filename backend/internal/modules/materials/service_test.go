package materials

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// Mọi giá trị mong đợi trong testdata/*.json lấy bằng cách chạy mã Node thật (testdata/gen_unit.js, gen_diff.js).

func loadJSON(t *testing.T, name string) *omap.Map {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	return jsval.AsMap(v)
}

func js(v any) string {
	s, err := omap.MarshalString(v)
	if err != nil {
		return "LỖI MARSHAL: " + err.Error()
	}
	return s
}

var reISO = regexp.MustCompile(`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z`)

func tsNorm(s string) string { return reISO.ReplaceAllString(s, "<ts>") }

func arr(v any) []any { return jsval.AsArray(v) }

func eachCase(t *testing.T, pure *omap.Map, key string, fn func(c []any) (got, want string)) {
	t.Helper()
	cases := arr(pure.Val(key))
	if len(cases) == 0 {
		t.Fatalf("unit.json thiếu mục %s", key)
	}
	for i, c := range cases {
		if got, want := fn(arr(c)); got != want {
			t.Errorf("%s[%d] %s\n  go:   %s\n  node: %s", key, i, js(arr(c)[0]), got, want)
		}
	}
}

func TestPureGolden(t *testing.T) {
	pure := jsval.AsMap(loadJSON(t, "unit.json").Val("pure"))
	eachCase(t, pure, "prodToObj", func(c []any) (string, string) { return js(prodToObj(jsval.AsMap(c[0]))), js(c[1]) })
	eachCase(t, pure, "dataToRow", func(c []any) (string, string) { return js(dataToRow(jsval.AsMap(c[0]))), js(c[1]) })
	eachCase(t, pure, "laCo", func(c []any) (string, string) {
		return js(dataToRow(omap.Of(nhanLapRoi, c[0])).Val("lap_nguon_roi")), js(c[1])
	})
	eachCase(t, pure, "fmtUnit", func(c []any) (string, string) { return fmtUnit(c[0], c[1].(string)), c[2].(string) })
	eachCase(t, pure, "fmtList", func(c []any) (string, string) { return fmtList(c[0], c[1].(string)), c[2].(string) })
	eachCase(t, pure, "fmtCutout", func(c []any) (string, string) { return fmtCutout(c[0]), c[1].(string) })
	eachCase(t, pure, "firstImg", func(c []any) (string, string) { return firstImg(c[0]), c[1].(string) })
	eachCase(t, pure, "parseItems", func(c []any) (string, string) { return js(parseItems(c[0])), js(c[1]) })
	eachCase(t, pure, "errs", func(c []any) (string, string) {
		e := errors.New(c[0].(string))
		got := []any{c[0], whoColMissingErr(e), comboMissing(e), btMissing(e),
			tblErr(e, "sp_yeu_thich").Error(), tblErr(e, "sp_combo").Error(), tblErr(e, "db_san_pham").Error()}
		return js(got), js(c)
	})
}

// ───────────── bản thế của các module khác (Deps), chạy trên cùng Repository với service ─────────────
// Mỗi bản thế phát đúng lệnh supa.* mà hàm Node tương ứng phát (audit A:59-69, getUserById A:212-215, permsArr_ A:72,
// notify_ A:451-454, getAdmins_ A:450) nên test phát lại lẫn test trên database thật đều so được từng lệnh / từng dòng.

type stubDeps struct{ repo Repository }

func (d stubDeps) Audit(ctx context.Context, a *actor.Actor, action, detail string, congTyID any) {
	row := omap.Of("user_id", actorUID(a), "username", actorName(a, ""), "action", action, "detail", detail)
	if jsval.Truthy(congTyID) {
		row.Set("cong_ty_id", congTyID)
	}
	_, _ = d.repo.InsertOne(ctx, "audit_log", row)
}

func (d stubDeps) GetByID(ctx context.Context, id any) (*omap.Map, error) {
	rows, err := d.repo.Select(ctx, "users", database.SelectOpt{Filter: database.Eq("id", id), Limit: 1, NoScope: true})
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}

func (stubDeps) UserOut(row *omap.Map) *omap.Map { return row }

func (stubDeps) PermsArr(v any) []any {
	out := []any{}
	for _, x := range strings.Split(jsval.StrOr(v, ""), ",") {
		if x = jsval.Trim(x); x != "" {
			out = append(out, x)
		}
	}
	return out
}

func (d stubDeps) Notify(ctx context.Context, userID any, kind, title, body string, refID any) {
	if !jsval.Truthy(userID) {
		return
	}
	_, _ = d.repo.InsertOne(ctx, "notifications", omap.Of("user_id", userID, "kind", kind, "title", title, "body", body,
		"ref_id", jsval.Or(refID, nil), "is_read", false))
}

func (d stubDeps) ActiveAdmins(ctx context.Context) ([]any, error) {
	rows, err := d.repo.Select(ctx, "users", database.SelectOpt{Filter: database.Eq("role", "admin")})
	if err != nil {
		return nil, err
	}
	out := []any{}
	for _, u := range rows {
		if u.Val("active") != false {
			out = append(out, u)
		}
	}
	return out, nil
}

// fakeUploader: bản thế của kho file - ghi lại lần tải, trả "URL:<path>" hoặc lỗi đặt sẵn.
type fakeUploader struct {
	rec  *omap.Map
	fail string
	buf  []byte
}

func (u *fakeUploader) Upload(_ context.Context, buf []byte, path, contentType string) (string, error) {
	u.buf = buf
	u.rec = omap.Of("len", float64(len(buf)), "path", path, "ct", contentType)
	if u.fail != "" {
		return "", errors.New(u.fail)
	}
	return "URL:" + path, nil
}

func newSvc(repo Repository, up *fakeUploader) (*Service, *rpc.Registry) {
	d := stubDeps{repo: repo}
	s := New(Deps{Repo: repo, Auditor: d, Users: d, UserFmt: d, Notifier: d, Admins: d, Uploader: up})
	reg := rpc.NewRegistry()
	s.RegisterRPC(reg)
	return s, reg
}

func ctxOf(v any) context.Context {
	m := jsval.AsMap(v)
	if m == nil { // tenant.run(null, fn)
		return context.Background()
	}
	return tenant.With(context.Background(), tenant.Ctx{UID: m.Val("uid"), Role: jsval.AsString(m.Val("role")),
		CongTyID: m.Val("congTyId"), ViewAs: m.Val("viewAs")})
}

func actorOf(v any) *actor.Actor {
	if m := jsval.AsMap(v); m != nil {
		return actor.FromMap(m)
	}
	return nil
}

func argAt(args []any, i int) any {
	if i < len(args) {
		return args[i]
	}
	return jsval.Undefined
}

// callFn: bảng hàm của testdata/noderef.js - tên trong REGISTRY đi qua cổng rpc của module, tên có $ gọi thẳng service.
func callFn(ctx context.Context, s *Service, reg *rpc.Registry, a *actor.Actor, fn string, args []any) (any, error) {
	switch fn {
	case "$saveDbProduct":
		return s.SaveDbProduct(ctx, actorOf(argAt(args, 0)), jsval.AsMap(argAt(args, 1)), jsval.AsMap(argAt(args, 2)))
	case "$deleteDbProduct":
		return s.DeleteDbProduct(ctx, actorOf(argAt(args, 0)), argAt(args, 1))
	case "$updateDbProductTracked":
		return s.UpdateDbProductTracked(ctx, actorOf(argAt(args, 0)), argAt(args, 1), argAt(args, 2), jsval.AsMap(argAt(args, 3)))
	case "$importCommit":
		return s.ImportCommit(ctx, actorOf(argAt(args, 0)), argAt(args, 1))
	case "$getProductsCached":
		return s.GetProductsCached(ctx)
	case "$getCatalogSheets":
		return s.GetCatalogSheets(ctx)
	case "$buildCatalog":
		return s.BuildCatalog(ctx)
	case "$uploadFileBuf":
		var buf []byte
		if n, ok := argAt(args, 0).(float64); ok {
			buf = bytes.Repeat([]byte{'A'}, int(n))
		}
		return s.UploadFileBuf(ctx, buf, argAt(args, 1), jsval.AsString(argAt(args, 2)))
	}
	return reg.Call(ctx, fn, a, args...)
}

var (
	reUpMs  = regexp.MustCompile(`(sp|docs)/\d+-`)
	reUpRnd = regexp.MustCompile(`sp/<ms>-\d+\.`)
)

func upNorm(s string) string {
	return reUpRnd.ReplaceAllString(reUpMs.ReplaceAllString(s, "${1}/<ms>-"), "sp/<ms>-<rnd>.")
}

// uploadImage / uploadFile / uploadFileBuf: tên file, đuôi, content-type, thông báo lỗi - so với Node từng ca.
func TestUploadGolden(t *testing.T) {
	cases := arr(loadJSON(t, "unit.json").Val("upload"))
	if len(cases) < 40 {
		t.Fatalf("chỉ có %d ca upload", len(cases))
	}
	for i, c := range cases {
		m := jsval.AsMap(c)
		up := &fakeUploader{fail: jsval.AsString(m.Val("fail"))}
		s, reg := newSvc(nil, up)
		res, err := callFn(context.Background(), s, reg, nil, m.Val("fn").(string), arr(m.Val("args")))
		got := omap.Of("fn", m.Val("fn"), "args", m.Val("args"), "fail", m.Val("fail"))
		if err != nil {
			got.Set("error", err.Error())
		} else {
			got.Set("result", res)
		}
		var rec any
		if up.rec != nil {
			rec = up.rec
		}
		got.Set("up", rec)
		if g, w := upNorm(js(got)), js(m); g != w {
			t.Errorf("upload[%d]\n  go:   %s\n  node: %s", i, g, w)
		}
	}
}

// ───────────── phát lại: từng lệnh supa.* của hàm Node phải khớp lệnh của bản Go ─────────────

type replayRepo struct {
	t     *testing.T
	name  string
	calls []any
	i     int
}

func nul(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (r *replayRepo) next(m, table string, a *omap.Map) ([]*omap.Map, error) {
	got := tsNorm(js(omap.Of("m", m, "table", table, "a", a)))
	if r.i >= len(r.calls) {
		r.t.Errorf("%s: Go phát thừa lệnh thứ %d: %s", r.name, r.i+1, got)
		return nil, errors.New("replay: thừa lệnh")
	}
	c := jsval.AsMap(r.calls[r.i])
	r.i++
	if want := js(omap.Of("m", c.Val("m"), "table", c.Val("table"), "a", c.Val("a"))); got != want {
		r.t.Errorf("%s: lệnh thứ %d khác\n  go:   %s\n  node: %s", r.name, r.i, got, want)
	}
	if e, ok := c.Val("err").(string); ok {
		return nil, errors.New(e)
	}
	rows := []*omap.Map{}
	for _, x := range arr(c.Val("ret")) {
		rows = append(rows, jsval.AsMap(x))
	}
	return rows, nil
}

func noScope(opt []database.Opt) bool { return len(opt) > 0 && opt[0].NoScope }

func rowsAny(rows []*omap.Map) []any {
	out := make([]any, len(rows))
	for i, r := range rows {
		out[i] = r
	}
	return out
}

func (r *replayRepo) Select(_ context.Context, table string, opt ...database.SelectOpt) ([]*omap.Map, error) {
	var o database.SelectOpt
	if len(opt) > 0 {
		o = opt[0]
	}
	var limit any
	if o.Limit != 0 {
		limit = float64(o.Limit)
	}
	return r.next("select", table, omap.Of("select", nul(o.Select), "filter", nul(o.Filter), "order", nul(o.Order), "limit", limit, "noScope", o.NoScope))
}

func (r *replayRepo) Insert(_ context.Context, table string, rows []*omap.Map, opt ...database.Opt) ([]*omap.Map, error) {
	return r.next("insert", table, omap.Of("rows", rowsAny(rows), "noScope", noScope(opt)))
}

func (r *replayRepo) InsertOne(_ context.Context, table string, row *omap.Map, opt ...database.Opt) ([]*omap.Map, error) {
	return r.next("insert", table, omap.Of("rows", row, "noScope", noScope(opt)))
}

func (r *replayRepo) Update(_ context.Context, table, filter string, patch *omap.Map, opt ...database.Opt) ([]*omap.Map, error) {
	return r.next("update", table, omap.Of("filter", filter, "patch", patch, "noScope", noScope(opt)))
}

func (r *replayRepo) Remove(_ context.Context, table, filter string, opt ...database.Opt) ([]*omap.Map, error) {
	return r.next("remove", table, omap.Of("filter", filter, "noScope", noScope(opt)))
}

// TestFlowsReplay: mỗi ca của unit.json "flows" là một lần gọi hàm Node thật trên tầng supa giả, kèm nhật ký lệnh.
// Bản Go chạy cùng ca: phải phát ĐÚNG chuỗi lệnh đó (bảng, bộ lọc, dòng ghi, thứ tự khoá) và trả cùng kết quả / lỗi.
// Một service dùng xuyên suốt nên cache danh mục và cờ thiếu cột người tạo đi theo đúng thứ tự như bên Node.
func TestFlowsReplay(t *testing.T) {
	flows := arr(loadJSON(t, "unit.json").Val("flows"))
	if len(flows) < 100 {
		t.Fatalf("chỉ có %d ca", len(flows))
	}
	replayFlows(t, flows)
}

// replayFlows phát lại lần lượt các ca trên MỘT service mới (cache và cờ của service đi xuyên suốt các ca).
func replayFlows(t *testing.T, flows []any) {
	t.Helper()
	repo := &replayRepo{t: t}
	s, reg := newSvc(repo, &fakeUploader{})
	for _, f := range flows {
		m := jsval.AsMap(f)
		repo.name, repo.calls, repo.i = jsval.AsString(m.Val("name")), arr(m.Val("calls")), 0
		res, err := callFn(ctxOf(m.Val("ctx")), s, reg, actorOf(m.Val("actor")), m.Val("fn").(string), arr(m.Val("args")))
		if repo.i < len(repo.calls) {
			t.Errorf("%s: Go chỉ phát %d / %d lệnh; lệnh thiếu: %s", repo.name, repo.i, len(repo.calls), js(repo.calls[repo.i]))
		}
		if want, ok := m.Val("error").(string); ok {
			if err == nil || err.Error() != want {
				t.Errorf("%s: lỗi\n  go:   %v\n  node: %s", repo.name, err, want)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: Go báo lỗi %q, Node trả %s", repo.name, err.Error(), js(m.Val("result")))
			continue
		}
		if got, want := tsNorm(js(res)), js(m.Val("result")); got != want {
			t.Errorf("%s: kết quả\n  go:   %s\n  node: %s", repo.name, got, want)
		}
	}
}

// TestCacheInvalidation: cache danh mục phải bị xoá sau MỖI chỗ ghi sản phẩm (9 chỗ gọi _cacheClear_ của Node:
// S:542, 556, 570, 653, 714, 793, 894, 947, 1074) - cho mọi công ty, không riêng công ty vừa ghi - và còn nguyên khi
// lệnh ghi dừng sớm hoặc chỉ đọc. testdata/cache.json (gen_cache.js) ghi lại hành vi của mã Node thật: mỗi nhóm là
// nạp cache c1 + super -> ghi -> c1 và super đọc lại; bản Go phải phát đúng chuỗi lệnh đó, tức là đọc lại database
// đúng những lần Node đọc lại.
func TestCacheInvalidation(t *testing.T) {
	spec := loadJSON(t, "cache.json")
	sum := arr(spec.Val("summary"))
	if len(sum) < 30 {
		t.Fatalf("chỉ có %d nhóm", len(sum))
	}
	// 9 nhóm đầu là 9 chỗ xoá cache: Node phải đọc lại ở cả hai công ty (nếu không thì file mẫu không còn kiểm được gì)
	for i, r := range sum[:9] {
		if x := arr(r); x[1] != true || x[2] != true {
			t.Errorf("nhóm %d (%v): Node không đọc lại danh mục sau khi ghi: %s", i, x[0], js(r))
		}
	}
	giu := 0
	for _, r := range sum[9:] {
		if arr(r)[1] == false {
			giu++
		}
	}
	if giu < 10 {
		t.Errorf("chỉ có %d nhóm giữ nguyên cache", giu)
	}
	replayFlows(t, arr(spec.Val("flows")))
}

// ───────────── đăng ký rpc + route ─────────────

func TestRPCNames(t *testing.T) {
	_, reg := newSvc(nil, nil)
	want := map[string]rpc.Perm{
		"getProducts": rpc.Login, "saveDbProduct": rpc.Login, "uploadImage": rpc.Login, "uploadFile": rpc.Login, "deleteDbProduct": rpc.Admin,
		"getDbProduct": rpc.Login, "updateDbProductTracked": rpc.Login, "setSpDuyet": rpc.Login, "setYeuThich": rpc.Login, "getCombo": rpc.Login,
		"setCombo": rpc.Login, "getBienThe": rpc.Login, "setBienThe": rpc.Login, "spMyPerms": rpc.Login, "getProductHistory": rpc.Login,
		"importParse": rpc.Login, "importCommit": rpc.Login, "requestDeleteProducts": rpc.Login, "listDeleteRequests": rpc.Admin,
		"resolveDeleteRequest": rpc.Admin,
	}
	if n := len(reg.Names()); n != len(want) {
		t.Errorf("đăng ký %d hàm rpc, muốn %d", n, len(want))
	}
	for name, perm := range want {
		if p, ok := reg.PermOf(name); !ok || p != perm {
			t.Errorf("%s: quyền %v (có = %v), muốn %v", name, p, ok, perm)
		}
	}
}

func testEngine(s *Service, a *actor.Actor) *gin.Engine {
	gin.SetMode(gin.TestMode)
	e := gin.New()
	e.Use(middleware.JSONBody(middleware.JSONBodyLimit))
	auth := func(c *gin.Context) {
		if c.GetHeader("Authorization") != "" {
			actor.Set(c, a)
		}
	}
	s.RegisterRoutes(e.Group("/api/v1", auth, middleware.Tenant()))
	s.RegisterRoot(e.Group("", auth, middleware.Tenant()))
	return e
}

func do(e *gin.Engine, method, path, ct string, body []byte, login bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	if ct != "" {
		req.Header.Set("Content-Type", ct)
	}
	if login {
		req.Header.Set("Authorization", "Bearer x")
	}
	w := httptest.NewRecorder()
	e.ServeHTTP(w, req)
	return w
}

// Route REST: đúng đường dẫn của PORTING_MAP mục A; chưa đăng nhập -> 401 NOAUTH; route của admin chặn nhân viên.
func TestRESTRoutes(t *testing.T) {
	s, _ := newSvc(nil, nil)
	e := testEngine(s, &actor.Actor{UID: "u", U: "nv", R: "staff"})
	admin := map[string]bool{"DELETE /api/v1/products/:key": true, "GET /api/v1/product-delete-requests": true,
		"POST /api/v1/product-delete-requests/:id/resolve": true}
	want := map[string]bool{"POST /export/san-pham": true, "POST /upload/file": true}
	for _, k := range []string{"GET /products", "POST /products", "GET /products/:key", "PATCH /products/:key", "DELETE /products/:key",
		"GET /products/:key/combo", "PUT /products/:key/combo", "GET /products/:key/variants", "PUT /products/:key/variants",
		"GET /products/:key/history", "POST /product-approvals", "POST /product-favorites", "GET /product-permissions",
		"POST /uploads/images", "POST /uploads/files-base64", "POST /product-imports/parse", "POST /product-imports/commit",
		"POST /product-delete-requests", "GET /product-delete-requests", "POST /product-delete-requests/:id/resolve"} {
		method, path, _ := strings.Cut(k, " ")
		want[method+" /api/v1"+path] = true
	}
	for _, r := range e.Routes() {
		k := r.Method + " " + r.Path
		if !want[k] {
			t.Errorf("route thừa: %s", k)
		}
		delete(want, k)
		if !strings.HasPrefix(r.Path, "/api/v1") {
			continue
		}
		path := strings.NewReplacer(":key", "x", ":id", "1").Replace(r.Path)
		if w := do(e, r.Method, path, "", nil, false); w.Code != 401 || w.Body.String() != `{"error":"Chưa đăng nhập","code":"NOAUTH"}` {
			t.Errorf("%s chưa đăng nhập: %d %s", k, w.Code, w.Body.String())
		}
		if admin[k] {
			if w := do(e, r.Method, path, "", nil, true); w.Code != 403 || w.Body.String() != `{"error":"Không có quyền (chỉ Admin)"}` {
				t.Errorf("%s nhân viên gọi: %d %s", k, w.Code, w.Body.String())
			}
		}
	}
	for k := range want {
		t.Errorf("thiếu route: %s", k)
	}
}

// POST /upload/file (I:763-778): mã trạng thái, thân và thứ tự kiểm tra (đối chiếu bằng cách đọc mã Node).
func TestUploadRoute(t *testing.T) {
	up := &fakeUploader{}
	s, _ := newSvc(nil, up)
	e := testEngine(s, &actor.Actor{UID: "u", U: "nv", R: "staff"})
	pdf := []byte("%PDF-1.4")
	check := func(name string, w *httptest.ResponseRecorder, code int, body string) {
		t.Helper()
		if w.Code != code || upNorm(w.Body.String()) != body {
			t.Errorf("%s: %d %s", name, w.Code, w.Body.String())
		}
	}
	check("chưa đăng nhập", do(e, "POST", "/upload/file?name=a.pdf", "application/pdf", pdf, false), 401, `{"error":"Chưa đăng nhập"}`)
	check("thân rỗng", do(e, "POST", "/upload/file?name=a.pdf", "application/pdf", nil, true), 400, `{"error":"File rỗng."}`)
	check("thiếu tên", do(e, "POST", "/upload/file", "application/pdf", pdf, true), 400,
		`{"error":"Định dạng .tai-lieu chưa hỗ trợ (PDF, ảnh, DWG/DXF, SKP, ZIP/RAR, Word, Excel)."}`)
	check("thân json đã bị express.json đọc", do(e, "POST", "/upload/file?name=a.pdf", "application/json", []byte(`{"a":1}`), true), 400, `{"error":"File rỗng."}`)
	w := do(e, "POST", "/upload/file?name=B%E1%BA%A3n+v%E1%BA%BD.PDF", "application/pdf", pdf, true)
	check("tải được", w, 200, `{"url":"URL:docs/<ms>-Ban-ve.pdf","name":"Bản vẽ.PDF"}`)
	if got := js(up.rec.Val("ct")) + js(up.rec.Val("len")); got != `"application/pdf"8` {
		t.Errorf("kho nhận: %s", js(up.rec))
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Errorf("content-type: %s", ct)
	}
	up.rec = nil
	check("không content-type", do(e, "POST", "/upload/file?name=a.zip", "", pdf, true), 200, `{"url":"URL:docs/<ms>-a.zip","name":"a.zip"}`)
	if up.rec.Val("ct") != "application/octet-stream" {
		t.Errorf("content-type mặc định: %s", js(up.rec))
	}
	// quá (DOC_MAX_MB + 1) MB: 413 JSON kể cả khi chưa đăng nhập (express.raw chạy trước khi kiểm tra đăng nhập)
	big := make([]byte, uploadLimit+1)
	const qua = `{"error":"File quá lớn (tối đa 50MB) — hãy dán link thay vì tải lên."}`
	check("quá giới hạn thân", do(e, "POST", "/upload/file?name=a.pdf", "application/pdf", big, false), 413, qua)
	// giữa 50 MB và 51 MB: thân đọc được, uploadFileBuf từ chối -> 400
	check("quá giới hạn file", do(e, "POST", "/upload/file?name=a.pdf", "application/pdf", big[:DocMaxMB<<20+1], true), 400,
		`{"error":"File 50.0MB quá lớn (tối đa 50MB) — hãy dán link thay vì tải lên."}`)
	up.fail = "Storage upload -> 413 Payload too large"
	check("kho từ chối", do(e, "POST", "/upload/file?name=a.pdf", "application/pdf", pdf, true), 400,
		`{"error":"Kho file từ chối: file 0.0MB vượt giới hạn — hãy dán link thay vì tải lên."}`)
}

// TestUploadRouteNode: các request lạ tới POST /upload/file (thân JSON, query không chuẩn, Content-Encoding) - mã trạng
// thái, thân JSON và đúng các byte gửi lên kho lấy từ route Node thật (testdata/gen_upload_route.js).
func TestUploadRouteNode(t *testing.T) {
	b, err := os.ReadFile(filepath.Join("testdata", "upload_route.json"))
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	cases := arr(v)
	if len(cases) < 50 {
		t.Fatalf("chỉ có %d ca", len(cases))
	}
	for _, c := range cases {
		m := jsval.AsMap(c)
		name := jsval.AsString(m.Val("name"))
		up := &fakeUploader{}
		s, _ := newSvc(nil, up)
		e := testEngine(s, &actor.Actor{UID: "u", U: "nv", R: "staff"})
		body, _ := hex.DecodeString(jsval.AsString(m.Val("bodyHex")))
		req := httptest.NewRequest("POST", "/upload/file", bytes.NewReader(body))
		req.URL.RawQuery = strings.TrimPrefix(jsval.AsString(m.Val("query")), "?")
		hs := jsval.AsMap(m.Val("headers"))
		for _, k := range hs.Keys() {
			req.Header.Set(k, jsval.AsString(hs.Val(k)))
		}
		if m.Val("login") == true {
			req.Header.Set("Authorization", "Bearer x")
		}
		w := httptest.NewRecorder()
		e.ServeHTTP(w, req)
		if want := int(jsval.ToNumber(m.Val("status"))); w.Code != want {
			t.Errorf("%s: mã %d, Node %d (%s)", name, w.Code, want, w.Body.String())
			continue
		}
		// trang lỗi HTML của Express (body = null): chỉ so mã trạng thái
		if want, ok := m.Val("body").(string); ok && upNorm(w.Body.String()) != want {
			t.Errorf("%s: thân\n  go:   %s\n  node: %s", name, w.Body.String(), want)
		}
		var got any
		if up.rec != nil {
			got = omap.Of("hex", hex.EncodeToString(up.buf), "path", up.rec.Val("path"), "ct", up.rec.Val("ct"))
		}
		if g, w := upNorm(js(got)), js(m.Val("up")); g != w {
			t.Errorf("%s: kho nhận\n  go:   %s\n  node: %s", name, g, w)
		}
	}
}
