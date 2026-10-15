package qscore

import (
	"archive/zip"
	"bytes"
	"compress/flate"
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"

	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
)

/* Đọc .xlsx theo đúng cách ExcelJS 4.4 (wb.xlsx.load) nhìn file, vì importParse phụ thuộc vào các chi tiết đó:
   - ô số có định dạng ngày thành Date -> importCell_ trả '' ; công thức lấy result (0 / false / '' coi như không có)
   - ô gộp: mọi ô con mang giá trị của ô gốc và làm dòng "có dữ liệu"
   - ô rỗng chỉ có style không làm dòng "có dữ liệu"; ô chuỗi rỗng thì có
   - sheet xếp theo thứ tự trong workbook.xml, chỉ nhận file xl/worksheets/sheet<N>.xml
   Excelize không dùng được ở đây: nó trả giá trị đã định dạng và giấu kiểu ô / ô nào có trong XML. */

// sheet: kết quả của ws.eachRow({includeEmpty:false}) + importCell_ cho từng ô. Ô là "" | string | float64 | bool.
type sheet struct {
	name string
	grid [][]any
}

// xmlDecode của ExcelJS (giải mã lần 2 cho tên sheet và ô t="str").
var xmlDecoder = strings.NewReplacer("&lt;", "<", "&gt;", ">", "&amp;", "&", "&apos;", "'", "&quot;", "\"")

func xmlDecode(s string) string {
	if !strings.Contains(s, "&") {
		return s
	}
	return xmlDecoder.Replace(s)
}

var reXEsc = regexp.MustCompile(`_x([0-9A-F]{4})_`)

// TextXform.model: _x000D_ -> ký tự
func textModel(s string) string {
	if !strings.Contains(s, "_x") {
		return s
	}
	// String.fromCharCode: mỗi mã là một đơn vị UTF-16, hai mã liền nhau có thể ghép thành một ký tự (emoji)
	var b strings.Builder
	last := 0
	ms := reXEsc.FindAllStringIndex(s, -1)
	for i := 0; i < len(ms); i++ {
		m := ms[i]
		n, _ := strconv.ParseUint(s[m[0]+2:m[0]+6], 16, 32)
		r, end := rune(n), m[1]
		if utf16.IsSurrogate(r) && i+1 < len(ms) && ms[i+1][0] == m[1] {
			n2, _ := strconv.ParseUint(s[ms[i+1][0]+2:ms[i+1][0]+6], 16, 32)
			if dec := utf16.DecodeRune(r, rune(n2)); dec != utf8.RuneError {
				r, end = dec, ms[i+1][1]
				i++
			}
		}
		b.WriteString(s[last:m[0]])
		b.WriteRune(r) // surrogate lẻ -> U+FFFD (chuỗi Go không giữ được)
		last = end
	}
	b.WriteString(s[last:])
	return b.String()
}

func newXMLDecoder(data []byte) *xml.Decoder {
	d := xml.NewDecoder(bytes.NewReader(data))
	// Strict: thực thể lạ (&nbsp;), thuộc tính không nháy / không giá trị là LỖI như saxes của ExcelJS
	d.Strict = true
	d.CharsetReader = func(_ string, in io.Reader) (io.Reader, error) { return in, nil } // JSZip luôn đọc như UTF-8
	return d
}

// tên thẻ / thuộc tính đúng như viết trong file (ExcelJS không xử lý namespace)
func qname(n xml.Name) string {
	if n.Space == "" {
		return n.Local
	}
	return n.Space + ":" + n.Local
}

func attr(se xml.StartElement, name string) (string, bool) {
	for _, a := range se.Attr {
		if qname(a.Name) == name {
			return a.Value, true
		}
	}
	return "", false
}

