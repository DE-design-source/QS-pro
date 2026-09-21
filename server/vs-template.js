'use strict';
/* File mẫu nhập hàng loạt THIẾT BỊ VỆ SINH — tạo ĐỘNG từ public/vs-spec.js
   (cùng nguồn với form Nhập dữ liệu & server) nên cột luôn khớp.
   Bố cục GIỐNG HỆT file mẫu Thiết bị đèn: 1 sheet "San pham" phẳng, tiêu đề xanh sáng = bắt buộc,
   xanh đậm = tuỳ chọn, vài dòng ví dụ (nền nhạt, chữ nghiêng) + sheet "Hướng dẫn".
   Cột HẠNG MỤC của từng dòng quyết định thông số nào được nhận (cột của hạng mục khác bị bỏ qua). */
const ExcelJS = require('exceljs');
const VS = require('../public/vs-spec.js');

const REQ = 'FF2563EB', OPT = 'FF12324C', VD_FILL = 'FFF7F9FC', VD_FONT = 'FF7B8794', LINE = 'FFE9EBEF';

// Thông số: hợp của mọi hạng mục — "Thông tin chính" trước, "Thông số thiết kế" sau (đúng thứ tự form)
function gom(k) {
  const out = [];
  VS.HANG_MUC.forEach(function (hm) { VS.HM[hm][k].forEach(function (lb) { if (out.indexOf(lb) < 0) out.push(lb); }); });
  return out;
}
// Thông số bắt buộc với ÍT NHẤT 1 hạng mục -> tô xanh sáng (chi tiết từng hạng mục ở sheet Hướng dẫn)
function batBuoc(lb) { return VS.HANG_MUC.some(function (hm) { return VS.HM[hm].req.indexOf(lb) >= 0; }); }

function cotMau() {
  const metric = gom('chinh'); gom('tk').forEach(function (lb) { if (metric.indexOf(lb) < 0) metric.push(lb); });
  return [
    ['THƯƠNG HIỆU', 1, 14], ['NHÀ CUNG CẤP', 1, 14], ['HẠNG MỤC', 1, 16], ['DÒNG SẢN PHẨM', 1, 18],
    ['TÊN SẢN PHẨM', 1, 34], ['MÃ SẢN PHẨM', 1, 16], ['GIÁ BÁN LẺ', 1, 13], ['CHIẾT KHẤU ĐẠI LÝ (%)', 1, 13]
  ].concat(metric.map(function (lb) {
    return [lb, batBuoc(lb) ? 1 : 0, (lb === 'KÍCH THƯỚC' || lb === 'BỒN CẦU TƯƠNG THÍCH') ? 24 : (lb === 'LƯU Ý' || lb === 'THIẾT KẾ' ? 20 : 15)];
  })).concat([
    ['TÍNH NĂNG', 0, 30], ['BẢO HÀNH (năm)', 0, 13], ['NHÓM SẢN PHẨM', 0, 13], ['ĐƠN VỊ TÍNH', 1, 13],
    ['LINK DATASHEET', 0, 20], ['TRẠNG THÁI', 0, 16], ['GHI CHÚ', 0, 22]
  ]);
}

// Dòng ví dụ: 1 dòng / hạng mục + 1 biến thể (cùng mã, khác màu) để minh hoạ quy tắc biến thể
function dongMau() {
  const rows = [];
  VS.HANG_MUC.forEach(function (hm) {
    const r = Object.assign({ 'THƯƠNG HIỆU': 'TOTO', 'NHÀ CUNG CẤP': 'Công ty ABC', 'HẠNG MỤC': hm,
      'CHIẾT KHẤU ĐẠI LÝ (%)': 30, 'BẢO HÀNH (năm)': 2, 'TRẠNG THÁI': 'Đang kinh doanh' }, VS.HM[hm].mau);
    rows.push(r);
    if (hm === 'Bồn cầu') rows.push(Object.assign({}, r, { 'MÀU SẮC': 'Đen mờ', 'GIÁ BÁN LẺ': 13900000 }));
  });
  return rows;
}

