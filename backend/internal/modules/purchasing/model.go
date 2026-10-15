package purchasing

// Tên bảng như mã Node truyền cho supa.*.
const (
	tblDon    = "don_mua_hang"
	tblDonCT  = "chi_tiet_mua_hang"
	tblDeXuat = "de_xuat"
	tblDxCK   = "chi_tiet_de_xuat_ck"
	tblDxTT   = "chi_tiet_de_xuat_tt"
)

// Trạng thái của đơn / đề xuất.
const (
	ttChoDuyet = "Chờ duyệt"
	ttDaDuyet  = "Đã duyệt"
	ttTuChoi   = "Từ chối"
)

// poBuoc = PO_BUOC (A:659): trạng thái mới -> trạng thái liền trước bắt buộc.
var poBuoc = map[string]string{"Đã đặt hàng": ttDaDuyet, "Đã nhận hàng": "Đã đặt hàng"}

// poBuocProto: PO_BUOC là object thường nên khoá của Object.prototype cho ra hàm (truthy). Node khi đó chạy lệnh
// update với bộ lọc là mã nguồn hàm (không dòng nào khớp) rồi báo lỗi mang chính chuỗi đó. Rỗng = hàm native cùng tên.
var poBuocProto = map[string]string{
	"constructor": "function Object() { [native code] }", "__proto__": "[object Object]",
	"__defineGetter__": "", "__defineSetter__": "", "hasOwnProperty": "", "__lookupGetter__": "", "__lookupSetter__": "",
	"isPrototypeOf": "", "propertyIsEnumerable": "", "toString": "", "valueOf": "", "toLocaleString": "",
}

// Thông báo lỗi của Node (giữ từng byte).
const (
	errKhongThayDon = "Không tìm thấy đơn mua hàng"
	errDonDaXuLy    = "Đơn đã được xử lý"
	errTTKhongHopLe = "Trạng thái không hợp lệ"
	errKhongThayDX  = "Không tìm thấy đề xuất"
	errDXDaXuLy     = "Đề xuất đã được xử lý"
	errThieuBangDX  = `Chưa có bảng "de_xuat" trong CSDL. `
)

// errKhongThayPhieu: route chỉ bản Go GET /my-proposals/:code - phiếu không có HOẶC không phải của người gọi (cùng một câu,
// không lộ phiếu của người khác có tồn tại hay không).
const errKhongThayPhieu = "Không tìm thấy phiếu"

// Kết quả gửi thẻ Lark của đơn (cột ket_qua_gui, M9.1). Đơn tạo trước bản này mang "ok" / "pending" mặc định của lệnh lưu,
// không phải kết quả thật.
const (
	kqGuiOk  = "ok"
	kqGuiLoi = "loi"
)
