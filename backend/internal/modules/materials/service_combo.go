package materials

import (
	"context"
	"regexp"
	"strings"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/qscore"
)

var reComboMissing = regexp.MustCompile(`(?i)(does not exist|schema cache|PGRST205|404)`)

// comboMissing = comboMissing_ (S:837): chưa có bảng sp_combo.
func comboMissing(err error) bool {
	m := err.Error()
	return strings.Contains(m, "sp_combo") && reComboMissing.MatchString(m)
}

// n1 = n(v) || 1.
func n1(v any) float64 {
	if f := qscore.N(v); f != 0 {
		return f
	}
	return 1
}

func joinIDs(ids []any) string { // ids.join(',')
	parts := make([]string, len(ids))
	for i, id := range ids {
		if !jsval.IsNullish(id) {
			parts[i] = jsval.ToString(id)
		}
	}
	return strings.Join(parts, ",")
}

// GetCombo = getCombo (S:806-836): đối tác combo của 1 sản phẩm, gộp HAI chiều (chiều xuôi được ưu tiên nếu trùng).
func (s *Service) GetCombo(ctx context.Context, key any) ([]any, error) {
	cur, err := s.GetDbProduct(ctx, key)
	if err != nil {
		return nil, err
	}
	if cur == nil {
		return []any{}, nil
	}
	curID := cur.Val("id")
	fw, err := s.repo.Select(ctx, "sp_combo", database.SelectOpt{Filter: database.Eq("sp_id", curID), Order: "sort_no.asc", Limit: 100})
	var bw []*omap.Map
	if err == nil {
		bw, err = s.repo.Select(ctx, "sp_combo", database.SelectOpt{Filter: database.Eq("sp_kem_id", curID), Order: "sort_no.asc", Limit: 100})
	}
	if err != nil {
		// CHỈ nuốt khi chưa có bảng. Lỗi khác phải báo lên - trả [] thì form sửa tưởng "không có combo" rồi lưu đè xoá hết
		if comboMissing(err) {
			return []any{}, nil
		}
		return nil, err
	}
	type link struct {
		id, rowID any
		sl, boSL  float64
		gc        string
		nguoc     bool
	}
	seen := map[string]bool{}
	self := jsval.ToString(curID)
	var links []link
	for _, r := range fw {
		id := jsval.ToString(r.Val("sp_kem_id"))
		if id == self || seen[id] {
			continue
		}
		seen[id] = true
		links = append(links, link{id: r.Val("sp_kem_id"), sl: n1(r.Val("so_luong")), gc: jsval.S(r.Val("ghi_chu")), rowID: r.Val("id")})
	}
	for _, r := range bw {
		id := jsval.ToString(r.Val("sp_id"))
		if id == self || seen[id] {
			continue
		}
		seen[id] = true
		links = append(links, link{id: r.Val("sp_id"), sl: 1, gc: jsval.S(r.Val("ghi_chu")), rowID: r.Val("id"), nguoc: true, boSL: n1(r.Val("so_luong"))})
	}
	if len(links) == 0 {
		return []any{}, nil
	}
	ids := make([]any, len(links))
	for i, x := range links {
		ids[i] = x.id
	}
	sps, err := s.repo.Select(ctx, "db_san_pham", database.SelectOpt{Select: "*", Filter: "id=in.(" + joinIDs(ids) + ")", Limit: 200, NoScope: true})
	if err != nil {
		return nil, err
	}
	by := map[string]*omap.Map{}
	for _, r := range sps {
		by[jsval.ToString(r.Val("id"))] = r
	}
	out := []any{}
	for _, x := range links {
		r := by[jsval.ToString(x.id)]
		if r == nil {
			continue
		}
		o := prodToObj(r)
		o.Set("comboSL", x.sl).Set("comboGhiChu", x.gc).Set("comboId", x.rowID)
		o.Set("comboNguoc", x.nguoc) // liên kết được đặt từ phía sản phẩm kia
		if x.nguoc {
			o.Set("comboBoSL", x.boSL) // bộ gốc: 1 <sp kia> + boSL <sp này>
		}
		out = append(out, o)
	}
	return out, nil
}

