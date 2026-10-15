'use strict';
/* Sinh testdata/golden.json: gọi từng hàm export của server/shared.js (mã Node là chuẩn gốc) trên nhiều đầu vào.
   Chạy:  TZ=UTC node backend/internal/shared/qscore/testdata/gen.js
   (TZ=UTC vì ô CSV dạng ngày có độ lệch giờ phụ thuộc múi giờ máy; test Go cũng đặt UTC.)
   shared.js là hàm thuần, không nạp supa / không chạm database. */
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '../../../../..');
const shared = require(path.join(root, 'server/shared.js'));
const ExcelJS = require(path.join(root, 'node_modules/exceljs'));
const JSZip = require(path.join(root, 'node_modules/jszip'));
const VS = require(path.join(root, 'backend/internal/shared/specs/js/vs-spec.js'));
const SON = require(path.join(root, 'backend/internal/shared/specs/js/son-spec.js'));
const CT = require(path.join(root, 'backend/internal/shared/specs/js/ct-spec.js'));

// undefined / NaN / Infinity không ghi được bằng JSON -> bọc lại
function enc(v) {
  if (v === undefined) return { $u: 1 };
  if (typeof v === 'number' && !isFinite(v)) return { $n: String(v) };
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = enc(v[k]); return o; }
  return v;
}
const cases = [];
function add(fn, args, name) {
  let out, err;
  try { out = JSON.stringify(shared[fn].apply(null, args)); } catch (e) { err = e.message; }
  const c = { fn: fn, args: enc(args) };
  if (name) c.name = name;
  if (err !== undefined) c.err = err; else c.out = out === undefined ? 'undefined' : out;
  cases.push(c);
}

/* ---------- inCode ---------- */
[['3.2.6.1', '3.2.6'], ['3.2.6', '3.2.6'], [' 3.2.6 ', '3.2.6'], ['3.2.61', '3.2.6'], ['3.2', '3.2.6'], [null, '3'], [undefined, '3'], ['', ''],
  ['.x', ''], [3.2, '3'], [3, '3'], [3, 3], ['3.1', 3], [0, '0'], ['0', '0'], [false, 'false'], [true, 'true'], ['true.1', true],
  ['\u00a03.2.1\t', '3.2'], ['3.2.1', '3.2.'], ['a.b.c', 'a.b'], ['null.1', null], ['undefined.x', undefined], [['3', '2'], '3,2'],
  ['4.10', '4.1'], ['4.1.0', '4.1'], ['1', '1.1']].forEach(a => add('inCode', a));

/* ---------- normalize_ ---------- */
['Tên sản phẩm', '  ĐƠN   GIÁ\tBÁN  ', 'đường Đà Nẵng', 'Hướng dẫn', 'HƯỚNG  DẪN', 'huong dan', null, undefined, '', 0, 12.5, true, false,
  'straße', 'ﬁle ﬂow', 'İstanbul ı', 'ǆ ǈ ŉ', 'Ünïcödé çà', 'e\u0301 e\u0300\u0323', 'a\u00a0b\u2003c\u3000d\ufeffe', '\n\r\t x \n', 'ÅÆØ åæø',
  'Giá (VNĐ) / m²', 'ΑΒΓ αβγ ς', 'Привет', '日本語 テスト', 'Mã SP #1', 'ấầẩẫậ ắằẳẵặ ếềểễệ ốồổỗộ ớờởỡợ ứừửữự', 'ỲÝỴỶỸ ỳýỵỷỹ',
  ['a', 'b'], 'ǅ', 'ա ﬓ', '😀 emoji é'].forEach(s => add('normalize_', [s]));

/* ---------- toNumber_ ---------- */
[0, 1, -1, 12.5, -0.25, 1e21, NaN, Infinity, -Infinity, null, undefined, '', ' ', '0', '12', '12,5', '12.5', '1.234', '1.234.567', '1,234,567',
  '1.234,56', '1,234.56', '1.234.567,89', '1,234,567.89', '12.345', '12.3456', '12.34', '0.125', '.125', '.5', ',5', '5,', '5.', '1.000',
  '1,000', '1,000,000', '10%', '12,5%', '-12,5 %', '- 5', '5-', '--5', '1-2', '(1.234)', '1.234 đ', '1 234 567', '1\u00a0234\u00a0567', '₫ 15.000',
  'VND 2,500,000.00', 'abc', '1e3', '1E+5', '0x10', '  42  ', '+7', '1.2.3', '1,2,3', '1,2.3', '1.2,3', '1.234,567.8', '..5', ',,5', '1,,5',
  '1.,5', '1,.5', '00012', '0,50', '0.500', '100.000.000', '99.999', '99.99', '1.5e3', 'Liên hệ', '12 triệu', '3/4', '１２３', '٣', true, false,
  ['1.234'], [1, 2], { a: 1 }, '-', '.', ',', '-.', '1-', '12.345,', '12,345.', '1.234.', '.123', '-.123', '-1.234', '1.2345678', '123456.789',
  '9007199254740993', '0,1', '0.1', '1,23456789012345678'].forEach(v => add('toNumber_', [v]));

/* ---------- round0_ ---------- */
[0, 0.4, 0.5, 0.6, 1.5, 2.5, -0.4, -0.5, -0.6, -1.5, -2.5, 1e21, 123456789.5, 0.49999999999999994, NaN, Infinity, -Infinity, null, undefined, '',
  '12.5', '12,5', ' 7.5 ', 'abc', true, false, [], [3.5], ['x'], {}, '0x1f', '1e2', -0, 4503599627370497.5, 2147483647.5, -2147483648.5]
  .forEach(v => add('round0_', [v]));