async function buildVsTemplate() {
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
  t.value = 'HƯỚNG DẪN NHẬP HÀNG LOẠT — THIẾT BỊ VỆ SINH — DEZON QS PRO';
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
  line('Điền vào sheet "San pham"', 'Mỗi dòng = 1 sản phẩm. Tiêu đề XANH SÁNG là bắt buộc, xanh đậm là tuỳ chọn. Xoá ' + soVD + ' dòng ví dụ trước khi nhập thật.', 32);
  line('Hạng mục (quan trọng)', 'Cột HẠNG MỤC phải là 1 trong: ' + VS.HANG_MUC.join(' / ') + '. Hạng mục quyết định thông số nào được nhận — mỗi dòng CHỈ điền thông số của hạng mục đó (bảng cuối sheet); cột của hạng mục khác để trống, có điền cũng bị bỏ qua.');
  line('Thông số bắt buộc', 'Cột thông số tô xanh sáng là bắt buộc với MỘT SỐ hạng mục (dấu * ở bảng cuối sheet). Dòng thiếu thông số bắt buộc của hạng mục mình sẽ KHÔNG được nhập và bị báo lỗi kèm tên sản phẩm.');
  line('Giá & chiết khấu', 'GIÁ BÁN LẺ nhập số (vd 12500000). Giá đại lý hệ thống TỰ TÍNH = Giá bán lẻ × (1 − Chiết khấu %). Không cần nhập cột Giá đại lý.');
  line('BIẾN THỂ', 'Cùng MÃ SẢN PHẨM nhưng khác MÀU SẮC / KÍCH THƯỚC = các SẢN PHẨM RIÊNG. Mỗi biến thể viết 1 DÒNG (xem 2 dòng ví dụ MS885DT8: Trắng và Đen mờ).');
  line('Ghi đè hay tạo mới?', 'Trùng CẢ 3 yếu tố (mã + màu sắc + kích thước) → CẬP NHẬT dòng cũ. Khác màu hoặc kích thước → TẠO SẢN PHẨM MỚI.', 32);
  line('Thông số — nhập chữ', 'Kích thước ghi "L580 x W380 x H335 (mm)" hoặc "Ø420 x H155 (mm)"; lượng nước xả "4.8/3L"; áp lực "0.05 ~ 0.75 MPa"; lưu lượng "6 L/phút". Không bắt buộc phải là số.');
  line('Cột số', 'GIÁ BÁN LẺ, CHIẾT KHẤU ĐẠI LÝ (%), BẢO HÀNH (năm) nhập SỐ. Để trống nếu chưa có.', 32);
  line('Tính năng', 'Mỗi tính năng 1 dòng trong cùng ô (Alt+Enter để xuống dòng), vd "• Rửa vệ sinh" ↵ "• Sấy khô".', 32);
  line('Cột chọn', 'TRẠNG THÁI: Đang kinh doanh / Ngưng kinh doanh / Đặt hàng. ĐƠN VỊ TÍNH: Cái / Bộ / Chiếc. Gợi ý giá trị cho từng thông số: xem bảng cuối sheet.', 32);
  line('Ảnh sản phẩm', 'KHÔNG nhập ảnh trong file này. Sau khi tải file lên, hệ thống hiện danh sách để bạn tải ảnh (1 ảnh đại diện + nhiều ảnh chi tiết) cho từng SP rồi lưu.');
  line('Tải lên', 'Lưu file → tab "Nhập dữ liệu" → chọn ngành "Thiết bị vệ sinh" → mục "Nhập hàng loạt từ file" → chọn file này.', 32);

  // Bảng thông số theo hạng mục
  gd.addRow([]);
  const h2 = gd.addRow(['', 'THÔNG SỐ THEO HẠNG MỤC', '(* = bắt buộc · trong ngoặc = giá trị gợi ý)']);
  h2.height = 24;
  h2.getCell(2).font = { bold: true, color: { argb: OPT }, size: 12, name: 'Calibri' };
  h2.getCell(3).font = { italic: true, color: { argb: VD_FONT }, size: 10, name: 'Calibri' };
  h2.getCell(3).alignment = { vertical: 'middle' };
  VS.HANG_MUC.forEach(function (hm) {
    const h = VS.HM[hm];
    const ten = function (lb) {
      const o = h.opt[lb];
      return VS.METRIC[lb][1] + (h.req.indexOf(lb) >= 0 ? '*' : '') + (o && o.length ? ' (' + o.join(' / ') + ')' : '');
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

module.exports = { buildVsTemplate: buildVsTemplate, cotMau: cotMau };
