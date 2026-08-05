'use strict';
/************************************************************
 * QS PRO – Tầng nghiệp vụ (port từ Code.gs của bản Apps Script)
 * Nguồn dữ liệu: Lark Base (thay cho Google Sheets).
 *   - Bảng Danh mục SP  : có sẵn (LARK_TBL_PRODUCTS)
 *   - Bảng Dự án        : app tự tạo
 *   - Bảng Chi tiết báo giá : app tự tạo (khoá dòng = record_id của Lark)
 *   - Bảng Khái toán    : app tự tạo
 * Giữ nguyên toàn bộ toán học/logic; chỉ thay tầng đọc-ghi.
 ************************************************************/
const config = require('./config');
const lark = require('./lark');
const T = lark.FieldType;

/*** ===== HẰNG SỐ (bê từ Code.gs) ===== ***/
const S32_SUPPLIERS = {
  '3.2.1': [['Thạch cao', 'Boral'], ['Phụ kiện', 'Vĩnh Tường']],
  '3.2.2': [['Bột trét', 'Dulux'], ['Sơn nước', 'Dulux']],
  '3.2.3': [['Sàn gỗ', 'Boen'], ['Đá', 'Eurostone'], ['Sàn gạch', 'Vietceramics'], ['Keo dán gạch', 'Weber']],
  '3.2.4': [['Bồn cầu', 'Mamma Mia'], ['Bồn tắm', 'Hansgrohe'], ['Sen', 'Bravat'], ['Lavabo', 'Kohler'], ['Phụ kiện', 'Mamma Mia']],
  '3.2.5': [['Công tắc', 'Etron'], ['Ổ cắm', 'Etron'], ['Đèn trong nhà', 'Ades Lighting'], ['Đèn ngoài trời', 'Croled']],
  '3.2.6': [['Ống đồng', 'LHCT / Luvata'], ['Ống ngưng', 'PPR'], ['Cục nóng', 'Daikin'], ['Máy lạnh', 'Daikin']],
  '3.2.7': [['Cửa ngoại thất', 'YKK AP'], ['Cửa nội thất', 'An Cường']]
};
const COVER_TEMPLATE = [
  ['1', 'TƯ VẤN DỰ ÁN', '', ''],
  ['1.1', 'Tư vấn QLDA', 'Bao gồm tư vấn tài chính dự án, tư vấn pháp lý dự án, tư vấn quản lý dự án, tư vấn mua hàng, đặt hàng, mở thầu, chọn thầu....', ''],
  ['2', 'TƯ VẤN THIẾT KẾ', '', ''],
  ['2.1', 'Tư vấn thiết kế kiến trúc', 'Tư vấn thiết kế kiến trúc, mặt tiền công trình, mặt bằng bố trí kiến trúc...', ''],
  ['2.2', 'Tư vấn thiết kế nội thất', 'Tư vấn thiết kế mặt bằng công năng nội thất, thiết kế 3D, tư vấn chọn vật liệu, màu sắc, ánh sáng. Triển khai bản vẽ thi công nội thất', ''],
  ['2.3', 'Tư vấn thiết kế MEP (Mechanical, Electrical, Plumbing)', 'Tư vấn thiết kế hệ thống điện (Electrical), Hệ thống Thông gió & Điều hòa không khí (Mechanical / HVAC), hệ thống Cấp thoát nước (Plumbing & Sanitary), hệ thống Phòng cháy chữa cháy', ''],
  ['3', 'XÂY DỰNG', '', ''],
  ['3.1', 'Phần thô', 'Chuẩn bị mặt bằng, thi công móng và nền, thi công cột, dầm, sàn, thi công tường bao, tường ngăn, tô trát, hoàn thiện phần thô, kiểm tra và nghiệm thu phần thô', ''],
  ['3.2', 'Phần hoàn thiện cơ bản', 'Thi công hoàn thiện trần, tường, sàn, lắp đặt TBVS, thiết bị điện lạnh, lắp đặt cửa nội thất, tay vịn cầu thang...', ''],
  ['3.2.1', 'Trần thạch cao', 'Nhân công và vật tư', ''],
  ['3.2.2', 'Sơn nước', 'Nhân công và vật tư', ''],
  ['3.2.3', 'Hoàn thiện sàn', 'Nhân công và vật tư', ''],
  ['3.2.4', 'Thiết bị vệ sinh', 'Cung cấp thiết bị và nhân công lắp đặt', '3.2.4.THIẾT BỊ VỆ SINH'],
  ['3.2.5', 'Thiết bị chiếu sáng', 'Cung cấp thiết bị và nhân công lắp đặt', '3.2.4.THIẾT BỊ CHIẾU SÁNG (CÔNG TẮC),3.2.5.THIẾT BỊ CHIẾU SÁNG (ĐÈN)'],
  ['3.2.6', 'Thiết bị điện lạnh', 'Cung cấp thiết bị và nhân công lắp đặt', '3.2.6.B.THIẾT BỊ ĐIỆN LẠNH'],
  ['3.2.7', 'Cửa', 'Sản xuất và nhân công lắp đặt', '3.2.7.B.CỬA NỘI THẤT'],
  ['4', 'HOÀN THIỆN NỘI THẤT', '', ''],
  ['4.1', 'Nội thất liền tường', 'Thi công lắp đặt nội thất liền tường, tủ bếp, tủ trang trí, vách liền tường', '4.1.NỘI THẤT LIỀN TƯỜNG'],
  ['4.2', 'Đồ rời (Loose furniture)', 'Sản xuất, cung cấp nội thất đồ rời, kệ, tủ rời, giường, ghế sofa, bàn, tủ lavabo....', '4.2.NỘI THẤT RỜI'],
  ['4.3', 'Đồ trang trí', 'Sản xuất, cung cấp đồ trang trí nội thất: rèm cửa, thảm, đồ decor, tranh treo tường v.v....', '4.3.1.RÈM CỬA'],
  ['5', 'BẢO DƯỠNG', '', ''],
  ['5.1', 'Bảo dưỡng định kỳ', 'Cung cấp các gói bảo dưỡng định kỳ cho các thiết bị như máy lạnh, bình nước nóng.....', ''],
  ['5.2', 'Bảo hiểm', 'Cung cấp các gói bảo hiểm thay thế, sửa chữa cho các thiết bị như đèn, thiết bị vệ sinh, sơn nước, sàn gỗ...v.....', '']
];

