package estimates

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/qscore"
	"qspro-backend/internal/shared/tenant"
)

/* Nhập công tác từ file mẫu (route chỉ bản Go POST /api/v1/work-items/import/parse, roadmap M5.1). */

// sha256 của public/mau-nhap-cong-tac.xlsx ở commit cuối còn app Node (83d264e).
const mauSHA = "3d4aa071033c6f08140bfa48d1626b6db7a0a75f25c2df424efaf78caabc1ded"

func parseB(t *testing.T, s *Service, b []byte, ext string) (*omap.Map, error) {
	t.Helper()
	return s.CtImportParse(context.Background(), testActor, base64.StdEncoding.EncodeToString(b), ext)
}

func rowsOf(t *testing.T, r *omap.Map) ([]*omap.Map, []*omap.Map) {
	t.Helper()
	var rows, loi []*omap.Map
	for _, x := range jsval.AsArray(r.Val("rows")) {
		rows = append(rows, jsval.AsMap(x))
	}
	for _, x := range jsval.AsArray(r.Val("loi")) {
		loi = append(loi, jsval.AsMap(x))
	}
	return rows, loi
}

func TestCtImportTemplate(t *testing.T) {
	sum := sha256.Sum256(mauNhapCongTac)
	if hex.EncodeToString(sum[:]) != mauSHA {
		t.Fatalf("file mẫu nhúng khác bản gốc: %x", sum)
	}
	s, _ := newSvc(&fakeRepo{}, fakePerms{edit: true})
	r, err := parseB(t, s, mauNhapCongTac, "xlsx")
	if err != nil {
		t.Fatal(err)
	}
	rows, loi := rowsOf(t, r)
	if len(loi) != 0 {
		t.Fatalf("file mẫu không được sinh lỗi (kể cả dòng 5 'Ghi chú:'): %s", js(t, loi))
	}
	if len(rows) != 3 {
		t.Fatalf("file mẫu phải ra đúng 3 công tác, được %d: %s", len(rows), js(t, rows))
	}
	want := []string{
		`{"ten":"Giàn tải, máy ép cọc Pmax 90T","hangMuc":"Công tác ép cọc","maNhom":"II","loai":"kt_sobo","mode":"item","dvt":"gói","kl":1,"dt":"","hs":"","ncc":"H77","dg":450000,"dgnt":405000,"gc":"Huy động, dựng và tháo giàn ép","thongSo":"Lực ép tối đa (Pmax): 90 tấn","phamVi":"Nhà phố, biệt thự","hinhAnh":""}`,
		`{"ten":"Thi công xây thô","hangMuc":"Thi công xây thô","maNhom":"IV","loai":"kt_sobo","mode":"area","dvt":"m2","kl":"","dt":178.56,"hs":1.7,"ncc":"","dg":4200000,"dgnt":"","gc":"Không gồm nhân công hoàn thiện","thongSo":"","phamVi":"","hinhAnh":""}`,
		`{"ten":"Xin phép xây dựng","hangMuc":"Công tác chuẩn bị","maNhom":"I","loai":"kt_chitiet","mode":"none","dvt":"gói","kl":"","dt":"","hs":"","ncc":"","dg":"","dgnt":"","gc":"Chưa bao gồm","thongSo":"","phamVi":"","hinhAnh":""}`,
	}
	for i, w := range want {
		if g := js(t, rows[i]); g != w {
			t.Errorf("dòng %d:\n  được %s\n  mong %s", i+1, g, w)
		}
	}
	// mỗi row qua ctToRow ra đúng mã loại / chế độ (lưu bằng ctSave không đổi giá trị)
	for _, x := range rows {
		db, err := ctToRow(x)
		if err != nil || db.Val("loai") != x.Val("loai") || db.Val("che_do") != x.Val("mode") {
			t.Errorf("ctToRow(%s) = %s %v", js(t, x), js(t, db), err)
		}
	}
}

