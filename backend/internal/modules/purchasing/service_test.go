package purchasing

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/config"
	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

/* Giá trị mong đợi trong testdata/golden.json do testdata/gen.js sinh từ MÃ NODE THẬT (server/index.js, server/store_supa.js)
   với đầu vào testdata/pure-cases.json. */

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

var fixedNow = time.Date(2026, 1, 5, 10, 0, 0, 0, time.Local)

func TestPureGolden(t *testing.T) {
	cases, gold := loadJSON(t, "pure-cases.json"), loadJSON(t, "golden.json")
	arr := func(m *omap.Map, k string) []any { return jsval.AsArray(m.Val(k)) }
	check := func(name string, i int, got, want any) {
		t.Helper()
		g, _ := omap.MarshalString(got)
		w, _ := omap.MarshalString(want)
		if g != w {
			t.Errorf("%s[%d]:\n go:   %s\n node: %s", name, i, g, w)
		}
	}
	cardRes := func(c *omap.Map, err error) any {
		if err != nil {
			return omap.Of("err", err.Error())
		}
		s, _ := omap.MarshalString(c)
		return omap.Of("json", s)
	}

	for i, v := range arr(cases, "fmtVN") {
		check("fmtVN", i, fmtVN(v), arr(gold, "fmtVN")[i])
	}
	for i, v := range arr(cases, "purchaseCards") {
		check("purchaseCards", i, cardRes(buildPurchaseCard(v, fixedNow)), arr(gold, "purchaseCards")[i])
	}
	for i, v := range arr(cases, "deXuatCards") {
		c := jsval.AsArray(v)
		check("deXuatCards", i, cardRes(buildDeXuatCard(c[0], c[1], fixedNow)), arr(gold, "deXuatCards")[i])
	}
	for i, v := range arr(cases, "thieuBang") {
		check("thieuBang", i, dxThieuBang(errors.New(jsval.AsString(v))), arr(gold, "thieuBang")[i])
	}
	for i, v := range arr(cases, "dxBang") {
		check("dxBang", i, dxBang(v), arr(gold, "dxBang")[i])
	}
	for i, v := range arr(cases, "dxHead") {
		s, _ := omap.MarshalString(dxHead(jsval.AsMap(v)))
		check("dxHead", i, s, arr(gold, "dxHead")[i])
	}
	for i, v := range arr(cases, "dxItem") {
		s, _ := omap.MarshalString(dxItem(jsval.AsMap(v)))
		check("dxItem", i, s, arr(gold, "dxItem")[i])
	}
	for _, k := range []string{"maDon", "maCK", "maTT"} {
		if gold.Val(k) != true {
			t.Errorf("golden %s: mã Node không còn theo mẫu đã ghi", k)
		}
	}
}

func TestGenMa(t *testing.T) {
	s := New(Deps{Repo: &fakeRepo{}})
	for want, got := range map[string]string{
		`^MH-[0-9A-Z]+-\d{1,4}$`: s.genMaDon(), `^CK-[0-9A-Z]+-\d{1,4}$`: s.genMaDeXuat("ck"), `^TT-[0-9A-Z]+-\d{1,4}$`: s.genMaDeXuat("tt"),
	} {
		if !regexp.MustCompile(want).MatchString(got) {
			t.Errorf("mã %q không khớp %s", got, want)
		}
	}
	// node -e "console.log((1760000000000).toString(36).toUpperCase(), Math.floor(0.98765*1e4), Math.floor(0.00009*1e4))" -> MGJ6K3CW 9876 0
	s.now = func() time.Time { return time.UnixMilli(1760000000000) }
	s.rnd = func() float64 { return 0.98765 }
	if got := s.genMaDon(); got != "MH-MGJ6K3CW-9876" {
		t.Errorf("genMaDon = %s", got)
	}
	s.rnd = func() float64 { return 0.00009 }
	if got := s.genMaDeXuat("x"); got != "CK-MGJ6K3CW-0" {
		t.Errorf("genMaDeXuat = %s", got)
	}
}

func TestStampLocal(t *testing.T) {
	if got := stamp(time.Date(2026, 12, 31, 23, 59, 0, 0, time.Local)); got != "31/12/2026" {
		t.Errorf("stamp = %s", got)
	}
}

