package materials

import (
	"context"
	"sort"
	"strings"

	"golang.org/x/text/collate"
	"golang.org/x/text/language"

	"qspro-backend/internal/modules/categories"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/qscore"
	"qspro-backend/internal/shared/tenant"
)

// spChungID = spChungId_ (S:169-176): id công ty Dezon nếu công ty hiện hành được dùng kho chung; không thì nil.
func (s *Service) spChungID(ctx context.Context) (any, error) {
	t := tenant.TenantID(ctx)
	if !jsval.Truthy(t) { // super admin xem toàn hệ thống
		return nil, nil
	}
	me, err := s.repo.Select(ctx, "cong_ty", database.SelectOpt{Filter: database.Eq("id", t), Limit: 1, NoScope: true})
	if err != nil {
		return nil, err
	}
	if len(me) == 0 || me[0].Val("dung_sp_dezon") != true {
		return nil, nil
	}
	dz, err := s.repo.Select(ctx, "cong_ty", database.SelectOpt{Filter: database.Eq("ma", "dezon"), Limit: 1, NoScope: true})
	if err != nil {
		return nil, err
	}
	if len(dz) == 0 || jsval.ToString(dz[0].Val("id")) == jsval.ToString(t) { // chính Dezon thì thôi
		return nil, nil
	}
	return dz[0].Val("id"), nil
}

func khoaBienThe(p *omap.Map) string {
	return jsval.ToString(p.Val("ma")) + "|" + jsval.ToString(p.Val("congSuat")) + "|" + jsval.ToString(p.Val("nhietDo")) + "|" +
		jsval.ToString(p.Val("gocChieu")) + "|" + jsval.ToString(p.Val("mauSac"))
}

// coTrucKichThuoc: kích thước là trục biến thể khi ngành vs / sơn hoặc dòng có kích thước - cùng điều kiện của
// SaveDbProduct (service_write.go); ngành trống thì suy từ hạng mục như SaveDbProduct.
func coTrucKichThuoc(r *omap.Map) bool {
	ng := r.Val("nganh")
	if !jsval.Truthy(ng) {
		ng = categories.NganhCua("", r.Val("hang_muc"))
	}
	return ng == "vs" || ng == "son" || jsval.Truthy(r.Val("kich_thuoc"))
}

// biDe: dòng kho chung r (dạng cột) bị sản phẩm riêng che - kichThuocs là kích thước của các sản phẩm riêng cùng
// khoaBienThe. Không có trục kích thước thì cùng khoaBienThe là đủ; có thì kích thước phải bằng nhau (rỗng = null).
func biDe(kichThuocs []string, r *omap.Map) bool {
	if len(kichThuocs) == 0 {
		return false
	}
	if !coTrucKichThuoc(r) {
		return true
	}
	kt := jsval.S(r.Val("kich_thuoc"))
	for _, x := range kichThuocs {
		if x == kt {
			return true
		}
	}
	return false
}

// ghepKhoChung: phần try của getProducts (S:181-194) - kèm kho chung của Dezon (chỉ đọc) nếu công ty được bật quyền.
func (s *Service) ghepKhoChung(ctx context.Context, out []any) ([]any, error) {
	dzID, err := s.spChungID(ctx)
	if err != nil || !jsval.Truthy(dzID) {
		return out, err
	}
	shared, err := s.repo.Select(ctx, "db_san_pham", database.SelectOpt{Select: "*", Filter: database.Eq("cong_ty_id", dzID),
		Order: "ten_sp.asc", Limit: qscore.LIM, NoScope: true})
	if err != nil {
		return out, err
	}
	// sản phẩm riêng đè kho chung khi trùng ĐỦ khoá kiểm trùng của bản sao riêng (trungBienThe): mã + 4 trục,
	// thêm kích thước khi dòng kho chung có trục này. Chỉ so mã + 4 trục (như Node) thì sao chép biến thể 15L
	// làm ẩn luôn biến thể 1L / 5L cùng mã (M10.1).
	has := map[string][]string{}
	for _, p := range out {
		m := p.(*omap.Map)
		k := khoaBienThe(m)
		has[k] = append(has[k], jsval.S(m.Val("kichThuocVS")))
	}
	for _, r := range shared {
		o := prodToObj(r)
		if biDe(has[khoaBienThe(o)], r) {
			continue
		}
		o.Set("spChung", true) // của kho chung: KHÔNG cho sửa / xoá
		out = append(out, o)
	}
	col := collate.New(language.Vietnamese) // localeCompare(..., 'vi'); Collator không dùng chung giữa các goroutine
	sort.SliceStable(out, func(i, j int) bool {
		return col.CompareString(jsval.ToString(out[i].(*omap.Map).Val("ten")), jsval.ToString(out[j].(*omap.Map).Val("ten"))) < 0
	})
	return out, nil
}