// duyệt token thô của một phần XML
func walkXML(data []byte, open func(name string, se xml.StartElement), text func(s string), close func(name string)) error {
	d := newXMLDecoder(data)
	// RawToken không kiểm thẻ đóng / mở khớp nhau -> tự kiểm, vì saxes từ chối file XML không đúng dạng
	// (thẻ đóng lạc, thiếu thẻ đóng, không có thẻ gốc, chữ ngoài thẻ gốc). Nội dung thông báo KHÁC saxes.
	var stack []string
	rootDone := false
	for {
		off := d.InputOffset()
		tok, err := d.RawToken()
		if err == io.EOF {
			if len(stack) > 0 {
				return apperr.New("XML syntax error: unclosed tag: " + stack[len(stack)-1])
			}
			if !rootDone {
				return apperr.New("XML syntax error: document must contain a root element.")
			}
			return nil
		}
		if err != nil {
			return apperr.New(err.Error())
		}
		end := d.InputOffset()
		switch t := tok.(type) {
		case xml.StartElement:
			if rootDone {
				return apperr.New("XML syntax error: text data outside of root node.")
			}
			name := qname(t.Name)
			stack = append(stack, name)
			// saxes chuẩn hoá khoảng trắng VIẾT THẲNG trong giá trị thuộc tính (tab / xuống dòng -> dấu cách);
			// ký tự viết dạng &#10; thì giữ. Thẻ có cả hai kiểu thì không phân biệt được -> để nguyên.
			if raw := data[min(off, int64(len(data))):min(end, int64(len(data)))]; bytes.ContainsAny(raw, "\t\n\r") && !bytes.Contains(raw, []byte("&#")) {
				for i := range t.Attr {
					t.Attr[i].Value = attrWS.Replace(t.Attr[i].Value)
				}
			}
			open(name, t)
		case xml.CharData:
			if len(stack) == 0 {
				if strings.TrimSpace(string(t)) != "" {
					return apperr.New("XML syntax error: text data outside of root node.")
				}
				continue
			}
			// ExcelJS chỉ nghe sự kiện text của saxes; nội dung <![CDATA[...]]> đi sự kiện khác nên bị bỏ
			if off < int64(len(data)) && bytes.HasPrefix(data[off:], []byte("<![CDATA[")) {
				continue
			}
			if text != nil {
				text(string(t))
			}
		case xml.EndElement:
			name := qname(t.Name)
			if len(stack) == 0 || stack[len(stack)-1] != name {
				return apperr.New("XML syntax error: unexpected close tag: " + name)
			}
			stack = stack[:len(stack)-1]
			if len(stack) == 0 {
				rootDone = true
			}
			close(name)
		}
	}
}

var attrWS = strings.NewReplacer("\t", " ", "\n", " ", "\r", " ")

/*** ===== sharedStrings.xml ===== ***/

// sharedStr: <si> - chuỗi thường, richText (đã nối) hoặc object rỗng {}.
type sharedStr struct {
	text string
	rich bool // {richText: [...]}
	obj  bool // {} hoặc richText: không phải chuỗi JS
}

func parseSharedStrings(data []byte) ([]sharedStr, error) {
	var out []sharedStr
	var cur sharedStr
	var runText string
	var buf strings.Builder
	inSI, inRun, inT, skip := false, false, false, ""
	err := walkXML(data, func(name string, _ xml.StartElement) {
		if skip != "" || inT {
			return
		}
		switch {
		case !inSI:
			if name == "si" {
				inSI, cur = true, sharedStr{obj: true}
			}
		case inRun:
			if name == "t" {
				inT = true
				buf.Reset()
			} else if name == "rPr" {
				skip = "rPr"
			}
		case name == "t":
			inT = true
			buf.Reset()
		case name == "r":
			inRun, runText = true, ""
		case name == "rPh":
			skip = "rPh"
		}
	}, func(s string) {
		if inT {
			buf.WriteString(s)
		}
	}, func(name string) {
		if skip != "" {
			if name == skip {
				skip = ""
			}
			return
		}
		switch {
		case inT:
			if name != "t" {
				return
			}
			inT = false
			if inRun {
				runText = textModel(buf.String())
			} else {
				cur = sharedStr{text: textModel(buf.String())}
			}
		case inRun:
			if name == "r" {
				inRun = false
				if !cur.rich {
					cur = sharedStr{rich: true, obj: true}
				}
				cur.text += runText
			}
		case inSI && name == "si":
			inSI = false
			out = append(out, cur)
		}
	})
	return out, err
}

