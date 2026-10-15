package companies

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/omap"
)

type pgRepo struct{ db *database.DB }

func newPgRepo(db *database.DB) Repository { return &pgRepo{db: db} }

func (r *pgRepo) ProbeShareCol(ctx context.Context) error {
	_, err := r.db.Select(ctx, "cong_ty", database.SelectOpt{Select: "dung_sp_dezon", Limit: 1, NoScope: true})
	return err
}

func (r *pgRepo) CongTyByID(ctx context.Context, id any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "cong_ty", database.SelectOpt{Filter: database.Eq("id", id), Limit: 1, NoScope: true})
}

func (r *pgRepo) CongTyByMa(ctx context.Context, ma string) ([]*omap.Map, error) {
	return r.db.Select(ctx, "cong_ty", database.SelectOpt{Filter: database.Eq("ma", ma), Limit: 1, NoScope: true})
}

func (r *pgRepo) ListCongTy(ctx context.Context) ([]*omap.Map, error) {
	return r.db.Select(ctx, "cong_ty", database.SelectOpt{Order: "ngay_tao.desc", Limit: 500, NoScope: true})
}

func (r *pgRepo) UserRefs(ctx context.Context) ([]*omap.Map, error) {
	return r.db.Select(ctx, "users", database.SelectOpt{Select: "id,cong_ty_id,active", Limit: 5000, NoScope: true})
}

func (r *pgRepo) UserIDsByName(ctx context.Context, username string) ([]*omap.Map, error) {
	return r.db.Select(ctx, "users", database.SelectOpt{Select: "id", Filter: database.Eq("username", username), Limit: 1, NoScope: true})
}

func (r *pgRepo) UsersOfCongTy(ctx context.Context, congTyID any) ([]*omap.Map, error) {
	return r.db.Select(ctx, "users", database.SelectOpt{
		Filter: database.Eq("cong_ty_id", congTyID), Order: "created_at.asc", Limit: 500, NoScope: true})
}

func (r *pgRepo) InsertCongTy(ctx context.Context, row *omap.Map) ([]*omap.Map, error) {
	return r.db.InsertOne(ctx, "cong_ty", row, database.Opt{NoScope: true})
}

func (r *pgRepo) UpdateCongTy(ctx context.Context, id any, patch *omap.Map) ([]*omap.Map, error) {
	return r.db.Update(ctx, "cong_ty", database.Eq("id", id), patch, database.Opt{NoScope: true})
}

func (r *pgRepo) RemoveTenantRows(ctx context.Context, table, filter string) error {
	_, err := r.db.Remove(ctx, table, filter, database.Opt{NoScope: true})
	return err
}

func (r *pgRepo) RemoveCongTy(ctx context.Context, id any) error {
	_, err := r.db.Remove(ctx, "cong_ty", database.Eq("id", id), database.Opt{NoScope: true})
	return err
}
