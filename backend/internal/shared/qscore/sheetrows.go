package qscore

import (
	"archive/zip"
	"bytes"
	"compress/flate"
	"io"
	"sort"
	"strings"

	"golang.org/x/text/encoding/unicode"

	apperr "qspro-backend/internal/shared/errors"
)

// SheetRow: 1 dòng có dữ liệu của sheet đầu. Dong = số dòng thật trong file (1 = dòng đầu, tính cả dòng trống xen giữa),
// Cells = các ô của dòng.
type SheetRow struct {
	Dong  int
	Cells []any
}

// SheetRows: đọc SHEET ĐẦU của file nhập (csv khi ext chứa "csv", còn lại xlsx); bỏ dòng trống như
// eachRow({includeEmpty:false}).
//   - xlsx: bộ đọc readXLSX của ImportParse, ô là "" | string | float64 | bool. Dong lấy từ số dòng <row r="..."> của
//     sheet đầu; không đối chiếu được thì đánh số liên tiếp theo các dòng có dữ liệu.
//   - csv: tách ô bằng bộ tách CSV của ImportParse nhưng GIỮ CHUỖI GỐC của ô (không qua csvDatum, vì csvDatum đọc
//     "450.000" thành 450 theo kiểu JS), để nơi gọi tự đọc số kiểu Việt Nam. Dong = số dòng của bản ghi trong file
//     (ô trong ngoặc kép có xuống dòng được tính đủ số dòng).
//
// Không có sheet nào -> lỗi "File không có sheet dữ liệu" như ImportParse.
func SheetRows(buf []byte, ext string) ([]SheetRow, error) {
	if strings.Contains(strings.ToLower(ext), "csv") {
		return csvSheetRows(buf)
	}
	all, err := readXLSX(buf)
	if err != nil {
		return nil, err
	}
	if len(all) == 0 {
		return nil, apperr.New("File không có sheet dữ liệu")
	}
	grid := all[0].grid
	nos := xlsxRowNos(buf, len(grid))
	out := make([]SheetRow, len(grid))
	for i, r := range grid {
		d := i + 1
		if nos != nil {
			d = nos[i]
		}
		out[i] = SheetRow{Dong: d, Cells: r}
	}
	return out, nil
}

// csvSheetRows: như readCSV (cùng cách giải mã UTF-8 và cùng bộ tách) nhưng ô giữ chuỗi gốc và mang số dòng thật.
func csvSheetRows(buf []byte) ([]SheetRow, error) {
	text, err := unicode.UTF8.NewDecoder().String(string(buf))
	if err != nil {
		text = strings.ToValidUTF8(string(buf), "�")
	}
	recs, err := csvRows(text)
	if err != nil {
		return nil, err
	}
	out := []SheetRow{}
	line := 1
	for _, r := range recs {
		arr := make([]any, len(r))
		has, nl := false, 0
		for i, d := range r {
			arr[i] = d
			if d != "" {
				has = true
			}
			nl += strings.Count(d, "\n")
		}
		if has {
			out = append(out, SheetRow{Dong: line, Cells: arr})
		}
		line += 1 + nl
	}
	return out, nil
}

