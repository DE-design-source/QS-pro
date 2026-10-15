package qscore

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"math"
	"strings"
	"testing"
)

// Các ca lấy từ đợt đối chiếu với ExcelJS 4.4 / JSZip / store_supa.js thật.

func TestStoreNumberHelpers(t *testing.T) {
	// store_supa.js: round0_ = Math.round(n(v)); shared.js: round0_ = Math.round(Number(n) || 0)
	if Round0("1.234,5") != 1235 || Round0Num("1.234,5") != 0 || Round0(2.5) != 3 || Round0(-2.5) != -2 || Round0("12,4 đ") != 12 {
		t.Errorf("Round0: %v %v %v", Round0("1.234,5"), Round0Num("1.234,5"), Round0("12,4 đ"))
	}
	if N(nil) != 0 || N("") != 0 || N(math.Inf(1)) != 0 || N(math.NaN()) != 0 || N(1.5) != 1.5 || N("1.234.567") != 1234567 || N(true) != 0 {
		t.Error("N sai")
	}
	if !math.IsInf(Round0Num(math.Inf(1)), 1) || Round0(math.Inf(1)) != 0 {
		t.Error("Infinity: hai round0_ phải khác nhau")
	}
	rows := []int{1, 2, 3}
	if got := ChamTran(rows, 0, "x"); len(got) != 3 || LIM != 20000 {
		t.Error("ChamTran / LIM sai")
	}
}

func walkText(t *testing.T, src string) (string, []string, error) {
	t.Helper()
	var text strings.Builder
	var attrs []string
	err := walkXML([]byte(src), func(_ string, se xml.StartElement) {
		for _, a := range se.Attr {
			attrs = append(attrs, a.Value)
		}
	}, func(s string) { text.WriteString(s) }, func(string) {})
	return text.String(), attrs, err
}

func TestWalkXMLLikeSaxes(t *testing.T) {
	// ExcelJS không nghe sự kiện cdata -> nội dung CDATA bị bỏ
	if s, _, err := walkText(t, `<a><v>1<![CDATA[2]]>3</v><t><![CDATA[Tên]]></t></a>`); err != nil || s != "13" {
		t.Errorf("CDATA: %q %v", s, err)
	}
	// khoảng trắng viết thẳng trong thuộc tính -> dấu cách; viết dạng &#10; thì giữ
	if _, a, err := walkText(t, "<a><s name=\"Bồn\ncầu\" x=\"1\t2\r\n3\"/><s name=\"A&#10;B\"/></a>"); err != nil || len(a) != 3 || a[0] != "Bồn cầu" || a[1] != "1 2 3" || a[2] != "A\nB" {
		t.Errorf("thuộc tính: %q %v", a, err)
	}
	if s, _, err := walkText(t, "<?xml version=\"1.0\"?>\n<a xmlns:r=\"u\"><r:b r:id=\"1\">x &amp; y</r:b></a>\n"); err != nil || s != "x & y" {
		t.Errorf("file hợp lệ: %q %v", s, err)
	}
	for _, bad := range []string{
		`<a><t>a&nbsp;b</t></a>`, `<a><t>a & b</t></a>`, `<a><row r=2></row></a>`, `<a><b></a>`, `<a><t></T></a>`,
		`<a></a>junk`, `<a></a><b></b>`, `<a><row></row>`, "  \n ", `not xml`,
	} {
		if _, _, err := walkText(t, bad); err == nil {
			t.Errorf("phải báo lỗi: %q", bad)
		}
	}
}

func TestTextModelSurrogatePair(t *testing.T) {
	if got := textModel("sp _xD83D__xDE00_ ok"); got != "sp \U0001F600 ok" {
		t.Errorf("cặp surrogate: %q", got)
	}
	if got := textModel("a_x000D__x000A_b_x00zz_"); got != "a\r\nb_x00zz_" {
		t.Errorf("_x000D_: %q", got)
	}
	if jsLower("İA") != "i̇a" {
		t.Errorf("jsLower: %q", jsLower("İA"))
	}
}

// JSZip không kiểm CRC32: file có CRC sai vẫn đọc được.
func TestXLSXIgnoresBadCRC(t *testing.T) {
	parts := [][2]string{
		{"xl/workbook.xml", `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S1" sheetId="1" r:id="rId1"/></sheets></workbook>`},
		{"xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`},
		{"xl/worksheets/sheet1.xml", `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Tên</t></is></c><c r="B1"><v>5</v></c></row></sheetData></worksheet>`},
	}
	build := func(crcDelta uint32) []byte {
		var buf bytes.Buffer
		zw := zip.NewWriter(&buf)
		for _, p := range parts {
			data := []byte(p[1])
			h := &zip.FileHeader{Name: p[0], Method: zip.Store, CRC32: crc(data) + crcDelta, CompressedSize64: uint64(len(data)), UncompressedSize64: uint64(len(data))}
			w, err := zw.CreateRaw(h)
			if err != nil {
				t.Fatal(err)
			}
			_, _ = w.Write(data)
		}
		if err := zw.Close(); err != nil {
			t.Fatal(err)
		}
		return buf.Bytes()
	}
	for _, delta := range []uint32{0, 1} {
		sheets, err := readXLSX(build(delta))
		if err != nil || len(sheets) != 1 || sheets[0].name != "S1" || len(sheets[0].grid) != 1 {
			t.Fatalf("crc+%d: %v %+v", delta, err, sheets)
		}
		if row := sheets[0].grid[0]; len(row) < 2 || row[0] != "Tên" || row[1] != 5.0 {
			t.Errorf("crc+%d: dòng %v", delta, row)
		}
	}
}

func crc(b []byte) uint32 {
	c := ^uint32(0)
	for _, x := range b {
		c ^= uint32(x)
		for i := 0; i < 8; i++ {
			c = c>>1 ^ 0xEDB88320&-(c&1)
		}
	}
	return ^c
}
