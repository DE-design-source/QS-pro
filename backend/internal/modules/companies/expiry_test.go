package companies

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"qspro-backend/internal/modules/notifications"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// Nhắc gia hạn trong ứng dụng (M17.3, chỉ bản Go): không có golden Node, giá trị mong đợi viết tay theo quyết định M17.3.

func TestMocCua(t *testing.T) {
	cases := map[int]int{0: 0, 1: 1, 2: 3, 3: 3, 4: 7, 7: 7, 8: 14, 14: 14, 15: 30, 30: 30}
	for n, want := range cases {
		if got, ok := mocCua(n); !ok || got != want {
			t.Errorf("mocCua(%d) = %d,%v, cần %d", n, got, ok, want)
		}
	}
	for _, n := range []int{-1, -30, 31, 365} {
		if _, ok := mocCua(n); ok {
			t.Errorf("mocCua(%d) phải không có mốc", n)
		}
	}
	// giá trị cũ ngoài tập mốc = chưa nhắc
	for _, v := range []any{nil, -1.0, 5.0, 2.0, "x", 31.0} {
		if _, ok := mocCu(v); ok {
			t.Errorf("mocCu(%v) phải coi như chưa nhắc", v)
		}
	}
	if !canGui(7, -1.0) || !canGui(7, 5.0) || !canGui(7, nil) || !canGui(7, 14.0) || canGui(7, 7.0) || canGui(14, 7.0) {
		t.Error("canGui sai")
	}
}

// memRepo: bảng cong_ty + notifications trong bộ nhớ (UpdateCongTy / NhanMocNhac áp patch thật) + ghi lại các lệnh ghi.
// NhanMocNhac chạy dưới khoá như một UPDATE có điều kiện của Postgres (dòng bị khoá, điều kiện xét lại trên bản mới).
type memRepo struct {
	Repository
	mu      sync.Mutex
	rows    []*omap.Map
	updates []string
	sent    []string // "ct|user|kind|title|body|ref"
	loiChen func(uid string) error
}

func (m *memRepo) find(id any) *omap.Map {
	for _, r := range m.rows {
		if jsval.ToString(r.Val("id")) == jsval.ToString(id) {
			return r
		}
	}
	return nil
}

func (m *memRepo) ListCongTy(context.Context) ([]*omap.Map, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]*omap.Map, len(m.rows))
	for i, r := range m.rows {
		out[i] = r.Clone()
	}
	return out, nil
}

func (m *memRepo) CongTyCanNhac(_ context.Context, tu, den string) ([]*omap.Map, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.updates = append(m.updates, "quét "+tu+".."+den)
	out := []*omap.Map{}
	for _, r := range m.rows {
		h := jsval.ToString(r.Val("han_dung"))
		if r.Val("active") == false || jsval.IsNullish(r.Val("han_dung")) || h < tu || h > den {
			continue
		}
		out = append(out, r.Clone())
	}
	return out, nil
}

func (m *memRepo) NhanMocNhac(_ context.Context, id any, moc int, ngay string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.find(id)
	if r == nil || !canGui(moc, r.Val("nhac_moc")) {
		return false, nil
	}
	m.updates = append(m.updates, "giành "+jsval.ToString(id)+" "+strconv.Itoa(moc)+" "+ngay)
	r.Set("nhac_moc", float64(moc))
	r.Set("nhac_lan_cuoi", ngay)
	return true, nil
}

func (m *memRepo) TraMocNhac(_ context.Context, id any, moc int, ngay string, mocCu, ngayCu any) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.find(id)
	if r != nil && r.Val("nhac_moc") == float64(moc) && r.Val("nhac_lan_cuoi") == ngay {
		m.updates = append(m.updates, "trả "+jsval.ToString(id)+" "+jsval.ToString(mocCu)+" "+jsval.ToString(ngayCu))
		r.Set("nhac_moc", mocCu)
		r.Set("nhac_lan_cuoi", ngayCu)
	}
	return nil
}

func (m *memRepo) ChenThongBao(ctx context.Context, row *omap.Map) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.loiChen != nil {
		if err := m.loiChen(jsval.ToString(row.Val("user_id"))); err != nil {
			return err
		}
	}
	m.sent = append(m.sent, strings.Join([]string{jsval.ToString(tenant.TenantID(ctx)), jsval.ToString(row.Val("user_id")),
		jsval.ToString(row.Val("kind")), jsval.ToString(row.Val("title")), jsval.ToString(row.Val("body")),
		jsval.ToString(row.Val("ref_id"))}, "|"))
	return nil
}

