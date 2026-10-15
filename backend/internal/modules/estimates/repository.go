package estimates

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: những gì nghiệp vụ công tác cần từ kho dữ liệu. Mỗi phương thức ứng với đúng MỘT lần gọi supa.*
// của Node (cùng bảng, bộ lọc, thứ tự, giới hạn); dòng trao đổi là dòng thô theo tên cột của mã Node.
type Repository interface {
	// ListCongTac: S:1364 - order loai, thu_tu, ngay_tao; limit LIM.
	ListCongTac(ctx context.Context) ([]*omap.Map, error)
	// GetCongTac: S:1448, 1462 - dòng đầu theo id; không có -> nil.
	GetCongTac(ctx context.Context, id any) (*omap.Map, error)
	// InsertCongTac: S:1380.
	InsertCongTac(ctx context.Context, rows []*omap.Map) ([]*omap.Map, error)
	// UpdateCongTac: S:1450, 1482, 1499.
	UpdateCongTac(ctx context.Context, id any, patch *omap.Map) ([]*omap.Map, error)
	// RemoveCongTac: S:1463.
	RemoveCongTac(ctx context.Context, id any) ([]*omap.Map, error)
	// InsertHistory: S:1388, 1410.
	InsertHistory(ctx context.Context, rows []*omap.Map) error
	// ListHistory: S:1434 - 200 dòng mới nhất của một công tác.
	ListHistory(ctx context.Context, id any) ([]*omap.Map, error)
}
