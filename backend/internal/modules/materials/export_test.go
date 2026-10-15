package materials

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"

	"qspro-backend/internal/modules/categories"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// ───────────── xuất Excel danh sách sản phẩm ─────────────

// tableRepo: Repository giả chỉ trả dòng theo tên bảng (mọi lệnh ghi là rỗng); fail khác rỗng thì mọi lệnh đọc báo lỗi đó.
type tableRepo struct {
	rows map[string][]*omap.Map
	fail string
}

func (r *tableRepo) Select(_ context.Context, table string, _ ...database.SelectOpt) ([]*omap.Map, error) {
	if r.fail != "" {
		return nil, errors.New(r.fail)
	}
	return r.rows[table], nil
}

func (r *tableRepo) Insert(context.Context, string, []*omap.Map, ...database.Opt) ([]*omap.Map, error) {
	return nil, nil
}

func (r *tableRepo) InsertOne(context.Context, string, *omap.Map, ...database.Opt) ([]*omap.Map, error) {
	return nil, nil
}

func (r *tableRepo) Update(context.Context, string, string, *omap.Map, ...database.Opt) ([]*omap.Map, error) {
	return nil, nil
}

func (r *tableRepo) Remove(context.Context, string, string, ...database.Opt) ([]*omap.Map, error) {
	return nil, nil
}

func exportRepo() *tableRepo {
	return &tableRepo{rows: map[string][]*omap.Map{"db_san_pham": {
		omap.Of("id", 7.0, "ma_sp", "A-1", "ten_sp", "Đèn A", "cong_suat_w", "12", "gia_ban_le", 1250000.0, "lap_nguon_roi", true,
			"anh_sp", "http://a/1.jpg\nhttp://a/2.jpg", "ghi_chu", "  có khoảng trắng  "),
		omap.Of("id", 8.0, "ma_sp", "B-2", "ten_sp", "Đèn B"),
		omap.Of("id", 9.0, "ma_sp", "7", "ten_sp", "Mã trùng id khác"),
	}}}
}

// Cấu trúc file: cột theo DB_LABEL2COL, dòng tiêu đề, khung cố định, giá trị ô (I:652-687). So mức ô với file của
// ExcelJS nằm ở TestDiffDB (bước xlsx) và testdata/xlsx-parity.js.
func TestExportProductsXlsx(t *testing.T) {
	s, _ := newSvc(exportRepo(), nil)
	res, err := s.ExportProductsXlsx(context.Background(), []any{7.0, "B-2", "không có"})
	if err != nil {
		t.Fatal(err)
	}
	// "7" khớp cả id 7 lẫn mã "7"
	if res.Count != 3 || !regexp.MustCompile(`^danh-sach-san-pham-\d{4}-\d\d-\d\d\.xlsx$`).MatchString(res.Name) {
		t.Errorf("count %d, tên %s", res.Count, res.Name)
	}
	f, err := excelize.OpenReader(bytes.NewReader(res.Buf))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if got := f.GetSheetList(); len(got) != 1 || got[0] != "Danh sách sản phẩm" {
		t.Errorf("sheet: %v", got)
	}
	rows, _ := f.GetRows(exportSheet)
	head := rows[0]
	labels := []string{"STT"}
	for _, l := range categories.Labels() {
		if l != nhanAnh {
			labels = append(labels, l)
		}
	}
	labels = append(labels, nhanAnh)
	if strings.Join(head, "|") != strings.Join(labels, "|") {
		t.Errorf("tiêu đề:\n  %v\n  %v", head, labels)
	}
	cell := func(label string, row int) string {
		for i, l := range head {
			if l == label {
				name, _ := excelize.CoordinatesToCellName(i+1, row)
				v, _ := f.GetCellValue(exportSheet, name)
				return v
			}
		}
		t.Fatalf("không có cột %s", label)
		return ""
	}
	for _, c := range [][2]string{{"STT", "1"}, {"MÃ SẢN PHẨM", "A-1"}, {"CÔNG SUẤT (W)", "12"}, {"GIÁ BÁN LẺ", "1250000"}, {"LẮP NGUỒN RỜI", "Có"},
		{"GHI CHÚ", "  có khoảng trắng  "}, {nhanAnh, "http://a/1.jpg\nhttp://a/2.jpg"}, {"UGR", ""}} {
		if got := cell(c[0], 2); got != c[1] {
			t.Errorf("%s dòng 2 = %q, muốn %q", c[0], got, c[1])
		}
	}
	if got := cell("STT", 4) + cell("TÊN SẢN PHẨM", 4); got != "3Mã trùng id khác" {
		t.Errorf("dòng 4: %s", got)
	}
	if w, _ := f.GetColWidth(exportSheet, "A"); w != 6 {
		t.Errorf("rộng cột STT %v", w)
	}
	if w, _ := f.GetColWidth(exportSheet, "B"); w != 15 { // "MÃ SẢN PHẨM".length + 4
		t.Errorf("rộng cột B %v", w)
	}
	if h, _ := f.GetRowHeight(exportSheet, 1); h != 30 {
		t.Errorf("cao dòng tiêu đề %v", h)
	}
	if p, _ := f.GetPanes(exportSheet); !p.Freeze || p.YSplit != 1 || p.TopLeftCell != "A2" {
		t.Errorf("khung cố định: %+v", p)
	}
	sid, _ := f.GetCellStyle(exportSheet, "C1")
	if st, _ := f.GetStyle(sid); st == nil || st.Font == nil || !st.Font.Bold || st.Font.Color != "FFFFFF" || len(st.Fill.Color) != 1 ||
		st.Fill.Color[0] != "12324C" || st.Alignment == nil || st.Alignment.Vertical != "center" || !st.Alignment.WrapText {
		t.Errorf("style tiêu đề: %+v", st)
	}
	// keys rỗng / nil = xuất tất cả
	if all, _ := s.ExportProductsXlsx(context.Background(), nil); all.Count != 3 {
		t.Errorf("xuất tất cả: %d", all.Count)
	}
}