// SetCombo = setCombo (S:855-896): ghi đè danh sách sản phẩm đi kèm.
// D-13: các bước ghi sp_combo (ghiCombo) chạy trong 1 transaction - lỗi giữa chừng không còn combo ghi dở
// (Node để lại phần đã ghi). Lịch sử / audit / cacheClear chạy SAU khi commit, như thứ tự cũ.
func (s *Service) SetCombo(ctx context.Context, a *actor.Actor, key any, items any) (*omap.Map, error) {
	cur, err := s.GetDbProduct(ctx, key)
	if err != nil {
		return nil, err
	}
	if cur == nil {
		return nil, apperr.New("Không tìm thấy sản phẩm.")
	}
	if err := s.guardSpChung(ctx, key); err != nil {
		return nil, err
	}
	curID := cur.Val("id")
	self := jsval.ToString(curID)
	goc := jsval.AsArray(items)
	var list []*omap.Map
	seen := map[string]bool{}
	for _, it := range goc {
		x := jsval.AsMap(it) // phần tử không phải object thì x.id là undefined -> bị lọc
		id := x.Val("id")
		if x == nil || !jsval.Truthy(id) || jsval.ToString(id) == self {
			continue
		}
		if k := jsval.ToString(id); !seen[k] {
			seen[k] = true
			list = append(list, x)
		}
	}
	// Chặn xoá nhầm: gửi lên có sản phẩm nhưng không cái nào hợp lệ là lỗi payload, không phải ý muốn xoá sạch
	if len(goc) > 0 && len(list) == 0 {
		return nil, apperr.New("Danh sách sản phẩm đi kèm không hợp lệ (thiếu id) — không thay đổi combo. Tải lại trang rồi thử lại.")
	}
	keep := map[string]*omap.Map{}
	for _, x := range list {
		keep[jsval.ToString(x.Val("id"))] = x
	}
	if err := s.tx(ctx, func(ctx context.Context) error { return s.ghiCombo(ctx, curID, list, keep) }); err != nil {
		return nil, tblErr(err, "sp_combo")
	}
	ma, n := jsval.S(cur.Val("ma_sp")), jsval.ToString(float64(len(list)))
	moi := "Bỏ hết"
	if len(list) > 0 {
		moi = n + " sản phẩm"
	}
	s.spHistory(ctx, a, ma, []change{{"SẢN PHẨM ĐI KÈM", "", moi}})
	s.logAudit(ctx, a, "sua_combo", "Đặt "+n+" sản phẩm đi kèm cho "+ma+" ("+jsval.S(cur.Val("ten_sp"))+")")
	s.cacheClear()
	return omap.Of("ok", true, "count", float64(len(list))), nil
}

// ghiCombo: khối try của setCombo (S:866-890).
func (s *Service) ghiCombo(ctx context.Context, curID any, list []*omap.Map, keep map[string]*omap.Map) error {
	bw, err := s.repo.Select(ctx, "sp_combo", database.SelectOpt{Filter: database.Eq("sp_kem_id", curID), Limit: 100})
	if err != nil {
		return err
	}
	// 1) liên kết do bên kia đặt, nay bị bỏ -> xoá
	boDi := []any{}
	giuLai := map[string]bool{}
	for _, r := range bw {
		spID := jsval.ToString(r.Val("sp_id"))
		x := keep[spID]
		if x == nil {
			boDi = append(boDi, r.Val("id"))
		} else if n1(x.Val("soLuong")) == 1 {
			// 2) vẫn giữ và số lượng phía này là 1 -> để nguyên dòng của bên kia, không ghi đè
			giuLai[spID] = true
		}
	}
	if len(boDi) > 0 {
		if _, err := s.repo.Remove(ctx, "sp_combo", "id=in.("+joinIDs(boDi)+")"); err != nil {
			return err
		}
	}
	// 3) phần mình sở hữu: cặp đã có -> sửa tại chỗ, cặp mới -> chèn, cặp bị bỏ -> xoá SAU CÙNG
	cu, err := s.repo.Select(ctx, "sp_combo", database.SelectOpt{Select: "id,sp_kem_id", Filter: database.Eq("sp_id", curID), Limit: 200})
	if err != nil {
		return err
	}
	daCo := map[string]any{}
	for _, r := range cu {
		daCo[jsval.ToString(r.Val("sp_kem_id"))] = r.Val("id")
	}
	var rows []*omap.Map
	for _, x := range list {
		if giuLai[jsval.ToString(x.Val("id"))] {
			continue
		}
		rows = append(rows, omap.Of("sp_id", curID, "sp_kem_id", jsval.ToNumber(x.Val("id")), "so_luong", n1(x.Val("soLuong")),
			"ghi_chu", jsval.S(x.Val("ghiChu")), "sort_no", float64(len(rows))))
	}
	giu := map[string]bool{}
	var moi []*omap.Map
	for _, r := range rows {
		id := daCo[jsval.ToString(r.Val("sp_kem_id"))]
		if !jsval.Truthy(id) {
			moi = append(moi, r)
		}
	}
	for _, r := range rows {
		id := daCo[jsval.ToString(r.Val("sp_kem_id"))]
		if !jsval.Truthy(id) {
			continue
		}
		giu[jsval.ToString(id)] = true
		if _, err := s.repo.Update(ctx, "sp_combo", database.Eq("id", id),
			omap.Of("so_luong", r.Val("so_luong"), "ghi_chu", r.Val("ghi_chu"), "sort_no", r.Val("sort_no"))); err != nil {
			return err
		}
	}
	if len(moi) > 0 {
		if _, err := s.repo.Insert(ctx, "sp_combo", moi); err != nil {
			return err
		}
	}
	bo := []any{}
	for _, r := range cu {
		if !giu[jsval.ToString(r.Val("id"))] {
			bo = append(bo, r.Val("id"))
		}
	}
	if len(bo) > 0 {
		if _, err := s.repo.Remove(ctx, "sp_combo", "id=in.("+joinIDs(bo)+")"); err != nil {
			return err
		}
	}
	return nil
}

