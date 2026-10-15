package quotations

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"errors"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Hàm thuần của export.js: giá trị mong đợi trong testdata/unit.json lấy từ mã Node thật (testdata/gen-unit.js).
func TestUnitGolden(t *testing.T) {
	b, err := os.ReadFile(filepath.Join("testdata", "unit.json"))
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	u := jsval.AsMap(v)
	js := func(x any) string {
		s, err := omap.MarshalString(x)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	each := func(key string, fn func(c []any)) {
		list := jsval.AsArray(u.Val(key))
		if len(list) == 0 {
			t.Fatalf("unit.json thiếu %s", key)
		}
		for _, c := range list {
			fn(jsval.AsArray(c))
		}
	}
	each("nz", func(c []any) {
		if got := nz(c[0]); js(got) != js(c[1]) {
			t.Errorf("nz(%s) = %s, Node %s", js(c[0]), js(got), js(c[1]))
		}
	})
	each("px", func(c []any) {
		w, ok := c[0].(float64)
		if c[0] != nil && !ok {
			return // px chỉ nhận bề rộng dạng số của EXPORT_STY
		}
		if got := px(w); js(got) != js(c[1]) {
			t.Errorf("px(%s) = %s, Node %s", js(c[0]), js(got), js(c[1]))
		}
	})
	each("roman", func(c []any) {
		if got := roman(int(c[0].(float64))); got != c[1] {
			t.Errorf("roman(%s) = %q, Node %s", js(c[0]), got, js(c[1]))
		}
	})
	each("sheetName", func(c []any) {
		if got := sheetName(c[0]); got != c[1] {
			t.Errorf("sheetName(%s) = %q, Node %s", js(c[0]), got, js(c[1]))
		}
	})
	each("cellOfLine", func(c []any) {
		got, ok := cellOfLine(c[0], c[1])
		if !ok {
			got = nil
		}
		if js(got) != js(c[2]) {
			t.Errorf("cellOfLine(%s, %s) = %s, Node %s", js(c[0]), js(c[1]), js(got), js(c[2]))
		}
	})
}

// 4 hàm rpc của module, đúng tên và quyền của REGISTRY (index.js): đều chỉ cần đăng nhập.
func TestRegisterRPC(t *testing.T) {
	st := &stubs{}
	svc := newTestService(st, nil, &fakeRepo{})
	reg := rpc.NewRegistry()
	svc.RegisterRPC(reg)
	want := []string{"saveCover", "buildCoverFromTemplate", "getCoverOrInit", "exportBaoGia"}
	if got := reg.Names(); len(got) != len(want) {
		t.Fatalf("đăng ký %d hàm %v, cần %d", len(got), got, len(want))
	}
	for _, n := range want {
		if p, ok := reg.PermOf(n); !ok || p != rpc.Login {
			t.Errorf("%s: quyền %v (có: %v), cần rpc.Login", n, p, ok)
		}
	}
}

var testActor = &actor.Actor{UID: "u1", U: "zz_quotations_tester", R: "admin"}

func testEngine(s *Service) *gin.Engine {
	gin.SetMode(gin.TestMode)
	e := gin.New()
	login := func(c *gin.Context) {
		if c.GetHeader("X-Test-Login") != "" {
			actor.Set(c, testActor)
		}
	}
	e.Use(middleware.JSONBody(middleware.JSONBodyLimit), login)
	s.RegisterRoutes(e.Group("/api/v1"))
	s.RegisterRoot(e.Group(""))
	return e
}

func do(e *gin.Engine, method, path, body string, login bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if login {
		req.Header.Set("X-Test-Login", "1")
	}
	w := httptest.NewRecorder()
	e.ServeHTTP(w, req)
	return w
}

// POST /export/bang (index.js:780-794): mã trạng thái, thân lỗi và header như server Node.
func TestExportBangRoute(t *testing.T) {
	e := testEngine(newTestService(&stubs{}, nil, &fakeRepo{}))
	body := `{"ten":"Bảng","cols":[{"label":"A"},{"label":"B","num":true}],"rows":[{"cells":["x",1.5]}],"tong":[["Cộng",1.5]]}`
	for _, c := range []struct {
		name, body string
		login      bool
		status     int
		want       string
	}{
		{"chưa đăng nhập", body, false, 401, `{"error":"Chưa đăng nhập"}`},
		{"không có cột", `{"cols":[]}`, true, 400, `{"error":"Không có cột nào để xuất"}`},
		{"cols không phải mảng", `{"cols":"abc"}`, true, 400, `{"error":"Không có cột nào để xuất"}`},
		{"không có thân", ``, true, 400, `{"error":"Không có cột nào để xuất"}`},
		{"lỗi khi dựng", `{"sheet":"History","cols":[{"label":"A"}]}`, true, 500, `{"error":"The name \"History\" is protected. Please use a different name."}`},
		{"cột null", `{"cols":[null]}`, true, 500, `{"error":"Cannot read properties of null (reading 'label')"}`},
	} {
		w := do(e, "POST", "/export/bang", c.body, c.login)
		if w.Code != c.status || strings.TrimSpace(w.Body.String()) != c.want {
			t.Errorf("%s: %d %s, cần %d %s", c.name, w.Code, w.Body.String(), c.status, c.want)
		}
	}
	w := do(e, "POST", "/export/bang", body, true)
	if w.Code != 200 {
		t.Fatalf("xuất bảng: %d %s", w.Code, w.Body.String())
	}
	h := w.Header()
	if got := h.Get("Content-Type"); got != xlsxMime {
		t.Errorf("Content-Type = %q", got)
	}
	if got := h.Get("Content-Disposition"); got != `attachment; filename="bang.xlsx"` {
		t.Errorf("Content-Disposition = %q", got)
	}
	if h.Get("ETag") == "" || h.Get("Content-Length") == "" {
		t.Errorf("thiếu ETag / Content-Length: %v", h)
	}
	f, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if v, _ := f.GetCellValue("Bang", "A1"); v != "Bảng" {
		t.Errorf("A1 = %q", v)
	}
	if v, _ := f.GetCellValue("Bang", "B4", excelize.Options{RawCellValue: true}); v != "1.5" {
		t.Errorf("B4 = %q", v)
	}
}

// Số vô hạn ở dòng tổng (client gửi 1e999): ExcelJS ghi <v>Infinity</v> vào ô SỐ, không phải ô chữ.
func TestExportBangSoVoHan(t *testing.T) {
	e := testEngine(newTestService(&stubs{}, nil, &fakeRepo{}))
	w := do(e, "POST", "/export/bang", `{"cols":[{"label":"a"},{"label":"b","num":true}],"rows":[{"cells":[1e999,-1e999]}],"tong":[["T",1e999],["U","-1e999"]]}`, true)
	if w.Code != 200 {
		t.Fatalf("xuất bảng: %d %s", w.Code, w.Body.String())
	}
	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	rc, err := zr.Open("xl/worksheets/sheet1.xml")
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	raw, _ := io.ReadAll(rc)
	x := string(raw)
	if strings.Contains(x, "inlineStr") || !strings.Contains(x, "<v>Infinity</v></c>") || !strings.Contains(x, "<v>-Infinity</v></c>") {
		t.Errorf("ô số vô hạn phải là ô số <v>Infinity</v>: %s", x)
	}
}

// REST /api/v1: gọi đúng các phương thức mà cổng rpc gọi, phong bì {"ok":true,"result":...}.
func TestRESTRoutes(t *testing.T) {
	cs := loadCases(t)
	st := newStubs(cs)
	st.lines = jsval.AsArray(jsval.GetPath(cs.spec.Val("lines"), "SUP"))
	e := testEngine(newTestService(st, nil, &fakeRepo{}))
	golden := func(step string) string {
		g := cs.golden[step]
		return `{"ok":true,"result":` + strings.TrimSuffix(strings.TrimPrefix(g, `{"ok":`), "}") + "}"
	}

	if w := do(e, "GET", "/api/v1/projects/ZZ_quotations_P1/cover", "", false); w.Code != 401 {
		t.Errorf("chưa đăng nhập: %d %s", w.Code, w.Body.String())
	}
	if w := do(e, "GET", "/api/v1/projects/ZZ_quotations_P1/cover/template", "", true); w.Code != 200 || strings.TrimSpace(w.Body.String()) != golden("tmpl-SUP") {
		t.Errorf("GET cover/template: %d %.300s", w.Code, w.Body.String())
	}
	if w := do(e, "GET", "/api/v1/projects/ZZ_quotations_P1/cover", "", true); w.Code != 200 || strings.TrimSpace(w.Body.String()) != golden("tmpl-SUP") {
		t.Errorf("GET cover (chưa lưu -> mẫu): %d %.300s", w.Code, w.Body.String())
	}
	w := do(e, "PUT", "/api/v1/projects/ZZ_quotations_P1/cover", `{"rows":[{"stt":"A","hangMuc":"Chỉ một dòng","moTa":"x","chiPhi":42}]}`, true)
	if w.Code != 200 || strings.TrimSpace(w.Body.String()) != golden("save-2") {
		t.Errorf("PUT cover: %d %.300s", w.Code, w.Body.String())
	}
	if w := do(e, "GET", "/api/v1/projects/ZZ_quotations_P1/cover", "", true); strings.TrimSpace(w.Body.String()) != golden("save-2") {
		t.Errorf("GET cover (đã lưu): %d %.300s", w.Code, w.Body.String())
	}
	if w := do(e, "PUT", "/api/v1/projects/ZZ_quotations_P1/cover", `{"rows":"abc"}`, true); w.Code != 500 ||
		strings.TrimSpace(w.Body.String()) != `{"error":"(rows || []).map is not a function"}` {
		t.Errorf("PUT cover sai kiểu: %d %s", w.Code, w.Body.String())
	}
	// chi phí âm -> 400 tiếng Việt, không ghi gì (tờ bìa vẫn là bản save-2)
	for body, want := range map[string]string{
		`{"rows":[{"stt":"1","hangMuc":"a","chiPhi":5},{"stt":"1.1","hangMuc":"âm","chiPhi":-5}]}`: `{"error":"Chi phí dự kiến không được âm (mục 1.1)."}`,
		`{"rows":[{"hangMuc":"âm","chiPhi":"-12,5"}]}`:                                             `{"error":"Chi phí dự kiến không được âm (dòng 1)."}`,
	} {
		if w := do(e, "PUT", "/api/v1/projects/ZZ_quotations_P1/cover", body, true); w.Code != 400 || strings.TrimSpace(w.Body.String()) != want {
			t.Errorf("PUT cover chi phí âm: %d %s", w.Code, w.Body.String())
		}
	}
	if w := do(e, "GET", "/api/v1/projects/ZZ_quotations_P1/cover", "", true); strings.TrimSpace(w.Body.String()) != golden("save-2") {
		t.Errorf("GET cover sau PUT chi phí âm phải giữ bản cũ: %d %.300s", w.Code, w.Body.String())
	}
	w = do(e, "POST", "/api/v1/projects/ZZ_quotations_P1/quotation/export", `{"cols":[{"key":"ten"},{"key":"thanhTienBan"}],"tong":[["Cộng",1]],"org":"Cty"}`, true)
	if w.Code != 200 {
		t.Fatalf("POST quotation/export: %d %.300s", w.Code, w.Body.String())
	}
	v, err := omap.Decode(w.Body.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	res := jsval.AsMap(jsval.AsMap(v).Val("result"))
	if got := res.Keys(); strings.Join(got, ",") != "name,mimeType,base64" {
		t.Errorf("khoá kết quả: %v", got)
	}
	if res.Val("name") != "BaoGia_ZZ_quotations_P1.xlsx" || res.Val("mimeType") != xlsxMime {
		t.Errorf("name / mimeType: %v / %v", res.Val("name"), res.Val("mimeType"))
	}
	buf, err := base64.StdEncoding.DecodeString(jsval.AsString(res.Val("base64")))
	if err != nil {
		t.Fatal(err)
	}
	f, err := excelize.OpenReader(bytes.NewReader(buf))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if got := strings.Join(f.GetSheetList(), "|"); got != "Tờ bìa|Tổng cộng|3.2 Phần hoàn thiện|3.2.4|3.2.4.1|3.2.40|3.2.8.2" {
		t.Errorf("danh sách sheet: %s", got)
	}
}

// doiLoiChiPhiAm chỉ đổi lỗi ràng buộc chi phí; lỗi trước đó (dự án mất / khác công ty) giữ nguyên như rpc.
func TestDoiLoiChiPhiAm(t *testing.T) {
	am := []any{omap.Of("stt", " ", "chiPhi", -1e-9)}
	ck := errors.New(`DB POST khai_toan -> 409 {"code":"23514","message":"violates check constraint \"ck_cost_estimate_lines_cost\""}`)
	if got := doiLoiChiPhiAm(ck, am); got == nil || got.Error() != "Chi phí dự kiến không được âm (dòng 1)." {
		t.Errorf("lỗi ràng buộc: %v", got)
	}
	mat := apperr.New(apperr.DAMat)
	if got := doiLoiChiPhiAm(mat, am); got != mat {
		t.Errorf("dự án mất phải giữ nguyên: %v", got)
	}
	if got := doiLoiChiPhiAm(nil, am); got != nil {
		t.Errorf("không lỗi: %v", got)
	}
	if got := doiLoiChiPhiAm(ck, []any{omap.Of("chiPhi", 0)}); got != ck {
		t.Errorf("không tìm được dòng âm phải giữ lỗi gốc: %v", got)
	}
}