/*** ===== styles.xml ===== ***/

// định dạng số mặc định của ExcelJS (id -> mã); id không có trong bảng thì không có numFmt
var defaultNumFmt = map[int]string{
	0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 11: "0.00E+00", 12: "# ?/?", 13: "# ??/??",
	14: "mm-dd-yy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss",
	22: `m/d/yy "h":mm`, 37: "#,##0 ;(#,##0)", 38: "#,##0 ;[Red](#,##0)", 39: "#,##0.00 ;(#,##0.00)", 40: "#,##0.00 ;[Red](#,##0.00)",
	45: "mm:ss", 46: "[h]:mm:ss", 47: "mmss.0", 48: "##0.0E+0", 49: "@",
}

var (
	reFmtBracket = regexp.MustCompile(`\[[^\]]*]`)
	reFmtQuoted  = regexp.MustCompile(`"[^"]*"`)
	reFmtEscape  = regexp.MustCompile(`\\(.)`)
)

// utils.isDateFmt
func isDateFmt(f string) bool {
	if f == "" {
		return false
	}
	f = reFmtBracket.ReplaceAllString(f, "")
	f = reFmtQuoted.ReplaceAllString(f, "")
	return strings.ContainsAny(f, "ymdhMsb")
}

type styles struct {
	numFmts map[int]string
	xfs     []int // numFmtId của từng cellXfs
	date    map[int]bool
}

func parseStyles(data []byte) (*styles, error) {
	st := &styles{numFmts: map[int]string{}, date: map[int]bool{}}
	section := ""
	err := walkXML(data, func(name string, se xml.StartElement) {
		if section == "" {
			switch name {
			case "numFmts", "fonts", "fills", "borders", "cellStyleXfs", "cellXfs", "dxfs":
				section = name
				if name == "cellXfs" {
					st.xfs = nil
				} else if name == "numFmts" {
					st.numFmts = map[int]string{}
				}
			}
			return
		}
		switch {
		case section == "numFmts" && name == "numFmt":
			id, _ := attr(se, "numFmtId")
			code, _ := attr(se, "formatCode")
			if n := jsval.ParseInt(id, 10); n == n {
				st.numFmts[int(n)] = reFmtEscape.ReplaceAllString(code, "${1}")
			}
		case section == "cellXfs" && name == "xf":
			id, _ := attr(se, "numFmtId")
			n := jsval.ParseInt(id, 10)
			if n != n {
				n = 0
			}
			st.xfs = append(st.xfs, int(n))
		}
	}, nil, func(name string) {
		if name == section {
			section = ""
		}
	})
	return st, err
}

// style của ô có phải định dạng ngày không (getStyleModel + isDateFmt)
func (st *styles) isDate(styleID int) bool {
	if st == nil || styleID <= 0 || styleID >= len(st.xfs) {
		return false
	}
	if v, ok := st.date[styleID]; ok {
		return v
	}
	id := st.xfs[styleID]
	f := ""
	if id != 0 {
		if f = st.numFmts[id]; f == "" {
			f = defaultNumFmt[id]
		}
	}
	v := isDateFmt(f)
	st.date[styleID] = v
	return v
}

/*** ===== workbook.xml + rels ===== ***/

type sheetDef struct {
	name string
	id   float64 // parseInt(sheetId): có thể NaN
	rID  string
}

func parseWorkbook(data []byte) ([]sheetDef, error) {
	var defs []sheetDef
	in := false
	err := walkXML(data, func(name string, se xml.StartElement) {
		if name == "sheets" {
			in, defs = true, nil
		} else if in && name == "sheet" {
			nm, _ := attr(se, "name")
			id, _ := attr(se, "sheetId")
			rid, _ := attr(se, "r:id")
			defs = append(defs, sheetDef{name: xmlDecode(nm), id: jsval.ParseInt(id, 10), rID: rid})
		}
	}, nil, func(name string) {
		if name == "sheets" {
			in = false
		}
	})
	return defs, err
}