// Mọi nhãn mà dòng ghi chú của file mẫu liệt kê đều phải ánh xạ được (đọc nhãn từ chính file).
func TestCtImportTemplateNoteLabels(t *testing.T) {
	var note string
	grid := mustGrid(t, mauNhapCongTac, "xlsx")
	for _, r := range grid {
		if a := cellStr(r, 0); strings.HasPrefix(a, "Ghi chú:") {
			note = a
		}
	}
	if note == "" {
		t.Fatal("file mẫu không còn dòng 'Ghi chú:'")
	}
	m := regexp.MustCompile(`Loại báo giá: (.+?)\. Cách tính: (.+?)\.$`).FindStringSubmatch(note)
	if m == nil {
		t.Fatalf("dòng ghi chú đổi dạng: %q", note)
	}
	check := func(list string, tbl map[string]string, want []string) {
		labels := strings.Split(list, " / ")
		if len(labels) != len(want) {
			t.Fatalf("số nhãn %q: %d", list, len(labels))
		}
		for i, l := range labels {
			if got := tbl[ctKey(l)]; got != want[i] {
				t.Errorf("nhãn %q -> %q, mong %q", l, got, want[i])
			}
		}
	}
	check(m[1], ctLoaiByLabel, []string{"kt_chitiet", "kt_sobo", "dt_nhancong", "dt_vattu"})
	check(m[2], ctModeByLabel, []string{"item", "area", "area0", "none"})
}

func mustGrid(t *testing.T, b []byte, ext string) [][]any {
	t.Helper()
	r, err := qscore.SheetRows(b, ext)
	if err != nil {
		t.Fatal(err)
	}
	g := make([][]any, len(r))
	for i, x := range r {
		g[i] = x.Cells
	}
	return g
}

func TestCtImportCSV(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{edit: true})
	csv := strings.Join([]string{
		`Ghi chú: file thử`,
		`  NỘI DUNG  công VIỆC ,hạng mục,Loại báo giá,CÁCH TÍNH,Khối lượng,Giá bán lẻ,Đơn giá nhà thầu,Nhà thầu`,
		`A1,HM,Dự toán · Nhân công,Chỉ tính khối lượng,"1.234,5",450000,,ZZ_NT`,
		`A2,HM,Khái toán xyz,Khối lượng × đơn giá,2,10,8,`,
		`A3,HM,,cách lạ,,,,`,
		`A4,,Dự toán · Vật tư,,,,,`,
		`,HM,Dự toán · Vật tư,,,,,`,
		`Ghi chú: khác,HM,,,,,,`,
		`Ghi chú: cuối file,,,,,,,`,
		`a5,hm,DỰ TOÁN·VẬT TƯ,khối lượng×đơn giá,,,,`,
	}, "\n")
	r, err := parseB(t, s, []byte(csv), "csv")
	if err != nil {
		t.Fatal(err)
	}
	rows, loi := rowsOf(t, r)
	got := []string{}
	for _, x := range rows {
		got = append(got, jsval.S(x.Val("ten"))+"|"+jsval.S(x.Val("loai"))+"|"+jsval.S(x.Val("mode"))+"|"+jsval.S(x.Val("kl"))+"|"+jsval.S(x.Val("dg"))+"|"+jsval.S(x.Val("dgnt"))+"|"+jsval.S(x.Val("ncc")))
	}
	// dòng tiêu đề nằm ở dòng 2; dòng "Ghi chú: khác" có ô khác không trống nên vẫn là công tác
	want := []string{"A1|dt_nhancong|area0|1234.5|450000||ZZ_NT", "Ghi chú: khác|kt_chitiet|item||||", "a5|dt_vattu|item||||"}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Errorf("rows:\n%s\nmong:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
	wantLoi := []string{
		`4 A2 Loại báo giá 'Khái toán xyz' không hợp lệ loai=`,
		`5 A3 Cách tính 'cách lạ' không hợp lệ loai=kt_chitiet`,
		`6 A4 Thiếu Hạng mục loai=dt_vattu`,
	}
	gl := []string{}
	for _, x := range loi {
		gl = append(gl, jsval.S(x.Val("dong"))+" "+jsval.S(x.Val("ten"))+" "+jsval.S(x.Val("msg"))+" loai="+jsval.S(jsval.AsMap(x.Val("row")).Val("loai")))
	}
	if strings.Join(gl, "\n") != strings.Join(wantLoi, "\n") {
		t.Errorf("loi:\n%s\nmong:\n%s", strings.Join(gl, "\n"), strings.Join(wantLoi, "\n"))
	}
}

