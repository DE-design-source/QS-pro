'use strict';
const VS = require('../../../public/vs-spec.js');
const { normalize_, toNumber_, round0_ } = require('../../libraries/vn-number');
const { s } = require('../../libraries/utils');
const { nganhCua_, specNganh_ } = require('./san-pham.mapper');
const { saveDbProduct, _cacheClear_ } = require('./san-pham.repository');
const { logAudit_ } = require('../thong-bao/audit');

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
  const VS = nganh === 'vs' ? require('../../../public/vs-spec.js')
    : (nganh === 'son' ? require('../../../public/son-spec.js') : null);
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

async function importCommit(actor, products) {
  if (products === undefined && Array.isArray(actor)) { products = actor; actor = null; }
  // Dùng lại saveDbProduct cho từng SP (đúng path đã hoạt động: tự check + INSERT/UPDATE,
  // map đủ cột qua DB_LABEL2COL, xử lý số/boolean). Tránh upsert merge-duplicates bị RLS chặn.
  const list = products || [];
  let inserted = 0, updated = 0; const errors = [];
  const fill = function (d, lbl, v) { if (!s(d[lbl]).trim() && v != null && v !== '') d[lbl] = v; };
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const data = Object.assign({}, p._raw || {}); // cột từ file (tiêu đề = nhãn DB trong file mẫu)
    fill(data, 'TÊN SẢN PHẨM', p.ten); fill(data, 'MÃ SẢN PHẨM', p.ma); fill(data, 'DÒNG SẢN PHẨM', p.nhom);
    fill(data, 'HẠNG MỤC', p.hangMuc); fill(data, 'THƯƠNG HIỆU', p.thuongHieu); fill(data, 'NHÀ CUNG CẤP', p.ncc);
    fill(data, 'GIÁ BÁN LẺ', p.gia); fill(data, 'GHI CHÚ', p.moTa);
    delete data['GIÁ ĐẠI LÝ']; // cột tự tính (generated)
    data['ẢNH SẢN PHẨM'] = s(p.hinhAnh); // ảnh người dùng tải (ghi đè mọi cột ảnh trong file)
    if (!s(data['ĐƠN VỊ TÍNH']).trim()) data['ĐƠN VỊ TÍNH'] = p.dvt || 'Cái';
    if (!s(data['TRẠNG THÁI']).trim()) data['TRẠNG THÁI'] = 'Đang kinh doanh';
    if (!s(data['TÊN SẢN PHẨM']).trim()) continue;
    if (s(data['TÊN SẢN PHẨM']).trim().indexOf(VS.VD) === 0) continue;   // dòng ví dụ của file mẫu
    // Ngành có bộ thông số theo hạng mục: vệ sinh ('vs') · sơn nước ('son') -> tự nhận theo hạng mục
    const ngRow = (p._nganh === 'vs' || p._nganh === 'son') ? p._nganh
      : nganhCua_(data['NGÀNH HÀNG'], data['HẠNG MỤC']);
    const SPEC = specNganh_(ngRow);
    if (SPEC) {
      // Đóng dấu ngành (-> SP về đúng đề mục), chuẩn hoá tên hạng mục và CHỈ giữ thông số
      // thuộc hạng mục đó — cột của hạng mục khác trong file bị bỏ qua.
      data['NGÀNH HÀNG'] = ngRow;
      const hm = SPEC.chuanHM(data['HẠNG MỤC']);
      if (!hm) { errors.push({ i: i, ten: s(data['TÊN SẢN PHẨM']), error: 'Hạng mục "' + s(data['HẠNG MỤC']) + '" không thuộc danh sách: ' + SPEC.HANG_MUC.join(', ') }); continue; }
      data['HẠNG MỤC'] = hm;
      const cho = SPEC.CHUNG.concat(SPEC.labelsOf(hm));     // chỉ giữ trường chung + thông số của đúng hạng mục
      Object.keys(data).forEach(function (lb) { if (cho.indexOf(lb) < 0) delete data[lb]; });
      const thieu = SPEC.HM[hm].req.filter(function (lb) { return !s(data[lb]).trim(); });
      if (thieu.length) { errors.push({ i: i, ten: s(data['TÊN SẢN PHẨM']), error: hm + ' thiếu: ' + thieu.map(function (lb) { return SPEC.METRIC[lb][1]; }).join(', ') }); continue; }
    }
    try { const r = await saveDbProduct(actor, data, { noAudit: true }); if (r && r.updated) updated++; else inserted++; }
    catch (e) { errors.push({ i: i, ten: s(data['TÊN SẢN PHẨM']), error: e && e.message }); }
  }
  _cacheClear_();
  await logAudit_(actor, 'nhap_sp', 'Nhập hàng loạt: thêm ' + inserted + ', cập nhật ' + updated +
    ' sản phẩm' + (errors.length ? ' (' + errors.length + ' lỗi)' : ''));
  const out = { inserted: inserted, updated: updated };
  if (errors.length) out.errors = errors;
  return out;
}

module.exports = { importParse, importCommit };
