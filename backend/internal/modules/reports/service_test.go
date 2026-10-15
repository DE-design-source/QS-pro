package reports

import (
	"context"
	"errors"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"qspro-backend/internal/config"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Giá trị mong đợi trong testdata/*.json sinh từ mã Node thật (server/index.js): xem testdata/gen.js.

func loadJSON(t *testing.T, name string) *omap.Map {
	t.Helper()
	b, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	return jsval.AsMap(v)
}

func js(t *testing.T, v any) string {
	t.Helper()
	s, err := omap.MarshalString(v)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func num(v any) float64 { return jsval.ToNumber(v) }

func clockAt(ms float64) func() time.Time {
	return func() time.Time { return time.UnixMilli(int64(ms)) }
}

// ───────────── kỳ báo cáo ─────────────

func TestPeriod(t *testing.T) {
	cases := jsval.AsArray(loadJSON(t, "golden_pure.json").Val("period"))
	if len(cases) < 30 {
		t.Fatalf("cần ít nhất 30 thời điểm, có %d", len(cases))
	}
	for _, c := range cases {
		m := jsval.AsMap(c)
		s := &Service{now: clockAt(num(m.Val("now")))}
		vn := s.nowVN()
		if vn != num(m.Val("vn")) {
			t.Errorf("now %v: nowVN = %v, Node cho %v", m.Val("now"), vn, m.Val("vn"))
		}
		tu := moBaoCaoTruoc(vn)
		if tu != num(m.Val("tu")) {
			t.Errorf("now %v: moBaoCaoTruoc = %v, Node cho %v", m.Val("now"), tu, m.Val("tu"))
		}
		if iso, _ := isoString(tu - vnOffsetMs); iso != m.Val("tuIso") {
			t.Errorf("now %v: vnToUtcIso = %q, Node cho %q", m.Val("now"), iso, m.Val("tuIso"))
		}
		if got := ddmm(tu) + " " + ddmm(vn); got != jsval.ToString(m.Val("ddmmTu"))+" "+jsval.ToString(m.Val("ddmmVn")) {
			t.Errorf("now %v: ddmm = %q", m.Val("now"), got)
		}
	}
}

// TestParseDate: new Date(x) phải khớp Node từng mili giây, kể cả chuỗi dạng tự do (bộ đọc legacy của V8) và giờ đổi mùa.
func TestParseDate(t *testing.T) {
	total := 0
	for _, blk := range jsval.AsArray(loadJSON(t, "golden_pure.json").Val("parse")) {
		b := jsval.AsMap(blk)
		tz := jsval.AsString(b.Val("tz"))
		loc, err := time.LoadLocation(tz)
		if err != nil {
			t.Fatal(err)
		}
		same := func(got float64, want any) bool {
			if want == nil {
				return got != got
			}
			return got == num(want)
		}
		strs := jsval.AsMap(b.Val("str"))
		for _, s := range strs.Keys() {
			want := strs.Val(s)
			got := parseDate(s, loc)
			total++
			if same(got, want) {
				continue
			}
			t.Errorf("[%s] new Date(%q) = %v, Node cho %v", tz, s, got, js(t, want))
		}
		for _, c := range jsval.AsArray(b.Val("val")) {
			m := jsval.AsMap(c)
			got := newDate(m.Val("v"), loc)
			if same(got, m.Val("ms")) {
				continue
			}
			t.Errorf("[%s] new Date(%s) = %v, Node cho %v", tz, js(t, m.Val("v")), got, js(t, m.Val("ms")))
		}
	}
	if total < 6*1500 {
		t.Errorf("golden chỉ có %d chuỗi", total)
	}
	if got := newDate(jsval.Undefined, time.UTC); got == got {
		t.Errorf("new Date(undefined) = %v", got)
	}
	if got := newDate(nil, time.UTC); got != 0 {
		t.Errorf("new Date(null) = %v", got)
	}
}

// Giá trị mong đợi lấy từ Node 22: s.toLowerCase().
func TestJSLower(t *testing.T) {
	in := []string{"İbo", "ΌΣΟΣ", "ΑΣ ΣΑ Σ", "A.Σ", "AΣ.B", "ǅ", "ẞ", "ΑΣ́", "Σ", "ĐẠT Admin"}
	want := []string{"i̇bo", "όσος", "ας σα σ", "a.ς", "aσ.b", "ǆ", "ß", "ας́", "σ", "đạt admin"}
	for i := range in {
		if got := jsLower(in[i]); got != want[i] {
			t.Errorf("toLowerCase(%q) = %q, Node cho %q", in[i], got, want[i])
		}
	}
}

// fetch của Node 22 không đi qua proxy của biến môi trường và không giới hạn tổng thời gian nhận thân trả lời:
// chỉ ngắt khi thân ĐỨNG IM quá hạn.
func TestHTTPClientNhuFetch(t *testing.T) {
	c := newHTTPClient()
	tr := c.Transport.(*http.Transport)
	if tr.Proxy != nil || c.Timeout != 0 || tr.ResponseHeaderTimeout != undiciTimeout || tr.ForceAttemptHTTP2 {
		t.Errorf("client khác fetch của Node: %+v", tr)
	}
	slow := func(gaps ...time.Duration) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			parts := []string{"{\"co", "de\"", ":0", "}"}
			rw.WriteHeader(200)
			for i, p := range parts {
				_, _ = io.WriteString(rw, p)
				rw.(http.Flusher).Flush()
				if i < len(gaps) {
					time.Sleep(gaps[i])
				}
			}
		}))
	}
	q := theCongTy{congTy: "A", bang: []bangRow{{ten: "x", ngay: []ngayRow{{ngay: "01/01", soSP: 1}}}}, tk: thongKe{tongSP: 1}}
	// tổng 240 ms > hạn 150 ms nhưng không lần đứng im nào quá hạn -> vẫn thành công
	srv := slow(80*time.Millisecond, 80*time.Millisecond, 80*time.Millisecond)
	s := &Service{webhook: srv.URL, httpc: newHTTPClient(), bodyGap: 150 * time.Millisecond}
	if !s.guiThe(context.Background(), q, 0, 0) {
		t.Errorf("thân về chậm nhưng đều: phải gửi thành công")
	}
	srv.Close()
	srv = slow(400 * time.Millisecond)
	s.webhook = srv.URL
	if s.guiThe(context.Background(), q, 0, 0) {
		t.Errorf("thân đứng im quá hạn: phải tính là gửi lỗi")
	}
	srv.Close()
	// thân có BOM: r.json() của Node vẫn đọc được
	srv = httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		_, _ = rw.Write(append([]byte{0xEF, 0xBB, 0xBF}, `{"code":0}`...))
	}))
	defer srv.Close()
	s.webhook = srv.URL
	if !s.guiThe(context.Background(), q, 0, 0) {
		t.Errorf("thân có BOM: phải gửi thành công")
	}
}

// ───────────── thẻ Lark ─────────────

func ngayRows(v any) []ngayRow {
	var out []ngayRow
	for _, x := range jsval.AsArray(v) {
		m := jsval.AsMap(x)
		out = append(out, ngayRow{ngay: jsval.AsString(m.Val("ngay")), soSP: num(m.Val("soSP")), soNCC: num(m.Val("soNCC"))})
	}
	return out
}

func TestBuildSpReportCard(t *testing.T) {
	for i, c := range jsval.AsArray(loadJSON(t, "golden_pure.json").Val("card")) {
		in := jsval.AsMap(jsval.AsMap(c).Val("in"))
		var bang []bangRow
		for _, x := range jsval.AsArray(in.Val("bang")) {
			m := jsval.AsMap(x)
			bang = append(bang, bangRow{ten: m.Val("ten"), phongBan: m.Val("phongBan"), tongSP: num(m.Val("tongSP")),
				tongNCC: num(m.Val("tongNCC")), ngay: ngayRows(m.Val("ngay"))})
		}
		var nganh []nganhRow
		for _, x := range jsval.AsArray(in.Val("nganh")) {
			m := jsval.AsMap(x)
			nganh = append(nganh, nganhRow{ten: jsval.AsString(m.Val("ten")), soSP: num(m.Val("soSP")), soNCC: num(m.Val("soNCC"))})
		}
		k := jsval.AsMap(in.Val("tk"))
		tk := thongKe{tongSP: num(k.Val("tongSP")), tongNCC: num(k.Val("tongNCC")), tongNguoi: num(k.Val("tongNguoi")), chuaGanCT: k.Val("chuaGanCT") == true}
		got := js(t, buildSpReportCard(in.Val("ten"), bang, tk, num(in.Val("tu")), num(in.Val("den")), num(in.Val("khuyet")), nganh))
		if want := jsval.AsString(jsval.AsMap(c).Val("out")); got != want {
			t.Errorf("thẻ %d:\n Go   %s\n Node %s", i, got, want)
		}
	}
}

// ───────────── repository giả ─────────────

type fakeRepo struct {
	products, users, cty, audits any // []any các dòng, hoặc object {throw: "..."}
	auditThrow                   string
	calls                        []string
	tuIso                        string
	details                      []string
}

func rowsOrErr(v any) ([]*omap.Map, error) {
	if m := jsval.AsMap(v); m != nil {
		return nil, errors.New(jsval.AsString(m.Val("throw")))
	}
	out := []*omap.Map{}
	for _, r := range jsval.AsArray(v) {
		out = append(out, jsval.AsMap(omap.DeepClone(r)))
	}
	return out, nil
}

func (f *fakeRepo) NewProducts(_ context.Context, tuIso string) ([]*omap.Map, error) {
	f.calls, f.tuIso = append(f.calls, "db_san_pham"), tuIso
	return rowsOrErr(f.products)
}
func (f *fakeRepo) Users(context.Context) ([]*omap.Map, error) {
	f.calls = append(f.calls, "users")
	return rowsOrErr(f.users)
}
func (f *fakeRepo) Companies(context.Context) ([]*omap.Map, error) {
	f.calls = append(f.calls, "cong_ty")
	return rowsOrErr(f.cty)
}
func (f *fakeRepo) InsertAudit(_ context.Context, detail string) error {
	if f.auditThrow != "" {
		return errors.New(f.auditThrow)
	}
	f.details = append(f.details, detail)
	return nil
}
func (f *fakeRepo) RecentAudits(context.Context) ([]*omap.Map, error) { return rowsOrErr(f.audits) }

// webhookGia: server Lark giả trả lời theo kịch bản, ghi lại thân từng request.
type webhookGia struct {
	mu     sync.Mutex
	script []any
	bodies []string
	bad    []string
	*httptest.Server
}

func newWebhook(script []any) *webhookGia {
	w := &webhookGia{script: script}
	w.Server = httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.mu.Lock()
		i := len(w.bodies)
		w.bodies = append(w.bodies, string(body))
		if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
			w.bad = append(w.bad, r.Method+" "+r.Header.Get("Content-Type"))
		}
		var step *omap.Map
		if i < len(w.script) {
			step = jsval.AsMap(w.script[i])
		} else {
			step = omap.Of("json", omap.Of("code", 0.0))
		}
		w.mu.Unlock()
		if step.Has("throw") { // fetch ném lỗi: cắt kết nối giữa chừng
			if hj, ok := rw.(http.Hijacker); ok {
				if conn, _, err := hj.Hijack(); err == nil {
					conn.Close()
				}
			}
			return
		}
		text, err := omap.MarshalString(step.Val("json"))
		if err != nil {
			text = "null"
		}
		if step.Has("text") {
			text = jsval.AsString(step.Val("text"))
		}
		if st := step.Val("status"); jsval.IsNumber(st) {
			rw.WriteHeader(int(num(st)))
		}
		_, _ = io.WriteString(rw, text)
	}))
	return w
}

// sent: bản sao các thân đã nhận (handler của request bị cắt kết nối có thể còn đang chạy).
func (w *webhookGia) sent() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return append([]string(nil), w.bodies...)
}

func TestBaoCaoNhapSPFlow(t *testing.T) {
	for _, c := range jsval.AsArray(loadJSON(t, "golden_pure.json").Val("flow")) {
		in, want := jsval.AsMap(jsval.AsMap(c).Val("in")), jsval.AsMap(jsval.AsMap(c).Val("out"))
		name := jsval.AsString(in.Val("name"))
		t.Run(name, func(t *testing.T) {
			hook := newWebhook(jsval.AsArray(in.Val("fetch")))
			defer hook.Close()
			repo := &fakeRepo{products: in.Val("products"), users: in.Val("users"), cty: in.Val("cty"), auditThrow: jsval.Str(in.Val("auditThrow"))}
			s := &Service{repo: repo, webhook: hook.URL, httpc: http.DefaultClient, now: clockAt(num(in.Val("now"))), loc: time.UTC}
			res, err := s.BaoCaoNhapSP(context.Background(), &actor.Actor{R: "super"}, jsval.AsMap(in.Val("opts")))
			if want.Has("error") {
				if err == nil || err.Error() != want.Val("error") {
					t.Fatalf("lỗi = %v, Node ném %q", err, want.Val("error"))
				}
			} else if err != nil {
				t.Fatalf("lỗi bất ngờ: %v", err)
			} else if got := js(t, res); got != want.Val("result") {
				t.Errorf("kết quả:\n Go   %s\n Node %s", got, want.Val("result"))
			}
			if got, w := js(t, strs(repo.calls)), js(t, want.Val("selects")); got != w {
				t.Errorf("thứ tự đọc database: %s, Node: %s", got, w)
			}
			if w := want.Val("tuIsoArg"); w != nil && repo.tuIso != w {
				t.Errorf("mốc lọc ngay_tao: %q, Node: %q", repo.tuIso, w)
			}
			wb, gb := jsval.AsArray(want.Val("bodies")), hook.sent()
			if len(gb) != len(wb) {
				t.Fatalf("số thẻ gửi: %d, Node: %d", len(gb), len(wb))
			}
			for i := range wb {
				if gb[i] != wb[i] {
					t.Errorf("thẻ %d:\n Go   %s\n Node %s", i, gb[i], wb[i])
				}
			}
			hook.mu.Lock()
			if len(hook.bad) > 0 {
				t.Errorf("request sai phương thức / Content-Type: %v", hook.bad)
			}
			hook.mu.Unlock()
			var audits []any
			for _, d := range repo.details {
				audits = append(audits, js(t, []any{omap.Of("username", "hệ thống", "action", baoCaoAction, "detail", d)}))
			}
			if got, w := js(t, audits), js(t, want.Val("audits")); got != w && !(len(audits) == 0 && w == "[]") {
				t.Errorf("audit: %s, Node: %s", got, w)
			}
		})
	}
}

func strs(a []string) []any {
	out := make([]any, len(a))
	for i, s := range a {
		out[i] = s
	}
	return out
}

func TestDaGuiHomNay(t *testing.T) {
	for i, c := range jsval.AsArray(loadJSON(t, "golden_pure.json").Val("daGui")) {
		m := jsval.AsMap(c)
		s := &Service{repo: &fakeRepo{audits: m.Val("rows")}, now: clockAt(num(m.Val("now"))), loc: time.UTC}
		if got := s.DaGuiHomNay(context.Background()); got != (m.Val("out") == true) {
			t.Errorf("ca %d (%s): %v, Node cho %v", i, js(t, m.Val("rows")), got, m.Val("out"))
		}
	}
}

func TestRegisterRPC(t *testing.T) {
	reg := rpc.NewRegistry()
	repo := &fakeRepo{products: []any{}}
	s := &Service{repo: repo, now: time.Now, loc: time.UTC}
	s.RegisterRPC(reg)
	if p, ok := reg.PermOf("baoCaoNhapSP"); !ok || p != rpc.Super {
		t.Fatalf("baoCaoNhapSP: quyền %v, có %v", p, ok)
	}
	if n := len(reg.Names()); n != 1 {
		t.Fatalf("số hàm đăng ký = %d", n)
	}
	// tham số không phải object (thiếu, null, chuỗi, số) đều như {}
	for _, args := range [][]any{{}, {nil}, {"abc"}, {5.0}, {[]any{}}, {omap.Of("dryRun", true)}} {
		r, err := reg.Call(context.Background(), "baoCaoNhapSP", &actor.Actor{R: "super"}, args...)
		if err != nil || js(t, r) != `{"sent":false,"count":0,"message":"Kỳ này chưa có sản phẩm mới"}` {
			t.Errorf("args %s: %s, %v", js(t, args), js(t, r), err)
		}
	}
	r, _ := reg.Call(context.Background(), "baoCaoNhapSP", &actor.Actor{R: "super"}, omap.Of("tuVN", "hỏng"))
	if js(t, r) != `{"sent":false,"count":0,"message":"Mốc thời gian không hợp lệ"}` {
		t.Errorf("tuVN hỏng: %s", js(t, r))
	}
}

func TestNewDefaults(t *testing.T) {
	s := New(Deps{Cfg: &config.Config{ReportWebhook: "http://x/y"}})
	if s.webhook != "http://x/y" || s.now == nil || s.loc != time.Local || s.httpc == nil {
		t.Errorf("New: %+v", s)
	}
	if math.Abs(s.nowVN()-float64(time.Now().UnixMilli())-vnOffsetMs) > 5000 {
		t.Errorf("nowVN lệch đồng hồ thật")
	}
}

// ───────────── đối chiếu với Node trên database thử ─────────────

// filterRepo: như supaF trong gen.js - chỉ giữ sản phẩm của bản sao gốc khi on.
type filterRepo struct {
	Repository
	on bool
}

func (f *filterRepo) NewProducts(ctx context.Context, tuIso string) ([]*omap.Map, error) {
	rows, err := f.Repository.NewProducts(ctx, tuIso)
	if err != nil || !f.on {
		return rows, err
	}
	zz := func(v any) bool { return strings.HasPrefix(strings.ToLower(jsval.ToString(v)), "zz") }
	out := []*omap.Map{}
	for _, r := range rows {
		if jsval.ToString(r.Val("ngay_tao")) < "2026-10-09" && !zz(r.Val("ma_sp")) && !zz(r.Val("ten_sp")) {
			out = append(out, r)
		}
	}
	return out, nil
}

func TestDiffDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !strings.Contains(url, "/qspro_gotest") {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	seed, golden := loadJSON(t, "seed.json"), loadJSON(t, "golden_db.json")
	db := database.New(database.Config{URL: url})
	defer db.Close()
	pool, err := db.Pool()
	if err != nil {
		t.Fatal(err)
	}
	bg := context.Background()
	sweep := func() {
		for _, q := range jsval.AsArray(seed.Val("sweep")) {
			if _, err := pool.Exec(bg, jsval.AsString(q)); err != nil {
				t.Errorf("dọn dữ liệu: %v", err)
			}
		}
	}
	sweep()
	defer sweep()

	// công ty và 2 tài khoản có sẵn: phải trùng với bản sao bên Node
	var ctID, ctTen, ctMa string
	if err := pool.QueryRow(bg, jsval.AsString(seed.Val("pickCompany"))).Scan(&ctID, &ctTen, &ctMa); err != nil {
		t.Fatal(err)
	}
	urows, err := pool.Query(bg, jsval.AsString(seed.Val("pickUsers")))
	if err != nil {
		t.Fatal(err)
	}
	var us []any
	var names []string
	for urows.Next() {
		var u, h, p string
		if err := urows.Scan(&u, &h, &p); err != nil {
			t.Fatal(err)
		}
		us = append(us, omap.Of("username", u, "ho_ten", h, "phong_ban", p))
		names = append(names, u)
	}
	urows.Close()
	fixture := omap.Of("ct", omap.Of("id", ctID, "ten", ctTen, "ma", ctMa), "users", us)
	if got, want := js(t, fixture), js(t, golden.Val("fixture")); got != want {
		t.Fatalf("hai database thử không còn cùng dữ liệu gốc:\n Go   %s\n Node %s", got, want)
	}
	var products []*omap.Map
	for _, r := range jsval.AsArray(seed.Val("products")) {
		o := jsval.AsMap(r).Clone()
		if o.Val("cong_ty_id") == "$CT" {
			o.Set("cong_ty_id", ctID)
		} else {
			o.Set("cong_ty_id", nil)
		}
		switch o.Val("nguoi_tao") {
		case "$U0":
			o.Set("nguoi_tao", names[0])
		case "$U1":
			o.Set("nguoi_tao", strings.ToUpper(names[1]))
		}
		products = append(products, o)
	}
	gieo := func() {
		if _, err := db.Insert(bg, "db_san_pham", products, database.Opt{NoScope: true}); err != nil {
			t.Fatal(err)
		}
	}
	gieo()

	hook := newWebhook(jsval.AsArray(seed.Val("fetch")))
	defer hook.Close()
	s := New(Deps{DB: db, Cfg: &config.Config{ReportWebhook: hook.URL}})
	flt := &filterRepo{Repository: s.repo}
	s.repo, s.loc = flt, time.UTC
	at := func(iso string) { s.now = clockAt(parseDate(iso, time.UTC)) }
	at(jsval.AsString(seed.Val("now")))
	sup := &actor.Actor{R: "super"}
	tuVN := seed.Val("tuVN")

	steps := jsval.AsArray(golden.Val("steps"))
	n := 0
	step := func(name string, fn func() (any, error)) {
		t.Helper()
		if n >= len(steps) {
			t.Fatalf("bước %q: golden chỉ có %d bước", name, len(steps))
		}
		want := jsval.AsMap(steps[n])
		n++
		if want.Val("name") != name {
			t.Fatalf("bước %d: Go chạy %q, Node chạy %q", n, name, want.Val("name"))
		}
		r, err := fn()
		if want.Has("error") {
			if err == nil || err.Error() != want.Val("error") {
				t.Errorf("%s: lỗi %v, Node ném %q", name, err, want.Val("error"))
			}
			return
		}
		if err != nil {
			t.Errorf("%s: lỗi bất ngờ %v", name, err)
			return
		}
		if got := js(t, r); got != want.Val("result") {
			t.Errorf("%s:\n Go   %s\n Node %s", name, got, want.Val("result"))
		}
	}
	bao := func(opts *omap.Map) func() (any, error) {
		return func() (any, error) { return s.BaoCaoNhapSP(bg, sup, opts) }
	}
	daGui := func() (any, error) { return s.DaGuiHomNay(bg), nil }

	step("ky 2031 dryRun", bao(omap.Of("tuVN", tuVN, "dryRun", true)))
	step("ky sau moi dong", bao(omap.Of("tuVN", "2032-01-01T00:00:00.000Z")))
	step("daGui truoc khi gui", daGui)
	step("ky 2031 gui that", bao(omap.Of("tuVN", tuVN)))
	if got, want := js(t, strs(hook.sent())), js(t, golden.Val("bodies")); got != want {
		t.Errorf("thẻ gửi Lark:\n Go   %s\n Node %s", got, want)
	}
	au, err := db.Select(bg, "audit_log", database.SelectOpt{Filter: "action=eq.bao_cao_nhap_sp", Order: "id.desc", Limit: 1, NoScope: true})
	if err != nil {
		t.Fatal(err)
	}
	var auOut []any
	for _, r := range au {
		auOut = append(auOut, omap.Of("username", r.Val("username"), "action", r.Val("action"), "detail", r.Val("detail"),
			"cong_ty_id", r.Val("cong_ty_id"), "user_id", r.Val("user_id")))
	}
	if got, want := js(t, auOut), js(t, golden.Val("audit")); got != want {
		t.Errorf("dòng audit:\n Go   %s\n Node %s", got, want)
	}
	step("daGui sau khi gui", daGui)

	sweep()
	gieo()
	for _, x := range jsval.AsArray(seed.Val("audits")) {
		a := jsval.AsMap(x)
		note := jsval.AsString(a.Val("note"))
		if _, err := db.Insert(bg, "audit_log", []*omap.Map{omap.Of("username", "hệ thống", "action", baoCaoAction,
			"detail", "ZZ_reports_ "+note, "created_at", a.Val("at"))}, database.Opt{NoScope: true}); err != nil {
			t.Fatal(err)
		}
		for _, c := range jsval.AsArray(a.Val("checks")) {
			at(jsval.AsString(c))
			step("daGui "+note+" @"+jsval.AsString(c), daGui)
		}
		if _, err := pool.Exec(bg, jsval.AsString(jsval.AsArray(seed.Val("sweep"))[1])); err != nil {
			t.Fatal(err)
		}
	}
	at(jsval.AsString(seed.Val("now")))
	step("ky mac dinh (theo dong ho) dryRun", bao(omap.Of("dryRun", true)))
	flt.on = true
	step("du lieu co san dryRun", bao(omap.Of("tuVN", "2026-01-01T00:00:00.000Z", "dryRun", true)))
	step("du lieu co san tu 2026-10-01 dryRun", bao(omap.Of("tuVN", "2026-10-01T08:00:00.000Z", "dryRun", true)))
	flt.on = false
	if n != len(steps) {
		t.Errorf("Go chạy %d bước, Node chạy %d", n, len(steps))
	}
}
