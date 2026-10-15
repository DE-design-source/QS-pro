package qscore

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func gridJSON(t *testing.T, rs []SheetRow) string {
	t.Helper()
	g := make([]any, len(rs))
	for i, r := range rs {
		g[i] = []any{r.Dong, r.Cells}
	}
	b, err := json.Marshal(g)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// xlsx: đúng bộ đọc của ImportParse (dòng trống bị bỏ, ô số giữ kiểu số); Dong = số dòng Excel.
func TestSheetRowsTemplate(t *testing.T) {
	b, err := os.ReadFile(filepath.Join("..", "..", "modules", "estimates", "assets", "mau-nhap-cong-tac.xlsx"))
	if err != nil {
		t.Fatal(err)
	}
	g, err := SheetRows(b, "xlsx")
	if err != nil {
		t.Fatal(err)
	}
	if len(g) < 5 {
		t.Fatalf("file mẫu: %d dòng", len(g))
	}
	if got := gridJSON(t, g[:1]); got != `[[1,["Nội dung công việc","Hạng mục","Số hạng mục","Loại báo giá","Cách tính","ĐVT","Khối lượng","Diện tích","Hệ số","Nhà thầu","Giá bán lẻ","Đơn giá nhà thầu","Ghi chú","Thông số kỹ thuật","Phạm vi ứng dụng","Ảnh"]]]` {
		t.Errorf("dòng tiêu đề: %s", got)
	}
	if v, ok := g[1].Cells[10].(float64); !ok || v != 450000 {
		t.Errorf("Giá bán lẻ dòng 2 phải là số 450000: %#v", g[1].Cells[10])
	}
	if len(g[4].Cells) != 1 || g[4].Dong != 5 {
		t.Errorf("dòng ghi chú là dòng 5, chỉ có cột A: %s", gridJSON(t, g[4:5]))
	}
	for i, r := range g {
		if r.Dong != i+1 {
			t.Errorf("file mẫu không có dòng trống: dòng %d mang số %d", i+1, r.Dong)
		}
	}
}

// csv: ô giữ chuỗi gốc ("450.000" không thành 450); Dong tính cả dòng trống và ô xuống dòng trong ngoặc kép.
func TestSheetRowsCSV(t *testing.T) {
	g, err := SheetRows([]byte("a,b\n\n1,\"x,y\"\n,\n\"m\nn\",450.000\r\nz"), "text/CSV")
	if err != nil {
		t.Fatal(err)
	}
	if got := gridJSON(t, g); got != `[[1,["a","b"]],[3,["1","x,y"]],[5,["m\nn","450.000"]],[7,["z"]]]` {
		t.Errorf("csv: %s", got)
	}
	if _, err := SheetRows([]byte("không phải zip"), "xlsx"); err == nil {
		t.Error("xlsx hỏng phải báo lỗi")
	}
}

func TestDecodeBase64(t *testing.T) {
	src := []byte("Phần thô ✓")
	if got := string(DecodeBase64(base64.StdEncoding.EncodeToString(src))); got != string(src) {
		t.Errorf("base64 chuẩn: %q", got)
	}
	if got := string(DecodeBase64(base64.RawURLEncoding.EncodeToString(src))); got != string(src) {
		t.Errorf("base64 url-safe không đệm: %q", got)
	}
}
