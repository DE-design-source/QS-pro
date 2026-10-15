// Package companies: CÔNG TY (multi-tenant) - bản chuyển 1:1 của server/auth.js dòng 41-42 và 92-211.
package companies

import (
	"context"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf16"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"golang.org/x/text/unicode/norm"

	"qspro-backend/internal/config"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/contracts"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Deps: do internal/server/routes.go truyền vào. Ba interface đều do module users cài.
type Deps struct {
	DB            *database.DB
	Cfg           *config.Config
	UserCreator   contracts.UserCreator
	UserFormatter contracts.UserFormatter
	Auditor       contracts.Auditor
}

// Service: nghiệp vụ công ty.
type Service struct {
	repo    Repository
	cfg     *config.Config
	creator contracts.UserCreator
	fmtUser contracts.UserFormatter
	auditor contracts.Auditor
	now     func() time.Time

	// _shareCol (A:93): nil = chưa dò; dò 1 lần rồi giữ suốt đời tiến trình, kể cả khi lần dò lỗi.
	shareMu  sync.Mutex
	shareCol *bool
}

var _ contracts.CompanyReader = (*Service)(nil)

// New tạo service.
func New(d Deps) *Service {
	return &Service{repo: newPgRepo(d.DB), cfg: d.Cfg, creator: d.UserCreator, fmtUser: d.UserFormatter,
		auditor: d.Auditor, now: time.Now}
}

func roleOf(a *actor.Actor) string {
	if a == nil {
		return ""
	}
	return a.R
}

// needActor: actor.r khi actor là null -> TypeError như V8 (cổng rpc luôn truyền actor nên không tới được từ ngoài).
func needActor(a *actor.Actor) error {
	if a == nil {
		return apperr.New("Cannot read properties of null (reading 'r')")
	}
	return nil
}

func (s *Service) audit(ctx context.Context, a *actor.Actor, action, detail string) {
	if s.auditor != nil {
		s.auditor.Audit(ctx, a, action, detail, nil)
	}
}

// todayVN: hôm nay theo giờ Việt Nam "YYYY-MM-DD" (A:41).
func (s *Service) todayVN() string {
	return jsval.ToISOString(s.now().Add(7 * time.Hour))[:10]
}

// less16: a < b của JS (so theo đơn vị UTF-16).
func less16(a, b string) bool {
	x, y := utf16.Encode([]rune(a)), utf16.Encode([]rune(b))
	for i := 0; i < len(x) && i < len(y); i++ {
		if x[i] != y[i] {
			return x[i] < y[i]
		}
	}
	return len(x) < len(y)
}

// HetHan: gói của công ty đã hết hạn chưa (A:42) - so CHUỖI ngày.
func (s *Service) HetHan(ct *omap.Map) bool {
	if ct == nil {
		return false
	}
	hd := ct.Val("hanDung")
	if !jsval.Truthy(hd) {
		return false
	}
	return less16(jsval.Slice(jsval.ToString(hd), 0, 10), s.todayVN())
}

// hasShareCol: cột dung_sp_dezon có tồn tại chưa (A:94-99).
func (s *Service) hasShareCol(ctx context.Context) bool {
	s.shareMu.Lock()
	if s.shareCol != nil {
		v := *s.shareCol
		s.shareMu.Unlock()
		return v
	}
	s.shareMu.Unlock()
	ok := s.repo.ProbeShareCol(ctx) == nil // mọi lỗi -> false (Node cũng nuốt)
	s.shareMu.Lock()
	s.shareCol = &ok
	s.shareMu.Unlock()
	return ok
}

// splitTrim: String(v || "").split(",") -> trim -> bỏ phần tử rỗng.
func splitTrim(v any) []any {
	out := []any{}
	for _, x := range strings.Split(jsval.StrOr(v, ""), ",") {
		if x = jsval.Trim(x); x != "" {
			out = append(out, x)
		}
	}
	return out
}

func notFalse(v any) bool {
	b, ok := v.(bool)
	return !ok || b
}

// ctOut: dòng cong_ty -> object cho client (A:100-106).
func ctOut(r *omap.Map) *omap.Map {
	return omap.Of(
		"id", r.Val("id"), "ten", jsval.Or(r.Val("ten"), ""), "ma", jsval.Or(r.Val("ma"), ""),
		"logoUrl", jsval.Or(r.Val("logo_url"), ""), "mauChinh", jsval.Or(r.Val("mau_chinh"), ""),
		"tinhNang", splitTrim(r.Val("tinh_nang")),
		"gioiHanUser", jsval.Num0(r.Val("gioi_han_user")), "active", notFalse(r.Val("active")),
		"hanDung", jsval.Or(r.Val("han_dung"), ""), "ghiChu", jsval.Or(r.Val("ghi_chu"), ""),
		"ngayTao", jsval.Or(r.Val("ngay_tao"), ""),
		"email", jsval.Or(r.Val("email"), ""), "sdt", jsval.Or(r.Val("sdt"), ""),
		"dungSpDezon", r.Val("dung_sp_dezon") == true)
}

// GetCongTy: công ty theo id (noScope) hoặc nil (A:107-111).
func (s *Service) GetCongTy(ctx context.Context, id any) (*omap.Map, error) {
	if !jsval.Truthy(id) {
		return nil, nil
	}
	rows, err := s.repo.CongTyByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return ctOut(rows[0]), nil
}

// ListCongTy: mọi công ty kèm số tài khoản - chỉ super (A:113-122).
func (s *Service) ListCongTy(ctx context.Context, a *actor.Actor) ([]any, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	if roleOf(a) != "super" {
		return nil, apperr.New(msgListSuper)
	}
	rows, err := s.repo.ListCongTy(ctx)
	if err != nil {
		return nil, err
	}
	users, err := s.repo.UserRefs(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]any, len(rows))
	for i, r := range rows {
		o := ctOut(r)
		id := jsval.ToString(r.Val("id"))
		n := 0
		for _, u := range users {
			if jsval.ToString(u.Val("cong_ty_id")) == id {
				n++
			}
		}
		o.Set("soUser", float64(n))
		out[i] = o
	}
	return out, nil
}

