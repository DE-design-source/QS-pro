package takeoff

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/qscore"
)

type pgRepo struct{ db *database.DB }

// NewRepository: Repository trên tầng dữ liệu chung.
func NewRepository(db *database.DB) Repository { return &pgRepo{db: db} }

func (r *pgRepo) ListLines(ctx context.Context, maDA any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "db_bao_gia", database.SelectOpt{Filter: database.Eq("ma_du_an", maDA), Order: "sort_no.asc", Limit: qscore.LIM})
}

// Lấy sort_no LỚN NHẤT đang có (không đếm số dòng: xoá dòng giữa rồi thêm mới sẽ trùng STT).
func (r *pgRepo) MaxSortNo(ctx context.Context, maDA any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "db_bao_gia", database.SelectOpt{Select: "sort_no", Filter: database.Eq("ma_du_an", maDA), Order: "sort_no.desc", Limit: 1})
}

func (r *pgRepo) InsertLine(ctx context.Context, row *omap.Map) ([]*omap.Map, error) {
	return r.db.InsertOne(ctx, "db_bao_gia", row)
}

func (r *pgRepo) FindLine(ctx context.Context, lineID any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "db_bao_gia", database.SelectOpt{Filter: database.Eq("id", lineID), Limit: 1})
}

func (r *pgRepo) UpdateLine(ctx context.Context, lineID any, patch *omap.Map) ([]*omap.Map, error) {
	return r.db.Update(ctx, "db_bao_gia", database.Eq("id", lineID), patch)
}

func (r *pgRepo) DeleteLine(ctx context.Context, lineID any) error {
	_, err := r.db.Remove(ctx, "db_bao_gia", database.Eq("id", lineID))
	return err
}
