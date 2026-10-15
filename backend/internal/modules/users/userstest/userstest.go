// Package userstest: đồ nghề cho test đối chiếu Node <-> Go của module users và auth (chỉ test import gói này).
// Bên Node là diff-node.js cùng thư mục: hai bên chạy cùng file ca, cùng SQL dựng dữ liệu, cùng cách chuẩn hoá.
package userstest

import (
	"context"
	"embed"
	"encoding/base64"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

//go:embed sql/*.sql
var sqlFS embed.FS

// Suite: một bộ thử. P = chữ phân biệt (u = users, a = auth), H = chữ số hex trong id cố định.
type Suite struct {
	P, H string
	DB   *database.DB
}

// Open mở database thử; thiếu TEST_DATABASE_URL -> bỏ qua test. Từ chối database không phải qspro_gotest.
func Open(t *testing.T, p, h string) *Suite {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	d := database.New(database.Config{URL: url})
	t.Cleanup(d.Close)
	return &Suite{P: p, H: h, DB: d}
}

var (
	reU = regexp.MustCompile(`\{\{U:([0-9a-f]{4})\}\}`)
	reC = regexp.MustCompile(`\{\{C:([0-9a-f])\}\}`)
)

// Tpl thay {{P}} / {{H}}; {{U:0003}} = id cố định của user số 3, {{C:1}} = id công ty số 1 (xem sql/setup.sql).
func (s *Suite) Tpl(str string) string {
	str = reU.ReplaceAllString(str, "00000000-0000-4000-8000-{{H}}0000000${1}")
	str = reC.ReplaceAllString(str, "00000000-0000-4000-8000-{{H}}0000000c00${1}")
	return strings.ReplaceAll(strings.ReplaceAll(str, "{{P}}", s.P), "{{H}}", s.H)
}

func (s *Suite) sql(name string) string {
	b, err := sqlFS.ReadFile("sql/" + name)
	if err != nil {
		panic(err)
	}
	return s.Tpl(string(b))
}

// Exec chạy SQL thô (nhiều câu lệnh được, pool dùng simple protocol).
func (s *Suite) Exec(t *testing.T, sql string) {
	t.Helper()
	pool, err := s.DB.Pool()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(context.Background(), sql); err != nil {
		t.Fatalf("sql lỗi: %v\n%s", err, sql)
	}
}

// Setup dọn rồi dựng dữ liệu thử; tự dọn khi test xong.
func (s *Suite) Setup(t *testing.T) {
	t.Helper()
	s.Exec(t, s.sql("cleanup.sql"))
	t.Cleanup(func() {
		if os.Getenv("ZZ_KEEP_ROWS") == "" { // gỡ lỗi: giữ dòng lại để xem (lần chạy sau tự dọn)
			s.Exec(t, s.sql("cleanup.sql"))
		}
	})
	s.Exec(t, s.sql("setup.sql"))
}

// Snapshot: dòng users + audit_logs của bộ thử (JSON do Postgres dựng, hai bên giống nhau từng byte).
func (s *Suite) Snapshot(t *testing.T) any {
	t.Helper()
	pool, err := s.DB.Pool()
	if err != nil {
		t.Fatal(err)
	}
	var js string
	if err := pool.QueryRow(context.Background(), s.sql("snapshot.sql")).Scan(&js); err != nil {
		t.Fatal(err)
	}
	v, err := omap.DecodeString(js)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

// ───────────── công ty: bản thế của module companies (getCongTy / hetHan_ / ctOut_, A:41-42, 100-111) ─────────────

// Companies cài contracts.CompanyReader bằng cách đọc thẳng database (chỉ dùng trong test).
type Companies struct{ DB *database.DB }

// GetCongTy = getCongTy (A:107-111).
func (c Companies) GetCongTy(ctx context.Context, id any) (*omap.Map, error) {
	if !jsval.Truthy(id) {
		return nil, nil
	}
	rows, err := c.DB.Select(ctx, "cong_ty", database.SelectOpt{Filter: database.Eq("id", id), Limit: 1, NoScope: true})
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	r := rows[0]
	tinhNang := []any{}
	for _, x := range strings.Split(jsval.StrOr(r.Val("tinh_nang"), ""), ",") {
		if x = jsval.Trim(x); x != "" {
			tinhNang = append(tinhNang, x)
		}
	}
	or := func(k string) any { return jsval.Or(r.Val(k), "") }
	return omap.Of("id", r.Val("id"), "ten", or("ten"), "ma", or("ma"), "logoUrl", or("logo_url"), "mauChinh", or("mau_chinh"),
		"tinhNang", tinhNang, "gioiHanUser", jsval.Num0(r.Val("gioi_han_user")), "active", !jsval.StrictEquals(r.Val("active"), false),
		"hanDung", or("han_dung"), "ghiChu", or("ghi_chu"), "ngayTao", or("ngay_tao"),
		"email", or("email"), "sdt", or("sdt"), "dungSpDezon", jsval.StrictEquals(r.Val("dung_sp_dezon"), true)), nil
}

// HetHan = hetHan_ (A:42).
func (Companies) HetHan(ct *omap.Map) bool {
	if ct == nil || !jsval.Truthy(ct.Val("hanDung")) {
		return false
	}
	today := jsval.ToISOString(time.Now().Add(7 * time.Hour))[:10]
	return jsval.Slice(jsval.ToString(ct.Val("hanDung")), 0, 10) < today
}

// ───────────── chuẩn hoá kết quả (giống hàm norm của diff-node.js) ─────────────

var (
	reUUID   = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	reBcrypt = regexp.MustCompile(`^\$2[aby]\$`)
	tsKeys   = map[string]bool{"createdAt": true, "lastLogin": true, "at": true, "created_at": true, "last_login": true, "exp": true}
)

// Norm thay id sinh tự động, thời điểm, token, mật khẩu băm bằng dấu giữ chỗ.
func Norm(v any, key string) any {
	if jsval.IsNullish(v) {
		return v
	}
	if tsKeys[key] {
		return "<ts>"
	}
	if str, ok := v.(string); ok {
		switch {
		case key == "token":
			parts := strings.Split(str, ".")
			b, _ := base64.RawURLEncoding.DecodeString(parts[0])
			p, _ := omap.Decode(b)
			return omap.Of("payload", Norm(p, ""), "parts", float64(len(parts)))
		case key == "password_hash":
			if reBcrypt.MatchString(str) {
				return str[:7] + "<" + jsval.ToString(float64(len(str))) + ">"
			}
			return str
		case reUUID.MatchString(str) && !strings.HasPrefix(str, "00000000-0000-4000-8000-"):
			return "<uuid>"
		}
		return str
	}
	switch x := v.(type) {
	case float64:
		if key == "id" {
			return "<n>"
		}
	case []any:
		out := make([]any, len(x))
		for i, it := range x {
			out[i] = Norm(it, "")
		}
		return out
	case *omap.Map:
		out := omap.New()
		x.Each(func(k string, it any) { out.Set(k, Norm(it, k)) })
		return out
	}
	return v
}

// ───────────── file ca + file chuẩn ─────────────

// Who: một vai trong file ca - actor và ngữ cảnh công ty như dispatcher của Node dựng (I:623).
type Who struct {
	Actor *actor.Actor
	Ctx   context.Context
}

// Case: một ca.
type Case struct {
	N, As, Fn string
	Raw       *omap.Map // ca gốc (chưa thay {{tên.khoá}})
}

// Spec: file diff-cases.json.
type Spec struct {
	Who   map[string]Who
	Cases []Case
}

// Load đọc file ca (đã thay {{P}} / {{H}}).
func (s *Suite) Load(t *testing.T, path string) *Spec {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.DecodeString(s.Tpl(string(b)))
	if err != nil {
		t.Fatal(err)
	}
	root := jsval.AsMap(v)
	spec := &Spec{Who: map[string]Who{}}
	jsval.AsMap(root.Val("actors")).Each(func(k string, v any) {
		m := jsval.AsMap(v)
		w := Who{Ctx: context.Background()}
		if a := jsval.AsMap(m.Val("actor")); a != nil {
			w.Actor = actor.FromMap(a)
		}
		if c := jsval.AsMap(m.Val("ctx")); c != nil {
			nz := func(k string) any {
				if x := c.Val(k); !jsval.IsNullish(x) {
					return x
				}
				return nil
			}
			w.Ctx = tenant.With(w.Ctx, tenant.Ctx{UID: nz("uid"), Role: jsval.AsString(c.Val("role")), CongTyID: nz("congTyId"), ViewAs: nz("viewAs")})
		}
		spec.Who[k] = w
	})
	for _, it := range jsval.AsArray(root.Val("cases")) {
		m := jsval.AsMap(it)
		as := jsval.AsString(m.Val("as"))
		if as == "" {
			as = "none"
		}
		spec.Cases = append(spec.Cases, Case{N: jsval.AsString(m.Val("n")), As: as, Fn: jsval.AsString(m.Val("fn")), Raw: m})
	}
	return spec
}

var rePlaceholder = regexp.MustCompile(`\{\{([^.}]+)(?:\.([^}]+))?\}\}`)

// Args: args của ca sau khi thay {{tên ca.khoá}} bằng giá trị THÔ của kết quả ca trước.
func (c Case) Args(t *testing.T, raw map[string]any) []any {
	t.Helper()
	js, _ := omap.MarshalString(c.Raw)
	js = rePlaceholder.ReplaceAllStringFunc(js, func(m string) string {
		g := rePlaceholder.FindStringSubmatch(m)
		v, ok := raw[g[1]]
		if ok && g[2] != "" {
			v = jsval.GetPath(v, strings.Split(g[2], ".")...)
		}
		if !ok || jsval.IsUndefined(v) {
			return "MISSING"
		}
		return jsval.ToString(v)
	})
	v, err := omap.DecodeString(js)
	if err != nil {
		t.Fatalf("ca %s: %v", c.N, err)
	}
	return jsval.AsArray(jsval.AsMap(v).Val("args"))
}

// Golden đọc file chuẩn do diff-node.js ghi: tên ca -> json.
func Golden(t *testing.T, path string) map[string]string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]string{}
	for _, ln := range strings.Split(strings.TrimRight(string(b), "\n"), "\n") {
		if n, js, ok := strings.Cut(ln, "\t"); ok {
			out[n] = js
		}
	}
	return out
}