// Field bảng do app tự tạo. Field ĐẦU phải là kiểu text (primary) -> để 'Mã DA' đầu tiên.
const PROJECT_FIELDS = [
  ['Mã DA', T.TEXT], ['Tên dự án', T.TEXT], ['Khách hàng', T.TEXT], ['Địa chỉ', T.TEXT], ['SĐT', T.TEXT],
  ['Trạng thái', T.TEXT], ['VAT (%)', T.NUMBER], ['Tiến độ (%)', T.NUMBER], ['Ghi chú', T.TEXT],
  ['Ngày tạo', T.TEXT], ['Cập nhật', T.TEXT], ['Quy mô', T.TEXT], ['Tổng DT (m2)', T.TEXT],
  ['DT báo giá (m2)', T.TEXT], ['Nhu cầu', T.TEXT], ['Phân khúc', T.TEXT], ['Mã báo giá', T.TEXT],
  ['Nhóm tự tạo', T.TEXT], ['Tầng tự tạo', T.TEXT]
];
const LINE_FIELDS = [
  ['Mã DA', T.TEXT], ['STT', T.NUMBER], ['Nhóm', T.TEXT], ['Hạng mục', T.TEXT], ['Mã SP', T.TEXT],
  ['Tên sản phẩm', T.TEXT], ['Thương hiệu', T.TEXT], ['Mô tả', T.TEXT], ['Kích thước', T.TEXT],
  ['Hình ảnh', T.TEXT], ['ĐVT', T.TEXT], ['Số lượng', T.NUMBER], ['Đơn giá vốn', T.NUMBER],
  ['% Lợi nhuận', T.NUMBER], ['Đơn giá bán', T.NUMBER], ['Thành tiền vốn', T.NUMBER], ['Thành tiền bán', T.NUMBER],
  ['Khu vực', T.TEXT], ['NCC', T.TEXT], ['Mã bản vẽ', T.TEXT], ['Tầng', T.TEXT], ['Chiết khấu (%)', T.NUMBER],
  ['Trạng thái', T.TEXT], ['Ghi chú', T.TEXT], ['Tự nhập', T.NUMBER], ['Đã lưu DM', T.NUMBER], ['Thuộc tính thêm', T.TEXT]
];
const COVER_FIELDS = [
  ['Mã DA', T.TEXT], ['STT', T.TEXT], ['Hạng mục', T.TEXT], ['Mô tả', T.TEXT], ['Chi phí', T.NUMBER]
];
// Danh mục sản phẩm (khi Base chưa có bảng danh mục -> app tự tạo bảng này).
// Field đầu = primary (text) -> 'Tên sản phẩm'.
// STT (Auto Number) là cột đầu = primary/index field của bảng.
const PRODUCT_FIELDS = [
  ['STT', T.AUTO_NUMBER], ['Tên sản phẩm', T.TEXT], ['Nhóm', T.TEXT], ['Hạng mục', T.TEXT],
  ['Thương hiệu', T.TEXT], ['Nhà cung cấp', T.TEXT], ['Mã SP', T.TEXT], ['Mô tả', T.TEXT],
  ['Kích thước', T.TEXT], ['ĐVT', T.TEXT], ['Đơn giá', T.NUMBER], ['Hình ảnh', T.ATTACHMENT]
];
const PRODUCT_TABLE_NAME = 'Danh mục sản phẩm';

/*** ===== HELPER (port nguyên văn) ===== ***/
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
// Giá trị tính sẵn để ghi sang Lark (đồng bộ với bảng app)
function computeDerived_(von, ckDaiLy, ban, ckKhach, sl) {
  const giaDaiLy = round0_((Number(von) || 0) * (1 - (Number(ckDaiLy) || 0) / 100));
  const donGiaCK = round0_((Number(ban) || 0) * (1 - (Number(ckKhach) || 0) / 100));
  const markup = giaDaiLy > 0 ? Math.round((donGiaCK - giaDaiLy) / giaDaiLy * 100) : 0;
  const margin = donGiaCK > 0 ? Math.round((donGiaCK - giaDaiLy) / donGiaCK * 100) : 0;
  const lnVnd = round0_((donGiaCK - giaDaiLy) * (Number(sl) || 0));
  return {
    'Giá đại lý': giaDaiLy, 'Đơn giá (sau CK khách)': donGiaCK,
    'Markup (%)': markup, 'Margin (%)': margin, 'Lợi nhuận (VND)': lnVnd
  };
}

// findCol_ trên map normalized(name)->name; trả về TÊN field thật hoặc ''
function findName_(map, keywords) {
  for (var k = 0; k < keywords.length; k++) {
    const key = normalize_(keywords[k]);
    if (map.hasOwnProperty(key)) return map[key];
  }
  const keys = Object.keys(map);
  for (var i = 0; i < keywords.length; i++) {
    const kw = normalize_(keywords[i]);
    for (var j = 0; j < keys.length; j++) if (keys[j].indexOf(kw) !== -1) return map[keys[j]];
  }
  return '';
}

