'use strict';
/************************************************************
 * SẢN PHẨM — phần thuần (không chạm DB): ngành hàng, dòng DB -> object cho client,
 * bảng nhãn form Nhập <-> cột DB.
 ************************************************************/
const VS = require('../../../public/vs-spec.js');  // thông số thiết bị vệ sinh theo từng hạng mục (nguồn chung)
const SON = require('../../../public/son-spec.js'); // thông số sơn nước theo từng hạng mục (nguồn chung)
const { n, s, firstImg, fmtUnit, fmtList, fmtCutout_ } = require('../../libraries/utils');

/* NGÀNH HÀNG của 1 sản phẩm: 'den' (mặc định) · 'vs' (thiết bị vệ sinh) · 'son' (sơn nước).
   Chưa đóng dấu ngành thì đoán theo tên HẠNG MỤC — mỗi ngành có danh sách hạng mục riêng. */
function nganhCua_(nganh, hangMuc) {
  const n = String(nganh == null ? '' : nganh).trim();
  if (n) return n;
  if (SON.chuanHM(hangMuc)) return 'son';
  return VS.chuanHM(hangMuc) ? 'vs' : 'den';
}
function specNganh_(ng) { return ng === 'vs' ? VS : (ng === 'son' ? SON : null); }
const MUC_NGANH = { vs: 'Thiết bị vệ sinh', son: 'Sơn nước', den: 'Thiết bị đèn' };

