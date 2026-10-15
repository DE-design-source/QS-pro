package purchasing

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"

	"qspro-backend/internal/config"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/goonly"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

/* Đối chiếu với Node trên database thật: chạy các bước của testdata/dbdiff-cases.json qua cổng rpc (RegisterRPC)
   trên qspro_gotest và so từng dòng với testdata/dbdiff-golden.txt - kết quả của testdata/dbdiff-node.js chạy CÙNG
   các bước qua mã Node trên qspro_nodetest. Webhook Lark là máy chủ giả tại chỗ; thân request (thẻ JSON) được so từng byte.
   Phụ thuộc chéo là bản giả ghi lại lời gọi: bên Node đọc lại audit_log / notifications thật để so. */

var (
	reUUID    = regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	reTS      = regexp.MustCompile(`\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d(:\d\d)?)?`)
	reStamp   = regexp.MustCompile(`· \d\d/\d\d/\d{4}`)
	reFailRow = regexp.MustCompile(`Failing row contains \(\d+,`)
	reMaArg   = regexp.MustCompile(`^\$ma:\d+$`)
	reNetErr  = regexp.MustCompile(`(lỗi:) .*$`)
)

// Cột chỉ bản Go (migration 0009, M15.1: purchase_orders.resolver_name / resolved_at = don_mua_hang.nguoi_duyet /
// ngay_duyet): golden Node không có -> bỏ khỏi dòng don_mua_hang đọc lại và khỏi chi tiết lỗi "Failing row contains"
// trước khi so (backend/docs/ARCHITECTURE.md 10.4). CHỈ áp cho dòng đơn mua: de_xuat có sẵn nguoi_duyet / ngay_duyet
// từ trước và golden có chúng. Đơn đã được resolvePurchaseRequest duyệt / từ chối thành công: khẳng định riêng (goCheck)
// người duyệt = ho_ten || username của người thao tác và có thời điểm, rồi mới bỏ hai khoá; mọi đơn khác chỉ bỏ khi null
// (goonly.StripNull) nên ghi nhầm vẫn bị phép so bắt.
// Khoá kết quả chỉ bản Go nối cuối (getPurchaseOrders: nguoiDuyet, ngayDuyet, ketQuaGui; getPurchaseOrder: kenhGui,
// ketQuaGui; listPurchaseRequests: resolver, resolvedAt) cũng được khẳng định rồi bỏ. Cột ket_qua_gui (M9.1) bản Go ghi
// lại "ok" / "loi" sau khi gửi thẻ: khẳng định đúng theo trả lời của webhook giả, rồi đặt lại giá trị lúc lưu như Node.
var (
	goOnlyKeys = []string{"nguoi_duyet", "ngay_duyet"}
	goOnlyCols = map[string]int{"purchase_orders": 2}
)

type masker struct{ ids, mas map[string]string }

func (m *masker) mask(s string) string {
	s = reUUID.ReplaceAllStringFunc(s, func(u string) string {
		if _, ok := m.ids[u]; !ok {
			m.ids[u] = "<id" + strconv.Itoa(len(m.ids)+1) + ">"
		}
		return m.ids[u]
	})
	s = reMa.ReplaceAllStringFunc(s, func(u string) string {
		if _, ok := m.mas[u]; !ok {
			m.mas[u] = "<ma" + strconv.Itoa(len(m.mas)+1) + ">"
		}
		return m.mas[u]
	})
	s = reTS.ReplaceAllString(s, "<ts>")
	s = reStamp.ReplaceAllString(s, "· <stamp>")
	return reFailRow.ReplaceAllString(s, "Failing row contains (<n>,")
}

// dbUsers: contracts.UserReader đọc thẳng bảng users của database thử (như getUserById, A:212-215).
type dbUsers struct{ db *database.DB }

func (u dbUsers) GetByID(ctx context.Context, id any) (*omap.Map, error) {
	return first(u.db.Select(ctx, "users", database.SelectOpt{Filter: database.Eq("id", id), Limit: 1, NoScope: true}))
}