// ───────────── kho giả + phụ thuộc giả ─────────────

type fakeRepo struct {
	calls                 []string
	failOrderItems        error
	failProposal          error
	failProposalItems     error
	failDelete            error
	failList              error
	failOrder             error
	orders                []*omap.Map
	proposals, orderItems []*omap.Map
	ins                   []any // mọi lần chèn theo thứ tự: {t: bảng, rows: [...]}
}

func (f *fakeRepo) rec(table string, rows ...*omap.Map) {
	list := make([]any, len(rows))
	for i, r := range rows {
		list[i] = r
	}
	f.ins = append(f.ins, omap.Of("t", table, "rows", list))
}

func (f *fakeRepo) log(s string) { f.calls = append(f.calls, s) }

func (f *fakeRepo) InsertOrder(_ context.Context, row *omap.Map) error {
	f.log("insertOrder " + jsval.S(row.Val("nha_cung_cap")))
	f.rec("don_mua_hang", row)
	if f.failOrder != nil {
		return f.failOrder
	}
	f.orders = append(f.orders, row)
	return nil
}
func (f *fakeRepo) InsertOrderItems(_ context.Context, rows []*omap.Map) error {
	f.log("insertItems")
	f.rec("chi_tiet_mua_hang", rows...)
	f.orderItems = append(f.orderItems, rows...)
	return f.failOrderItems
}
func (f *fakeRepo) DeleteOrder(_ context.Context, maDon any) error {
	f.log("deleteOrder " + maMask(jsval.S(maDon)))
	return f.failDelete
}
func (f *fakeRepo) OrdersOfProject(context.Context, any) ([]*omap.Map, error) { return f.orders, nil }
func (f *fakeRepo) OrderItems(context.Context, any) ([]*omap.Map, error)      { return nil, nil }
func (f *fakeRepo) ListOrders(context.Context) ([]*omap.Map, error)           { return f.orders, nil }
func (f *fakeRepo) OrderByCode(context.Context, any) (*omap.Map, error)       { return nil, nil }
func (f *fakeRepo) UpdateOrderStatus(_ context.Context, _ any, from string, _ any) (int, error) {
	f.log("updateStatus from " + from)
	return 0, nil
}
func (f *fakeRepo) InsertProposal(_ context.Context, row *omap.Map) error {
	f.log("insertProposal")
	f.rec("de_xuat", row)
	f.proposals = append(f.proposals, row)
	return f.failProposal
}
func (f *fakeRepo) InsertProposalItems(_ context.Context, table string, rows []*omap.Map) error {
	f.log("insertProposalItems " + table)
	f.rec(table, rows...)
	return f.failProposalItems
}
func (f *fakeRepo) DeleteProposal(context.Context, any) error {
	f.log("deleteProposal")
	return f.failDelete
}
func (f *fakeRepo) ProposalsOfProject(context.Context, any) ([]*omap.Map, error) {
	return nil, f.failList
}
func (f *fakeRepo) ProposalItems(context.Context, string, any) ([]*omap.Map, error) { return nil, nil }
func (f *fakeRepo) ListProposals(context.Context, any) ([]*omap.Map, error)         { return nil, f.failList }
func (f *fakeRepo) ProposalByCode(context.Context, any) (*omap.Map, error)          { return nil, nil }
func (f *fakeRepo) ResolveProposal(context.Context, any, *omap.Map) (int, error)    { return 0, nil }

var reMa = regexp.MustCompile(`(MH|CK|TT)-[0-9A-Z]+-\d+`)

func maMask(s string) string { return reMa.ReplaceAllString(s, "<ma>") }

type fakePN struct {
	recs []any
	err  error
}

func (f *fakePN) NotifyPurchaseAdmins(_ context.Context, a *actor.Actor, orders []any) error {
	f.recs = append(f.recs, omap.Of("fn", "notifyPurchaseAdmins", "uid", uidOf(a), "arg", orders))
	return f.err
}
func (f *fakePN) NotifyDeXuatAdmins(_ context.Context, a *actor.Actor, dx *omap.Map) error {
	f.recs = append(f.recs, omap.Of("fn", "notifyDeXuatAdmins", "uid", uidOf(a), "arg", dx))
	return f.err
}
func (f *fakePN) DeXuatTen(loai string) string {
	switch loai {
	case "ck":
		return "đề xuất chiết khấu"
	case "tt":
		return "đề xuất thanh toán"
	}
	return "đề xuất"
}

