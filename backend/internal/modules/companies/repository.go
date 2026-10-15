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
}
