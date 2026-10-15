package takeoff

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: mỗi phương thức là MỘT lệnh supa.* của store_supa.js trên bảng db_bao_gia, trả dòng thô.
// Mã dự án / id dòng để kiểu any vì Node đưa thẳng giá trị client vào supa.eq.
type Repository interface {
	ListLines(ctx context.Context, maDA any) ([]*omap.Map, error)                     // S:332
	MaxSortNo(ctx context.Context, maDA any) ([]*omap.Map, error)                     // S:351
	InsertLine(ctx context.Context, row *omap.Map) ([]*omap.Map, error)               // S:367
	FindLine(ctx context.Context, lineID any) ([]*omap.Map, error)                    // S:380
	UpdateLine(ctx context.Context, lineID any, patch *omap.Map) ([]*omap.Map, error) // S:402
	DeleteLine(ctx context.Context, lineID any) error                                 // S:405
}