// Line: dòng kết quả của một ca theo đúng dạng của diff-node.js, kèm giá trị THÔ (để ca sau tham chiếu).
func Line(res any, err error) (line string, raw any) {
	var out *omap.Map
	if err != nil {
		out = omap.Of("err", err.Error())
	} else {
		if jsval.IsUndefined(res) {
			res = nil
		}
		out = omap.Of("ok", res)
	}
	// qua JSON một vòng để struct / slice có kiểu của Go thành JS value model trước khi chuẩn hoá
	js, _ := omap.Marshal(out)
	v, _ := omap.Decode(js)
	line, _ = omap.MarshalString(Norm(v, ""))
	return line, jsval.AsMap(v).Val("ok")
}

// ClockWentBack: đồng hồ của Postgres bị chỉnh lùi trong lúc chạy (xem sql/clock.sql).
func (s *Suite) ClockWentBack(t *testing.T) bool {
	t.Helper()
	pool, err := s.DB.Pool()
	if err != nil {
		t.Fatal(err)
	}
	var back bool
	if err := pool.QueryRow(context.Background(), s.sql("clock.sql")).Scan(&back); err != nil {
		t.Fatal(err)
	}
	return back
}

// Diff dựng dữ liệu, chạy mọi ca và so với file chuẩn; trả các chỗ khác. mk tạo service mới cho mỗi lượt và trả hàm
// thực hiện 1 ca (hàm rpc hoặc hàm đặc biệt bắt đầu bằng "$"). Lượt nào đồng hồ database bị chỉnh lùi thì chạy lại
// (tối đa 3 lượt) vì khi đó thứ tự created_at.desc của getAuditLog không còn phản ánh thứ tự ghi.
func (s *Suite) Diff(t *testing.T, casesPath, goldenPath string, mk func() func(c Case, w Who, args []any) (any, error)) {
	t.Helper()
	spec := s.Load(t, casesPath)
	golden := Golden(t, goldenPath)
	for attempt := 1; ; attempt++ {
		s.Setup(t)
		diffs := s.run(t, spec, golden, mk())
		if len(diffs) == 0 {
			return
		}
		if attempt < 3 && s.ClockWentBack(t) {
			t.Logf("lượt %d: đồng hồ database bị chỉnh lùi, chạy lại", attempt)
			continue
		}
		for _, d := range diffs {
			t.Error(d)
		}
		return
	}
}

