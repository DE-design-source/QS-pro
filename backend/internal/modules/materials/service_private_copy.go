package materials

import (
	"context"
	"strings"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// M10.1 - "Tạo bản sao riêng": chép một sản phẩm kho chung Dezon sang công ty đang đăng nhập. Chỉ bản Go
// (route POST /api/v1/products/:key/private-copy), Node không có hàm tương ứng.

// boQuaKhiSaoChep: cột không chép sang bản sao - khoá / công ty, trạng thái duyệt, người / ngày tạo - sửa của Dezon,
// nhóm biến thể (bản sao đứng riêng, không kéo biến thể / combo theo) và cột sinh tự động gia_dai_ly.
var boQuaKhiSaoChep = map[string]bool{
	"id": true, "cong_ty_id": true, "da_duyet": true, "nguoi_duyet": true, "ngay_duyet": true,
	"nguoi_tao": true, "ngay_tao": true, "nguoi_sua": true, "ngay_cap_nhat": true, "nhom_bt": true, "gia_dai_ly": true,
}

const (
	loiKhongQuyenThem  = "Tài khoản không có quyền thêm dữ liệu"
	loiChuaDungKhoDz   = "Công ty chưa được dùng kho chung Dezon"
	loiKhongCoTrongKho = "Không tìm thấy sản phẩm trong kho chung"
	lsSaoChepKhoDezon  = "SAO CHÉP TỪ KHO DEZON"
)

// quyenSaoChep: phép thử canTab('sanpham') của giao diện (state/store.js), nút chỉ có trong tab Danh sách sản phẩm:
// super được hết; công ty có danh sách tính năng (tinh_nang) mà thiếu 'sanpham' thì không ai được; admin được;
// nhân viên cần quyền sửa của SpPerms VÀ được cấp tab 'sanpham'.
// GIẢ ĐỊNH M10.1: SpPerms luôn cho nhân viên quyền sửa (edit = sp_edit || sp_duyet, chưa cấu hình gì cũng được), nên
// riêng quyền sửa không chặn được ai; điều kiện tab + tính năng công ty là phần thêm của bản Go, khác createProductGated.
func (s *Service) quyenSaoChep(ctx context.Context, a *actor.Actor) (bool, error) {
	edit, _, admin, err := s.SpPerms(ctx, a)
	if err != nil || !edit {
		return false, err
	}
	if a.R == "super" {
		return true, nil
	}
	if t := tenant.TenantID(ctx); jsval.Truthy(t) {
		ct, err := s.repo.Select(ctx, "cong_ty", database.SelectOpt{Select: "tinh_nang", Filter: database.Eq("id", t), Limit: 1, NoScope: true})
		if err != nil {
			return false, err
		}
		if len(ct) > 0 && !coTinhNang(ct[0].Val("tinh_nang"), "sanpham") {
			return false, nil
		}
	}
	if admin {
		return true, nil
	}
	u, err := s.users.GetByID(ctx, a.UID)
	if err != nil || u == nil {
		return false, err
	}
	for _, p := range s.userFmt.PermsArr(u.Val("perms")) {
		if p == "sanpham" {
			return true, nil
		}
	}
	return false, nil
}

// coTinhNang = ctHasFeature_: danh sách tính năng rỗng = được mọi tab.
func coTinhNang(v any, tab string) bool {
	co := false
	for _, x := range strings.Split(jsval.Str(v), ",") {
		if x = jsval.Trim(x); x != "" {
			if x == tab {
				return true
			}
			co = true
		}
	}
	return !co
}

// trungBienThe: phép kiểm trùng MÃ SP + trục biến thể của SaveDbProduct (service_write.go), trong công ty hiện hành
// (ngành trống thì suy từ hạng mục, như SaveDbProduct làm trước khi kiểm).
func (s *Service) trungBienThe(ctx context.Context, ma string, row *omap.Map) (bool, error) {
	keyCols := []string{"nhiet_do_mau_k", "cong_suat_w", "goc_chieu_deg", "mau_sac"}
	if coTrucKichThuoc(row) {
		keyCols = append(keyCols, "kich_thuoc")
	}
	conds := make([]string, len(keyCols))
	for i, col := range keyCols {
		if v := row.Val(col); rong(v) {
			conds[i] = "or(" + col + ".is.null," + col + ".eq.)"
		} else {
			conds[i] = col + ".eq." + jsval.EncodeURIComponent(`"`+reFilterEsc.ReplaceAllString(jsval.ToString(v), `\$0`)+`"`)
		}
	}
	filter := database.Eq("ma_sp", ma) + "&and=(" + strings.Join(conds, ",") + ")"
	ex, err := s.repo.Select(ctx, "db_san_pham", database.SelectOpt{Select: "id", Filter: filter, Limit: 1})
	return len(ex) > 0, err
}

// CopySharedProduct: chép sản phẩm kho chung Dezon (key = id dòng) thành sản phẩm riêng, Chưa duyệt, của công ty hiện hành.
// Giữ mã, tên, thông số, ảnh, tài liệu; không chép combo / biến thể. Trùng mã + trục biến thể -> báo lỗi, không ghi.
func (s *Service) CopySharedProduct(ctx context.Context, a *actor.Actor, key any) (*omap.Map, error) {
	ok, err := s.quyenSaoChep(ctx, a)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperr.New(loiKhongQuyenThem)
	}
	dzID, err := s.spChungID(ctx)
	if err != nil {
		return nil, err
	}
	if !jsval.Truthy(dzID) {
		return nil, apperr.New(loiChuaDungKhoDz)
	}
	k := jsval.Trim(jsval.S(key))
	if !isDigits(k) { // khoá là id dòng: mã trong kho chung không duy nhất (nhiều biến thể cùng mã)
		return nil, apperr.New(loiKhongCoTrongKho)
	}
	src, err := s.repo.Select(ctx, "db_san_pham", database.SelectOpt{Select: "*",
		Filter: database.Eq("id", k) + "&" + database.Eq("cong_ty_id", dzID), Limit: 1, NoScope: true})
	if err != nil {
		return nil, err
	}
	if len(src) == 0 {
		return nil, apperr.New(loiKhongCoTrongKho)
	}
	row := omap.New()
	src[0].Each(func(col string, v any) {
		if !boQuaKhiSaoChep[col] && !rong(v) {
			row.Set(col, v)
		}
	})
	ma, ten := jsval.Trim(jsval.S(row.Val("ma_sp"))), jsval.S(row.Val("ten_sp"))
	if ma != "" {
		trung, err := s.trungBienThe(ctx, ma, row)
		if err != nil {
			return nil, err
		}
		if trung {
			return nil, apperr.New("Công ty bạn đã có sản phẩm mã " + ma)
		}
	}
	who := actorName(a, "")
	if who != "" && !s.whoColMissing.Load() {
		row.Set("nguoi_tao", who).Set("ngay_tao", jsval.NowISO())
	}
	loiTrung := func(err error) error { // hai yêu cầu cùng qua phép kiểm: unique index uq_products_... báo 23505
		if database.CodeOf(err) == "23505" {
			return apperr.New("Công ty bạn đã có sản phẩm mã " + ma)
		}
		return nil
	}
	res, err := s.repo.InsertOne(ctx, "db_san_pham", row)
	if err != nil {
		if e := loiTrung(err); e != nil {
			return nil, e
		}
		if !whoColMissingErr(err) {
			return nil, apperr.ColErr(err)
		}
		row.Delete("nguoi_tao")
		row.Delete("ngay_tao")
		s.whoColMissing.Store(true)
		if res, err = s.repo.InsertOne(ctx, "db_san_pham", row); err != nil {
			if e := loiTrung(err); e != nil {
				return nil, e
			}
			return nil, err
		}
	}
	s.cacheClear()
	maLS, moi := ma, ten+" (từ SP #"+k+" kho Dezon)"
	if maLS == "" {
		maLS = ten
	}
	if who != "" {
		moi += " (bởi " + who + ")"
	}
	s.spHistory(ctx, a, maLS, []change{{lsSaoChepKhoDezon, "", moi}})
	s.logAudit(ctx, a, "sao_chep_sp_dezon", "Tạo bản sao riêng SP "+ma+" ("+ten+") từ kho chung Dezon")
	var id any = jsval.Undefined
	if len(res) > 0 && res[0] != nil {
		id = res[0].Val("id")
	}
	return omap.Of("ok", true, "id", id, "ma", ma, "ten", ten), nil
}
