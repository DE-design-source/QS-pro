package estimates

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// docProps/core.xml như ExcelJS ghi cho workbook có creator "Dezon Pro".
const (
	coreXMLHead = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Dezon Pro</dc:creator><dc:title></dc:title><dc:subject></dc:subject><dc:description></dc:description><cp:keywords></cp:keywords><cp:category></cp:category><cp:lastModifiedBy>Unknown</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">`
	coreXMLMid  = `</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">`
	coreXMLTail = `</dcterms:modified></cp:coreProperties>`
)

// ExportResult: kết quả của exportCongTacXlsx - {buf, count, name}.
type ExportResult struct {
	Buf   []byte
	Count int
	Name  string
}

// Number(x) || null: 0 / NaN / rỗng -> ô trống (F71: khối lượng 0 cũng thành ô trống).
func numOrNull(v any) any {
	if f := jsval.Num0(v); f != 0 {
		return f
	}
	return nil
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

// số đơn vị UTF-16 (= length của chuỗi JS)
func utf16Len(s string) int {
	n := 0
	for _, r := range s {
		n++
		if r > 0xFFFF {
			n++
		}
	}
	return n
}

// longStrs: chuỗi dài hơn giới hạn ô của excelize (32767). ExcelJS không cắt, nên ô nhận một chuỗi giữ chỗ
// rồi patch() thay lại chuỗi đầy đủ trong bảng shared strings trước khi ghi file.
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
	// \x01 không thể có trong chuỗi đã qua xlsStr nên không trùng chuỗi của client
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

// cellWriter gom những thứ setCell cần ngoài file: chuỗi quá dài, ô ghi thẳng XML và lỗi chỉ lộ ra lúc ExcelJS ghi file.
type cellWriter struct {
	f    *excelize.File
	long longStrs
	raws map[string][2]string // ô -> {thuộc tính thêm, phần con} ghi thẳng vào sheet XML (công thức, ô lỗi)
	// lỗi lúc writeBuffer, theo thứ tự ExcelJS gặp: chuẩn bị ô (sharedFormula) -> ghi sheet (kết quả công thức) -> ghi shared strings (richText)
	errPrep, errSheet, errSst error
	rich                      bool
}

func keep(dst *error, err error) {
	if *dst == nil {
		*dst = err
	}
}

var xmlEnc = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&apos;")

// xmlText = xmlEncode của ExcelJS: bỏ ký tự điều khiển rồi escape.
func xmlText(v any) string { return xmlEnc.Replace(xlsStr(jsval.ToString(v))) }

// setCell ghi giá trị theo cách ExcelJS chọn kiểu ô (Value.getType): null -> ô trống, chuỗi, số, boolean;
// object có text + hyperlink / formula / sharedFormula / richText / sharedString / error là kiểu ô riêng của ExcelJS;
// object và mảng còn lại -> chuỗi JSON.
func (w *cellWriter) setCell(cell string, v any) error {
	f := w.f
	switch x := v.(type) {
	case nil:
		return nil
	case string:
		return f.SetCellStr(exportSheet, cell, w.str(x))
	case bool:
		return f.SetCellBool(exportSheet, cell, x)
	case float64:
		// ghi đúng chuỗi số của JS (ExcelJS ghi String(number) vào <v>)
		return f.SetCellDefault(exportSheet, cell, jsval.NumberToString(x))
	}
	if jsval.IsUndefined(v) {
		return nil
	}
	if m := jsval.AsMap(v); m != nil {
		if done, err := w.setSpecial(cell, m); done || err != nil {
			return err
		}
	}
	js, err := omap.MarshalString(v)
	if err != nil {
		return err
	}
	return f.SetCellStr(exportSheet, cell, js)
}

func (w *cellWriter) str(s string) string {
	s = xlsStr(s)
	if utf16Len(s) > excelize.TotalCellChars {
		s = w.long.holder(s)
	}
	return s
}

// setSpecial: các kiểu ô ExcelJS nhận ra từ hình dạng object (cell.js Value.getType), theo đúng thứ tự xét của nó.
// Trả true khi ô đã được xử lý (kể cả khi lỗi được hoãn tới lúc ghi file như ExcelJS).
func (w *cellWriter) setSpecial(cell string, m *omap.Map) (bool, error) {
	f := w.f
	g := func(k string) any { return jsval.Get(m, k) }
	switch {
	case jsval.Truthy(g("text")) && jsval.Truthy(g("hyperlink")):
		if err := f.SetCellStr(exportSheet, cell, w.str(jsval.ToString(g("text")))); err != nil {
			return true, err
		}
		var opts []excelize.HyperlinkOpts
		if tip, ok := g("tooltip").(string); ok && tip != "" {
			opts = append(opts, excelize.HyperlinkOpts{Tooltip: &tip})
		}
		return true, f.SetCellHyperLink(exportSheet, cell, jsval.ToString(g("hyperlink")), "External", opts...)
	case jsval.Truthy(g("formula")) || jsval.Truthy(g("sharedFormula")):
		if !jsval.Truthy(g("formula")) {
			// ô dùng chung công thức mà không có ô chủ (ô chủ phải là ô công thức nằm phía trên / bên trái)
			keep(&w.errPrep, apperr.New("Shared Formula master must exist above and or left of clone for cell "+cell))
			return true, nil
		}
		attr, body := "", "<f>"+xmlText(g("formula"))+"</f>"
		switch r := g("result").(type) {
		case float64:
			body += "<v>" + jsval.NumberToString(r) + "</v>"
		case string:
			attr, body = ` t="str"`, body+"<v>"+xmlText(r)+"</v>"
		case bool:
			attr, body = ` t="b"`, body+"<v>"+map[bool]string{true: "1", false: "0"}[r]+"</v>"
		default:
			switch {
			case jsval.IsNullish(r):
			case jsval.IsObject(r) && jsval.Truthy(jsval.Get(r, "error")):
				attr, body = ` t="e"`, body+"<v>"+xmlText(jsval.Get(r, "error"))+"</v>"
			default:
				keep(&w.errSheet, apperr.New("I could not understand type of value"))
			}
		}
		w.raws[cell] = [2]string{attr, body}
		return true, nil
	case jsval.Truthy(g("richText")):
		rt := g("richText")
		if _, ok := rt.(string); ok {
			keep(&w.errSst, apperr.New("model.richText.forEach is not a function"))
			return true, nil
		}
		arr, ok := rt.([]any)
		if !ok || len(arr) == 0 {
			return true, f.SetCellStr(exportSheet, cell, "")
		}
		runs := make([]excelize.RichTextRun, 0, len(arr))
		for _, el := range arr {
			if jsval.IsNullish(el) {
				keep(&w.errSst, apperr.New("Cannot read properties of undefined (reading 'font')"))
				return true, nil
			}
			t := jsval.Get(el, "text")
			if jsval.IsNullish(t) {
				keep(&w.errSst, typeErrRead(t, "toString"))
				return true, nil
			}
			runs = append(runs, excelize.RichTextRun{Text: w.str(jsval.ToString(t)), Font: richFont(jsval.Get(el, "font"))})
		}
		w.rich = true
		return true, f.SetCellRichText(exportSheet, cell, runs)
	case jsval.Truthy(g("sharedString")):
		return true, nil // ExcelJS ghi ô trống
	case jsval.Truthy(g("error")):
		w.raws[cell] = [2]string{` t="e"`, "<v>" + xmlText(g("error")) + "</v>"}
		return true, nil
	}
	return false, nil
}

// richFont: font của 1 đoạn richText - các thuộc tính thường gặp (bold, italic, underline, strike, size, name, color.argb).
func richFont(v any) *excelize.Font {
	if !jsval.IsObject(v) {
		return nil
	}
	g := func(k string) any { return jsval.Get(v, k) }
	ft := &excelize.Font{Bold: jsval.Truthy(g("bold")), Italic: jsval.Truthy(g("italic")), Strike: jsval.Truthy(g("strike"))}
	if u := g("underline"); jsval.Truthy(u) {
		ft.Underline = "single"
		if s, ok := u.(string); ok && s != "" {
			ft.Underline = s
		}
	}
	if n, ok := g("size").(float64); ok {
		ft.Size = n
	}
	if s, ok := g("name").(string); ok {
		ft.Family = s
	}
	if argb, ok := jsval.Get(g("color"), "argb").(string); ok && len(argb) == 8 {
		ft.Color = argb[2:]
	}
	return ft
}

// ExportCongTacXlsx = exportCongTacXlsx (I:698-727): dựng file Excel từ các dòng client gửi lên.
// Không đọc database. Dòng null -> TypeError như Node (route trả 500).
func (s *Service) ExportCongTacXlsx(rows []any) (*ExportResult, error) {
	f := excelize.NewFile()
	defer f.Close()
	if err := f.SetSheetName("Sheet1", exportSheet); err != nil {
		return nil, err
	}
	if err := f.SetPanes(exportSheet, &excelize.Panes{
		Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft",
		Selection: []excelize.Selection{{Pane: "bottomLeft"}},
	}); err != nil {
		return nil, err
	}

	// ExcelJS luôn ghi sheetFormatPr, pageMargins và pageSetup mặc định
	f64, str, i := func(v float64) *float64 { return &v }, func(v string) *string { return &v }, func(v int) *int { return &v }
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
		Orientation: str("portrait"), AdjustTo: &scale, FitToWidth: i(1), FitToHeight: i(1),
	}); err != nil {
		return nil, err
	}

	top := func(a excelize.Alignment) *excelize.Alignment { a.Vertical = "top"; return &a }
	headAlign := &excelize.Alignment{Vertical: "center", Horizontal: "center", WrapText: true}
	headFont := &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11}
	numFmt2 := "#,##0.##"
	styles := []*excelize.Style{
		{Font: headFont, Alignment: headAlign}, // 0: dòng tiêu đề
		{Font: headFont, Alignment: headAlign, Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"14304F"}}}, // 1: ô tiêu đề
		{Alignment: top(excelize.Alignment{WrapText: true})},                                                                // 2: dòng dữ liệu
		{Alignment: top(excelize.Alignment{Horizontal: "center"})},                                                          // 3: stt, dvt
		{Alignment: top(excelize.Alignment{WrapText: true}), NumFmt: 3},                                                     // 4: dgnt, dg  "#,##0"
		{Alignment: top(excelize.Alignment{WrapText: true}), CustomNumFmt: &numFmt2},                                        // 5: khoiLuong, dienTich, heSo
	}
	id := make([]int, len(styles))
	for i, st := range styles {
		var err error
		if id[i], err = f.NewStyle(st); err != nil {
			return nil, err
		}
	}

	colName := make([]string, len(ctCols))
	for i, c := range ctCols {
		colName[i], _ = excelize.ColumnNumberToName(i + 1)
		// ExcelJS coi độ rộng 9 là mặc định và KHÔNG ghi thẻ <col> cho cột đó (ĐVT, HỆ SỐ)
		if c.Width != 9 {
			if err := f.SetColWidth(exportSheet, colName[i], colName[i], c.Width); err != nil {
				return nil, err
			}
		}
		if err := f.SetCellStr(exportSheet, colName[i]+"1", c.Header); err != nil {
			return nil, err
		}
	}
	last := colName[len(colName)-1]
	if err := f.SetRowHeight(exportSheet, 1, 30); err != nil {
		return nil, err
	}
	if err := f.SetRowStyle(exportSheet, 1, 1, id[0]); err != nil {
		return nil, err
	}
	if err := f.SetCellStyle(exportSheet, "A1", last+"1", id[1]); err != nil {
		return nil, err
	}

	n := len(rows)
	if n > 0 {
		end := strconv.Itoa(n + 1)
		if err := f.SetRowStyle(exportSheet, 2, n+1, id[2]); err != nil {
			return nil, err
		}
		// mọi ô của dòng dữ liệu đều tồn tại và mang style (ExcelJS tạo cả ô null)
		for i, c := range ctCols {
			st := id[2]
			switch c.Key {
			case "stt", "dvt":
				st = id[3]
			case "dgnt", "dg":
				st = id[4]
			case "khoiLuong", "dienTich", "heSo":
				st = id[5]
			}
			if err := f.SetCellStyle(exportSheet, colName[i]+"2", colName[i]+end, st); err != nil {
				return nil, err
			}
		}
	}
	w := &cellWriter{f: f, raws: map[string][2]string{}}
	for i, r := range rows {
		if jsval.IsNullish(r) {
			return nil, typeErrRead(r, "stt")
		}
		g := func(k string) any { return jsval.Get(r, k) }
		vals := [...]any{
			g("stt"), jsval.Or(g("loai"), ""), jsval.Or(g("hangMuc"), ""), jsval.Or(g("noiDung"), ""),
			jsval.Or(g("dvt"), ""), numOrNull(g("khoiLuong")), numOrNull(g("dienTich")), numOrNull(g("heSo")),
			numOrNull(g("dgnt")), numOrNull(g("dg")), jsval.Or(g("ghiChu"), ""),
		}
		rn := strconv.Itoa(i + 2)
		for j, v := range vals {
			if err := w.setCell(colName[j]+rn, v); err != nil {
				return nil, err
			}
		}
	}
	for _, err := range []error{w.errPrep, w.errSheet, w.errSst} {
		if err != nil {
			return nil, err
		}
	}
	w.long.patch(f)
	if w.rich && f.SharedStrings != nil {
		// excelize tự thêm <family> và <color/> rỗng vào font của đoạn richText; ExcelJS chỉ ghi thuộc tính được đặt
		for i := range f.SharedStrings.SI {
			for j := range f.SharedStrings.SI[i].R {
				if p := f.SharedStrings.SI[i].R[j].RPr; p != nil {
					p.Family = nil
					if p.Color != nil && p.Color.RGB == "" {
						p.Color = nil
					}
				}
			}
		}
	}
	if err := f.AutoFilter(exportSheet, "A1:"+last+"1", nil); err != nil {
		return nil, err
	}
	// excelize thêm tên ẩn _xlnm._FilterDatabase cho autoFilter; ExcelJS không ghi tên nào
	if wb := f.WorkBook; wb != nil {
		wb.DefinedNames = nil
	}
	// excelize để nguyên <dimension ref="A1">; ExcelJS ghi đúng vùng có ô
	if err := f.SetSheetDimension(exportSheet, "A1:"+last+strconv.Itoa(n+1)); err != nil {
		return nil, err
	}
	// excelize tự thêm <family val="2"/> vào font mới; ExcelJS chỉ ghi thuộc tính được đặt (bold, color, size)
	if st := f.Styles; st != nil && st.Fonts != nil {
		for i, fnt := range st.Fonts.Font {
			// font mặc định (số 0) của ExcelJS có thêm <scheme val="minor"/>
			if i == 0 && fnt != nil && fnt.Name != nil && fnt.Scheme == nil {
				sch := *fnt.Name
				minor := "minor"
				sch.Val = &minor
				fnt.Scheme = &sch
			}
			if i > 0 && fnt != nil {
				fnt.Family = nil
			}
		}
	}
	// wb.creator.excelize.SetDocProps ghi <lastModifiedBy> không kèm tiền tố cp: nên ExcelJS không đọc lại được file;
	// ghi thẳng phần này theo đúng dạng ExcelJS xuất ra (ngày tạo = ngày sửa = lúc dựng).
	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	f.Pkg.Store("docProps/core.xml", []byte(coreXMLHead+now+coreXMLMid+now+coreXMLTail))
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	out, err := repackSheet(buf.Bytes(), w.raws)
	if err != nil {
		return nil, err
	}
	return &ExportResult{Buf: out, Count: n, Name: exportName}, nil
}