// btMissing = btMissing_ (S:901).
func btMissing(err error) bool { return strings.Contains(err.Error(), "nhom_bt") }

// GetBienThe = getBienThe (S:902-911): các sản phẩm cùng nhóm biến thể tự gom, không kể chính nó.
func (s *Service) GetBienThe(ctx context.Context, key any) ([]any, error) {
	cur, err := s.GetDbProduct(ctx, key)
	if err != nil {
		return nil, err
	}
	out := []any{}
	if cur == nil {
		return out, nil
	}
	g := jsval.Trim(jsval.S(cur.Val("nhom_bt")))
	if g == "" {
		return out, nil
	}
	rows, err := s.repo.Select(ctx, "db_san_pham", database.SelectOpt{Select: "*", Filter: database.Eq("nhom_bt", g), Order: "ten_sp.asc", Limit: 200})
	if err != nil {
		if btMissing(err) { // chưa chạy migration -> coi như chưa gom
			return out, nil
		}
		return nil, err
	}
	self := jsval.ToString(cur.Val("id"))
	for _, r := range rows {
		if jsval.ToString(r.Val("id")) != self {
			out = append(out, prodToObj(r).Set("nhomBT", g))
		}
	}
	return out, nil
}

// SetBienThe = setBienThe (S:913-949): ghi đè nhóm biến thể (ids = sản phẩm cùng nhóm, không kể chính nó).
// D-13: ghiBienThe (trả SP bị bỏ về không nhóm rồi gán nhóm mới) chạy trong 1 transaction - lỗi ở lệnh sau không còn
// để SP cũ đã rời nhóm mà nhóm mới chưa gán (Node để lại). Lịch sử / audit / cacheClear SAU khi commit.
func (s *Service) SetBienThe(ctx context.Context, a *actor.Actor, key any, ids any) (*omap.Map, error) {
	cur, err := s.GetDbProduct(ctx, key)
	if err != nil {
		return nil, err
	}
	if cur == nil {
		return nil, apperr.New("Không tìm thấy sản phẩm.")
	}
	if err := s.guardSpChung(ctx, key); err != nil {
		return nil, err
	}
	goc := jsval.AsArray(ids)
	self := jsval.ToString(cur.Val("id"))
	seen := map[string]bool{}
	list := []any{}
	for _, x := range goc {
		// nhận id dạng số / chuỗi hoặc object {id}
		if m := jsval.AsMap(x); m != nil && !jsval.IsNullish(m.Val("id")) {
			x = m.Val("id")
		}
		id := jsval.Trim(jsval.ToString(x))
		if !isDigits(id) || id == self || seen[id] {
			continue
		}
		seen[id] = true
		list = append(list, id)
	}
	// Chặn xoá nhầm: gửi lên có sản phẩm nhưng không cái nào hợp lệ -> lỗi payload
	if len(goc) > 0 && len(list) == 0 {
		return nil, apperr.New("Danh sách biến thể không hợp lệ (thiếu id) — không thay đổi nhóm. Tải lại trang rồi thử lại.")
	}
	cu := jsval.Trim(jsval.S(cur.Val("nhom_bt")))
	if err := s.tx(ctx, func(ctx context.Context) error { return s.ghiBienThe(ctx, cur, cu, list, seen) }); err != nil {
		if btMissing(err) {
			return nil, apperr.New("Chưa có cột nhom_bt. " + apperr.HDMig)
		}
		return nil, tblErr(err, "db_san_pham")
	}
	ma, n := jsval.S(cur.Val("ma_sp")), jsval.ToString(float64(len(list)))
	moi := "Bỏ nhóm"
	if len(list) > 0 {
		moi = n + " sản phẩm cùng nhóm"
	}
	s.spHistory(ctx, a, ma, []change{{"BIẾN THỂ", "", moi}})
	s.logAudit(ctx, a, "sua_bien_the", "Gom "+n+" biến thể cho "+ma+" ("+jsval.S(cur.Val("ten_sp"))+")")
	s.cacheClear()
	return omap.Of("ok", true, "count", float64(len(list))), nil
}

