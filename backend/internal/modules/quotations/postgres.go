package quotations

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/omap"
)

type pgRepo struct {
	db *database.DB
}

func newPgRepo(db *database.DB) *pgRepo { return &pgRepo{db: db} }

func (r *pgRepo) CoverRows(ctx context.Context, maDA any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "khai_toan", database.SelectOpt{Filter: database.Eq("ma_da", maDA), Order: "sort_no.asc", Limit: 2000})
}

func (r *pgRepo) CoverIDs(ctx context.Context, maDA any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "khai_toan", database.SelectOpt{Select: "id", Filter: database.Eq("ma_da", maDA), Limit: 2000})
}

func (r *pgRepo) InsertCover(ctx context.Context, rows []*omap.Map) error {
	_, err := r.db.Insert(ctx, "khai_toan", rows)
	return err
}

func (r *pgRepo) RemoveCover(ctx context.Context, ids string) error {
	_, err := r.db.Remove(ctx, "khai_toan", "id=in.("+ids+")")
	return err
}
