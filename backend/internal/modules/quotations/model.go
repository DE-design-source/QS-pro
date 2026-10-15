package quotations

import (
	"strings"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"

	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
)

// Màu ARGB của export.js:13-19.
const (
	mauNavy   = "FF1F3864"
	mauNavy2  = "FF12314F"
	mauGHead  = "FFDBE9F6"
	mauStripe = "FFF7F9FC"
	mauGold   = "FFF4E9D8"
	mauLine   = "FFD5DBE4"
	mauWhite  = "FFFFFFFF"
)

const (
	xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	fmtInt   = "#,##0"
	imgMax   = 5 * 1024 * 1024 // IMG_MAX
)

// exportSty: 1 mục của EXPORT_STY (export.js:21-54) - bề rộng (px), căn lề, định dạng của cột xuất.
type exportSty struct {
	Label string
	W     float64
	Al    string
	Wrap  bool
	Bold  bool
	Num   bool
	Img   bool
}

// Thứ tự khoá của EXPORT_STY = thứ tự cột khi client không gửi danh sách cột.
var exportStyKeys = []string{
	"stt", "khuVuc", "maBanVe", "nhom", "loai", "maSP", "ten", "thuongHieu", "ncc", "moTa", "kichThuoc", "hinhAnh",
	"dvt", "soLuong", "donGiaBan", "thanhTienBan",
	"tang", "nganh", "giaNCC", "chietKhau", "giaDaiLy", "lnPct", "donGia", "ckKhach", "donGiaCK", "markup", "margin",
	"lnVnd", "thanhTien", "trangThai", "ghiChu",
}

var exportStyMap = map[string]exportSty{
	"stt":          {Label: "STT", W: 34, Al: "center"},
	"khuVuc":       {Label: "PHÒNG", W: 120, Al: "center"},
	"maBanVe":      {Label: "MÃ SỐ BẢN VẼ", W: 66, Al: "center"},
	"nhom":         {Label: "NHÓM", W: 110, Al: "center"},
	"loai":         {Label: "HẠNG MỤC", W: 92, Al: "center"},
	"maSP":         {Label: "MÃ SẢN PHẨM", W: 104, Al: "center"},
	"ten":          {Label: "TÊN SẢN PHẨM", W: 175, Al: "left", Wrap: true, Bold: true},
	"thuongHieu":   {Label: "THƯƠNG HIỆU", W: 88, Al: "center"},
	"ncc":          {Label: "NHÀ CUNG CẤP", W: 110, Al: "center"},
	"moTa":         {Label: "MÔ TẢ", W: 175, Al: "left", Wrap: true},
	"kichThuoc":    {Label: "KÍCH THƯỚC", W: 110, Al: "left", Wrap: true},
	"hinhAnh":      {Label: "HÌNH ẢNH", W: 78, Al: "center", Img: true},
	"dvt":          {Label: "ĐVT", W: 42, Al: "center"},
	"soLuong":      {Label: "SỐ LƯỢNG", W: 52, Al: "center", Num: true},
	"donGiaBan":    {Label: "ĐƠN GIÁ", W: 96, Al: "right", Num: true},
	"thanhTienBan": {Label: "THÀNH TIỀN", W: 110, Al: "right", Num: true, Bold: true},
	// các cột còn lại của bảng Bóc tách
	"tang":      {Label: "TẦNG / KHU VỰC", W: 110, Al: "center"},
	"nganh":     {Label: "DÒNG SẢN PHẨM", W: 110, Al: "center"},
	"giaNCC":    {Label: "GIÁ BÁN LẺ", W: 100, Al: "right", Num: true},
	"chietKhau": {Label: "CHIẾT KHẤU CỦA ĐẠI LÝ (%)", W: 96, Al: "center", Num: true},
	"giaDaiLy":  {Label: "GIÁ ĐẠI LÝ", W: 100, Al: "right", Num: true},
	"lnPct":     {Label: "LỢI NHUẬN DỰ KIẾN (%)", W: 92, Al: "center", Num: true},
	"donGia":    {Label: "GIÁ BÁN", W: 100, Al: "right", Num: true},
	"ckKhach":   {Label: "CHIẾT KHẤU CHO KHÁCH HÀNG (%)", W: 100, Al: "center", Num: true},
	"donGiaCK":  {Label: "ĐƠN GIÁ", W: 100, Al: "right", Num: true},
	"markup":    {Label: "LỢI NHUẬN/GIÁ VỐN (%)", W: 96, Al: "center", Num: true},
	"margin":    {Label: "LỢI NHUẬN/GIÁ BÁN (%)", W: 96, Al: "center", Num: true},
	"lnVnd":     {Label: "LỢI NHUẬN (VND)", W: 106, Al: "right", Num: true},
	"thanhTien": {Label: "THÀNH TIỀN", W: 110, Al: "right", Num: true, Bold: true},
	"trangThai": {Label: "TRẠNG THÁI", W: 92, Al: "center"},
	"ghiChu":    {Label: "GHI CHÚ", W: 140, Al: "left", Wrap: true},
}

// exCol: 1 phần tử của EXCOLS (export.js:478-485). K và Label giữ nguyên giá trị client gửi (có thể không phải chuỗi).
type exCol struct {
	K     any
	Label any
	W     float64
	Al    string
	Wrap  bool
	Bold  bool
	Num   bool
	Img   bool
}

// s32Col: cột của sheet "3.2 Phần hoàn thiện" (export.js:168-174).
type s32Col struct {
	Label string
	W     float64
	Al    string
	Wrap  bool
	Bold  bool
	Num   bool
	Pct   bool
}

