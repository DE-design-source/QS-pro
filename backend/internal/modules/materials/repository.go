package materials

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/omap"
)

// Repository: bốn lệnh supa.* mà store_supa.js / auth.js gọi. Module có hơn 40 câu truy vấn, mỗi câu một chuỗi lọc
// PostgREST riêng; giữ chuỗi lọc ngay tại nơi gọi trong service (đối chiếu từng dòng với Node) nên kho dữ liệu
// chỉ cần đúng bốn động từ. Bảng dùng: db_san_pham, db_san_pham_history, sp_combo, sp_yeu_thich, cong_ty, delete_requests.
type Repository interface {
	Select(ctx context.Context, table string, opt ...database.SelectOpt) ([]*omap.Map, error)
	Insert(ctx context.Context, table string, rows []*omap.Map, opt ...database.Opt) ([]*omap.Map, error)
	InsertOne(ctx context.Context, table string, row *omap.Map, opt ...database.Opt) ([]*omap.Map, error)
	Update(ctx context.Context, table, filter string, patch *omap.Map, opt ...database.Opt) ([]*omap.Map, error)
	Remove(ctx context.Context, table, filter string, opt ...database.Opt) ([]*omap.Map, error)
}
