// Package qscore: hằng số + hàm thuần dùng chung (không chạm dữ liệu) - bản chuyển của server/shared.js:
//   - mẫu tờ bìa + NCC phần 3.2
//   - chuẩn hoá chuỗi / đọc số kiểu VN
//   - đọc file nhập hàng loạt (ImportParse)
//
// Mã tờ bìa (STT) TRÙNG mã cây hạng mục Bóc tách: dòng bóc tách có nhom "3.2.6.1" được cộng vào mục tờ bìa "3.2.6".
package qscore

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"golang.org/x/text/unicode/norm"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// SupplierGroup: một khoá của S32_SUPPLIERS - các cặp [loại vật tư, nhà cung cấp].
type SupplierGroup struct {
	STT   string
	Items [][2]string
}

// S32Suppliers = S32_SUPPLIERS, giữ đúng thứ tự khoá.
var S32Suppliers = []SupplierGroup{
	{"3.2.1", [][2]string{{"Thạch cao", "Boral"}, {"Phụ kiện", "Vĩnh Tường"}}},
	{"3.2.2", [][2]string{{"Bột trét", "Dulux"}, {"Sơn nước", "Dulux"}}},
	{"3.2.4", [][2]string{{"Sàn gỗ", "Boen"}, {"Đá", "Eurostone"}, {"Sàn gạch", "Vietceramics"}, {"Keo dán gạch", "Weber"}}},
	{"3.2.5", [][2]string{{"Bồn cầu", "Mamma Mia"}, {"Bồn tắm", "Hansgrohe"}, {"Sen", "Bravat"}, {"Lavabo", "Kohler"}, {"Phụ kiện", "Mamma Mia"}}},
	{"3.2.6", [][2]string{{"Công tắc", "Etron"}, {"Ổ cắm", "Etron"}, {"Đèn trong nhà", "Ades Lighting"}, {"Đèn ngoài trời", "Croled"}}},
	{"3.2.7", [][2]string{{"Ống đồng", "LHCT / Luvata"}, {"Ống ngưng", "PPR"}, {"Cục nóng", "Daikin"}, {"Máy lạnh", "Daikin"}}},
	{"3.2.8", [][2]string{{"Cửa ngoại thất", "YKK AP"}, {"Cửa nội thất", "An Cường"}}},
}

// S32SuppliersOf = S32_SUPPLIERS[stt]; không có -> nil.
func S32SuppliersOf(stt string) [][2]string {
	for _, g := range S32Suppliers {
		if g.STT == stt {
			return g.Items
		}
	}
	return nil
}

// S32SuppliersValue: S32_SUPPLIERS ở dạng JS value model (để đưa thẳng vào JSON).
func S32SuppliersValue() *omap.Map {
	m := omap.New()
	for _, g := range S32Suppliers {
		items := make([]any, len(g.Items))
		for i, p := range g.Items {
			items[i] = []any{p[0], p[1]}
		}
		m.Set(g.STT, items)
	}
	return m
}

// S32Subs = S32_SUBS.
var S32Subs = []string{"3.2.1", "3.2.2", "3.2.3", "3.2.4", "3.2.5", "3.2.6", "3.2.7", "3.2.8"}