/*** ===== ĐỌC GIÁ TRỊ Ô LARK (nhiều kiểu) ===== ***/
function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    return v.map(function (it) {
      if (it == null) return '';
      if (typeof it === 'string') return it;
      if (it.text != null) return it.text;
      if (it.name != null) return it.name;
      if (it.link != null) return it.link;
      return '';
    }).join('').trim();
  }
  if (typeof v === 'object') {
    if (v.text != null) return String(v.text);
    if (v.link != null) return String(v.link);
    if (v.value != null) return cellText(v.value);
    return '';
  }
  return String(v);
}
// Ảnh: attachment -> proxy /media?token=; url/link -> dùng thẳng
function imageUrl(v) {
  if (v == null || v === '') return '';
  if (Array.isArray(v) && v.length) {
    const a = v[0];
    if (a && a.file_token) return '/media?token=' + encodeURIComponent(a.file_token);
    if (a && (a.url || a.tmp_url)) return a.url || a.tmp_url;
    if (typeof a === 'string' && a.indexOf('http') === 0) return a;
    return '';
  }
  if (typeof v === 'object') {
    if (v.file_token) return '/media?token=' + encodeURIComponent(v.file_token);
    if (v.link) return v.link;
    if (v.text && String(v.text).indexOf('http') === 0) return v.text;
    return '';
  }
  const s = String(v);
  return s.indexOf('http') === 0 ? s : '';
}

/*** ===== NGÀY GIỜ (GMT+7) ===== ***/
function fmtVN_(fmt) {
  const d = new Date();
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(d).reduce(function (o, x) { o[x.type] = x.value; return o; }, {});
  if (fmt === 'stamp') return p.year.slice(2) + p.month + p.day + '-' + p.hour + p.minute + p.second;
  return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute;
}

/*** ===== SETUP: đảm bảo 3 bảng do app quản lý đã tồn tại ===== ***/
async function ensureTable_(key, tableName, fieldDefs) {
  if (config.tables[key]) return config.tables[key];
  // Thử tìm bảng theo tên (nếu đã tạo trước đó nhưng chưa lưu id)
  const tables = await lark.listTables();
  const hit = tables.filter(function (t) { return normalize_(t.name) === normalize_(tableName); })[0];
  if (hit) { config.setTable(key, hit.table_id); return hit.table_id; }
  // Tạo mới
  const fields = fieldDefs.map(function (f) { return { field_name: f[0], type: f[1] }; });
  const res = await lark.createTable(tableName, fields);
  const id = res.table_id;
  config.setTable(key, id);
  return id;
}
let _setupDone = false;
async function setup() {
  if (_setupDone) return;
  config.assertCredentials();
  // Chưa cấu hình bảng danh mục -> tự tạo/tìm bảng 'Danh mục sản phẩm'
  if (!config.tables.products) await ensureTable_('products', PRODUCT_TABLE_NAME, PRODUCT_FIELDS);
  await ensureTable_('projects', 'Dự án', PROJECT_FIELDS);
  await ensureTable_('lines', 'Chi tiết báo giá', LINE_FIELDS);
  await ensureTable_('cover', 'Khái toán', COVER_FIELDS);
  _setupDone = true;
}

/*** ===== BẢNG SẢN PHẨM: ánh xạ cột ===== ***/
let _fmCache = null;
async function productFieldMap() {
  if (_fmCache) return _fmCache;
  const fields = await lark.listFields(config.tables.products);
  const names = fields.map(function (f) { return f.field_name; });
  const map = {};
  names.forEach(function (n) { map[normalize_(n)] = n; });
  _fmCache = {
    names: names,
    nhom: findName_(map, ['NHÓM', 'NHOM']),
    hm: findName_(map, ['HẠNG MỤC']),
    ten: findName_(map, ['TÊN SẢN PHẨM', 'TÊN SP', 'TÊN']),
    th: findName_(map, ['THƯƠNG HIỆU']),
    ncc: findName_(map, ['NHÀ CUNG CẤP', 'NCC']),
    ma: findName_(map, ['MÃ SP', 'MÃ SẢN PHẨM', 'MÃ']),
    mota: findName_(map, ['MÔ TẢ']),
    kt: findName_(map, ['KÍCH THƯỚC']),
    dvt: findName_(map, ['ĐVT', 'ĐƠN VỊ TÍNH', 'ĐƠN VỊ']),
    gia: findName_(map, ['GIÁ BÁN LẺ', 'ĐƠN GIÁ', 'GIÁ']),
    img: findName_(map, ['HÌNH ẢNH', 'ẢNH', 'IMAGE']),
    congSuat: findName_(map, ['CÔNG SUẤT', 'CÔNG XUẤT', 'CÔNG XUẤ', 'WATT']),
    nhietDo: findName_(map, ['NHIỆT ĐỘ MÀU', 'NHIỆT ĐỘ', 'CCT', 'KELVIN']),
    gocChieu: findName_(map, ['GÓC CHIẾU SÁNG', 'GÓC CHIẾU', 'BEAM']),
    loKhoet: findName_(map, ['LỖ KHOÉT', 'LỖ KHOET']),
    cri: findName_(map, ['CRI', 'HOÀN MÀU', 'RA']),
    dienAp: findName_(map, ['ĐIỆN ÁP', 'ĐIỆN THẾ', 'VOLTAGE']),
    capBaoVe: findName_(map, ['CẤP BẢO VỆ', 'IP', 'CHỐNG NƯỚC']),
    quangThong: findName_(map, ['QUANG THÔNG', 'LUMEN', 'LM']),
    chipLed: findName_(map, ['LOẠI CHIP LED', 'CHIP LED', 'CHIP']),
    tuoiTho: findName_(map, ['TUỔI THỌ', 'LIFESPAN']),
    chatLieu: findName_(map, ['CHẤT LIỆU', 'VẬT LIỆU', 'MATERIAL'])
  };
  // kiểu từng field (để ghi đúng định dạng: MultiSelect=mảng, Number=số…)
  _fmCache.typeOf = {}; fields.forEach(function (f) { _fmCache.typeOf[f.field_name] = f.type; });
  return _fmCache;
}
// Định dạng giá trị theo kiểu field khi ghi vào Lark
function fieldValue_(fm, name, val) {
  if (!name || val == null || val === '') return undefined;
  const t = fm.typeOf ? fm.typeOf[name] : 1;
  if (t === 2) return toNumber_(val);                 // Number
  if (t === 4) return [String(val)];                  // MultiSelect -> mảng
  if (t === 3) return String(val);                    // SingleSelect -> chuỗi (Lark tự thêm option)
  if (t === 17) return undefined;                     // Attachment -> bỏ (không set từ chuỗi)
  return String(val);                                 // Text & khác
}