/* ---------- coverComputed_ ---------- */
const tmplCover = shared.COVER_TEMPLATE.map((t, i) => ({ stt: t[0], hangMuc: t[1], moTa: t[2], chiPhi: (i * 137.5 + 1000) % 977 * 1000 + (i % 3 ? 0.1 : 0) }));
add('coverComputed_', [tmplCover], 'template');
add('coverComputed_', [[]], 'empty');
add('coverComputed_', [[{ stt: '1', chiPhi: 5 }]], 'single');
add('coverComputed_', [[{ stt: '2', chiPhi: 1 }, { stt: '1', chiPhi: 2 }, { stt: '10', chiPhi: 3 }, { stt: '1.1', chiPhi: 4 }, { stt: '1.10', chiPhi: 5 }, { stt: 'A', chiPhi: 6 }, { stt: 'A.1', chiPhi: 7 }]], 'key-order');
add('coverComputed_', [[{ stt: 1, chiPhi: '5' }, { stt: 1.5, chiPhi: 2 }, { stt: '1.5', chiPhi: 9 }, { stt: '1.5.1', chiPhi: '3.5' }, { stt: 2, chiPhi: null }, { stt: '2.1' }, { stt: '2.1.1', chiPhi: 'abc' }, { stt: '2.1.2', chiPhi: true }]], 'mixed-types');
add('coverComputed_', [[{ stt: '3', chiPhi: 100 }, { stt: '3.2', chiPhi: 50 }, { stt: '3.2.1', chiPhi: 0.1 }, { stt: '3.2.2', chiPhi: 0.2 }, { stt: '3.2.2', chiPhi: 0.7 }, { stt: '3.1', chiPhi: 10 }, { stt: '4', chiPhi: 1e15 }, { stt: '4.1', chiPhi: 0.3 }]], 'dup-stt');
add('coverComputed_', [[{ stt: '3.2.1', chiPhi: 7 }, { stt: '3.2', chiPhi: 1 }, { stt: '5.1', chiPhi: 2 }, { stt: '', chiPhi: 3 }, { stt: '.1', chiPhi: 4 }, { chiPhi: 5 }, { stt: null, chiPhi: 6 }, { stt: 'null.x', chiPhi: 8 }]], 'odd-stt');
add('coverComputed_', [[{ stt: '1', chiPhi: -5.5 }, { stt: '1.1', chiPhi: '1e3' }, { stt: '1.2', chiPhi: ' 12 ' }, { stt: '1.2.1', chiPhi: Infinity }, { stt: '2', chiPhi: NaN }]], 'non-finite');

/* ---------- importParse ---------- */
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const imports = [];
// file dùng nhiều lần chỉ ghi 1 lần vào golden.files ({$f: khoá}); file có sẵn trong repo ghi đường dẫn ({$p: ...})
const files = {}, fileKey = {};
function ref(name, base64) {
  if (typeof base64 !== 'string' || base64.length < 400) return base64;
  if (!fileKey[base64]) { fileKey[base64] = name; files[name] = base64; }
  return { $f: fileKey[base64] };
}
function imp(name, base64, ext, nganh) { imports.push({ name, args: [ref(name, base64), ext, nganh] }); }
function impPath(name, rel, ext, nganh) { imports.push({ name, args: [{ $p: rel }, ext, nganh] }); }
function resolve(a) {
  if (a && a.$f) return files[a.$f];
  if (a && a.$p) return fs.readFileSync(path.join(root, a.$p)).toString('base64');
  return a;
}
// bản sao importCell_ + phần dựng grid của importParse: đối chiếu trực tiếp lớp đọc file (trước khi dò tiêu đề)
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
async function gridOf(base64, ext) {
  const buf = Buffer.from(String(base64 || ''), 'base64');
  const wb = new ExcelJS.Workbook();
  if (String(ext || '').toLowerCase().indexOf('csv') >= 0) await wb.csv.read(require('stream').Readable.from(buf.toString('utf8')));
  else await wb.xlsx.load(buf);
  return wb.worksheets.map(function (ws) {
    const grid = [];
    ws.eachRow({ includeEmpty: false }, function (row) {
      const arr = []; row.eachCell({ includeEmpty: true }, function (cell, col) {
        let v = importCell_(cell.value);
        if (v instanceof Date) v = '<date>'; else if (v && typeof v === 'object') v = String(v);
        else if (typeof v === 'number' && !isFinite(v)) v = String(v);
        arr[col - 1] = v;
      });
      grid.push(arr);
    });
    return { name: ws.name, grid: grid };
  });
}

async function wbB64(build) { const wb = new ExcelJS.Workbook(); await build(wb); return Buffer.from(await wb.xlsx.writeBuffer()).toString('base64'); }

