package notifications

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/omap"
)

type pgRepo struct{ db *database.DB }

func newPgRepo(db *database.DB) Repository { return &pgRepo{db: db} }

func (r *pgRepo) AdminUsers(ctx context.Context) ([]*omap.Map, error) {
	return r.db.Select(ctx, "users", database.SelectOpt{Filter: database.Eq("role", "admin")})
}

func (r *pgRepo) Insert(ctx context.Context, row *omap.Map) error {
	_, err := r.db.InsertOne(ctx, "notifications", row)
	return err
}

func (r *pgRepo) UnreadIDs(ctx context.Context, uid any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "notifications", database.SelectOpt{
		Select: "id", Filter: database.Eq("user_id", uid) + "&" + database.Eq("is_read", false), Limit: 500})
}

func (r *pgRepo) ListByUser(ctx context.Context, uid any, limit int) ([]*omap.Map, error) {
	return r.db.Select(ctx, "notifications", database.SelectOpt{
		Filter: database.Eq("user_id", uid), Order: "created_at.desc", Limit: limit})
}

func (r *pgRepo) MarkRead(ctx context.Context, id, uid any) error {
	_, err := r.db.Update(ctx, "notifications", database.Eq("id", id)+"&"+database.Eq("user_id", uid), omap.Of("is_read", true))
	return err
}

func (r *pgRepo) MarkAllRead(ctx context.Context, uid any) error {
	_, err := r.db.Update(ctx, "notifications", database.Eq("user_id", uid)+"&"+database.Eq("is_read", false), omap.Of("is_read", true))
	return err
}
