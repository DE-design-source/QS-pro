package estimates

import (
	"archive/zip"
	"bytes"
	"io"
	"strings"
	"testing"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Hồi quy (so vi sai Node <-> Go, tests/e2e/diff area2/05): đọc lại bằng ExcelJS, file của Go khác file của Node ở
// ô đang chọn (activeCell), dyDescent, pageMargins / pageSetup, vùng autoFilter ($A$1:$K$1), tên ẩn _xlnm._FilterDatabase
// và <scheme val="minor"/> của font mặc định. Các chuỗi mong đợi lấy từ file do server Node (ExcelJS 4.4) ghi.
func TestExportXMLLikeExcelJS(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{})
	res, err := s.ExportCongTacXlsx(exportRows(t))
	if err != nil {
		t.Fatal(err)
	}
	zr, err := zip.NewReader(bytes.NewReader(res.Buf), int64(len(res.Buf)))
	if err != nil {
		t.Fatal(err)
	}
	part := map[string]string{}
	for _, zf := range zr.File {
		rc, err := zf.Open()
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(rc)
		rc.Close()
		part[zf.Name] = string(b)
	}
	sheet, styles, wb := part["xl/worksheets/sheet1.xml"], part["xl/styles.xml"], part["xl/workbook.xml"]
	for _, want := range []string{
		`xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"`,
		`<sheetFormatPr defaultRowHeight="15" x14ac:dyDescent="55">`,
		`<selection pane="bottomLeft">`,
		`<autoFilter ref="A1:K1">`,
		`<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3">`,
		`<pageSetup `,
	} {
		if !strings.Contains(sheet, want) {
			t.Errorf("sheet1.xml thiếu %s", want)
		}
	}
	for _, bad := range []string{`activeCell=`, `sqref=`, `tabSelected`, `filterMode`, `$A$1`, `<dimension ref="A1">`} {
		if strings.Contains(sheet, bad) {
			t.Errorf("sheet1.xml còn %s", bad)
		}
	}
	if !strings.Contains(styles, `<scheme val="minor">`) {
		t.Errorf("styles.xml: font mặc định thiếu <scheme val=\"minor\">")
	}
	if strings.Contains(wb, `_xlnm._FilterDatabase`) || strings.Contains(wb, `<definedName`) {
		t.Errorf("workbook.xml còn tên định nghĩa của autoFilter")
	}
}

func exportParts(t *testing.T, buf []byte) map[string]string {
	t.Helper()
	zr, err := zip.NewReader(bytes.NewReader(buf), int64(len(buf)))
	if err != nil {
		t.Fatal(err)
	}
	part := map[string]string{}
	for _, zf := range zr.File {
		rc, err := zf.Open()
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(rc)
		rc.Close()
		part[zf.Name] = string(b)
	}
	return part
}

// Hồi quy (so vi sai area2/05): ô là object mà ExcelJS coi là kiểu riêng (cell.js Value.getType) - công thức, ô lỗi,
// liên kết, richText, sharedString - không được ghi thành chuỗi JSON. XML mong đợi lấy từ file ExcelJS 4.4 ghi.
func TestExportSpecialCells(t *testing.T) {
	s, _ := newSvc(&fakeRepo{}, fakePerms{})
	rows, err := omap.Decode([]byte(`[
		{"stt":{"formula":"A1+1"},"noiDung":{"formula":"A1&\"x\"","result":"chữ <b>"}},
		{"stt":{"formula":"A1+1","result":7},"noiDung":{"formula":"1=1","result":true},"ghiChu":{"formula":"A1","result":{"error":"#N/A"}}},
		{"stt":{"error":"#N/A"},"noiDung":{"text":"liên kết","hyperlink":"https://example.invalid/x","tooltip":"gợi ý"}},
		{"stt":{"sharedString":3},"noiDung":{"richText":[{"text":"đậm","font":{"bold":true}},{"text":" thường"}]},"ghiChu":{"richText":[]}},
		{"stt":{"a":1}}
	]`))
	if err != nil {
		t.Fatal(err)
	}
	res, err := s.ExportCongTacXlsx(jsval.AsArray(rows))
	if err != nil {
		t.Fatal(err)
	}
	part := exportParts(t, res.Buf)
	sheet, sst := part["xl/worksheets/sheet1.xml"], part["xl/sharedStrings.xml"]
	for _, want := range []string{
		`<c r="A2" s="4"><f>A1+1</f></c>`,
		`<c r="D2" s="3" t="str"><f>A1&amp;&quot;x&quot;</f><v>chữ &lt;b&gt;</v></c>`,
		`<c r="A3" s="4"><f>A1+1</f><v>7</v></c>`,
		`<c r="D3" s="3" t="b"><f>1=1</f><v>1</v></c>`,
		`<c r="K3" s="3" t="e"><f>A1</f><v>#N/A</v></c>`,
		`<c r="A4" s="4" t="e"><v>#N/A</v></c>`,
		`<hyperlink ref="D4" tooltip="gợi ý" r:id="rId1">`,
	} {
		if !strings.Contains(sheet, want) {
			t.Errorf("sheet1.xml thiếu %s", want)
		}
	}
	if !strings.Contains(part["xl/worksheets/_rels/sheet1.xml.rels"], `Target="https://example.invalid/x"`) {
		t.Errorf("thiếu quan hệ của liên kết: %s", part["xl/worksheets/_rels/sheet1.xml.rels"])
	}
	for _, want := range []string{`<t>liên kết</t>`, `<r><rPr><b val="1"></b></rPr><t>đậm</t></r><r><t xml:space="preserve"> thường</t></r>`, `{&#34;a&#34;:1}`} {
		if !strings.Contains(sst, want) {
			t.Errorf("sharedStrings.xml thiếu %s\n%s", want, sst)
		}
	}
	if strings.Contains(sst, "formula") || strings.Contains(sst, "richText") || strings.Contains(sst, "sharedString") {
		t.Errorf("ô đặc biệt bị ghi thành chuỗi JSON: %s", sst)
	}

	// lỗi chỉ lộ ra lúc ExcelJS ghi file: ô chuẩn bị trước (sharedFormula), rồi sheet (kết quả công thức), rồi shared strings (richText)
	for _, c := range [][2]string{
		{`[{"stt":1,"noiDung":{"sharedFormula":"A1"}}]`, "Shared Formula master must exist above and or left of clone for cell D2"},
		{`[{"stt":{"formula":"A1","result":{"a":1}}}]`, "I could not understand type of value"},
		{`[{"stt":{"richText":"abc"}}]`, "model.richText.forEach is not a function"},
		{`[{"stt":{"richText":[{}]}}]`, "Cannot read properties of undefined (reading 'toString')"},
		{`[{"stt":{"richText":[{"text":null}]}}]`, "Cannot read properties of null (reading 'toString')"},
		{`[{"stt":{"richText":[null]}}]`, "Cannot read properties of undefined (reading 'font')"},
		{`[{"stt":{"richText":"abc"}},{"stt":{"formula":"A1","result":[1]}},{"stt":{"sharedFormula":"A1"}}]`, "Shared Formula master must exist above and or left of clone for cell A4"},
		{`[{"stt":{"richText":"abc"}},null]`, "Cannot read properties of null (reading 'stt')"},
	} {
		rows, _ := omap.Decode([]byte(c[0]))
		if _, err := s.ExportCongTacXlsx(jsval.AsArray(rows)); err == nil || err.Error() != c[1] {
			t.Errorf("%s: lỗi %v, mong %q", c[0], err, c[1])
		}
	}
}
