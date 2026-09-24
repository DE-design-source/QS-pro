/* ═══ SƠN NƯỚC — BỘ THÔNG SỐ THEO TỪNG HẠNG MỤC (nguồn DUY NHẤT) ═══
   Cùng cách làm với public/vs-spec.js (thiết bị vệ sinh). Dùng chung cho:
     · Form Nhập dữ liệu / modal Sửa SP (public/app.js) -> chỉ hiện thông số của hạng mục đang chọn
     · File mẫu nhập hàng loạt (server tạo động /mau-nhap-son-nuoc.xlsx) — 1 sheet "San pham" phẳng
     · Server (store_supa) -> map cột DB, lọc thông số khi nhập, ghép cột "Thông tin chính" /
       "Thông số thiết kế" cho bảng bóc tách & báo giá
   Bộ trường lấy theo file bóc tách sơn nước của Dezon: khối "Key Product Info", khối
   "Tính năng sản phẩm" và khối "IX. Các tính chất vật lý và hoá học".
   Nhãn nào TRÙNG với vs-spec.js thì DÙNG CHUNG cột DB (MÀU SẮC · KÍCH THƯỚC ·
   BỀ MẶT HOÀN THIỆN · LƯU Ý) — nhãn là khoá duy nhất toàn hệ thống.
   Cột DB mới: db/son_nuoc.sql                                                            */
