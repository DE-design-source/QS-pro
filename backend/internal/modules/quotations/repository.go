package quotations

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: những gì service cần từ bảng khai_toan (tờ bìa). du_an và db_bao_gia chỉ đọc qua projects / takeoff.
type Repository interface {
	// CoverRows: dòng tờ bìa của dự án, order sort_no.asc, limit 2000 (S:409).
	CoverRows(ctx context.Context, maDA any) ([]*omap.Map, error)
	// CoverIDs: id các dòng tờ bìa hiện có, limit 2000 (S:432).
	CoverIDs(ctx context.Context, maDA any) ([]*omap.Map, error)
	// InsertCover: ghi các dòng mới (S:435).
	InsertCover(ctx context.Context, rows []*omap.Map) error
	// RemoveCover: xoá theo danh sách id đã nối bằng dấu phẩy (S:438).
	RemoveCover(ctx context.Context, ids string) error
}