// zip thủ công theo kiểu Excel ghi (kiểm tra các nhánh ExcelJS mà chính nó không tự ghi ra)
const CT_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
async function rawXlsx(o) {
  const z = new JSZip();
  const sheets = o.sheets;
  z.file('[Content_Types].xml', CT_XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  z.file('_rels/.rels', CT_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="t" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml', o.workbook || (CT_XML + '<workbook ' + NS + '><sheets>' +
    sheets.map((s, i) => '<sheet name="' + s.name + '" sheetId="' + (s.id || i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'));
  z.file('xl/_rels/workbook.xml.rels', o.rels || (CT_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="ws" Target="' + (s.target || ('worksheets/sheet' + (s.file || i + 1) + '.xml')) + '"/>').join('') + '</Relationships>'));
  if (o.sst) z.file('xl/sharedStrings.xml', CT_XML + '<sst ' + NS + '>' + o.sst.join('') + '</sst>');
  if (o.styles) z.file('xl/styles.xml', CT_XML + '<styleSheet ' + NS + '>' + o.styles + '</styleSheet>');
  sheets.forEach((s, i) => {
    const no = s.file || i + 1;
    z.file('xl/worksheets/sheet' + no + '.xml', CT_XML + '<worksheet ' + NS + '>' + (s.pre || '') + '<sheetData>' + s.data + '</sheetData>' + (s.post || '') + '</worksheet>');
    if (s.rels) z.file('xl/worksheets/_rels/sheet' + no + '.xml.rels', CT_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + s.rels + '</Relationships>');
  });
  (o.extra || []).forEach(e => z.file(e[0], e[1]));
  return (await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })).toString('base64');
}
const si = t => '<si><t>' + t + '</t></si>';
const STYLES = '<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0\\ &quot;đ&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="#,##0\\ \\d"/><numFmt numFmtId="167" formatCode="[$-409]#,##0.00"/></numFmts>' +
  '<fonts count="1"><font><sz val="11"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="14" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  // 0 General · 1 đ · 2 dd/mm/yyyy · 3 id14 · 4 "#,##0 d" · 5 [$-409] · 6 "0.00" · 7 "@" · 8 h:mm · 9 không numFmtId
  '<cellXfs count="10"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="14"/><xf numFmtId="166"/><xf numFmtId="167"/><xf numFmtId="2"/><xf numFmtId="49"/><xf numFmtId="20"/><xf fontId="0"/></cellXfs>' +
  '<dxfs count="1"><dxf><numFmt numFmtId="168" formatCode="yyyy"/></dxf></dxfs>';

async function buildImports() {
  /* 1) Thiết bị đèn (mặc định): file thực tế - tiêu đề lộn xộn ở dòng 3, ô gộp, công thức, số thập phân, link, rich text */
  const den = await wbB64(async wb => {
    const ws = wb.addWorksheet('Bảng giá đèn');
    ws.mergeCells('A1:H1'); ws.getCell('A1').value = 'BẢNG GIÁ ĐÈN LED 2026';
    ws.getCell('A2').value = 'Áp dụng từ'; ws.getCell('B2').value = new Date(Date.UTC(2026, 0, 15));
    ws.addRow([]);
    ws.addRow(['STT', '  Tên  Sản Phẩm ', 'Mã SP', 'Thương hiệu', 'ĐVT', 'Đơn giá bán (VNĐ)', 'Chiết khấu (%)', 'Link ảnh', 'Công suất (W)', 'Ghi chú', 'Bảo hành', 'Màu sắc', 'NCC']);
    ws.addRow([1, 'Đèn LED âm trần 9W', 'DL-09', 'Rạng Đông', 'Cái', 125000, 12.5, 'https://example.com/a.jpg', 9, 'Ánh sáng trắng', '24 tháng', 'Trắng', 'Điện Quang']);
    ws.addRow([2, 'Đèn tuýp 1m2', 'T8-120', 'Philips', '', 89500.5, 0, null, 18, '', '', '', '']);
    ws.addRow([3, { richText: [{ font: { bold: true }, text: 'Đèn ' }, { text: 'pha 50W' }] }, 'FL-50', 'Ades Lighting', 'Bộ', { formula: 'F5*2', result: 250000 }, 12.125, { text: 'ảnh pha', hyperlink: 'https://example.com/pha.png' }, 50, { formula: 'B7&"x"', result: 'ghi chú công thức' }, true, 'Đen', 'NCC A']);
    ws.addRow([4, '   ', 'X', 'Y']);
    ws.addRow([5, 'Đèn bàn', 12345, 'Xiaomi', 'Cái', '1.250.000 đ', '10%', '', 0.1 + 0.2, null, 1e21, 1e-7, 1234.567]);
    ws.addRow([]);
    ws.addRow([6, 'Đèn ngủ ', 'DN-01', '', 'Cái', '350,000', null, null, null, null, null, null, null]);
    ws.mergeCells('C12:D13'); ws.getCell('B12').value = 'Đèn chùm (ô gộp)'; ws.getCell('C12').value = 'GỘP'; ws.getCell('F12').value = { formula: 'SUM(F5:F6)' };
    ws.getCell('B13').value = 'Đèn chùm 2'; ws.getCell('F13').value = { formula: '1/0', result: { error: '#DIV/0!' } };
    ws.getCell('B14').value = 'Đèn số 0'; ws.getCell('F14').value = { formula: '0*1', result: 0 }; ws.getCell('E14').value = { formula: 'FALSE()', result: false };
    ws.getCell('B15').value = 0; ws.getCell('B16').value = false; ws.getCell('B17').value = -1.5;
    wb.addWorksheet('Sheet phụ').addRow(['Tên', 'Giá']);
  });
  imp('den-realistic', den, 'xlsx');
  imp('den-realistic-ext-upper', den, '.XLSX', undefined);
  imp('den-realistic-nganh-den', den, 'xlsx', 'den');

  /* 2) Thiết bị vệ sinh: nhiều sheet theo hạng mục + sheet Hướng dẫn + dòng ví dụ + hạng mục gõ không dấu */
  const hm = VS.HANG_MUC;
  const vs = await wbB64(async wb => {
    const hd = wb.addWorksheet('Hướng dẫn'); hd.addRow(['Tên sản phẩm', 'Giá bán lẻ']); hd.addRow(['KHÔNG ĐƯỢC ĐỌC', 1]);
    const a = wb.addWorksheet('San pham');
    a.addRow(['THƯƠNG HIỆU', 'NHÀ CUNG CẤP', 'HẠNG MỤC', 'DÒNG SẢN PHẨM', 'TÊN SẢN PHẨM', 'MÃ SẢN PHẨM', 'GIÁ BÁN LẺ', 'CHIẾT KHẤU ĐẠI LÝ (%)', 'ĐƠN VỊ TÍNH', 'MÀU SẮC', 'KÍCH THƯỚC', 'ẢNH SẢN PHẨM', 'BẢO HÀNH (năm)', 'GHI CHÚ']);
    a.addRow(['TOTO', 'TOTO VN', hm[0], 'Một khối', VS.VD + ' Bồn cầu một khối', 'MS889', 12500000, 25, 'Bộ', 'Trắng', 'L700 x W400', 'https://x/y.jpg', 2, 'dòng ví dụ']);
    a.addRow(['TOTO', 'TOTO VN', '  bon   cau ', 'Một khối', 'Bồn cầu MS889', 'MS889DRT8', 12500000, 25.5, 'Bộ', 'Trắng', 'L700 x W400 x H655', 'https://x/y.jpg', 2, '']);
    a.addRow(['Kohler', '', 'LAVABO', '', 'Lavabo đặt bàn', 'K-2660', '8.900.000', '12,125', '', 'Trắng', '', '', 1.5, 'x']);
    a.addRow(['INAX', '', 'Hạng mục lạ', '', 'SP hạng mục lạ', 'I-1', 100.5, null, 'Cái']);
    a.addRow(['INAX', '', '', '', 'SP không hạng mục', 'I-2', 99.999, 0.5, 'Cái']);
    const b = wb.addWorksheet(hm[4]);
    b.addRow(['Ghi chú: sheet kiểu cũ, 1 sheet / hạng mục']);
    b.addRow(['Tên SP', 'Mã', 'Giá', 'Chế độ phun', 'Ảnh', 'Màu sắc', 'Bảo hành']);
    b.addRow(['Sen cây nóng lạnh', 'S-01', 4500000, '3 chế độ', 'https://x/s.png', 'Chrome', '5 năm']);
    b.addRow(['Sen tay', 'S-02', 450000.75, '', '', '', '']);
    const c = wb.addWorksheet('Không phải hạng mục'); c.addRow(['Name', 'Price', 'Hạng mục']); c.addRow(['Vòi xịt', 150000, 'voi lavabo']); c.addRow(['Phụ kiện X', '', '']);
    wb.addWorksheet('Sheet rỗng');
    const d = wb.addWorksheet('Không có cột tên'); d.addRow(['Mã', 'Giá']); d.addRow(['A', 1]);
  });
  imp('vs-multi-sheet', vs, 'xlsx', 'vs');
  imp('vs-file-read-as-den', vs, 'xlsx');
  imp('vs-file-read-as-son', vs, 'xlsx', 'son');

  /* 3) Sơn nước + công tắc: 1 sheet, không có cột HẠNG MỤC (tự chèn vào headers), sheet tên = hạng mục */
  const sonHM = SON.HANG_MUC, ctHM = CT.HANG_MUC;
  const son = await wbB64(async wb => {
    const a = wb.addWorksheet(sonHM[0]);
    a.addRow(['THƯƠNG HIỆU', 'TÊN SẢN PHẨM', 'MÃ SẢN PHẨM', 'GIÁ BÁN LẺ', 'ĐƠN VỊ TÍNH', 'ĐỘ PHỦ', 'SỐ LỚP', 'KÍCH THƯỚC']);
    a.addRow(['Dulux', SON.VD + ' Sơn mẫu', 'A1', 1, 'Thùng', '', 2, '18L']);
    a.addRow(['Dulux', 'Sơn nội thất lau chùi', 'A991', 2350000, 'Thùng', 'Lên đến 13 m²/lít/lớp', 2, '18L']);
    a.addRow(['Jotun', 'Sơn ngoại thất', 'J-1', 3100000.4, '', '', 2.5, '5L']);
    const b = wb.addWorksheet('HUONG  DAN'); b.addRow(['Tên', 'x']); b.addRow(['bỏ qua', 1]);
  });
  imp('son-no-hangmuc-col', son, 'xlsx', 'son');
  const ct = await wbB64(async wb => {
    const a = wb.addWorksheet('Danh sách');
    a.addRow(['TÊN SẢN PHẨM', 'HẠNG MỤC', 'SỐ NÚT (gang)', 'GIÁ BÁN LẺ', 'constructor', 'toString', '2024', '10', 'TÊN SẢN PHẨM', 'Mã màu', 'Ảnh hưởng', 'Giá trị', 'Nhóm sản phẩm']);
    a.addRow(['Công tắc 1 nút', ctHM[0].toUpperCase(), 1, 65000, 'c1', 't1', 'y', 'ten', 'tên trùng cột', 'M1', 'ah', 'gt', 'nsp']);
    a.addRow([CT.VD + 'x', ctHM[1], 2, 1, '', '', '', '', '', '', '', '', '']);
    a.addRow(['Ổ cắm đôi', ctHM[ctHM.length - 1], '2', '85.000', '', '', '', '', '', '', '', '', '']);
  });
  imp('ct-proto-headers', ct, 'xlsx', 'ct');
  imp('ct-file-as-den', ct, 'xlsx', null);

  /* 4) Giới hạn 2000 dòng + tiêu đề nằm ngoài 15 dòng đầu */
  imp('limit-2000', await wbB64(async wb => {
    const a = wb.addWorksheet('A'); a.addRow(['Tên', 'Giá']);
    for (let i = 0; i < 1500; i++) a.addRow(['SP ' + i, i * 1000.5]);
    const b = wb.addWorksheet('B'); b.addRow(['Tên', 'Giá', 'Cột riêng B']);
    for (let i = 0; i < 700; i++) b.addRow(['SPB ' + i, i, 'b']);
    const c = wb.addWorksheet('C'); c.addRow(['Tên', 'Cột riêng C']); c.addRow(['không tới', 1]);
  }), 'xlsx', 'vs');
  imp('header-row-16', await wbB64(async wb => {
    const a = wb.addWorksheet('A'); for (let i = 0; i < 15; i++) a.addRow(['dòng ' + i]); a.addRow(['Tên', 'Giá']); a.addRow(['x', 1]);
  }), 'xlsx');
  imp('header-row-15-with-gaps', await wbB64(async wb => {
    const a = wb.addWorksheet('A'); for (let i = 0; i < 14; i++) a.getCell('A' + (i * 3 + 1)).value = 'dòng ' + i; a.getCell('B60').value = 'Product name'; a.getCell('C60').value = 'Unit'; a.getCell('B70').value = 'x';
  }), 'xlsx');
  imp('no-name-column', await wbB64(async wb => { wb.addWorksheet('A').addRow(['Mã', 'Giá']); }), 'xlsx');
  imp('empty-workbook-sheet', await wbB64(async wb => { wb.addWorksheet('A'); }), 'xlsx');
  imp('alias-priority', await wbB64(async wb => {
    const a = wb.addWorksheet('A');
    a.addRow(['Mã màu', 'Tên hàng hoá', 'Tên', 'Giá vốn', 'Đơn giá', 'Bảo hành', 'Hình ảnh SP', 'Image URL', 'Nhóm', 'Category', 'Đơn vị', 'Size (mm)', 'Quy cách', 'SKU', 'Supplier', 'Description', 'Ghi chú', 'Brand', 'Hãng']);
    a.addRow(['mm', 'th', 't', '1.000', '2.000', 'bh', 'img1', 'img2', 'n', 'c', 'dv', 's', 'qc', 'sku', 'sup', 'd', 'gc', 'b', 'h']);
  }), 'xlsx');

  /* 5) XML kiểu Excel: chuỗi dùng chung (thường / rich / phiên âm / rỗng / _x000D_), inlineStr, str, bool, lỗi, ngày, hyperlink, ô gộp, ô thiếu r */
  const sst = [si('Tên'), si('Giá'), si('Ngày'), si('Ghi chú'), '<si><r><rPr><b/><sz val="11"/></rPr><t>Đèn </t></r><r><t xml:space="preserve">rich  </t></r><r><rPr><i/></rPr></r></si>',
    '<si><t>東京</t><rPh sb="0" eb="2"><t>トウキョウ</t></rPh><phoneticPr fontId="1"/></si>', '<si/>', si('dòng 1_x000D_\ndòng 2 _x0041__x00e9_'), si(''), '<si><t xml:space="preserve">  có khoảng trắng  </t></si>',
    si('A &amp; B &lt;c&gt; &amp;amp;'), si('Link'), si('SP hyperlink'), si('Mã')];
  imp('raw-excel-types', await rawXlsx({
    sst, styles: STYLES, sheets: [{
      name: 'Dữ liệu &amp;amp; thử',
      data: '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>11</v></c><c r="F1" t="s"><v>13</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" s="1"><v>1250000</v></c><c r="C2" s="2"><v>45000</v></c><c r="D2" t="s"><v>7</v></c><c r="E2" t="s"><v>12</v></c><c r="F2" s="4"><v>5</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3" s="3"><v>45000.5</v></c><c r="C3" s="5"><v>1234.5</v></c><c r="D3" t="s"><v>9</v></c><c r="E3"><v>7</v></c><c r="F3" s="8"><v>0.5</v></c></row>' +
        '<row r="4"><c r="A4" t="inlineStr"><is><t>inline thường</t></is></c><c r="B4" s="6"><v>0.1</v></c><c r="C4" t="b"><v>1</v></c><c r="D4" t="e"><v>#N/A</v></c><c r="E4" s="1"/><c r="F4" s="9"><v>77</v></c></row>' +
        '<row r="5"><c r="A5" t="inlineStr"><is><r><t>inline </t></r><r><rPr><b/></rPr><t>rich_x0021_</t></r></is></c><c r="B5" t="str"><f>A1&amp;"x"</f><v>Tên &amp;amp; x</v></c><c r="C5" t="b"><v>0</v></c><c r="D5" t="s"><v>10</v></c><c r="E5" t="s"><v>6</v></c></row>' +
        '<row r="6"><c r="A6" t="str"><v>chuỗi str &amp;lt;b&amp;gt;</v></c><c r="B6"><f>1+1</f><v>2</v></c><c r="C6" s="2"><f>TODAY()</f><v>46000</v></c><c r="D6" t="b"><f>TRUE()</f><v>1</v></c><c r="E6" t="e"><f>1/0</f><v>#DIV/0!</v></c><c r="F6"><f t="shared" si="0"/><v>3.75</v></c></row>' +
        '<row r="7"><c r="A7" t="s"><v>8</v></c><c r="B7"><f>0</f><v>0</v></c><c r="C7"><f>X1</f></c><c r="D7" t="str"><f>""</f><v></v></c><c r="E7" t="b"><f>FALSE()</f><v>0</v></c></row>' +
        '<row r="8" spans="1:6"><c r="A8" s="1"/><c r="B8" s="2"/><c r="C8"/></row>' +
        '<row r="9"><c r="A9" t="s"><v>8</v></c></row>' +
        '<row r="11"><c r="B11" t="inlineStr"><is><t>B11</t></is></c><c><v>1.5</v></c><c t="b"><v>1</v></c><c/><c><v>9</v></c></row>' +
        '<row r="12"><c r="A12" t="inlineStr"><is><t>số lạ</t></is></c><c r="B12"><v> 12.50 </v></c><c r="C12"><v>1E+3</v></c><c r="D12"><v>abc</v></c><c r="E12" t="n"><v>-0</v></c><c r="F12" t="d"><v>2024-01-05T00:00:00Z</v></c></row>' +
        '<row r="13"><c r="A13" t="inlineStr"><is><t>link</t></is></c><c r="B13" t="s"><v>12</v></c><c r="C13"><v>42</v></c><c r="D13" s="1"/><c r="E13"/><c r="F13" t="s"><v>4</v></c><c r="G13"><f>1</f><v>0</v></c><c r="H13" t="b"><v>1</v></c><c r="I13" t="e"><v>#REF!</v></c></row>' +
        '<row r="14"><c r="A14" t="inlineStr"><is><t>gộp</t></is></c><c r="B14"><v>55</v></c><c r="C14" t="inlineStr"><is><t>bị che</t></is></c></row>' +
        '<row r="16"><c r="A16" t="inlineStr"><is><t>sau gộp</t></is></c></row>',
      post: '<mergeCells count="2"><mergeCell ref="B14:D15"/><mergeCell ref="$A$18:$B$18"/></mergeCells>' +
        '<hyperlinks><hyperlink ref="B13" r:id="rId1"/><hyperlink ref="C13" r:id="rId2" tooltip="t"/><hyperlink ref="D13" r:id="rId1"/><hyperlink ref="E13" r:id="rId2"/><hyperlink ref="F13" r:id="rId1"/><hyperlink ref="G13" r:id="rId1"/><hyperlink ref="H13" r:id="rId1"/><hyperlink ref="I13" r:id="rId1"/><hyperlink ref="A1" location="Sheet2!A1"/><hyperlink ref="Z99" r:id="rId3"/></hyperlinks>',
      rels: '<Relationship Id="rId1" Type="h" Target="https://example.com/1?a=1&amp;b=2" TargetMode="External"/><Relationship Id="rId2" Type="h" Target="mailto:a@b.c"/><Relationship Id="rId3" Type="h" Target=""/>'
    }]
  }), 'xlsx');

  /* 6) Thứ tự sheet theo workbook.xml (không theo số file / sheetId), sheet ẩn, file sheet thừa, đích có /xl/ */
  const row = (r, a, b) => '<row r="' + r + '"><c r="A' + r + '" t="inlineStr"><is><t>' + a + '</t></is></c><c r="B' + r + '"><v>' + b + '</v></c></row>';
  const order = {
    workbook: CT_XML + '<workbook ' + NS + '><sheets><sheet name="Thứ ba" sheetId="7" r:id="rId3"/><sheet name="Hướng dẫn" sheetId="1" state="hidden" r:id="rId1"/><sheet name="Thứ hai" sheetId="2" r:id="rId2"/><sheet name="Mồ côi" sheetId="9" r:id="rId99"/></sheets></workbook>',
    rels: CT_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>',
    sheets: [{ name: 'x', data: row(1, 'Tên', 1) + row(2, 'từ hướng dẫn', 1) }, { name: 'x', data: row(1, 'Tên sản phẩm', 2) + row(2, 'từ sheet 2', 2.5) },
      { name: 'x', data: row(1, 'Tên SP', 3) + row(2, 'từ sheet 3', 3.25) }, { name: 'x', data: row(1, 'Tên', 4) + row(2, 'file thừa', 4) }]
  };
  const orderB64 = await rawXlsx(order);
  imp('sheet-order-den', orderB64, 'xlsx');
  imp('sheet-order-vs', orderB64, 'xlsx', 'vs');

  /* 7) Lỗi cấu trúc */
  imp('err-dup-sheet-name', await rawXlsx({ sheets: [{ name: 'Trùng', data: row(1, 'Tên', 1) }, { name: 'trùng', data: row(1, 'Tên', 1) }] }), 'xlsx');
  imp('err-bad-sheet-name', await rawXlsx({ sheets: [{ name: 'a/b', data: row(1, 'Tên', 1) }] }), 'xlsx');
  imp('err-long-sheet-name', await rawXlsx({ sheets: [{ name: 'Tên sheet dài hơn ba mươi mốt ký tự cho phép', data: row(1, 'Tên', 1) }] }), 'xlsx');
  imp('err-history-name', await rawXlsx({ sheets: [{ name: 'History', data: row(1, 'Tên', 1) }] }), 'xlsx');
  imp('err-quote-name', await rawXlsx({ sheets: [{ name: "'a", data: row(1, 'Tên', 1) }] }), 'xlsx');
  imp('err-merge-overlap', await rawXlsx({ sheets: [{ name: 'A', data: row(1, 'Tên', 1), post: '<mergeCells><mergeCell ref="A2:B3"/><mergeCell ref="B3:C4"/></mergeCells>' }] }), 'xlsx');
  imp('err-row-no-r', await rawXlsx({ sheets: [{ name: 'A', data: '<row><c r="A1"><v>1</v></c></row>' }] }), 'xlsx');
  imp('err-first-cell-no-r', await rawXlsx({ sheets: [{ name: 'A', data: '<row r="1"><c><v>1</v></c></row>' }] }), 'xlsx');
  imp('err-sst-out-of-range', await rawXlsx({ sst: [si('Tên')], sheets: [{ name: 'A', data: '<row r="1"><c r="A1" t="s"><v>5</v></c></row>' }] }), 'xlsx');
  imp('err-hyperlink-no-rel', await rawXlsx({ sheets: [{ name: 'A', data: row(1, 'Tên', 1), post: '<hyperlinks><hyperlink ref="A1" r:id="rId9"/></hyperlinks>' }] }), 'xlsx');
  imp('no-sst-part', await rawXlsx({ sheets: [{ name: 'A', data: '<row r="1"><c r="A1" t="inlineStr"><is><t>Tên</t></is></c><c r="B1" t="inlineStr"><is><t>Mã</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>x</t></is></c><c r="B2" t="s"><v>3</v></c></row>' }] }), 'xlsx');
  imp('no-styles-part', await rawXlsx({ sheets: [{ name: 'A', data: '<row r="1"><c r="A1" t="inlineStr"><is><t>Tên</t></is></c><c r="B1" t="inlineStr"><is><t>Giá</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>x</t></is></c><c r="B2" s="3"><v>45000.25</v></c></row>' }] }), 'xlsx');
  imp('sheet-id-zero-and-dup', await rawXlsx({ sheets: [{ name: 'Không', id: '0', data: row(1, 'Tên', 1) + row(2, 'id0', 1) }, { name: 'Một', id: '5', data: row(1, 'Tên', 1) + row(2, 'id5 a', 1) }, { name: 'Hai', id: '5', data: row(1, 'Tên', 1) + row(2, 'id5 b', 2) }] }), 'xlsx');
  imp('rows-out-of-order', await rawXlsx({ sheets: [{ name: 'A', data: row(3, 'thứ ba', 3) + row(1, 'Tên', 1) + row(2, 'thứ hai', 2) + row(2, 'thứ hai (ghi đè)', 22) }] }), 'xlsx');
  imp('zip-without-workbook', await (async () => { const z = new JSZip(); z.file('a.txt', 'x'); return (await z.generateAsync({ type: 'nodebuffer' })).toString('base64'); })(), 'xlsx');
  imp('zip-empty-prefix-pk', Buffer.from('PK\u0003\u0004 not really a zip file at all').toString('base64'), 'xlsx');
  imp('not-a-zip', b64('hello world this is not a zip'), 'xlsx');
  imp('empty-xlsx', '', 'xlsx');
  imp('null-args', null, null, null);
  imp('undefined-args', undefined, undefined, undefined);
  imp('tiny', 'QQ==', 'xls');

  /* 7b) file có sẵn trong repo (bỏ qua ở test Go nếu file không còn) */
  for (const rel of ['backend/internal/modules/categories/assets/mau-nhap-hang-loat.xlsx', 'db/bao-gia-phan-tho.xlsx']) {
    if (!fs.existsSync(path.join(root, rel))) continue;
    impPath('repo ' + rel, rel, 'xlsx');
    impPath('repo ' + rel + ' vs', rel, 'xlsx', 'vs');
    impPath('repo ' + rel + ' ct', rel, 'xlsx', 'ct');
  }

  /* 8) CSV */
  const csv1 = '\ufeffSTT,Tên sản phẩm,Mã SP,Đơn giá,ĐVT,Ghi chú,Link ảnh\r\n1,"Đèn LED ""siêu sáng"", 9W",DL-09,"125.000",Cái,"nhiều\ndòng",https://x/a.jpg\r\n2,Đèn tuýp,00123,89500.50,,,\r\n\r\n3,  Đèn có khoảng trắng  ,T-1,"1,5",Bộ, x ,\r\n4,,T-2,1,,,\r\n5,Đèn cuối,T-3,1e3,Cái,true,#N/A';
  imp('csv-realistic', b64(csv1), 'csv');
  imp('csv-ext-variants', b64(csv1), 'Text/CSV; charset=utf-8');
  imp('csv-as-vs', b64('Tên sản phẩm,Hạng mục,Giá bán lẻ\n' + VS.VD + ' mẫu,' + hm[0] + ',1\nBồn cầu A,bon cau,12.500.000\nSP B,,5\n'), 'csv', 'vs');
  imp('csv-types', b64('Tên,a,b,c,d,e,f,g,h\n' +
    'A,2024-01-05,01-05-2024,2024-01-05T10:00:00,2024-01-05T10:00:00+07:00,2024-01-05T10:00:00+00:00,2024-01-05T10:00:00Z,2024-02-30,2024-02-29\n' +
    'B,true,false,TRUE,#N/A,#DIV/0!,0x10,1e3,-Infinity\n' +
    'C,Infinity,NaN, 12 ,1.50,007,+5,.5,5.\n' +
    'D,13-01-2024,2024-13-01,24-01-05,2024-1-5,2024-01-05T24:00:00,0099-01-01,0100-01-01,2024-01-05T10:00:00-00:00\n' +
    'E,1_000,1 000,"",   ,0b11,0o17,12abc,2024-01-05 \n' +
    '2024-01-05,x,,,,,,,\ntrue,y,,,,,,,\n12.5,z,,,,,,,\n'), 'csv');
  imp('csv-quirks', b64('Tên , "Giá" ,"Mã"\n a , "1" ,"q"\n,b,\n"c""d",,""\n  ,,\nlast,"x"  \n'), 'csv');
  imp('csv-cr-only', b64('Tên,Giá\rA,1\rB,2\r'), 'csv');
  imp('csv-no-trailing-newline-quoted', b64('Tên,Giá\nA,"1"'), 'csv');
  imp('csv-leading-comma', b64(',Tên,Giá\n,A,1\n,,\n,B,2,'), 'csv');
  imp('csv-semicolon', b64('Tên;Giá\nA;1\n'), 'csv');
  imp('csv-header-late', b64(Array.from({ length: 14 }, (_, i) => 'dòng ' + i).join('\n') + '\n\n\nName,Price\nX,1\n'), 'csv');
  imp('csv-header-too-late', b64(Array.from({ length: 15 }, (_, i) => 'dòng ' + i).join('\n') + '\nName,Price\nX,1\n'), 'csv');
  imp('csv-err-malformed', b64('Tên,x\n"A"b,2\n'), 'csv');
  imp('csv-err-unclosed', b64('Tên,x\n"A,2\nB,3\n'), 'csv');
  imp('csv-empty', '', 'csv');
  imp('csv-whitespace-only', b64('  \n \n'), 'csv');
  imp('csv-invalid-utf8', Buffer.concat([Buffer.from('Tên,x\nA'), Buffer.from([0xff, 0xe4, 0xb8]), Buffer.from(',1\n')]).toString('base64'), 'csv');
  imp('csv-2000', b64('Tên,Giá\n' + Array.from({ length: 2100 }, (_, i) => 'SP' + i + ',' + i).join('\n')), 'csv');
  /* 9) base64 kiểu Node: bỏ ký tự lạ, url-safe, thiếu đệm, dừng ở '=' */
  const b = b64('Tên,Giá\nA>?,1\n');
  imp('b64-newlines', b.replace(/(.{7})/g, '$1\r\n'), 'csv');
  imp('b64-urlsafe-nopad', b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), 'csv');
  imp('b64-garbage-chars', b.split('').join('*'), 'csv');
  imp('b64-stop-at-pad', b64('Tên,Giá\nA,1\n') + b64('B,2\n'), 'csv');
  imp('b64-data-url-prefix', 'data:text/csv;base64,' + b, 'csv');
}

(async () => {
  await buildImports();
  for (const it of imports) {
    const c = { fn: 'importParse', name: it.name, args: enc(it.args) };
    const real = [resolve(it.args[0]), it.args[1], it.args[2]];
    try { c.out = JSON.stringify(await shared.importParse.apply(null, real)); } catch (e) { c.err = e.message; }
    cases.push(c);
  }
  const seen = {};
  for (const it of imports) {
    const csv = String(it.args[1] || '').toLowerCase().indexOf('csv') >= 0;
    const key = JSON.stringify([it.args[0], csv]);
    if (seen[key]) continue;
    seen[key] = 1;
    const c = { fn: 'grid', name: it.name, args: enc([it.args[0], csv ? 'csv' : 'xlsx']) };
    try { c.out = JSON.stringify(await gridOf(resolve(it.args[0]), c.args[1])); } catch (e) { c.err = e.message; }
    cases.push(c);
  }
  const golden = {
    consts: { S32_SUPPLIERS: JSON.stringify(shared.S32_SUPPLIERS), S32_SUBS: JSON.stringify(shared.S32_SUBS), COVER_TEMPLATE: JSON.stringify(shared.COVER_TEMPLATE) },
    cases: cases
  };
  fs.writeFileSync(path.join(__dirname, 'golden.json'), '{"consts":' + JSON.stringify(golden.consts) + ',\n"files":{\n' + Object.keys(files).map(k => JSON.stringify(k) + ':' + JSON.stringify(files[k])).join(',\n') + '\n},\n"cases":[\n' + cases.map(c => JSON.stringify(c)).join(',\n') + '\n]}\n');
  const by = {}; cases.forEach(c => { by[c.fn] = (by[c.fn] || 0) + 1; });
  console.log('golden.json:', JSON.stringify(by), 'lỗi:', cases.filter(c => c.err !== undefined).length);
  cases.filter(c => c.fn === 'importParse').forEach(c => console.log(' ', c.name, '->', c.err !== undefined ? 'ERR ' + c.err : c.out.length + ' byte'));
})().catch(e => { console.error(e); process.exit(1); });
