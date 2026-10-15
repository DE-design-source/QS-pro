package categories

import (
	"archive/zip"
	"bytes"
	"io"
	"math"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"golang.org/x/text/unicode/norm"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/specs"
)

// Màu dùng chung của 3 file mẫu (ARGB như ExcelJS).
const (
	mauReq    = "FF2563EB" // tiêu đề bắt buộc
	mauOpt    = "FF12324C" // tiêu đề tuỳ chọn
	mauVDFill = "FFF7F9FC" // nền dòng ví dụ
	mauVDFont = "FF7B8794" // chữ dòng ví dụ
	mauLine   = "FFE9EBEF" // viền
	mauChu    = "FF4A5563" // chữ diễn giải
	mauTrang  = "FFFFFFFF"
)

const (
	sheetSP = "San pham"
	sheetHD = "Hướng dẫn"
)

// kieu: style của 1 ô theo cách ExcelJS khai báo (font luôn Calibri). Dùng làm khoá cache nên chỉ gồm kiểu so sánh được.
type kieu struct {
	Bold, Italic bool
	Size         float64
	Color        string // ARGB
	Fill         string // ARGB, rỗng = không tô
	Border       bool   // viền mảnh 4 cạnh màu mauLine
	Horiz, Vert  string // giá trị của ExcelJS ("middle" = "center" trong file)
	Wrap         bool
}

// book: 1 workbook đang dựng. Lỗi đầu tiên được giữ lại, các bước sau bỏ qua (thay cho exception của JS).
type book struct {
	f      *excelize.File
	err    error
	styles map[kieu]int
	// ô xa nhất đã ghi của từng sheet (cột, dòng) - để ghi <dimension> như ExcelJS
	xa map[string][2]int
}

func newBook() *book {
	b := &book{f: excelize.NewFile(), styles: map[kieu]int{}, xa: map[string][2]int{}}
	b.do(b.f.SetSheetName("Sheet1", sheetSP))
	_, err := b.f.NewSheet(sheetHD)
	b.do(err)
	for _, sh := range []string{sheetSP, sheetHD} {
		// ExcelJS luôn ghi sheetFormatPr và pageMargins mặc định
		b.do(b.f.SetSheetProps(sh, &excelize.SheetPropsOptions{DefaultRowHeight: ptr(15.0)}))
		b.do(b.f.SetPageMargins(sh, &excelize.PageLayoutMarginsOptions{
			Left: ptr(0.7), Right: ptr(0.7), Top: ptr(0.75), Bottom: ptr(0.75), Header: ptr(0.3), Footer: ptr(0.3),
		}))
		b.do(b.f.SetPageLayout(sh, &excelize.PageLayoutOptions{
			Orientation: ptr("portrait"), AdjustTo: ptr(uint(100)), FitToWidth: ptr(1), FitToHeight: ptr(1),
		}))
	}
	return b
}

func ptr[T any](v T) *T { return &v }

func (b *book) do(err error) {
	if b.err == nil && err != nil {
		b.err = err
	}
}

func (b *book) style(k kieu) int {
	if id, ok := b.styles[k]; ok {
		return id
	}
	st := &excelize.Style{Font: &excelize.Font{Bold: k.Bold, Italic: k.Italic, Size: k.Size, Family: "Calibri", Color: k.Color[2:]}}
	if k.Fill != "" {
		st.Fill = excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{k.Fill[2:]}}
	}
	if k.Border {
		for _, side := range []string{"left", "right", "top", "bottom"} {
			st.Border = append(st.Border, excelize.Border{Type: side, Color: mauLine[2:], Style: 1})
		}
	}
	if k.Horiz != "" || k.Vert != "" || k.Wrap {
		v := k.Vert
		if v == "middle" {
			v = "center"
		}
		st.Alignment = &excelize.Alignment{Horizontal: k.Horiz, Vertical: v, WrapText: k.Wrap}
	}
	id, err := b.f.NewStyle(st)
	b.do(err)
	b.styles[k] = id
	return id
}

func cellName(col, row int) string {
	s, _ := excelize.CoordinatesToCellName(col, row)
	return s
}