// Relationship: Id -> Target
func parseRels(data []byte) (map[string]string, error) {
	rels := map[string]string{}
	err := walkXML(data, func(name string, se xml.StartElement) {
		if name == "Relationship" {
			id, _ := attr(se, "Id")
			target, _ := attr(se, "Target")
			rels[id] = target
		}
	}, nil, func(string) {})
	return rels, err
}

/*** ===== worksheet ===== ***/

const (
	ctMerge = iota // <c/> không giá trị, không style: ExcelJS bỏ qua
	ctNull         // ô rỗng có style
	ctNumber
	ctString
	ctBool
	ctError
	ctFormula
)

type rawCell struct {
	addr    string
	hasAddr bool
	typ     int
	styleID int
	val     any // "" | string | float64 | bool sau reconcile
	// trước reconcile
	t         string
	text      string
	hasText   bool
	rich      bool
	richText  string
	formula   bool
	result    any
	hasResult bool
}

type rawRow struct {
	number float64 // parseInt(r): có thể NaN
	cells  []*rawCell
}

type rawSheet struct {
	path       string
	sheetNo    string
	rows       []*rawRow
	merges     []string
	hyperlinks [][2]string // [ref, r:id]
	// gán khi đối chiếu với workbook.xml
	named bool
	name  string
	id    float64
}

var wsSkip = map[string]bool{"sheetPr": true, "dimension": true, "sheetViews": true, "sheetFormatPr": true, "cols": true,
	"autoFilter": true, "rowBreaks": true, "pageMargins": true, "dataValidations": true, "pageSetup": true, "headerFooter": true,
	"printOptions": true, "picture": true, "drawing": true, "sheetProtection": true, "tableParts": true,
	"conditionalFormatting": true, "extLst": true}

// jsBoolResult: parseInt(v, 10) !== 0
func parseBool(s string) bool { n := jsval.ParseInt(s, 10); return n != 0 }

