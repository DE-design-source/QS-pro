"use strict";
/* File mẫu nhập hàng loạt CÔNG TẮC - Ổ CẮM và ĐIỆN LẠNH — tạo ĐỘNG từ public/ct-spec.js / dl-spec.js (cùng nguồn với
   form Nhập dữ liệu & server) nên cột luôn khớp. Bố cục như file mẫu Sơn nước: 1 sheet "San pham" phẳng (tiêu đề xanh sáng = bắt buộc,
   xanh đậm = tuỳ chọn, dòng ví dụ chữ nghiêng) + sheet "Hướng dẫn".
   hm = 1 hạng mục -> chỉ có thông số của module đó (ổ cắm / công tắc); bỏ trống -> gộp cả 2 module. */
const ExcelJS = require('exceljs');
const CT = require('../public/ct-spec.js'), DL = require('../public/dl-spec.js');
let SP = CT;          // bộ thông số của file đang tạo — đặt ở đầu buildSpec_ và chỉ dùng ĐỒNG BỘ trước lần await duy nhất (writeBuffer) nên 2 request song song không lẫn
const REQ = 'FF2563EB', OPT = 'FF12324C', VD_FILL = 'FFF7F9FC', VD_FONT = 'FF7B8794', LINE = 'FFE9EBEF';

function dsHM(hm) { return hm ? [hm] : SP.HANG_MUC; }
function batBuoc(lb, hm) { return dsHM(hm).some(function (h) { return SP.HM[h].req.indexOf(lb) >= 0; }); }
function cotMau(hm) {
  const metric = hm ? SP.HM[hm].chinh.concat(SP.HM[hm].tk) : SP.CHINH_ALL.concat(SP.TK_ALL);
  return [
    ['THƯƠNG HIỆU', 1, 14], ['NHÀ CUNG CẤP', 1, 14], ['HẠNG MỤC', 1, 20], ['DÒNG SẢN PHẨM', 1, 22],
    ['TÊN SẢN PHẨM', 1, 34], ['MÃ SẢN PHẨM', 1, 20], ['GIÁ BÁN LẺ', 1, 13], ['CHIẾT KHẤU ĐẠI LÝ (%)', 1, 13]
  ].concat(metric.map(function (lb) { return [lb, batBuoc(lb, hm) ? 1 : 0, SP.METRIC[lb][2] === 'sel' ? 20 : 16]; })).concat([
    ['TÍNH NĂNG', 0, 30], ['BẢO HÀNH (năm)', 0, 13], ['NHÓM SẢN PHẨM', 0, 13], ['ĐƠN VỊ TÍNH', 1, 13],
    ['LINK DATASHEET', 0, 20], ['THÔNG SỐ KỸ THUẬT', 0, 20], ['HƯỚNG DẪN CÀI ĐẶT', 0, 20], ['FILE BẢN VẼ', 0, 20],
    ['TRẠNG THÁI', 0, 16], ['GHI CHÚ', 0, 22]
  ]);
}
function dongMau(hm) {
  const mk = function (h, them) {
    return Object.assign({ 'THƯƠNG HIỆU': 'Panasonic', 'NHÀ CUNG CẤP': 'Công ty ABC', 'HẠNG MỤC': h,
      'CHIẾT KHẤU ĐẠI LÝ (%)': 25, 'BẢO HÀNH (năm)': 2, 'TRẠNG THÁI': 'Đang kinh doanh' }, SP.HM[h].mau, them || {});
  };
  const ds = hm ? [mk(hm), mk(hm, Object.assign({ 'GIÁ BÁN LẺ': (SP.HM[hm].mau['GIÁ BÁN LẺ'] || 0) + 20000 }, CFG.vd2))]
    : CFG.vdHM.map(function (h) { return mk(h); });
  // Tên bắt đầu "[VÍ DỤ]" -> hệ thống TỰ BỎ QUA khi nhập
  return ds.map(function (r) { r['TÊN SẢN PHẨM'] = SP.VD + ' ' + r['TÊN SẢN PHẨM']; return r; });
}
let CFG = null;
async function buildSpec_(spec, cfg, hangMuc) {
  SP = spec; CFG = cfg;
  const hm = SP.chuanHM(hangMuc) || '';
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
  t.value = 'HƯỚNG DẪN NHẬP HÀNG LOẠT — ' + CFG.ten + (hm ? (' · ' + hm.toUpperCase()) : '') + ' — DEZON QS PRO';
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
  line('Điền vào sheet "San pham"', 'Mỗi dòng = 1 sản phẩm (1 mã). Tiêu đề XANH SÁNG là bắt buộc, xanh đậm là tuỳ chọn. Các dòng ví dụ (chữ nghiêng, tên bắt đầu "' + SP.VD + '") được hệ thống TỰ BỎ QUA khi nhập.');
  line('Hạng mục (quan trọng)', hm
    ? ('File này dành RIÊNG cho hạng mục "' + hm + '". Giữ nguyên cột HẠNG MỤC; muốn nhập hạng mục khác thì tải file mẫu của hạng mục đó.')
    : ('Cột HẠNG MỤC phải là 1 trong: ' + SP.HANG_MUC.join(' / ') + '. ' + CFG.hmNote), 58);
  CFG.them.forEach(function (x) { line(x[0], x[1], x[2]); });
  line('Ảnh sản phẩm', 'KHÔNG nhập ảnh trong file này. Sau khi tải file lên, hệ thống hiện danh sách để tải ảnh cho từng sản phẩm rồi lưu.', 30);
  line('Tải lên', 'Lưu file → tab "Nhập dữ liệu" → chọn ngành "' + CFG.nganhUi + '" → mục "Nhập hàng loạt từ file" → chọn file này.', 28);
  gd.addRow([]);
  const h2 = gd.addRow(['', 'THÔNG SỐ THEO MODULE', '(* = bắt buộc · trong ngoặc = giá trị được chọn)']); h2.height = 24;
  h2.getCell(2).font = { bold: true, color: { argb: OPT }, size: 12, name: 'Calibri' };
  h2.getCell(3).font = { italic: true, color: { argb: VD_FONT }, size: 10, name: 'Calibri' };
  const daIn = {};
  dsHM(hm).forEach(function (x) {
    const h = SP.HM[x]; if (daIn[h.loai]) return; daIn[h.loai] = 1;       // các hạng mục cùng module dùng chung 1 bộ thông số
    const ten = function (lb) { const o = h.opt[lb]; return SP.METRIC[lb][1] + (h.req.indexOf(lb) >= 0 ? '*' : '') + (o && o.length ? ' (' + o.join(' / ') + ')' : ''); };
    const txt = CFG.khoi.filter(function (k) { return h.nhom[k[0]].length; })
      .map(function (k) { return (typeof k[1] === 'function' ? k[1](h) : k[1]) + ': ' + h.nhom[k[0]].map(ten).join(' · '); }).join('\n');
    const r = gd.addRow(['', hm || CFG.module[h.loai], txt]);
    r.height = Math.max(60, 15 * Math.ceil(txt.length / 100) + 30);
    r.getCell(2).font = { bold: true, color: { argb: REQ }, size: 10, name: 'Calibri' }; r.getCell(2).alignment = { vertical: 'top', wrapText: true };
    r.getCell(3).font = { color: { argb: 'FF4A5563' }, size: 10, name: 'Calibri' }; r.getCell(3).alignment = { vertical: 'top', wrapText: true };
  });
  return wb.xlsx.writeBuffer();
}
const CFG_CT = { ten: 'CÔNG TẮC - Ổ CẮM', nganhUi: 'Công tắc - ổ cắm', vdHM: ['Ổ cắm điện', 'Công tắc cơ', 'Công tắc thông minh'], vd2: { 'MÀU SẮC': 'Đen' },
  hmNote: 'Hạng mục quyết định thông số nào được nhận (ổ cắm và công tắc có bộ thông số khác nhau) — cột của module kia bị bỏ qua.',
  module: { oc: 'Module Ổ CẮM', ct: 'Module CÔNG TẮC' },
  khoi: [['chinh', 'Thông tin chính'], ['dien', 'Điện & an toàn'], ['tm', function (h) { return h.nhom.tenTm; }], ['lap', 'Lắp đặt']],
  them: [
    ['Hãng bán rời mặt / hạt / đế', 'Mỗi cấu kiện là 1 MÃ riêng (1 dòng), cột LOẠI CẤU KIỆN ghi rõ: ' + CT.OPT['LOẠI CẤU KIỆN'].join(' / ') + '.'],
    ['Giá & chiết khấu', 'GIÁ BÁN LẺ nhập số (vd 185000). Giá đại lý hệ thống TỰ TÍNH = Giá bán lẻ × (1 − Chiết khấu %).', 30],
    ['Biến thể (màu)', 'Cùng MÃ SẢN PHẨM nhưng khác MÀU SẮC = các sản phẩm riêng, mỗi màu 1 dòng. Trùng cả mã + màu → CẬP NHẬT dòng cũ.', 30],
    ['Cột Có / Không', 'CÓ MÀN CHE AN TOÀN, TÍCH HỢP THÔNG MINH: ghi "Có" hoặc "Không".', 28],
    ['Kích thước mặt', 'Nhập riêng 3 cột CHIỀU RỘNG / CHIỀU CAO / ĐỘ DÀY (mm) — bảng bóc tách tự ghép thành "R x C x D mm".', 30]] };