// CoverTemplate = COVER_TEMPLATE: [stt, hạng mục, mô tả].
var CoverTemplate = [][3]string{
	{"1", "TƯ VẤN DỰ ÁN", ""},
	{"1.1", "Tư vấn QLDA", "Bao gồm tư vấn tài chính dự án, tư vấn pháp lý dự án, tư vấn quản lý dự án, tư vấn mua hàng, đặt hàng, mở thầu, chọn thầu...."},
	{"2", "TƯ VẤN THIẾT KẾ", ""},
	{"2.1", "Tư vấn thiết kế kiến trúc", "Tư vấn thiết kế kiến trúc, mặt tiền công trình, mặt bằng bố trí kiến trúc..."},
	{"2.2", "Tư vấn thiết kế nội thất", "Tư vấn thiết kế mặt bằng công năng nội thất, thiết kế 3D, tư vấn chọn vật liệu, màu sắc, ánh sáng. Triển khai bản vẽ thi công nội thất"},
	{"2.3", "Tư vấn thiết kế kết cấu", ""},
	{"2.4", "Tư vấn thiết kế MEP (Mechanical, Electrical, Plumbing)", "Tư vấn thiết kế hệ thống điện (Electrical), Hệ thống Thông gió & Điều hòa không khí (Mechanical / HVAC), hệ thống Cấp thoát nước (Plumbing & Sanitary), hệ thống Phòng cháy chữa cháy"},
	{"3", "XÂY DỰNG", ""},
	{"3.1", "Phần thô", "Chuẩn bị mặt bằng, thi công móng và nền, thi công cột, dầm, sàn, thi công tường bao, tường ngăn, tô trát, hoàn thiện phần thô, kiểm tra và nghiệm thu phần thô"},
	{"3.2", "Phần hoàn thiện cơ bản", "Thi công hoàn thiện trần, tường, sàn, lắp đặt TBVS, thiết bị điện lạnh, lắp đặt cửa nội thất, tay vịn cầu thang..."},
	{"3.2.1", "Trần thạch cao", "Nhân công và vật tư"},
	{"3.2.2", "Sơn nước", "Nhân công và vật tư"},
	{"3.2.3", "Xây tô", "Nhân công và vật tư"},
	{"3.2.4", "Ốp lát", "Nhân công và vật tư"},
	{"3.2.5", "Thiết bị vệ sinh", "Cung cấp thiết bị và nhân công lắp đặt"},
	{"3.2.6", "Thiết bị điện", "Đèn, công tắc - ổ cắm: cung cấp thiết bị và nhân công lắp đặt"},
	{"3.2.7", "Thiết bị điện lạnh", "Cung cấp thiết bị và nhân công lắp đặt"},
	{"3.2.8", "Cửa", "Sản xuất và nhân công lắp đặt"},
	{"4", "HOÀN THIỆN NỘI THẤT", ""},
	{"4.1", "Nội thất liền tường", "Thi công lắp đặt nội thất liền tường, tủ bếp, tủ trang trí, vách liền tường"},
	{"4.2", "Đồ rời (Loose furniture)", "Sản xuất, cung cấp nội thất đồ rời, kệ, tủ rời, giường, ghế sofa, bàn, tủ lavabo...."},
	{"4.3", "Rèm cửa", "Sản xuất, cung cấp, lắp đặt rèm cửa"},
	{"4.4", "Đồ trang trí", "Sản xuất, cung cấp đồ trang trí nội thất: thảm, đồ decor, tranh treo tường v.v...."},
	{"5", "BẢO DƯỠNG", ""},
	{"5.1", "Bảo dưỡng định kỳ", "Cung cấp các gói bảo dưỡng định kỳ cho các thiết bị như máy lạnh, bình nước nóng....."},
	{"5.2", "Bảo hiểm", "Cung cấp các gói bảo hiểm thay thế, sửa chữa cho các thiết bị như đèn, thiết bị vệ sinh, sơn nước, sàn gỗ...v....."},
}

// InCode: dòng bóc tách thuộc mục tờ bìa stt - nhom = stt hoặc mã con (3.2.6 chứa 3.2.6.1).
func InCode(nhom, stt any) bool {
	s := jsval.Trim(jsval.StrOr(nhom, ""))
	if st, ok := stt.(string); ok && s == st {
		return true
	}
	return strings.HasPrefix(s, jsval.ToString(stt)+".")
}

/*** ===== CHUỖI / SỐ ===== ***/

// khoảng trắng theo \s của JavaScript
func isJSSpace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
		return true
	}
	return r >= 0x2000 && r <= 0x200A
}

func isASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] >= 0x80 {
			return false
		}
	}
	return true
}

// Normalize = normalize_: IN HOA, bỏ dấu, Đ -> D, gộp khoảng trắng.
func Normalize(v any) string {
	s := jsval.Str(v)
	if isASCII(s) {
		s = strings.ToUpper(s)
	} else {
		// toUpperCase của JS đổi cả ký tự đặc biệt (ß -> SS); strings.ToUpper thì không
		s = cases.Upper(language.Und).String(s)
		s = norm.NFD.String(s)
	}
	var b strings.Builder
	b.Grow(len(s))
	space := false
	for _, r := range s {
		switch {
		case r >= 0x300 && r <= 0x36F:
			continue
		case isJSSpace(r):
			space = true
			continue
		}
		if space {
			b.WriteByte(' ')
			space = false
		}
		if r == 'Đ' {
			r = 'D'
		}
		b.WriteRune(r)
	}
	if space {
		b.WriteByte(' ')
	}
	return jsval.Trim(b.String())
}