var hookReplies = map[string]struct {
	status int
	body   string
}{
	"ok":      {200, `{"code":0,"msg":"success"}`},
	"status0": {200, `{"StatusCode":0,"StatusMessage":"success"}`},
	"msg":     {200, `{"code":19001,"msg":"param invalid"}`},
	"text":    {502, `oops`},
}

func strip(rows []*omap.Map) []any {
	out := make([]any, len(rows))
	for i, r := range rows {
		c := r.Clone()
		c.Delete("id")
		out[i] = c
	}
	return out
}

func TestDBDiff(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	spec := loadJSON(t, "dbdiff-cases.json")
	actorName, prefix := jsval.AsString(spec.Val("actorName")), jsval.AsString(spec.Val("prefix"))

	db := database.New(database.Config{URL: url})
	defer db.Close()
	bg := context.Background()
	no := database.Opt{NoScope: true}
	sel := func(table, filter, order string) []*omap.Map {
		t.Helper()
		rows, err := db.Select(bg, table, database.SelectOpt{Filter: filter, Order: order, NoScope: true})
		if err != nil {
			t.Fatalf("đọc %s: %v", table, err)
		}
		return rows
	}

	// Người thao tác = tài khoản có sẵn trong bộ dữ liệu gốc mà dbdiff-node.js đã chọn (id nhỏ nhất). Tài khoản thử của
	// package khác (zz_...) chạy cùng lúc trên database này có thể có id nhỏ hơn: phải loại ra, nếu không tên người
	// duyệt / công ty trong kết quả sẽ lệch với bản Node.
	us, err := db.Select(bg, "users", database.SelectOpt{Filter: "cong_ty_id=not.is.null&active=is.true&username=not.ilike.zz*",
		Order: "id.asc", Limit: 1, NoScope: true})
	if err != nil || len(us) == 0 {
		t.Fatalf("database thử không có tài khoản nào thuộc công ty: %v", err)
	}
	a := &actor.Actor{UID: us[0].Val("id"), U: actorName, R: "admin", CT: us[0].Val("cong_ty_id")}
	resolverName := jsval.S(jsval.Or(us[0].Val("ho_ten"), us[0].Val("username")))
	gc := &goCheck{t: t, resolver: resolverName, ketQua: map[string][2]string{}, resolved: map[string]bool{}}
	ctx := tenant.With(bg, tenant.Ctx{UID: a.UID, Role: a.R, CongTyID: a.CT})
	like := "ma_du_an=like." + prefix + "*"
	inList := func(col string, rows []*omap.Map, key string) string {
		xs := make([]string, len(rows))
		for i, r := range rows {
			xs[i] = jsval.S(r.Val(key))
		}
		return col + "=in.(" + strings.Join(xs, ",") + ")"
	}

	cleanup := func() {
		po, dx := sel(tblDon, like, ""), sel(tblDeXuat, like, "")
		rm := func(table, filter string) {
			if _, err := db.Remove(bg, table, filter, no); err != nil {
				t.Errorf("dọn %s: %v", table, err)
			}
		}
		if len(po) > 0 {
			rm(tblDonCT, inList("ma_don", po, "ma_don"))
		}
		if len(dx) > 0 {
			rm(tblDxCK, inList("ma_de_xuat", dx, "ma_de_xuat"))
			rm(tblDxTT, inList("ma_de_xuat", dx, "ma_de_xuat"))
		}
		rm(tblDon, like)
		rm(tblDeXuat, like)
	}
	cleanup()
	defer cleanup()

	// máy chủ webhook giả. Handler chạy ở goroutine của httptest: chế độ trả lời (hook) và request nhận được (got)
	// đi qua khoá, test chỉ đọc / ghi bằng setHook, takeGot.
	var hookMu sync.Mutex
	hookMode := "ok"
	var hookGot any
	setHook := func(mode string) {
		hookMu.Lock()
		hookMode, hookGot = mode, nil
		hookMu.Unlock()
	}
	takeGot := func() any {
		hookMu.Lock()
		defer hookMu.Unlock()
		return hookGot
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		hookMu.Lock()
		hookGot = omap.Of("method", r.Method, "ct", r.Header.Get("Content-Type"), "body", string(b))
		hook := hookMode
		hookMu.Unlock()
		if hook == "drop" {
			if c, _, err := w.(http.Hijacker).Hijack(); err == nil {
				_ = c.Close()
			}
			return
		}
		rep := hookReplies[hook]
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(rep.status)
		_, _ = io.WriteString(w, rep.body)
	}))
	defer srv.Close()

	pn, nt, au := &fakePN{}, &fakeNotifier{}, &fakeAudit{}
	svc := New(Deps{DB: db, Cfg: &config.Config{PurchaseWebhook: srv.URL + "/hook"}, PurchaseNotifier: pn, Notifier: nt,
		Users: dbUsers{db}, Auditor: au})
	reg := rpc.NewRegistry()
	svc.RegisterRPC(reg)

	mas := []string{}
	var fill func(v any) any
	fill = func(v any) any {
		switch x := v.(type) {
		case string:
			if reMaArg.MatchString(x) {
				if i, _ := strconv.Atoi(x[4:]); i < len(mas) {
					return mas[i]
				}
				return "MISSING"
			}
		case []any:
			out := make([]any, len(x))
			for i, it := range x {
				out[i] = fill(it)
			}
			return out
		case *omap.Map:
			out := omap.New()
			x.Each(func(k string, it any) { out.Set(k, fill(it)) })
			return out
		}
		return v
	}

	mk := &masker{ids: map[string]string{}, mas: map[string]string{}}
	var lines []string
	emit := func(name string, v any) {
		s, err := omap.MarshalString(v)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		lines = append(lines, name+"\t"+mk.mask(goonly.StripFailingRow(s, goOnlyCols)))
	}

	for _, stV := range jsval.AsArray(spec.Val("steps")) {
		st := jsval.AsMap(stV)
		name := jsval.AsString(st.Val("n"))
		switch st.Val("dump") {
		case "orders":
			heads := sel(tblDon, like, "id.asc")
			items := []*omap.Map{}
			if len(heads) > 0 {
				items = sel(tblDonCT, inList("ma_don", heads, "ma_don"), "id.asc")
			}
			emit(name, omap.Of("heads", goonly.StripNull(gc.heads(name, strip(heads)), goOnlyKeys...), "items", strip(items)))
			continue
		case "proposals":
			heads := sel(tblDeXuat, like, "id.asc")
			ck, tt := []*omap.Map{}, []*omap.Map{}
			if len(heads) > 0 {
				f := inList("ma_de_xuat", heads, "ma_de_xuat")
				ck, tt = sel(tblDxCK, f, "id.asc"), sel(tblDxTT, f, "id.asc")
			}
			emit(name, omap.Of("heads", strip(heads), "ck", strip(ck), "tt", strip(tt)))
			continue
		}
		hook := "ok"
		if h := jsval.AsString(st.Val("hook")); h != "" {
			hook = h
		}
		setHook(hook)
		pn.recs, nt.recs, au.recs = []any{}, []any{}, []any{}
		pn.err = nil
		if jsval.Truthy(st.Val("notifyFail")) {
			pn.err = errString("ZZ notify boom")
		}
		fn := jsval.AsString(st.Val("fn"))
		args := jsval.AsArray(fill(st.Val("args")))
		var res any
		var err error
		logs := captureLog(t, func() { res, err = reg.Call(ctx, fn, a, args...) })
		if err != nil {
			emit(name, omap.Of("err", err.Error()))
		} else {
			gc.track(fn, hook, args, res)
			for _, m := range jsval.AsArray(jsval.Get(res, "saved")) {
				mas = append(mas, jsval.S(m))
			}
			if fn == "sendDeXuat" && jsval.Truthy(jsval.Get(res, "ma")) {
				mas = append(mas, jsval.S(jsval.Get(res, "ma")))
			}
			if key := jsval.AsString(st.Val("onlyPrefix")); key != "" {
				keep := []any{}
				for _, r := range res.([]any) {
					if strings.Contains(jsval.ToString(jsval.Get(r, key)), prefix) {
						keep = append(keep, r)
					}
				}
				res = keep
			}
			if jsval.IsUndefined(res) {
				res = nil
			}
			gc.result(name, fn, res)
			emit(name, omap.Of("ok", res))
		}
		emit(name+"#audit", au.recs)
		emit(name+"#notif", nt.recs)
		emit(name+"#admins", pn.recs)
		emit(name+"#hook", takeGot())
		outLogs := make([]any, len(logs))
		for i, l := range logs {
			if hook == "drop" {
				l = reNetErr.ReplaceAllString(l, "${1} <net>")
			}
			outLogs[i] = l
		}
		emit(name+"#log", outLogs)
	}

	if out := os.Getenv("PURCHASING_DIFF_OUT"); out != "" {
		_ = os.MkdirAll(filepath.Dir(out), 0o755)
		_ = os.WriteFile(out, []byte(strings.Join(lines, "\n")+"\n"), 0o644)
	}

	gf, err := os.Open(filepath.Join("testdata", "dbdiff-golden.txt"))
	if err != nil {
		t.Fatal(err)
	}
	defer gf.Close()
	var want []string
	sc := bufio.NewScanner(gf)
	sc.Buffer(make([]byte, 1<<20), 64<<20)
	for sc.Scan() {
		if ln := strings.TrimRight(sc.Text(), "\r"); ln != "" {
			want = append(want, ln)
		}
	}
	if len(lines) != len(want) {
		t.Errorf("số dòng: go %d, node %d", len(lines), len(want))
	}
	bad := 0
	for i := 0; i < len(lines) && i < len(want); i++ {
		if lines[i] != want[i] {
			bad++
			if bad <= 8 {
				t.Errorf("khác ở dòng %d:\n go:   %s\n node: %s", i+1, clip(lines[i], want[i]), clip(want[i], lines[i]))
			}
		}
	}
	if bad == 0 && len(lines) == len(want) {
		t.Logf("khớp Node: %d dòng (%d bước)", len(lines), len(jsval.AsArray(spec.Val("steps"))))
	}
}