/*** ===== SẢN PHẨM ===== ***/
async function getProducts() {
  const fm = await productFieldMap();
  const recs = await lark.listRecords(config.tables.products);
  const out = [];
  recs.forEach(function (r) {
    const f = r.fields || {};
    const ten = cellText(f[fm.ten]).trim();
    if (!ten) return;
    const gia = toNumber_(f[fm.gia] != null ? f[fm.gia] : cellText(f[fm.gia]));
    out.push({
      ma: cellText(f[fm.ma]), ten: ten,
      thuongHieu: cellText(f[fm.th]), ncc: cellText(f[fm.ncc]),
      nhom: cellText(f[fm.nhom]), hangMuc: cellText(f[fm.hm]) || cellText(f[fm.nhom]),
      moTa: cellText(f[fm.mota]), kichThuoc: cellText(f[fm.kt]),
      hinhAnh: imageUrl(f[fm.img]), link: '', dvt: cellText(f[fm.dvt]) || 'Cái',
      congSuat: cellText(f[fm.congSuat]), nhietDo: cellText(f[fm.nhietDo]), gocChieu: cellText(f[fm.gocChieu]),
      loKhoet: cellText(f[fm.loKhoet]), cri: cellText(f[fm.cri]), dienAp: cellText(f[fm.dienAp]),
      capBaoVe: cellText(f[fm.capBaoVe]), quangThong: cellText(f[fm.quangThong]), chipLed: cellText(f[fm.chipLed]),
      tuoiTho: cellText(f[fm.tuoiTho]), chatLieu: cellText(f[fm.chatLieu]),
      donGiaVon: gia, donGiaBan: gia, lnPct: 0, recordId: r.record_id
    });
  });
  return out;
}
let _prodCache = null, _prodCacheAt = 0;
const PROD_TTL = 5 * 60 * 1000;
async function getProductsCached() {
  const now = Date.now();
  if (_prodCache && now - _prodCacheAt < PROD_TTL) return _prodCache;
  _prodCache = await getProducts();
  _prodCacheAt = now;
  return _prodCache;
}
function clearProductsCache() { _prodCache = null; _prodCacheAt = 0; return 'Đã xoá cache danh mục'; }

// Danh sách Nhóm (thay cho "các sheet 1.–5.")
async function getCatalogSheets() {
  const prods = await getProductsCached();
  const seen = {}, out = [];
  prods.forEach(function (p) {
    const n = (p.nhom || '').trim();
    if (n && !seen[n]) { seen[n] = 1; out.push(n); }
  });
  return out;
}
// Tên cột thật của bảng SP -> mỗi Nhóm dùng chung (1 bảng duy nhất)
async function getSheetCols() {
  const fm = await productFieldMap();
  const sheets = await getCatalogSheets();
  const res = {};
  sheets.forEach(function (n) { res[n] = fm.names.slice(); });
  return res;
}

/*** ===== BOOTSTRAP ===== ***/
async function bootstrap(maDA) {
  await setup();
  const products = await getProductsCached();
  const projects = await getProjects();
  const lines = maDA ? await getLines(maDA) : [];
  const catSheets = await getCatalogSheets();
  const sheetCols = await getSheetCols();
  return { projects: projects, products: products, lines: lines, catSheets: catSheets, sheetCols: sheetCols };
}
// "Đồng bộ danh mục" -> chỉ cần refresh cache (danh mục sống trên Lark)
async function buildCatalog() {
  clearProductsCache();
  const prods = await getProducts();
  _prodCache = prods; _prodCacheAt = Date.now();
  return { total: prods.length, report: ['Đã nạp ' + prods.length + ' sản phẩm từ Lark Base'],
    msg: 'Đã nạp ' + prods.length + ' sản phẩm từ Lark Base.' };
}