// ghiBienThe: khối try của setBienThe (S:927-940).
func (s *Service) ghiBienThe(ctx context.Context, cur *omap.Map, cu string, list []any, seen map[string]bool) error {
	bo := omap.Of("nhom_bt", nil)
	if len(list) == 0 { // bỏ hết -> giải tán nhóm
		if cu == "" {
			return nil
		}
		_, err := s.repo.Update(ctx, "db_san_pham", database.Eq("nhom_bt", cu), bo)
		return err
	}
	self := jsval.ToString(cur.Val("id"))
	g := cu
	if g == "" {
		g = "BT-" + self
	}
	// sản phẩm cũ trong nhóm nhưng nay bị bỏ ra -> trả về không nhóm
	if cu != "" {
		truoc, err := s.repo.Select(ctx, "db_san_pham", database.SelectOpt{Select: "id", Filter: database.Eq("nhom_bt", cu), Limit: 200})
		if err != nil {
			return err
		}
		ra := []any{}
		for _, r := range truoc {
			if id := jsval.ToString(r.Val("id")); id != self && !seen[id] {
				ra = append(ra, r.Val("id"))
			}
		}
		if len(ra) > 0 {
			if _, err := s.repo.Update(ctx, "db_san_pham", "id=in.("+joinIDs(ra)+")", bo); err != nil {
				return err
			}
		}
	}
	_, err := s.repo.Update(ctx, "db_san_pham", "id=in.("+joinIDs(append([]any{cur.Val("id")}, list...))+")", omap.Of("nhom_bt", g))
	return err
}

// GetProductHistory = getProductHistory (S:950-954): 200 dòng lịch sử mới nhất của một MÃ sản phẩm.
func (s *Service) GetProductHistory(ctx context.Context, ma any) ([]any, error) {
	m := jsval.Trim(jsval.S(ma))
	if m == "" {
		return []any{}, nil
	}
	rows, err := s.repo.Select(ctx, "db_san_pham_history", database.SelectOpt{Filter: database.Eq("ma_sp", m), Order: "changed_at.desc", Limit: 200})
	if err != nil {
		return nil, err
	}
	out := make([]any, len(rows))
	for i, r := range rows {
		out[i] = omap.Of("field", jsval.S(r.Val("field")), "old", jsval.S(r.Val("old_value")), "new", jsval.S(r.Val("new_value")),
			"by", jsval.S(r.Val("changed_by_name")), "at", jsval.S(r.Val("changed_at")))
	}
	return out, nil
}

// SetComboGated = setComboGated (A:553-557).
func (s *Service) SetComboGated(ctx context.Context, a *actor.Actor, key any, items any) (*omap.Map, error) {
	edit, _, _, err := s.SpPerms(ctx, a)
	if err != nil {
		return nil, err
	}
	if !edit {
		return nil, apperr.New("Tài khoản không có quyền sửa sản phẩm")
	}
	return s.SetCombo(ctx, a, key, items)
}

// SetBienTheGated = setBienTheGated (A:559-563).
func (s *Service) SetBienTheGated(ctx context.Context, a *actor.Actor, key any, ids any) (*omap.Map, error) {
	edit, _, _, err := s.SpPerms(ctx, a)
	if err != nil {
		return nil, err
	}
	if !edit {
		return nil, apperr.New("Tài khoản không có quyền sửa sản phẩm")
	}
	return s.SetBienThe(ctx, a, key, ids)
}
