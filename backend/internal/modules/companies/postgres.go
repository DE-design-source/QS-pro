package companies

import (
	"context"
	"strconv"

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

func (r *pgRepo) CongTyCanNhac(ctx context.Context, tu, den string) ([]*omap.Map, error) {
	return r.db.Select(ctx, "cong_ty", database.SelectOpt{
		Filter: "active=not.is.false&han_dung=gte." + tu + "&han_dung=lte." + den, Order: "han_dung.asc", NoScope: true})
}

// locMocChuaNhac: nhac_moc null, ngoài tập mốc (dữ liệu cũ -1, 5...) hoặc lớn hơn moc.
func locMocChuaNhac(moc int) string {
	ds := ""
	for i, m := range mocNhac {
		if i > 0 {
			ds += ","
		}
		ds += strconv.Itoa(m)
	}
	return "or=(nhac_moc.is.null,nhac_moc.not.in.(" + ds + "),nhac_moc.gt." + strconv.Itoa(moc) + ")"
}

func (r *pgRepo) NhanMocNhac(ctx context.Context, id any, moc int, ngay string) (bool, error) {
	rows, err := r.db.Update(ctx, "cong_ty", database.Eq("id", id)+"&"+locMocChuaNhac(moc),
		omap.Of("nhac_moc", float64(moc), "nhac_lan_cuoi", ngay), database.Opt{NoScope: true})
	return len(rows) > 0, err
}

func (r *pgRepo) TraMocNhac(ctx context.Context, id any, moc int, ngay string, mocCu, ngayCu any) error {
	_, err := r.db.Update(ctx, "cong_ty", database.Eq("id", id)+"&"+database.Eq("nhac_moc", float64(moc))+"&"+database.Eq("nhac_lan_cuoi", ngay),
		omap.Of("nhac_moc", mocCu, "nhac_lan_cuoi", ngayCu), database.Opt{NoScope: true})
	return err
}

func (r *pgRepo) ChenThongBao(ctx context.Context, row *omap.Map) error {
	_, err := r.db.InsertOne(ctx, "notifications", row)
	return err
}