/*** ===== DỰ ÁN ===== ***/
function recToProject_(r) {
  const f = r.fields || {};
  return {
    maDA: cellText(f['Mã DA']), ten: cellText(f['Tên dự án']), khachHang: cellText(f['Khách hàng']),
    diaChi: cellText(f['Địa chỉ']), sdt: cellText(f['SĐT']),
    trangThai: cellText(f['Trạng thái']) || 'Bản nháp',
    vat: toNumber_(f['VAT (%)']), tienDo: toNumber_(f['Tiến độ (%)']),
    ghiChu: cellText(f['Ghi chú']), ngayTao: cellText(f['Ngày tạo']), capNhat: cellText(f['Cập nhật']),
    quyMo: cellText(f['Quy mô']), tongDT: cellText(f['Tổng DT (m2)']), dtBaoGia: cellText(f['DT báo giá (m2)']),
    nhuCau: cellText(f['Nhu cầu']), phanKhuc: cellText(f['Phân khúc']), maBaoGia: cellText(f['Mã báo giá']),
    nhomTuTao: cellText(f['Nhóm tự tạo']), tangTuTao: cellText(f['Tầng tự tạo']),
    _rid: r.record_id
  };
}
async function getProjects() {
  await setup();
  const recs = await lark.listRecords(config.tables.projects);
  return recs.map(recToProject_).filter(function (p) { return p.maDA; }).reverse();
}
async function getProject(maDA) {
  const recs = await lark.findByField(config.tables.projects, 'Mã DA', maDA);
  return recs.length ? recToProject_(recs[0]) : null;
}
async function createProject(data) {
  await setup();
  data = data || {};
  const maDA = 'DA' + fmtVN_('stamp');
  const now = fmtVN_('human');
  const fields = {
    'Mã DA': maDA, 'Tên dự án': data.ten || 'Dự án mới', 'Khách hàng': data.khachHang || '',
    'Địa chỉ': data.diaChi || '', 'SĐT': data.sdt || '', 'Trạng thái': data.trangThai || 'Bản nháp',
    'VAT (%)': Number(data.vat) || 0, 'Tiến độ (%)': Number(data.tienDo) || 0, 'Ghi chú': data.ghiChu || '',
    'Ngày tạo': now, 'Cập nhật': now, 'Quy mô': data.quyMo || '', 'Tổng DT (m2)': data.tongDT || '',
    'DT báo giá (m2)': data.dtBaoGia || '', 'Nhu cầu': data.nhuCau || '', 'Phân khúc': data.phanKhuc || '',
    'Mã báo giá': data.maBaoGia || ''
  };
  const rec = await lark.createRecord(config.tables.projects, fields);
  return recToProject_(rec);
}
async function updateProject(maDA, data) {
  const recs = await lark.findByField(config.tables.projects, 'Mã DA', maDA);
  if (!recs.length) return null;
  const rid = recs[0].record_id;
  const map = {
    ten: 'Tên dự án', khachHang: 'Khách hàng', diaChi: 'Địa chỉ', sdt: 'SĐT', trangThai: 'Trạng thái',
    vat: 'VAT (%)', tienDo: 'Tiến độ (%)', ghiChu: 'Ghi chú', quyMo: 'Quy mô', tongDT: 'Tổng DT (m2)',
    dtBaoGia: 'DT báo giá (m2)', nhuCau: 'Nhu cầu', phanKhuc: 'Phân khúc', maBaoGia: 'Mã báo giá',
    nhomTuTao: 'Nhóm tự tạo', tangTuTao: 'Tầng tự tạo'
  };
  const fields = {};
  Object.keys(map).forEach(function (k) {
    if (data.hasOwnProperty(k)) fields[map[k]] = (k === 'vat' || k === 'tienDo') ? (Number(data[k]) || 0) : (data[k] == null ? '' : data[k]);
  });
  fields['Cập nhật'] = fmtVN_('human');
  await lark.updateRecord(config.tables.projects, rid, fields);
  // Đọc lại đầy đủ theo record_id (update response có thể thiếu field chưa đổi -> mất Mã DA)
  const rec = await lark.getRecord(config.tables.projects, rid);
  return recToProject_(rec);
}
async function deleteProject(maDA) {
  const proj = await lark.findByField(config.tables.projects, 'Mã DA', maDA);
  await lark.batchDelete(config.tables.projects, proj.map(function (r) { return r.record_id; }));
  const lines = await lark.findByField(config.tables.lines, 'Mã DA', maDA);
  await lark.batchDelete(config.tables.lines, lines.map(function (r) { return r.record_id; }));
  const cov = await lark.findByField(config.tables.cover, 'Mã DA', maDA);
  await lark.batchDelete(config.tables.cover, cov.map(function (r) { return r.record_id; }));
  return getProjects();
}

