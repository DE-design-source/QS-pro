package purchasing

import (
	"context"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

type pgRepo struct{ db *database.DB }

func newPgRepo(db *database.DB) Repository { return &pgRepo{db: db} }

func first(rows []*omap.Map, err error) (*omap.Map, error) {
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}

func (r *pgRepo) InsertOrder(ctx context.Context, row *omap.Map) error {
	_, err := r.db.InsertOne(ctx, tblDon, row)
	return err
}

func (r *pgRepo) InsertOrderItems(ctx context.Context, rows []*omap.Map) error {
	_, err := r.db.Insert(ctx, tblDonCT, rows)
	return err
}

func (r *pgRepo) DeleteOrder(ctx context.Context, maDon any) error {
	if _, err := r.db.Remove(ctx, tblDonCT, database.Eq("ma_don", maDon)); err != nil {
		return err
	}
	_, err := r.db.Remove(ctx, tblDon, database.Eq("ma_don", maDon))
	return err
}

func (r *pgRepo) OrdersOfProject(ctx context.Context, maDA any) ([]*omap.Map, error) {
	return r.db.Select(ctx, tblDon, database.SelectOpt{Filter: database.Eq("ma_du_an", maDA), Order: "ngay_gui.desc"})
}

func (r *pgRepo) OrderItems(ctx context.Context, maDon any) ([]*omap.Map, error) {
	return r.db.Select(ctx, tblDonCT, database.SelectOpt{Filter: database.Eq("ma_don", maDon), Order: "sort_no.asc"})
}

func (r *pgRepo) ListOrders(ctx context.Context) ([]*omap.Map, error) {
	return r.db.Select(ctx, tblDon, database.SelectOpt{Order: "ngay_gui.desc", Limit: 200})
}

func (r *pgRepo) OrderByCode(ctx context.Context, maDon any) (*omap.Map, error) {
	return first(r.db.Select(ctx, tblDon, database.SelectOpt{Filter: database.Eq("ma_don", maDon), Limit: 1}))
}

func (r *pgRepo) UpdateOrderStatus(ctx context.Context, maDon any, from string, status any) (int, error) {
	upd, err := r.db.Update(ctx, tblDon, database.Eq("ma_don", maDon)+"&trang_thai=eq."+jsval.EncodeURIComponent(from),
		omap.Of("trang_thai", status))
	return len(upd), err
}

func (r *pgRepo) InsertProposal(ctx context.Context, row *omap.Map) error {
	_, err := r.db.InsertOne(ctx, tblDeXuat, row)
	return err
}

func (r *pgRepo) InsertProposalItems(ctx context.Context, table string, rows []*omap.Map) error {
	_, err := r.db.Insert(ctx, table, rows)
	return err
}

func (r *pgRepo) DeleteProposal(ctx context.Context, ma any) error {
	_, err := r.db.Remove(ctx, tblDeXuat, database.Eq("ma_de_xuat", ma))
	return err
}

func (r *pgRepo) ProposalsOfProject(ctx context.Context, maDA any) ([]*omap.Map, error) {
	return r.db.Select(ctx, tblDeXuat, database.SelectOpt{Filter: database.Eq("ma_du_an", maDA), Order: "ngay_gui.desc", Limit: 300})
}

func (r *pgRepo) ProposalItems(ctx context.Context, table string, ma any) ([]*omap.Map, error) {
	return r.db.Select(ctx, table, database.SelectOpt{Filter: database.Eq("ma_de_xuat", ma), Order: "sort_no.asc"})
}

func (r *pgRepo) ListProposals(ctx context.Context, loai any) ([]*omap.Map, error) {
	filter := ""
	if jsval.Truthy(loai) {
		filter = database.Eq("loai", loai)
	}
	return r.db.Select(ctx, tblDeXuat, database.SelectOpt{Filter: filter, Order: "ngay_gui.desc", Limit: 200})
}

func (r *pgRepo) ProposalByCode(ctx context.Context, ma any) (*omap.Map, error) {
	return first(r.db.Select(ctx, tblDeXuat, database.SelectOpt{Filter: database.Eq("ma_de_xuat", ma), Limit: 1}))
}

func (r *pgRepo) ResolveProposal(ctx context.Context, ma any, patch *omap.Map) (int, error) {
	upd, err := r.db.Update(ctx, tblDeXuat, database.Eq("ma_de_xuat", ma)+"&trang_thai=eq."+jsval.EncodeURIComponent(ttChoDuyet), patch)
	return len(upd), err
}