func (m *memRepo) CongTyByID(_ context.Context, id any) ([]*omap.Map, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r := m.find(id); r != nil {
		return []*omap.Map{r.Clone()}, nil
	}
	return nil, nil
}

func (m *memRepo) UpdateCongTy(_ context.Context, id any, patch *omap.Map) ([]*omap.Map, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, _ := omap.MarshalString(patch)
	m.updates = append(m.updates, jsval.ToString(id)+" "+s)
	r := m.find(id)
	if r == nil {
		return nil, nil
	}
	omap.Assign(r, patch)
	return []*omap.Map{r.Clone()}, nil
}

// adminGia: admin đang hoạt động theo công ty của ctx (như ActiveAdmins có phạm vi công ty).
type adminGia map[string][]any

func (a adminGia) ActiveAdmins(ctx context.Context) ([]any, error) {
	if v, ok := a[jsval.ToString(tenant.TenantID(ctx))]; ok {
		return v, nil
	}
	return []any{}, nil
}

type auditGia struct{ calls []string }

func (s *auditGia) Audit(ctx context.Context, _ *actor.Actor, action, detail string, _ any) {
	s.calls = append(s.calls, jsval.ToString(tenant.TenantID(ctx))+"|"+action+"|"+detail)
}

// homNay: 2026-10-15 9h00 giờ VN (02:00 UTC).
var homNay = time.Date(2026, 10, 15, 2, 0, 0, 0, time.UTC)

func ngayCach(d int) string { return homNay.Add(7*time.Hour).AddDate(0, 0, d).Format("2006-01-02") }

func ad(id string) *omap.Map { return omap.Of("id", id, "role", "admin") }

// ghiCua: các lệnh ghi của repo (bỏ dòng "quét").
func ghiCua(repo *memRepo) []string {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	out := []string{}
	for _, u := range repo.updates {
		if !strings.HasPrefix(u, "quét ") {
			out = append(out, u)
		}
	}
	return out
}

func soGui(repo *memRepo) int {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	return len(repo.sent)
}

