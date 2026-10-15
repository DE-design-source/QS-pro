package categories

import (
	"strings"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/specs"
)

// ctCotMau = cotMau(hm) của ct-template.js: cột chọn ("sel") rộng 20, còn lại 16.
func ctCotMau(hm string) []cot {
	sp := specs.CT
	cols := cotDau(20, 22, 20)
	for _, lb := range metricCua(sp, hm) {
		w := 16.0
		if sp.MetricKind(lb) == "sel" {
			w = 20
		}
		cols = append(cols, cot{lb, batBuoc(sp, lb, hm), w})
	}
	return append(cols, cotCuoi()...)
}

// ctDongMau = dongMau(hm): chọn 1 hạng mục -> dòng gốc + 1 màu khác (giá + 20000); không chọn -> 3 hạng mục tiêu biểu.
func ctDongMau(hm string) []*omap.Map {
	sp := specs.CT
	base := omap.Of("THƯƠNG HIỆU", "Panasonic", "NHÀ CUNG CẤP", "Công ty ABC", "HẠNG MỤC", "",
		"CHIẾT KHẤU ĐẠI LÝ (%)", 25.0, "BẢO HÀNH (năm)", 2.0, "TRẠNG THÁI", "Đang kinh doanh")
	if hm != "" {
		// (mau["GIÁ BÁN LẺ"] || 0) + 20000: giá là chuỗi thì JS nối chuỗi
		var gia any
		if g := jsval.Or(jsval.GetPath(sp.HMGet(hm), "mau", "GIÁ BÁN LẺ"), 0.0); jsval.IsString(g) {
			gia = jsval.AsString(g) + "20000"
		} else {
			gia = jsval.ToNumber(g) + 20000
		}
		return danhDauVD(sp, []*omap.Map{mk(sp, base, hm, nil), mk(sp, base, hm, omap.Of("MÀU SẮC", "Đen", "GIÁ BÁN LẺ", gia))})
	}
	return danhDauVD(sp, []*omap.Map{
		mk(sp, base, "Ổ cắm điện", nil), mk(sp, base, "Công tắc cơ", nil), mk(sp, base, "Công tắc thông minh", nil),
	})
}

// BuildCtTemplate = buildCtTemplate(hangMuc): file mẫu Công tắc - ổ cắm. Hạng mục lạ / bỏ trống -> gộp cả 2 module.
func BuildCtTemplate(hangMuc any) ([]byte, error) {
	sp := specs.CT
	hm := sp.ChuanHM(hangMuc)
	b := newBook()
	b.sheetSanPham(ctCotMau(hm), ctDongMau(hm))

	title := "HƯỚNG DẪN NHẬP HÀNG LOẠT — CÔNG TẮC - Ổ CẮM"
	if hm != "" {
		title += " · " + upper(hm)
	}
	gd := b.sheetHuongDan([]float64{5, 30, 110}, title+" — DEZON QS PRO", 40)
	gd.line(`Điền vào sheet "San pham"`, `Mỗi dòng = 1 sản phẩm (1 mã). Tiêu đề XANH SÁNG là bắt buộc, xanh đậm là tuỳ chọn. Các dòng ví dụ (chữ nghiêng, tên bắt đầu "`+sp.VD+`") được hệ thống TỰ BỎ QUA khi nhập.`, 0)
	if hm != "" {
		gd.line("Hạng mục (quan trọng)", `File này dành RIÊNG cho hạng mục "`+hm+`". Giữ nguyên cột HẠNG MỤC; muốn nhập hạng mục khác thì tải file mẫu của hạng mục đó.`, 58)
	} else {
		gd.line("Hạng mục (quan trọng)", "Cột HẠNG MỤC phải là 1 trong: "+strings.Join(sp.HangMuc, " / ")+". Hạng mục quyết định thông số nào được nhận (ổ cắm và công tắc có bộ thông số khác nhau) — cột của module kia bị bỏ qua.", 58)
	}
	gd.line("Hãng bán rời mặt / hạt / đế", "Mỗi cấu kiện là 1 MÃ riêng (1 dòng), cột LOẠI CẤU KIỆN ghi rõ: "+joinAny(jsval.AsArray(sp.Opt.Val("LOẠI CẤU KIỆN")), " / ")+".", 0)
	gd.line("Giá & chiết khấu", "GIÁ BÁN LẺ nhập số (vd 185000). Giá đại lý hệ thống TỰ TÍNH = Giá bán lẻ × (1 − Chiết khấu %).", 30)
	gd.line("Biến thể (màu)", "Cùng MÃ SẢN PHẨM nhưng khác MÀU SẮC = các sản phẩm riêng, mỗi màu 1 dòng. Trùng cả mã + màu → CẬP NHẬT dòng cũ.", 30)
	gd.line("Cột Có / Không", `CÓ MÀN CHE AN TOÀN, TÍCH HỢP THÔNG MINH: ghi "Có" hoặc "Không".`, 28)
	gd.line("Kích thước mặt", `Nhập riêng 3 cột CHIỀU RỘNG / CHIỀU CAO / ĐỘ DÀY (mm) — bảng bóc tách tự ghép thành "R x C x D mm".`, 30)
	gd.line("Ảnh sản phẩm", "KHÔNG nhập ảnh trong file này. Sau khi tải file lên, hệ thống hiện danh sách để tải ảnh cho từng sản phẩm rồi lưu.", 30)
	gd.line("Tải lên", `Lưu file → tab "Nhập dữ liệu" → chọn ngành "Công tắc - ổ cắm" → mục "Nhập hàng loạt từ file" → chọn file này.`, 28)

	gd.bang("THÔNG SỐ THEO MODULE", "(* = bắt buộc · trong ngoặc = giá trị được chọn)", false)
	daIn := map[string]bool{} // các hạng mục cùng module dùng chung 1 bộ thông số
	for _, x := range dsHM(sp, hm) {
		h := sp.HMGet(x)
		loai := jsval.ToString(h.Val("loai"))
		if daIn[loai] {
			continue
		}
		daIn[loai] = true
		ten := tenThongSo(sp, h)
		nhom := jsval.AsMap(h.Val("nhom"))
		khoi := func(k string) string { return mapJoin(specs.Strs(nhom.Val(k)), ten, " · ") }
		txt := "Thông tin chính: " + khoi("chinh") + "\nĐiện & an toàn: " + khoi("dien") +
			"\n" + jsval.ToString(nhom.Val("tenTm")) + ": " + khoi("tm") + "\nLắp đặt: " + khoi("lap")
		name := hm
		if name == "" {
			if loai == "oc" {
				name = "Module Ổ CẮM"
			} else {
				name = "Module CÔNG TẮC"
			}
		}
		gd.dongBang(name, txt, caoDong(txt, 60, 100, 30), true)
	}
	return b.finish()
}
