package auth

import (
	"context"
	"errors"
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"qspro-backend/internal/config"
	"qspro-backend/internal/modules/users"
	"qspro-backend/internal/modules/users/userstest"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

const testSecret = "zz-authusers-test-secret"

// Giá trị mong đợi trong testdata/pure.json lấy từ mã Node thật (testdata/gen.js).
func loadPure(t *testing.T) *omap.Map {
	t.Helper()
	b, err := os.ReadFile("testdata/pure.json")
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	return jsval.AsMap(v)
}

func js(v any) string { s, _ := omap.MarshalString(v); return s }

func orNil(m *omap.Map) any {
	if m == nil {
		return nil
	}
	return m
}

type auditRec struct{ rows []*omap.Map }

func (r *auditRec) Audit(_ context.Context, a *actor.Actor, action, detail string, congTyID any) {
	var uid any
	u := ""
	if a != nil {
		uid, u = a.UID, a.U
	}
	r.rows = append(r.rows, omap.Of("uid", uid, "u", u, "action", action, "detail", detail, "ct", congTyID))
}

func newPure(secret string, now float64) *Service {
	s := New(Deps{Cfg: &config.Config{AuthSecret: secret}})
	s.now = func() float64 { return now }
	return s
}

func TestTokenGolden(t *testing.T) {
	pure := loadPure(t)
	now := jsval.ToNumber(pure.Val("now"))
	for _, c := range jsval.AsArray(pure.Val("makeToken")) {
		p := jsval.AsArray(c)
		s := newPure(jsval.AsString(p[0]), now)
		got := s.makeToken(jsval.AsMap(p[1]))
		if got != p[2] {
			t.Errorf("makeToken(%s) khoá %q\n  go:   %s\n  node: %s", js(p[1]), p[0], got, p[2])
		}
		// token Node phát ra phải kiểm được bằng Go (cùng khoá) và không kiểm được bằng khoá khác
		if s.VerifyToken(jsval.AsString(p[2])) == nil {
			t.Errorf("VerifyToken không nhận token của Node: %s", p[2])
		}
		if newPure("khoa-khac", now).VerifyToken(jsval.AsString(p[2])) != nil {
			t.Errorf("VerifyToken nhận token ký bằng khoá khác")
		}
	}
	s := newPure(testSecret, now)
	for i, c := range jsval.AsArray(pure.Val("verifyToken")) {
		p := jsval.AsArray(c)
		if got, want := js(orNil(s.VerifyToken(jsval.AsString(p[0])))), js(p[1]); got != want {
			t.Errorf("verifyToken #%d (%s)\n  go:   %s\n  node: %s", i, p[0], got, want)
		}
	}
	exp := jsval.AsArray(pure.Val("verifyExpired"))
	tok := jsval.AsString(exp[0])
	if newPure(testSecret, now+tokenTTLMs+1).VerifyToken(tok) != nil {
		t.Error("token quá hạn 1 ms vẫn được nhận")
	}
	if newPure(testSecret, now+tokenTTLMs).VerifyToken(tok) == nil {
		t.Error("token đúng lúc hết hạn (exp == now) phải còn được nhận như Node")
	}
}

func TestBcryptGolden(t *testing.T) {
	pure := loadPure(t)
	check := func(name string, ok bool, err error, want any) {
		t.Helper()
		if m := jsval.AsMap(want); m != nil {
			if err == nil || err.Error() != m.Val("err") {
				t.Errorf("%s: lỗi %v, node ném %q", name, err, m.Val("err"))
			}
			return
		}
		if err != nil || ok != want {
			t.Errorf("%s = %v, %v; node = %v", name, ok, err, want)
		}
	}
	for i, c := range jsval.AsArray(pure.Val("compareSync")) {
		p := jsval.AsArray(c)
		ok, err := compareSync(jsval.AsString(p[0]), jsval.AsString(p[1]))
		check("compareSync #"+jsval.ToString(float64(i))+" "+jsval.AsString(p[1]), ok, err, p[2])
	}
	for i, c := range jsval.AsArray(pure.Val("pwOk")) {
		p := jsval.AsArray(c)
		ok, isBcrypt, err := pwOk(jsval.AsMap(p[0]), jsval.AsString(p[1]))
		name := "pwOk #" + jsval.ToString(float64(i))
		if m := jsval.AsMap(p[2]); m != nil && m.Has("err") {
			check(name, ok, err, p[2])
			continue
		}
		if got, want := js(omap.Of("ok", ok, "isBcrypt", isBcrypt)), js(p[2]); err != nil || got != want {
			t.Errorf("%s = %s, %v; node = %s", name, got, err, want)
		}
	}
}

func TestHashSync(t *testing.T) {
	long := "ậ" + strings.Repeat("x", 68) + "ẩ" + "tail"
	for _, pw := range []string{"abcd", "", "mật khẩu 😀", long} {
		h, err := hashSync(pw)
		if err != nil || len(h) != 60 || h[:7] != "$2a$10$" {
			t.Fatalf("hashSync(%q) = %q, %v", pw, h, err)
		}
		if ok, err := compareSync(pw, h); !ok || err != nil {
			t.Errorf("compareSync không nhận hash vừa băm của %q", pw)
		}
	}
	h, _ := hashSync(long)
	if ok, _ := compareSync("ậ"+strings.Repeat("x", 68)+"ắ khác", h); !ok {
		t.Error("72 byte đầu giống nhau phải khớp như bcryptjs")
	}
	if ok, _ := compareSync("ậ"+strings.Repeat("x", 68)+"é", h); ok {
		t.Error("khác ở byte thứ 72 thì không được khớp")
	}
}

// TestInteropOut: đặt INTEROP_OUT=<file> để ghi token + hash do Go sinh ra, rồi kiểm bằng Node:
// AUTH_SECRET=zz-authusers-test-secret node testdata/interop-node.js <file>.
func TestInteropOut(t *testing.T) {
	out := os.Getenv("INTEROP_OUT")
	if out == "" {
		t.Skip("chưa đặt INTEROP_OUT")
	}
	s := New(Deps{Cfg: &config.Config{AuthSecret: testSecret}})
	u := omap.Of("id", "68cb6934-c871-4681-8cfe-def02ba28b0c", "username", "ü名 \"x\"", "role", "admin", "cong_ty_id", nil)
	hashes := []any{}
	for _, pw := range []string{"abcd", "", "mật khẩu 😀", "ậ" + strings.Repeat("x", 68) + "ẩtail", strings.Repeat("y", 72), "a\x00b"} {
		h, err := hashSync(pw)
		if err != nil {
			t.Fatal(err)
		}
		hashes = append(hashes, omap.Of("pw", pw, "hash", h))
	}
	b, _ := omap.Marshal(omap.Of("token", s.makeToken(u), "user", u, "hashes", hashes))
	if err := os.WriteFile(out, b, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestPureHelpersGolden(t *testing.T) {
	pure := loadPure(t)
	for i, c := range jsval.AsArray(pure.Val("sort")) {
		p := jsval.AsArray(c)
		rows := []*omap.Map{}
		for _, r := range jsval.AsArray(p[0]) {
			rows = append(rows, jsval.AsMap(r))
		}
		sortCandidates(rows)
		ids := make([]any, len(rows))
		for j, r := range rows {
			ids[j] = r.Val("id")
		}
		if got, want := js(ids), js(p[1]); got != want {
			t.Errorf("sort #%d = %s, node = %s", i, got, want)
		}
	}
	for _, c := range jsval.AsArray(pure.Val("prefsOf")) {
		p := jsval.AsArray(c)
		if got, want := js(prefsOf(jsval.AsMap(p[0]))), js(p[1]); got != want {
			t.Errorf("prefsOf(%s) = %s, node = %s", js(p[0]), got, want)
		}
	}
	rec := &auditRec{}
	s := New(Deps{Auditor: rec})
	for _, c := range jsval.AsArray(pure.Val("logClientError")) {
		p := jsval.AsArray(c)
		rec.rows = nil
		res, err := s.LogClientError(context.Background(), &actor.Actor{UID: "u1", U: "ten"}, p[0])
		if err != nil || js(res) != js(p[2]) || len(rec.rows) != 1 {
			t.Fatalf("LogClientError(%s) = %s, %v", js(p[0]), js(res), err)
		}
		want := jsval.AsMap(p[1])
		got := rec.rows[0]
		if got.Val("detail") != want.Val("detail") || got.Val("action") != want.Val("action") || got.Val("u") != want.Val("username") {
			t.Errorf("LogClientError(%s)\n  go:   %s\n  node: %s", js(p[0]), js(got), js(want))
		}
	}
}

func TestNodeBase64(t *testing.T) {
	// Buffer.from(x, "base64").toString("latin1") của Node
	cases := map[string]string{"": "", "QQ": "A", "QQ==": "A", "QUI": "AB", "QUJD": "ABC", "QU JD\n": "ABC", "QUJDRA": "ABCD",
		"Q": "", "QUJDR": "ABC", "QQ==QQ": "A", "_-8": "\xff\xef", "/+8": "\xff\xef", "Q!U@J#D": "ABC"}
	for in, want := range cases {
		if got := string(nodeBase64(in)); got != want {
			t.Errorf("nodeBase64(%q) = %q, muốn %q", in, got, want)
		}
	}
}

// ───────────── cache phiên 30 giây (repository + công ty giả) ─────────────

type fakeRepo struct {
	Repository
	rows  []*omap.Map
	err   error
	calls int
}

func (f *fakeRepo) SessionUser(context.Context, any) ([]*omap.Map, error) {
	f.calls++
	return f.rows, f.err
}

type fakeCompanies struct {
	ct      *omap.Map
	expired bool
	calls   int
}

func (f *fakeCompanies) GetCongTy(_ context.Context, id any) (*omap.Map, error) {
	f.calls++
	return f.ct, nil
}
func (f *fakeCompanies) HetHan(*omap.Map) bool { return f.expired }

func TestSessionCache(t *testing.T) {
	now := 1790000000000.0
	repo := &fakeRepo{rows: []*omap.Map{omap.Of("id", "u1", "username", "moi", "role", "admin", "active", true, "cong_ty_id", "c1")}}
	comp := &fakeCompanies{ct: omap.Of("id", "c1", "active", true, "hanDung", "")}
	s := New(Deps{Cfg: &config.Config{AuthSecret: testSecret}, Companies: comp})
	s.repo = repo
	s.now = func() float64 { return now }
	ctx := context.Background()
	tok := s.makeToken(omap.Of("id", "u1", "username", "cu", "role", "staff", "cong_ty_id", nil))
	exp := now + tokenTTLMs

	get := func() *actor.Actor {
		t.Helper()
		a, err := s.SessionActor(ctx, tok)
		if err != nil {
			t.Fatal(err)
		}
		return a
	}
	// payload của token bị đè bởi r / ct / u trong database
	a := get()
	if a == nil || a.UID != "u1" || a.U != "moi" || a.R != "admin" || a.CT != "c1" || a.Exp != exp {
		t.Fatalf("actor = %+v", a)
	}
	if got := js(a); got != `{"uid":"u1","u":"moi","r":"admin","ct":"c1","exp":1790604800000}` {
		t.Errorf("actor json = %s", got)
	}
	// trong 30 giây: không đọc lại database dù dữ liệu đã đổi
	repo.rows[0].Set("active", false)
	now += sessionCacheMs - 1
	if get() == nil || repo.calls != 1 || comp.calls != 1 {
		t.Fatalf("cache dương không được dùng: calls = %d", repo.calls)
	}
	// đủ 30 giây: đọc lại -> tài khoản đã khoá -> nil, và kết quả ÂM cũng được giữ
	now++
	if get() != nil || repo.calls != 2 {
		t.Fatalf("hết hạn cache phải đọc lại: calls = %d", repo.calls)
	}
	repo.rows[0].Set("active", true)
	now += sessionCacheMs - 1
	if get() != nil || repo.calls != 2 {
		t.Fatal("cache âm không được dùng")
	}
	// ForgetSession: có hiệu lực ngay
	s.ForgetSession("u1")
	if get() == nil || repo.calls != 3 {
		t.Fatal("ForgetSession không xoá mục cache")
	}
	// công ty khoá / hết hạn / không có -> nil (super miễn trừ, không đọc công ty)
	for _, f := range []func(){
		func() { comp.ct = omap.Of("id", "c1", "active", false) },
		func() { comp.ct = omap.Of("id", "c1", "active", true); comp.expired = true },
		func() { comp.expired = false; comp.ct = nil },
		func() { comp.ct = omap.Of("id", "c1", "active", true); repo.rows[0].Set("cong_ty_id", nil) },
	} {
		f()
		s.ForgetSession("u1")
		if get() != nil {
			t.Error("công ty khoá / hết hạn / thiếu mà phiên vẫn hợp lệ")
		}
	}
	repo.rows[0].Set("role", "super")
	s.ForgetSession("u1")
	before := comp.calls
	if a := get(); a == nil || a.R != "super" || a.CT != nil || comp.calls != before {
		t.Errorf("super không cần công ty: %+v", a)
	}
	// không có dòng nào -> nil; lỗi database -> trả lỗi và KHÔNG ghi cache
	repo.rows = nil
	s.ForgetSession("u1")
	if get() != nil {
		t.Error("tài khoản không tồn tại mà phiên vẫn hợp lệ")
	}
	s.ForgetSession("u1")
	repo.err = errors.New("mất kết nối")
	if _, err := s.SessionActor(ctx, tok); err == nil {
		t.Fatal("lỗi database phải được trả về")
	}
	repo.err = nil
	n := repo.calls
	if get(); repo.calls != n+1 {
		t.Error("lỗi database không được ghi vào cache")
	}
	// token sai: không đọc database
	n = repo.calls
	if a, err := s.SessionActor(ctx, tok+"x"); a != nil || err != nil || repo.calls != n {
		t.Error("token sai chữ ký")
	}
	// uid dạng số: khoá cache là String(uid)
	s.ForgetSession(12.0)
	s.mu.Lock()
	s.sess["12"] = sessEntry{at: now}
	s.mu.Unlock()
	s.ForgetSession(12.0)
	if _, ok := s.sess["12"]; ok {
		t.Error("ForgetSession(12) không xoá khoá \"12\"")
	}
}

// ───────────── đối chiếu với Node trên database thử ─────────────

// TestDiffNode chạy testdata/diff-cases.json qua cổng rpc (module auth nối với module users thật, qspro_gotest)
// và so từng ca với kết quả của server/auth.js trên qspro_nodetest (testdata/diff-golden.txt, sinh bằng
// AUTH_SECRET=zz-authusers-test-secret node ../users/userstest/diff-node.js a 2 testdata/diff-cases.json testdata/diff-golden.txt).
func TestDiffNode(t *testing.T) {
	su := userstest.Open(t, "a", "2")
	su.Diff(t, "testdata/diff-cases.json", "testdata/diff-golden.txt", func() func(userstest.Case, userstest.Who, []any) (any, error) {
		cfg := &config.Config{AuthSecret: testSecret}
		comp := userstest.Companies{DB: su.DB}
		usersSvc := users.New(users.Deps{DB: su.DB, Cfg: cfg})
		svc := New(Deps{DB: su.DB, Cfg: cfg, Users: usersSvc, UserFormatter: usersSvc, Auditor: usersSvc, Companies: comp})
		usersSvc.SetCompanyReader(comp)
		usersSvc.SetSessionInvalidator(svc)
		reg := rpc.NewRegistry()
		svc.RegisterRPC(reg)
		wantPerm := map[string]rpc.Perm{"login": rpc.Public, "me": rpc.Login, "setMyPref": rpc.Login, "logout": rpc.Login,
			"changePassword": rpc.Login, "logClientError": rpc.Login}
		if n := len(reg.Names()); n != len(wantPerm) {
			t.Fatalf("đăng ký %d hàm rpc, muốn %d", n, len(wantPerm))
		}
		for n, p := range wantPerm {
			if got, ok := reg.PermOf(n); !ok || got != p {
				t.Errorf("%s: quyền %v, muốn %v", n, got, p)
			}
		}
		usersSvc.RegisterRPC(reg)
		return func(c userstest.Case, w userstest.Who, args []any) (any, error) {
			a := rpc.Args(args)
			switch c.Fn {
			case "$sessionActor":
				act, err := svc.SessionActor(w.Ctx, jsval.AsString(a.Arg(0)))
				if act == nil || err != nil {
					return nil, err
				}
				return act, nil
			case "$verifyToken":
				return orNil(svc.VerifyToken(jsval.AsString(a.Arg(0)))), nil
			case "$makeToken":
				return omap.Of("token", svc.makeToken(a.Map(0))), nil
			case "$forget":
				svc.ForgetSession(a.Arg(0))
				return nil, nil
			}
			return reg.Call(w.Ctx, c.Fn, w.Actor, args...)
		}
	})
}

// Route REST: đúng đường dẫn của PORTING_MAP mục A; trừ login, chưa đăng nhập -> 401 NOAUTH.
func TestRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	e := gin.New()
	New(Deps{}).RegisterRoutes(e.Group("/api/v1"))
	want := map[string]bool{"POST /api/v1/auth/login": true, "GET /api/v1/auth/me": true, "PUT /api/v1/auth/me/prefs/:key": true,
		"POST /api/v1/auth/logout": true, "POST /api/v1/auth/change-password": true, "POST /api/v1/client-errors": true}
	for _, r := range e.Routes() {
		k := r.Method + " " + r.Path
		if !want[k] {
			t.Errorf("route thừa: %s", k)
		}
		delete(want, k)
		if k == "POST /api/v1/auth/login" {
			continue
		}
		w := httptest.NewRecorder()
		e.ServeHTTP(w, httptest.NewRequest(r.Method, strings.ReplaceAll(r.Path, ":key", "tkCols"), nil))
		if w.Code != 401 || w.Body.String() != `{"error":"Chưa đăng nhập","code":"NOAUTH"}` {
			t.Errorf("%s chưa đăng nhập: %d %s", k, w.Code, w.Body.String())
		}
	}
	for k := range want {
		t.Errorf("thiếu route: %s", k)
	}
}
