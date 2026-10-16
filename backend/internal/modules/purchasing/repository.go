package purchasing

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// Repository: các truy vấn service cần. Tất cả CÓ phạm vi công ty của ctx; dòng trả về là dòng thô của database.
type Repository interface {
	// Đơn mua hàng
	InsertOrder(ctx context.Context, row *omap.Map) error
	InsertOrderItems(ctx context.Context, rows []*omap.Map) error
	// DeleteOrder: xoá chi tiết rồi xoá đơn (S:1186); lỗi ở bước đầu thì bỏ bước sau.
	DeleteOrder(ctx context.Context, maDon any) error
	// OrdersOfProject: order ngay_gui.desc, không limit (S:1194).
	OrdersOfProject(ctx context.Context, maDA any) ([]*omap.Map, error)
	// OrderItems: order sort_no.asc (S:1198, A:628).
	OrderItems(ctx context.Context, maDon any) ([]*omap.Map, error)
	// ListOrders: order ngay_gui.desc, limit 200 (A:618).
	ListOrders(ctx context.Context) ([]*omap.Map, error)
	// OrderByCode: không có -> nil (A:626, 644).
	OrderByCode(ctx context.Context, maDon any) (*omap.Map, error)
	// UpdateOrderStatus: đổi có điều kiện theo trạng thái cũ; trả số dòng đã đổi (A:648, 662).
	UpdateOrderStatus(ctx context.Context, maDon any, from string, status any) (int, error)
	// PatchOrder: lệnh ghi RIÊNG của bản Go (người / ngày duyệt M15.1, kết quả gửi Lark M9.1), chạy sau lệnh chính.
	PatchOrder(ctx context.Context, maDon any, patch *omap.Map) error

	// Đề xuất
	InsertProposal(ctx context.Context, row *omap.Map) error
	InsertProposalItems(ctx context.Context, table string, rows []*omap.Map) error
	// ProposalsOfProject: order ngay_gui.desc, limit 300 (S:1287).
	ProposalsOfProject(ctx context.Context, maDA any) ([]*omap.Map, error)
	// ProposalItems: order sort_no.asc (S:1292, A:691).
	ProposalItems(ctx context.Context, table string, ma any) ([]*omap.Map, error)
	// ListProposals: loai truthy -> lọc theo loai; order ngay_gui.desc, limit 200 (A:682-684).
	ListProposals(ctx context.Context, loai any) ([]*omap.Map, error)
	ProposalByCode(ctx context.Context, ma any) (*omap.Map, error)
	// ResolveProposal: chỉ đổi khi còn "Chờ duyệt"; trả số dòng đã đổi (A:700).
	ResolveProposal(ctx context.Context, ma any, patch *omap.Map) (int, error)
}