var s32Cols = []s32Col{
	{Label: "NO", W: 44, Al: "center"}, {Label: "HẠNG MỤC", W: 170, Al: "left", Bold: true},
	{Label: "MÔ TẢ CHI TIẾT", W: 250, Al: "left", Wrap: true}, {Label: "DVT", W: 44, Al: "center"},
	{Label: "KHỐI LƯỢNG", W: 70, Al: "center", Num: true}, {Label: "ĐƠN GIÁ", W: 95, Al: "right", Num: true},
	{Label: "CHI PHÍ DỰ KIẾN", W: 130, Al: "right", Num: true, Bold: true}, {Label: "TỶ TRỌNG", W: 70, Al: "right", Pct: true},
	{Label: "NHÀ CUNG CẤP", W: 160, Al: "left"},
}

// ptCol: cột của sheet "3.1 Phần thô" (export.js:370-380). NT = cột giá nhà thầu (số nội bộ).
type ptCol struct {
	K     string
	Label string
	W     float64
	Al    string
	Wrap  bool
	Fmt   string
	NT    bool
}

var ptCols = []ptCol{
	{K: "stt", Label: "STT", W: 6, Al: "center"},
	{K: "n", Label: "NỘI DUNG CÔNG VIỆC", W: 46, Al: "left", Wrap: true},
	{K: "dvt", Label: "ĐVT", W: 9, Al: "center"},
	{K: "kl", Label: "KHỐI LƯỢNG", W: 13, Al: "right", Fmt: "#,##0.##"},
	{K: "dgnt", Label: "ĐƠN GIÁ (NHÀ THẦU)", W: 17, Al: "right", Fmt: fmtInt, NT: true},
	{K: "ttnt", Label: "THÀNH TIỀN (NHÀ THẦU)", W: 19, Al: "right", Fmt: fmtInt, NT: true},
	{K: "dg", Label: "ĐƠN GIÁ", W: 15, Al: "right", Fmt: fmtInt},
	{K: "tt", Label: "THÀNH TIỀN", W: 17, Al: "right", Fmt: fmtInt},
	{K: "gc", Label: "GHI CHÚ", W: 26, Al: "left", Wrap: true},
}

// jsUpper / jsLower = toUpperCase / toLowerCase của JS (bảng đổi hoa thường đầy đủ của Unicode, không theo ngôn ngữ).
// Tạo Caser cho từng lần gọi: x/text ghi rõ Caser có thể giữ trạng thái, không dùng chung giữa các goroutine.
func jsUpper(s string) string { return cases.Upper(language.Und).String(upperU16.Replace(s)) }
func jsLower(s string) string { return cases.Lower(language.Und).String(lowerU16.Replace(s)) }

// upperU16 / lowerU16: 27 cặp chữ hoa - thường có từ Unicode 16 (Node 22 đã biết) mà bảng của golang.org/x/text chưa có.
var upperU16, lowerU16 = func() (*strings.Replacer, *strings.Replacer) {
	lo := []string{"Ᲊ", "ᲊ", "Ɤ", "ɤ", "Ꟍ", "ꟍ", "Ꟛ", "ꟛ", "Ƛ", "ƛ"}
	for r := rune(0x10D50); r <= 0x10D65; r++ { // Garay
		lo = append(lo, string(r), string(r+0x20))
	}
	up := make([]string, len(lo))
	for i := 0; i < len(lo); i += 2 {
		up[i], up[i+1] = lo[i+1], lo[i]
	}
	return strings.NewReplacer(up...), strings.NewReplacer(lo...)
}()

// protoKeys: thuộc tính mà MỌI object {} của JS thừa hưởng từ Object.prototype. export.js dùng {} làm bảng tra
// (an, gmap, cmap, used, EXPORT_STY) nên khoá trùng tên các thuộc tính này "đã có sẵn" với giá trị truthy.
var protoKeys = map[string]bool{
	"constructor": true, "toString": true, "toLocaleString": true, "valueOf": true, "hasOwnProperty": true,
	"isPrototypeOf": true, "propertyIsEnumerable": true, "__proto__": true, "__defineGetter__": true,
	"__defineSetter__": true, "__lookupGetter__": true, "__lookupSetter__": true,
}

// errPush: gmap[k] / cmap[k] trỏ vào thuộc tính thừa hưởng (không có .items) -> .items.push ném TypeError.
func errPush() error { return apperr.New("Cannot read properties of undefined (reading 'push')") }

// jsFunc: giá trị ô là 1 HÀM của JS (l[key] với key là tên hàm của Object.prototype). ExcelJS nhận lúc gán
// nhưng ném TypeError khi ghi file.
type jsFunc struct{}

// typeErrRead: TypeError của V8 khi đọc thuộc tính của null / undefined.
func typeErrRead(v any, prop string) error {
	kind := "undefined"
	if v == nil {
		kind = "null"
	}
	return apperr.New("Cannot read properties of " + kind + " (reading '" + prop + "')")
}

// prop = v[key] của JS, thêm chỉ số ký tự của chuỗi (jsval.Get không lấy "abc"[0]).
func prop(v any, key string) any {
	if s, ok := v.(string); ok && len(key) == 1 && key[0] >= '0' && key[0] <= '9' {
		i := int(key[0] - '0')
		if i < jsval.Len16(s) {
			return jsval.Slice(s, i, i+1)
		}
		return jsval.Undefined
	}
	return jsval.Get(v, key)
}

// plus = "chuỗi" + v của JS.
func plus(s string, v any) string { return s + jsval.ToString(v) }
