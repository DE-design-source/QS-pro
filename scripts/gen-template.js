'use strict';
/* Tạo public/mau-nhap-hang-loat.xlsx — đủ cột theo form Nhập dữ liệu, KHÔNG có cột ảnh.
   Chạy: node scripts/gen-template.js */
const path = require('path');
const ExcelJS = require(path.join(__dirname, '..', 'node_modules', 'exceljs'));

// [nhãn cột, bắt buộc?, gợi ý/ví dụ]
const COLS = [
  // Thông tin cơ bản
  ['THƯƠNG HIỆU', 1, 'Osram'], ['NHÀ CUNG CẤP', 1, 'Sun Light'],
  ['HẠNG MỤC', 1, 'Đèn nội thất'], ['DÒNG SẢN PHẨM', 1, 'Downlight'],
  ['TÊN SẢN PHẨM', 1, 'Đèn downlight âm trần 12W'], ['MÃ SẢN PHẨM', 1, 'DL-12W-3000'],
  // Giá bán
  ['GIÁ BÁN LẺ', 1, '208000'], ['CHIẾT KHẤU ĐẠI LÝ (%)', 1, '35'],
  // Key product info
  ['CÔNG SUẤT (W)', 1, '12'], ['NHIỆT ĐỘ MÀU (K)', 1, '3000'], ['MÀU SẮC', 1, 'Trắng'],
  ['GÓC CHIẾU (°)', 0, '36'], ['CHẤT LIỆU', 0, 'Nhôm đúc'], ['CHIỀU CAO (mm)', 0, '55'],
  ['ĐƯỜNG KÍNH (mm)', 0, '100'], ['GÓC NGHIÊNG (°)', 0, ''],
  // Performance
  ['QUANG THÔNG (lm)', 1, '1080'], ['CHỈ SỐ IP', 0, 'IP44'], ['CRI', 0, 'Ra90'],
  ['HIỆU SUẤT PHÁT QUANG (lm/W)', 0, '90'], ['UGR', 0, '<19'], ['TUỔI THỌ', 0, '30000h'],
  ['LOẠI CHIP LED', 0, 'COB'], ['SDCM', 0, '3'], ['COI', 0, ''], ['BẢO HÀNH (năm)', 0, '2'],
  // Bộ nguồn
  ['TÊN BỘ NGUỒN', 0, ''], ['MÃ BỘ NGUỒN', 0, ''], ['HÃNG BỘ NGUỒN', 0, ''],
  ['VỊ TRÍ LẮP NGUỒN', 0, 'Lắp rời'], ['TƯƠNG THÍCH ĐIỀU KHIỂN', 0, 'Triac'], ['DÒNG RA TỐI ĐA (mA)', 0, ''],
  // Installation
  ['LẮP NGUỒN RỜI', 0, 'Có'], ['LỖ KHOÉT TRẦN (mm)', 0, '90'], ['CẤP BẢO VỆ ĐIỆN', 0, 'Class II'],
  // Quản trị & khác
  ['NHÓM SẢN PHẨM', 0, ''], ['ĐƠN VỊ TÍNH', 1, 'Cái'], ['LINK DATASHEET', 0, ''],
  ['TRẠNG THÁI', 1, 'Đang kinh doanh'], ['GHI CHÚ', 0, '']
];

const SAMPLES = [
  { 'TÊN SẢN PHẨM': 'Đèn downlight âm trần 12W', 'MÃ SẢN PHẨM': 'DL-12W-3000', 'THƯƠNG HIỆU': 'Osram', 'NHÀ CUNG CẤP': 'Sun Light', 'HẠNG MỤC': 'Đèn nội thất', 'DÒNG SẢN PHẨM': 'Downlight', 'GIÁ BÁN LẺ': 208000, 'CHIẾT KHẤU ĐẠI LÝ (%)': 35, 'CÔNG SUẤT (W)': 12, 'NHIỆT ĐỘ MÀU (K)': 3000, 'MÀU SẮC': 'Trắng', 'GÓC CHIẾU (°)': 36, 'CHẤT LIỆU': 'Nhôm đúc', 'CHIỀU CAO (mm)': 55, 'ĐƯỜNG KÍNH (mm)': 100, 'QUANG THÔNG (lm)': 1080, 'CHỈ SỐ IP': 'IP44', 'CRI': 'Ra90', 'HIỆU SUẤT PHÁT QUANG (lm/W)': 90, 'LOẠI CHIP LED': 'COB', 'BẢO HÀNH (năm)': 2, 'VỊ TRÍ LẮP NGUỒN': 'Lắp rời', 'LẮP NGUỒN RỜI': 'Có', 'LỖ KHOÉT TRẦN (mm)': 90, 'CẤP BẢO VỆ ĐIỆN': 'Class II', 'ĐƠN VỊ TÍNH': 'Cái', 'TRẠNG THÁI': 'Đang kinh doanh' },
  { 'TÊN SẢN PHẨM': 'Đèn rọi ray 20W', 'MÃ SẢN PHẨM': 'TL-20W-4000', 'THƯƠNG HIỆU': 'Osram', 'NHÀ CUNG CẤP': 'Sun Light', 'HẠNG MỤC': 'Đèn kỹ thuật', 'DÒNG SẢN PHẨM': 'Track light', 'GIÁ BÁN LẺ': 460000, 'CHIẾT KHẤU ĐẠI LÝ (%)': 35, 'CÔNG SUẤT (W)': 20, 'NHIỆT ĐỘ MÀU (K)': 4000, 'MÀU SẮC': 'Đen', 'GÓC CHIẾU (°)': 24, 'CHẤT LIỆU': 'Nhôm', 'QUANG THÔNG (lm)': 1800, 'CHỈ SỐ IP': 'IP20', 'CRI': 'Ra90', 'LOẠI CHIP LED': 'COB', 'BẢO HÀNH (năm)': 2, 'ĐƠN VỊ TÍNH': 'Cái', 'TRẠNG THÁI': 'Đang kinh doanh' }
];

