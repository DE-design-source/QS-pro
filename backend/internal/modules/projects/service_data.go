package projects

import (
	"context"
	"slices"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// daDataThieuBang = daDataThieuBang_ (S:1089-1092): chưa có bảng du_an_data.
func daDataThieuBang(err error) bool {
	if err == nil {
		return false
	}
	m := err.Error()
	return reDaData.MatchString(m) && reThieuBang.MatchString(m)
}

// daDataCamQuyen = daDataCamQuyen_ (S:1094-1097): bảng có nhưng chưa được cấp quyền.
func daDataCamQuyen(err error) bool {
	return err != nil && reDaDataQuyen.MatchString(err.Error())
}

// ctyKey = ctyKey_ (S:1101): "__cty:<công ty hoặc 0>".
func ctyKey(ctx context.Context) string {
	return "__cty:" + jsval.ToString(jsval.Or(tenant.TenantID(ctx), "0"))
}

// ctyID = ctyId_ (S:1102): công ty đang xem hoặc nil.
func ctyID(ctx context.Context) any { return jsval.Or(tenant.TenantID(ctx), nil) }

// GetProjData (S:1106-1120): cài đặt dùng chung công ty, rồi dữ liệu riêng của dự án đè lên.
func (s *Service) GetProjData(ctx context.Context, maDA any) (*omap.Map, error) {
	ma := jsval.Trim(jsval.S(maDA))
	out := omap.New()
	if ma == "" {
		return out, nil
	}
	cty, err := s.repo.ListCompanySettings(ctx, !jsval.Truthy(ctyID(ctx)))
	if err != nil {
		return nil, err
	}
	for _, r := range cty {
		out.Set(jsval.S(r.Val("khoa")), r.Val("gia_tri"))
	}
	rows, err := s.repo.ListProjDataKV(ctx, ma)
	if err != nil {
		// chưa cài xong bảng -> coi như chưa có dữ liệu, app vẫn chạy
		if !daDataThieuBang(err) && !daDataCamQuyen(err) {
			return nil, err
		}
		rows = nil
	}
	for _, r := range rows {
		out.Set(jsval.S(r.Val("khoa")), r.Val("gia_tri"))
	}
	return out, nil
}

// SetProjData (S:1122-1153): ghi 1 khoá dữ liệu của dự án, hoặc cài đặt dùng chung công ty khi maDA là "__cty".
func (s *Service) SetProjData(ctx context.Context, a *actor.Actor, maDA, khoa, giaTri any) (*omap.Map, error) {
	ma, k := jsval.Trim(jsval.S(maDA)), jsval.Trim(jsval.S(khoa))
	if ma == "__cty" {
		ma = ctyKey(ctx) // dùng chung trong công ty -> tách theo công ty
	}
	if ma == "" || k == "" {
		return nil, apperr.New("Thiếu mã dự án hoặc khoá dữ liệu")
	}
	if !slices.Contains(projDataKeys, k) {
		return nil, apperr.New("Khoá dữ liệu không hợp lệ: " + k)
	}
	if jsval.IsUndefined(giaTri) {
		giaTri = nil
	}
	nguoiSua := ""
	if a != nil {
		nguoiSua = a.U
	}
	if ma == ctyKey(ctx) {
		cr := omap.Of("khoa", k, "gia_tri", giaTri, "cap_nhat", s.now(), "nguoi_sua", nguoiSua)
		// có công ty: tầng dữ liệu tự lọc / tự gắn công ty. Không có công ty: ghi dòng cong_ty_id NULL.
		kc := !jsval.Truthy(ctyID(ctx))
		loc := database.Eq("khoa", k)
		if kc {
			loc += "&cong_ty_id=is.null"
		}
		co, err := s.repo.FindCompanySetting(ctx, loc, kc)
		if err != nil {
			return nil, err
		}
		if len(co) > 0 {
			err = s.repo.UpdateCompanySetting(ctx, loc, cr, kc)
		} else {
			err = s.repo.InsertCompanySetting(ctx, cr, kc)
		}
		if err != nil {
			return nil, err
		}
		return omap.Of("ok", true), nil
	}
	row := omap.Of("ma_da", ma, "khoa", k, "gia_tri", giaTri, "cap_nhat", s.now(), "nguoi_sua", nguoiSua,
		"cong_ty_id", ctyID(ctx))
	if err := s.upsertProjData(ctx, ma, k, row); err != nil {
		if apperr.KhongCoCha(err) {
			// bản nháp đã bị xoá / không thuộc công ty đang xem: bỏ qua, không tạo dòng mồ côi
			return omap.Of("ok", true), nil
		}
		if daDataThieuBang(err) {
			return nil, apperr.New("Chưa có bảng du_an_data. " + apperr.HDMig)
		}
		if daDataCamQuyen(err) {
			return nil, apperr.New(daDataHD)
		}
		return nil, err
	}
	return omap.Of("ok", true), nil
}

// upsertProjData: đọc trước rồi sửa hoặc thêm (S:1143-1145), không nguyên tử như bên Node.
func (s *Service) upsertProjData(ctx context.Context, ma, k string, row *omap.Map) error {
	cu, err := s.repo.FindProjData(ctx, ma, k)
	if err != nil {
		return err
	}
	if len(cu) > 0 {
		return s.repo.UpdateProjData(ctx, ma, k, row)
	}
	return s.repo.InsertProjData(ctx, row)
}
