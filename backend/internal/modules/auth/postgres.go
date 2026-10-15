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

// tblPhien: bảng phiên đăng nhập. Mọi truy vấn noScope: kiểm phiên chạy trước khi biết công ty (như đăng nhập),
// và bảng không có company_id - dòng nào cũng lọc theo id phiên / user_id tường minh.
const tblPhien = "phien_dang_nhap"

func (r *pgRepo) InsertSession(ctx context.Context, uid any, hetHan string) (string, error) {
	rows, err := r.db.InsertOne(ctx, tblPhien, omap.Of("user_id", uid, "het_han", hetHan), database.Opt{NoScope: true})
	if err != nil {
		return "", err
	}
	if len(rows) == 0 {
		return "", nil
	}
	return jsval.AsString(rows[0].Val("id")), nil
}

func (r *pgRepo) SessionAlive(ctx context.Context, sid string, uid any, now string) (bool, error) {
	rows, err := r.db.Select(ctx, tblPhien, database.SelectOpt{Select: "id",
		Filter: database.Eq("id", sid) + "&" + database.Eq("user_id", uid) + "&het_han=gt." + jsval.EncodeURIComponent(now),
		Limit:  1, NoScope: true})
	return len(rows) > 0, err
}

func (r *pgRepo) RemoveSession(ctx context.Context, sid string) error {
	_, err := r.db.Remove(ctx, tblPhien, database.Eq("id", sid), database.Opt{NoScope: true})
	return err
}

func (r *pgRepo) RemoveUserSessions(ctx context.Context, uid any, keep string) ([]string, error) {
	f := database.Eq("user_id", uid)
	if keep != "" {
		f += "&id=neq." + jsval.EncodeURIComponent(keep)
	}
	rows, err := r.db.Remove(ctx, tblPhien, f, database.Opt{NoScope: true})
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, jsval.AsString(row.Val("id")))
	}
	return ids, nil
}

func (r *pgRepo) RemoveExpiredSessions(ctx context.Context, uid any, now string) error {
	_, err := r.db.Remove(ctx, tblPhien, database.Eq("user_id", uid)+"&het_han=lt."+jsval.EncodeURIComponent(now),
		database.Opt{NoScope: true})
	return err
}