// daGhi ghi nhận 1 ô có giá trị hoặc style.
func (b *book) daGhi(sheet string, col, row int) {
	x := b.xa[sheet]
	b.xa[sheet] = [2]int{max(x[0], col), max(x[1], row)}
}

func (b *book) setStyle(sheet string, col, row int, k kieu) {
	b.daGhi(sheet, col, row)
	c := cellName(col, row)
	b.do(b.f.SetCellStyle(sheet, c, c, b.style(k)))
}

// setValue ghi giá trị kiểu JS vào ô: null / undefined -> ô trống.
func (b *book) setValue(sheet string, col, row int, v any) {
	if !jsval.IsNullish(v) {
		b.daGhi(sheet, col, row)
	}
	c := cellName(col, row)
	switch x := v.(type) {
	case nil:
	case string:
		b.do(b.f.SetCellStr(sheet, c, x))
	case float64:
		b.do(b.f.SetCellValue(sheet, c, x))
	case bool:
		b.do(b.f.SetCellBool(sheet, c, x))
	default:
		if !jsval.IsUndefined(v) {
			b.do(b.f.SetCellStr(sheet, c, jsval.ToString(v)))
		}
	}
}

func (b *book) setWidths(sheet string, widths []float64) {
	for i, w := range widths {
		name, _ := excelize.ColumnNumberToName(i + 1)
		b.do(b.f.SetColWidth(sheet, name, name, w))
	}
}

// finish = wb.xlsx.writeBuffer().
func (b *book) finish() ([]byte, error) {
	defer b.f.Close()
	if b.err != nil {
		return nil, b.err
	}
	// ExcelJS không ghi <family> cho font tự khai báo và không ghi bookViews; excelize luôn thêm cả hai.
	if st := b.f.Styles; st != nil && st.Fonts != nil {
		for i, fnt := range st.Fonts.Font {
			if i > 0 && fnt != nil {
				fnt.Family = nil
			}
		}
	}
	// Style không căn lề: excelize ghi <alignment/> rỗng kèm applyAlignment="false", ExcelJS không ghi gì.
	if st := b.f.Styles; st != nil && st.CellXfs != nil {
		for i := range st.CellXfs.Xf {
			if xf := &st.CellXfs.Xf[i]; xf.Alignment != nil && reflect.ValueOf(*xf.Alignment).IsZero() {
				xf.Alignment, xf.ApplyAlignment = nil, nil
			}
		}
	}
	if wb := b.f.WorkBook; wb != nil {
		wb.BookViews = nil
		if wb.CalcPr != nil {
			wb.CalcPr.CalcID = 171027 // số ExcelJS ghi
		}
	}
	// excelize để nguyên <dimension ref="A1">; ExcelJS ghi đúng vùng có ô - phần mềm đọc tin vào dimension sẽ chỉ thấy 1 ô
	for sh, x := range b.xa {
		if err := b.f.SetSheetDimension(sh, "A1:"+cellName(x[0], x[1])); err != nil {
			return nil, err
		}
	}
	// docProps/app.xml theo đúng dạng ExcelJS ghi (tên 2 sheet cố định, không có ký tự cần escape)
	b.f.Pkg.Store("docProps/app.xml", []byte(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Excel</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>2</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="2" baseType="lpstr"><vt:lpstr>`+sheetSP+`</vt:lpstr><vt:lpstr>`+sheetHD+`</vt:lpstr></vt:vector></TitlesOfParts><Company></Company><Manager></Manager><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>`))
	// excelize.SetDocProps ghi <lastModifiedBy> không kèm tiền tố cp: - ExcelJS 4.4 không đọc được file như vậy,
	// nên phần này được ghi thẳng theo đúng dạng ExcelJS xuất ra (wb.creator, ngày tạo = ngày sửa = lúc dựng).
	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	b.f.Pkg.Store("docProps/core.xml", []byte(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Dezon QS Pro</dc:creator><dc:title></dc:title><dc:subject></dc:subject><dc:description></dc:description><cp:keywords></cp:keywords><cp:category></cp:category><cp:lastModifiedBy>Unknown</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">`+now+`</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">`+now+`</dcterms:modified></cp:coreProperties>`))
	buf, err := b.f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return nhuExcelJS(buf.Bytes())
}

