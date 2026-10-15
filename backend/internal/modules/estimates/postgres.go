package estimates

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/qscore"
)

type pgRepo struct{ db *database.DB }

// NewRepository cài Repository trên tầng dữ liệu dùng chung (có phạm vi công ty của ctx).
func NewRepository(db *database.DB) Repository { return &pgRepo{db: db} }

func (r *pgRepo) ListCongTac(ctx context.Context) ([]*omap.Map, error) {
	return r.db.Select(ctx, "cong_tac", database.SelectOpt{Order: "loai.asc,thu_tu.asc,ngay_tao.asc", Limit: qscore.LIM})
}

func (r *pgRepo) GetCongTac(ctx context.Context, id any) (*omap.Map, error) {
	rows, err := r.db.Select(ctx, "cong_tac", database.SelectOpt{Filter: database.Eq("id", id), Limit: 1})
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}

func (r *pgRepo) InsertCongTac(ctx context.Context, rows []*omap.Map) ([]*omap.Map, error) {
	return r.db.Insert(ctx, "cong_tac", rows)
}

func (r *pgRepo) UpdateCongTac(ctx context.Context, id any, patch *omap.Map) ([]*omap.Map, error) {
	return r.db.Update(ctx, "cong_tac", database.Eq("id", id), patch)
}

func (r *pgRepo) RemoveCongTac(ctx context.Context, id any) ([]*omap.Map, error) {
	return r.db.Remove(ctx, "cong_tac", database.Eq("id", id))
}

func (r *pgRepo) InsertHistory(ctx context.Context, rows []*omap.Map) error {
	_, err := r.db.Insert(ctx, "cong_tac_history", rows)
	return err
}

func (r *pgRepo) ListHistory(ctx context.Context, id any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "cong_tac_history", database.SelectOpt{
		Filter: database.Eq("cong_tac_id", id), Order: "changed_at.desc", Limit: 200,
	})
}