func parseWorksheet(data []byte) (*rawSheet, error) {
	ws := &rawSheet{}
	var (
		section string // "", "sheetData", "mergeCells", "hyperlinks", hoặc thẻ đang bỏ qua
		row     *rawRow
		cell    *rawCell
		node    string // currentNode của CellXform: "f" | "v" | "t"
		inRun   bool
		inRunT  bool
		runSkip bool
		runText string
		buf     strings.Builder
		val     strings.Builder
	)
	closeCell := func() {
		c := cell
		cell = nil
		node = ""
		c.text, c.hasText = val.String(), val.Len() > 0
		hasValue := c.hasText || c.rich
		switch {
		case c.formula:
			c.typ = ctFormula
			if hasValue {
				c.hasResult = true
				switch c.t {
				case "str":
					c.result = xmlDecode(c.text)
				case "b":
					c.result = parseBool(c.text)
				case "e":
					c.result = "" // {error}: importCell_ trả ''
				default:
					if c.rich {
						c.result = jsval.ParseFloat("[object Object]")
					} else {
						c.result = jsval.ParseFloat(c.text)
					}
				}
			}
		case hasValue:
			switch c.t {
			case "s":
				c.typ, c.val = ctString, jsval.ParseInt(c.text, 10) // chỉ số, đổi ở reconcile
			case "str":
				c.typ, c.val = ctString, xmlDecode(c.text)
			case "inlineStr":
				c.typ = ctString
				if c.rich {
					c.val = c.richText
				} else {
					c.val = c.text
				}
			case "b":
				c.typ, c.val = ctBool, parseBool(c.text)
			case "e":
				c.typ, c.val = ctError, ""
			default:
				c.typ = ctNumber
				if c.rich {
					c.val = jsval.ParseFloat("[object Object]")
				} else {
					c.val = jsval.ParseFloat(c.text)
				}
			}
		case c.styleID != 0:
			c.typ, c.val = ctNull, ""
		default:
			c.typ, c.val = ctMerge, ""
		}
		row.cells = append(row.cells, c)
	}
	err := walkXML(data, func(name string, se xml.StartElement) {
		switch {
		case cell != nil:
			if inRun {
				if runSkip || inRunT {
					return
				}
				if name == "t" {
					inRunT = true
					buf.Reset()
				} else if name == "rPr" {
					runSkip = true
				}
				return
			}
			switch name {
			case "f":
				node = "f"
				if t, _ := attr(se, "t"); t != "" {
					cell.formula = true
				}
			case "v":
				node = "v"
			case "t":
				node = "t"
			case "r":
				inRun, runText = true, ""
			}
		case row != nil:
			if name == "c" {
				cell = &rawCell{}
				val.Reset()
				cell.addr, cell.hasAddr = attr(se, "r")
				cell.t, _ = attr(se, "t")
				if s, _ := attr(se, "s"); s != "" {
					if n := jsval.ParseInt(s, 10); n == n {
						cell.styleID = int(n)
					}
				}
			}
		case section == "sheetData":
			if name == "row" {
				r, _ := attr(se, "r")
				row = &rawRow{number: jsval.ParseInt(r, 10)}
			}
		case section == "mergeCells":
			if name == "mergeCell" {
				ref, _ := attr(se, "ref")
				ws.merges = append(ws.merges, ref)
			}
		case section == "hyperlinks":
			if name == "hyperlink" {
				ref, _ := attr(se, "ref")
				rid, _ := attr(se, "r:id")
				ws.hyperlinks = append(ws.hyperlinks, [2]string{ref, rid})
			}
		case section == "":
			switch {
			case name == "sheetData":
				section, ws.rows = name, nil
			case name == "mergeCells":
				section, ws.merges = name, nil
			case name == "hyperlinks":
				section, ws.hyperlinks = name, nil
			case wsSkip[name]:
				section = name
			}
		}
	}, func(s string) {
		if cell == nil {
			return
		}
		if inRun {
			if inRunT {
				buf.WriteString(s)
			}
			return
		}
		switch node {
		case "f":
			if s != "" {
				cell.formula = true
			}
		case "v", "t":
			if !cell.rich {
				val.WriteString(s)
			}
		}
	}, func(name string) {
		switch {
		case cell != nil:
			if inRun {
				switch {
				case runSkip:
					if name == "rPr" {
						runSkip = false
					}
				case inRunT:
					if name == "t" {
						inRunT = false
						runText = textModel(buf.String())
					}
				case name == "r":
					inRun = false
					cell.rich = true
					cell.richText += runText
					node = ""
				}
				return
			}
			switch name {
			case "c":
				closeCell()
			case "f", "v", "is", "t":
				node = ""
			}
		case row != nil:
			if name == "row" {
				ws.rows = append(ws.rows, row)
				row = nil
			}
		case section != "":
			if name == section {
				section = ""
			}
		}
	})
	return ws, err
}

// colCache.decodeAddress: chỉ cần số cột + số dòng
func decodeAddress(s string) (col, row int, hasCol, hasRow bool) {
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case !hasRow && c >= 'A' && c <= 'Z':
			hasCol = true
			col = col*26 + int(c-'A') + 1
		case c >= '0' && c <= '9':
			hasRow = true
			row = row*10 + int(c-'0')
		case hasRow && hasCol && c != '$':
			return
		}
		if col > 1<<24 || row > 1<<30 {
			return
		}
	}
	return
}

type gridCell struct {
	val    any
	isNull bool
	master *gridCell
}

type gridRow struct {
	cells  map[int]*gridCell
	maxCol int
}

type mergeRange struct{ top, left, bottom, right int }

