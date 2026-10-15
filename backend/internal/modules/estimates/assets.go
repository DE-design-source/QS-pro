package estimates

import (
	_ "embed"
)

// File mẫu nhập công tác (tab Nhập dữ liệu > Phần thô), khôi phục nguyên văn từ public/ của app Node cũ.
//
//go:embed assets/mau-nhap-cong-tac.xlsx
var mauNhapCongTac []byte

// Assets: file tĩnh nhúng trong binary, giao diện tải thẳng ở gốc (trước đây nằm trong public/).
// Server phục vụ như express.static (xem internal/server/assets.go).
func (s *Service) Assets() map[string][]byte {
	return map[string][]byte{"/mau-nhap-cong-tac.xlsx": mauNhapCongTac}
}
