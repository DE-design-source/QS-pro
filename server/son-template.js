'use strict';
/* File mẫu nhập hàng loạt SƠN NƯỚC — tạo ĐỘNG từ public/son-spec.js
   (cùng nguồn với form Nhập dữ liệu & server) nên cột luôn khớp.
   Bố cục GIỐNG HỆT file mẫu Thiết bị đèn: 1 sheet "San pham" phẳng, tiêu đề xanh sáng = bắt buộc,
   xanh đậm = tuỳ chọn, vài dòng ví dụ (nền nhạt, chữ nghiêng) + sheet "Hướng dẫn".
   Cột HẠNG MỤC của từng dòng quyết định thông số nào được nhận (cột của hạng mục khác bị bỏ qua). */
const ExcelJS = require('exceljs');
const SON = require('../public/son-spec.js');

const REQ = 'FF2563EB', OPT = 'FF12324C', VD_FILL = 'FFF7F9FC', VD_FONT = 'FF7B8794', LINE = 'FFE9EBEF';

// Thông số bắt buộc với ÍT NHẤT 1 hạng mục -> tô xanh sáng (chi tiết từng hạng mục ở sheet Hướng dẫn)
function batBuoc(lb) { return SON.HANG_MUC.some(function (hm) { return SON.HM[hm].req.indexOf(lb) >= 0; }); }

function cotMau() {
  const metric = SON.CHINH_ALL.concat(SON.TK_ALL);   // "Thông tin chính" trước, "Thông số thiết kế" sau (đúng thứ tự form)
  return [
    ['THƯƠNG HIỆU', 1, 14], ['NHÀ CUNG CẤP', 1, 14], ['HẠNG MỤC', 1, 16], ['DÒNG SẢN PHẨM', 1, 18],
    ['TÊN SẢN PHẨM', 1, 34], ['MÃ SẢN PHẨM', 1, 16], ['GIÁ BÁN LẺ', 1, 13], ['CHIẾT KHẤU ĐẠI LÝ (%)', 1, 13]
  ].concat(metric.map(function (lb) {
    return [lb, batBuoc(lb) ? 1 : 0, (lb === 'ĐỘ PHỦ' || lb === 'ĐIỂM BÙNG CHÁY' || lb === 'TÍNH DẺO') ? 26 : (lb === 'LƯU Ý' || lb === 'GIỚI HẠN NỔ' || lb === 'THỜI GIAN KHÔ' ? 20 : 15)];
  })).concat([
    ['TÍNH NĂNG', 0, 30], ['BẢO HÀNH (năm)', 0, 13], ['NHÓM SẢN PHẨM', 0, 13], ['ĐƠN VỊ TÍNH', 1, 13],
    ['LINK DATASHEET', 0, 20], ['THÔNG SỐ KỸ THUẬT', 0, 20], ['HƯỚNG DẪN CÀI ĐẶT', 0, 20], ['FILE BẢN VẼ', 0, 20],
    ['TRẠNG THÁI', 0, 16], ['GHI CHÚ', 0, 22]
  ]);
}

// Dòng ví dụ: 3 dòng như file mẫu đèn — 1 dòng sơn ngoại thất + 1 quy cách khác (cùng mã) + 1 sơn lót
function dongMau() {
  const mk = function (hm, them) {
    return Object.assign({ 'THƯƠNG HIỆU': 'Dulux', 'NHÀ CUNG CẤP': 'Công ty ABC', 'HẠNG MỤC': hm,
      'CHIẾT KHẤU ĐẠI LÝ (%)': 25, 'TRẠNG THÁI': 'Đang kinh doanh' }, SON.HM[hm].mau, them || {});
  };
  // Tên bắt đầu "[VÍ DỤ]" -> hệ thống TỰ BỎ QUA khi nhập (quên xoá cũng không thành sản phẩm thật)
  return [mk('Sơn ngoại thất'), mk('Sơn ngoại thất', { 'KÍCH THƯỚC': '5L', 'GIÁ BÁN LẺ': 890000 }), mk('Sơn lót')]
    .map(function (r) { r['TÊN SẢN PHẨM'] = SON.VD + ' ' + r['TÊN SẢN PHẨM']; return r; });
}

