package reports

// Hằng của báo cáo sản phẩm nhập mới (I:323-335).
const (
	vnOffsetMs   = 7 * 60 * 60 * 1000 // VN_OFFSET_MS
	baoCaoGioVN  = 8                  // BAO_CAO_GIO_VN: 8h sáng giờ VN
	baoCaoAction = "bao_cao_nhap_sp"  // BAO_CAO_ACTION
	msNgay       = 24 * 60 * 60 * 1000
	maxTimeMs    = 8.64e15 // giới hạn time value của Date
)

// baoCaoThu = BAO_CAO_THU: 3 = thứ 4, 6 = thứ 7.
var baoCaoThu = [...]int{3, 6}

// ngayRow: một ngày của một người nhập ({ngay, soSP, soNCC}).
type ngayRow struct {
	ngay  string
	soSP  float64
	soNCC float64
}

// bangRow: một người nhập ({ten, phongBan, tongSP, tongNCC, ngay}). ten / phongBan giữ giá trị thô của database.
type bangRow struct {
	ten      any
	phongBan any
	tongSP   float64
	tongNCC  float64
	ngay     []ngayRow
}

// nganhRow: một ngành hàng ({ten, soSP, soNCC}).
type nganhRow struct {
	ten   string
	soSP  float64
	soNCC float64
}

// thongKe = tk ({tongSP, tongNCC, tongNguoi, chuaGanCT}).
type thongKe struct {
	tongSP    float64
	tongNCC   float64
	tongNguoi float64
	chuaGanCT bool
}

// theCongTy: số liệu của MỘT công ty = một thẻ Lark ({congTy, ctKey, bang, tk, khuyet, nganh}).
type theCongTy struct {
	congTy any
	ctKey  string
	bang   []bangRow
	tk     thongKe
	khuyet float64
	nganh  []nganhRow
}

// userInfo = phần tử của uInfo ({ten, pb}).
type userInfo struct {
	ten any
	pb  any
}

// protoKeys: tên thuộc tính có sẵn trên Object.prototype. Object thường của JS dùng làm từ điển "thấy" các khoá này
// dù chưa ai ghi vào (I:475, 496, 510).
var protoKeys = map[string]bool{
	"constructor": true, "__defineGetter__": true, "__defineSetter__": true, "hasOwnProperty": true,
	"__lookupGetter__": true, "__lookupSetter__": true, "isPrototypeOf": true, "propertyIsEnumerable": true,
	"toString": true, "valueOf": true, "__proto__": true, "toLocaleString": true,
}
