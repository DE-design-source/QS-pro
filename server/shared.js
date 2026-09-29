'use strict';
/************************************************************
 * Hằng số + hàm thuần dùng chung (không chạm dữ liệu):
 *   - mẫu tờ bìa + NCC phần 3.2   (store_supa.buildCoverFromTemplate, export)
 *   - chuẩn hoá chuỗi / đọc số kiểu VN
 *   - đọc file nhập hàng loạt (importParse)
 * Mã tờ bìa (STT) TRÙNG mã cây hạng mục Bóc tách (TREE trong public/app.js):
 * dòng bóc tách có nhom '3.2.6.1' được cộng vào mục tờ bìa '3.2.6'.
 ************************************************************/

const S32_SUPPLIERS = {
  '3.2.1': [['Thạch cao', 'Boral'], ['Phụ kiện', 'Vĩnh Tường']],
  '3.2.2': [['Bột trét', 'Dulux'], ['Sơn nước', 'Dulux']],
  '3.2.4': [['Sàn gỗ', 'Boen'], ['Đá', 'Eurostone'], ['Sàn gạch', 'Vietceramics'], ['Keo dán gạch', 'Weber']],
  '3.2.5': [['Bồn cầu', 'Mamma Mia'], ['Bồn tắm', 'Hansgrohe'], ['Sen', 'Bravat'], ['Lavabo', 'Kohler'], ['Phụ kiện', 'Mamma Mia']],
  '3.2.6': [['Công tắc', 'Etron'], ['Ổ cắm', 'Etron'], ['Đèn trong nhà', 'Ades Lighting'], ['Đèn ngoài trời', 'Croled']],
  '3.2.7': [['Ống đồng', 'LHCT / Luvata'], ['Ống ngưng', 'PPR'], ['Cục nóng', 'Daikin'], ['Máy lạnh', 'Daikin']],
  '3.2.8': [['Cửa ngoại thất', 'YKK AP'], ['Cửa nội thất', 'An Cường']]
};
const S32_SUBS = ['3.2.1', '3.2.2', '3.2.3', '3.2.4', '3.2.5', '3.2.6', '3.2.7', '3.2.8'];
// [stt, hạng mục, mô tả]
const COVER_TEMPLATE = [
  ['1', 'TƯ VẤN DỰ ÁN', ''],
  ['1.1', 'Tư vấn QLDA', 'Bao gồm tư vấn tài chính dự án, tư vấn pháp lý dự án, tư vấn quản lý dự án, tư vấn mua hàng, đặt hàng, mở thầu, chọn thầu....'],
  ['2', 'TƯ VẤN THIẾT KẾ', ''],
  ['2.1', 'Tư vấn thiết kế kiến trúc', 'Tư vấn thiết kế kiến trúc, mặt tiền công trình, mặt bằng bố trí kiến trúc...'],
  ['2.2', 'Tư vấn thiết kế nội thất', 'Tư vấn thiết kế mặt bằng công năng nội thất, thiết kế 3D, tư vấn chọn vật liệu, màu sắc, ánh sáng. Triển khai bản vẽ thi công nội thất'],
  ['2.3', 'Tư vấn thiết kế kết cấu', ''],
  ['2.4', 'Tư vấn thiết kế MEP (Mechanical, Electrical, Plumbing)', 'Tư vấn thiết kế hệ thống điện (Electrical), Hệ thống Thông gió & Điều hòa không khí (Mechanical / HVAC), hệ thống Cấp thoát nước (Plumbing & Sanitary), hệ thống Phòng cháy chữa cháy'],
  ['3', 'XÂY DỰNG', ''],
  ['3.1', 'Phần thô', 'Chuẩn bị mặt bằng, thi công móng và nền, thi công cột, dầm, sàn, thi công tường bao, tường ngăn, tô trát, hoàn thiện phần thô, kiểm tra và nghiệm thu phần thô'],
  ['3.2', 'Phần hoàn thiện cơ bản', 'Thi công hoàn thiện trần, tường, sàn, lắp đặt TBVS, thiết bị điện lạnh, lắp đặt cửa nội thất, tay vịn cầu thang...'],
  ['3.2.1', 'Trần thạch cao', 'Nhân công và vật tư'],
  ['3.2.2', 'Sơn nước', 'Nhân công và vật tư'],
  ['3.2.3', 'Xây tô', 'Nhân công và vật tư'],
  ['3.2.4', 'Ốp lát', 'Nhân công và vật tư'],
  ['3.2.5', 'Thiết bị vệ sinh', 'Cung cấp thiết bị và nhân công lắp đặt'],
  ['3.2.6', 'Thiết bị điện', 'Đèn, công tắc - ổ cắm: cung cấp thiết bị và nhân công lắp đặt'],
  ['3.2.7', 'Thiết bị điện lạnh', 'Cung cấp thiết bị và nhân công lắp đặt'],
  ['3.2.8', 'Cửa', 'Sản xuất và nhân công lắp đặt'],
  ['4', 'HOÀN THIỆN NỘI THẤT', ''],
  ['4.1', 'Nội thất liền tường', 'Thi công lắp đặt nội thất liền tường, tủ bếp, tủ trang trí, vách liền tường'],
  ['4.2', 'Đồ rời (Loose furniture)', 'Sản xuất, cung cấp nội thất đồ rời, kệ, tủ rời, giường, ghế sofa, bàn, tủ lavabo....'],
  ['4.3', 'Rèm cửa', 'Sản xuất, cung cấp, lắp đặt rèm cửa'],
  ['4.4', 'Đồ trang trí', 'Sản xuất, cung cấp đồ trang trí nội thất: thảm, đồ decor, tranh treo tường v.v....'],
  ['5', 'BẢO DƯỠNG', ''],
  ['5.1', 'Bảo dưỡng định kỳ', 'Cung cấp các gói bảo dưỡng định kỳ cho các thiết bị như máy lạnh, bình nước nóng.....'],
  ['5.2', 'Bảo hiểm', 'Cung cấp các gói bảo hiểm thay thế, sửa chữa cho các thiết bị như đèn, thiết bị vệ sinh, sơn nước, sàn gỗ...v.....']
];
// Dòng bóc tách thuộc mục tờ bìa stt: nhom = stt hoặc mã con (3.2.6 ⊃ 3.2.6.1)
function inCode(nhom, stt) { nhom = String(nhom || '').trim(); return nhom === stt || nhom.indexOf(stt + '.') === 0; }