func TestNhacGiaHan(t *testing.T) {
	repo := &memRepo{rows: []*omap.Map{
		omap.Of("id", "c7", "ten", "Cty Bảy", "active", true, "han_dung", ngayCach(7), "nhac_moc", nil),
		omap.Of("id", "c0", "ten", "Cty Không", "active", true, "han_dung", ngayCach(0), "nhac_moc", 1.0),
		omap.Of("id", "cm1", "ten", "Cty Cũ -1", "active", true, "han_dung", ngayCach(3), "nhac_moc", -1.0),
		omap.Of("id", "c5", "ten", "Cty Cũ 5", "active", true, "han_dung", ngayCach(20), "nhac_moc", 5.0),
		omap.Of("id", "cdone", "ten", "Cty Đã nhắc", "active", true, "han_dung", ngayCach(6), "nhac_moc", 7.0),
		omap.Of("id", "cfar", "ten", "Cty Xa", "active", true, "han_dung", ngayCach(31), "nhac_moc", nil),
		omap.Of("id", "cexp", "ten", "Cty Hết", "active", true, "han_dung", ngayCach(-1), "nhac_moc", nil),
		omap.Of("id", "coff", "ten", "Cty Khoá", "active", false, "han_dung", ngayCach(2), "nhac_moc", nil),
		omap.Of("id", "cnull", "ten", "Cty Vô hạn", "active", true, "han_dung", nil, "nhac_moc", nil),
		omap.Of("id", "cnoad", "ten", "Cty Không admin", "active", true, "han_dung", ngayCach(1), "nhac_moc", nil),
	}}
	au := &auditGia{}
	admins := adminGia{"c7": {ad("a1"), ad("a2")}, "c0": {ad("b1")}, "cm1": {ad("m1")}, "c5": {ad("f1")}, "cdone": {ad("d1")},
		"cfar": {ad("x1")}, "cexp": {ad("e1")}, "coff": {ad("o1")}}
	s := &Service{repo: repo, admins: admins, auditor: au, now: func() time.Time { return homNay }}
	ctx := context.Background()

	// chạy thử: không gửi, không ghi; chỉ quét han_dung trong [hôm nay, hôm nay + 30]
	r, err := s.NhacGiaHan(ctx, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.sent) != 0 || len(ghiCua(repo)) != 0 || len(au.calls) != 0 {
		t.Fatalf("dryRun đã ghi: %v %v %v", repo.sent, repo.updates, au.calls)
	}
	if repo.updates[0] != "quét 2026-10-15..2026-11-14" {
		t.Errorf("khoảng quét: %v", repo.updates)
	}
	if r.Val("ngay") != "2026-10-15" || r.Val("soCongTy") != 5.0 || r.Val("soThongBao") != 0.0 || r.Val("dryRun") != true {
		t.Errorf("kết quả dryRun: %s", js(t, r))
	}
	got := []string{}
	for _, x := range jsval.AsArray(r.Val("ds")) {
		m := jsval.AsMap(x)
		got = append(got, jsval.ToString(m.Val("id"))+":"+jsval.ToString(m.Val("conLai"))+"/"+jsval.ToString(m.Val("moc"))+
			"/"+jsval.ToString(m.Val("mocCu"))+"/"+jsval.ToString(m.Val("canGui"))+"/"+jsval.ToString(m.Val("soAdmin")))
	}
	if want := "c0:0/0/1/true/1 cnoad:1/1/null/true/0 cm1:3/3/null/true/1 cdone:6/7/7/false/1 c7:7/7/null/true/2 c5:20/30/null/true/1"; strings.Join(got, " ") != want {
		t.Errorf("danh sách chạy thử\n có:  %s\n cần: %s", strings.Join(got, " "), want)
	}

	// gửi thật
	r, err = s.NhacGiaHan(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if r.Val("soThongBao") != 5.0 || r.Val("soCongTy") != 5.0 {
		t.Errorf("gửi thật: %s", js(t, r))
	}
	wantSent := []string{
		"c0|b1|expiry_notice|Công ty hết hạn hôm nay|Gói của Cty Không hết hạn ngày 15/10/2026 (còn 0 ngày). Liên hệ quản trị hệ thống để gia hạn.|c0",
		"cm1|m1|expiry_notice|Công ty sắp hết hạn sử dụng|Gói của Cty Cũ -1 hết hạn ngày 18/10/2026 (còn 3 ngày). Liên hệ quản trị hệ thống để gia hạn.|cm1",
		"c7|a1|expiry_notice|Công ty sắp hết hạn sử dụng|Gói của Cty Bảy hết hạn ngày 22/10/2026 (còn 7 ngày). Liên hệ quản trị hệ thống để gia hạn.|c7",
		"c7|a2|expiry_notice|Công ty sắp hết hạn sử dụng|Gói của Cty Bảy hết hạn ngày 22/10/2026 (còn 7 ngày). Liên hệ quản trị hệ thống để gia hạn.|c7",
		"c5|f1|expiry_notice|Công ty sắp hết hạn sử dụng|Gói của Cty Cũ 5 hết hạn ngày 04/11/2026 (còn 20 ngày). Liên hệ quản trị hệ thống để gia hạn.|c5",
	}
	if strings.Join(repo.sent, "\n") != strings.Join(wantSent, "\n") {
		t.Errorf("thông báo\n có:\n%s\n cần:\n%s", strings.Join(repo.sent, "\n"), strings.Join(wantSent, "\n"))
	}
	// mốc được giành TRƯỚC khi gửi (UPDATE có điều kiện)
	wantUpd := []string{"giành c0 0 2026-10-15", "giành cm1 3 2026-10-15", "giành c7 7 2026-10-15", "giành c5 30 2026-10-15"}
	if strings.Join(ghiCua(repo), "\n") != strings.Join(wantUpd, "\n") {
		t.Errorf("ghi mốc\n có:\n%s\n cần:\n%s", strings.Join(ghiCua(repo), "\n"), strings.Join(wantUpd, "\n"))
	}
	if len(au.calls) != 4 || au.calls[2] != "c7|nhac_gia_han|Nhắc gia hạn Cty Bảy: còn 7 ngày (mốc 7), gửi 2 admin" {
		t.Errorf("nhật ký: %v", au.calls)
	}

	// chạy lại cùng ngày: không gửi trùng (công ty không admin vẫn chờ)
	n0, u0 := len(repo.sent), len(ghiCua(repo))
	r, _ = s.NhacGiaHan(ctx, false)
	if len(repo.sent) != n0 || len(ghiCua(repo)) != u0 || r.Val("soThongBao") != 0.0 || r.Val("soCongTy") != 1.0 {
		t.Errorf("chạy lại gửi trùng: %s", js(t, r))
	}

	// hôm sau: c7 còn 6 ngày (mốc 7 đã nhắc) -> không gửi; 4 ngày sau: c7 còn 3 -> mốc 3
	s.now = func() time.Time { return homNay.AddDate(0, 0, 1) }
	s.NhacGiaHan(ctx, false)
	for _, x := range repo.sent[n0:] {
		if strings.HasPrefix(x, "c7|") {
			t.Errorf("c7 bị nhắc lại mốc 7: %s", x)
		}
	}
	s.now = func() time.Time { return homNay.AddDate(0, 0, 4) }
	before := len(repo.sent)
	s.NhacGiaHan(ctx, false)
	c7 := 0
	for _, x := range repo.sent[before:] {
		if strings.HasPrefix(x, "c7|") {
			c7++
			if !strings.Contains(x, "(còn 3 ngày)") {
				t.Errorf("c7 mốc 3 sai: %s", x)
			}
		}
	}
	if c7 != 2 || jsval.ToNumber(repo.find("c7").Val("nhac_moc")) != 3 {
		t.Errorf("c7 phải nhận mốc 3 (2 admin), có %d; nhac_moc = %v", c7, repo.find("c7").Val("nhac_moc"))
	}
}

// TestNhacGiaHanLoiChen: chèn thông báo lỗi hết -> trả mốc cũ (kể cả giá trị cũ -1), không ghi nhật ký, báo lỗi;
// lần sau chèn được thì gửi lại. Lỗi một phần: giữ mốc, báo số admin nhận được.
func TestNhacGiaHanLoiChen(t *testing.T) {
	repo := &memRepo{rows: []*omap.Map{
		omap.Of("id", "c7", "ten", "Cty Bảy", "active", true, "han_dung", ngayCach(7), "nhac_moc", -1.0, "nhac_lan_cuoi", "2026-01-01"),
		omap.Of("id", "c3", "ten", "Cty Ba", "active", true, "han_dung", ngayCach(3), "nhac_moc", nil, "nhac_lan_cuoi", nil),
	}}
	au := &auditGia{}
	s := &Service{repo: repo, admins: adminGia{"c7": {ad("a1")}, "c3": {ad("b1"), ad("b2")}}, auditor: au,
		now: func() time.Time { return homNay }}
	repo.loiChen = func(uid string) error {
		if uid == "a1" || uid == "b2" {
			return errors.New("relation notifications does not exist")
		}
		return nil
	}
	r, err := s.NhacGiaHan(context.Background(), false)
	if err != nil {
		t.Fatal(err)
	}
	if r.Val("soThongBao") != 1.0 || len(repo.sent) != 1 || !strings.HasPrefix(repo.sent[0], "c3|b1|") {
		t.Fatalf("lỗi chèn: %s %v", js(t, r), repo.sent)
	}
	ds := jsval.AsArray(r.Val("ds"))
	c3, c7 := jsval.AsMap(ds[0]), jsval.AsMap(ds[1])
	if c7.Val("daGui") != false || !strings.HasPrefix(jsval.ToString(c7.Val("loi")), "Không gửi được thông báo: relation") {
		t.Errorf("c7: %s", js(t, c7))
	}
	if c3.Val("daGui") != true || c3.Val("loi") != "Chỉ gửi được 1/2 admin: relation notifications does not exist" {
		t.Errorf("c3: %s", js(t, c3))
	}
	if repo.find("c7").Val("nhac_moc") != -1.0 || repo.find("c7").Val("nhac_lan_cuoi") != "2026-01-01" {
		t.Errorf("c7 phải được trả mốc cũ: %v %v", repo.find("c7").Val("nhac_moc"), repo.find("c7").Val("nhac_lan_cuoi"))
	}
	if repo.find("c3").Val("nhac_moc") != 3.0 {
		t.Errorf("c3 đã gửi được 1 admin, phải giữ mốc 3: %v", repo.find("c3").Val("nhac_moc"))
	}
	if len(au.calls) != 1 || au.calls[0] != "c3|nhac_gia_han|Nhắc gia hạn Cty Ba: còn 3 ngày (mốc 3), gửi 1 admin" {
		t.Errorf("nhật ký: %v", au.calls)
	}
	// hết lỗi: c7 được gửi lại, c3 không trùng
	repo.loiChen = nil
	r, _ = s.NhacGiaHan(context.Background(), false)
	if r.Val("soThongBao") != 1.0 || !strings.HasPrefix(repo.sent[len(repo.sent)-1], "c7|a1|") || repo.find("c7").Val("nhac_moc") != 7.0 {
		t.Errorf("gửi lại sau lỗi: %s %v", js(t, r), repo.sent)
	}
}

// TestNhacGiaHanHaiTienTrinh: hai Service (hai tiến trình) cùng một database chạy song song: mỗi mốc chỉ gửi một lần.
func TestNhacGiaHanHaiTienTrinh(t *testing.T) {
	for lan := 0; lan < 20; lan++ {
		repo := &memRepo{rows: []*omap.Map{
			omap.Of("id", "c7", "ten", "Cty Bảy", "active", true, "han_dung", ngayCach(7), "nhac_moc", nil),
			omap.Of("id", "c0", "ten", "Cty Không", "active", true, "han_dung", ngayCach(0), "nhac_moc", 5.0),
		}}
		admins := adminGia{"c7": {ad("a1"), ad("a2")}, "c0": {ad("b1")}}
		var wg sync.WaitGroup
		tong := make([]float64, 2)
		for i := 0; i < 2; i++ {
			s := &Service{repo: repo, admins: admins, auditor: &auditGia{}, now: func() time.Time { return homNay }}
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				r, err := s.NhacGiaHan(context.Background(), false)
				if err != nil {
					t.Error(err)
					return
				}
				tong[i] = jsval.ToNumber(r.Val("soThongBao"))
			}(i)
		}
		wg.Wait()
		if soGui(repo) != 3 || tong[0]+tong[1] != 3 {
			t.Fatalf("lần %d: gửi %d thông báo (%v), cần 3: %v", lan, soGui(repo), tong, repo.sent)
		}
	}
}