var (
	reNonSlug   = regexp.MustCompile(`[^a-z0-9]+`)
	reDashEdges = regexp.MustCompile(`^-+|-+$`)
	lowerMu     sync.Mutex
	lowerCaser  = cases.Lower(language.Und)
)

// jsLower: s.toLowerCase() - ánh xạ đầy đủ của Unicode, không theo ngôn ngữ (strings.ToLower chỉ ánh xạ 1-1).
func jsLower(s string) string {
	lowerMu.Lock() // cases.Caser giữ trạng thái, không dùng song song được
	defer lowerMu.Unlock()
	return lowerCaser.String(lowerU16.Replace(s))
}

// lowerU16: 27 chữ hoa có từ Unicode 16 (Node 22 đã biết) mà bảng của golang.org/x/text chưa có - đổi trước khi qua cases.Lower.
var lowerU16 = func() *strings.Replacer {
	p := []string{"\u1C89", "\u1C8A", "\uA7CB", "\u0264", "\uA7CC", "\uA7CD", "\uA7DA", "\uA7DB", "\uA7DC", "\u019B"}
	for r := rune(0x10D50); r <= 0x10D65; r++ { // Garay
		p = append(p, string(r), string(r+0x20))
	}
	return strings.NewReplacer(p...)
}()

// adminUserOf: String(data.adminUser || "").trim().toLowerCase() (A:141).
func adminUserOf(v any) string { return jsLower(jsval.Trim(jsval.StrOr(v, ""))) }

// slugMa: mã công ty từ chuỗi (A:128-129).
func slugMa(s string) string {
	s = norm.NFD.String(jsLower(s))
	var sb strings.Builder
	for _, r := range s {
		if r >= 0x0300 && r <= 0x036f {
			continue
		}
		sb.WriteRune(r)
	}
	s = strings.ReplaceAll(sb.String(), "đ", "d")
	s = reNonSlug.ReplaceAllString(s, "-")
	s = reDashEdges.ReplaceAllString(s, "")
	return jsval.Slice(s, 0, 32)
}

// tinhNangStr: Array.isArray(v) ? v.join(",") : String(v) - nơi gọi tự lo giá trị falsy.
func tinhNangStr(v any) string {
	return jsval.ToString(v) // String(mảng) = join(",") với null / undefined thành rỗng
}