/*** ===== SẢN PHẨM (db_san_pham) ===== ***/
function prodToObj(r) {
  const congSuat = fmtUnit(r.cong_suat_w, 'W'), nhietDo = fmtList(r.nhiet_do_mau_k, 'K'), gocChieu = fmtList(r.goc_chieu_deg, '°');
  const cri = s(r.cri), chip = s(r.loai_chip_led), chipTen = s(r.ten_chip_led), dong = s(r.dong_sp), qt = r.quang_thong_lm ? (r.quang_thong_lm + 'lm') : '';
  const chipTxt = [chipTen, chip].filter(Boolean).join(' · ');   // "Bridgelux · COB"
  const chatLieu = s(r.chat_lieu), chieuCao = fmtUnit(r.chieu_cao_mm, 'mm'), duongKinh = r.duong_kinh_mm ? ('Ø' + r.duong_kinh_mm + 'mm') : '', gocNghieng = fmtList(r.goc_nghieng_deg, '°');
  // "Thông tin chính" = gộp thông số cốt lõi (hiện ở cột bảng bóc tách)
  const ttc = [];
  if (dong) ttc.push('Dòng SP: ' + dong);
  if (chipTxt) ttc.push('Chip LED: ' + chipTxt + (cri ? ', CRI ' + cri : ''));
  else if (cri) ttc.push('CRI: ' + cri);
  if (congSuat) ttc.push('Công suất: ' + congSuat);
  if (nhietDo) ttc.push('Nhiệt độ màu: ' + nhietDo);
  if (gocChieu) ttc.push('Góc chiếu: ' + gocChieu);
  if (qt) ttc.push('Quang thông: ' + qt);
  let moTa = ttc.join('\n'); if (s(r.ghi_chu)) moTa += (moTa ? '\n' : '') + s(r.ghi_chu);
  // "Thông số thiết kế" = gộp như Design Specifications (hiện ở cột bảng bóc tách)
  const tsk = [];
  if (chatLieu) tsk.push('Chất liệu: ' + chatLieu);
  if (chieuCao) tsk.push('Chiều cao: ' + chieuCao);
  if (duongKinh) tsk.push('Đường kính: ' + duongKinh);
  if (gocNghieng) tsk.push('Góc nghiêng: ' + gocNghieng);
  if (dong) tsk.push('Dòng SP: ' + dong);
  const size = (r.duong_kinh_mm && r.chieu_cao_mm) ? ('Ø' + r.duong_kinh_mm + '×H' + r.chieu_cao_mm + 'mm') : (r.duong_kinh_mm ? ('Ø' + r.duong_kinh_mm + 'mm') : '');
  let thongSoTK = tsk.join('\n') || size;
  /* ===== NGÀNH HÀNG ===== 'den' (mặc định) | 'vs' = thiết bị vệ sinh.
     Thiết bị vệ sinh ghép 2 cột gộp theo thông số của HẠNG MỤC (public/vs-spec.js):
       THÔNG TIN CHÍNH  = thông số khối chinh + Dòng SP · Hạng mục · Bảo hành
       THÔNG SỐ THIẾT KẾ = thông số khối tk                                      */
  const nganh = nganhCua_(r.nganh, r.hang_muc);
  const bh = r.bao_hanh_nam ? (r.bao_hanh_nam + ' năm') : '';
  const SPEC = specNganh_(nganh);
  if (SPEC) {
    // Mỗi hạng mục có bộ thông số riêng (public/vs-spec.js): chinh -> THÔNG TIN CHÍNH, tk -> THÔNG SỐ THIẾT KẾ.
    // Hạng mục lạ / chưa chọn -> in mọi thông số có giá trị.
    const h = SPEC.hmOf(r.hang_muc);
    const line = function (lb) { const m = SPEC.METRIC[lb], v = s(r[m[0]]); return v ? (m[1] + ': ' + v) : ''; };
    const chinh = h ? h.chinh : SPEC.CHINH_ALL, tk = h ? h.tk : SPEC.TK_ALL;   // cùng cách chia với panel chi tiết
    const a = chinh.map(line).filter(Boolean);
    if (dong) a.push('Dòng SP: ' + dong);
    if (s(r.hang_muc)) a.push('Hạng mục: ' + (SPEC.chuanHM(r.hang_muc) || s(r.hang_muc)));
    if (bh) a.push('Bảo hành: ' + bh);
    moTa = a.join('\n'); if (s(r.ghi_chu)) moTa += (moTa ? '\n' : '') + s(r.ghi_chu);
    thongSoTK = tk.map(line).filter(Boolean).join('\n');
    if (nganh === 'son') {
      /* SƠN NƯỚC — theo file "sơn nước.xlsx" (khối HIỂN THỊ TRÊN TRANG DỰ TOÁN):
           THÔNG TIN CHÍNH   = Bề mặt · Độ phủ · Thời gian khô · Số lớp · Dòng sản phẩm · Hạng mục (Sơn nước) · Kích thước
           TÍNH NĂNG SẢN PHẨM = các dòng tính năng (cột 2 của bảng — không in khối lý hoá IX, khối đó chỉ ở trang thông tin SP) */
      const b = chinh.filter(function (lb) { return lb !== 'KÍCH THƯỚC'; }).map(line).filter(Boolean);
      b.push('Dòng sản phẩm: ' + (dong || SPEC.chuanHM(r.hang_muc) || s(r.hang_muc)));
      b.push('Hạng mục: ' + SPEC.MUC);
      if (chinh.indexOf('KÍCH THƯỚC') >= 0 && line('KÍCH THƯỚC')) b.push(line('KÍCH THƯỚC'));
      moTa = b.join('\n');
      thongSoTK = s(r.tinh_nang).split(/\r?\n/).map(function (x) { return x.replace(/^[•\-*\s]+/, '').trim(); }).filter(Boolean).join('\n');
    }
  }
  return {
    ma: s(r.ma_sp), ten: s(r.ten_sp), dongSanPham: dong, hangMuc: s(r.hang_muc),
    nhom: s(r.nhom_sp) || dong,
    nganh: nganh,                                   // ngành hàng: 'den' | 'vs' | 'son'
    muc: MUC_NGANH[nganh] || 'Thiết bị đèn',        // -> đề mục 3.2.5 / 3.2.2 / 3.2.6.1 trên cây
    // --- trường riêng của Thiết bị vệ sinh (hiện ở panel chi tiết) ---
    kichThuocVS: s(r.kich_thuoc), heThongXa: s(r.he_thong_xa), luongNuocXa: s(r.luong_nuoc_xa),
    thietKe: s(r.thiet_ke), tamXa: s(r.tam_xa), apLucNuoc: s(r.ap_luc_nuoc),
    luuY: s(r.luu_y), tinhNang: s(r.tinh_nang),
    thuongHieu: s(r.thuong_hieu), ncc: s(r.nha_cung_cap),
    congSuat: congSuat, nhietDo: nhietDo, gocChieu: gocChieu,
    mauSac: s(r.mau_sac), chatLieu: chatLieu,
    chieuCao: chieuCao, duongKinh: duongKinh,
    gocNghieng: gocNghieng, loKhoet: fmtCutout_(r.cutout_mm),
    capBaoVe: s(r.chi_so_ip), cri: cri, hieuSuat: r.hieu_suat_lm_w ? (r.hieu_suat_lm_w + ' lm/W') : '',
    ugr: s(r.ugr), sdcm: s(r.sdcm), coi: s(r.coi), tuoiTho: s(r.tuoi_tho), chipLed: chip, tenChip: chipTen,
    quangThong: qt, baoHanh: r.bao_hanh_nam ? (r.bao_hanh_nam + ' năm') : '',
    tenBoNguon: s(r.ten_bo_nguon), maBoNguon: s(r.ma_bo_nguon), hangBoNguon: s(r.hang_bo_nguon),
    viTriNguon: s(r.vi_tri_lap_nguon), tuongThich: s(r.dieu_khien), dongRa: r.dong_ra_max_ma ? (r.dong_ra_max_ma + 'mA') : '',
    lapNguonRoi: r.lap_nguon_roi ? 'Có' : '', capBaoVeDien: s(r.class_rating), linkDatasheet: s(r.link_datasheet),
    thongSoFile: s(r.thong_so_file), huongDanLapDat: s(r.huong_dan_lap_dat), fileBanVe: s(r.file_ban_ve),
    kichThuoc: thongSoTK, size: size,
    dvt: s(r.dvt) || 'Cái', hinhAnh: firstImg(r.anh_sp), anhTatCa: s(r.anh_sp), moTa: moTa,
    giaBanLe: n(r.gia_ban_le), ckDaiLy: n(r.ck_dai_ly_pct),   // để sửa TRỰC TIẾP trong bảng Danh sách SP
    donGiaVon: n(r.gia_dai_ly), donGiaBan: n(r.gia_dai_ly), lnPct: 0, recordId: r.id, ngayCapNhat: s(r.ngay_cap_nhat),
    // Giá trị GỐC của TẤT CẢ trường trong form Nhập — để bảng Danh sách SP hiển thị/sửa
    // được đúng bộ cột như form (hiển thị là '12W'/'4000K' nhưng DB lưu '12'/'4000').
    daDuyet: r.da_duyet === true, nguoiDuyet: s(r.nguoi_duyet), ngayDuyet: s(r.ngay_duyet),
    nguoiTao: s(r.nguoi_tao), ngayTao: s(r.ngay_tao), nguoiSua: s(r.nguoi_sua),
    nhomBT: s(r.nhom_bt),        // nhóm biến thể do người dùng tự gom (rỗng -> gom theo mã SP)
    raw: rawCols_(r)
  };
}
// Bộ cột "thô" gửi kèm mỗi sản phẩm = đúng các trường của form Nhập (bỏ ảnh vì đã có ở hinhAnh
// và chuỗi rất dài). Nhờ vậy bảng Danh sách SP sinh cột thẳng từ danh sách trường, không lệch nhau.
let _rawCols = null;
function rawCols_(r) {
  if (!_rawCols) _rawCols = Object.keys(DB_LABEL2COL).map(function (k) { return DB_LABEL2COL[k]; })
    .filter(function (c) { return c !== 'anh_sp'; });
  const o = {};
  _rawCols.forEach(function (c) {
    if (c === 'lap_nguon_roi') { o[c] = r[c] ? 'Có' : ''; return; }
    const v = r[c]; o[c] = (v == null) ? '' : String(v);
  });
  return o;
}