type fakeNotifier struct{ recs []any }

func (f *fakeNotifier) Notify(_ context.Context, userID any, kind, title, body string, refID any) {
	if !jsval.Truthy(userID) {
		return
	}
	f.recs = append(f.recs, omap.Of("user_id", userID, "kind", kind, "title", title, "body", body,
		"ref_id", jsval.Or(refID, nil), "is_read", false))
}

type fakeAudit struct{ recs []any }

func (f *fakeAudit) Audit(_ context.Context, a *actor.Actor, action, detail string, _ any) {
	var uid any
	user := ""
	if a != nil {
		uid, user = jsval.Or(a.UID, nil), a.U
	}
	f.recs = append(f.recs, omap.Of("user_id", uid, "username", user, "action", action, "detail", detail))
}

type fakeUsers struct{ row *omap.Map }

func (f fakeUsers) GetByID(context.Context, any) (*omap.Map, error) { return f.row, nil }

var testActor = &actor.Actor{UID: "u-1", U: "mai", R: "admin"}

// captureLog: gom các dòng log của logger dùng chung trong lúc chạy fn.
func captureLog(t *testing.T, fn func()) []string {
	t.Helper()
	var buf bytes.Buffer
	old := logger.L()
	logger.SetDefault(logger.New(&buf, &buf))
	defer logger.SetDefault(old)
	fn()
	out := []string{}
	for _, ln := range strings.Split(buf.String(), "\n") {
		if ln != "" {
			out = append(out, ln)
		}
	}
	return out
}

func unitSvc(repo *fakeRepo, url string) (*Service, *fakePN, *fakeNotifier, *fakeAudit) {
	pn, nt, au := &fakePN{}, &fakeNotifier{}, &fakeAudit{}
	var cfg *config.Config
	if url != "" {
		cfg = &config.Config{PurchaseWebhook: url}
	}
	return New(Deps{Repo: repo, Cfg: cfg, PurchaseNotifier: pn, Notifier: nt, Users: fakeUsers{}, Auditor: au}), pn, nt, au
}

// Lỗi giữa chừng: gỡ mọi phiếu của lần gửi (kể cả phiếu đang dở), lỗi xoá bị nuốt, trả đúng lỗi gốc (S:1184-1189).
func TestSavePurchaseOrderRollback(t *testing.T) {
	boom := errors.New("DB POST chi_tiet_mua_hang -> 400 {}")
	repo := &fakeRepo{failOrderItems: boom, failDelete: errors.New("xoá hỏng")}
	s, _, _, _ := unitSvc(repo, "")
	order := omap.Of("orders", []any{
		omap.Of("supplier", "A"),
		omap.Of("supplier", "B", "items", []any{omap.Of("sl", 1.0)}),
		omap.Of("supplier", "C"),
	})
	if _, err := s.SavePurchaseOrder(context.Background(), order); err != boom {
		t.Fatalf("err = %v", err)
	}
	want := "insertOrder A|insertOrder B|insertItems|deleteOrder <ma>|deleteOrder <ma>"
	if got := strings.Join(repo.calls, "|"); got != want {
		t.Errorf("calls = %s", got)
	}

	// phần tử null: mã đã sinh nhưng chưa chèn gì -> vẫn gọi xoá mã đang dở, lỗi là TypeError của V8
	repo = &fakeRepo{}
	s, _, _, _ = unitSvc(repo, "")
	_, err := s.SavePurchaseOrder(context.Background(), omap.Of("orders", []any{nil}))
	if err == nil || err.Error() != "Cannot read properties of null (reading 'items')" {
		t.Errorf("err = %v", err)
	}
	if got := strings.Join(repo.calls, "|"); got != "deleteOrder <ma>" {
		t.Errorf("calls = %s", got)
	}
}

