package estimates

import (
	"context"
	"strings"

	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

/*** ===== LỊCH SỬ ===== ***/

// ctHistory (S:1407-1415): ghi nhật ký, NUỐT lỗi - lịch sử không được chặn nghiệp vụ.
func (s *Service) ctHistory(ctx context.Context, a *actor.Actor, id any, changes []change) {
	if !jsval.Truthy(id) || len(changes) == 0 {
		return
	}
	rows := make([]*omap.Map, len(changes))
	for i, c := range changes {
		rows[i] = omap.Of("cong_tac_id", id, "field", c.Field, "old_value", jsval.S(c.Old), "new_value", jsval.S(c.New),
			"changed_by", uidOf(a), "changed_by_name", whoOf(a))
	}
	if err := s.repo.InsertHistory(ctx, rows); err != nil && !ctHistThieu(err) {
		logger.Error("cong tac history", err.Error())
	}
}

// ctDiff (S:1417-1429): so dòng cũ với bản vá -> thay đổi có nhãn tiếng Việt. Hai giá trị coi là bằng nhau khi
// parseFloat của cả hai bằng nhau ("5abc" bằng 5).
func ctDiff(cur, row *omap.Map) []change {
	out := []change{}
	for _, k := range row.Keys() {
		if ctDiffSkip[k] {
			continue
		}
		var a any
		if cur != nil {
			a = cur.Val(k)
		}
		sa, sb := jsval.S(a), jsval.S(row.Val(k))
		if sa == sb {
			continue
		}
		if fa, fb := jsval.ParseFloat(sa), jsval.ParseFloat(sb); fa == fa && fb == fb && fa == fb {
			continue
		}
		field, ok := ctFieldLbl[k]
		if !ok {
			field = k
		}
		out = append(out, change{Field: field, Old: sa, New: sb})
	}
	return out
}

/*** ===== GHI ===== ***/

// CtSave = ctSave (S:1372-1393): thêm một hoặc nhiều công tác (bỏ dòng thiếu tên), ghi lịch sử "tạo" theo lô và audit.
func (s *Service) CtSave(ctx context.Context, a *actor.Actor, data any) (*omap.Map, error) {
	who := whoOf(a)
	rows, ok := data.([]any)
	if !ok {
		rows = []any{data}
	}
	body := []*omap.Map{}
	for _, d := range rows {
		// s(d && d.ten).trim(): d falsy thì chính d được đổi ra chuỗi (0 -> "0", false -> "false")
		if jsval.Trim(jsval.S(jsval.And(d, jsval.Get(d, "ten")))) == "" {
			continue
		}
		r, err := ctToRow(d)
		if err != nil {
			return nil, err
		}
		body = append(body, r.Set("nguoi_tao", who).Set("ngay_tao", jsval.NowISO()).Set("da_duyet", false))
	}
	if len(body) == 0 {
		return nil, apperr.New("Chưa có công tác nào để lưu (thiếu tên công việc)")
	}
	out, err := ctTry(func(b []*omap.Map) ([]*omap.Map, error) { return s.repo.InsertCongTac(ctx, b) }, body)
	if err != nil {
		return nil, ctErr(err)
	}
	// ghi nhật ký "tạo" theo LÔ (nhập 200+ dòng vẫn chỉ 1 lần gọi); lỗi bị nuốt
	hs := []*omap.Map{}
	for _, r := range out {
		if r != nil && jsval.Truthy(r.Val("id")) {
			hs = append(hs, omap.Of("cong_tac_id", r.Val("id"), "field", "TẠO CÔNG TÁC", "old_value", "", "new_value", jsval.S(r.Val("ten")),
				"changed_by", uidOf(a), "changed_by_name", who))
		}
	}
	if len(hs) > 0 {
		if err := s.repo.InsertHistory(ctx, hs); err != nil && !ctHistThieu(err) {
			logger.Error("cong tac history", err.Error())
		}
	}
	n := len(body)
	if n > 6 {
		n = 6
	}
	names := make([]string, n)
	for i := range names {
		names[i] = jsval.AsString(body[i].Val("ten"))
	}
	detail := "Thêm " + itoa(len(body)) + " công tác: " + strings.Join(names, ", ")
	if len(body) > 6 {
		detail += "…"
	}
	s.logAudit(ctx, a, "them_cong_tac", detail)
	return omap.Of("ok", float64(len(out)), "rows", ctRows(out)), nil
}

// CtUpdate = ctUpdate (S:1440-1456): sửa một công tác. Chỉ ghi các cột có khoá trong patch, nhưng LUÔN đưa
// trạng thái về "Chưa duyệt".
func (s *Service) CtUpdate(ctx context.Context, a *actor.Actor, id, patch any) (*omap.Map, error) {
	if !jsval.Truthy(id) {
		return nil, apperr.New("Thiếu id công tác")
	}
	who := whoOf(a)
	full, err := ctToRow(patch)
	if err != nil {
		return nil, err
	}
	pm := jsval.AsMap(patch) // patch không phải object: không khoá nào là của riêng nó
	row := omap.New()
	for _, p := range ctSrc {
		if pm.Has(p[1]) && full.Has(p[0]) {
			row.Set(p[0], full.Val(p[0]))
		}
	}
	row.Set("nguoi_sua", who).Set("ngay_cap_nhat", jsval.NowISO()).Set("da_duyet", false).Set("nguoi_duyet", nil).Set("ngay_duyet", nil)
	truoc, err := s.repo.GetCongTac(ctx, id)
	if err != nil {
		return nil, err
	}
	out, err := ctTry(func(b []*omap.Map) ([]*omap.Map, error) { return s.repo.UpdateCongTac(ctx, id, b[0]) }, []*omap.Map{row})
	if err != nil {
		return nil, ctErr(err)
	}
	if len(out) == 0 {
		return nil, apperr.New("Không tìm thấy công tác để sửa")
	}
	s.ctHistory(ctx, a, id, ctDiff(truoc, row))
	// row.ten || (truoc && truoc.ten)
	var ten any = row.Val("ten")
	if !jsval.Truthy(ten) {
		ten = nil
		if truoc != nil {
			ten = truoc.Val("ten")
		}
	}
	s.logAudit(ctx, a, "sua_cong_tac", "Sửa công tác: "+jsval.S(ten))
	return ctToObj(out[0]), nil
}

// CtDelete = ctDelete (S:1457-1472): xoá từng công tác; lỗi gom tối đa 5 dòng, audit khi có dòng xoá được.
func (s *Service) CtDelete(ctx context.Context, a *actor.Actor, ids any) (*omap.Map, error) {
	ok := 0
	errs := []any{}
	for _, id := range idList(ids) {
		err := func() error {
			cu, err := s.repo.GetCongTac(ctx, id)
			if err != nil {
				return err
			}
			xoa, err := s.repo.RemoveCongTac(ctx, id)
			if err != nil {
				return err
			}
			if len(xoa) == 0 {
				return apperr.New("Không tìm thấy công tác")
			}
			ok++
			old := ""
			if cu != nil {
				old = jsval.S(cu.Val("ten"))
			}
			s.ctHistory(ctx, a, id, []change{{Field: "XOÁ CÔNG TÁC", Old: old, New: "đã xoá"}})
			return nil
		}()
		if err != nil && len(errs) < 5 {
			errs = append(errs, omap.Of("id", id, "error", ctErr(err).Error()))
		}
	}
	if ok > 0 {
		s.logAudit(ctx, a, "xoa_cong_tac", "Xoá "+itoa(ok)+" công tác")
	}
	return batchOut(ok, errs), nil
}

// CtDuyet = ctDuyet (S:1473-1492): duyệt / bỏ duyệt từng công tác.
func (s *Service) CtDuyet(ctx context.Context, a *actor.Actor, ids any, approve bool) (*omap.Map, error) {
	who := whoOf(a)
	var patch *omap.Map
	oldTxt, newTxt := "Đã duyệt", "Chưa duyệt"
	if approve {
		patch = omap.Of("da_duyet", true, "nguoi_duyet", who, "ngay_duyet", jsval.NowISO())
		oldTxt, newTxt = newTxt, oldTxt
	} else {
		patch = omap.Of("da_duyet", false, "nguoi_duyet", nil, "ngay_duyet", nil)
	}
	ok := 0
	errs := []any{}
	for _, id := range idList(ids) {
		r, err := s.repo.UpdateCongTac(ctx, id, patch)
		if err != nil {
			if len(errs) < 5 {
				errs = append(errs, omap.Of("id", id, "error", ctErr(err).Error()))
			}
			continue
		}
		if len(r) > 0 {
			ok++
			s.ctHistory(ctx, a, id, []change{{Field: "TRẠNG THÁI DUYỆT", Old: oldTxt, New: newTxt}})
		}
	}
	if ok > 0 {
		action, verb := "bo_duyet_cong_tac", "Bỏ duyệt "
		if approve {
			action, verb = "duyet_cong_tac", "Duyệt "
		}
		s.logAudit(ctx, a, action, verb+itoa(ok)+" công tác")
	}
	return batchOut(ok, errs), nil
}

// CtFav = ctFav (S:1494-1508): bật / tắt yêu thích ngay trên dòng công tác. Thiếu cột yeu_thich -> dừng cả lệnh.
func (s *Service) CtFav(ctx context.Context, a *actor.Actor, ids any, on bool) (*omap.Map, error) {
	ok := 0
	errs := []any{}
	for _, id := range idList(ids) {
		r, err := s.repo.UpdateCongTac(ctx, id, omap.Of("yeu_thich", on))
		if err != nil {
			if ctMissingCol(err) == "yeu_thich" {
				return nil, apperr.New(`Chưa có cột "yêu thích" trong bảng cong_tac. ` + apperr.HDMig)
			}
			if len(errs) < 5 {
				errs = append(errs, omap.Of("id", id, "error", ctErr(err).Error()))
			}
			continue
		}
		if len(r) > 0 {
			ok++
		}
	}
	return batchOut(ok, errs), nil
}

/*** ===== CỬA NGÕ KIỂM QUYỀN (auth.js:574-596) ===== ***/

// khacFalse: x !== false (thiếu tham số và null đều là true).
func khacFalse(v any) bool {
	b, ok := v.(bool)
	return !ok || b
}

func (s *Service) spPerms(ctx context.Context, a *actor.Actor) (edit, duyet bool, err error) {
	edit, duyet, _, err = s.perms.SpPerms(ctx, a)
	return edit, duyet, err
}

// CtSaveGated = ctSaveGated (A:574-578).
func (s *Service) CtSaveGated(ctx context.Context, a *actor.Actor, data any) (*omap.Map, error) {
	edit, _, err := s.spPerms(ctx, a)
	if err != nil {
		return nil, err
	}
	if !edit {
		return nil, apperr.New("Tài khoản không có quyền thêm dữ liệu")
	}
	return s.CtSave(ctx, a, data)
}

// CtUpdateGated = ctUpdateGated (A:579-583).
func (s *Service) CtUpdateGated(ctx context.Context, a *actor.Actor, id, patch any) (*omap.Map, error) {
	edit, _, err := s.spPerms(ctx, a)
	if err != nil {
		return nil, err
	}
	if !edit {
		return nil, apperr.New("Tài khoản không có quyền sửa dữ liệu")
	}
	return s.CtUpdate(ctx, a, id, patch)
}

// CtDeleteGated = ctDeleteGated (A:584-588).
func (s *Service) CtDeleteGated(ctx context.Context, a *actor.Actor, ids any) (*omap.Map, error) {
	edit, _, err := s.spPerms(ctx, a)
	if err != nil {
		return nil, err
	}
	if !edit {
		return nil, apperr.New("Tài khoản không có quyền xoá dữ liệu")
	}
	return s.CtDelete(ctx, a, ids)
}

// CtDuyetGated = ctDuyetGated (A:589-593): approve !== false.
func (s *Service) CtDuyetGated(ctx context.Context, a *actor.Actor, ids, approve any) (*omap.Map, error) {
	_, duyet, err := s.spPerms(ctx, a)
	if err != nil {
		return nil, err
	}
	if !duyet {
		return nil, apperr.New("Tài khoản không có quyền duyệt")
	}
	return s.CtDuyet(ctx, a, ids, khacFalse(approve))
}

// CtFavGated = ctFavGated (A:594-596): yêu thích là dấu trang của công ty, ai đăng nhập cũng bật / tắt được.
func (s *Service) CtFavGated(ctx context.Context, a *actor.Actor, ids, on any) (*omap.Map, error) {
	return s.CtFav(ctx, a, ids, khacFalse(on))
}