// CreateCongTy: tạo công ty (+ tài khoản chủ công ty nếu có adminUser / adminPass) - chỉ super (A:123-155).
func (s *Service) CreateCongTy(ctx context.Context, a *actor.Actor, data any) (*omap.Map, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	if roleOf(a) != "super" {
		return nil, apperr.New(msgCreateSuper)
	}
	get := func(k string) any {
		if !jsval.Truthy(data) { // data = data || {}
			return jsval.Undefined
		}
		return jsval.Get(data, k)
	}
	ten := jsval.Trim(jsval.StrOr(get("ten"), ""))
	if ten == "" {
		return nil, apperr.New(msgNoTen)
	}
	// M17.2: chỉ kiểm dạng. Node không lưu mauChinh khi tạo (golden s04 trả ""), nên giao diện lưu màu bằng updateCongTy.
	if err := checkMauChinh(get("mauChinh")); err != nil {
		return nil, err
	}
	ma := slugMa(jsval.ToString(jsval.Or(get("ma"), ten)))
	dup, err := s.repo.CongTyByMa(ctx, ma)
	if err != nil {
		return nil, err
	}
	if len(dup) > 0 {
		return nil, apperr.New(`Mã công ty "` + ma + `" đã tồn tại`)
	}
	var tinhNang string
	if tn := get("tinhNang"); jsval.IsArray(tn) {
		tinhNang = tinhNangStr(tn)
	} else {
		tinhNang = jsval.StrOr(tn, "")
	}
	row := omap.Of("ten", ten, "ma", ma, "logo_url", jsval.StrOr(get("logoUrl"), ""),
		"email", jsval.StrOr(get("email"), ""), "sdt", jsval.StrOr(get("sdt"), ""),
		"tinh_nang", tinhNang,
		"gioi_han_user", jsval.NumOr(get("gioiHanUser"), 10), "active", !jsval.StrictEquals(get("active"), false),
		"han_dung", jsval.Or(get("hanDung"), nil), "ghi_chu", jsval.StrOr(get("ghiChu"), ""))
	if get("dungSpDezon") == true {
		if !s.hasShareCol(ctx) {
			return nil, apperr.New(msgNoShareCol)
		}
		row.Set("dung_sp_dezon", true)
	}
	adminUser := adminUserOf(get("adminUser"))
	coChu := adminUser != "" && jsval.Truthy(get("adminPass"))
	if coChu { // kiểm tra trước để không tạo công ty mồ côi
		du, err := s.repo.UserIDsByName(ctx, adminUser)
		if err != nil {
			return nil, err
		}
		if len(du) > 0 {
			return nil, apperr.New(`Tên đăng nhập "` + adminUser + `" đã có người dùng — chọn tên khác`)
		}
	}
	res, err := s.repo.InsertCongTy(ctx, row)
	if err != nil {
		return nil, err
	}
	if len(res) == 0 {
		return nil, apperr.New("Cannot read properties of undefined (reading 'id')")
	}
	ct := ctOut(res[0])
	// Tạo SAU khi đã chèn công ty: lỗi ở đây để lại công ty (đúng như Node, A:146-152).
	if coChu {
		if _, err := s.creator.AdminCreateUser(ctx, a, omap.Of(
			"username", adminUser, "password", get("adminPass"), "role", "admin", "congTyId", ct.Val("id"),
			"hoTen", jsval.Or(get("adminHoTen"), "Quản trị "+ten),
			"email", jsval.Or(get("adminEmail"), get("email"), ""))); err != nil {
			return nil, err
		}
	}
	s.audit(ctx, a, "create_company", "Tạo công ty "+ten)
	return ct, nil
}

// ListCongTyUsers: tài khoản của 1 công ty - chỉ super (A:157-162).
func (s *Service) ListCongTyUsers(ctx context.Context, a *actor.Actor, congTyID any) ([]any, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	if roleOf(a) != "super" {
		return nil, apperr.New(msgSuperOnly)
	}
	rows, err := s.repo.UsersOfCongTy(ctx, congTyID)
	if err != nil {
		return nil, err
	}
	out := make([]any, len(rows))
	for i, r := range rows {
		out[i] = s.fmtUser.UserOut(r)
	}
	return out, nil
}

// CreateCongTyUser: super tạo tài khoản cho 1 công ty bất kỳ (A:164-168).
func (s *Service) CreateCongTyUser(ctx context.Context, a *actor.Actor, congTyID, data any) (*omap.Map, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	if roleOf(a) != "super" {
		return nil, apperr.New(msgSuperOnly)
	}
	// Object.assign({}, data || {}, {congTyId}): chuỗi / mảng góp khoá chỉ số, số / boolean không góp gì.
	d := omap.New()
	if m := jsval.AsMap(data); m != nil {
		d = m.Clone()
	} else if str, ok := data.(string); ok {
		for i, n := 0, len(utf16.Encode([]rune(str))); i < n; i++ {
			d.Set(strconv.Itoa(i), jsval.Slice(str, i, i+1))
		}
	} else if jsval.IsArray(data) {
		for i, v := range jsval.AsArray(data) {
			d.Set(strconv.Itoa(i), v)
		}
	}
	d.Set("congTyId", congTyID)
	return s.creator.AdminCreateUser(ctx, a, d)
}