func TestSaveDeXuatErrors(t *testing.T) {
	// thiếu bảng -> thông báo hướng dẫn; lỗi khác giữ nguyên
	repo := &fakeRepo{failProposal: errors.New(`DB POST de_xuat -> 404 {"code":"PGRST205","message":"Could not find the table 'public.de_xuat' in the schema cache"}`)}
	s, _, _, _ := unitSvc(repo, "")
	_, err := s.SaveDeXuat(context.Background(), omap.New())
	if want := `Chưa có bảng "de_xuat" trong CSDL. Hãy chạy "npm run migrate" rồi khởi động lại server.`; err == nil || err.Error() != want {
		t.Errorf("err = %v", err)
	}
	other := errors.New(`DB POST de_xuat -> 400 {"code":"23514"}`)
	repo = &fakeRepo{failProposal: other}
	s, _, _, _ = unitSvc(repo, "")
	if _, err := s.SaveDeXuat(context.Background(), nil); err != other {
		t.Errorf("err = %v", err)
	}
	// dòng chi tiết hỏng -> xoá phiếu đầu (lỗi xoá bị nuốt), trả lỗi gốc
	boom := errors.New("DB POST chi_tiet_de_xuat_tt -> 400 {}")
	repo = &fakeRepo{failProposalItems: boom, failDelete: errors.New("x")}
	s, _, _, _ = unitSvc(repo, "")
	_, err = s.SaveDeXuat(context.Background(), omap.Of("loai", "tt", "dots", []any{omap.Of("tien", 5.0)}))
	if err != boom || strings.Join(repo.calls, "|") != "insertProposal|insertProposalItems chi_tiet_de_xuat_tt|deleteProposal" {
		t.Errorf("err = %v, calls = %v", err, repo.calls)
	}
}

func TestDeXuatListErrors(t *testing.T) {
	ctx := context.Background()
	missing := errors.New(`DB GET de_xuat -> 404 {"code":"PGRST205"}`)
	denied := errors.New(`DB GET de_xuat -> 403 {"code":"42501","message":"permission denied"}`)
	other := errors.New("connect ECONNREFUSED")

	s, _, _, _ := unitSvc(&fakeRepo{failList: missing}, "")
	if r, err := s.GetDeXuatList(ctx, "x"); err != nil || r == nil || len(r) != 0 {
		t.Errorf("getDeXuatList thiếu bảng: %v %v", r, err)
	}
	if r, err := s.ListDeXuat(ctx, testActor, nil); err != nil || r == nil || len(r) != 0 {
		t.Errorf("listDeXuat thiếu bảng: %v %v", r, err)
	}
	s, _, _, _ = unitSvc(&fakeRepo{failList: denied}, "")
	if _, err := s.GetDeXuatList(ctx, "x"); err != denied {
		t.Errorf("getDeXuatList chỉ nuốt lỗi thiếu bảng: %v", err)
	}
	if r, err := s.ListDeXuat(ctx, testActor, nil); err != nil || len(r) != 0 {
		t.Errorf("listDeXuat nuốt mọi lỗi có chữ de_xuat: %v %v", r, err)
	}
	s, _, _, _ = unitSvc(&fakeRepo{failList: other}, "")
	if _, err := s.ListDeXuat(ctx, testActor, nil); err != other {
		t.Errorf("listDeXuat lỗi khác: %v", err)
	}
}

// node -e "const P={'Đã đặt hàng':'Đã duyệt','Đã nhận hàng':'Đã đặt hàng'};for(const k of ['x','constructor','toString','__proto__',null])
//
//	console.log(P[k]?'Đơn phải ở trạng thái \"'+P[k]+'\" mới chuyển sang \"'+k+'\"':'Trạng thái không hợp lệ')"
func TestSetPurchaseStatusKeys(t *testing.T) {
	repo := &fakeRepo{}
	s, _, _, au := unitSvc(repo, "")
	for status, want := range map[string]string{
		"x":            "Trạng thái không hợp lệ",
		"Đã duyệt":     "Trạng thái không hợp lệ",
		"constructor":  `Đơn phải ở trạng thái "function Object() { [native code] }" mới chuyển sang "constructor"`,
		"toString":     `Đơn phải ở trạng thái "function toString() { [native code] }" mới chuyển sang "toString"`,
		"__proto__":    `Đơn phải ở trạng thái "[object Object]" mới chuyển sang "__proto__"`,
		"Đã nhận hàng": `Đơn phải ở trạng thái "Đã đặt hàng" mới chuyển sang "Đã nhận hàng"`,
	} {
		_, err := s.SetPurchaseStatus(context.Background(), testActor, "MH-1", status)
		if err == nil || err.Error() != want {
			t.Errorf("%s: %v", status, err)
		}
	}
	for _, v := range []any{nil, jsval.Undefined, 5.0, true} {
		if _, err := s.SetPurchaseStatus(context.Background(), testActor, "MH-1", v); err == nil || err.Error() != "Trạng thái không hợp lệ" {
			t.Errorf("%v: %v", v, err)
		}
	}
	if len(au.recs) != 0 {
		t.Errorf("không được ghi audit khi không đổi được: %v", au.recs)
	}
}