/*** ===== CHUỖI / SỐ ===== ***/
function normalize_(s) {
  return String(s == null ? '' : s).toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim();
}
function toNumber_(v) {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  var s = String(v).replace(/[^\d,.-]/g, '');
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function round0_(n) { return Math.round(Number(n) || 0); }

/* Chi phí từng mục tờ bìa: mục có con = tổng các mục LÁ bên dưới (giống coverCosts ở client),
   tổng = cộng các mục cấp 1. */
function coverComputed_(cover) {
  const cost = {};
  const hasChild = function (st) { return cover.some(function (d) { return d.stt !== st && String(d.stt).indexOf(st + '.') === 0; }); };
  cover.forEach(function (c) {
    if (!hasChild(c.stt)) { cost[c.stt] = Number(c.chiPhi) || 0; return; }
    let s = 0;
    cover.forEach(function (d) { if (d.stt !== c.stt && String(d.stt).indexOf(c.stt + '.') === 0 && !hasChild(d.stt)) s += Number(d.chiPhi) || 0; });
    cost[c.stt] = s;
  });
  let total = 0;
  cover.forEach(function (c) { if (String(c.stt).split('.').length === 1) total += cost[c.stt]; });
  return { cost: cost, total: total };
}

/*** ===== NHẬP HÀNG LOẠT TỪ FILE (Excel / CSV) ===== ***/
const IMPORT_ALIAS = {
  ten: ['TÊN SẢN PHẨM', 'TÊN SP', 'TÊN HÀNG', 'TÊN', 'NAME', 'PRODUCT NAME', 'PRODUCT'],
  nhom: ['NHÓM', 'NGÀNH HÀNG', 'CATEGORY'],
  hangMuc: ['HẠNG MỤC'],
  thuongHieu: ['THƯƠNG HIỆU', 'BRAND', 'HÃNG'],
  ncc: ['NHÀ CUNG CẤP', 'NCC', 'SUPPLIER'],
  ma: ['MÃ SP', 'MÃ SẢN PHẨM', 'MÃ HÀNG', 'MÃ', 'CODE', 'SKU'],
  kichThuoc: ['KÍCH THƯỚC', 'SIZE', 'QUY CÁCH', 'DIMENSION'],
  dvt: ['ĐVT', 'ĐƠN VỊ TÍNH', 'ĐƠN VỊ', 'UNIT'],
  gia: ['ĐƠN GIÁ BÁN', 'GIÁ BÁN LẺ', 'ĐƠN GIÁ', 'GIÁ BÁN', 'GIÁ', 'PRICE'],
  moTa: ['MÔ TẢ', 'DESCRIPTION', 'GHI CHÚ'],
  hinhAnh: ['LINK ẢNH', 'HÌNH ẢNH', 'ẢNH', 'IMAGE', 'URL ẢNH', 'IMAGE URL']
};
function importCell_(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text != null) return v.text;
    if (v.result != null) return importCell_(v.result);
    if (v.hyperlink != null) return v.hyperlink;
    if (v.richText) return v.richText.map(function (t) { return t.text; }).join('');
    return '';
  }
  return v;
}
function matchAlias_(h) {
  const n = normalize_(h); if (!n) return null;
  for (const k in IMPORT_ALIAS) for (var i = 0; i < IMPORT_ALIAS[k].length; i++) if (n === normalize_(IMPORT_ALIAS[k][i])) return k;
  // Khớp theo NGUYÊN TỪ (không khớp chuỗi con): "ẢNH" không được khớp nhầm vào "BẢO HÀNH", "MÃ" vào "MÀU SẮC"…
  const w = ' ' + n.replace(/[^A-Z0-9]+/g, ' ').trim() + ' ';
  for (const k2 in IMPORT_ALIAS) for (var j = 0; j < IMPORT_ALIAS[k2].length; j++) {
    const a = normalize_(IMPORT_ALIAS[k2][j]).replace(/[^A-Z0-9]+/g, ' ').trim();
    if (a && w.indexOf(' ' + a + ' ') !== -1) return k2;
  }
  return null;
}
function pick2_(row, idx) { return (idx == null) ? '' : String(row[idx] == null ? '' : row[idx]).trim(); }
async function importParse(base64, ext, nganh) {
  const ExcelJS = require('exceljs');
  const buf = Buffer.from(String(base64 || ''), 'base64');
  const wb = new ExcelJS.Workbook();
  if (String(ext || '').toLowerCase().indexOf('csv') >= 0) {
    const Readable = require('stream').Readable;
    await wb.csv.read(Readable.from(buf.toString('utf8')));
  } else {
    await wb.xlsx.load(buf);
  }
  if (!wb.worksheets.length) throw new Error('File không có sheet dữ liệu');
  /* Thiết bị đèn: chỉ đọc sheet đầu (như cũ).
     Thiết bị vệ sinh: đọc MỌI sheet (trừ "Hướng dẫn") — file mẫu hiện là 1 sheet "San pham",
     vẫn nhận file kiểu cũ 1 sheet / hạng mục (ô HẠNG MỤC trống thì lấy theo tên sheet). */
  // Ngành có bộ thông số theo hạng mục: 'vs' (thiết bị vệ sinh) · 'son' (sơn nước)
  const VS = nganh === 'vs' ? require('../public/vs-spec.js')
    : (nganh === 'son' ? require('../public/son-spec.js') : null);
  const vs = !!VS;
  const sheets = vs ? wb.worksheets.filter(function (w) { return normalize_(w.name) !== 'HUONG DAN'; }) : [wb.worksheets[0]];
  const products = [], headerList = [], seenH = {}, mapped = {};
  let found = false;
  for (const ws of sheets) {
    const grid = [];
    ws.eachRow({ includeEmpty: false }, function (row) {
      const arr = []; row.eachCell({ includeEmpty: true }, function (cell, col) { arr[col - 1] = importCell_(cell.value); });
      grid.push(arr);
    });
    if (!grid.length) continue;
    var hr = -1, map = null;
    for (var i = 0; i < Math.min(grid.length, 15); i++) {
      var m = {}; grid[i].forEach(function (h, ci) { var key = matchAlias_(h); if (key && m[key] === undefined) m[key] = ci; });
      if (m.ten !== undefined) { hr = i; map = m; break; }
    }
    if (hr < 0) continue;
    found = true;
    var headers = grid[hr].map(function (h) { return String(h == null ? '' : h).trim(); });
    headers.forEach(function (h) { if (h && !seenH[h]) { seenH[h] = 1; headerList.push(h); } });
    Object.keys(map).forEach(function (k) { if (!mapped[k]) mapped[k] = headers[map[k]]; });
    const hmSheet = vs ? VS.chuanHM(ws.name) : '';
    for (var r = hr + 1; r < grid.length; r++) {
      var row = grid[r]; var ten = pick2_(row, map.ten); if (!ten) continue;
      if (vs && ten.indexOf(VS.VD) === 0) continue;               // dòng ví dụ của file mẫu
      // _raw: giữ nguyên MỌI cột theo tiêu đề gốc để importCommit map đầy đủ trường (thông số đèn / vệ sinh)
      var raw = {}; headers.forEach(function (h, ci) { if (h) raw[h] = String(row[ci] == null ? '' : row[ci]).trim(); });
      if (vs) {
        if (!raw['HẠNG MỤC'] && hmSheet) raw['HẠNG MỤC'] = hmSheet;
        if (raw['HẠNG MỤC']) raw['HẠNG MỤC'] = VS.chuanHM(raw['HẠNG MỤC']) || raw['HẠNG MỤC'];
      }
      products.push({
        ten: ten, nhom: pick2_(row, map.nhom), hangMuc: vs ? (raw['HẠNG MỤC'] || '') : pick2_(row, map.hangMuc), thuongHieu: pick2_(row, map.thuongHieu),
        ncc: pick2_(row, map.ncc), ma: pick2_(row, map.ma), kichThuoc: pick2_(row, map.kichThuoc),
        dvt: pick2_(row, map.dvt) || 'Cái', gia: round0_(toNumber_(pick2_(row, map.gia))),
        moTa: pick2_(row, map.moTa), hinhAnh: pick2_(row, map.hinhAnh), _raw: raw,
        _sheet: ws.name, _nganh: vs ? nganh : undefined
      });
      if (products.length >= 2000) break;
    }
    if (products.length >= 2000) break;
  }
  if (!found) throw new Error('Không tìm thấy cột "Tên sản phẩm" trong file (cần 1 cột tiêu đề có chữ Tên / Name)');
  if (vs && seenH['HẠNG MỤC'] === undefined) headerList.splice(Math.min(2, headerList.length), 0, 'HẠNG MỤC');
  return { count: products.length, products: products, mapped: mapped, headers: headerList };
}

module.exports = { S32_SUPPLIERS, S32_SUBS, COVER_TEMPLATE, inCode, normalize_, toNumber_, round0_, coverComputed_, importParse };
