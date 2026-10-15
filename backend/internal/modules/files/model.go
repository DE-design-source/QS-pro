package files

// larkToken = biến _token của lark.js: { value, exp } - exp là epoch ms hết hạn.
// value giữ kiểu any vì Node lưu nguyên data.tenant_access_token (thiếu -> undefined, ghép ra "Bearer undefined").
type larkToken struct {
	value any
	exp   float64
}
