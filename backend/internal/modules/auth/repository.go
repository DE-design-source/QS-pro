package auth

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: những gì service cần từ bảng users. Mọi truy vấn đều noScope (lúc đăng nhập chưa biết công ty).
type Repository interface {
	// SessionUser: A:48 - select id,username,role,active,cong_ty_id theo id, limit 1.
	SessionUser(ctx context.Context, uid any) ([]*omap.Map, error)
	// UsersByUsername: A:84 - username = key (đã viết thường), limit 20.
	UsersByUsername(ctx context.Context, username string) ([]*omap.Map, error)
	// UsersByEmail: A:87 - email ilike pattern (đã thoát "_"), limit 20.
	UsersByEmail(ctx context.Context, pattern string) ([]*omap.Map, error)
	// UpdateUser: A:253, 279, 293.
	UpdateUser(ctx context.Context, id any, patch *omap.Map) error
}
