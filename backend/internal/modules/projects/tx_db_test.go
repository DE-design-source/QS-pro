package projects

import (
	"context"
	"errors"
	"os"
	"regexp"
	"testing"
	"time"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// D-13: lỗi tiêm giữa chừng ở DeleteProject / DuplicateProject -> rollback, database không đổi (chạy trên qspro_gotest).

var errLoiTiem = errors.New("ZZ_projects_tx lỗi tiêm")

// repoLoi bọc repo thật, trả errLoiTiem ở đúng 1 bước; đếm số lần gọi DeleteProject (bù trừ cũ).
// hong = "DeleteProjDataDB": gây lỗi THẬT ở database (22P02) thay cho lỗi tiêm Go.
type repoLoi struct {
	Repository
	hong       string
	soLanXoaDA int
	db         *database.DB
	loiNuot    error
	trongTx    bool
}

func (r *repoLoi) loi(buoc string) bool { return r.hong == buoc }

func (r *repoLoi) DeleteProjData(ctx context.Context, maDA any) error {
	if r.loi("DeleteProjDataDB") {
		r.trongTx = r.db.InTx(ctx)
		_, err := r.db.Select(ctx, "du_an", database.SelectOpt{Filter: "vat_pct=eq.khongphaiso"})
		r.loiNuot = err
		return err
	}
	return r.Repository.DeleteProjData(ctx, maDA)
}

func (r *repoLoi) DeleteLines(ctx context.Context, maDA any) error {
	if r.loi("DeleteLines") {
		return errLoiTiem
	}
	return r.Repository.DeleteLines(ctx, maDA)
}

func (r *repoLoi) DeleteCover(ctx context.Context, maDA any) error {
	if r.loi("DeleteCover") {
		return errLoiTiem
	}
	return r.Repository.DeleteCover(ctx, maDA)
}

func (r *repoLoi) DeleteProject(ctx context.Context, maDA any) error {
	r.soLanXoaDA++
	if r.loi("DeleteProject") {
		return errLoiTiem
	}
	return r.Repository.DeleteProject(ctx, maDA)
}

func (r *repoLoi) InsertCover(ctx context.Context, rows []*omap.Map) error {
	if r.loi("InsertCover") {
		return errLoiTiem
	}
	return r.Repository.InsertCover(ctx, rows)
}

func (r *repoLoi) InsertProjDataRows(ctx context.Context, rows []*omap.Map) error {
	if r.loi("InsertProjDataRows") {
		return errLoiTiem
	}
	return r.Repository.InsertProjDataRows(ctx, rows)
}

const maTxA = "ZZ_projects_tx_A"

// chupDB: toàn bộ dòng của dự án mẫu ở 4 bảng + số dòng mang tiền tố test (bắt cả bản sao mã mới) dạng chuỗi JSON.
func chupDB(t *testing.T, db *database.DB) string {
	t.Helper()
	pool, err := db.Pool()
	if err != nil {
		t.Fatal(err)
	}
	var s string
	err = pool.QueryRow(context.Background(), `select json_build_object(
	  'p',  (select json_agg(t order by id) from projects t where project_code = $1),
	  'l',  (select json_agg(t order by id) from quotation_lines t where project_code = $1),
	  'c',  (select json_agg(t order by id) from cost_estimate_lines t where project_code = $1),
	  'd',  (select json_agg(t order by data_key) from project_data_entries t where project_code = $1),
	  'np', (select count(*) from projects where project_name like 'ZZ\_projects\_tx%'),
	  'nl', (select count(*) from quotation_lines where product_name like 'ZZ\_projects\_tx%'),
	  'nc', (select count(*) from cost_estimate_lines where item_name like 'ZZ\_projects\_tx%'),
	  'nd', (select count(*) from project_data_entries where updated_by = 'ZZ_projects_tx_u'))::text`, maTxA).Scan(&s)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestTxRollbackDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	t.Cleanup(db.Close)
	don := func() {
		pool, err := db.Pool()
		if err != nil {
			return
		}
		// dòng con xoá theo khoá ngoại
		_, _ = pool.Exec(context.Background(), `delete from projects where project_name like 'ZZ\_projects\_tx%' or project_code like 'ZZ\_projects\_tx%'`)
	}
	don()
	t.Cleanup(don)

	ctx := tenant.With(context.Background(), tenant.Ctx{UID: "68cb6934-c871-4681-8cfe-def02ba28b0c", Role: "super",
		CongTyID: "90c41ced-2477-4342-97da-e226344354f1"})
	that := New(Deps{DB: db})
	if _, err := that.CreateProject(ctx, omap.Of("maDA", maTxA, "ten", "ZZ_projects_tx mẫu", "vat", 8.0)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Insert(ctx, "db_bao_gia", []*omap.Map{
		omap.Of("ma_du_an", maTxA, "sort_no", 1.0, "stt", "1", "ten_sp", "ZZ_projects_tx dòng 1", "so_luong", 2.0),
		omap.Of("ma_du_an", maTxA, "sort_no", 2.0, "stt", "2", "ten_sp", "ZZ_projects_tx dòng 2", "so_luong", 3.0),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Insert(ctx, "khai_toan", []*omap.Map{
		omap.Of("ma_da", maTxA, "stt", "1", "hang_muc", "ZZ_projects_tx mục 1", "chi_phi", 1000.0, "sort_no", 0.0),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Insert(ctx, "du_an_data", []*omap.Map{
		omap.Of("ma_da", maTxA, "khoa", "ghiChuZZ", "gia_tri", "x", "nguoi_sua", "ZZ_projects_tx_u"),
	}); err != nil {
		t.Fatal(err)
	}
	truoc := chupDB(t, db)

	for _, c := range []struct{ fn, hong string }{
		{"DeleteProject", "DeleteProject"},         // bước đầu (Tx xoá du_an trước): chưa ghi gì
		{"DeleteProject", "DeleteLines"},           // du_an + 3 bảng con (cascade) đã xoá trong tx
		{"DeleteProject", "DeleteCover"},           // du_an + dòng bóc tách đã xoá trong tx
		{"DuplicateProject", "InsertCover"},        // dự án mới + dòng bóc tách đã chèn
		{"DuplicateProject", "InsertProjDataRows"}, // bước cuối: dự án + dòng + tờ bìa đã chèn
	} {
		r := &repoLoi{Repository: NewRepository(db), hong: c.hong}
		svc := New(Deps{DB: db, Repo: r})
		var err error
		if c.fn == "DeleteProject" {
			_, err = svc.DeleteProject(ctx, maTxA)
		} else {
			_, err = svc.DuplicateProject(ctx, maTxA, nil)
			if r.soLanXoaDA != 0 {
				t.Errorf("%s/%s: còn chạy bù trừ DeleteProject %d lần (rollback đã dọn)", c.fn, c.hong, r.soLanXoaDA)
			}
		}
		if err != errLoiTiem {
			t.Errorf("%s/%s: lỗi = %v, muốn đúng lỗi tiêm (không bọc)", c.fn, c.hong, err)
		}
		if sau := chupDB(t, db); sau != truoc {
			t.Errorf("%s/%s: database đổi sau rollback\n  trước: %s\n  sau:   %s", c.fn, c.hong, truoc, sau)
		}
	}

	// thành công qua đúng đường có transaction: bản sao đủ dòng con, xoá xong không còn gì
	dup, err := that.DuplicateProject(ctx, maTxA, nil)
	if err != nil {
		t.Fatal(err)
	}
	newMa := dup.Val("maDA")
	pool, _ := db.Pool()
	var nl, nc, nd int
	if err := pool.QueryRow(context.Background(), `select (select count(*) from quotation_lines where project_code=$1),
	  (select count(*) from cost_estimate_lines where project_code=$1), (select count(*) from project_data_entries where project_code=$1)`,
		newMa).Scan(&nl, &nc, &nd); err != nil {
		t.Fatal(err)
	}
	if nl != 2 || nc != 1 || nd != 1 {
		t.Errorf("bản sao: dòng=%d tờ bìa=%d dữ liệu rời=%d, muốn 2/1/1", nl, nc, nd)
	}
	if res, err := that.DeleteProject(ctx, newMa); err != nil || !res.Val("ok").(bool) {
		t.Fatalf("xoá %v: %v %v", newMa, res, err)
	}
	// lỗi DB THẬT ở DeleteProjData trong Tx bị nuốt như Node: savepoint giữ Tx dùng tiếp, xoá dự án vẫn chạy, {ok:true}
	rDB := &repoLoi{Repository: NewRepository(db), hong: "DeleteProjDataDB", db: db}
	if res, err := New(Deps{DB: db, Repo: rDB}).DeleteProject(ctx, maTxA); err != nil || !res.Val("ok").(bool) {
		t.Fatalf("xoá %v khi DeleteProjData lỗi DB: %v %v", maTxA, res, err)
	}
	if rDB.loiNuot == nil || !rDB.trongTx {
		t.Fatalf("không tiêm được lỗi DB trong Tx: loi=%v trongTx=%v", rDB.loiNuot, rDB.trongTx)
	}
	if sau := chupDB(t, db); sau != `{"p" : null, "l" : null, "c" : null, "d" : null, "np" : 0, "nl" : 0, "nc" : 0, "nd" : 0}` {
		t.Errorf("sau khi xoá còn dữ liệu: %s", sau)
	}
}

// TestTxDeadlockDB: DeleteProject chạy song song với một Tx kiểu SaveCover (chèn tờ bìa mới -> giữ KEY SHARE trên
// du_an, rồi xoá tờ bìa cũ). Xoá con trước du_an thì 2 Tx chờ nhau -> 40P01; khoá du_an trước thì cả hai thành công.
func TestTxDeadlockDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	t.Cleanup(db.Close)
	pool, err := db.Pool()
	if err != nil {
		t.Fatal(err)
	}
	const maB = "ZZ_projects_tx_B"
	don := func() {
		_, _ = pool.Exec(context.Background(), `delete from projects where project_code = $1`, maB)
	}
	don()
	t.Cleanup(don)

	ctx := tenant.With(context.Background(), tenant.Ctx{UID: "68cb6934-c871-4681-8cfe-def02ba28b0c", Role: "super",
		CongTyID: "90c41ced-2477-4342-97da-e226344354f1"})
	svc := New(Deps{DB: db})
	if _, err := svc.CreateProject(ctx, omap.Of("maDA", maB, "ten", "ZZ_projects_tx B")); err != nil {
		t.Fatal(err)
	}
	cu, err := db.Insert(ctx, "khai_toan", []*omap.Map{
		omap.Of("ma_da", maB, "stt", "1", "hang_muc", "ZZ_projects_tx cũ", "chi_phi", 1.0, "sort_no", 0.0),
	})
	if err != nil || len(cu) != 1 {
		t.Fatalf("chèn tờ bìa cũ: %v %v", cu, err)
	}
	idCu := cu[0].Val("id")

	daChen, choXoa := make(chan struct{}), make(chan struct{})
	loiA, loiB := make(chan error, 1), make(chan error, 1)
	go func() {
		loiA <- db.Tx(ctx, func(ctx context.Context) error {
			if _, err := db.Insert(ctx, "khai_toan", []*omap.Map{
				omap.Of("ma_da", maB, "stt", "1", "hang_muc", "ZZ_projects_tx mới", "chi_phi", 2.0, "sort_no", 0.0),
			}); err != nil {
				close(daChen)
				return err
			}
			close(daChen)
			<-choXoa
			_, err := db.Remove(ctx, "khai_toan", database.Eq("id", idCu))
			return err
		})
	}()
	<-daChen
	go func() {
		_, err := svc.DeleteProject(ctx, maB)
		loiB <- err
	}()
	// chờ tới khi DeleteProject đứng chờ khoá ở lệnh xoá du_an (cả code cũ lẫn mới đều chờ ở đây)
	han := time.Now().Add(5 * time.Second)
	for {
		var n int
		if err := pool.QueryRow(context.Background(), `select count(*) from pg_stat_activity
		  where datname = current_database() and wait_event_type = 'Lock' and query like '%delete from "projects"%'`).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n > 0 {
			break
		}
		if time.Now().After(han) {
			close(choXoa)
			t.Fatal("DeleteProject không chờ khoá du_an như kịch bản")
		}
		time.Sleep(20 * time.Millisecond)
	}
	close(choXoa)
	for i, ch := range []chan error{loiA, loiB} {
		select {
		case err := <-ch:
			if err != nil {
				t.Errorf("Tx %d lỗi: %v", i, err)
			}
		case <-time.After(15 * time.Second):
			t.Fatalf("Tx %d treo", i)
		}
	}
	var np, nc int
	if err := pool.QueryRow(context.Background(), `select (select count(*) from projects where project_code=$1),
	  (select count(*) from cost_estimate_lines where project_code=$1)`, maB).Scan(&np, &nc); err != nil {
		t.Fatal(err)
	}
	if np != 0 || nc != 0 {
		t.Errorf("sau khi xoá: dự án=%d tờ bìa=%d, muốn 0/0", np, nc)
	}
}
