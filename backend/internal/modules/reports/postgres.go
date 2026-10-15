package reports

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

type pgRepo struct{ db *database.DB }

func (r *pgRepo) NewProducts(ctx context.Context, tuIso string) ([]*omap.Map, error) {
	return r.db.Select(ctx, "db_san_pham", database.SelectOpt{
		Select: "id,ma_sp,ten_sp,nha_cung_cap,nguoi_tao,ngay_tao,cong_ty_id,nganh,hang_muc",
		Filter: "ngay_tao=gte." + jsval.EncodeURIComponent(tuIso), Order: "ngay_tao.desc", Limit: 5000, NoScope: true,
	})
}

func (r *pgRepo) Users(ctx context.Context) ([]*omap.Map, error) {
	return r.db.Select(ctx, "users", database.SelectOpt{Select: "*", Limit: 5000, NoScope: true})
}

func (r *pgRepo) Companies(ctx context.Context) ([]*omap.Map, error) {
	return r.db.Select(ctx, "cong_ty", database.SelectOpt{Select: "id,ten,ma", Limit: 500, NoScope: true})
}

func (r *pgRepo) InsertAudit(ctx context.Context, detail string) error {
	_, err := r.db.Insert(ctx, "audit_log", []*omap.Map{
		omap.Of("username", "hệ thống", "action", baoCaoAction, "detail", detail),
	}, database.Opt{NoScope: true})
	return err
}

func (r *pgRepo) RecentAudits(ctx context.Context) ([]*omap.Map, error) {
	return r.db.Select(ctx, "audit_log", database.SelectOpt{
		Select: "id,created_at", Filter: database.Eq("action", baoCaoAction), Order: "id.desc", Limit: 5, NoScope: true,
	})
}
