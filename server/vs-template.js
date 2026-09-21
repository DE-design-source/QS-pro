'use strict';
/* File mẫu nhập hàng loạt THIẾT BỊ VỆ SINH — tạo ĐỘNG từ public/vs-spec.js
   (cùng nguồn với form Nhập dữ liệu & server) nên cột luôn khớp, không lệch như file tĩnh.
   Mỗi hạng mục = 1 sheet, chỉ gồm thông số của hạng mục đó; cột chọn có dropdown;
   dòng 2 là ví dụ (tên bắt đầu "[VÍ DỤ]") — hệ thống tự bỏ qua khi nhập.          */
const ExcelJS = require('exceljs');
const VS = require('../public/vs-spec.js');

// [nhãn cột, bắt buộc?, gợi ý]
const DAU = [
  ['THƯƠNG HIỆU', 1, 'VD: TOTO'], ['NHÀ CUNG CẤP', 1, 'VD: Công ty ABC'],
  ['HẠNG MỤC', 1, 'Để trống = lấy theo tên sheet'], ['DÒNG SẢN PHẨM', 1, 'VD: Bồn cầu treo tường'],
  ['NHÓM SẢN PHẨM', 0, 'Để trống = lấy theo Dòng sản phẩm'],
  ['TÊN SẢN PHẨM', 1, ''], ['MÃ SẢN PHẨM', 1, ''],
  ['GIÁ BÁN LẺ', 1, 'Nhập số, VD 12500000'], ['CHIẾT KHẤU ĐẠI LÝ (%)', 1, 'Nhập số 0–100, VD 35']
];
const CUOI = [
  ['TÍNH NĂNG', 0, 'Mỗi dòng 1 tính năng (Alt+Enter để xuống dòng)'],
  ['BẢO HÀNH (năm)', 0, 'Nhập số'], ['ĐƠN VỊ TÍNH', 1, ''], ['TRẠNG THÁI', 0, ''],
  ['LINK DATASHEET', 0, 'Link PDF catalogue'], ['GHI CHÚ', 0, '']
];
const CHON = {
  'ĐƠN VỊ TÍNH': ['Cái', 'Bộ', 'Chiếc'],
  'TRẠNG THÁI': ['Đang kinh doanh', 'Ngưng kinh doanh', 'Đặt hàng'],
  'HẠNG MỤC': VS.HANG_MUC
};
const MAU_NHOM = { dau: 'FF12315A', chinh: 'FF7A4B00', tk: 'FF0F5A4A', cuoi: 'FF3F4A5A' };
const MAU_BAT_BUOC = 'FF1E63D2';

function cotCuaHM(hm) {
  const h = VS.HM[hm];
  const m = function (nhom) { return function (lb) { return [lb, h.req.indexOf(lb) >= 0 ? 1 : 0, VS.METRIC[lb][3] || '', nhom]; }; };
  return DAU.map(function (c) { return c.concat('dau'); })
    .concat(h.chinh.map(m('chinh')))
    .concat(h.tk.map(m('tk')))
    .concat(CUOI.map(function (c) { return c.concat('cuoi'); }));
}
// Danh sách chọn cho Excel: '"a,b,c"' (tối đa 255 ký tự, không chứa dấu phẩy trong giá trị)
function dsChon(arr) {
  const v = arr.filter(function (x) { return x.indexOf(',') < 0; }).join(',');
  return v && v.length <= 250 ? '"' + v + '"' : null;
}