// reMauChinh: #RGB hoặc #RRGGBB (M17.2) - dữ liệu cũ có dạng 3 chữ số ("#fff", "#123").
var reMauChinh = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)

// checkMauChinh (M17.2, chỉ bản Go): null / undefined / "" cho qua; còn lại String(v) phải là #RGB hoặc #RRGGBB.
// Không đổi chữ: giá trị hợp lệ lưu nguyên văn như Node.
func checkMauChinh(v any) error {
	if jsval.IsNullish(v) {
		return nil
	}
	if s := jsval.ToString(v); s != "" && !reMauChinh.MatchString(s) {
		return apperr.New(msgMauChinh)
	}
	return nil
}

// UpdateCongTy: super sửa mọi công ty; chủ công ty chỉ sửa công ty mình và vài trường (A:169-198).
func (s *Service) UpdateCongTy(ctx context.Context, a *actor.Actor, id, data any) (*omap.Map, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	isSuper := roleOf(a) == "super"
	if !isSuper {
		if roleOf(a) != "admin" {
			return nil, apperr.New(msgNoPerm)
		}
		if jsval.StrOr(a.CT, "") != jsval.ToString(id) {
			return nil, apperr.New(msgOwnOnly)
		}
	}
	get := func(k string) any {
		if !jsval.Truthy(data) {
			return jsval.Undefined
		}
		return jsval.Get(data, k)
	}
	has := func(k string) bool { return !jsval.IsNullish(get(k)) } // data.k != null
	patch := omap.New()
	if has("ten") {
		patch.Set("ten", jsval.ToString(get("ten")))
	}
	if has("logoUrl") {
		patch.Set("logo_url", jsval.ToString(get("logoUrl")))
	}
	if has("mauChinh") {
		if err := checkMauChinh(get("mauChinh")); err != nil {
			return nil, err
		}
		patch.Set("mau_chinh", jsval.ToString(get("mauChinh")))
	}
	if has("email") {
		patch.Set("email", jsval.ToString(get("email")))
	}
	if has("sdt") {
		patch.Set("sdt", jsval.ToString(get("sdt")))
	}
	if isSuper { // chỉ super được đổi gói dịch vụ
		if has("tinhNang") {
			patch.Set("tinh_nang", tinhNangStr(get("tinhNang")))
		}
		if has("gioiHanUser") {
			patch.Set("gioi_han_user", jsval.Num0(get("gioiHanUser")))
		}
		if has("active") {
			patch.Set("active", jsval.Truthy(get("active")))
		}
		if has("dungSpDezon") {
			if !s.hasShareCol(ctx) {
				if jsval.Truthy(get("dungSpDezon")) {
					return nil, apperr.New(msgNoShareCol)
				}
			} else {
				patch.Set("dung_sp_dezon", jsval.Truthy(get("dungSpDezon")))
			}
		}
		if has("hanDung") {
			patch.Set("han_dung", jsval.Or(get("hanDung"), nil))
		}
		if has("ghiChu") {
			patch.Set("ghi_chu", jsval.ToString(get("ghiChu")))
		}
	}
	if patch.Len() == 0 {
		return s.GetCongTy(ctx, id)
	}
	res, err := s.repo.UpdateCongTy(ctx, id, patch)
	if err != nil {
		return nil, err
	}
	s.audit(ctx, a, "update_company", "Cập nhật công ty "+jsval.ToString(jsval.Or(patch.Val("ten"), id)))
	if len(res) > 0 {
		return ctOut(res[0]), nil
	}
	return s.GetCongTy(ctx, id)
}

// DeleteCongTy: xoá toàn bộ dữ liệu của công ty rồi xoá công ty - chỉ super (A:199-211).
func (s *Service) DeleteCongTy(ctx context.Context, a *actor.Actor, id any) (*omap.Map, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	if roleOf(a) != "super" {
		return nil, apperr.New(msgDeleteSuper)
	}
	ct, err := s.GetCongTy(ctx, id)
	if err != nil {
		return nil, err
	}
	if ct == nil {
		return nil, apperr.New(msgNotFound)
	}
	f := "cong_ty_id=eq." + jsval.EncodeURIComponent(id)
	for _, t := range tenantTablesOrder {
		_ = s.repo.RemoveTenantRows(ctx, t, f) // bỏ qua bảng chưa có cột
	}
	if err := s.repo.RemoveCongTy(ctx, id); err != nil {
		return nil, err
	}
	ten := jsval.ToString(ct.Val("ten"))
	s.audit(ctx, a, "delete_company", "Xoá công ty "+ten+" và toàn bộ dữ liệu")
	return omap.Of("ok", true, "ten", ct.Val("ten")), nil
}
