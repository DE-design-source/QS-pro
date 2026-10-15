package companies

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: những truy vấn service cần. Mọi truy vấn đều noScope như bên Node (A:96-208).
type Repository interface {
	// ProbeShareCol: đọc thử cột dung_sp_dezon (A:96).
	ProbeShareCol(ctx context.Context) error
	CongTyByID(ctx context.Context, id any) ([]*omap.Map, error)
	CongTyByMa(ctx context.Context, ma string) ([]*omap.Map, error)
	// ListCongTy: order ngay_tao.desc, limit 500 (A:115).
	ListCongTy(ctx context.Context) ([]*omap.Map, error)
	// UserRefs: id, cong_ty_id, active của mọi tài khoản, limit 5000 (A:116).
	UserRefs(ctx context.Context) ([]*omap.Map, error)
	// UserIDsByName: kiểm tra trùng tên đăng nhập (A:143).
	UserIDsByName(ctx context.Context, username string) ([]*omap.Map, error)
	// UsersOfCongTy: order created_at.asc, limit 500 (A:159-160).
	UsersOfCongTy(ctx context.Context, congTyID any) ([]*omap.Map, error)
	InsertCongTy(ctx context.Context, row *omap.Map) ([]*omap.Map, error)
	UpdateCongTy(ctx context.Context, id any, patch *omap.Map) ([]*omap.Map, error)
	// RemoveTenantRows: xoá dòng của 1 bảng theo bộ lọc cong_ty_id (A:206).
	RemoveTenantRows(ctx context.Context, table, filter string) error
	RemoveCongTy(ctx context.Context, id any) error

	// Nhắc gia hạn (M17.3, chỉ bản Go).
	// CongTyCanNhac: công ty active (khác false) có han_dung trong [tu, den], noScope, không giới hạn số dòng.
	CongTyCanNhac(ctx context.Context, tu, den string) ([]*omap.Map, error)
	// NhanMocNhac: UPDATE có điều kiện ghi nhac_moc = moc, nhac_lan_cuoi = ngay khi mốc đang null / ngoài tập mốc / lớn hơn moc;
	// true = dòng này giành được mốc (tiến trình khác đã giành thì false). Chống gửi trùng kể cả nhiều tiến trình.
	NhanMocNhac(ctx context.Context, id any, moc int, ngay string) (bool, error)
	// TraMocNhac: trả lại giá trị cũ khi không gửi được thông báo nào (chỉ khi mốc vẫn là moc / ngay vừa giành).
	TraMocNhac(ctx context.Context, id any, moc int, ngay string, mocCu, ngayCu any) error
	// ChenThongBao: chèn 1 dòng notifications trong phạm vi công ty của ctx, TRẢ lỗi (contracts.Notifier nuốt lỗi chèn).
	ChenThongBao(ctx context.Context, row *omap.Map) error
}