// xlsxRowNos: số dòng <row r> của các dòng có dữ liệu ở sheet đầu, theo đúng cách readXLSX chọn sheet đầu
// (sheet có trong workbook.xml, sheetId ≥ 1, đứng trước trong workbook.xml; cùng vị trí thì sheetId nhỏ hơn) và cách
// build giữ dòng (có ô không rỗng, hoặc nằm trong vùng gộp ô). Không đọc được, hoặc số dòng khác want -> nil.
func xlsxRowNos(buf []byte, want int) []int {
	zr, err := zip.NewReader(bytes.NewReader(buf), int64(len(buf)))
	if err != nil {
		return nil
	}
	files := map[string]*zip.File{}
	for _, f := range zr.File {
		if !strings.HasSuffix(f.Name, "/") {
			files[strings.TrimPrefix(f.Name, "/")] = f
		}
	}
	read := func(name string) []byte {
		f := files[name]
		if f == nil {
			return nil
		}
		raw, err := f.OpenRaw()
		if err != nil {
			return nil
		}
		var rd io.Reader = raw
		switch f.Method {
		case zip.Store:
		case zip.Deflate:
			fr := flate.NewReader(raw)
			defer fr.Close()
			rd = fr
		default:
			return nil
		}
		b, err := io.ReadAll(rd)
		if err != nil {
			return nil
		}
		return b
	}
	wb, rels := read("xl/workbook.xml"), read("xl/_rels/workbook.xml.rels")
	if wb == nil || rels == nil {
		return nil
	}
	defs, err := parseWorkbook(wb)
	if err != nil {
		return nil
	}
	targets, err := parseRels(rels)
	if err != nil {
		return nil
	}
	// mỗi file sheet nhận sheetId của def CUỐI trỏ tới nó (như reconcile); cùng sheetId thì file sau trong zip thắng
	idOf := map[string]float64{}
	for _, d := range defs {
		if t, ok := targets[d.rID]; ok {
			p := "xl/" + reRelTarget.ReplaceAllString(t, "")
			if files[p] != nil && reSheetEntry.MatchString(p) {
				idOf[p] = d.id
			}
		}
	}
	type cand struct {
		path    string
		id      int
		orderNo int
		zipPos  int
	}
	byID := map[int]cand{}
	for pos, f := range zr.File {
		p := strings.TrimPrefix(f.Name, "/")
		id, ok := idOf[p]
		if !ok || id != id || id < 1 || id >= 1<<31 {
			continue
		}
		orderNo := -1
		for i, d := range defs {
			if d.id == id {
				orderNo = i
				break
			}
		}
		byID[int(id)] = cand{p, int(id), orderNo, pos}
	}
	if len(byID) == 0 {
		return nil
	}
	cs := make([]cand, 0, len(byID))
	for _, c := range byID {
		cs = append(cs, c)
	}
	sort.Slice(cs, func(a, b int) bool {
		if cs[a].orderNo != cs[b].orderNo {
			return cs[a].orderNo < cs[b].orderNo
		}
		return cs[a].id < cs[b].id
	})
	data := read(cs[0].path)
	if data == nil {
		return nil
	}
	ws, err := parseWorksheet(data)
	if err != nil {
		return nil
	}
	links := map[string]bool{}
	for _, h := range ws.hyperlinks {
		if h[1] != "" {
			links[h[0]] = true
		}
	}
	has := map[int]bool{}
	for _, r := range ws.rows {
		if r.number != r.number || r.number < 1 {
			continue
		}
		n, co := int(r.number), false
		for _, c := range r.cells {
			if (c.typ != ctMerge && c.typ != ctNull) || (c.hasAddr && links[c.addr]) {
				co = true
				break
			}
		}
		has[n] = co // dòng trùng số: dòng sau thay dòng trước như build
	}
	for _, ref := range ws.merges {
		if i := strings.LastIndex(ref, "!"); i >= 0 {
			ref = ref[i+1:]
		}
		a, b, _ := strings.Cut(ref, ":")
		c1, r1, _, _ := decodeAddress(a)
		c2, r2 := c1, r1
		if b != "" {
			c2, r2, _, _ = decodeAddress(b)
		}
		top, left, bottom, right := min(r1, r2), min(c1, c2), max(r1, r2), max(c1, c2)
		if top < 1 || left < 1 {
			continue
		}
		for i := top; i <= bottom; i++ {
			if i > top || right > left {
				has[i] = true
			}
		}
	}
	nos := []int{}
	for n, ok := range has {
		if ok {
			nos = append(nos, n)
		}
	}
	if len(nos) != want {
		return nil
	}
	sort.Ints(nos)
	return nos
}

// DecodeBase64 = Buffer.from(s, 'base64') của Node (cùng cách giải mã với ImportParse): bỏ ký tự lạ,
// nhận cả bảng url-safe, dừng ở dấu '=' đầu tiên.
func DecodeBase64(s string) []byte { return decodeBase64(s) }
