package reports

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: những gì báo cáo cần từ database. Mọi truy vấn đều noScope (đọc / ghi toàn hệ thống).
type Repository interface {
	// NewProducts: sản phẩm tạo từ mốc tuIso (chuỗi toISOString), mới nhất trước, tối đa 5000 (I:460-461).
	NewProducts(ctx context.Context, tuIso string) ([]*omap.Map, error)
	// Users: mọi tài khoản, tối đa 5000 (I:472).
	Users(ctx context.Context) ([]*omap.Map, error)
	// Companies: id, ten, ma của mọi công ty, tối đa 500 (I:478).
	Companies(ctx context.Context) ([]*omap.Map, error)
	// InsertAudit: ghi dòng audit_log đánh dấu đã gửi báo cáo (I:547-548).
	InsertAudit(ctx context.Context, detail string) error
	// RecentAudits: 5 dòng audit_log mới nhất của báo cáo (I:557-558).
	RecentAudits(ctx context.Context) ([]*omap.Map, error)
}