async function buildVsTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dezon QS Pro';
  VS.HANG_MUC.forEach(function (hm) {
    const cols = cotCuaHM(hm);
    const ws = wb.addWorksheet(hm, { views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }] });
    ws.columns = cols.map(function (c) {
      return { header: c[0], key: c[0], width: Math.min(34, Math.max(13, Math.round(c[0].length * 0.95) + 5)) };
    });
    const head = ws.getRow(1); head.height = 36;
    cols.forEach(function (c, i) {
      const cell = head.getCell(i + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c[1] ? MAU_BAT_BUOC : MAU_NHOM[c[3]] } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { right: { style: 'thin', color: { argb: 'FF20406B' } } };
      const opts = CHON[c[0]] || VS.optsOf(hm, c[0]);
      const ghiChu = [c[1] ? 'BẮT BUỘC' : 'Tuỳ chọn', c[2], opts.length ? ('Chọn: ' + opts.join(' / ')) : ''].filter(Boolean).join('\n');
      cell.note = ghiChu;
      // Dropdown cho cột có danh sách chọn (vẫn cho gõ giá trị khác -> showErrorMessage false)
      const f = opts.length ? dsChon(opts) : null;
      if (f) {
        for (let r = 2; r <= 500; r++) {
          ws.getCell(r, i + 1).dataValidation = { type: 'list', allowBlank: true, formulae: [f], showErrorMessage: false };
        }
      }
    });
    // Dòng ví dụ
    const vd = Object.assign({ 'THƯƠNG HIỆU': 'TOTO', 'NHÀ CUNG CẤP': 'Công ty ABC', 'HẠNG MỤC': hm,
      'CHIẾT KHẤU ĐẠI LÝ (%)': 30, 'BẢO HÀNH (năm)': 2, 'TRẠNG THÁI': 'Đang kinh doanh' }, VS.HM[hm].mau);
    vd['TÊN SẢN PHẨM'] = VS.VD + ' ' + (vd['TÊN SẢN PHẨM'] || hm);
    const row = ws.addRow(cols.map(function (c) { return vd[c[0]] != null ? vd[c[0]] : ''; }));
    row.eachCell(function (cell) {
      cell.font = { size: 10, italic: true, color: { argb: 'FF8A94A6' } };
      cell.alignment = { vertical: 'top', wrapText: true };
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  });

  // ---- Sheet Hướng dẫn ----
  const gd = wb.addWorksheet('Hướng dẫn');
  gd.columns = [{ width: 4 }, { width: 30 }, { width: 92 }];
  function line(no, k, v, title) {
    const r = gd.addRow([no || '', k || '', v || '']);
    if (title) { r.getCell(2).font = { bold: true, size: 13, color: { argb: 'FF12315A' } }; r.height = 24; return r; }
    r.getCell(2).font = { bold: true, size: 10.5, color: { argb: MAU_BAT_BUOC } };
    r.getCell(3).font = { size: 10.5, color: { argb: 'FF334155' } };
    r.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    return r;
  }
  line('', 'HƯỚNG DẪN NHẬP HÀNG LOẠT — THIẾT BỊ VỆ SINH', '', 1);
  gd.addRow([]);
  line('1', 'Mỗi hạng mục = 1 sheet', 'Điền sản phẩm vào đúng sheet của hạng mục (' + VS.HANG_MUC.join(', ') + '). Mỗi sheet CHỈ có thông số của hạng mục đó. Mỗi dòng = 1 sản phẩm. Sheet nào không dùng cứ để trống.');
  line('2', 'Màu tiêu đề', 'Xanh dương = BẮT BUỘC. Xanh đậm = thông tin cơ bản · Nâu = Thông tin chính · Xanh lục = Thông số thiết kế · Xám = thương mại (tuỳ chọn). Rê chuột vào ô tiêu đề để xem gợi ý và danh sách chọn.');
  line('3', 'Dòng ví dụ', 'Dòng 2 mỗi sheet (chữ xám, tên bắt đầu "' + VS.VD + '") là ví dụ — hệ thống TỰ BỎ QUA, không cần xoá.');
  line('4', 'Hạng mục', 'Cột HẠNG MỤC để trống = lấy theo tên sheet. Nếu ghi thì phải là 1 trong: ' + VS.HANG_MUC.join(', ') + '.');
  line('5', 'Giá & chiết khấu', 'GIÁ BÁN LẺ nhập số (vd 12500000). Giá đại lý hệ thống tự tính = Giá bán lẻ × (1 − Chiết khấu %).');
  line('6', 'Kiểm tra khi nhập', 'Dòng thiếu thông số bắt buộc của hạng mục, hoặc hạng mục không hợp lệ sẽ KHÔNG được nhập và được báo lỗi cụ thể từng sản phẩm.');
  line('7', 'Ảnh sản phẩm', 'KHÔNG nhập ảnh trong file. Sau khi tải file lên, hệ thống hiện danh sách để tải ảnh (1 ảnh chính + nhiều ảnh phụ) cho từng SP rồi lưu.');
  line('8', 'Mã trùng', 'Cùng MÃ SẢN PHẨM + MÀU SẮC + KÍCH THƯỚC đã có trong DB thì dòng đó CẬP NHẬT (ghi đè) thay vì tạo mới.');
  line('9', 'Tải lên', 'Nhập dữ liệu → chọn ngành "Thiết bị vệ sinh" → mục "Nhập hàng loạt từ file" → chọn file này.');
  line('', '', '');
  line('', 'THÔNG SỐ THEO HẠNG MỤC', '', 1);
  VS.HANG_MUC.forEach(function (hm) {
    const h = VS.HM[hm], ten = function (lb) { return VS.METRIC[lb][1] + (h.req.indexOf(lb) >= 0 ? '*' : ''); };
    line('', hm, 'Thông tin chính: ' + h.chinh.map(ten).join(', ') + '\nThông số thiết kế: ' + h.tk.map(ten).join(', '));
  });
  return wb.xlsx.writeBuffer();
}

module.exports = { buildVsTemplate: buildVsTemplate, cotCuaHM: cotCuaHM };