// Ô số: chuỗi đọc kiểu Việt Nam như form ("450.000" = 450000 cả ở CSV); chữ hoặc số âm -> loi, ô đó để trống trong row.
// dong = số dòng thật của file kể cả dòng trống xen giữa.
func TestCtImportNumbers(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{edit: true})
	csv := "Nội dung công việc,Hạng mục,Giá bán lẻ,Đơn giá nhà thầu,Khối lượng,Hệ số\n" +
		"A,H,450.000,\"1.200.000\",\"12,5\",1.5\n" +
		"B,H,450.000 đ,1 200 000,1.2E+03,\n" +
		"\n\n" +
		"C,H,-5,abc,2,x\n" +
		"\n" +
		"D,H,10,true,,\n"
	r, err := parseB(t, s, []byte(csv), "csv")
	if err != nil {
		t.Fatal(err)
	}
	rows, loi := rowsOf(t, r)
	got := []string{}
	for _, x := range rows {
		got = append(got, jsval.S(x.Val("ten"))+"|"+jsval.S(x.Val("dg"))+"|"+jsval.S(x.Val("dgnt"))+"|"+jsval.S(x.Val("kl"))+"|"+jsval.S(x.Val("hs")))
	}
	if g := strings.Join(got, ","); g != "A|450000|1200000|12.5|1.5,B|450000|1200000|1200|" {
		t.Errorf("rows: %s", g)
	}
	gl := []string{}
	for _, x := range loi {
		row := jsval.AsMap(x.Val("row"))
		gl = append(gl, jsval.S(x.Val("dong"))+" "+jsval.S(x.Val("ten"))+": "+jsval.S(x.Val("msg"))+" | dg="+jsval.S(row.Val("dg"))+" dgnt="+jsval.S(row.Val("dgnt"))+" kl="+jsval.S(row.Val("kl")))
	}
	want := "6 C: Hệ số 'x' không phải số; Giá bán lẻ '-5' không được âm; Đơn giá nhà thầu 'abc' không phải số | dg= dgnt= kl=2\n" +
		"8 D: Đơn giá nhà thầu 'true' không phải số | dg=10 dgnt= kl="
	if g := strings.Join(gl, "\n"); g != want {
		t.Errorf("loi:\n%s\nmong:\n%s", g, want)
	}
}

// xlsx có dòng trống xen giữa: dong = số dòng Excel (<row r>), không phải số thứ tự dòng có dữ liệu.
func TestCtImportXLSXRowNumbers(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{edit: true})
	b := xlsxOf(t, []xlsxRow{
		{1, []string{"Nội dung công việc", "Hạng mục", "Loại báo giá"}},
		{2, []string{"A", "H", "Khái toán sơ bộ"}},
		{5, []string{"B", "H", "Loại lạ"}},
		{9, []string{"C", "", ""}},
	})
	r, err := parseB(t, s, b, "xlsx")
	if err != nil {
		t.Fatal(err)
	}
	rows, loi := rowsOf(t, r)
	gl := []string{}
	for _, x := range loi {
		gl = append(gl, jsval.S(x.Val("dong"))+" "+jsval.S(x.Val("ten")))
	}
	if len(rows) != 1 || strings.Join(gl, ",") != "5 B,9 C" {
		t.Errorf("rows=%d loi=%s", len(rows), strings.Join(gl, ","))
	}
}

// Cột "Thứ tự" tuỳ chọn: số nguyên không âm -> thuTu; giá trị khác -> loi; ô trống thì row không có khoá thuTu.
func TestCtImportThuTu(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{edit: true})
	r, err := parseB(t, s, []byte("Nội dung công việc,Hạng mục,THỨ  TỰ\nA,H,3\nB,H,\nC,H,1.5\nD,H,-1\nE,H,abc\nF,H,07"), "csv")
	if err != nil {
		t.Fatal(err)
	}
	rows, loi := rowsOf(t, r)
	got := []string{}
	for _, x := range rows {
		got = append(got, jsval.S(x.Val("ten"))+"="+jsval.S(x.Val("thuTu")))
	}
	if g := strings.Join(got, ","); g != "A=3,B=,F=7" || rows[1].Has("thuTu") {
		t.Errorf("thuTu: %s", g)
	}
	msgs := []string{}
	for _, x := range loi {
		msgs = append(msgs, jsval.S(x.Val("ten"))+":"+jsval.S(x.Val("msg")))
	}
	if g := strings.Join(msgs, "|"); g != "C:Thứ tự '1.5' phải là số nguyên không âm|D:Thứ tự '-1' phải là số nguyên không âm|E:Thứ tự 'abc' phải là số nguyên không âm" {
		t.Errorf("loi: %s", g)
	}
}