// POST /export/san-pham (I:744-760): mã trạng thái, header và thân.
func TestExportRoute(t *testing.T) {
	repo := exportRepo()
	s, _ := newSvc(repo, nil)
	e := testEngine(s, &actor.Actor{UID: "u", U: "nv", R: "staff", CT: "c1"})
	const ct = "application/json"
	if w := do(e, "POST", "/export/san-pham", ct, []byte(`{}`), false); w.Code != 401 || w.Body.String() != `{"error":"Chưa đăng nhập"}` {
		t.Errorf("chưa đăng nhập: %d %s", w.Code, w.Body)
	}
	for body, n := range map[string]string{``: "3", `{}`: "3", `{"keys":[]}`: "3", `{"keys":"7"}`: "3", `{"keys":[8]}`: "1",
		`{"keys":["A-1","B-2",null]}`: "2", `{"keys":["x"]}`: "0"} {
		w := do(e, "POST", "/export/san-pham", ct, []byte(body), true)
		h := w.Header()
		if w.Code != 200 || h.Get("Content-Type") != xlsxMime || h.Get("X-Row-Count") != n || !strings.HasPrefix(h.Get("ETag"), `W/"`) ||
			!regexp.MustCompile(`^attachment; filename="danh-sach-san-pham-\d{4}-\d\d-\d\d\.xlsx"$`).MatchString(h.Get("Content-Disposition")) ||
			!strings.HasPrefix(w.Body.String(), "PK") {
			t.Errorf("thân %q: %d %v", body, w.Code, h)
		}
	}
	repo.fail = "DB GET db_san_pham -> 500 {}"
	if w := do(e, "POST", "/export/san-pham", ct, []byte(`{}`), true); w.Code != 500 || w.Body.String() != `{"error":"DB GET db_san_pham -> 500 {}"}` {
		t.Errorf("lỗi đọc: %d %s", w.Code, w.Body)
	}
}

