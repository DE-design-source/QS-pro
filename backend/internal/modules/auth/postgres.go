package auth

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

type pgRepo struct{ db *database.DB }

// NewRepository: Repository trên platform/database.
func NewRepository(db *database.DB) Repository { return &pgRepo{db: db} }

func (r *pgRepo) SessionUser(ctx context.Context, uid any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "users", database.SelectOpt{Select: "id,username,role,active,cong_ty_id",
		Filter: database.Eq("id", uid), Limit: 1, NoScope: true})
}

func (r *pgRepo) UsersByUsername(ctx context.Context, username string) ([]*omap.Map, error) {
	return r.db.Select(ctx, "users", database.SelectOpt{Filter: database.Eq("username", username), Limit: 20, NoScope: true})
}

func (r *pgRepo) UsersByEmail(ctx context.Context, pattern string) ([]*omap.Map, error) {
	return r.db.Select(ctx, "users", database.SelectOpt{Filter: "email=ilike." + jsval.EncodeURIComponent(pattern), Limit: 20, NoScope: true})
}

func (r *pgRepo) UpdateUser(ctx context.Context, id any, patch *omap.Map) error {
	_, err := r.db.Update(ctx, "users", database.Eq("id", id), patch, database.Opt{NoScope: true})
	return err
}