(function (root) {
  'use strict';
  // Nhãn cột (cũng là tiêu đề cột trong file Excel) -> [cột DB, nhãn hiển thị, kiểu, gợi ý nhập]
  var METRIC = {
    // ----- Key Product Info (Thông tin chính) -----
    'MÀU SẮC':            ['mau_sac', 'Màu sắc', 'text', 'VD: Màu trắng'],
    'BỀ MẶT HOÀN THIỆN':  ['be_mat', 'Bề mặt hoàn thiện', 'sel', 'VD: Bề mặt bóng'],
    'ĐỘ PHỦ':             ['do_phu', 'Độ phủ', 'text', 'VD: Lên đến 13 m²/lít/lớp'],
    'THỜI GIAN KHÔ':      ['thoi_gian_kho', 'Thời gian khô', 'text', 'VD: 30 phút (khô bề mặt)'],
    'SỐ LỚP':             ['so_lop', 'Số lớp', 'sel', 'VD: 2'],
    'KÍCH THƯỚC':         ['kich_thuoc', 'Quy cách (dung tích)', 'sel', 'VD: 18L'],
    // ----- IX. Các tính chất vật lý và hoá học -----
    'TRẠNG THÁI VẬT LÝ':  ['trang_thai_vat_ly', 'Trạng thái vật lý', 'sel', 'VD: Chất lỏng'],
    'MÙI':                ['mui', 'Mùi', 'text', 'VD: Đặc tính'],
    'NGƯỠNG VỀ MÙI':      ['nguong_mui', 'Ngưỡng về mùi', 'text', 'VD: Không có sẵn'],
    'ĐỘ PH':              ['do_ph', 'Độ pH', 'text', 'VD: 9'],
    'ĐIỂM CHẢY / ĐÔNG':   ['diem_dong', 'Điểm chảy / điểm đông', 'text', 'VD: Không có sẵn'],
    'ĐIỂM SÔI':           ['diem_soi', 'Điểm sôi / dải sôi', 'text', 'VD: 100°C (212°F)'],
    'ĐIỂM BÙNG CHÁY':     ['diem_bung_chay', 'Điểm bùng cháy', 'text', 'VD: Cốc đậy kín: Không áp dụng'],
    'KHẢ NĂNG CHÁY':      ['kha_nang_chay', 'Khả năng cháy', 'text', 'VD: Không có sẵn'],
    'GIỚI HẠN NỔ':        ['gioi_han_no', 'Giới hạn nổ dưới và trên', 'text', 'VD: Thấp hơn 2.6%'],
    'ÁP SUẤT HÓA HƠI':    ['ap_suat_hoa_hoi', 'Áp suất hoá hơi', 'text', 'VD: Không có sẵn'],
    'MẬT ĐỘ HƠI':         ['mat_do_hoi', 'Mật độ hơi tương đối', 'text', 'VD: 1.195'],
    'ĐỘ HÒA TAN TRONG NƯỚC': ['do_hoa_tan', 'Độ hoà tan trong nước', 'text', 'VD: Không có sẵn'],
    'TÍNH DẺO':           ['tinh_deo', 'Tính dẻo (độ nhớt)', 'text', 'VD: 2477 mm²/s ở nhiệt độ phòng'],
    'ĐẶC TÍNH HẠT':       ['dac_tinh_hat', 'Đặc tính hạt', 'text', 'VD: Không có sẵn'],
    'LƯU Ý':              ['luu_y', 'Lưu ý', 'text', 'VD: Không thi công khi bề mặt còn ẩm']
  };

  var BE_MAT = ['Bề mặt bóng', 'Bóng mờ', 'Mờ', 'Siêu mờ', 'Bán bóng'];
  var QUY_CACH = ['1L', '5L', '18L', '20L', '25kg', '40kg'];
  var SO_LOP = ['1', '2', '3'];
  var TRANG_THAI_VL = ['Chất lỏng', 'Bột', 'Sệt'];
  // Khối tính chất lý hoá dùng chung cho mọi hạng mục sơn (theo mục IX của bảng dữ liệu an toàn)
  var LY_HOA = ['TRẠNG THÁI VẬT LÝ', 'MÙI', 'NGƯỠNG VỀ MÙI', 'ĐỘ PH', 'ĐIỂM CHẢY / ĐÔNG', 'ĐIỂM SÔI',
    'ĐIỂM BÙNG CHÁY', 'KHẢ NĂNG CHÁY', 'GIỚI HẠN NỔ', 'ÁP SUẤT HÓA HƠI', 'MẬT ĐỘ HƠI',
    'ĐỘ HÒA TAN TRONG NƯỚC', 'TÍNH DẺO', 'ĐẶC TÍNH HẠT', 'LƯU Ý'];
  var CHINH = ['MÀU SẮC', 'BỀ MẶT HOÀN THIỆN', 'ĐỘ PHỦ', 'THỜI GIAN KHÔ', 'SỐ LỚP', 'KÍCH THƯỚC'];
  var OPT_CHUNG = { 'BỀ MẶT HOÀN THIỆN': BE_MAT, 'KÍCH THƯỚC': QUY_CACH, 'SỐ LỚP': SO_LOP,
    'TRẠNG THÁI VẬT LÝ': TRANG_THAI_VL };

  function hm(mau, them) {
    return { kem: (them && them.kem) || [], chinh: CHINH.slice(), tk: LY_HOA.slice(),
      req: (them && them.req) || ['MÀU SẮC', 'ĐỘ PHỦ', 'KÍCH THƯỚC'],
      opt: OPT_CHUNG, mau: mau };
  }
  /* Mỗi hạng mục: chinh = khối "Key Product Info (Thông tin chính)", tk = "Thông số thiết kế"
     (ở sơn nước là khối tính chất lý hoá), req = bắt buộc, opt = danh sách chọn, mau = dòng ví dụ. */
  var HM = {
    'Sơn nội thất': hm({ 'DÒNG SẢN PHẨM': 'Sơn nội thất', 'TÊN SẢN PHẨM': 'Sơn nội thất Dulux EasyClean Lau Chùi Hiệu Quả',
      'MÃ SẢN PHẨM': 'Dulux EasyClean', 'MÀU SẮC': 'Màu trắng', 'BỀ MẶT HOÀN THIỆN': 'Mờ',
      'ĐỘ PHỦ': 'Lên đến 14 m²/lít/lớp', 'THỜI GIAN KHÔ': '30 phút', 'SỐ LỚP': '2', 'KÍCH THƯỚC': '18L',
      'TRẠNG THÁI VẬT LÝ': 'Chất lỏng', 'GIÁ BÁN LẺ': 2150000, 'ĐƠN VỊ TÍNH': 'Thùng' }),
    'Sơn ngoại thất': hm({ 'DÒNG SẢN PHẨM': 'Sơn ngoại thất', 'TÊN SẢN PHẨM': 'Sơn ngoại thất Dulux Weathershield Royal Shine',
      'MÃ SẢN PHẨM': 'Dulux Weathershield Royal Shine', 'MÀU SẮC': 'Màu trắng', 'BỀ MẶT HOÀN THIỆN': 'Bề mặt bóng',
      'ĐỘ PHỦ': 'Lên đến 13 m²/lít/lớp', 'THỜI GIAN KHÔ': '30 phút', 'SỐ LỚP': '2', 'KÍCH THƯỚC': '18L',
      'TRẠNG THÁI VẬT LÝ': 'Chất lỏng', 'ĐỘ PH': '9', 'ĐIỂM SÔI': '100°C (212°F)',
      'MẬT ĐỘ HƠI': '1.195', 'TÍNH NĂNG': '• Chống nấm mốc\n• Chống bám bụi\n• Bề mặt sáng đẹp\n• Sắc màu bền đẹp',
      'GIÁ BÁN LẺ': 2890000, 'ĐƠN VỊ TÍNH': 'Thùng' }),
    'Sơn lót': hm({ 'DÒNG SẢN PHẨM': 'Sơn lót', 'TÊN SẢN PHẨM': 'Sơn lót chống kiềm nội thất',
      'MÃ SẢN PHẨM': 'Maxilite Primer', 'MÀU SẮC': 'Màu trắng', 'BỀ MẶT HOÀN THIỆN': 'Mờ',
      'ĐỘ PHỦ': 'Lên đến 12 m²/lít/lớp', 'THỜI GIAN KHÔ': '1 giờ', 'SỐ LỚP': '1', 'KÍCH THƯỚC': '18L',
      'GIÁ BÁN LẺ': 1250000, 'ĐƠN VỊ TÍNH': 'Thùng' }),
    'Sơn chống thấm': hm({ 'DÒNG SẢN PHẨM': 'Sơn chống thấm', 'TÊN SẢN PHẨM': 'Chống thấm pha xi măng',
      'MÃ SẢN PHẨM': 'Weathershield Waterproof', 'MÀU SẮC': 'Màu trắng', 'ĐỘ PHỦ': 'Lên đến 6 m²/lít/lớp',
      'THỜI GIAN KHÔ': '2 giờ', 'SỐ LỚP': '2', 'KÍCH THƯỚC': '20L', 'GIÁ BÁN LẺ': 2450000, 'ĐƠN VỊ TÍNH': 'Thùng' }),
    'Bả matit': hm({ 'DÒNG SẢN PHẨM': 'Bả matit', 'TÊN SẢN PHẨM': 'Bột bả nội thất',
      'MÃ SẢN PHẨM': 'Dulux Skimcoat', 'MÀU SẮC': 'Màu trắng', 'ĐỘ PHỦ': 'Lên đến 2 m²/kg/lớp',
      'THỜI GIAN KHÔ': '2 giờ', 'SỐ LỚP': '2', 'KÍCH THƯỚC': '40kg', 'TRẠNG THÁI VẬT LÝ': 'Bột',
      'GIÁ BÁN LẺ': 320000, 'ĐƠN VỊ TÍNH': 'Bao' }, { req: ['MÀU SẮC', 'KÍCH THƯỚC'] }),
    'Sơn hiệu ứng': hm({ 'DÒNG SẢN PHẨM': 'Sơn hiệu ứng', 'TÊN SẢN PHẨM': 'Sơn hiệu ứng bê tông',
      'MÃ SẢN PHẨM': 'Effect Concrete', 'MÀU SẮC': 'Xám bê tông', 'BỀ MẶT HOÀN THIỆN': 'Siêu mờ',
      'ĐỘ PHỦ': 'Lên đến 5 m²/lít/lớp', 'THỜI GIAN KHÔ': '1 giờ', 'SỐ LỚP': '2', 'KÍCH THƯỚC': '5L',
      'GIÁ BÁN LẺ': 3200000, 'ĐƠN VỊ TÍNH': 'Thùng' }),
    'Sơn sàn epoxy': hm({ 'DÒNG SẢN PHẨM': 'Sơn sàn epoxy', 'TÊN SẢN PHẨM': 'Sơn sàn epoxy hệ lăn',
      'MÃ SẢN PHẨM': 'KCC ET5660', 'MÀU SẮC': 'Xám xanh', 'BỀ MẶT HOÀN THIỆN': 'Bề mặt bóng',
      'ĐỘ PHỦ': 'Lên đến 8 m²/lít/lớp', 'THỜI GIAN KHÔ': '6 giờ', 'SỐ LỚP': '2', 'KÍCH THƯỚC': '20L',
      'GIÁ BÁN LẺ': 4200000, 'ĐƠN VỊ TÍNH': 'Bộ' }),
    'Dung môi & phụ gia': hm({ 'DÒNG SẢN PHẨM': 'Dung môi', 'TÊN SẢN PHẨM': 'Dung môi pha sơn epoxy',
      'MÃ SẢN PHẨM': 'Thinner EP', 'MÀU SẮC': 'Trong suốt', 'KÍCH THƯỚC': '5L', 'TRẠNG THÁI VẬT LÝ': 'Chất lỏng',
      'GIÁ BÁN LẺ': 450000, 'ĐƠN VỊ TÍNH': 'Thùng' }, { req: ['KÍCH THƯỚC'] })
  };
  var HANG_MUC = Object.keys(HM);
  // Trường CHUNG của mọi SP sơn nước — cột nào ngoài CHUNG + thông số của hạng mục đều bị bỏ khi nhập
  var CHUNG = ['THƯƠNG HIỆU', 'NHÀ CUNG CẤP', 'HẠNG MỤC', 'DÒNG SẢN PHẨM', 'NHÓM SẢN PHẨM', 'TÊN SẢN PHẨM', 'MÃ SẢN PHẨM',
    'GIÁ BÁN LẺ', 'CHIẾT KHẤU ĐẠI LÝ (%)', 'TÍNH NĂNG', 'BẢO HÀNH (năm)', 'ĐƠN VỊ TÍNH', 'TRẠNG THÁI',
    'LINK DATASHEET', 'THÔNG SỐ KỸ THUẬT', 'HƯỚNG DẪN CÀI ĐẶT', 'FILE BẢN VẼ', 'GHI CHÚ', 'ẢNH SẢN PHẨM', 'NGÀNH HÀNG'];

  function bo_dau(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function chuanHM(v) {
    var k = bo_dau(v); if (!k) return '';
    for (var i = 0; i < HANG_MUC.length; i++) if (bo_dau(HANG_MUC[i]) === k) return HANG_MUC[i];
    return '';
  }
  function hmOf(v) { return HM[chuanHM(v)] || null; }
  var ALL = Object.keys(METRIC);
  function labelsOf(v) { var h = hmOf(v); return h ? h.chinh.concat(h.tk) : ALL.slice(); }
  function gom(k) {
    var out = [];
    HANG_MUC.forEach(function (x) { HM[x][k].forEach(function (lb) { if (out.indexOf(lb) < 0) out.push(lb); }); });
    return out;
  }
  var CHINH_ALL = gom('chinh'), TK_ALL = gom('tk').filter(function (lb) { return CHINH_ALL.indexOf(lb) < 0; });
  function optsOf(v, lb) { var h = hmOf(v); return (h && h.opt[lb]) || []; }
  function isReq(v, lb) { var h = hmOf(v); return !!(h && h.req.indexOf(lb) >= 0); }

  var api = { METRIC: METRIC, HM: HM, HANG_MUC: HANG_MUC, ALL: ALL, CHUNG: CHUNG,
    gom: gom, CHINH_ALL: CHINH_ALL, TK_ALL: TK_ALL,
    chuanHM: chuanHM, hmOf: hmOf, labelsOf: labelsOf, optsOf: optsOf, isReq: isReq,
    VD: '[VÍ DỤ]' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SON_SPEC = api;
})(typeof window !== 'undefined' ? window : this);
