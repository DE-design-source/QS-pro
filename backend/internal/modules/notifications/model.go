package notifications

// dxTen = DX_TEN (A:669): loại đề xuất -> tên hiển thị.
var dxTen = map[string]string{"ck": "đề xuất chiết khấu", "tt": "đề xuất thanh toán"}

const dxTenMacDinh = "đề xuất"

// dxTenProto: DX_TEN là object thường nên khoá của Object.prototype cho ra hàm (truthy); nối chuỗi ra mã nguồn hàm.
// "__proto__" là object -> "[object Object]".
var dxTenProto = map[string]string{
	"constructor": "function Object() { [native code] }", "__proto__": "[object Object]",
	"__defineGetter__": "", "__defineSetter__": "", "hasOwnProperty": "", "__lookupGetter__": "", "__lookupSetter__": "",
	"isPrototypeOf": "", "propertyIsEnumerable": "", "toString": "", "valueOf": "", "toLocaleString": "",
}

// Loại thông báo và tiêu đề do module này phát (A:612, 676).
const (
	kindPurchase  = "purchase_request"
	titlePurchase = "Yêu cầu mua hàng"
	kindDeXuat    = "de_xuat"
	titleDeXuat   = "Đề xuất mua hàng"
)
