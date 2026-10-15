package notifications

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: những truy vấn service cần. Tất cả CÓ phạm vi công ty của ctx (A:450-464).
type Repository interface {
	// AdminUsers: users có role = admin, không limit (A:450).
	AdminUsers(ctx context.Context) ([]*omap.Map, error)
	Insert(ctx context.Context, row *omap.Map) error
	// UnreadIDs: id các thông báo chưa đọc của uid, limit 500 (A:456).
	UnreadIDs(ctx context.Context, uid any) ([]*omap.Map, error)
	// ListByUser: order created_at.desc (A:460).
	ListByUser(ctx context.Context, uid any, limit int) ([]*omap.Map, error)
	MarkRead(ctx context.Context, id, uid any) error
	MarkAllRead(ctx context.Context, uid any) error
}