/*** ===== SP MỚI / ẢNH ===== ***/
// Các trường ÉP KIỂU SỐ khi lưu. CHỈ liệt kê cột thật sự là numeric trong DB —
// nhiet_do_mau_k / goc_chieu_deg / goc_nghieng_deg / cong_suat_w / cutout_mm đều là TEXT
// (cho nhập "3000, 4000", "2×5W", "24°/38°"); ép n() sẽ biến các giá trị đó thành 0 -> MẤT DỮ LIỆU.
const DB_NUM = ['QUANG THÔNG (lm)',
  'CHIỀU CAO (mm)', 'ĐƯỜNG KÍNH (mm)', 'HIỆU SUẤT PHÁT QUANG (lm/W)', 'DÒNG RA TỐI ĐA (mA)',
  'BẢO HÀNH (năm)', 'GIÁ BÁN LẺ', 'CHIẾT KHẤU ĐẠI LÝ (%)', 'GIÁ BÁN BỘ NGUỒN'];
const DB_LABEL2COL = {
  'MÃ SẢN PHẨM': 'ma_sp', 'TÊN SẢN PHẨM': 'ten_sp', 'DÒNG SẢN PHẨM': 'dong_sp', 'HẠNG MỤC': 'hang_muc', 'NHÓM SẢN PHẨM': 'nhom_sp',
  'THƯƠNG HIỆU': 'thuong_hieu', 'NHÀ CUNG CẤP': 'nha_cung_cap', 'CÔNG SUẤT (W)': 'cong_suat_w', 'NHIỆT ĐỘ MÀU (K)': 'nhiet_do_mau_k',
  'QUANG THÔNG (lm)': 'quang_thong_lm', 'GÓC CHIẾU (°)': 'goc_chieu_deg', 'GÓC NGHIÊNG (°)': 'goc_nghieng_deg', 'MÀU SẮC': 'mau_sac',
  'CHẤT LIỆU': 'chat_lieu', 'CHIỀU CAO (mm)': 'chieu_cao_mm', 'ĐƯỜNG KÍNH (mm)': 'duong_kinh_mm', 'LỖ KHOÉT TRẦN (mm)': 'cutout_mm',
  'CHỈ SỐ IP': 'chi_so_ip', 'CRI': 'cri', 'HIỆU SUẤT PHÁT QUANG (lm/W)': 'hieu_suat_lm_w', 'UGR': 'ugr', 'SDCM': 'sdcm', 'COI': 'coi',
  'TUỔI THỌ': 'tuoi_tho', 'TÊN CHIP LED': 'ten_chip_led', 'LOẠI CHIP LED': 'loai_chip_led', 'CẤP BẢO VỆ ĐIỆN': 'class_rating', 'LẮP NGUỒN RỜI': 'lap_nguon_roi',
  'TÊN BỘ NGUỒN': 'ten_bo_nguon', 'MÃ BỘ NGUỒN': 'ma_bo_nguon', 'HÃNG BỘ NGUỒN': 'hang_bo_nguon', 'GIÁ BÁN BỘ NGUỒN': 'gia_ban_bo_nguon', 'VỊ TRÍ LẮP NGUỒN': 'vi_tri_lap_nguon',
  'TƯƠNG THÍCH ĐIỀU KHIỂN': 'dieu_khien', 'DÒNG RA TỐI ĐA (mA)': 'dong_ra_max_ma', 'BẢO HÀNH (năm)': 'bao_hanh_nam', 'ĐƠN VỊ TÍNH': 'dvt',
  'GIÁ BÁN LẺ': 'gia_ban_le', 'CHIẾT KHẤU ĐẠI LÝ (%)': 'ck_dai_ly_pct', 'ẢNH SẢN PHẨM': 'anh_sp', 'LINK DATASHEET': 'link_datasheet',
  'TRẠNG THÁI': 'trang_thai', 'GHI CHÚ': 'ghi_chu',
  // ---- Ngành THIẾT BỊ VỆ SINH (db/thiet_bi_ve_sinh.sql) ----
  'NGÀNH HÀNG': 'nganh', 'KÍCH THƯỚC': 'kich_thuoc', 'HỆ THỐNG XẢ': 'he_thong_xa',
  'LƯỢNG NƯỚC XẢ': 'luong_nuoc_xa', 'THIẾT KẾ': 'thiet_ke', 'TÂM XẢ': 'tam_xa',
  'ÁP LỰC NƯỚC': 'ap_luc_nuoc', 'LƯU Ý': 'luu_y', 'TÍNH NĂNG': 'tinh_nang'
};
// Tài liệu sản phẩm (db/tai_lieu_sp.sql): mỗi trường 1 link — file tải lên kho hoặc link dán vào
Object.assign(DB_LABEL2COL, { 'THÔNG SỐ KỸ THUẬT': 'thong_so_file', 'HƯỚNG DẪN CÀI ĐẶT': 'huong_dan_lap_dat', 'FILE BẢN VẼ': 'file_ban_ve' });
// Thông số RIÊNG từng hạng mục vệ sinh (public/vs-spec.js — nguồn chung với form & file mẫu)
Object.keys(VS.METRIC).forEach(function (lb) { if (!DB_LABEL2COL[lb]) DB_LABEL2COL[lb] = VS.METRIC[lb][0]; });
// Thông số RIÊNG từng hạng mục sơn nước (public/son-spec.js — nguồn chung với form & file mẫu)
Object.keys(SON.METRIC).forEach(function (lb) { if (!DB_LABEL2COL[lb]) DB_LABEL2COL[lb] = SON.METRIC[lb][0]; });
const COL2LABEL = {}; Object.keys(DB_LABEL2COL).forEach(function (lb) { COL2LABEL[DB_LABEL2COL[lb]] = lb; });
// Chuyển {nhãn: giá trị} -> {cột DB: giá trị đã ép kiểu}
function dataToRow_(data) {
  const row = {};
  Object.keys(data || {}).forEach(function (label) {
    const col = DB_LABEL2COL[label]; if (!col) return;
    let v = data[label];
    if (label === 'LẮP NGUỒN RỜI') v = /^(có|yes|true|1|x)$/i.test(String(v));
    else if (DB_NUM.indexOf(label) >= 0) v = (v === '' || v == null) ? null : n(v);
    else v = (v == null) ? '' : String(v);
    row[col] = v;
  });
  return row;
}

module.exports = { nganhCua_, specNganh_, MUC_NGANH, prodToObj, DB_NUM, DB_LABEL2COL, COL2LABEL, dataToRow_ };