// GetProducts = getProducts (S:177-200): danh mục + kho chung + dấu yêu thích / combo; luôn đọc lại và ghi đè cache.
func (s *Service) GetProducts(ctx context.Context) ([]any, error) {
	rows, err := s.repo.Select(ctx, "db_san_pham", database.SelectOpt{Select: "*", Order: "ten_sp.asc", Limit: qscore.LIM})
	if err != nil {
		return nil, err
	}
	rows = qscore.ChamTran(rows, qscore.LIM, "Danh mục sản phẩm")
	out := make([]any, len(rows))
	for i, r := range rows {
		out[i] = prodToObj(r)
	}
	out, err = s.ghepKhoChung(ctx, out)
	if err != nil && !strings.Contains(err.Error(), "dung_sp_dezon") { // chỉ bỏ qua khi chưa có cột dung_sp_dezon
		return nil, err
	}
	s.stampYeuThich(ctx, out)
	s.stampCombo(ctx, out)
	k := ckey(ctx)
	s.mu.Lock()
	s.cache[k], s.cacheAt[k] = out, jsval.NowMs()
	s.mu.Unlock()
	return out, nil
}

// GetProductsCached = getProductsCached (S:209-213): bản cache 5 phút; trả CHÍNH slice trong cache (chỉ đọc).
func (s *Service) GetProductsCached(ctx context.Context) ([]any, error) {
	k := ckey(ctx)
	s.mu.Lock()
	c, ok := s.cache[k]
	at := s.cacheAt[k]
	s.mu.Unlock()
	if ok && jsval.NowMs()-at < 300000 {
		return c, nil
	}
	return s.GetProducts(ctx)
}

// GetCatalogSheets = getCatalogSheets (S:214-219): danh sách nhom không trùng, theo thứ tự xuất hiện.
func (s *Service) GetCatalogSheets(ctx context.Context) ([]any, error) {
	prods, err := s.GetProductsCached(ctx)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	out := []any{}
	for _, p := range prods {
		g := p.(*omap.Map).Val("nhom")
		if k := jsval.ToString(g); jsval.Truthy(g) && !seen[k] {
			seen[k] = true
			out = append(out, g)
		}
	}
	return out, nil
}

// BuildCatalog = buildCatalog (S:220).
func (s *Service) BuildCatalog(ctx context.Context) (*omap.Map, error) {
	s.cacheClear()
	p, err := s.GetProducts(ctx)
	if err != nil {
		return nil, err
	}
	return omap.Of("count", float64(len(p))), nil
}

// ytIDs = ytIds_ (S:723-729): tập id sản phẩm yêu thích của công ty; lỗi (bảng chưa tạo) -> ok = false.
func (s *Service) ytIDs(ctx context.Context) (map[string]bool, bool) {
	rows, err := s.repo.Select(ctx, "sp_yeu_thich", database.SelectOpt{Select: "sp_id", Limit: qscore.LIM})
	if err != nil {
		return nil, false
	}
	set := map[string]bool{}
	for _, r := range rows {
		set[jsval.ToString(r.Val("sp_id"))] = true
	}
	return set, true
}

// stampCombo = stampCombo_ (S:732-746): comboN = số đối tác combo khác nhau, đếm cả hai chiều.
func (s *Service) stampCombo(ctx context.Context, list []any) {
	rows, err := s.repo.Select(ctx, "sp_combo", database.SelectOpt{Select: "sp_id,sp_kem_id", Limit: qscore.LIM, NoScope: true})
	if err != nil { // chưa có bảng sp_combo -> bỏ qua
		return
	}
	cnt := map[string]map[string]bool{}
	add := func(a, b string) {
		if cnt[a] == nil {
			cnt[a] = map[string]bool{}
		}
		cnt[a][b] = true
	}
	for _, r := range rows {
		a, b := jsval.ToString(r.Val("sp_id")), jsval.ToString(r.Val("sp_kem_id"))
		if a == b {
			continue
		}
		add(a, b)
		add(b, a)
	}
	for _, p := range list {
		m := p.(*omap.Map)
		m.Set("comboN", float64(len(cnt[jsval.ToString(m.Val("recordId"))])))
	}
}

// stampYeuThich = stampYeuThich_ (S:747-751).
func (s *Service) stampYeuThich(ctx context.Context, list []any) {
	set, ok := s.ytIDs(ctx)
	if !ok {
		return
	}
	for _, p := range list {
		m := p.(*omap.Map)
		m.Set("yeuThich", set[jsval.ToString(m.Val("recordId"))])
	}
}