var (
	reWorksheetTag = regexp.MustCompile(`<worksheet [^>]*>`)
	reDongRong     = regexp.MustCompile(`<row r="\d+"></row>`)
	tabSelected    = []byte(` tabSelected="true"`)
	sheetFormatPr  = []byte(`<sheetFormatPr defaultRowHeight="15">`)
	sheetViewRong  = []byte(`<sheetViews><sheetView workbookViewId="0"></sheetView></sheetViews>`)
)

// nhuExcelJS thêm x14ac:dyDescent="55" vào sheetFormatPr của từng sheet như ExcelJS ghi (excelize không có thuộc tính này),
// kèm khai báo namespace x14ac + mc:Ignorable trên thẻ worksheet. File .xlsx là zip nên phải đóng gói lại.
func nhuExcelJS(src []byte) ([]byte, error) {
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
		if strings.HasPrefix(zf.Name, "xl/worksheets/sheet") && bytes.Contains(data, sheetFormatPr) {
			if tag := reWorksheetTag.Find(data); tag != nil && !bytes.Contains(tag, []byte("xmlns:x14ac")) {
				moi := append([]byte{}, tag[:len(tag)-1]...)
				if !bytes.Contains(tag, []byte("xmlns:mc=")) {
					moi = append(moi, ` xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac"`...)
				}
				moi = append(moi, ` xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">`...)
				data = bytes.Replace(data, tag, moi, 1)
				data = bytes.Replace(data, sheetFormatPr, []byte(`<sheetFormatPr defaultRowHeight="15" x14ac:dyDescent="55">`), 1)
				// sheet không khai báo views: ExcelJS không ghi sheetViews
				// ExcelJS không đánh dấu sheet đang chọn và không ghi dòng không có ô nào
				data = bytes.Replace(data, tabSelected, nil, 1)
				data = bytes.Replace(data, sheetViewRong, nil, 1)
				data = reDongRong.ReplaceAll(data, nil)
			}
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

// Ba style của sheet "San pham".
func kieuTieuDe(req bool) kieu {
	fill := mauOpt
	if req {
		fill = mauReq
	}
	return kieu{Bold: true, Size: 10, Color: mauTrang, Fill: fill, Border: true, Horiz: "center", Vert: "middle", Wrap: true}
}

var kieuViDu = kieu{Italic: true, Size: 10, Color: mauVDFont, Fill: mauVDFill, Border: true}

// sheetSanPham: sheet 1 - dòng tiêu đề (cao 34, cố định khi cuộn) + các dòng ví dụ.
func (b *book) sheetSanPham(cols []cot, rows []*omap.Map) {
	b.do(b.f.SetPanes(sheetSP, &excelize.Panes{
		Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft",
		Selection: []excelize.Selection{{SQRef: "A1", ActiveCell: "A1", Pane: "bottomLeft"}},
	}))
	widths := make([]float64, len(cols))
	for i, c := range cols {
		widths[i] = c.Width
		b.setValue(sheetSP, i+1, 1, c.Label)
		b.setStyle(sheetSP, i+1, 1, kieuTieuDe(c.Req))
	}
	b.setWidths(sheetSP, widths)
	b.do(b.f.SetRowHeight(sheetSP, 1, 34))
	for r, sp := range rows {
		for i, c := range cols {
			if v := sp.Val(c.Label); !jsval.IsNullish(v) {
				b.setValue(sheetSP, i+1, r+2, v)
			}
			b.setStyle(sheetSP, i+1, r+2, kieuViDu)
		}
	}
}

// huongDan: sheet 2. row = số dòng đã dùng (addRow của ExcelJS ghi vào dòng kế tiếp).
type huongDan struct {
	b   *book
	row int
	no  int
	// chiều cao mặc định của 1 dòng hướng dẫn (VS, SON: 46; CT: 40)
	cao float64
}

func (b *book) sheetHuongDan(widths []float64, title string, cao float64) *huongDan {
	b.setWidths(sheetHD, widths)
	b.do(b.f.MergeCell(sheetHD, "A1", "C1"))
	b.setValue(sheetHD, 1, 1, title)
	k := kieu{Bold: true, Size: 14, Color: mauOpt}
	for c := 1; c <= 3; c++ { // ExcelJS chép style của ô chủ sang mọi ô trong vùng gộp
		b.setStyle(sheetHD, c, 1, k)
	}
	b.do(b.f.SetRowHeight(sheetHD, 1, 28))
	return &huongDan{b: b, row: 2, cao: cao} // dòng 2 để trống: gd.addRow([])
}

func (h *huongDan) addRow(vals ...any) int {
	h.row++
	for i, v := range vals {
		h.b.setValue(sheetHD, i+1, h.row, v)
	}
	return h.row
}

// line = hàm line(k, v, h) của cả 3 file mẫu; cao 0 = dùng chiều cao mặc định (h || mặc định).
func (h *huongDan) line(k, v string, cao float64) {
	h.no++
	r := h.addRow(jsval.ToString(float64(h.no)), k, v)
	if cao == 0 {
		cao = h.cao
	}
	h.b.do(h.b.f.SetRowHeight(sheetHD, r, cao))
	h.b.setStyle(sheetHD, 1, r, kieu{Bold: true, Size: 10, Color: mauReq, Horiz: "center", Vert: "top"})
	h.b.setStyle(sheetHD, 2, r, kieu{Bold: true, Size: 10, Color: mauOpt, Vert: "top", Wrap: true})
	h.b.setStyle(sheetHD, 3, r, kieu{Size: 10, Color: mauChu, Vert: "top", Wrap: true})
}

// bang: dòng trống + dòng tiêu đề của bảng thông số cuối sheet. giua = ô ghi chú có căn giữa dọc (VS, SON có; CT không).
func (h *huongDan) bang(tieuDe, ghiChu string, giua bool) {
	h.addRow()
	r := h.addRow("", tieuDe, ghiChu)
	h.b.do(h.b.f.SetRowHeight(sheetHD, r, 24))
	h.b.setStyle(sheetHD, 2, r, kieu{Bold: true, Size: 12, Color: mauOpt})
	k := kieu{Italic: true, Size: 10, Color: mauVDFont}
	if giua {
		k.Vert = "middle"
	}
	h.b.setStyle(sheetHD, 3, r, k)
}

// dongBang: 1 dòng của bảng thông số. wrapTen = ô tên có xuống dòng (chỉ CT).
func (h *huongDan) dongBang(ten, txt string, cao float64, wrapTen bool) {
	r := h.addRow("", ten, txt)
	h.b.do(h.b.f.SetRowHeight(sheetHD, r, cao))
	h.b.setStyle(sheetHD, 2, r, kieu{Bold: true, Size: 10, Color: mauReq, Vert: "top", Wrap: wrapTen})
	h.b.setStyle(sheetHD, 3, r, kieu{Size: 10, Color: mauChu, Vert: "top", Wrap: true})
}

// caoDong = Math.max(min, 15 * Math.ceil(txt.length / chia) + cong); độ dài theo đơn vị UTF-16 như JS.
func caoDong(txt string, min, chia, cong float64) float64 {
	return math.Max(min, 15*math.Ceil(float64(jsval.Len16(txt))/chia)+cong)
}

// cotDau / cotCuoi: các cột cố định trước và sau khối thông số (hmW, dongW, maW: độ rộng khác nhau giữa các ngành).
func cotDau(hmW, dongW, maW float64) []cot {
	return []cot{
		{"THƯƠNG HIỆU", true, 14}, {"NHÀ CUNG CẤP", true, 14}, {"HẠNG MỤC", true, hmW}, {"DÒNG SẢN PHẨM", true, dongW},
		{"TÊN SẢN PHẨM", true, 34}, {"MÃ SẢN PHẨM", true, maW}, {"GIÁ BÁN LẺ", true, 13}, {"CHIẾT KHẤU ĐẠI LÝ (%)", true, 13},
	}
}

func cotCuoi() []cot {
	return []cot{
		{"TÍNH NĂNG", false, 30}, {"BẢO HÀNH (năm)", false, 13}, {"NHÓM SẢN PHẨM", false, 13}, {"ĐƠN VỊ TÍNH", true, 13},
		{"LINK DATASHEET", false, 20}, {"THÔNG SỐ KỸ THUẬT", false, 20}, {"HƯỚNG DẪN CÀI ĐẶT", false, 20}, {"FILE BẢN VẼ", false, 20},
		{"TRẠNG THÁI", false, 16}, {"GHI CHÚ", false, 22},
	}
}

// dsHM = dsHM(hm): 1 hạng mục cụ thể hoặc mọi hạng mục của ngành.
func dsHM(sp *specs.Spec, hm string) []string {
	if hm != "" {
		return []string{hm}
	}
	return sp.HangMuc
}

// batBuoc = batBuoc(lb, hm): nhãn bắt buộc với ít nhất 1 hạng mục trong phạm vi.
func batBuoc(sp *specs.Spec, lb, hm string) bool {
	for _, h := range dsHM(sp, hm) {
		if has(sp.HMList(h, "req"), lb) {
			return true
		}
	}
	return false
}

func has(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// metricCua: nhãn thông số của file mẫu - 1 hạng mục thì đúng thứ tự của hạng mục đó, ngược lại hợp của tất cả.
func metricCua(sp *specs.Spec, hm string) []string {
	if hm != "" {
		return append(sp.HMList(hm, "chinh"), sp.HMList(hm, "tk")...)
	}
	return append(append([]string{}, sp.ChinhAll...), sp.TkAll...)
}

// mk = Object.assign({mặc định}, HM[hm].mau, thêm): 1 dòng ví dụ.
func mk(sp *specs.Spec, base *omap.Map, hm string, them *omap.Map) *omap.Map {
	return omap.Assign(base.Clone().Set("HẠNG MỤC", hm), jsval.AsMap(sp.HMGet(hm).Val("mau")), them)
}

// danhDauVD: r["TÊN SẢN PHẨM"] = VD + " " + r["TÊN SẢN PHẨM"] cho mọi dòng ví dụ.
func danhDauVD(sp *specs.Spec, ds []*omap.Map) []*omap.Map {
	for _, r := range ds {
		r.Set("TÊN SẢN PHẨM", sp.VD+" "+jsval.ToString(r.Val("TÊN SẢN PHẨM")))
	}
	return ds
}

// tenThongSo = hàm ten(lb) trong bảng cuối sheet: nhãn hiển thị + "*" nếu bắt buộc + " (gợi ý / ...)".
func tenThongSo(sp *specs.Spec, h *omap.Map) func(lb string) string {
	req := specs.Strs(h.Val("req"))
	return func(lb string) string {
		s := sp.MetricLabel(lb)
		if has(req, lb) {
			s += "*"
		}
		if o := jsval.AsArray(jsval.Get(h.Val("opt"), lb)); len(o) > 0 {
			s += " (" + joinAny(o, " / ") + ")"
		}
		return s
	}
}

// joinAny = arr.join(sep): null / undefined thành rỗng.
func joinAny(arr []any, sep string) string {
	parts := make([]string, len(arr))
	for i, v := range arr {
		if !jsval.IsNullish(v) {
			parts[i] = jsval.ToString(v)
		}
	}
	return strings.Join(parts, sep)
}

func mapJoin(list []string, fn func(string) string, sep string) string {
	parts := make([]string, len(list))
	for i, s := range list {
		parts[i] = fn(s)
	}
	return strings.Join(parts, sep)
}

// nfd = s.normalize("NFD").
func nfd(s string) string { return norm.NFD.String(s) }

// upper = toUpperCase() của JS (thuật toán Unicode đầy đủ, không theo ngôn ngữ).
func upper(s string) string { return cases.Upper(language.Und).String(s) }
