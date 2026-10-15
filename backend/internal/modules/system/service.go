// Package system: module MẪU - không mở hàm API hay route nào, chỉ để minh hoạ khuôn của một module
// (New(Deps) -> *Service, RegisterRPC, RegisterRoutes) và giữ cho phần nối module biên dịch được.
// Module nghiệp vụ thật chép khuôn này; xem docs/ARCHITECTURE.md.
package system

import (
	"context"

	"qspro-backend/internal/config"
	"qspro-backend/internal/platform/database"
)

// Deps: những gì module cần, do internal/server/routes.go truyền vào.
// Phụ thuộc sang module khác khai báo ở đây dưới dạng interface nhỏ của CHÍNH gói này.
type Deps struct {
	DB  *database.DB
	Cfg *config.Config
}

// Service: nghiệp vụ của module.
type Service struct {
	db  *database.DB
	cfg *config.Config
}

// New tạo service.
func New(d Deps) *Service { return &Service{db: d.DB, cfg: d.Cfg} }

// Ready: database đã cấu hình và truy vấn được chưa (dùng trong test khởi động).
func (s *Service) Ready(ctx context.Context) error {
	_, err := s.db.Select(ctx, "cong_ty", database.SelectOpt{Select: "id", Limit: 1})
	return err
}