/*** ===== DÒNG BÁO GIÁ (khoá = record_id) ===== ***/
function parseExtra_(v) { if (!v) return {}; try { var o = JSON.parse(v); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
function recToLine_(r) {
  const f = r.fields || {};
  return {
    lineId: r.record_id, maDA: cellText(f['Mã DA']), stt: toNumber_(f['STT']),
    nhom: cellText(f['Nhóm']), loai: cellText(f['Hạng mục']), maSP: cellText(f['Mã SP']),
    ten: cellText(f['Tên sản phẩm']), thuongHieu: cellText(f['Thương hiệu']), moTa: cellText(f['Mô tả']),
    kichThuoc: cellText(f['Kích thước']), hinhAnh: cellText(f['Hình ảnh']), dvt: cellText(f['ĐVT']),
    soLuong: toNumber_(f['Số lượng']), donGiaVon: toNumber_(f['Đơn giá vốn']), lnPct: toNumber_(f['% Lợi nhuận']),
    donGiaBan: toNumber_(f['Đơn giá bán']), thanhTienVon: toNumber_(f['Thành tiền vốn']), thanhTienBan: toNumber_(f['Thành tiền bán']),
    khuVuc: cellText(f['Khu vực']), ncc: cellText(f['NCC']), maBanVe: cellText(f['Mã bản vẽ']), tang: cellText(f['Tầng']),
    chietKhau: toNumber_(f['Chiết khấu (%)']), ckKhach: toNumber_(f['Chiết khấu khách (%)']),
    trangThai: cellText(f['Trạng thái']), ghiChu: cellText(f['Ghi chú']),
    tuNhap: toNumber_(f['Tự nhập']) ? 1 : 0, daLuuDM: toNumber_(f['Đã lưu DM']) ? 1 : 0,
    extra: parseExtra_(cellText(f['Thuộc tính thêm']))
  };
}
async function getLines(maDA) {
  await setup();
  const recs = await lark.findByField(config.tables.lines, 'Mã DA', maDA);
  const out = recs.map(recToLine_);
  out.sort(function (a, b) { return (a.stt || 0) - (b.stt || 0); });
  return out;
}
async function addLine(maDA, product, soLuong) {
  await setup();
  product = product || {};
  const sl = Number(soLuong) || 1;
  const von = toNumber_(product.donGiaVon);
  var ban = toNumber_(product.donGiaBan) || von;
  var ln = von > 0 ? Math.round((ban - von) / von * 100) : (Number(product.lnPct) || 0);
  const existing = await lark.findByField(config.tables.lines, 'Mã DA', maDA);
  const stt = existing.length + 1;
  const fields = {
    'Mã DA': maDA, 'STT': stt, 'Nhóm': product.nhom || '', 'Hạng mục': product.hangMuc || product.loai || '',
    'Mã SP': product.ma || '', 'Tên sản phẩm': product.ten || '', 'Thương hiệu': product.thuongHieu || '',
    'Mô tả': product.moTa || '', 'Kích thước': product.kichThuoc || '', 'Hình ảnh': product.hinhAnh || product.link || '',
    'ĐVT': product.dvt || 'Cái', 'Số lượng': sl, 'Đơn giá vốn': von, '% Lợi nhuận': ln, 'Đơn giá bán': ban,
    'Thành tiền vốn': round0_(sl * von), 'Thành tiền bán': round0_(sl * ban * (1 - (Number(product.ckKhach) || 0) / 100)),
    'Khu vực': product.khuVuc || '', 'NCC': product.ncc || '', 'Mã bản vẽ': product.maBanVe || '', 'Tầng': product.tang || '',
    'Chiết khấu (%)': Number(product.chietKhau) || 0, 'Chiết khấu khách (%)': Number(product.ckKhach) || 0,
    'Trạng thái': product.trangThai || '', 'Ghi chú': product.ghiChu || '',
    'Tự nhập': Number(product.tuNhap) ? 1 : 0, 'Đã lưu DM': Number(product.daLuuDM) ? 1 : 0,
    'Thuộc tính thêm': product.extra ? JSON.stringify(product.extra) : ''
  };
  Object.assign(fields, computeDerived_(von, product.chietKhau, ban, product.ckKhach, sl));
  const rec = await lark.createRecord(config.tables.lines, fields);
  return recToLine_(rec);
}
function addBlankLine(maDA, opts) {
  opts = opts || {};
  return addLine(maDA, { ten: 'Hạng mục mới', dvt: 'Cái', donGiaVon: 0, donGiaBan: 0,
    tang: opts.tang || '', nhom: opts.nhom || '' }, 0);
}
async function updateLine(lineId, fields) {
  await setup();
  var rec;
  try { rec = await lark.getRecord(config.tables.lines, lineId); } catch (e) { return null; }
  if (!rec) return null;
  const cur = recToLine_(rec);
  const tmap = {
    nhom: 'Nhóm', loai: 'Hạng mục', ten: 'Tên sản phẩm', moTa: 'Mô tả', dvt: 'ĐVT',
    khuVuc: 'Khu vực', ncc: 'NCC', maBanVe: 'Mã bản vẽ', tang: 'Tầng', maSP: 'Mã SP',
    thuongHieu: 'Thương hiệu', kichThuoc: 'Kích thước', hinhAnh: 'Hình ảnh',
    chietKhau: 'Chiết khấu (%)', trangThai: 'Trạng thái', ghiChu: 'Ghi chú'
  };
  const upd = {};
  Object.keys(tmap).forEach(function (k) {
    if (fields.hasOwnProperty(k)) {
      upd[tmap[k]] = (k === 'chietKhau') ? (Number(fields[k]) || 0) : (fields[k] == null ? '' : fields[k]);
    }
  });
  if (fields.hasOwnProperty('tuNhap')) upd['Tự nhập'] = Number(fields.tuNhap) ? 1 : 0;
  if (fields.hasOwnProperty('daLuuDM')) upd['Đã lưu DM'] = Number(fields.daLuuDM) ? 1 : 0;
  if (fields.hasOwnProperty('stt')) upd['STT'] = Number(fields.stt) || 0;   // lưu thứ tự khi kéo sắp xếp
  if (fields.hasOwnProperty('extra')) upd['Thuộc tính thêm'] = JSON.stringify(fields.extra || {});

  var sl = fields.hasOwnProperty('soLuong') ? Number(fields.soLuong) || 0 : cur.soLuong;
  var von = fields.hasOwnProperty('donGiaVon') ? toNumber_(fields.donGiaVon) : cur.donGiaVon;
  var ln = fields.hasOwnProperty('lnPct') ? Number(fields.lnPct) || 0 : cur.lnPct;
  var ckK = fields.hasOwnProperty('ckKhach') ? Number(fields.ckKhach) || 0 : (cur.ckKhach || 0);
  var ban;
  if (fields.hasOwnProperty('donGiaBan')) {
    ban = toNumber_(fields.donGiaBan);
    ln = von > 0 ? Math.round((ban - von) / von * 100) : 0;
  } else {
    ban = round0_(von * (1 + ln / 100));
  }
  var ckDaiLy = fields.hasOwnProperty('chietKhau') ? Number(fields.chietKhau) || 0 : (cur.chietKhau || 0);
  const donGiaCK = round0_(ban * (1 - ckK / 100));           // đơn giá sau chiết khấu khách
  const ttVon = round0_(sl * von), ttBan = round0_(sl * donGiaCK);
  upd['Số lượng'] = sl; upd['Đơn giá vốn'] = von; upd['% Lợi nhuận'] = ln;
  upd['Đơn giá bán'] = ban; upd['Chiết khấu khách (%)'] = ckK;
  upd['Thành tiền vốn'] = ttVon; upd['Thành tiền bán'] = ttBan;
  Object.assign(upd, computeDerived_(von, ckDaiLy, ban, ckK, sl));   // đồng bộ cột tính sẵn sang Lark
  await lark.updateRecord(config.tables.lines, lineId, upd);
  return { lineId: lineId, soLuong: sl, donGiaVon: von, lnPct: ln, donGiaBan: ban, ckKhach: ckK,
    thanhTienVon: ttVon, thanhTienBan: ttBan };
}
async function deleteLine(lineId) {
  await setup();
  try { await lark.deleteRecord(config.tables.lines, lineId); return { ok: true }; }
  catch (e) { return { ok: false }; }
}

/*** ===== LƯU DÒNG THÀNH SẢN PHẨM (ghi vào bảng Danh mục SP) ===== ***/
async function saveLineAsProduct(p) {
  await setup();
  p = p || {};
  const ten = String(p.ten || '').trim();
  if (!ten) throw new Error('Chưa có TÊN SẢN PHẨM.');
  const fm = await productFieldMap();
  if (!fm.ten) throw new Error('Bảng sản phẩm không có cột Tên sản phẩm để lưu.');
  const th = String(p.thuongHieu || '').trim();
  const kt = String(p.kichThuoc || '').trim();
  const key = normalize_(ten) + '|' + normalize_(th) + '|' + normalize_(kt);
  // chống trùng (dựa cache danh mục)
  const prods = await getProductsCached();
  for (var i = 0; i < prods.length; i++) {
    const k = normalize_(prods[i].ten) + '|' + normalize_(prods[i].thuongHieu) + '|' + normalize_(prods[i].kichThuoc);
    if (k === key) throw new Error('Sản phẩm này đã có sẵn trong danh mục.');
  }
  const hangMuc = String(p.hangMuc || '').trim() || String(p.nhom || '').trim();
  const dvt = String(p.dvt || '').trim() || 'Cái';
  const gia = round0_(toNumber_(p.gia != null ? p.gia : p.donGiaBan));
  const fields = {};
  function put(name, val) { var v = fieldValue_(fm, name, val); if (v !== undefined) fields[name] = v; }
  put(fm.ten, ten); put(fm.th, th); put(fm.ncc, String(p.ncc || '').trim());
  put(fm.ma, String(p.ma || '').trim()); put(fm.hm, hangMuc); put(fm.mota, String(p.moTa || '').trim());
  put(fm.kt, kt); put(fm.dvt, dvt); put(fm.gia, gia); put(fm.nhom, String(p.nhom || '').trim());
  const img = String(p.hinhAnh || '').trim();
  if (fm.img && img && img.indexOf('http') === 0) put(fm.img, img); // chỉ set khi field ảnh là URL text
  await lark.createRecord(config.tables.products, fields);
  clearProductsCache();
  return {
    ma: String(p.ma || '').trim(), ten: ten, thuongHieu: th, ncc: String(p.ncc || '').trim(),
    nhom: String(p.nhom || '').trim(), hangMuc: hangMuc, moTa: String(p.moTa || '').trim(), kichThuoc: kt,
    hinhAnh: img, link: '', dvt: dvt, donGiaVon: gia, donGiaBan: gia, lnPct: 0
  };
}

/*** ===== TỜ BÌA / KHÁI TOÁN ===== ***/
async function getCover(maDA) {
  await setup();
  const recs = await lark.findByField(config.tables.cover, 'Mã DA', maDA);
  return recs.map(function (r) {
    const f = r.fields || {};
    return { stt: cellText(f['STT']), hangMuc: cellText(f['Hạng mục']), moTa: cellText(f['Mô tả']), chiPhi: toNumber_(f['Chi phí']) };
  });
}
async function saveCover(maDA, rows) {
  await setup();
  const old = await lark.findByField(config.tables.cover, 'Mã DA', maDA);
  await lark.batchDelete(config.tables.cover, old.map(function (r) { return r.record_id; }));
  rows = rows || [];
  if (rows.length) {
    const recs = rows.map(function (row, i) {
      return { 'Mã DA': maDA, 'STT': String(row.stt || (i + 1)), 'Hạng mục': String(row.hangMuc || ''),
        'Mô tả': String(row.moTa || ''), 'Chi phí': toNumber_(row.chiPhi) };
    });
    await lark.batchCreate(config.tables.cover, recs);
  }
  return getCover(maDA);
}
async function sumLinesByNhom_(maDA) {
  const byNhom = {};
  (await getLines(maDA)).forEach(function (l) {
    const k = normalize_(l.nhom || '');
    byNhom[k] = (byNhom[k] || 0) + l.thanhTienBan;
  });
  return byNhom;
}
async function buildCoverFromTemplate(maDA) {
  const byNhom = await sumLinesByNhom_(maDA);
  return COVER_TEMPLATE.map(function (t) {
    var chiPhi = 0;
    if (t[3]) String(t[3]).split(',').forEach(function (nm) { chiPhi += byNhom[normalize_(nm.trim())] || 0; });
    return { stt: t[0], hangMuc: t[1], moTa: t[2], chiPhi: chiPhi };
  });
}
async function getCoverOrInit(maDA) {
  const saved = await getCover(maDA);
  const hasHier = saved.some(function (s) { return String(s.stt).indexOf('.') >= 0; });
  if (saved.length && hasHier) return saved;
  return buildCoverFromTemplate(maDA);
}
function coverComputed_(cover) {
  const cost = {};
  function depth(s) { return String(s).split('.').length; }
  cover.forEach(function (c) { cost[c.stt] = Number(c.chiPhi) || 0; });
  var total = 0;
  cover.forEach(function (c) { if (depth(c.stt) === 1) total += cost[c.stt]; });
  return { cost: cost, total: total };
}

/*** ===== DASHBOARD / QUOTE ===== ***/
async function getDashboard(maDA) {
  const project = await getProject(maDA);
  const lines = await getLines(maDA);
  var von = 0, ban = 0, kl = 0;
  const groups = {};
  lines.forEach(function (l) {
    von += l.thanhTienVon; ban += l.thanhTienBan; kl += l.soLuong;
    const key = l.nhom || 'Khác';
    if (!groups[key]) groups[key] = { nhom: key, von: 0, ban: 0, ln: 0, count: 0 };
    groups[key].von += l.thanhTienVon; groups[key].ban += l.thanhTienBan;
    groups[key].ln += (l.thanhTienBan - l.thanhTienVon); groups[key].count++;
  });
  const byGroup = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.ban - a.ban; });
  const loiNhuan = ban - von;
  return { project: project, tongHangMuc: lines.length, tongKhoiLuong: kl, giaTriVon: von,
    tongGiaBan: ban, loiNhuan: loiNhuan, bienLN: ban > 0 ? loiNhuan / ban * 100 : 0, byGroup: byGroup };
}
async function enrichImages_(lines) {
  try {
    const prods = await getProductsCached();
    const byMa = {}, byName = {};
    prods.forEach(function (p) {
      if (!p.hinhAnh) return;
      if (p.ma) byMa[normalize_(p.ma)] = p.hinhAnh;
      if (p.ten) byName[normalize_(p.ten)] = p.hinhAnh;
    });
    lines.forEach(function (l) {
      const own = String(l.hinhAnh || '');
      if (own.indexOf('http') === 0 || own.indexOf('/media') === 0) return;
      const img = (l.maSP && byMa[normalize_(l.maSP)]) || byName[normalize_(l.ten)] || '';
      if (img) l.hinhAnh = img;
    });
  } catch (e) {}
}
async function getQuote(maDA) {
  const project = await getProject(maDA);
  const lines = await getLines(maDA);
  await enrichImages_(lines);
  var subtotal = 0;
  lines.forEach(function (l) { subtotal += l.thanhTienBan; });
  const vatPct = project ? Number(project.vat) || 0 : 0;
  const vat = round0_(subtotal * vatPct / 100);
  return { project: project, lines: lines, subtotal: subtotal, vatPct: vatPct, vat: vat, total: subtotal + vat };
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
  for (const k2 in IMPORT_ALIAS) for (var j = 0; j < IMPORT_ALIAS[k2].length; j++) if (n.indexOf(normalize_(IMPORT_ALIAS[k2][j])) !== -1) return k2;
  return null;
}
function pick2_(row, idx) { return (idx == null) ? '' : String(row[idx] == null ? '' : row[idx]).trim(); }
async function importParse(base64, ext) {
  const ExcelJS = require('exceljs');
  const buf = Buffer.from(String(base64 || ''), 'base64');
  const wb = new ExcelJS.Workbook();
  if (String(ext || '').toLowerCase().indexOf('csv') >= 0) {
    const Readable = require('stream').Readable;
    await wb.csv.read(Readable.from(buf.toString('utf8')));
  } else {
    await wb.xlsx.load(buf);
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File không có sheet dữ liệu');
  const grid = [];
  ws.eachRow({ includeEmpty: false }, function (row) {
    const arr = []; row.eachCell({ includeEmpty: true }, function (cell, col) { arr[col - 1] = importCell_(cell.value); });
    grid.push(arr);
  });
  if (!grid.length) throw new Error('File rỗng');
  var hr = -1, map = null;
  for (var i = 0; i < Math.min(grid.length, 15); i++) {
    var m = {}; grid[i].forEach(function (h, ci) { var key = matchAlias_(h); if (key && m[key] === undefined) m[key] = ci; });
    if (m.ten !== undefined) { hr = i; map = m; break; }
  }
  if (hr < 0) throw new Error('Không tìm thấy cột "Tên sản phẩm" trong file (cần 1 cột tiêu đề có chữ Tên / Name)');
  const products = [];
  for (var r = hr + 1; r < grid.length; r++) {
    var row = grid[r]; var ten = pick2_(row, map.ten); if (!ten) continue;
    products.push({
      ten: ten, nhom: pick2_(row, map.nhom), hangMuc: pick2_(row, map.hangMuc), thuongHieu: pick2_(row, map.thuongHieu),
      ncc: pick2_(row, map.ncc), ma: pick2_(row, map.ma), kichThuoc: pick2_(row, map.kichThuoc),
      dvt: pick2_(row, map.dvt) || 'Cái', gia: round0_(toNumber_(pick2_(row, map.gia))),
      moTa: pick2_(row, map.moTa), hinhAnh: pick2_(row, map.hinhAnh)
    });
    if (products.length >= 2000) break;
  }
  var headers = grid[hr].map(function (h) { return String(h == null ? '' : h); });
  var mapped = {}; Object.keys(map).forEach(function (k) { mapped[k] = headers[map[k]]; });
  return { count: products.length, products: products, mapped: mapped };
}
async function importCommit(products) {
  await setup();
  const fm = await productFieldMap();
  if (!fm.ten) throw new Error('Bảng danh mục không có cột Tên sản phẩm');
  const recs = (products || []).filter(function (p) { return p && String(p.ten || '').trim(); }).map(function (p) {
    const f = {}; function put(name, val) { var v = fieldValue_(fm, name, val); if (v !== undefined) f[name] = v; }
    put(fm.ten, String(p.ten).trim()); put(fm.nhom, p.nhom); put(fm.hm, p.hangMuc); put(fm.th, p.thuongHieu);
    put(fm.ncc, p.ncc); put(fm.ma, p.ma); put(fm.kt, p.kichThuoc); put(fm.dvt, p.dvt || 'Cái');
    put(fm.gia, round0_(toNumber_(p.gia))); put(fm.mota, p.moTa);
    if (fm.img && p.hinhAnh && String(p.hinhAnh).indexOf('http') === 0) put(fm.img, p.hinhAnh);
    return f;
  });
  if (!recs.length) throw new Error('Không có sản phẩm hợp lệ để nhập');
  await lark.batchCreate(config.tables.products, recs);
  clearProductsCache();
  return { inserted: recs.length };
}

module.exports = {
  setup, bootstrap, buildCatalog,
  getProducts, getProductsCached, clearProductsCache, getCatalogSheets, getSheetCols,
  getProjects, getProject, createProject, updateProject, deleteProject,
  getLines, addLine, addBlankLine, updateLine, deleteLine, saveLineAsProduct,
  getCover, saveCover, buildCoverFromTemplate, getCoverOrInit, coverComputed_,
  getDashboard, getQuote, importParse, importCommit,
  // dùng nội bộ cho export
  _S32_SUPPLIERS: S32_SUPPLIERS, _normalize: normalize_, _toNumber: toNumber_, _round0: round0_
};
