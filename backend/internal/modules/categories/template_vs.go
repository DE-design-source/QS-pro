package categories

import (
	"strings"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/specs"
)

// vsCotMau = cotMau() của vs-template.js.
func vsCotMau() []cot {
	sp := specs.VS
	cols := cotDau(16, 18, 16)
	for _, lb := range metricCua(sp, "") {
		w := 15.0
		switch lb {
		case "KÍCH THƯỚC", "BỒN CẦU TƯƠNG THÍCH":
			w = 24
		case "LƯU Ý", "THIẾT KẾ":
			w = 20
		}
		cols = append(cols, cot{lb, batBuoc(sp, lb, ""), w})
	}
	return append(cols, cotCuoi()...)
}

// vsDongMau = dongMau(): Bồn cầu + 1 biến thể (cùng mã, khác màu) + Sen tắm.
func vsDongMau() []*omap.Map {
	sp := specs.VS
	base := omap.Of("THƯƠNG HIỆU", "TOTO", "NHÀ CUNG CẤP", "Công ty ABC", "HẠNG MỤC", "",
		"CHIẾT KHẤU ĐẠI LÝ (%)", 30.0, "BẢO HÀNH (năm)", 2.0, "TRẠNG THÁI", "Đang kinh doanh")
	return danhDauVD(sp, []*omap.Map{
		mk(sp, base, "Bồn cầu", nil),
		mk(sp, base, "Bồn cầu", omap.Of("MÀU SẮC", "Đen mờ", "GIÁ BÁN LẺ", 13900000.0)),
		mk(sp, base, "Sen tắm", nil),
	})
}

// BuildVsTemplate = buildVsTemplate(): file mẫu nhập hàng loạt Thiết bị vệ sinh (.xlsx).
func BuildVsTemplate() ([]byte, error) {
	sp := specs.VS
	b := newBook()
	vd := vsDongMau()
	b.sheetSanPham(vsCotMau(), vd)

	gd := b.sheetHuongDan([]float64{5, 26, 104}, "HƯỚNG DẪN NHẬP HÀNG LOẠT — THIẾT BỊ VỆ SINH — DEZON QS PRO", 46)
	soVD := jsval.ToString(float64(len(vd)))
	gd.line(`Điền vào sheet "San pham"`, "Mỗi dòng = 1 sản phẩm. Tiêu đề XANH SÁNG là bắt buộc, xanh đậm là tuỳ chọn. "+soVD+` dòng ví dụ (chữ nghiêng, tên bắt đầu "`+sp.VD+`") được hệ thống TỰ BỎ QUA khi nhập — có thể xoá hoặc để nguyên.`, 46)
	gd.line("Hạng mục (quan trọng)", "Cột HẠNG MỤC phải là 1 trong: "+strings.Join(sp.HangMuc, " / ")+". Hạng mục quyết định thông số nào được nhận — mỗi dòng CHỈ điền thông số của hạng mục đó (bảng cuối sheet); cột của hạng mục khác để trống, có điền cũng bị bỏ qua.", 0)
	gd.line("Thông số bắt buộc", "Cột thông số tô xanh sáng là bắt buộc với MỘT SỐ hạng mục (dấu * ở bảng cuối sheet). Dòng thiếu thông số bắt buộc của hạng mục mình sẽ KHÔNG được nhập và bị báo lỗi kèm tên sản phẩm.", 0)
	gd.line("Giá & chiết khấu", "GIÁ BÁN LẺ nhập số (vd 12500000). Giá đại lý hệ thống TỰ TÍNH = Giá bán lẻ × (1 − Chiết khấu %). Không cần nhập cột Giá đại lý.", 0)
	gd.line("BIẾN THỂ", "Cùng MÃ SẢN PHẨM nhưng khác MÀU SẮC / KÍCH THƯỚC = các SẢN PHẨM RIÊNG. Mỗi biến thể viết 1 DÒNG (xem 2 dòng ví dụ MS885DT8: Trắng và Đen mờ).", 0)
	gd.line("Ghi đè hay tạo mới?", "Trùng CẢ 3 yếu tố (mã + màu sắc + kích thước) → CẬP NHẬT dòng cũ. Khác màu hoặc kích thước → TẠO SẢN PHẨM MỚI.", 32)
	gd.line("Thông số — nhập chữ", `Kích thước ghi "L580 x W380 x H335 (mm)" hoặc "Ø420 x H155 (mm)"; lượng nước xả "4.8/3L"; áp lực "0.05 ~ 0.75 MPa"; lưu lượng "6 L/phút". Không bắt buộc phải là số.`, 0)
	gd.line("Cột số", "GIÁ BÁN LẺ, CHIẾT KHẤU ĐẠI LÝ (%), BẢO HÀNH (năm) nhập SỐ. Để trống nếu chưa có.", 32)
	gd.line("Tính năng", `Mỗi tính năng 1 dòng trong cùng ô (Alt+Enter để xuống dòng), vd "• Rửa vệ sinh" ↵ "• Sấy khô".`, 32)
	gd.line("Cột chọn", "TRẠNG THÁI: Đang kinh doanh / Ngưng kinh doanh / Đặt hàng. ĐƠN VỊ TÍNH: Cái / Bộ / Chiếc. Gợi ý giá trị cho từng thông số: xem bảng cuối sheet.", 32)
	gd.line("Ảnh sản phẩm", "KHÔNG nhập ảnh trong file này. Sau khi tải file lên, hệ thống hiện danh sách để bạn tải ảnh (1 ảnh đại diện + nhiều ảnh chi tiết) cho từng SP rồi lưu.", 0)
	gd.line("Tải lên", `Lưu file → tab "Nhập dữ liệu" → chọn ngành "Thiết bị vệ sinh" → mục "Nhập hàng loạt từ file" → chọn file này.`, 32)

	gd.bang("THÔNG SỐ THEO HẠNG MỤC", "(* = bắt buộc · trong ngoặc = giá trị gợi ý)", true)
	for _, hm := range sp.HangMuc {
		gd.dongBangHM(sp, hm)
	}
	return b.finish()
}

// dongBangHM: dòng "Thông tin chính / Thông số thiết kế" của 1 hạng mục (VS và SON dùng chung).
func (h *huongDan) dongBangHM(sp *specs.Spec, hm string) {
	o := sp.HMGet(hm)
	ten := tenThongSo(sp, o)
	txt := "Thông tin chính: " + mapJoin(specs.Strs(o.Val("chinh")), ten, " · ") +
		"\nThông số thiết kế: " + mapJoin(specs.Strs(o.Val("tk")), ten, " · ")
	h.dongBang(hm, txt, caoDong(txt, 46, 95, 16), false)
}