// Ghi file để testdata/xlsx-parity.js so với file của Node ở mức ô + style. Xuất các sản phẩm có sẵn của công ty dezon
// (id trong testdata/export-keys.json) trên qspro_gotest. Bỏ qua khi chưa đặt MATERIALS_XLSX_OUT / TEST_DATABASE_URL.
func TestExportWriteFile(t *testing.T) {
	out, url := os.Getenv("MATERIALS_XLSX_OUT"), os.Getenv("TEST_DATABASE_URL")
	if out == "" || url == "" {
		t.Skip("chưa đặt MATERIALS_XLSX_OUT / TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	defer db.Close()
	dz, err := db.Select(tenant.With(context.Background(), tenant.Ctx{Role: "super"}), "cong_ty",
		database.SelectOpt{Select: "id", Filter: "ma=eq.dezon", NoScope: true})
	if err != nil || len(dz) == 0 {
		t.Fatalf("không thấy công ty dezon: %v", err)
	}
	b, err := os.ReadFile(filepath.Join("testdata", "export-keys.json"))
	if err != nil {
		t.Fatal(err)
	}
	keys, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	s := New(Deps{DB: db})
	res, err := s.ExportProductsXlsx(tenant.With(context.Background(), tenant.Ctx{Role: "admin", CongTyID: dz[0].Val("id")}), arr(keys))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(out, res.Buf, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Logf("đã ghi %s: %d sản phẩm, %d byte", out, res.Count, len(res.Buf))
}

// autoFilter: ExcelJS ghi ref tương đối "A1:<cột cuối>1" (I:684); excelize mặc định ghi "$A$1:...".
func TestExportAutoFilterRef(t *testing.T) {
	s, _ := newSvc(exportRepo(), nil)
	res, err := s.ExportProductsXlsx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	zr, err := zip.NewReader(bytes.NewReader(res.Buf), int64(len(res.Buf)))
	if err != nil {
		t.Fatal(err)
	}
	last, _ := excelize.ColumnNumberToName(len(categories.Labels()) + 1)
	for _, zf := range zr.File {
		if zf.Name != "xl/worksheets/sheet1.xml" {
			continue
		}
		rc, _ := zf.Open()
		b, _ := io.ReadAll(rc)
		rc.Close()
		if want := `<autoFilter ref="A1:` + last + `1"`; !strings.Contains(string(b), want) {
			t.Errorf("thiếu %s: %s", want, regexp.MustCompile(`<autoFilter[^>]*>`).FindString(string(b)))
		}
		return
	}
	t.Error("không thấy sheet1.xml")
}

// Phần ngoài ô của sheet phải giống file ExcelJS (so bằng bộ so sánh vi sai với server Node): không có tên ẩn
// _xlnm._FilterDatabase, không activeCell ở khung đóng băng, có pageMargins / pageSetup mặc định, x14ac:dyDescent="55",
// <dimension> đúng vùng có ô.
func TestExportSheetNhuExcelJS(t *testing.T) {
	s, _ := newSvc(exportRepo(), nil)
	res, err := s.ExportProductsXlsx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	zr, err := zip.NewReader(bytes.NewReader(res.Buf), int64(len(res.Buf)))
	if err != nil {
		t.Fatal(err)
	}
	parts := map[string]string{}
	for _, zf := range zr.File {
		rc, _ := zf.Open()
		b, _ := io.ReadAll(rc)
		rc.Close()
		parts[zf.Name] = string(b)
	}
	sheet, wb := parts["xl/worksheets/sheet1.xml"], parts["xl/workbook.xml"]
	last, _ := excelize.ColumnNumberToName(len(categories.Labels()) + 1)
	for _, want := range []string{
		`x14ac:dyDescent="55"`,
		`<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"`,
		`orientation="portrait"`,
		`<dimension ref="A1:` + last + strconv.Itoa(res.Count+1) + `"`,
	} {
		if !strings.Contains(sheet, want) {
			t.Errorf("sheet1.xml thiếu %s", want)
		}
	}
	for _, bad := range []string{`activeCell=`, `sqref=`, `tabSelected`, `filterMode`} {
		if strings.Contains(sheet, bad) {
			t.Errorf("sheet1.xml không được có %s", bad)
		}
	}
	if strings.Contains(wb, "_FilterDatabase") {
		t.Error("workbook.xml không được có tên ẩn _xlnm._FilterDatabase")
	}
}