// build: reconcile (chuỗi dùng chung, ngày, hyperlink) + Row.model + gộp ô + eachRow / eachCell.
func (ws *rawSheet) build(shared []sharedStr, hasShared bool, st *styles, rels map[string]string) (*sheet, error) {
	links := map[string]string{}
	for _, h := range ws.hyperlinks {
		if h[1] == "" {
			continue
		}
		target, ok := rels[h[1]]
		if !ok {
			return nil, apperr.New("Cannot read properties of undefined (reading 'Target')")
		}
		links[h[0]] = target
	}
	rows := map[int]*gridRow{}
	getRow := func(n int) *gridRow {
		r := rows[n]
		if r == nil {
			r = &gridRow{cells: map[int]*gridCell{}}
			rows[n] = r
		}
		return r
	}
	getCell := func(r *gridRow, col int) *gridCell {
		c := r.cells[col]
		if c == nil {
			c = &gridCell{val: "", isNull: true}
			r.cells[col] = c
			if col > r.maxCol {
				r.maxCol = col
			}
		}
		return c
	}
	// reconcile chạy cho mọi dòng trước khi dựng Row
	for _, r := range ws.rows {
		for _, c := range r.cells {
			date := c.styleID != 0 && st.isDate(c.styleID)
			switch c.typ {
			case ctString:
				if idx, ok := c.val.(float64); ok && hasShared {
					if idx != idx || idx < 0 || int(idx) >= len(shared) {
						return nil, apperr.New("Cannot read properties of undefined (reading 'richText')")
					}
					s := shared[int(idx)]
					if s.obj && !s.rich {
						c.val = "" // {} -> importCell_ trả ''
						c.rich = true
						c.richText = ""
					} else {
						c.val, c.rich = s.text, s.rich
					}
				}
			case ctNumber:
				if date {
					c.val = "" // Date -> ''
				}
			case ctFormula:
				switch {
				case !c.hasResult:
					c.val = ""
				case date:
					c.val, c.result = "", dateObj
				default:
					c.val = c.result
					if !jsval.Truthy(c.result) { // _copyModel chỉ chép result "truthy"
						c.val = ""
					}
				}
			}
			if !c.hasAddr {
				continue
			}
			target, ok := links[c.addr]
			if !ok || target == "" {
				continue
			}
			// Hyperlink: lấy text (giá trị gốc), không có thì lấy đường dẫn
			var text any
			has := false
			switch c.typ {
			case ctFormula:
				if c.hasResult {
					text, has = c.result, true
				}
			case ctNumber:
				text, has = c.val, true
				if date {
					text = dateObj
				}
			case ctString, ctBool:
				text, has = c.val, true
				if c.typ == ctString && c.rich {
					text = objText
				}
			case ctError:
				text, has = objText, true
			}
			if c.typ == ctFormula && c.t == "e" && c.hasResult {
				text = objText
			}
			if has {
				if text == dateObj {
					text = "" // KHÁC Node: String(Date) phụ thuộc múi giờ máy chủ
				}
				c.val = text
			} else {
				c.val = target
			}
			if c.typ == ctMerge || c.typ == ctNull {
				c.typ = ctString
			}
		}
	}
	for _, r := range ws.rows {
		if r.number != r.number {
			return nil, apperr.New("Invalid row number in model")
		}
		n := int(r.number)
		gr := &gridRow{cells: map[int]*gridCell{}}
		if n >= 1 {
			rows[n] = gr
		}
		prevCol, hasPrev := 0, false
		for _, c := range r.cells {
			if c.typ == ctMerge {
				continue
			}
			col := 0
			if c.hasAddr && c.addr != "" {
				cc, _, hasCol, _ := decodeAddress(c.addr)
				if !hasCol {
					return nil, apperr.New("Invalid Address: " + c.addr)
				}
				if cc > 16384 {
					return nil, apperr.New("Out of bounds. Invalid column letter: " + strings.TrimRight(c.addr, "0123456789"))
				}
				col = cc
			} else if hasPrev {
				col = prevCol + 1 // <c> thiếu r: coi là cột kế tiếp
			} else {
				return nil, apperr.New("Cannot read properties of undefined (reading 'col')")
			}
			prevCol, hasPrev = col, true
			gc := getCell(gr, col)
			gc.val, gc.isNull = c.val, c.typ == ctNull
		}
	}
	var merged []mergeRange
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
		m := mergeRange{min(r1, r2), min(c1, c2), max(r1, r2), max(c1, c2)}
		if m.top < 1 || m.left < 1 {
			continue
		}
		for _, o := range merged {
			if !(o.bottom < m.top || o.top > m.bottom || o.right < m.left || o.left > m.right) {
				return nil, apperr.New("Cannot merge already merged cells")
			}
		}
		merged = append(merged, m)
		master := getCell(getRow(m.top), m.left)
		for i := m.top; i <= m.bottom; i++ {
			gr := getRow(i)
			for j := m.left; j <= m.right; j++ {
				if i > m.top || j > m.left {
					gc := getCell(gr, j)
					gc.master, gc.isNull = master, false
				}
			}
		}
	}
	nums := make([]int, 0, len(rows))
	for n, r := range rows {
		for _, c := range r.cells {
			if !c.isNull {
				nums = append(nums, n)
				break
			}
		}
	}
	sort.Ints(nums)
	out := &sheet{name: ws.name, grid: make([][]any, 0, len(nums))}
	for _, n := range nums {
		r := rows[n]
		arr := make([]any, r.maxCol)
		for i := range arr {
			arr[i] = ""
		}
		for col, c := range r.cells {
			if c.master != nil {
				c = c.master
			}
			arr[col-1] = c.val
		}
		out.grid = append(out.grid, arr)
	}
	return out, nil
}