func TestUpdateCongTyXoaMoc(t *testing.T) {
	repo := &memRepo{rows: []*omap.Map{
		omap.Of("id", "c1", "ten", "A", "han_dung", "2026-10-22", "nhac_moc", 7.0, "nhac_lan_cuoi", "2026-10-15"),
		omap.Of("id", "c2", "ten", "B", "han_dung", "2026-10-22", "nhac_moc", nil, "nhac_lan_cuoi", nil),
	}}
	s := &Service{repo: repo, auditor: &auditGia{}, now: func() time.Time { return homNay }}
	ctx := context.Background()
	// cùng hạn dùng: không xoá
	if _, err := s.UpdateCongTy(ctx, super, "c1", omap.Of("hanDung", "2026-10-22", "ten", "A")); err != nil {
		t.Fatal(err)
	}
	if len(repo.updates) != 1 || repo.find("c1").Val("nhac_moc") != 7.0 {
		t.Fatalf("cùng hạn mà xoá mốc: %v", repo.updates)
	}
	// không đổi hạn dùng: không đọc trước, không xoá
	s.UpdateCongTy(ctx, super, "c1", omap.Of("ten", "A2"))
	if len(repo.updates) != 2 {
		t.Fatalf("đổi tên mà có lệnh thừa: %v", repo.updates)
	}
	// admin gửi hanDung: bị bỏ qua (chỉ super đổi gói) -> không xoá
	s.UpdateCongTy(ctx, &actor.Actor{UID: "u", R: "admin", CT: "c1"}, "c1", omap.Of("hanDung", "2030-01-01"))
	if repo.find("c1").Val("nhac_moc") != 7.0 {
		t.Fatal("admin đổi được hạn dùng?")
	}
	// gia hạn: xoá mốc bằng lệnh riêng
	n := len(repo.updates)
	s.UpdateCongTy(ctx, super, "c1", omap.Of("hanDung", "2027-10-22"))
	if got := repo.updates[n:]; len(got) != 2 || got[1] != `c1 {"nhac_moc":null,"nhac_lan_cuoi":null}` {
		t.Errorf("gia hạn phải xoá mốc: %v", got)
	}
	// bỏ hạn dùng (""): cũng là đổi hạn, nhưng mốc đã null -> không có lệnh thừa
	n = len(repo.updates)
	s.UpdateCongTy(ctx, super, "c1", omap.Of("hanDung", ""))
	s.UpdateCongTy(ctx, super, "c2", omap.Of("hanDung", "2028-01-01"))
	if got := repo.updates[n:]; len(got) != 2 {
		t.Errorf("mốc đang null mà vẫn xoá: %v", got)
	}
}