async function buildSonTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dezon QS Pro';
  const cols = cotMau();
  const bien = { left: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } },
    top: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } } };

  // ---- Sheet 1: San pham ----
  const ws = wb.addWorksheet('San pham', { views: [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A1' }] });
  ws.columns = cols.map(function (c) { return { header: c[0], key: c[0], width: c[2] }; });
  const head = ws.getRow(1); head.height = 34;
  cols.forEach(function (c, i) {
    const cell = head.getCell(i + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c[1] ? REQ : OPT } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = bien;
  });
  dongMau().forEach(function (sp) {
    const row = ws.addRow(cols.map(function (c) { return sp[c[0]] != null ? sp[c[0]] : null; }));
    for (let i = 1; i <= cols.length; i++) {
      const cell = row.getCell(i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VD_FILL } };
      cell.font = { italic: true, color: { argb: VD_FONT }, size: 10, name: 'Calibri' };
      cell.border = bien;
    }
  });

  // ---- Sheet 2: Hướng dẫn ----
  const gd = wb.addWorksheet('Hướng dẫn');
  gd.columns = [{ width: 5 }, { width: 26 }, { width: 104 }];
  gd.mergeCells('A1:C1');
  const t = gd.getCell('A1');
  t.value = 'HƯỚNG DẪN NHẬP HÀNG LOẠT — SƠN NƯỚC — DEZON QS PRO';
  t.font = { bold: true, color: { argb: OPT }, size: 14, name: 'Calibri' };
  gd.getRow(1).height = 28;
  gd.addRow([]);
  let no = 0;
  function line(k, v, h) {
    const r = gd.addRow([String(++no), k, v]); r.height = h || 46;
    r.getCell(1).font = { bold: true, color: { argb: REQ }, size: 10, name: 'Calibri' };
    r.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
    r.getCell(2).font = { bold: true, color: { argb: OPT }, size: 10, name: 'Calibri' };
    r.getCell(2).alignment = { vertical: 'top', wrapText: true };
    r.getCell(3).font = { color: { argb: 'FF4A5563' }, size: 10, name: 'Calibri' };
    r.getCell(3).alignment = { vertical: 'top', wrapText: true };
  }
  const soVD = dongMau().length;
  line('Điền vào sheet "San pham"', 'Mỗi dòng = 1 sản phẩm. Tiêu đề XANH SÁNG là bắt buộc, xanh đậm là tuỳ chọn. ' + soVD + ' dòng ví dụ (chữ nghiêng, tên bắt đầu "' + SON.VD + '") được hệ thống TỰ BỎ QUA khi nhập — có thể xoá hoặc để nguyên.', 46);
  line('Hạng mục (quan trọng)', 'Cột HẠNG MỤC phải là 1 trong: ' + SON.HANG_MUC.join(' / ') + '. Hạng mục quyết định thông số nào được nhận — mỗi dòng CHỈ điền thông số của hạng mục đó (bảng cuối sheet); cột của hạng mục khác để trống, có điền cũng bị bỏ qua.');
  line('Thông số bắt buộc', 'Cột thông số tô xanh sáng là bắt buộc với MỘT SỐ hạng mục (dấu * ở bảng cuối sheet). Dòng thiếu thông số bắt buộc của hạng mục mình sẽ KHÔNG được nhập và bị báo lỗi kèm tên sản phẩm.');
  line('Giá & chiết khấu', 'GIÁ BÁN LẺ nhập số (vd 12500000). Giá đại lý hệ thống TỰ TÍNH = Giá bán lẻ × (1 − Chiết khấu %). Không cần nhập cột Giá đại lý.');
  line('BIẾN THỂ (quy cách)', 'Cùng MÃ SẢN PHẨM nhưng khác QUY CÁCH / MÀU SẮC = các SẢN PHẨM RIÊNG. Mỗi quy cách viết 1 DÒNG (xem 2 dòng ví dụ cùng mã: 18L và 5L).');
  line('Ghi đè hay tạo mới?', 'Trùng CẢ 3 yếu tố (mã + màu sắc + quy cách) → CẬP NHẬT dòng cũ. Khác màu hoặc quy cách → TẠO SẢN PHẨM MỚI.', 32);
  line('Thông số — nhập chữ', 'Độ phủ ghi "Lên đến 13 m²/lít/lớp"; thời gian khô "30 phút (khô bề mặt) · 2 giờ (khô cứng)"; quy cách "18L", "40kg"; pH "9". Không bắt buộc phải là số.');
  line('Cột số', 'GIÁ BÁN LẺ, CHIẾT KHẤU ĐẠI LÝ (%) nhập SỐ. SỐ LỚP nhập 1 / 2 / 3. Để trống nếu chưa có.', 32);
  line('Tính năng sản phẩm', 'Mỗi tính năng 1 dòng trong cùng ô (Alt+Enter để xuống dòng), vd "• Chống nấm mốc" ↵ "• Chống bám bụi".', 32);
  line('Cột chọn', 'TRẠNG THÁI: Đang kinh doanh / Ngưng kinh doanh / Đặt hàng. ĐƠN VỊ TÍNH: Thùng / Lon / Bao / Bộ. Gợi ý giá trị cho từng thông số: xem bảng cuối sheet.', 32);
  line('Ảnh sản phẩm', 'KHÔNG nhập ảnh trong file này. Sau khi tải file lên, hệ thống hiện danh sách để bạn tải ảnh (1 ảnh đại diện + nhiều ảnh chi tiết) cho từng SP rồi lưu.');
  line('Tải lên', 'Lưu file → tab "Nhập dữ liệu" → chọn ngành "Sơn nước" → mục "Nhập hàng loạt từ file" → chọn file này.', 32);

  // Bảng thông số theo hạng mục
  gd.addRow([]);
  const h2 = gd.addRow(['', 'THÔNG SỐ THEO HẠNG MỤC', '(* = bắt buộc · trong ngoặc = giá trị gợi ý)']);
  h2.height = 24;
  h2.getCell(2).font = { bold: true, color: { argb: OPT }, size: 12, name: 'Calibri' };
  h2.getCell(3).font = { italic: true, color: { argb: VD_FONT }, size: 10, name: 'Calibri' };
  h2.getCell(3).alignment = { vertical: 'middle' };
  SON.HANG_MUC.forEach(function (hm) {
    const h = SON.HM[hm];
    const ten = function (lb) {
      const o = h.opt[lb];
      return SON.METRIC[lb][1] + (h.req.indexOf(lb) >= 0 ? '*' : '') + (o && o.length ? ' (' + o.join(' / ') + ')' : '');
    };
    const txt = 'Thông tin chính: ' + h.chinh.map(ten).join(' · ') + '\nThông số thiết kế: ' + h.tk.map(ten).join(' · ');
    const r = gd.addRow(['', hm, txt]);
    r.height = Math.max(46, 15 * Math.ceil(txt.length / 95) + 16);
    r.getCell(2).font = { bold: true, color: { argb: REQ }, size: 10, name: 'Calibri' };
    r.getCell(2).alignment = { vertical: 'top' };
    r.getCell(3).font = { color: { argb: 'FF4A5563' }, size: 10, name: 'Calibri' };
    r.getCell(3).alignment = { vertical: 'top', wrapText: true };
  });
  return wb.xlsx.writeBuffer();
}

module.exports = { buildSonTemplate: buildSonTemplate, cotMau: cotMau };