// Webhook: cách nhận biết thành công và dòng cảnh báo (I:289-292, 314-317).
func TestPostCard(t *testing.T) {
	type tc struct {
		status   int
		body     string
		ok       bool
		wantWarn string
	}
	cases := []tc{
		{200, `{"code":0,"msg":"success"}`, true, ""},
		{200, `{"StatusCode":0,"StatusMessage":"success"}`, true, ""},
		{400, `{"msg":"success"}`, true, ""},
		{200, `{"code":"0"}`, false, "HTTP 200"},
		{200, `{"code":19001,"msg":"param invalid"}`, false, "param invalid"},
		{400, `{"StatusCode":1,"StatusMessage":"bad hook"}`, false, "bad hook"},
		{502, `oops`, false, "HTTP 502"},
		{200, `null`, false, "HTTP 200"},
		{200, `"success"`, false, "HTTP 200"},
		{200, `[{"code":0}]`, false, "HTTP 200"},
		{500, ``, false, "HTTP 500"},
		{200, `{"msg":"","StatusMessage":""}`, false, "HTTP 200"},
	}
	var cur tc
	var gotMethod, gotCT, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		gotMethod, gotCT, gotBody = r.Method, r.Header.Get("Content-Type"), string(b)
		w.WriteHeader(cur.status)
		_, _ = io.WriteString(w, cur.body)
	}))
	defer srv.Close()
	s, _, _, _ := unitSvc(&fakeRepo{}, srv.URL)
	card := omap.Of("msg_type", "interactive", "x", "<b>&　×")
	for i, c := range cases {
		cur = c
		ok, warn, err := s.postCard(context.Background(), card)
		if err != nil || ok != c.ok || warn != c.wantWarn {
			t.Errorf("ca %d (%s): ok=%v warn=%q err=%v", i, c.body, ok, warn, err)
		}
	}
	if gotMethod != "POST" || gotCT != "application/json" || gotBody != `{"msg_type":"interactive","x":"<b>&　×"}` {
		t.Errorf("request: %s %s %s", gotMethod, gotCT, gotBody)
	}

	// không có webhook / máy chủ chết: không panic, chỉ là lỗi để nơi gọi ghi log
	s, _, _, _ = unitSvc(&fakeRepo{}, "")
	if _, _, err := s.postCard(context.Background(), card); err == nil {
		t.Error("thiếu URL phải là lỗi")
	}
	srv.Close()
	s, _, _, _ = unitSvc(&fakeRepo{}, srv.URL)
	if _, _, err := s.postCard(context.Background(), card); err == nil {
		t.Error("máy chủ chết phải là lỗi")
	}
}