type marker struct{ s string }

var dateObj any = &marker{"date"}

// object JS bất kỳ đi qua String() ở các bước sau
const objText = "[object Object]"

var (
	reSheetEntry = regexp.MustCompile(`xl/worksheets/sheet(\d+)[.]xml`)
	reSheetRels  = regexp.MustCompile(`xl/worksheets/_rels/sheet(\d+)[.]xml.rels`)
	reRelTarget  = regexp.MustCompile(`^(\s|/xl/)+`)
	reSheetBad   = regexp.MustCompile(`[*?:/\\\[\]]`)
)

// zipError: thông báo của JSZip khi không mở được file.
func zipError(buf []byte) error {
	if len(buf) < 4 {
		return apperr.New("End of data reached (data length = " + strconv.Itoa(len(buf)) + ", asked index = 4). Corrupted zip ?")
	}
	if bytes.HasPrefix(buf, []byte("PK\x03\x04")) {
		return apperr.New("Corrupted zip: can't find end of central directory")
	}
	return apperr.New("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html")
}

// jsLower: String.prototype.toLowerCase (ánh xạ đầy đủ: "İ" -> "i̇"), khác strings.ToLower.
func jsLower(s string) string { return cases.Lower(language.Und).String(s) }

// sheetName: kiểm tra của setter Worksheet.name
func sheetName(name string, taken func(lower string) bool) (string, error) {
	switch {
	case name == "":
		return "", apperr.New("The name can't be empty.")
	case name == "History":
		return "", apperr.New("The name \"History\" is protected. Please use a different name.")
	case reSheetBad.MatchString(name):
		return "", apperr.New("Worksheet name " + name + " cannot include any of the following characters: * ? : \\ / [ ]")
	case strings.HasPrefix(name, "'") || strings.HasSuffix(name, "'"):
		return "", apperr.New("The first or last character of worksheet name cannot be a single quotation mark: " + name)
	}
	if jsval.Len16(name) > 31 {
		// ExcelJS cắt còn 31 ký tự rồi tự báo trùng tên khi gán model
		return "", apperr.New("Worksheet name already exists: " + jsval.Slice(name, 0, 31))
	}
	if taken(jsLower(name)) {
		return "", apperr.New("Worksheet name already exists: " + name)
	}
	return name, nil
}

