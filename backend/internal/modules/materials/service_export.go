package materials

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"io"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	"qspro-backend/internal/modules/categories"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

const (
	exportSheet = "Danh sách sản phẩm"
	xlsxMime    = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

// docProps/core.xml như ExcelJS ghi cho workbook có creator "Dezon Pro" (SetDocProps của excelize ghi
// <lastModifiedBy> không kèm tiền tố cp: nên ExcelJS không đọc lại được).
const (
	coreXMLHead = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Dezon Pro</dc:creator><dc:title></dc:title><dc:subject></dc:subject><dc:description></dc:description><cp:keywords></cp:keywords><cp:category></cp:category><cp:lastModifiedBy>Unknown</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">`
	coreXMLMid  = `</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">`
	coreXMLTail = `</dcterms:modified></cp:coreProperties>`
)

// ExportResult: kết quả của exportProductsXlsx - {name, count, buf}.
type ExportResult struct {
	Name  string
	Count int
	Buf   []byte
}

// xlsStr: chuỗi như Excel đọc lại từ file của ExcelJS - xmlEncode bỏ ký tự điều khiển (0-8, 11, 12, 14-31, 127),
// còn CR ghi thẳng vào XML nên bộ đọc chuẩn hoá CRLF / CR thành LF.
func xlsStr(s string) string {
	if !strings.ContainsFunc(s, func(r rune) bool { return r < 32 && r != 9 && r != 10 || r == 127 }) {
		return s
	}
	var b strings.Builder
	rs := []rune(s)
	for i, r := range rs {
		switch {
		case r == 13:
			if i+1 >= len(rs) || rs[i+1] != 10 {
				b.WriteByte(10)
			}
		case r < 32 && r != 9 && r != 10, r == 127:
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

// longStrs: chuỗi dài hơn giới hạn ô của excelize (32767 đơn vị UTF-16). ExcelJS không cắt, nên ô nhận một chuỗi
// giữ chỗ rồi patch() thay lại chuỗi đầy đủ trong bảng shared strings trước khi ghi file.
type longStrs struct {
	full map[string]string // giữ chỗ -> chuỗi đầy đủ
	hold map[string]string // chuỗi đầy đủ -> giữ chỗ
}

func (l *longStrs) holder(s string) string {
	if h, ok := l.hold[s]; ok {
		return h
	}
	if l.full == nil {
		l.full, l.hold = map[string]string{}, map[string]string{}
	}
	// \x01 không thể có trong chuỗi đã qua xlsStr nên không trùng dữ liệu thật
	h := "\x01" + strconv.Itoa(len(l.full))
	l.full[h], l.hold[s] = s, h
	return h
}

func (l *longStrs) patch(f *excelize.File) {
	if len(l.full) == 0 || f.SharedStrings == nil {
		return
	}
	for i := range f.SharedStrings.SI {
		t := f.SharedStrings.SI[i].T
		if t == nil {
			continue
		}
		s, ok := l.full[t.Val]
		if !ok {
			continue
		}
		t.Val = s
		if strings.ContainsRune(" \t\n", rune(s[0])) || strings.ContainsRune(" \t\n", rune(s[len(s)-1])) {
			t.Space = xml.Attr{Name: xml.Name{Space: excelize.NameSpaceXML, Local: "space"}, Value: "preserve"}
		}
	}
}

func setStr(f *excelize.File, long *longStrs, cell, v string) error {
	v = xlsStr(v)
	if jsval.Len16(v) > excelize.TotalCellChars {
		v = long.holder(v)
	}
	return f.SetCellStr(exportSheet, cell, v)
}

// ExportProductsXlsx = exportProductsXlsx (I:652-687): file Excel danh sách sản phẩm.
// Cột lấy đúng theo DB_LABEL2COL (cùng bộ nhãn với file mẫu nhập hàng loạt) nên file tải về sửa xong nạp ngược lại được.
// keys nil = tất cả; có keys thì lọc theo String(recordId) hoặc String(ma). Luôn đọc lại danh mục (làm mới cache).
func (s *Service) ExportProductsXlsx(ctx context.Context, keys []any) (*ExportResult, error) {
	ds, err := s.GetProducts(ctx)
	if err != nil {
		return nil, err
	}
	if len(keys) > 0 {
		set := map[string]bool{}
		for _, k := range keys {
			set[jsval.ToString(k)] = true
		}
		loc := []any{}
		for _, p := range ds {
			m := p.(*omap.Map)
			if set[jsval.ToString(m.Val("recordId"))] || set[jsval.ToString(m.Val("ma"))] {
				loc = append(loc, p)
			}
		}
		ds = loc
	}
	type cot struct {
		header, col string
		width       float64
	}
	cots := []cot{{"STT", "", 6}}
	for _, lc := range categories.DBLabel2Col {
		if lc.Label != nhanAnh {
			cots = append(cots, cot{lc.Label, lc.Col, math.Min(34, math.Max(12, float64(jsval.Len16(lc.Label)+4)))})
		}
	}
	cots = append(cots, cot{nhanAnh, "", 40})

	f := excelize.NewFile()
	defer f.Close()
	if err := f.SetSheetName("Sheet1", exportSheet); err != nil {
		return nil, err
	}
	if err := f.SetPanes(exportSheet, &excelize.Panes{
		Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft",
		Selection: []excelize.Selection{{Pane: "bottomLeft"}}, // ExcelJS không ghi activeCell / sqref cho khung đóng băng
	}); err != nil {
		return nil, err
	}
	// ExcelJS luôn ghi sheetFormatPr, pageMargins và pageSetup mặc định
	f64, str, pi := func(v float64) *float64 { return &v }, func(v string) *string { return &v }, func(v int) *int { return &v }
	scale := uint(100)
	if err := f.SetSheetProps(exportSheet, &excelize.SheetPropsOptions{DefaultRowHeight: f64(15)}); err != nil {
		return nil, err
	}
	if err := f.SetPageMargins(exportSheet, &excelize.PageLayoutMarginsOptions{
		Left: f64(0.7), Right: f64(0.7), Top: f64(0.75), Bottom: f64(0.75), Header: f64(0.3), Footer: f64(0.3),
	}); err != nil {
		return nil, err
	}
	if err := f.SetPageLayout(exportSheet, &excelize.PageLayoutOptions{
		Orientation: str("portrait"), AdjustTo: &scale, FitToWidth: pi(1), FitToHeight: pi(1),
	}); err != nil {
		return nil, err
	}
	// dòng tiêu đề: h.font / h.fill / h.alignment đặt cho cả dòng lẫn từng ô đã có
	head, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"12324C"}},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	if err != nil {
		return nil, err
	}
	var long longStrs
	names := make([]string, len(cots))
	for i, c := range cots {
		names[i], _ = excelize.ColumnNumberToName(i + 1)
		if c.width != 9 { // ExcelJS coi độ rộng 9 là mặc định và không ghi thẻ <col>
			if err := f.SetColWidth(exportSheet, names[i], names[i], c.width); err != nil {
				return nil, err
			}
		}
		if err := setStr(f, &long, names[i]+"1", c.header); err != nil {
			return nil, err
		}
	}
	last := names[len(names)-1]
	if err := f.SetRowHeight(exportSheet, 1, 30); err != nil {
		return nil, err
	}
	if err := f.SetRowStyle(exportSheet, 1, 1, head); err != nil {
		return nil, err
	}
	if err := f.SetCellStyle(exportSheet, "A1", last+"1", head); err != nil {
		return nil, err
	}
	for i, p := range ds {
		m := p.(*omap.Map)
		raw := jsval.AsMap(m.Val("raw"))
		rn := strconv.Itoa(i + 2)
		if err := f.SetCellDefault(exportSheet, "A"+rn, strconv.Itoa(i+1)); err != nil {
			return nil, err
		}
		for j := 1; j < len(cots)-1; j++ {
			// giá trị trong raw luôn là chuỗi (thiếu / null -> ô chuỗi rỗng, ExcelJS vẫn ghi ô)
			if err := setStr(f, &long, names[j]+rn, jsval.S(raw.Val(cots[j].col))); err != nil {
				return nil, err
			}
		}
		anh := jsval.ToString(jsval.Or(m.Val("anhTatCa"), m.Val("hinhAnh"), ""))
		if err := setStr(f, &long, last+rn, anh); err != nil {
			return nil, err
		}
	}
	long.patch(f)
	if err := f.AutoFilter(exportSheet, "A1:"+last+"1", nil); err != nil {
		return nil, err
	}
	// excelize ghi ref tuyệt đối ($A$1:$EA$1), ExcelJS ghi A1:EA1. Kiểu worksheet của excelize không xuất ra ngoài gói
	// nên sửa trường (đã xuất) qua reflect.
	if ws, ok := f.Sheet.Load("xl/worksheets/sheet1.xml"); ok {
		if v := reflect.ValueOf(ws); v.Kind() == reflect.Pointer && v.Elem().Kind() == reflect.Struct {
			if af := v.Elem().FieldByName("AutoFilter"); af.IsValid() && af.Kind() == reflect.Pointer && !af.IsNil() {
				if ref := af.Elem().FieldByName("Ref"); ref.IsValid() && ref.CanSet() && ref.Kind() == reflect.String {
					ref.SetString("A1:" + last + "1")
				}
			}
		}
	}
	// excelize thêm tên ẩn _xlnm._FilterDatabase cho autoFilter; ExcelJS không ghi tên nào
	if wb := f.WorkBook; wb != nil {
		wb.DefinedNames = nil
	}
	// excelize để nguyên <dimension ref="A1">; ExcelJS ghi đúng vùng có ô
	if err := f.SetSheetDimension(exportSheet, "A1:"+last+strconv.Itoa(len(ds)+1)); err != nil {
		return nil, err
	}
	// excelize tự thêm <family val="2"/> vào font mới; ExcelJS chỉ ghi thuộc tính được đặt (bold, color)
	if st := f.Styles; st != nil && st.Fonts != nil {
		for i, fnt := range st.Fonts.Font {
			if i > 0 && fnt != nil {
				fnt.Family = nil
			}
		}
	}
	now := time.Now().UTC()
	stamp := now.Format("2006-01-02T15:04:05Z")
	f.Pkg.Store("docProps/core.xml", []byte(coreXMLHead+stamp+coreXMLMid+stamp+coreXMLTail))
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	out, err := repackSheet(buf.Bytes())
	if err != nil {
		return nil, err
	}
	return &ExportResult{Name: "danh-sach-san-pham-" + now.Format("2006-01-02") + ".xlsx", Count: len(ds), Buf: out}, nil
}

var (
	reWorksheetTag = regexp.MustCompile(`<worksheet[^>]*>`)
	reSheetFmt     = regexp.MustCompile(`<sheetFormatPr defaultRowHeight="15"([^>]*)>`)
	reSheetPr      = regexp.MustCompile(`<sheetPr filterMode="true"></sheetPr>`)
	reTabSelected  = regexp.MustCompile(` tabSelected="true"`)
)

// repackSheet sửa những chỗ excelize ghi khác ExcelJS trong xl/worksheets/sheet1.xml rồi đóng gói lại (.xlsx là zip):
// sheetFormatPr có x14ac:dyDescent="55" (kèm khai báo namespace), bỏ <sheetPr filterMode> và tabSelected mà ExcelJS không ghi.
func repackSheet(src []byte) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(src), int64(len(src)))
	if err != nil {
		return nil, err
	}
	var out bytes.Buffer
	zw := zip.NewWriter(&out)
	for _, zf := range zr.File {
		rc, err := zf.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}
		if zf.Name == "xl/worksheets/sheet1.xml" {
			data = fixSheetXML(data)
		}
		w, err := zw.CreateHeader(&zip.FileHeader{Name: zf.Name, Method: zip.Deflate})
		if err != nil {
			return nil, err
		}
		if _, err := w.Write(data); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func fixSheetXML(data []byte) []byte {
	if tag := reWorksheetTag.Find(data); tag != nil && !bytes.Contains(tag, []byte("xmlns:x14ac")) {
		moi := append([]byte{}, tag[:len(tag)-1]...)
		if !bytes.Contains(tag, []byte("xmlns:mc=")) {
			moi = append(moi, ` xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac"`...)
		}
		moi = append(moi, ` xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">`...)
		data = bytes.Replace(data, tag, moi, 1)
		data = reSheetFmt.ReplaceAll(data, []byte(`<sheetFormatPr defaultRowHeight="15"${1} x14ac:dyDescent="55">`))
	}
	data = reSheetPr.ReplaceAll(data, nil)
	data = reTabSelected.ReplaceAll(data, nil)
	return data
}
