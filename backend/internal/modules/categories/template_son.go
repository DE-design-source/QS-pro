package categories

import (
	"strings"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/specs"
)

// sonCotMau = cotMau(hm) của son-template.js; hm rỗng = file gộp mọi hạng mục.
func sonCotMau(hm string) []cot {
	sp := specs.SON
	cols := cotDau(16, 18, 16)
	for _, lb := range metricCua(sp, hm) {
		w := 15.0
		switch lb {
		case "ĐỘ PHỦ", "ĐIỂM BÙNG CHÁY", "TÍNH DẺO":
			w = 26
		case "LƯU Ý", "GIỚI HẠN NỔ", "THỜI GIAN KHÔ":
			w = 20
		}
		cols = append(cols, cot{lb, batBuoc(sp, lb, hm), w})
	}
	return append(cols, cotCuoi()...)
}

// sonDongMau = dongMau(hm): chọn 1 hạng mục -> 2 dòng của hạng mục đó (gốc + quy cách khác cùng mã);
// không chọn -> Sơn ngoại thất x 2 + Sơn lót.
func sonDongMau(hm string) []*omap.Map {
	sp := specs.SON
	base := omap.Of("THƯƠNG HIỆU", "Dulux", "NHÀ CUNG CẤP", "Công ty ABC", "HẠNG MỤC", "",
		"CHIẾT KHẤU ĐẠI LÝ (%)", 25.0, "TRẠNG THÁI", "Đang kinh doanh")
	quyCach := func() *omap.Map { return omap.Of("KÍCH THƯỚC", "5L", "GIÁ BÁN LẺ", 890000.0) }
	if hm != "" {
		return danhDauVD(sp, []*omap.Map{mk(sp, base, hm, nil), mk(sp, base, hm, quyCach())})
	}
	return danhDauVD(sp, []*omap.Map{
		mk(sp, base, "Sơn ngoại thất", nil), mk(sp, base, "Sơn ngoại thất", quyCach()), mk(sp, base, "Sơn lót", nil),
	})
}