// goCheck: khẳng định giá trị của cột / khoá chỉ bản Go rồi bỏ chúng (hoặc trả về giá trị Node) trước khi so với golden.
type goCheck struct {
	t        *testing.T
	resolver string
	ketQua   map[string][2]string // mã đơn -> {giá trị bản Go phải ghi, giá trị lúc lưu như Node}
	resolved map[string]bool      // mã đơn đã duyệt / từ chối thành công
}

// track ghi nhận bước thành công: đơn vừa gửi (kết quả gửi Lark mong đợi) và đơn vừa xử lý.
func (g *goCheck) track(fn, hook string, args []any, res any) {
	switch fn {
	case "sendPurchaseRequest":
		// "ok" chỉ khi webhook giả trả thành công VÀ thẻ dựng được (res.lark); ngược lại "loi"
		want := kqGuiLoi
		if jsval.Get(res, "lark") == true {
			want = kqGuiOk
			if hook != "ok" && hook != "status0" {
				g.errorf(fn, "lark = true khi webhook giả trả %q", hook)
			}
		}
		var arg0 any
		if len(args) > 0 {
			arg0 = args[0]
		}
		orig := "pending"
		if k := jsval.S(jsval.Get(jsval.AsMap(arg0), "ketQua")); k != "" {
			orig = k
		}
		for _, m := range jsval.AsArray(jsval.Get(res, "saved")) {
			g.ketQua[jsval.S(m)] = [2]string{want, orig}
		}
	case "resolvePurchaseRequest":
		if len(args) > 0 {
			g.resolved[jsval.S(args[0])] = true
		}
	}
}