func TestCtImportErrors(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{edit: true})
	if _, err := parseB(t, s, []byte("Tên,Giá\nx,1"), "csv"); errText(err) != "Không tìm thấy dòng tiêu đề có cột 'Nội dung công việc' - hãy dùng file mẫu" {
		t.Errorf("thiếu tiêu đề: %v", err)
	}
	if _, err := s.CtImportParse(context.Background(), testActor, "", "xlsx"); errText(err) != "Chưa có nội dung file" {
		t.Errorf("file rỗng: %v", err)
	}
	// lỗi zip tiếng Anh của bộ đọc không ra giao diện; lỗi file là 400
	_, err := parseB(t, s, []byte("không phải zip"), "xlsx")
	if !strings.HasPrefix(errText(err), "Không đọc được file Excel (.xlsx)") {
		t.Errorf("file hỏng: %v", err)
	}
	if st, _ := apperr.Status(err); st != 400 {
		t.Errorf("file hỏng phải là 400: %d", st)
	}
	if _, err := parseB(t, s, []byte("Nội dung công việc\n\"chưa đóng"), "csv"); !strings.HasPrefix(errText(err), "Không đọc được file CSV") {
		t.Errorf("csv hỏng: %v", err)
	}
	s2, _ := newSvc(&fakeRepo{}, fakePerms{})
	if _, err := parseB(t, s2, mauNhapCongTac, "xlsx"); errText(err) != "Tài khoản không có quyền thêm dữ liệu" {
		t.Errorf("không quyền: %v", err)
	}
}

func TestCtImportRoute(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{edit: true})
	reg := rpc.NewRegistry()
	s.RegisterRPC(reg)
	gr := reg.GoRoutes()
	if len(gr) != 1 || gr[0].Name != "ctImportParse" || gr[0].Method != "POST" || gr[0].Path != "/work-items/import/parse" || gr[0].Perm != rpc.Login {
		t.Fatalf("route chỉ bản Go: %+v", gr)
	}
	e := testEngine(s)
	body, _ := json.Marshal(map[string]string{"base64": base64.StdEncoding.EncodeToString(mauNhapCongTac), "ext": "xlsx"})
	if w := do(e, "POST", "/api/v1/work-items/import/parse", string(body), false); w.Code != 401 {
		t.Errorf("chưa đăng nhập: %d %s", w.Code, w.Body)
	}
	w := do(e, "POST", "/api/v1/work-items/import/parse", string(body), true)
	if w.Code != 200 || !strings.HasPrefix(w.Body.String(), `{"ok":true,"result":{"rows":[{"ten":"Giàn tải, máy ép cọc Pmax 90T"`) || !strings.HasSuffix(w.Body.String(), `"loi":[]}}`) {
		t.Errorf("POST import/parse: %d %s", w.Code, w.Body)
	}
	if w := do(e, "POST", "/api/v1/work-items/import/parse", `{}`, true); w.Code == 200 {
		t.Errorf("thân rỗng phải lỗi: %d %s", w.Code, w.Body)
	}
}