const CFG_DL = { ten: 'ĐIỆN LẠNH', nganhUi: 'Điện lạnh', vdHM: ['Điều hoà không khí', 'Ống đồng dẫn gas', 'Quạt hút / thông gió'], vd2: {},
  hmNote: 'Hạng mục "Điều hoà không khí" có đủ 4 khối thông số; các hạng mục vật tư / phụ kiện / thông gió chỉ có Quy cách và Xuất xứ — cột không thuộc hạng mục bị bỏ qua.',
  module: { may: 'THIẾT BỊ CHÍNH (điều hoà)', vt: 'VẬT TƯ · PHỤ KIỆN · THÔNG GIÓ' },
  khoi: DL.KHOI.map(function (k) { return [k[0], k[1].split('|')[1]]; }),
  them: [
    ['Giá & chiết khấu', 'GIÁ BÁN LẺ nhập số (vd 21900000). Giá đại lý hệ thống TỰ TÍNH = Giá bán lẻ × (1 − Chiết khấu %).', 30],
    ['Đơn vị tính', 'Thiết bị: Bộ / Cái. Ống đồng, cách nhiệt, ống thoát nước, dây điện, ống gió: m. Vật tư phụ: Lô / Gói.', 30],
    ['Công suất', 'Điều hoà bắt buộc LOẠI MÁY và CÔNG SUẤT (HP). Công suất lạnh ghi kW (vd 5.6), BTU/h nếu có.', 30],
    ['Biến thể', 'Mỗi model (mỗi MÃ SẢN PHẨM) là 1 dòng. Trùng mã → CẬP NHẬT dòng cũ.', 28]] };
const buildCtTemplate = function (hm) { return buildSpec_(CT, CFG_CT, hm); };
const buildDlTemplate = function (hm) { return buildSpec_(DL, CFG_DL, hm); };
module.exports = { buildCtTemplate: buildCtTemplate, buildDlTemplate: buildDlTemplate, cotMau: cotMau };
