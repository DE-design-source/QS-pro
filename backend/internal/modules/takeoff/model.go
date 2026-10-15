package takeoff

// lineMap = LINE_MAP (store_supa.js:375-377): khoá của client -> cột chữ của db_bao_gia, giữ đúng thứ tự khoá.
var lineMap = [][2]string{
	{"nhom", "nhom"}, {"loai", "loai"}, {"tang", "tang"}, {"ten", "ten_sp"}, {"thuongHieu", "thuong_hieu"},
	{"ncc", "nha_cung_cap"}, {"moTa", "mo_ta"}, {"kichThuoc", "kich_thuoc"}, {"hinhAnh", "hinh_anh"}, {"dvt", "dvt"},
	{"khuVuc", "phong"}, {"maBanVe", "ma_so_ban_ve"}, {"maSP", "ma_sp"}, {"trangThai", "trang_thai"}, {"ghiChu", "ghi_chu"},
}

// calcOut: kết quả của calc_ (store_supa.js:342-343).
type calcOut struct {
	giaDaiLy, ban, donGia, markup, margin, thanhTien, lnVnd float64
}
