'use strict';
const { getProducts } = require('../san-pham/san-pham.repository');
const { DB_LABEL2COL } = require('../san-pham/san-pham.mapper');

// ═══ XUẤT EXCEL DANH SÁCH SẢN PHẨM ═══
// Cột lấy đúng theo DB_LABEL2COL (cùng bộ nhãn với file mẫu nhập hàng loạt),
// nhờ vậy file tải về có thể sửa rồi nạp ngược lại bằng chức năng Nhập dữ liệu.
async function exportProductsXlsx(keys) {
  const ExcelJS = require('exceljs');
  const rows = await getProducts();
  let ds = rows;
  if (Array.isArray(keys) && keys.length) {
    const set = {}; keys.forEach(function (k) { set[String(k)] = 1; });
    ds = rows.filter(function (p) { return set[String(p.recordId)] || set[String(p.ma)]; });
  }
  const nhan = Object.keys(DB_LABEL2COL || {}).filter(function (l) { return l !== 'ẢNH SẢN PHẨM'; });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dezon Pro'; wb.created = new Date();
  const ws = wb.addWorksheet('Danh sách sản phẩm');
  ws.columns = [{ header: 'STT', key: '_stt', width: 6 }]
    .concat(nhan.map(function (l) { return { header: l, key: l, width: Math.min(34, Math.max(12, l.length + 4)) }; }))
    .concat([{ header: 'ẢNH SẢN PHẨM', key: '_anh', width: 40 }]);
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12324C' } };
  h.alignment = { vertical: 'middle', wrapText: true };
  h.height = 30;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ds.forEach(function (p, i) {
    const raw = p.raw || {};
    const o = { _stt: i + 1, _anh: p.anhTatCa || p.hinhAnh || '' };
    nhan.forEach(function (l) {
      const col = DB_LABEL2COL[l];
      let v = raw[col];
      if (v == null || v === '') v = '';
      o[l] = v;
    });
    ws.addRow(o);
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  const buf = await wb.xlsx.writeBuffer();
  return { name: 'danh-sach-san-pham-' + new Date().toISOString().slice(0, 10) + '.xlsx', count: ds.length, buf: buf };
}
/* Xuất danh sách CÔNG TÁC xây dựng (Phần thô) ra Excel.
   Thư viện công tác nằm ở client (PT_TEMPLATE + phần người dùng sửa), nên client gửi
   thẳng các dòng đang xem — server chỉ dựng file cho đúng định dạng.                */
const CT_COLS = [
  ['stt', 'STT', 6], ['loai', 'LOẠI BÁO GIÁ', 20], ['hangMuc', 'HẠNG MỤC', 30],
  ['noiDung', 'NỘI DUNG CÔNG VIỆC', 52], ['dvt', 'ĐVT', 9],
  ['khoiLuong', 'KHỐI LƯỢNG', 13], ['dienTich', 'DIỆN TÍCH', 12], ['heSo', 'HỆ SỐ', 9],
  ['dgnt', 'ĐƠN GIÁ (NHÀ THẦU)', 20], ['dg', 'ĐƠN GIÁ', 16], ['ghiChu', 'GHI CHÚ', 46]
];
async function exportCongTacXlsx(rows) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dezon Pro';
  const ws = wb.addWorksheet('Cong tac xay dung', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = CT_COLS.map(c => ({ header: c[1], key: c[0], width: c[2] }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  head.height = 30;
  head.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14304F' } }; });
  (rows || []).forEach(function (r) {
    const row = ws.addRow({
      stt: r.stt, loai: r.loai || '', hangMuc: r.hangMuc || '', noiDung: r.noiDung || '',
      dvt: r.dvt || '', khoiLuong: r.khoiLuong === '' ? null : Number(r.khoiLuong) || null,
      dienTich: r.dienTich === '' ? null : Number(r.dienTich) || null,
      heSo: r.heSo === '' ? null : Number(r.heSo) || null,
      dgnt: r.dgnt === '' ? null : Number(r.dgnt) || null,
      dg: r.dg === '' ? null : Number(r.dg) || null, ghiChu: r.ghiChu || ''
    });
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell('stt').alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell('dvt').alignment = { vertical: 'top', horizontal: 'center' };
    ['dgnt', 'dg'].forEach(k => { row.getCell(k).numFmt = '#,##0'; });
    ['khoiLuong', 'dienTich', 'heSo'].forEach(k => { row.getCell(k).numFmt = '#,##0.##'; });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: CT_COLS.length } };
  const buf = await wb.xlsx.writeBuffer();
  return { buf, count: (rows || []).length, name: 'cong-tac-xay-dung.xlsx' };
}

module.exports = { exportProductsXlsx, exportCongTacXlsx };