// Đọc file -> lưu bằng ctSave trên qspro_gotest -> ctList có đủ, đúng loại / chế độ / thứ tự; dọn sạch.
func TestCtImportSaveDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !strings.Contains(url, "/qspro_gotest") {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	defer db.Close()
	bg := context.Background()
	no := database.Opt{NoScope: true}
	us, err := db.Select(bg, "users", database.SelectOpt{Filter: database.Eq("username", "admin") + "&cong_ty_id=not.is.null", Limit: 1, NoScope: true})
	if err != nil || len(us) == 0 {
		t.Fatalf("database thử không có tài khoản admin thuộc công ty: %v", err)
	}
	const who = "zz_u8_import_test"
	a := &actor.Actor{UID: us[0].Val("id"), U: who, R: "admin", CT: us[0].Val("cong_ty_id")}
	ctx := tenant.With(bg, tenant.Ctx{UID: a.UID, Role: a.R, CongTyID: a.CT})
	like := "ten=like.ZZ_U8T_*"
	cleanup := func() {
		if _, err := db.Remove(bg, "cong_tac", like, no); err != nil {
			t.Errorf("dọn cong_tac: %v", err)
		}
		if _, err := db.Remove(bg, "cong_tac_history", database.Eq("changed_by_name", who), no); err != nil {
			t.Errorf("dọn cong_tac_history: %v", err)
		}
	}
	cleanup()
	defer cleanup()

	svc := New(Deps{DB: db, Perms: fakePerms{edit: true, duyet: true}, Auditor: &fakeAudit{}})
	csv := "Nội dung công việc,Hạng mục,Loại báo giá,Cách tính,Nhà thầu,Giá bán lẻ,Đơn giá nhà thầu,Khối lượng,Thứ tự\n" +
		"ZZ_U8T_B,ZZ_U8T_HM,Dự toán · Vật tư,Chỉ tính khối lượng,ZZ_NT,\"1.200.000\",900000,3,2\n" +
		"ZZ_U8T_A,ZZ_U8T_HM,Khái toán sơ bộ,Diện tích × hệ số,ZZ_NT,500000,,,1\n"
	r, err := svc.CtImportParse(ctx, a, base64.StdEncoding.EncodeToString([]byte(csv)), "csv")
	if err != nil {
		t.Fatal(err)
	}
	rows, loi := rowsOf(t, r)
	if len(rows) != 2 || len(loi) != 0 {
		t.Fatalf("parse: %s", js(t, r))
	}
	if _, err := svc.CtSave(ctx, a, []any{rows[0], rows[1]}); err != nil {
		t.Fatal(err)
	}
	list, err := svc.CtList(ctx)
	if err != nil {
		t.Fatal(err)
	}
	got := []string{}
	for _, x := range jsval.AsArray(list) {
		m := jsval.AsMap(x)
		if strings.HasPrefix(jsval.S(m.Val("ten")), "ZZ_U8T_") {
			got = append(got, jsval.S(m.Val("ten"))+"|"+jsval.S(m.Val("loai"))+"|"+jsval.S(m.Val("mode"))+"|"+jsval.S(m.Val("ncc"))+"|"+jsval.S(m.Val("dg"))+"|"+jsval.S(m.Val("dgnt"))+"|"+jsval.S(m.Val("kl"))+"|"+jsval.S(m.Val("thuTu")))
		}
	}
	// ctList sắp loai, thu_tu: dt_vattu đứng sau kt_sobo theo thứ tự chữ
	want := "ZZ_U8T_B|dt_vattu|area0|ZZ_NT|1200000|900000|3|2\nZZ_U8T_A|kt_sobo|area|ZZ_NT|500000|0||1"
	if strings.Join(got, "\n") != want {
		t.Errorf("ctList:\n%s\nmong:\n%s", strings.Join(got, "\n"), want)
	}
}

type xlsxRow struct {
	n     int
	cells []string
}

// xlsxOf: file xlsx tối thiểu (1 sheet, ô chuỗi inlineStr, số dòng <row r> tuỳ ý) để thử dòng trống xen giữa.
func xlsxOf(t *testing.T, rows []xlsxRow) []byte {
	t.Helper()
	var sd strings.Builder
	for _, r := range rows {
		sd.WriteString(`<row r="` + strconv.Itoa(r.n) + `">`)
		for ci, v := range r.cells {
			if v == "" {
				continue
			}
			ref := string(rune('A'+ci)) + strconv.Itoa(r.n)
			sd.WriteString(`<c r="` + ref + `" t="inlineStr"><is><t>` + v + `</t></is></c>`)
		}
		sd.WriteString(`</row>`)
	}
	files := [][2]string{
		{"[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`},
		{"xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Công tác" sheetId="1" r:id="rId1"/></sheets></workbook>`},
		{"xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`},
		{"xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` + sd.String() + `</sheetData></worksheet>`},
	}
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, f := range files {
		w, err := zw.Create(f[0])
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(f[1])); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
