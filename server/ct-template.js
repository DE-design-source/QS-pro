"use strict";
/* File mẫu nhập hàng loạt CÔNG TẮC - Ổ CẮM — tạo ĐỘNG từ public/ct-spec.js (cùng nguồn với form Nhập dữ liệu & server)
   nên cột luôn khớp. Bố cục như file mẫu Sơn nước: 1 sheet "San pham" phẳng (tiêu đề xanh sáng = bắt buộc,
   xanh đậm = tuỳ chọn, dòng ví dụ chữ nghiêng) + sheet "Hướng dẫn".
   hm = 1 hạng mục -> chỉ có thông số của module đó (ổ cắm / công tắc); bỏ trống -> gộp cả 2 module. */
const ExcelJS = require('exceljs');
const CT = require('../public/ct-spec.js');
const REQ = 'FF2563EB', OPT = 'FF12324C', VD_FILL = 'FFF7F9FC', VD_FONT = 'FF7B8794', LINE = 'FFE9EBEF';

function dsHM(hm) { return hm ? [hm] : CT.HANG_MUC; }
function batBuoc(lb, hm) { return dsHM(hm).some(function (h) { return CT.HM[h].req.indexOf(lb) >= 0; }); }
function cotMau(hm) {
  const metric = hm ? CT.HM[hm].chinh.concat(CT.HM[hm].tk) : CT.CHINH_ALL.concat(CT.TK_ALL);
  return [
    ['THƯƠNG HIỆU', 1, 14], ['NHÀ CUNG CẤP', 1, 14], ['HẠNG MỤC', 1, 20], ['DÒNG SẢN PHẨM', 1, 22],
    ['TÊN SẢN PHẨM', 1, 34], ['MÃ SẢN PHẨM', 1, 20], ['GIÁ BÁN LẺ', 1, 13], ['CHIẾT KHẤU ĐẠI LÝ (%)', 1, 13]
  ].concat(metric.map(function (lb) { return [lb, batBuoc(lb, hm) ? 1 : 0, CT.METRIC[lb][2] === 'sel' ? 20 : 16]; })).concat([
    ['TÍNH NĂNG', 0, 30], ['BẢO HÀNH (năm)', 0, 13], ['NHÓM SẢN PHẨM', 0, 13], ['ĐƠN VỊ TÍNH', 1, 13],
    ['LINK DATASHEET', 0, 20], ['THÔNG SỐ KỸ THUẬT', 0, 20], ['HƯỚNG DẪN CÀI ĐẶT', 0, 20], ['FILE BẢN VẼ', 0, 20],
    ['TRẠNG THÁI', 0, 16], ['GHI CHÚ', 0, 22]
  ]);
}
function dongMau(hm) {
  const mk = function (h, them) {
    return Object.assign({ 'THƯƠNG HIỆU': 'Panasonic', 'NHÀ CUNG CẤP': 'Công ty ABC', 'HẠNG MỤC': h,
      'CHIẾT KHẤU ĐẠI LÝ (%)': 25, 'BẢO HÀNH (năm)': 2, 'TRẠNG THÁI': 'Đang kinh doanh' }, CT.HM[h].mau, them || {});
  };
  const ds = hm ? [mk(hm), mk(hm, { 'MÀU SẮC': 'Đen', 'GIÁ BÁN LẺ': (CT.HM[hm].mau['GIÁ BÁN LẺ'] || 0) + 20000 })]
    : [mk('Ổ cắm điện'), mk('Công tắc cơ'), mk('Công tắc thông minh')];
  // Tên bắt đầu "[VÍ DỤ]" -> hệ thống TỰ BỎ QUA khi nhập
  return ds.map(function (r) { r['TÊN SẢN PHẨM'] = CT.VD + ' ' + r['TÊN SẢN PHẨM']; return r; });
}
async function buildCtTemplate(hangMuc) {
  const hm = CT.chuanHM(hangMuc) || '';
  const wb = new ExcelJS.Workbook(); wb.creator = 'Dezon QS Pro';
  const cols = cotMau(hm);
  const bien = { left: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } },
    top: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } } };
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
  dongMau(hm).forEach(function (sp) {
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
  gd.columns = [{ width: 5 }, { width: 30 }, { width: 110 }];
  gd.mergeCells('A1:C1');
  const t = gd.getCell('A1');
  t.value = 'HƯỚNG DẪN NHẬP HÀNG LOẠT — CÔNG TẮC - Ổ CẮM' + (hm ? (' · ' + hm.toUpperCase()) : '') + ' — DEZON QS PRO';
  t.font = { bold: true, color: { argb: OPT }, size: 14, name: 'Calibri' }; gd.getRow(1).height = 28; gd.addRow([]);
  let no = 0;
  function line(k, v, h) {
    const r = gd.addRow([String(++no), k, v]); r.height = h || 40;
    r.getCell(1).font = { bold: true, color: { argb: REQ }, size: 10, name: 'Calibri' };
    r.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
    r.getCell(2).font = { bold: true, color: { argb: OPT }, size: 10, name: 'Calibri' };
    r.getCell(2).alignment = { vertical: 'top', wrapText: true };
    r.getCell(3).font = { color: { argb: 'FF4A5563' }, size: 10, name: 'Calibri' };
    r.getCell(3).alignment = { vertical: 'top', wrapText: true };
  }
  line('Điền vào sheet "San pham"', 'Mỗi dòng = 1 sản phẩm (1 mã). Tiêu đề XANH SÁNG là bắt buộc, xanh đậm là tuỳ chọn. Các dòng ví dụ (chữ nghiêng, tên bắt đầu "' + CT.VD + '") được hệ thống TỰ BỎ QUA khi nhập.');
  line('Hạng mục (quan trọng)', hm
    ? ('File này dành RIÊNG cho hạng mục "' + hm + '". Giữ nguyên cột HẠNG MỤC; muốn nhập hạng mục khác thì tải file mẫu của hạng mục đó.')
    : ('Cột HẠNG MỤC phải là 1 trong: ' + CT.HANG_MUC.join(' / ') + '. Hạng mục quyết định thông số nào được nhận (ổ cắm và công tắc có bộ thông số khác nhau) — cột của module kia bị bỏ qua.'), 58);
  line('Hãng bán rời mặt / hạt / đế', 'Mỗi cấu kiện là 1 MÃ riêng (1 dòng), cột LOẠI CẤU KIỆN ghi rõ: ' + CT.OPT['LOẠI CẤU KIỆN'].join(' / ') + '.');
  line('Giá & chiết khấu', 'GIÁ BÁN LẺ nhập số (vd 185000). Giá đại lý hệ thống TỰ TÍNH = Giá bán lẻ × (1 − Chiết khấu %).', 30);
  line('Biến thể (màu)', 'Cùng MÃ SẢN PHẨM nhưng khác MÀU SẮC = các sản phẩm riêng, mỗi màu 1 dòng. Trùng cả mã + màu → CẬP NHẬT dòng cũ.', 30);
  line('Cột Có / Không', 'CÓ MÀN CHE AN TOÀN, TÍCH HỢP THÔNG MINH: ghi "Có" hoặc "Không".', 28);
  line('Kích thước mặt', 'Nhập riêng 3 cột CHIỀU RỘNG / CHIỀU CAO / ĐỘ DÀY (mm) — bảng bóc tách tự ghép thành "R x C x D mm".', 30);
  line('Ảnh sản phẩm', 'KHÔNG nhập ảnh trong file này. Sau khi tải file lên, hệ thống hiện danh sách để tải ảnh cho từng sản phẩm rồi lưu.', 30);
  line('Tải lên', 'Lưu file → tab "Nhập dữ liệu" → chọn ngành "Công tắc - ổ cắm" → mục "Nhập hàng loạt từ file" → chọn file này.', 28);
  gd.addRow([]);
  const h2 = gd.addRow(['', 'THÔNG SỐ THEO MODULE', '(* = bắt buộc · trong ngoặc = giá trị được chọn)']); h2.height = 24;
  h2.getCell(2).font = { bold: true, color: { argb: OPT }, size: 12, name: 'Calibri' };
  h2.getCell(3).font = { italic: true, color: { argb: VD_FONT }, size: 10, name: 'Calibri' };
  const daIn = {};
  dsHM(hm).forEach(function (x) {
    const h = CT.HM[x]; if (daIn[h.loai]) return; daIn[h.loai] = 1;       // các hạng mục cùng module dùng chung 1 bộ thông số
    const ten = function (lb) { const o = h.opt[lb]; return CT.METRIC[lb][1] + (h.req.indexOf(lb) >= 0 ? '*' : '') + (o && o.length ? ' (' + o.join(' / ') + ')' : ''); };
    const txt = 'Thông tin chính: ' + h.nhom.chinh.map(ten).join(' · ') + '\nĐiện & an toàn: ' + h.nhom.dien.map(ten).join(' · ')
      + '\n' + h.nhom.tenTm + ': ' + h.nhom.tm.map(ten).join(' · ') + '\nLắp đặt: ' + h.nhom.lap.map(ten).join(' · ');
    const r = gd.addRow(['', hm || (h.loai === 'oc' ? 'Module Ổ CẮM' : 'Module CÔNG TẮC'), txt]);
    r.height = Math.max(60, 15 * Math.ceil(txt.length / 100) + 30);
    r.getCell(2).font = { bold: true, color: { argb: REQ }, size: 10, name: 'Calibri' }; r.getCell(2).alignment = { vertical: 'top', wrapText: true };
    r.getCell(3).font = { color: { argb: 'FF4A5563' }, size: 10, name: 'Calibri' }; r.getCell(3).alignment = { vertical: 'top', wrapText: true };
  });
  return wb.xlsx.writeBuffer();
}
module.exports = { buildCtTemplate: buildCtTemplate, cotMau: cotMau };
