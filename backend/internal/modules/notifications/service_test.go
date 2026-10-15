package notifications

import (
	"context"
	"errors"
	"math"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// Giá trị mong đợi trong testdata/*.json sinh từ mã Node thật: xem testdata/gen.js.

func loadGolden(t *testing.T, name string) *omap.Map {
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

func TestDeXuatTen(t *testing.T) {
	s := &Service{}
	for _, c := range jsval.AsArray(loadGolden(t, "golden_pure.json").Val("dxTen")) {
		m := jsval.AsMap(c)
		if got, want := s.DeXuatTen(jsval.AsString(m.Val("loai"))), jsval.AsString(m.Val("out")); got != want {
			t.Errorf("DeXuatTen(%q) = %q, Node cho %q", m.Val("loai"), got, want)
		}
	}
}

// Giá trị mong đợi lấy từ Node v22: "" + (DX_TEN[k] || "đề xuất") với k là khoá của Object.prototype.
func TestDeXuatTenProtoKeys(t *testing.T) {
	s := &Service{}
	for k, want := range map[string]string{
		"constructor":          "function Object() { [native code] }",
		"__proto__":            "[object Object]",
		"__defineGetter__":     "function __defineGetter__() { [native code] }",
		"__defineSetter__":     "function __defineSetter__() { [native code] }",
		"hasOwnProperty":       "function hasOwnProperty() { [native code] }",
		"__lookupGetter__":     "function __lookupGetter__() { [native code] }",
		"__lookupSetter__":     "function __lookupSetter__() { [native code] }",
		"isPrototypeOf":        "function isPrototypeOf() { [native code] }",
		"propertyIsEnumerable": "function propertyIsEnumerable() { [native code] }",
		"toString":             "function toString() { [native code] }",
		"valueOf":              "function valueOf() { [native code] }",
		"toLocaleString":       "function toLocaleString() { [native code] }",
		"Constructor":          "đề xuất",
	} {
		if got := s.DeXuatTen(k); got != want {
			t.Errorf("DeXuatTen(%q) = %q, Node cho %q", k, got, want)
		}
	}
}

func TestNilActorTypeError(t *testing.T) {
	s := &Service{}
	ctx := context.Background()
	const want = "Cannot read properties of null (reading 'uid')"
	errs := []error{}
	_, e := s.NotifCount(ctx, nil)
	errs = append(errs, e)
	_, e = s.NotifList(ctx, nil, nil)
	errs = append(errs, e)
	_, e = s.NotifRead(ctx, nil, "x")
	errs = append(errs, e)
	_, e = s.NotifReadAll(ctx, nil)
	errs = append(errs, e)
	errs = append(errs, s.NotifyPurchaseAdmins(ctx, nil, nil), s.NotifyDeXuatAdmins(ctx, nil, nil))
	for i, e := range errs {
		if e == nil || e.Error() != want {
			t.Errorf("hàm %d: muốn %q, được %v", i, want, e)
		}
	}
}

func TestListLimit(t *testing.T) {
	for _, c := range jsval.AsArray(loadGolden(t, "golden_pure.json").Val("limit")) {
		m := jsval.AsMap(c)
		in := m.Val("limit")
		switch in {
		case "__undefined__":
			in = jsval.Undefined
		case "__nan__":
			in = math.NaN()
		case "__neginf__":
			in = math.Inf(-1)
		case "__inf__":
			in = math.Inf(1)
		}
		n, zero, text, err := listLimit(in)
		got := " limit " + text
		// khi không lỗi, số nguyên truyền cho database phải là đúng con số đó (trừ số quá 2^53: JS ghi tròn, cùng loại lỗi 2201W)
		if err == nil && !zero && math.Abs(float64(n)) < 1<<53 && strconv.Itoa(n) != text {
			t.Errorf("limit %s: n = %d, text = %q", js(t, m.Val("limit")), n, text)
		}
		if zero && text != "0" {
			t.Errorf("limit %s: zero mà text = %q", js(t, m.Val("limit")), text)
		}
		if want := jsval.AsString(m.Val("out")); got != want {
			t.Errorf("limit %s -> %q, Node cho %q", js(t, m.Val("limit")), got, want)
		}
	}
}

func TestNotifOut(t *testing.T) {
	for _, c := range jsval.AsArray(loadGolden(t, "golden_pure.json").Val("row")) {
		m := jsval.AsMap(c)
		if got, want := js(t, notifOut(jsval.AsMap(m.Val("row")))), js(t, m.Val("out")); got != want {
			t.Errorf("notifOut(%s)\n Go:   %s\n Node: %s", js(t, m.Val("row")), got, want)
		}
	}
}

// ───────────── giả lập ─────────────

type auditStub struct {
	label func(any) any
	calls []any
}

func (s *auditStub) Audit(_ context.Context, a *actor.Actor, action, detail string, congTyID any) {
	uid := a.UID
	if s.label != nil {
		uid = s.label(uid)
	}
	s.calls = append(s.calls, omap.Of("username", a.U, "action", action, "detail", detail, "uid", uid))
	if congTyID != nil {
		panic("notifications không bao giờ truyền congTyID cho audit")
	}
}

type usersStub struct {
	db   *database.DB
	rows map[string]*omap.Map
	err  error
}

// GetByID: getUserById (A:212-215) - noScope, limit 1, không có -> nil.
func (s *usersStub) GetByID(ctx context.Context, id any) (*omap.Map, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.db == nil {
		return s.rows[jsval.ToString(id)], nil
	}
	rows, err := s.db.Select(ctx, "users", database.SelectOpt{Filter: database.Eq("id", id), Limit: 1, NoScope: true})
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}

type fakeRepo struct {
	Repository
	admins    []*omap.Map
	adminErr  error
	inserted  []*omap.Map
	insertErr error
	limit     int
	rows      []*omap.Map
}

func (f *fakeRepo) AdminUsers(context.Context) ([]*omap.Map, error) { return f.admins, f.adminErr }
func (f *fakeRepo) Insert(_ context.Context, row *omap.Map) error {
	f.inserted = append(f.inserted, row)
	return f.insertErr
}
func (f *fakeRepo) ListByUser(_ context.Context, _ any, limit int) ([]*omap.Map, error) {
	f.limit = limit
	return f.rows, nil
}

func TestNotifySkipsAndSwallows(t *testing.T) {
	repo := &fakeRepo{insertErr: errors.New("DB POST notifications -> 500 {}")}
	s := &Service{repo: repo}
	ctx := context.Background()
	for _, uid := range []any{nil, "", 0.0, false, jsval.Undefined} {
		s.Notify(ctx, uid, "k", "t", "b", "r")
	}
	if len(repo.inserted) != 0 {
		t.Fatal("userId falsy thì không chèn")
	}
	s.Notify(ctx, "u1", "k", "", "", 0.0) // lỗi chèn bị nuốt
	s.Notify(ctx, 7.0, "k", "t", "b", 12.0)
	want := `[{"user_id":"u1","kind":"k","title":"","body":"","ref_id":null,"is_read":false},{"user_id":7,"kind":"k","title":"t","body":"b","ref_id":12,"is_read":false}]`
	if got := js(t, repo.inserted); got != want {
		t.Errorf("dòng chèn\n Go:  %s\n cần: %s", got, want)
	}
}

func TestActiveAdminsFilter(t *testing.T) {
	repo := &fakeRepo{admins: []*omap.Map{omap.Of("id", 1.0, "active", true), omap.Of("id", 2.0, "active", false),
		omap.Of("id", 3.0, "active", nil), omap.Of("id", 4.0)}}
	s := &Service{repo: repo}
	got, err := s.ActiveAdmins(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if js(t, got) != `[{"id":1,"active":true},{"id":3,"active":null},{"id":4}]` {
		t.Errorf("chỉ bỏ active === false, được %s", js(t, got))
	}
	repo.admins = nil
	if got, _ = s.ActiveAdmins(context.Background()); got == nil || js(t, got) != "[]" {
		t.Error("không có admin phải trả mảng rỗng khác nil")
	}
}

func TestNotifyAdminsErrorsAndWho(t *testing.T) {
	ctx := context.Background()
	a := &actor.Actor{UID: "u1", U: "tk"}
	au := &auditStub{}
	repo := &fakeRepo{admins: []*omap.Map{omap.Of("id", "ad1")}}
	us := &usersStub{rows: map[string]*omap.Map{"u1": omap.Of("ho_ten", nil, "username", nil)}}
	s := &Service{repo: repo, users: us, auditor: au}
	// me có nhưng ho_ten lẫn username đều null -> JS nối ra chữ "null"
	if err := s.NotifyDeXuatAdmins(ctx, a, omap.Of("ma", "M1")); err != nil {
		t.Fatal(err)
	}
	if got := jsval.AsString(repo.inserted[0].Val("body")); got != "null gửi đề xuất M1" {
		t.Errorf("body = %q", got)
	}
	// lỗi đọc users / admin được trả về, không ghi audit
	n := len(au.calls)
	us.err = errors.New("DB GET users -> 500 {}")
	if err := s.NotifyPurchaseAdmins(ctx, a, []any{omap.Of("maDon", "D1")}); err == nil || err.Error() != "DB GET users -> 500 {}" {
		t.Errorf("lỗi đọc users phải trả nguyên, được %v", err)
	}
	us.err, repo.adminErr = nil, errors.New("DB GET users -> 400 {}")
	if err := s.NotifyDeXuatAdmins(ctx, a, omap.Of("ma", "M1")); err == nil || err.Error() != "DB GET users -> 400 {}" {
		t.Errorf("lỗi đọc admin phải trả nguyên, được %v", err)
	}
	if len(au.calls) != n {
		t.Error("lỗi thì không ghi audit")
	}
	// không có admin: phần tử null không bị đọc tới (vòng trong không chạy), vẫn ghi audit
	repo.adminErr, repo.admins = nil, nil
	if err := s.NotifyPurchaseAdmins(ctx, a, []any{nil, nil}); err != nil {
		t.Fatal(err)
	}
	if got := js(t, au.calls[len(au.calls)-1]); got != `{"username":"tk","action":"request_purchase","detail":"null gửi 2 đơn mua hàng","uid":"u1"}` {
		t.Errorf("audit %s", got)
	}
}

// ───────────── đối chiếu với Node trên database thử ─────────────

var reTS = regexp.MustCompile(`"\d{4}-\d\d-\d\dT[\d:.]+\+00:00"`)

// adminsByName: getAdmins_ của Node (A:450) đọc users KHÔNG có ORDER BY nên thứ tự admin theo vị trí dòng trên đĩa -
// gói test khác ghi/xoá users cùng lúc là thứ tự đổi. Xếp theo username để so được với bản Node (adm1 tạo trước adm2).
type adminsByName struct{ Repository }

func (r adminsByName) AdminUsers(ctx context.Context) ([]*omap.Map, error) {
	rows, err := r.Repository.AdminUsers(ctx)
	sort.SliceStable(rows, func(i, j int) bool {
		return jsval.AsString(rows[i].Val("username")) < jsval.AsString(rows[j].Val("username"))
	})
	return rows, err
}

func TestDiffDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !strings.Contains(url, "/qspro_gotest") {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	defer db.Close()
	pool, err := db.Pool()
	if err != nil {
		t.Fatal(err)
	}
	bg := context.Background()
	const ctSub = "(select id from companies where code like 'zz-notifications%')"
	sweep := func() {
		for _, q := range []string{
			"delete from notifications where company_id in " + ctSub,
			"delete from audit_logs where company_id in " + ctSub + " or username like 'zz_notifications%'",
			"delete from users where username like 'zz_notifications%'",
			"delete from companies where code like 'zz-notifications%'",
		} {
			if _, err := pool.Exec(bg, q); err != nil {
				t.Errorf("dọn dữ liệu thử: %v", err)
			}
		}
	}
	sweep()
	defer sweep()

	no := database.Opt{NoScope: true}
	const ghost = "00000000-0000-4000-8000-00000000abcd"
	labels := [][2]string{{ghost, "<ghost>"}}
	res, err := db.InsertOne(bg, "cong_ty", omap.Of("ten", "ZZ_notifications Cty", "ma", "zz-notifications-1"), no)
	if err != nil {
		t.Fatal(err)
	}
	ct := res[0].Val("id")
	labels = append(labels, [2]string{jsval.ToString(ct), "<CT>"})

	type who struct {
		a   *actor.Actor
		ctx context.Context
	}
	mkWho := func(uid any, u, role string) who {
		return who{&actor.Actor{UID: uid, U: u, R: role, CT: ct}, tenant.With(bg, tenant.Ctx{UID: uid, Role: role, CongTyID: ct})}
	}
	mk := func(name, hoTen, role string, active bool) who {
		r, err := db.InsertOne(bg, "users", omap.Of("username", "zz_notifications_"+name, "ho_ten", hoTen, "password_hash", "x",
			"role", role, "active", active, "cong_ty_id", ct), no)
		if err != nil {
			t.Fatal(err)
		}
		labels = append(labels, [2]string{jsval.ToString(r[0].Val("id")), "<U:" + name + ">"})
		return mkWho(r[0].Val("id"), jsval.AsString(r[0].Val("username")), role)
	}
	A1 := mk("adm1", "ZZ Admin Một", "admin", true)
	A2 := mk("adm2", "", "admin", true)
	mk("adm3", "ZZ khoá", "admin", false)
	ST := mk("stf", "", "staff", true)
	GH := mkWho(ghost, "zz_notifications_ghost", "staff")

	au := &auditStub{}
	s := New(Deps{DB: db, Users: &usersStub{db: db}, Auditor: au})
	s.repo = adminsByName{s.repo}
	golden := loadGolden(t, "golden_db.json")
	seen := map[string]bool{}

	// dòng thông báo của công ty thử theo thứ tự tạo (id của hai database khác nhau -> đổi thành <N1>, <N2>...)
	dump := func() []*omap.Map {
		rows, err := db.Select(bg, "notifications", database.SelectOpt{Filter: database.Eq("cong_ty_id", ct), Order: "id.asc", NoScope: true})
		if err != nil {
			t.Fatal(err)
		}
		return rows
	}
	norm := func(v any) string {
		ids := map[string]string{}
		for i, r := range dump() {
			ids[jsval.ToString(r.Val("id"))] = "<N" + strconv.Itoa(i+1) + ">"
		}
		var walk func(x any) any
		walk = func(x any) any {
			switch y := x.(type) {
			case *omap.Map:
				if y == nil {
					return x
				}
				o := omap.New()
				y.Each(func(k string, val any) {
					if lbl, ok := ids[jsval.ToString(val)]; ok && k == "id" {
						o.Set(k, lbl)
					} else {
						o.Set(k, walk(val))
					}
				})
				return o
			case []any:
				out := make([]any, len(y))
				for i, it := range y {
					out[i] = walk(it)
				}
				return out
			}
			return x
		}
		str := js(t, walk(v))
		for _, p := range labels {
			str = strings.ReplaceAll(str, p[0], p[1])
		}
		return reTS.ReplaceAllString(str, `"<ts>"`)
	}
	raw := func(name string, v any) {
		t.Helper()
		seen[name] = true
		if !golden.Has(name) {
			t.Errorf("%s: không có trong golden_db.json", name)
			return
		}
		if got, want := norm(v), js(t, golden.Val(name)); got != want {
			t.Errorf("%s\n Go:   %s\n Node: %s", name, got, want)
		}
	}
	check := func(name string, out any, err error) {
		t.Helper()
		if err != nil {
			raw(name, omap.Of("err", err.Error()))
			return
		}
		raw(name, omap.Of("ok", out))
	}
	U := jsval.Undefined
	count := func(name string, w who) {
		t.Helper()
		r, err := s.NotifCount(w.ctx, w.a)
		check(name, r, err)
	}
	list := func(name string, w who, limit any) {
		t.Helper()
		r, err := s.NotifList(w.ctx, w.a, limit)
		check(name, r, err)
	}
	read := func(name string, w who, id any) {
		t.Helper()
		r, err := s.NotifRead(w.ctx, w.a, id)
		check(name, r, err)
	}
	rowsOut := func() []any {
		rows := dump()
		out := make([]any, len(rows))
		for i, r := range rows {
			out[i] = omap.Of("id", r.Val("id"), "user", r.Val("user_id"), "kind", r.Val("kind"), "title", r.Val("title"), "body", r.Val("body"),
				"refId", r.Val("ref_id"), "read", r.Val("is_read"), "ct", r.Val("cong_ty_id"))
		}
		return out
	}

	count("n01a_count_empty", A1)
	list("n01b_list_empty", A1, U)
	check("n02_purchase", U, s.NotifyPurchaseAdmins(ST.ctx, ST.a, []any{
		omap.Of("maDon", "ZZ_notifications_PO1", "supplier", "NCC A"), omap.Of("maDon", "ZZ_notifications_PO2"),
		omap.Of("maDon", 77.0, "supplier", 0.0)}))
	check("n03a_dexuat_ck", U, s.NotifyDeXuatAdmins(A1.ctx, A1.a, omap.Of("ma", "ZZ_notifications_DX1", "loai", "ck", "supplier", "S")))
	check("n03b_dexuat_tt", U, s.NotifyDeXuatAdmins(ST.ctx, ST.a, omap.Of("ma", "ZZ_notifications_DX2", "loai", "tt")))
	check("n03c_dexuat_la", U, s.NotifyDeXuatAdmins(A1.ctx, A1.a, omap.Of("ma", 5.0, "loai", "zz", "supplier", "")))
	check("n04a_ghost_null", U, s.NotifyPurchaseAdmins(GH.ctx, GH.a, nil))
	check("n04b_ghost_one", U, s.NotifyPurchaseAdmins(GH.ctx, GH.a, []any{omap.Of("maDon", "ZZ_notifications_PO3", "supplier", "G")}))
	check("n05_null_order", U, s.NotifyPurchaseAdmins(ST.ctx, ST.a, []any{nil}))
	count("n06a_count_a1", A1)
	count("n06b_count_a2", A2)
	count("n06c_count_staff", ST)
	list("n06d_list", A1, U)
	list("n06e_list_2", A1, 2.0)
	list("n06f_list_str3", A1, "3")
	list("n06g_list_half", A1, 0.5)
	list("n06h_list_neg", A1, -1.0)
	list("n06i_list_big", A1, 1000.0)
	list("n06j_list_null", A2, nil)
	list("n06k_list_1_5", A1, 1.5)
	list("n06l_list_neg_3e9", A1, -3e9)
	list("n06m_list_neg_5e18", A1, -5e18)
	list("n06n_list_neg_2p63", A1, -9223372036854775808.0)
	list("n06o_list_neg_1e19", A1, -1e19)
	list("n06p_list_neg_1e21", A1, -1e21)
	list("n06q_list_neg_inf_str", A1, "-Infinity")
	list("n06r_list_neg_inf", A1, math.Inf(-1))
	list("n06s_list_neg_below", A1, -9223372036854774784.0)

	var ofA1, ofA2 []any
	for _, r := range dump() {
		if jsval.StrictEquals(r.Val("user_id"), A1.a.UID) {
			ofA1 = append(ofA1, r.Val("id"))
		} else if jsval.StrictEquals(r.Val("user_id"), A2.a.UID) {
			ofA2 = append(ofA2, r.Val("id"))
		}
	}
	if len(ofA1) < 2 || len(ofA2) < 1 {
		t.Fatalf("thiếu thông báo để thử: A1 %d, A2 %d", len(ofA1), len(ofA2))
	}
	read("n07a_read", A1, ofA1[0])
	read("n07b_read_str", A1, jsval.ToString(ofA1[1]))
	read("n07c_read_other", A1, ofA2[0])
	read("n07d_read_bad", A1, "abc")
	read("n07e_read_undefined", A1, U)
	count("n07f_count_a1", A1)
	list("n07g_list_a1", A1, U)
	count("n07h_count_a2", A2)
	raw("n07z_rows", rowsOut())
	{
		r, err := s.NotifReadAll(A1.ctx, A1.a)
		check("n08a_read_all", r, err)
	}
	count("n08b_count_a1", A1)
	count("n08c_count_a2", A2)
	{
		r, err := s.NotifReadAll(A1.ctx, A1.a)
		check("n08d_read_all_again", r, err)
	}
	raw("n08z_rows", rowsOut())
	raw("audit", au.calls)

	// getAdmins_ không được export bên Node: kiểm trực tiếp phạm vi công ty + lọc tài khoản khoá
	admins, err := s.ActiveAdmins(A1.ctx)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, ad := range admins {
		names = append(names, jsval.AsString(jsval.Get(ad, "username")))
	}
	if strings.Join(names, ",") != "zz_notifications_adm1,zz_notifications_adm2" {
		t.Errorf("ActiveAdmins = %v", names)
	}
	for _, k := range golden.Keys() {
		if !seen[k] {
			t.Errorf("bước %s của bản Node chưa được chạy bên Go", k)
		}
	}
}
