package companies

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"qspro-backend/internal/modules/users"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/contracts"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// D-13: CreateCongTy / DeleteCongTy chạy trong transaction - lỗi tiêm giữa chừng thì database không đổi.
// Đối chứng: cùng kịch bản với s.db = nil (không transaction, như trước D-13) phải để lại dữ liệu dở dang,
// chứng minh test thật sự phân biệt được hai trường hợp.

var errTiem = errors.New("ZZ_cotx lỗi tiêm")

// creatorLoiSau: gọi AdminCreateUser thật (đã chèn users + audit_log) rồi trả lỗi tiêm.
type creatorLoiSau struct{ that *users.Service }

func (c creatorLoiSau) AdminCreateUser(ctx context.Context, a *actor.Actor, data *omap.Map) (*omap.Map, error) {
	if _, err := c.that.AdminCreateUser(ctx, a, data); err != nil {
		return nil, err
	}
	return nil, errTiem
}

// repoTiem: RemoveTenantRows("du_an") chạy thêm 1 lệnh hỏng (bị nuốt như bảng chưa có cột);
// tiemXoaCongTy = true -> RemoveCongTy xoá thật rồi trả lỗi tiêm.
type repoTiem struct {
	Repository
	tiemXoaCongTy bool
}

func (r repoTiem) RemoveTenantRows(ctx context.Context, table, filter string) error {
	if table == "du_an" {
		if err := r.Repository.RemoveTenantRows(ctx, table, "khong_co_cot_nay=eq.1"); err == nil {
			return errors.New("lệnh hỏng cố ý lại chạy được")
		}
	}
	return r.Repository.RemoveTenantRows(ctx, table, filter)
}

func (r repoTiem) RemoveCongTy(ctx context.Context, id any) error {
	if err := r.Repository.RemoveCongTy(ctx, id); err != nil {
		return err
	}
	if r.tiemXoaCongTy {
		return errTiem
	}
	return nil
}

func TestTxCongTyDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !strings.Contains(url, "/qspro_gotest") {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	defer db.Close()
	pool, err := db.Pool()
	if err != nil {
		t.Fatal(err)
	}
	bg := context.Background()
	sweep := func() {
		for _, q := range []string{
			"delete from audit_logs where username like 'zz_cotx%' or company_id in (select id from companies where code like 'zz-cotx%')",
			"delete from notifications where company_id in (select id from companies where code like 'zz-cotx%')",
			"delete from users where username like 'zz_cotx%' or company_id in (select id from companies where code like 'zz-cotx%')",
			"delete from companies where code like 'zz-cotx%'",
		} {
			if _, err := pool.Exec(bg, q); err != nil {
				t.Errorf("dọn dữ liệu thử: %v", err)
			}
		}
	}
	sweep()
	defer sweep()

	no := database.Opt{NoScope: true}
	dem := func(table, filter string) int {
		t.Helper()
		rows, err := db.Select(bg, table, database.SelectOpt{Select: "id", Filter: filter, NoScope: true})
		if err != nil {
			t.Fatalf("đọc %s %s: %v", table, filter, err)
		}
		return len(rows)
	}
	dz, err := db.Select(bg, "cong_ty", database.SelectOpt{Filter: database.Eq("ma", "dezon"), Limit: 1, NoScope: true})
	if err != nil || len(dz) == 0 {
		t.Fatalf("không đọc được công ty dezon: %v", err)
	}
	ctx := tenant.With(bg, tenant.Ctx{Role: "super", CongTyID: dz[0].Val("id")})
	SA := &actor.Actor{UID: nil, U: "zz_cotx_actor", R: "super"}

	// module users thật, nối như internal/server/routes.go (chỉ trong test)
	usersSvc := users.New(users.Deps{DB: db})
	au := &auditStub{}
	mk := func(creator contracts.UserCreator) *Service {
		return New(Deps{DB: db, UserCreator: creator, UserFormatter: usersSvc, Auditor: au})
	}
	that := mk(usersSvc)
	usersSvc.SetCompanyReader(that)
	auditActor := func() int { return dem("audit_log", database.Eq("username", "zz_cotx_actor")) }

	t.Run("create_loi_sau_khi_tao_chu", func(t *testing.T) {
		s := mk(creatorLoiSau{usersSvc})
		_, err := s.CreateCongTy(ctx, SA, omap.Of("ten", "ZZ_cotx Một", "adminUser", "zz_cotx_chu1", "adminPass", "secret1"))
		if err != errTiem {
			t.Fatalf("phải trả nguyên lỗi tiêm, được %v", err)
		}
		if n := dem("cong_ty", database.Eq("ma", "zz-cotx-mot")); n != 0 {
			t.Errorf("rollback: còn %d công ty", n)
		}
		if n := dem("users", database.Eq("username", "zz_cotx_chu1")); n != 0 {
			t.Errorf("rollback: còn %d tài khoản chủ", n)
		}
		if n := auditActor(); n != 0 {
			t.Errorf("rollback: còn %d dòng audit create_user", n)
		}
		if len(au.calls) != 0 {
			t.Errorf("lỗi thì không ghi audit create_company: %s", js(t, au.calls))
		}
		// đối chứng: không transaction -> để lại công ty + tài khoản chủ (hành vi trước D-13)
		s.db = nil
		if _, err := s.CreateCongTy(ctx, SA, omap.Of("ten", "ZZ_cotx Đối chứng", "adminUser", "zz_cotx_chu0", "adminPass", "secret1")); err != errTiem {
			t.Fatalf("đối chứng: %v", err)
		}
		if dem("cong_ty", database.Eq("ma", "zz-cotx-doi-chung")) != 1 || dem("users", database.Eq("username", "zz_cotx_chu0")) != 1 {
			t.Error("đối chứng: không transaction phải còn công ty + tài khoản dở dang")
		}
	})

	t.Run("create_loi_that_mat_khau_ngan", func(t *testing.T) {
		_, err := that.CreateCongTy(ctx, SA, omap.Of("ten", "ZZ_cotx Hai", "adminUser", "zz_cotx_chu2", "adminPass", "abc"))
		if err == nil || err.Error() != "Mật khẩu tối thiểu 4 ký tự" {
			t.Fatalf("lỗi của AdminCreateUser phải đi ra nguyên văn, được %v", err)
		}
		if n := dem("cong_ty", database.Eq("ma", "zz-cotx-hai")); n != 0 {
			t.Errorf("không còn công ty mồ côi (Node để lại), còn %d", n)
		}
	})

	var ctID any
	t.Run("create_thanh_cong", func(t *testing.T) {
		au.calls = nil
		c, err := that.CreateCongTy(ctx, SA, omap.Of("ten", "ZZ_cotx Ba", "adminUser", "zz_cotx_chu3", "adminPass", "secret1",
			"email", "b@zz.vn"))
		if err != nil {
			t.Fatal(err)
		}
		ctID = c.Val("id")
		if c.Val("ma") != "zz-cotx-ba" || c.Val("ten") != "ZZ_cotx Ba" {
			t.Errorf("kết quả %s", js(t, c))
		}
		if dem("cong_ty", database.Eq("id", ctID)) != 1 {
			t.Error("công ty phải được commit")
		}
		u, err := db.Select(bg, "users", database.SelectOpt{Filter: database.Eq("username", "zz_cotx_chu3"), NoScope: true})
		if err != nil || len(u) != 1 || jsval.ToString(u[0].Val("cong_ty_id")) != jsval.ToString(ctID) || u[0].Val("role") != "admin" {
			t.Fatalf("tài khoản chủ phải được commit cùng công ty: %v %v", u, err)
		}
		if dem("audit_log", database.Eq("detail", "Tạo tài khoản zz_cotx_chu3 (admin)")) != 1 {
			t.Error("audit create_user (ghi trong transaction) phải được commit")
		}
		if js(t, au.calls) != `[{"action":"create_company","detail":"Tạo công ty ZZ_cotx Ba","uid":null}]` {
			t.Errorf("audit create_company %s", js(t, au.calls))
		}
	})
	if ctID == nil {
		t.Fatal("không có công ty để thử xoá")
	}

	// dữ liệu con của công ty: users (tài khoản chủ), notifications, audit_log
	u, err := db.Select(bg, "users", database.SelectOpt{Filter: database.Eq("username", "zz_cotx_chu3"), NoScope: true})
	if err != nil || len(u) != 1 {
		t.Fatal(err)
	}
	if _, err := db.InsertOne(bg, "notifications", omap.Of("user_id", u[0].Val("id"), "kind", "zz", "title", "ZZ_cotx", "body", "",
		"ref_id", nil, "is_read", false, "cong_ty_id", ctID), no); err != nil {
		t.Fatal(err)
	}
	if _, err := db.InsertOne(bg, "audit_log", omap.Of("user_id", nil, "username", "zz_cotx_con", "action", "zz", "detail", "",
		"cong_ty_id", ctID), no); err != nil {
		t.Fatal(err)
	}
	soDong := func() string {
		f := database.Eq("cong_ty_id", ctID)
		return js(t, omap.Of("users", float64(dem("users", f)), "notifications", float64(dem("notifications", f)),
			"audit_log", float64(dem("audit_log", f)), "cong_ty", float64(dem("cong_ty", database.Eq("id", ctID)))))
	}
	const day = `{"users":1,"notifications":1,"audit_log":1,"cong_ty":1}`
	if got := soDong(); got != day {
		t.Fatalf("chuẩn bị: %s", got)
	}

	t.Run("delete_loi_sau_khi_xoa", func(t *testing.T) {
		au.calls = nil
		s := mk(usersSvc)
		s.repo = repoTiem{Repository: s.repo, tiemXoaCongTy: true}
		if _, err := s.DeleteCongTy(ctx, SA, ctID); err != errTiem {
			t.Fatalf("phải trả nguyên lỗi tiêm, được %v", err)
		}
		if got := soDong(); got != day {
			t.Errorf("rollback: dữ liệu phải giữ nguyên %s, được %s", day, got)
		}
		if len(au.calls) != 0 {
			t.Errorf("lỗi thì không ghi audit delete_company: %s", js(t, au.calls))
		}
	})

	t.Run("delete_thanh_cong_co_lenh_nuot_loi", func(t *testing.T) {
		au.calls = nil
		s := mk(usersSvc)
		s.repo = repoTiem{Repository: s.repo} // lệnh hỏng bị nuốt giữa transaction, các lệnh sau vẫn chạy
		r, err := s.DeleteCongTy(ctx, SA, ctID)
		if err != nil {
			t.Fatal(err)
		}
		if got := js(t, r); got != `{"ok":true,"ten":"ZZ_cotx Ba"}` {
			t.Errorf("kết quả %s", got)
		}
		if got, want := soDong(), `{"users":0,"notifications":0,"audit_log":0,"cong_ty":0}`; got != want {
			t.Errorf("sau xoá %s, cần %s", got, want)
		}
		if js(t, au.calls) != `[{"action":"delete_company","detail":"Xoá công ty ZZ_cotx Ba và toàn bộ dữ liệu","uid":null}]` {
			t.Errorf("audit %s", js(t, au.calls))
		}
	})

	t.Run("delete_doi_chung_khong_tx", func(t *testing.T) {
		c, err := db.InsertOne(bg, "cong_ty", omap.Of("ten", "ZZ_cotx Bốn", "ma", "zz-cotx-bon"), no)
		if err != nil {
			t.Fatal(err)
		}
		id := c[0].Val("id")
		if _, err := db.InsertOne(bg, "audit_log", omap.Of("user_id", nil, "username", "zz_cotx_con4", "action", "zz", "detail", "",
			"cong_ty_id", id), no); err != nil {
			t.Fatal(err)
		}
		s := mk(usersSvc)
		s.db = nil
		s.repo = repoTiem{Repository: s.repo, tiemXoaCongTy: true}
		if _, err := s.DeleteCongTy(ctx, SA, id); err != errTiem {
			t.Fatalf("đối chứng: %v", err)
		}
		if dem("audit_log", database.Eq("cong_ty_id", id)) != 0 || dem("cong_ty", database.Eq("id", id)) != 0 {
			t.Error("đối chứng: không transaction thì dữ liệu đã bị xoá dù báo lỗi")
		}
	})
}