var (
	reWorksheetTag = regexp.MustCompile(`<worksheet[^>]*>`)
	reSheetFmt     = regexp.MustCompile(`<sheetFormatPr defaultRowHeight="15"([^>]*)>`)
	reFilterRef    = regexp.MustCompile(`<autoFilter ref="([^"]*)"`)
	reSheetPr      = regexp.MustCompile(`<sheetPr filterMode="true"></sheetPr>`)
	reTabSelected  = regexp.MustCompile(` tabSelected="true"`)
	reInfCell      = regexp.MustCompile(`(<c [^>]*?) t="inlineStr"([^>]*)><is><t>(-?Infinity)</t></is></c>`)
)

// repackSheet sửa những chỗ excelize ghi khác ExcelJS trong xl/worksheets/sheet1.xml rồi đóng gói lại (.xlsx là zip):
// sheetFormatPr có x14ac:dyDescent="55" (kèm khai báo namespace), vùng autoFilter viết tương đối (A1:K1, không phải $A$1:$K$1),
// bỏ <sheetPr filterMode> và tabSelected mà ExcelJS không ghi.
func repackSheet(src []byte, raws map[string][2]string) ([]byte, error) {
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
			// ô công thức / ô lỗi: excelize để ô trống (chỉ có style), ghi thẳng nội dung như ExcelJS
			for cell, rc := range raws {
				re := regexp.MustCompile(`<c r="` + cell + `"( s="\d+")?(?:/>|></c>)`)
				data = re.ReplaceAll(data, []byte(`<c r="`+cell+`"${1}`+strings.ReplaceAll(rc[0]+">"+rc[1], "$", "$$")+`</c>`))
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
	data = reFilterRef.ReplaceAllFunc(data, func(m []byte) []byte { return bytes.ReplaceAll(m, []byte("$"), nil) })
	data = reSheetPr.ReplaceAll(data, nil)
	data = reTabSelected.ReplaceAll(data, nil)
	// Số vô hạn (client gửi "1e999"): ExcelJS ghi <v>Infinity</v> vào Ô SỐ; excelize đổi giá trị không phải số thành chuỗi inline
	// (chuỗi thường đi qua shared strings nên ô inlineStr chỉ có thể là trường hợp này).
	data = reInfCell.ReplaceAll(data, []byte(`${1}${2}><v>${3}</v></c>`))
	return data
}