// BuildSonTemplate = buildSonTemplate(hangMuc): file mẫu Sơn nước. Tên hạng mục gõ sai / bỏ trống -> file gộp mọi hạng mục.
func BuildSonTemplate(hangMuc any) ([]byte, error) {
	sp := specs.SON
	hm := sp.ChuanHM(hangMuc)
	b := newBook()
	vd := sonDongMau(hm)
	b.sheetSanPham(sonCotMau(hm), vd)

	title := "HƯỚNG DẪN NHẬP HÀNG LOẠT — SƠN NƯỚC"
	if hm != "" {
		title += " · " + upper(hm)
	}
	gd := b.sheetHuongDan([]float64{5, 26, 104}, title+" — DEZON QS PRO", 46)
	soVD := jsval.ToString(float64(len(vd)))
	gd.line(`Điền vào sheet "San pham"`, "Mỗi dòng = 1 sản phẩm. Tiêu đề XANH SÁNG là bắt buộc, xanh đậm là tuỳ chọn. "+soVD+` dòng ví dụ (chữ nghiêng, tên bắt đầu "`+sp.VD+`") được hệ thống TỰ BỎ QUA khi nhập — có thể xoá hoặc để nguyên.`, 46)
	if hm != "" {
		gd.line("Hạng mục (quan trọng)", `File này dành RIÊNG cho hạng mục "`+hm+`" — các cột đúng bằng bộ thông số của hạng mục đó. `+
			`Giữ nguyên cột HẠNG MỤC là "`+hm+`"; muốn nhập hạng mục khác thì tải file mẫu của hạng mục đó (chọn hạng mục ở form Nhập dữ liệu rồi bấm Tải file mẫu).`, 0)
	} else {
		gd.line("Hạng mục (quan trọng)", "Cột HẠNG MỤC phải là 1 trong: "+strings.Join(sp.HangMuc, " / ")+". Hạng mục quyết định thông số nào được nhận — mỗi dòng CHỈ điền thông số của hạng mục đó (bảng cuối sheet); cột của hạng mục khác để trống, có điền cũng bị bỏ qua.", 0)
	}
	gd.line("Thông số bắt buộc", "Cột thông số tô xanh sáng là bắt buộc với MỘT SỐ hạng mục (dấu * ở bảng cuối sheet). Dòng thiếu thông số bắt buộc của hạng mục mình sẽ KHÔNG được nhập và bị báo lỗi kèm tên sản phẩm.", 0)
	gd.line("Giá & chiết khấu", "GIÁ BÁN LẺ nhập số (vd 12500000). Giá đại lý hệ thống TỰ TÍNH = Giá bán lẻ × (1 − Chiết khấu %). Không cần nhập cột Giá đại lý.", 0)
	gd.line("BIẾN THỂ (quy cách)", "Cùng MÃ SẢN PHẨM nhưng khác QUY CÁCH / MÀU SẮC = các SẢN PHẨM RIÊNG. Mỗi quy cách viết 1 DÒNG (xem 2 dòng ví dụ cùng mã: 18L và 5L).", 0)
	gd.line("Ghi đè hay tạo mới?", "Trùng CẢ 3 yếu tố (mã + màu sắc + quy cách) → CẬP NHẬT dòng cũ. Khác màu hoặc quy cách → TẠO SẢN PHẨM MỚI.", 32)
	gd.line("Thông số — nhập chữ", `Độ phủ ghi "Lên đến 13 m²/lít/lớp"; thời gian khô "30 phút (khô bề mặt) · 2 giờ (khô cứng)"; quy cách "18L", "40kg"; pH "9". Không bắt buộc phải là số.`, 0)
	gd.line("Cột số", "GIÁ BÁN LẺ, CHIẾT KHẤU ĐẠI LÝ (%) nhập SỐ. SỐ LỚP nhập 1 / 2 / 3. Để trống nếu chưa có.", 32)
	gd.line("Tính năng sản phẩm", `Mỗi tính năng 1 dòng trong cùng ô (Alt+Enter để xuống dòng), vd "• Chống nấm mốc" ↵ "• Chống bám bụi".`, 32)
	gd.line("Cột chọn", "TRẠNG THÁI: Đang kinh doanh / Ngưng kinh doanh / Đặt hàng. ĐƠN VỊ TÍNH: Thùng / Lon / Bao / Bộ. Gợi ý giá trị cho từng thông số: xem bảng cuối sheet.", 32)
	gd.line("Ảnh sản phẩm", "KHÔNG nhập ảnh trong file này. Sau khi tải file lên, hệ thống hiện danh sách để bạn tải ảnh (1 ảnh đại diện + nhiều ảnh chi tiết) cho từng SP rồi lưu.", 0)
	gd.line("Tải lên", `Lưu file → tab "Nhập dữ liệu" → chọn ngành "Sơn nước" → mục "Nhập hàng loạt từ file" → chọn file này.`, 32)

	gd.bang("THÔNG SỐ THEO HẠNG MỤC", "(* = bắt buộc · trong ngoặc = giá trị gợi ý)", true)
	for _, h := range dsHM(sp, hm) {
		gd.dongBangHM(sp, h)
	}
	return b.finish()
}

// SonTemplateName = tên file tải về của /mau-nhap-son-nuoc.xlsx (I:824), chưa gồm "-DezonQS.xlsx":
// có hạng mục hợp lệ -> "Mau-nhap-" + tên hạng mục bỏ dấu, đ / Đ -> d, mỗi cụm ký tự ngoài [A-Za-z0-9_] -> "-".
func SonTemplateName(hangMuc any) string {
	hm := specs.SON.ChuanHM(hangMuc)
	if hm == "" {
		return "Mau-nhap-son-nuoc"
	}
	var b strings.Builder
	b.WriteString("Mau-nhap-")
	gach := false
	for _, r := range nfd(hm) {
		switch {
		case r >= 0x300 && r <= 0x36f:
			continue
		case r == 'đ' || r == 'Đ':
			r = 'd'
		}
		if r == '_' || (r >= '0' && r <= '9') || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			b.WriteRune(r)
			gach = false
		} else if !gach {
			b.WriteByte('-')
			gach = true
		}
	}
	return b.String()
}