// TestNhacGiaHanDB: chạy trên Postgres thật (qspro_gotest) - đọc / ghi cột nhac_moc, nhac_lan_cuoi, thông báo và nhật ký.
func TestNhacGiaHanDB(t *testing.T) {
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
	sweep := func() {
		for _, q := range []string{
			"delete from audit_logs where company_id in (select id from companies where code like 'zz-nhacgh%')",
			"delete from notifications where company_id in (select id from companies where code like 'zz-nhacgh%')",
			"delete from users where username like 'zz_nhacgh%'",
			"delete from companies where code like 'zz-nhacgh%'",
		} {
			if _, err := pool.Exec(bg, q); err != nil {
				t.Errorf("dọn dữ liệu thử: %v", err)
			}
		}
	}
	sweep()
	defer sweep()

	no := database.Opt{NoScope: true}
	vn := time.Now().Add(7 * time.Hour)
	han := vn.AddDate(0, 0, 7).Format("2006-01-02")
	ct, err := db.InsertOne(bg, "cong_ty", omap.Of("ten", "ZZ_nhacgh Một", "ma", "zz-nhacgh-1", "active", true, "han_dung", han,
		"nhac_moc", -1.0), no)
	if err != nil {
		t.Fatal(err)
	}
	id := ct[0].Val("id")
	for _, u := range []struct {
		name, role string
		active     bool
	}{{"zz_nhacgh_ad1", "admin", true}, {"zz_nhacgh_ad2", "admin", false}, {"zz_nhacgh_st", "staff", true}} {
		if _, err := db.InsertOne(bg, "users", omap.Of("username", u.name, "ho_ten", u.name, "password_hash", "x", "role", u.role,
			"perms", "", "active", u.active, "cong_ty_id", id), no); err != nil {
			t.Fatal(err)
		}
	}
	// AdminLister thật của module notifications, nối như internal/server/routes.go (chỉ trong test; mã chạy không import chéo)
	au := &auditGia{}
	notifSvc := notifications.New(notifications.Deps{DB: db})
	mk := func() *Service {
		s := New(Deps{DB: db, Auditor: au, Admins: notifSvc})
		s.repo = onlyZZ{s.repo} // công ty khác trong qspro_gotest không bị nhắc thật
		return s
	}
	s := mk()

	r, err := s.NhacGiaHan(bg, true)
	if err != nil {
		t.Fatal(err)
	}
	mine := func(r *omap.Map) *omap.Map {
		for _, x := range jsval.AsArray(r.Val("ds")) {
			if m := jsval.AsMap(x); jsval.ToString(m.Val("id")) == jsval.ToString(id) {
				return m
			}
		}
		return nil
	}
	m := mine(r)
	if m == nil || m.Val("moc") != 7.0 || m.Val("canGui") != true || m.Val("soAdmin") != 1.0 || m.Val("mocCu") != nil {
		t.Fatalf("chạy thử: %s", js(t, m))
	}
	// hai tiến trình cùng database chạy song song: UPDATE có điều kiện chỉ cho một bên giành mốc
	s2 := mk()
	var wg sync.WaitGroup
	for _, x := range []*Service{s, s2} {
		wg.Add(1)
		go func(x *Service) {
			defer wg.Done()
			if _, err := x.NhacGiaHan(bg, false); err != nil {
				t.Error(err)
			}
		}(x)
	}
	wg.Wait()
	rows, _ := db.Select(bg, "notifications", database.SelectOpt{Filter: database.Eq("cong_ty_id", id), NoScope: true})
	if len(rows) != 1 || rows[0].Val("kind") != "expiry_notice" || jsval.ToString(rows[0].Val("ref_id")) != jsval.ToString(id) ||
		rows[0].Val("title") != "Công ty sắp hết hạn sử dụng" {
		t.Fatalf("thông báo: %d dòng %v", len(rows), rows)
	}
	adm, _ := db.Select(bg, "users", database.SelectOpt{Filter: database.Eq("username", "zz_nhacgh_ad1"), NoScope: true})
	if jsval.ToString(rows[0].Val("user_id")) != jsval.ToString(adm[0].Val("id")) {
		t.Errorf("thông báo phải tới zz_nhacgh_ad1: %v", rows[0].Val("user_id"))
	}
	row, _ := db.Select(bg, "cong_ty", database.SelectOpt{Filter: database.Eq("id", id), NoScope: true})
	if jsval.ToNumber(row[0].Val("nhac_moc")) != 7 || jsval.Slice(jsval.ToString(row[0].Val("nhac_lan_cuoi")), 0, 10) != vn.Format("2006-01-02") {
		t.Fatalf("mốc đã ghi: %v %v", row[0].Val("nhac_moc"), row[0].Val("nhac_lan_cuoi"))
	}
	if len(au.calls) != 1 {
		t.Errorf("nhật ký phải có 1 dòng: %v", au.calls)
	}
	r, _ = s.NhacGiaHan(bg, false)
	if mine(r).Val("daGui") != false {
		t.Error("chạy lại mà gửi trùng")
	}
	rows, _ = db.Select(bg, "notifications", database.SelectOpt{Filter: database.Eq("cong_ty_id", id), NoScope: true})
	if len(rows) != 1 {
		t.Errorf("chạy lại: %d thông báo", len(rows))
	}

	// bộ lọc giành / trả mốc trên Postgres thật: -1 coi như chưa nhắc; trả lại đúng giá trị cũ
	if _, err := db.Update(bg, "cong_ty", database.Eq("id", id), omap.Of("nhac_moc", -1.0, "nhac_lan_cuoi", "2026-01-01"), no); err != nil {
		t.Fatal(err)
	}
	homNayVN := vn.Format("2006-01-02")
	if ok, err := s.repo.NhanMocNhac(bg, id, 7, homNayVN); err != nil || !ok {
		t.Fatalf("giành mốc 7 từ -1: %v %v", ok, err)
	}
	if ok, _ := s.repo.NhanMocNhac(bg, id, 7, homNayVN); ok {
		t.Error("giành mốc 7 lần hai mà vẫn được")
	}
	if ok, _ := s.repo.NhanMocNhac(bg, id, 14, homNayVN); ok {
		t.Error("mốc 14 xa hơn mốc 7 đã nhắc mà vẫn giành được")
	}
	if err := s.repo.TraMocNhac(bg, id, 7, homNayVN, -1.0, "2026-01-01"); err != nil {
		t.Fatal(err)
	}
	row, _ = db.Select(bg, "cong_ty", database.SelectOpt{Filter: database.Eq("id", id), NoScope: true})
	if jsval.ToNumber(row[0].Val("nhac_moc")) != -1 || jsval.Slice(jsval.ToString(row[0].Val("nhac_lan_cuoi")), 0, 10) != "2026-01-01" {
		t.Fatalf("trả mốc: %v %v", row[0].Val("nhac_moc"), row[0].Val("nhac_lan_cuoi"))
	}

	// gia hạn -> xoá mốc
	ctx := tenant.With(bg, tenant.Ctx{Role: "super"})
	if _, err := s.UpdateCongTy(ctx, &actor.Actor{UID: nil, U: "zz_nhacgh_sa", R: "super"}, id,
		omap.Of("hanDung", vn.AddDate(1, 0, 0).Format("2006-01-02"))); err != nil {
		t.Fatal(err)
	}
	row, _ = db.Select(bg, "cong_ty", database.SelectOpt{Filter: database.Eq("id", id), NoScope: true})
	if row[0].Val("nhac_moc") != nil || row[0].Val("nhac_lan_cuoi") != nil {
		t.Errorf("gia hạn mà chưa xoá mốc: %v %v", row[0].Val("nhac_moc"), row[0].Val("nhac_lan_cuoi"))
	}
}

// onlyZZ: CongTyCanNhac chỉ trả công ty thử của test này.
type onlyZZ struct{ Repository }

func (o onlyZZ) CongTyCanNhac(ctx context.Context, tu, den string) ([]*omap.Map, error) {
	rows, err := o.Repository.CongTyCanNhac(ctx, tu, den)
	out := []*omap.Map{}
	for _, r := range rows {
		if strings.HasPrefix(jsval.ToString(r.Val("ma")), "zz-nhacgh") {
			out = append(out, r)
		}
	}
	return out, err
}