// readXLSX = wb.xlsx.load(buf) rồi wb.worksheets.
func readXLSX(buf []byte) ([]*sheet, error) {
	zr, err := zip.NewReader(bytes.NewReader(buf), int64(len(buf)))
	if err != nil {
		return nil, zipError(buf)
	}
	read := func(f *zip.File) ([]byte, error) {
		// Đọc dữ liệu thô rồi tự giải nén: JSZip KHÔNG kiểm CRC32, còn zip.File.Open thì báo "checksum error"
		raw, err := f.OpenRaw()
		if err != nil {
			return nil, apperr.New(err.Error())
		}
		var rd io.Reader = raw
		switch f.Method {
		case zip.Store:
		case zip.Deflate:
			fr := flate.NewReader(raw)
			defer fr.Close()
			rd = fr
		default:
			return nil, apperr.New("Corrupted zip : compression " + fmt.Sprintf(`\x%02X\x%02X`, f.Method&0xff, f.Method>>8) + " unknown (inner file : " + f.Name + ")")
		}
		b, err := io.ReadAll(rd)
		if err != nil {
			return nil, apperr.New(err.Error())
		}
		return b, nil
	}
	// zip.files của JSZip: tên trùng thì bản sau thay nội dung, giữ vị trí bản đầu
	var names []string
	files := map[string]*zip.File{}
	for _, f := range zr.File {
		if strings.HasSuffix(f.Name, "/") {
			continue
		}
		if _, ok := files[f.Name]; !ok {
			names = append(names, f.Name)
		}
		files[f.Name] = f
	}
	var (
		defs      []sheetDef
		wbRels    map[string]string
		shared    []sharedStr
		hasShared bool
		st        *styles
		sheets    []*rawSheet
		byPath    = map[string]*rawSheet{}
		wsRels    = map[string]map[string]string{}
	)
	for _, key := range names {
		name := strings.TrimPrefix(key, "/")
		var data []byte
		load := func() error {
			var e error
			data, e = read(files[key])
			return e
		}
		switch name {
		case "xl/workbook.xml":
			if err = load(); err == nil {
				defs, err = parseWorkbook(data)
			}
		case "xl/_rels/workbook.xml.rels":
			if err = load(); err == nil {
				wbRels, err = parseRels(data)
			}
		case "xl/sharedStrings.xml":
			if err = load(); err == nil {
				shared, err = parseSharedStrings(data)
				hasShared = true
			}
		case "xl/styles.xml":
			if err = load(); err == nil {
				st, err = parseStyles(data)
			}
		case "_rels/.rels", "docProps/app.xml", "docProps/core.xml":
		default:
			if m := reSheetEntry.FindStringSubmatch(name); m != nil {
				if err = load(); err == nil {
					var ws *rawSheet
					if ws, err = parseWorksheet(data); err == nil {
						ws.path, ws.sheetNo = name, m[1]
						byPath[name] = ws
						sheets = append(sheets, ws)
					}
				}
			} else if m := reSheetRels.FindStringSubmatch(name); m != nil {
				if err = load(); err == nil {
					wsRels[m[1]], err = parseRels(data)
				}
			}
		}
		if err != nil {
			return nil, err
		}
	}
	// WorkbookXform.reconcile: gắn tên + sheetId cho từng file sheet
	for _, d := range defs {
		target, ok := wbRels[d.rID]
		if !ok {
			continue
		}
		if ws := byPath["xl/"+reRelTarget.ReplaceAllString(target, "")]; ws != nil {
			ws.named, ws.name, ws.id = true, d.name, d.id
		}
	}
	// Workbook.model: dựng theo thứ tự file trong zip; _worksheets[id]
	type entry struct {
		sh      *sheet
		orderNo int
	}
	byID := map[int]*entry{}
	lower := map[int]string{}
	for _, ws := range sheets {
		if !ws.named {
			continue // file sheet không được workbook.xml nhắc tới: không vào wb.worksheets
		}
		name, err := sheetName(ws.name, func(l string) bool {
			for _, v := range lower {
				if v == l {
					return true
				}
			}
			return false
		})
		if err != nil {
			return nil, err
		}
		ws.name = name
		orderNo := -1
		for i, d := range defs {
			if d.id == ws.id {
				orderNo = i
				break
			}
		}
		sh, err := ws.build(shared, hasShared, st, wsRels[ws.sheetNo])
		if err != nil {
			return nil, err
		}
		if ws.id == ws.id && ws.id >= 0 && ws.id < 1<<31 {
			id := int(ws.id)
			byID[id] = &entry{sh, orderNo}
			lower[id] = jsLower(name)
		}
	}
	ids := make([]int, 0, len(byID))
	for id := range byID {
		if id >= 1 { // slice(1)
			ids = append(ids, id)
		}
	}
	sort.Ints(ids)
	sort.SliceStable(ids, func(a, b int) bool { return byID[ids[a]].orderNo < byID[ids[b]].orderNo })
	out := make([]*sheet, len(ids))
	for i, id := range ids {
		out[i] = byID[id].sh
	}
	return out, nil
}