// ToNumber = toNumber_: đọc số kiểu VN ("1.234.567", "12,5", "1.234,5 đ").
func ToNumber(v any) float64 {
	if jsval.IsNumber(v) {
		return jsval.ToNumber(v)
	}
	if jsval.IsNullish(v) {
		return 0
	}
	if s, ok := v.(string); ok && s == "" {
		return 0
	}
	src := jsval.ToString(v)
	buf := make([]byte, 0, len(src))
	commas, dots := 0, 0
	for i := 0; i < len(src); i++ {
		c := src[i]
		switch {
		case c >= '0' && c <= '9', c == '-':
		case c == ',':
			commas++
		case c == '.':
			dots++
		default:
			continue
		}
		buf = append(buf, c)
	}
	s := string(buf)
	switch {
	case commas > 1 && dots == 0: // "1,234,567" (kiểu Anh) -> 1234567
		s = strings.ReplaceAll(s, ",", "")
	case commas > 0 && dots > 0:
		s = strings.Replace(strings.ReplaceAll(s, ".", ""), ",", ".", 1)
	case dots > 1:
		s = strings.ReplaceAll(s, ".", "")
	case endsDot3(s):
		s = strings.ReplaceAll(s, ".", "")
	}
	s = strings.Replace(s, ",", ".", 1) // "12,5" -> 12.5
	n := jsval.ParseFloat(s)
	if n != n {
		return 0
	}
	return n
}

// /\.\d{3}$/
func endsDot3(s string) bool {
	n := len(s)
	if n < 4 || s[n-4] != '.' {
		return false
	}
	for i := n - 3; i < n; i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

/* Node có HAI hàm round0_ khác nhau:
   - server/shared.js:71     Math.round(Number(n) || 0)   -> Round0Num (chỉ importParse dùng)
   - server/store_supa.js:27 Math.round(n(v)), n() đọc số kiểu VN -> Round0 (mọi nghiệp vụ trong store dùng) */

// Round0Num = round0_ của shared.js: Math.round(Number(n) || 0).
func Round0Num(n any) float64 { return jsval.Round(jsval.Num0(n)) }

// N = n() của store_supa.js: null / undefined / "" -> 0; số hữu hạn giữ nguyên, NaN / Infinity -> 0;
// kiểu khác đọc bằng ToNumber (số kiểu VN).
func N(v any) float64 {
	if jsval.IsNullish(v) {
		return 0
	}
	if s, ok := v.(string); ok && s == "" {
		return 0
	}
	if jsval.IsNumber(v) {
		f := jsval.ToNumber(v)
		if math.IsNaN(f) || math.IsInf(f, 0) {
			return 0
		}
		return f
	}
	return ToNumber(v)
}

// Round0 = round0_ của store_supa.js: Math.round(n(v)).
func Round0(v any) float64 { return jsval.Round(N(v)) }

// LIM: số dòng tối đa mỗi lần đọc của store (store_supa.js:160).
const LIM = 20000

// ChamTran = chamTran_: cảnh báo khi một lần đọc chạm giới hạn dòng (limit <= 0 thì dùng LIM); trả lại rows.
func ChamTran[T any](rows []T, limit int, ten string) []T {
	if limit <= 0 {
		limit = LIM
	}
	if len(rows) >= limit {
		fmt.Fprintln(os.Stderr, "[QS PRO] "+ten+": chạm giới hạn "+strconv.Itoa(limit)+" dòng — có thể còn dữ liệu chưa lấy về, cần phân trang.")
	}
	return rows
}

// CoverComputed = coverComputed_: chi phí từng mục tờ bìa. Mục có con = tổng các mục LÁ bên dưới,
// tổng = cộng các mục cấp 1. Trả {cost: {stt: số}, total: số}.
func CoverComputed(cover []any) *omap.Map {
	n := len(cover)
	stt := make([]any, n)     // d.stt
	strs := make([]string, n) // String(d.stt)
	for i, c := range cover {
		stt[i] = jsval.Get(c, "stt")
		strs[i] = jsval.ToString(stt[i])
	}
	hasChild := func(i int) bool {
		p := strs[i] + "."
		for j := 0; j < n; j++ {
			if !jsval.StrictEquals(stt[j], stt[i]) && strings.HasPrefix(strs[j], p) {
				return true
			}
		}
		return false
	}
	parent := make([]bool, n)
	for i := range cover {
		parent[i] = hasChild(i)
	}
	cost := omap.New()
	for i, c := range cover {
		if !parent[i] {
			cost.Set(strs[i], jsval.Num0(jsval.Get(c, "chiPhi")))
			continue
		}
		s := 0.0
		p := strs[i] + "."
		for j, d := range cover {
			if !jsval.StrictEquals(stt[j], stt[i]) && strings.HasPrefix(strs[j], p) && !parent[j] {
				s += jsval.Num0(jsval.Get(d, "chiPhi"))
			}
		}
		cost.Set(strs[i], s)
	}
	total := 0.0
	for i := range cover {
		if !strings.Contains(strs[i], ".") {
			total += jsval.ToNumber(cost.Val(strs[i]))
		}
	}
	return omap.Of("cost", cost, "total", total)
}