func (s *Suite) run(t *testing.T, spec *Spec, golden map[string]string, call func(c Case, w Who, args []any) (any, error)) (diffs []string) {
	t.Helper()
	raw := map[string]any{}
	seen := 0
	for _, c := range spec.Cases {
		w, ok := spec.Who[c.As]
		if !ok {
			t.Fatalf("ca %s: không có vai %q", c.N, c.As)
		}
		args := c.Args(t, raw)
		var res any
		var err error
		switch c.Fn {
		case "$sql":
			s.Exec(t, jsval.ToString(args[0]))
		case "$snapshot":
			res = s.Snapshot(t)
		default:
			res, err = call(c, w, args)
		}
		if arr, ok := res.([]any); ok && jsval.Truthy(c.Raw.Val("only")) { // chỉ giữ dòng của bộ thử (super thấy toàn hệ thống)
			kept := []any{}
			for _, x := range arr {
				if strings.HasPrefix(jsval.ToString(jsval.Get(x, "username")), "zz_authusers_"+s.P+"_") {
					kept = append(kept, x)
				}
			}
			res = kept
		}
		line, r := Line(res, err)
		if err == nil {
			raw[c.N] = r
		}
		want, ok := golden[c.N]
		if !ok {
			diffs = append(diffs, "ca "+c.N+": không có trong file chuẩn (chạy lại diff-node.js)")
			continue
		}
		seen++
		if line != want {
			diffs = append(diffs, "ca "+c.N+" khác Node:\n  node: "+want+"\n  go:   "+line)
		}
	}
	if seen != len(golden) {
		diffs = append(diffs, "file chuẩn có "+jsval.ToString(float64(len(golden)))+" ca, đã so "+jsval.ToString(float64(seen)))
	}
	return diffs
}