func (g *goCheck) errorf(step, format string, a ...any) {
	g.t.Helper()
	g.t.Errorf(step+": "+format, a...)
}

// heads: dòng don_mua_hang đọc lại.
func (g *goCheck) heads(step string, rows []any) []any {
	for _, r := range rows {
		m := r.(*omap.Map)
		ma := jsval.S(m.Val("ma_don"))
		if kq, ok := g.ketQua[ma]; ok {
			if got := jsval.S(m.Val("ket_qua_gui")); got != kq[0] {
				g.errorf(step, "%s ket_qua_gui = %q, muốn %q", ma, got, kq[0])
			}
			m.Set("ket_qua_gui", kq[1])
		}
		if g.resolved[ma] {
			if got := jsval.S(m.Val("nguoi_duyet")); got != g.resolver || !jsval.Truthy(m.Val("ngay_duyet")) {
				g.errorf(step, "%s nguoi_duyet = %q (muốn %q), ngay_duyet = %v", ma, got, g.resolver, m.Val("ngay_duyet"))
			}
			m.Delete("nguoi_duyet")
			m.Delete("ngay_duyet")
		}
	}
	return rows
}

// result: khoá kết quả chỉ bản Go của các hàm đọc đơn.
func (g *goCheck) result(step, fn string, res any) {
	pop := func(m *omap.Map, k string) any {
		if !m.Has(k) {
			g.errorf(step, "thiếu khoá %s", k)
		}
		v := m.Val(k)
		m.Delete(k)
		return v
	}
	each := func(f func(m *omap.Map)) {
		if m := jsval.AsMap(res); m != nil {
			f(m)
			return
		}
		for _, r := range jsval.AsArray(res) {
			f(jsval.AsMap(r))
		}
	}
	switch fn {
	case "getPurchaseOrders":
		each(func(m *omap.Map) {
			ma := jsval.S(m.Val("maDon"))
			nd, ngay, kq := pop(m, "nguoiDuyet"), pop(m, "ngayDuyet"), pop(m, "ketQuaGui")
			if want, ok := g.ketQua[ma]; ok && kq != want[0] {
				g.errorf(step, "%s ketQuaGui = %v, muốn %q", ma, kq, want[0])
			}
			if g.resolved[ma] != (nd == g.resolver && ngay != "") || (!g.resolved[ma] && (nd != "" || ngay != "")) {
				g.errorf(step, "%s nguoiDuyet = %v ngayDuyet = %v (đã xử lý: %v)", ma, nd, ngay, g.resolved[ma])
			}
		})
	case "listPurchaseRequests":
		each(func(m *omap.Map) {
			ma := jsval.S(m.Val("maDon"))
			rs, at := pop(m, "resolver"), pop(m, "resolvedAt")
			if g.resolved[ma] != (rs == g.resolver && jsval.Truthy(at)) || (!g.resolved[ma] && (rs != nil || at != nil)) {
				g.errorf(step, "%s resolver = %v resolvedAt = %v (đã xử lý: %v)", ma, rs, at, g.resolved[ma])
			}
		})
	case "getPurchaseOrder":
		each(func(m *omap.Map) {
			ma := jsval.S(m.Val("maDon"))
			kenh, kq := pop(m, "kenhGui"), pop(m, "ketQuaGui")
			if want, ok := g.ketQua[ma]; !ok || kq != want[0] || kenh != "Lark" {
				g.errorf(step, "%s kenhGui = %v ketQuaGui = %v (muốn %v)", ma, kenh, kq, want)
			}
		})
	}
}

type errString string

func (e errString) Error() string { return string(e) }

// clip cắt quanh chỗ khác nhau đầu tiên để dòng dài vẫn đọc được.
func clip(s, other string) string {
	i := 0
	for i < len(s) && i < len(other) && s[i] == other[i] {
		i++
	}
	from := i - 200
	if from < 0 {
		from = 0
	}
	to := i + 400
	if to > len(s) {
		to = len(s)
	}
	return "…" + strings.ToValidUTF8(s[from:to], "?") + "…"
}