// Đã lưu được thì luôn {ok: true}: lỗi báo admin, lỗi dựng thẻ, lỗi mạng chỉ ghi log (I:280-293, 301-318).
func TestSendSwallowsSideErrors(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"code":9,"msg":"bad"}`)
	}))
	url := srv.URL
	defer srv.Close()

	repo := &fakeRepo{}
	s, pn, _, _ := unitSvc(repo, url)
	pn.err = errors.New("boom")
	var res *omap.Map
	var err error
	logs := captureLog(t, func() {
		res, err = s.SendPurchaseRequest(context.Background(), testActor, omap.Of("orders", []any{omap.Of("supplier", "A"), 0.0}))
	})
	out, _ := omap.MarshalString(res)
	if err != nil || maMask(out) != `{"ok":true,"saved":["<ma>","<ma>"],"lark":false}` {
		t.Errorf("res = %s, err = %v", out, err)
	}
	if strings.Join(logs, "|") != "[mua hàng] notify lỗi: boom|[mua hàng] webhook Lark trả lỗi: bad" {
		t.Errorf("logs = %q", logs)
	}
	arg, _ := omap.MarshalString(pn.recs)
	if maMask(arg) != `[{"fn":"notifyPurchaseAdmins","uid":"u-1","arg":[{"maDon":"<ma>","supplier":"A"},{"maDon":"<ma>","supplier":0}]}]` {
		t.Errorf("notify arg = %s", arg)
	}
	if got := jsval.S(repo.orders[0].Val("kenh_gui")) + "/" + jsval.S(repo.orders[0].Val("ket_qua_gui")) + "/" + jsval.S(repo.orders[0].Val("requester_id")); got != "Lark/pending/u-1" {
		t.Errorf("mặc định = %s", got)
	}

	// thẻ không dựng được (items không phải mảng): đơn vẫn lưu, không gọi webhook
	s, _, _, _ = unitSvc(&fakeRepo{}, url)
	logs = captureLog(t, func() {
		res, err = s.SendPurchaseRequest(context.Background(), nil, omap.Of("orders", []any{omap.Of("items", "abc")}))
	})
	if err != nil || res.Val("lark") != false || strings.Join(logs, "|") != "[mua hàng] webhook Lark lỗi: items.forEach is not a function" {
		t.Errorf("res = %v err = %v logs = %q", res, err, logs)
	}

	// không lưu đơn nào: không báo admin, vẫn bắn thẻ
	s, pn, _, _ = unitSvc(&fakeRepo{}, url)
	_ = captureLog(t, func() { res, err = s.SendPurchaseRequest(context.Background(), testActor, nil) })
	out, _ = omap.MarshalString(res)
	if err != nil || out != `{"ok":true,"saved":[],"lark":false}` || len(pn.recs) != 0 {
		t.Errorf("res = %s err = %v recs = %v", out, err, pn.recs)
	}

	// đề xuất: lỗi lưu thì trả lỗi, không báo ai
	boom := errors.New("DB POST de_xuat -> 400 {}")
	s, pn, _, _ = unitSvc(&fakeRepo{failProposal: boom}, url)
	if _, err := s.SendDeXuat(context.Background(), testActor, omap.New()); err != boom || len(pn.recs) != 0 {
		t.Errorf("err = %v recs = %v", err, pn.recs)
	}
	srv.Close()
	s, pn, _, _ = unitSvc(&fakeRepo{}, url)
	pn.err = errors.New("boom")
	logs = captureLog(t, func() { res, err = s.SendDeXuat(context.Background(), testActor, omap.Of("supplier", "S")) })
	out, _ = omap.MarshalString(res)
	if err != nil || maMask(out) != `{"ok":true,"ma":"<ma>","loai":"ck","total":0,"lark":false}` || len(logs) != 2 ||
		logs[0] != "[đề xuất] notify lỗi: boom" || !strings.HasPrefix(logs[1], "[đề xuất] webhook lỗi: ") {
		t.Errorf("res = %s err = %v logs = %q", out, err, logs)
	}
}

/*
Giá trị mong đợi trong testdata/send-golden.json do testdata/gen-send.js sinh từ sendPurchaseRequest / sendDeXuat của Node
(Node 22) với testdata/send-cases.json: thân trả lời webhook có BOM, payload có khoá riêng "__proto__", webhook chết.
*/
func TestSendGolden(t *testing.T) {
	read := func(name string) []any {
		b, err := os.ReadFile(filepath.Join("testdata", name))
		if err != nil {
			t.Fatal(err)
		}
		v, err := omap.Decode(b)
		if err != nil {
			t.Fatal(err)
		}
		return jsval.AsArray(v)
	}
	cases, gold := read("send-cases.json"), read("send-golden.json")
	if len(cases) != len(gold) {
		t.Fatalf("số ca %d khác số dòng golden %d", len(cases), len(gold))
	}
	reply := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		_, _ = io.WriteString(w, reply)
	}))
	defer srv.Close()
	deadSrv := httptest.NewServer(http.NotFoundHandler())
	deadURL := deadSrv.URL + "/hook/SECRET-TOKEN"
	deadSrv.Close()

	for i, cv := range cases {
		c := jsval.AsMap(cv)
		url := srv.URL
		if c.Val("dead") == true {
			url = deadURL
		}
		reply = jsval.S(c.Val("reply"))
		repo := &fakeRepo{ins: []any{}}
		s, pn, _, _ := unitSvc(repo, url)
		pn.recs = []any{}
		var res *omap.Map
		var err error
		logs := captureLog(t, func() {
			if jsval.S(c.Val("fn")) == "sendDeXuat" {
				res, err = s.SendDeXuat(context.Background(), testActor, c.Val("arg"))
			} else {
				res, err = s.SendPurchaseRequest(context.Background(), testActor, c.Val("arg"))
			}
		})
		if err != nil {
			t.Errorf("ca %d: err = %v", i, err)
			continue
		}
		lg := make([]any, len(logs))
		for j, l := range logs {
			lg[j] = l
		}
		got, _ := omap.MarshalString(omap.Of("res", res, "ins", repo.ins, "notify", pn.recs, "logs", lg))
		if got = maMask(got); got != jsval.S(gold[i]) {
			t.Errorf("ca %d:\n go:   %s\n node: %s", i, got, jsval.S(gold[i]))
		}
		if strings.Contains(strings.Join(logs, "|"), "SECRET-TOKEN") {
			t.Errorf("ca %d: log lộ URL webhook: %q", i, logs)
		}
	}
}

// Bảng quyền theo index.js:118-135 và REST theo PORTING_MAP mục A; đăng ký chung với nhóm /projects/:id của module khác không được đụng nhau.
func TestRegister(t *testing.T) {
	s, _, _, _ := unitSvc(&fakeRepo{}, "")
	reg := rpc.NewRegistry()
	s.RegisterRPC(reg)
	want := map[string]rpc.Perm{
		"sendPurchaseRequest": rpc.Login, "getPurchaseOrders": rpc.Login, "setPurchaseStatus": rpc.Login, "getDeXuatList": rpc.Login,
		"sendDeXuat": rpc.Login, "listPurchaseRequests": rpc.Admin, "getPurchaseOrder": rpc.Admin, "resolvePurchaseRequest": rpc.Admin,
		"listDeXuat": rpc.Admin, "getDeXuat": rpc.Admin, "resolveDeXuat": rpc.Admin,
	}
	if len(reg.Names()) != len(want) {
		t.Errorf("số hàm rpc = %d", len(reg.Names()))
	}
	for name, perm := range want {
		if p, ok := reg.PermOf(name); !ok || p != perm {
			t.Errorf("%s: perm %v ok %v", name, p, ok)
		}
	}

	gin.SetMode(gin.TestMode)
	e := gin.New()
	v1 := e.Group("/api/v1")
	v1.GET("/projects/:id/lines", func(*gin.Context) {})
	v1.PATCH("/projects/:id", func(*gin.Context) {})
	s.RegisterRoutes(v1)
	n := 0
	for _, r := range e.Routes() {
		if strings.Contains(r.Path, "purchase-orders") || strings.Contains(r.Path, "proposals") {
			n++
		}
	}
	if n != 11 {
		t.Errorf("số route REST = %d", n)
	}

	// chưa đăng nhập -> 401, không vào service
	for _, rq := range [][2]string{{"GET", "/api/v1/purchase-orders"}, {"POST", "/api/v1/proposals"}, {"GET", "/api/v1/projects/X/proposals"},
		{"PATCH", "/api/v1/purchase-orders/MH-1/status"}, {"POST", "/api/v1/proposals/CK-1/resolve"}} {
		w := httptest.NewRecorder()
		e.ServeHTTP(w, httptest.NewRequest(rq[0], rq[1], nil))
		if w.Code != 401 || !strings.Contains(w.Body.String(), `"code":"NOAUTH"`) {
			t.Errorf("%s %s: %d %s", rq[0], rq[1], w.Code, w.Body.String())
		}
	}
}
