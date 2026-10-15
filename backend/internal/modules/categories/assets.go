package categories

import (
	_ "embed"

	"qspro-backend/internal/shared/specs"
)

// File mẫu nhập hàng loạt sản phẩm (tab Nhập dữ liệu), khôi phục nguyên văn từ public/ của app Node cũ.
//
//go:embed assets/mau-nhap-hang-loat.xlsx
var mauNhapHangLoat []byte

// Assets: file tĩnh nhúng trong binary mà giao diện tải thẳng ở gốc (trước đây nằm trong public/):
// 3 spec ngành (nguồn ở internal/shared/specs/js) và file mẫu nhập hàng loạt. Server phục vụ như express.static.
func (s *Service) Assets() map[string][]byte {
	out := map[string][]byte{"/mau-nhap-hang-loat.xlsx": mauNhapHangLoat}
	for _, f := range specs.SourceFiles {
		out["/"+f] = specs.Source(f)
	}
	return out
}