const NAVY = 'FF12315A', HEADREQ = 'FF1E63D2', GREY = 'FFF1F5FA';

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dezon QS Pro';

  // ---- Sheet 1: San pham ----
  const ws = wb.addWorksheet('San pham', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLS.map(function (c) {
    var w = Math.min(30, Math.max(12, Math.round(c[0].length * 0.95) + 4));
    return { header: c[0], key: c[0], width: w };
  });
  const head = ws.getRow(1); head.height = 34;
  COLS.forEach(function (c, i) {
    var cell = head.getCell(i + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c[1] ? HEADREQ : NAVY } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { right: { style: 'thin', color: { argb: 'FF20406B' } } };
  });
  // hàng mẫu
  SAMPLES.forEach(function (sp) {
    var arr = COLS.map(function (c) { return sp[c[0]] != null ? sp[c[0]] : ''; });
    var row = ws.addRow(arr);
    row.eachCell(function (cell) { cell.font = { size: 10, color: { argb: 'FF334155' } }; cell.alignment = { vertical: 'middle' }; });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };

  // ---- Sheet 2: Hướng dẫn ----
  const gd = wb.addWorksheet('Hướng dẫn');
  gd.columns = [{ width: 4 }, { width: 34 }, { width: 78 }];
  function line(no, k, v, opt) {
    var r = gd.addRow([no || '', k || '', v || '']);
    if (opt && opt.title) { r.getCell(2).font = { bold: true, size: 13, color: { argb: NAVY } }; r.height = 24; }
    else { r.getCell(2).font = { bold: true, size: 10.5, color: { argb: HEADREQ } }; r.getCell(3).font = { size: 10.5, color: { argb: 'FF334155' } }; r.getCell(3).alignment = { wrapText: true, vertical: 'top' }; }
    return r;
  }
  line('', 'HƯỚNG DẪN NHẬP HÀNG LOẠT — DEZON QS PRO', '', { title: 1 });
  gd.addRow([]);
  line('1', 'Điền vào sheet "San pham"', 'Mỗi dòng = 1 sản phẩm. Cột tiêu đề MÀU XANH là bắt buộc, màu xanh đậm là tuỳ chọn. Xoá 2 dòng ví dụ trước khi nhập thật.');
  line('2', 'Giá & chiết khấu', 'GIÁ BÁN LẺ nhập số (vd 208000). Giá đại lý hệ thống tự tính = Giá bán lẻ × (1 − Chiết khấu %).');
  line('3', 'Cột số', 'Công suất, quang thông, kích thước, góc chiếu… nhập số. Có thể để trống nếu chưa có.');
  line('4', 'Cột chọn', 'HẠNG MỤC: Đèn nội thất / ngoại thất / kỹ thuật. NHIỆT ĐỘ MÀU: 2700/3000/4000/5000/6500. TRẠNG THÁI: Đang kinh doanh / Ngưng / Đặt hàng. LẮP NGUỒN RỜI: Có / Không.');
  line('5', 'Ảnh sản phẩm', 'KHÔNG nhập ảnh trong file này. Sau khi tải file lên, hệ thống hiện danh sách để bạn tải ảnh (1 ảnh chính + nhiều ảnh phụ) cho từng SP rồi lưu.');
  line('6', 'Mã trùng', 'Nếu MÃ SẢN PHẨM đã tồn tại trong DB, dòng đó sẽ CẬP NHẬT (ghi đè) thay vì tạo mới.');
  line('7', 'Tải lên', 'Lưu file → vào tab "Nhập dữ liệu" → mục "Nhập hàng loạt từ file" → chọn file này.');

  const out = path.join(__dirname, '..', 'public', 'mau-nhap-hang-loat.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('Đã tạo', out, '—', COLS.length, 'cột,', SAMPLES.length, 'dòng mẫu');
}
main().catch(function (e) { console.error(e); process.exit(1); });
