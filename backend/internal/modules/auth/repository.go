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

	// Phiên đăng nhập (bảng phien_dang_nhap = user_sessions, migration 0014, M1.2). Bảng xuyên công ty: noScope.

	// InsertSession: mở phiên cho uid, hết hạn lúc hetHan (ISO) -> id phiên.
	InsertSession(ctx context.Context, uid any, hetHan string) (string, error)
	// SessionAlive: phiên sid của uid còn dòng và chưa quá now (ISO).
	SessionAlive(ctx context.Context, sid string, uid any, now string) (bool, error)
	// RemoveSession: xoá đúng phiên sid (đăng xuất).
	RemoveSession(ctx context.Context, sid string) error
	// RemoveUserSessions: xoá mọi phiên của uid, trừ phiên keep (keep = "" -> xoá hết) -> id các phiên đã xoá.
	RemoveUserSessions(ctx context.Context, uid any, keep string) ([]string, error)
	// RemoveExpiredSessions: dọn phiên đã quá now (ISO) của uid.
	RemoveExpiredSessions(ctx context.Context, uid any, now string) error
}
