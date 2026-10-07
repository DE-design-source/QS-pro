// Kiểm tra nhanh các hàm thuần dễ sai: đọc số kiểu VN, escape onclick, chặn link javascript:,
// tổng tờ bìa (mục cha = tổng con), mã tờ bìa khớp cây hạng mục Bóc tách.   Chạy: npm test
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const shared = require('../server/shared');

// Lấy vài hàm client từ public/app.js (file là script toàn cục, không phải module)
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const pick = n => { const m = app.match(new RegExp('^function ' + n + '\\([^]*?\\n(?=function |var |/\\*|//)', 'm')); assert(m, 'không thấy ' + n); return m[0]; };
const C = new Function(['esc', 'escJs_', 'safeUrl_', 'tkNum_', 'pctIn_'].map(pick).join('\n') +
  '\nreturn {esc, escJs_, safeUrl_, tkNum_, pctIn_};')();

// số kiểu VN
[['1.234.567', 1234567], ['12,5', 12.5], ['1.234,5', 1234.5], ['1.500', 1500], ['450.5', 450.5], ['', 0], ['abc', 0], ['-2,5', -2.5]]
  .forEach(([v, want]) => assert.strictEqual(C.tkNum_(v), want, 'tkNum_(' + v + ')'));
// server đọc số giống hệt client (giá / diện tích từ file nhập, ô sửa)
['1.234.567', '12,5', '1.234,5', '1.500', '450.5', '30%', '-2,5', '', 'abc', '12.500.000 đ']
  .forEach(v => assert.strictEqual(shared.toNumber_(v), C.tkNum_(v), 'toNumber_ vs tkNum_ (' + v + ')'));
// SP danh mục -> dòng bóc tách: cột Giá bán lẻ = giá niêm yết + CK đại lý của SP (không phải giá đại lý + CK 0)
{ const G = new Function('S', pick('giaDongTuSP_') + '\nreturn giaDongTuSP_;')({ products: [{ recordId: 7, giaBanLe: 50000000, ckDaiLy: 35 }] });
  assert.deepStrictEqual(G({ giaBanLe: 50000000, ckDaiLy: 35, donGiaVon: 32500000, donGiaBan: 32500000 }), { donGiaVon: 50000000, chietKhau: 35, donGiaBan: 50000000 });
  assert.deepStrictEqual(G({ recordId: 7, donGiaBan: 32500000 }), { donGiaVon: 50000000, chietKhau: 35, donGiaBan: 50000000 });   // SP đi kèm rút gọn
  assert.deepStrictEqual(G({ donGiaVon: 900000, donGiaBan: 900000 }), { donGiaVon: 900000, chietKhau: 0, donGiaBan: 900000 }); }  // chưa có giá niêm yết
// bảng tính Bóc tách: tầng CHƯA có dòng vẫn phải có dòng tầng (vừa thêm tầng là thấy), số La Mã khớp bảng thường
{ const bt = fs.readFileSync(path.join(__dirname, '..', 'public', 'bangtinh.js'), 'utf8');
  const grid = new Function('S', 'PT_ROMAN', 'btMoney_', 'sortLines_', 'tkSheetO_',
    bt.match(/^function tkSheetGrid_\([^]*?\n}\n/m)[0] + 'return tkSheetGrid_;')(
    { collapsed: {} }, ['I', 'II', 'III'], v => String(v || ''), a => a, (l, k, stt) => k === 'stt' ? stt : l.ten);
  const g = grid([['stt'], ['ten']], ['TẦNG 1', 'TẦNG LỬNG', 'CHƯA PHÂN TẦNG'], { 'TẦNG 1': [{ lineId: 'a', ten: 'Đèn' }], 'CHƯA PHÂN TẦNG': [{ lineId: 'b', ten: 'Ray' }] });
  assert.deepStrictEqual(g.meta.map(m => m.k + ':' + (m.g || m.id)), ['sec:TẦNG 1', 'it:a', 'sec:TẦNG LỬNG', 'sec:CHƯA PHÂN TẦNG', 'it:b']);
  assert.strictEqual(g.rows[4][0], '3.1'); }
// renderTable đưa ĐÚNG danh sách tầng của bảng thường cho bảng tính (không lọc bỏ tầng trống)
assert(/tkSheetVe_\(document\.getElementById\('tkSheet'\), cols, order, groups\)/.test(fs.readFileSync(path.join(__dirname, '..', 'public', 'boc.js'), 'utf8')), 'renderTable phải truyền nguyên order cho tkSheetVe_');
// biến thể màu: tên màu tiếng Việt -> chấm màu (khớp nguyên từ, bỏ dấu)
{ const sp = fs.readFileSync(path.join(__dirname, '..', 'public', 'sanpham.js'), 'utf8');
  const mau = new Function(sp.match(/^var SP_MAU_CSS=[^]*?;\n/m)[0] + sp.match(/^function spMauCss_\([^]*?\n}\n/m)[0] + 'return spMauCss_;')();
  [['Trắng sứ', '#ffffff'], ['Xanh dương', '#1a73e8'], ['Xanh', '#4285f4'], ['Đỏ đô', '#d93025'], ['Vàng đồng', '#d4af37'],
   ['Màu be', '#e8d5b0'], ['Vân gỗ', '#a1887f'], ['Mã #12ab9f', '#12ab9f'], ['Ánh kim lạ', '']].forEach(([t, c]) => assert.strictEqual(mau(t), c, 'spMauCss_(' + t + ')')); }
// Mua hàng: tiền mỗi đợt = % × tổng đơn hiện tại; toàn % đủ 100 thì cộng lại đúng tổng; đợt gõ tay giữ nguyên
{ const mh = fs.readFileSync(path.join(__dirname, '..', 'public', 'muahang.js'), 'utf8');
  const tinh = new Function(mh.match(/^function mhPayTinh_\([^]*?\n}\n/m)[0] + 'return mhPayTinh_;')();
  const a = tinh([{ pct: 33.3, tien: 0 }, { pct: 33.3, tien: 0 }, { pct: 33.4, tien: 0 }], 1000001);
  assert.strictEqual(a.reduce((s, d) => s + d.tien, 0), 1000001); assert.strictEqual(a[0].tien, 333000);
  assert.strictEqual(tinh([{ pct: 100, tien: 0 }], 5000000)[0].tien, 5000000);               // đợt mặc định không còn "0 đ"
  assert.strictEqual(tinh([{ pct: 50, tien: 777, tay: 1 }, { pct: 50, tien: 0 }], 2000)[0].tien, 777); }
// ô % trống không được thành 0
assert.strictEqual(C.pctIn_(''), null); assert.strictEqual(C.pctIn_('  '), null);
assert.strictEqual(C.pctIn_('12,5'), 12.5); assert.strictEqual(C.pctIn_('0'), 0); assert.strictEqual(C.pctIn_('x'), null);

// escJs_: chuỗi nhét vào onclick="f('...')" phải chạy được và giữ nguyên giá trị
["Nhà 3' x 4'", 'a\\b', 'dòng 1\ndòng 2', 'x"y<z>'].forEach(v => {
  const attr = C.escJs_(v).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.strictEqual(new Function("return '" + attr + "'")(), v, 'escJs_ ' + JSON.stringify(v));
});
// safeUrl_
assert.strictEqual(C.safeUrl_('javascript:alert(1)'), '#');
assert.strictEqual(C.safeUrl_(' JAVASCRIPT:x'), '#');
assert.strictEqual(C.safeUrl_('https://x.vn/a.pdf'), 'https://x.vn/a.pdf');
assert.strictEqual(C.safeUrl_('/media?token=1'), '/media?token=1');

// tiền bằng chữ trên báo giá
const bg = fs.readFileSync(path.join(__dirname, '..', 'public', 'baogia.js'), 'utf8');
const docSoVN_ = new Function(bg.match(/^function docSoVN_\([^]*?\n}\n/m)[0] + 'return docSoVN_;')();
[[0, 'Không đồng'], [15, 'Mười lăm đồng'], [21, 'Hai mươi mốt đồng'], [105, 'Một trăm lẻ năm đồng'], [1000000, 'Một triệu đồng'],
 [1005000, 'Một triệu không trăm lẻ năm nghìn đồng'], [2000000000, 'Hai tỷ đồng'],
 [239769720, 'Hai trăm ba mươi chín triệu bảy trăm sáu mươi chín nghìn bảy trăm hai mươi đồng'],
 [1250300, 'Một triệu hai trăm năm mươi nghìn ba trăm đồng']]
  .forEach(([n, want]) => assert.strictEqual(docSoVN_(n), want, 'docSoVN_(' + n + ')'));

// tờ bìa: mục cha = tổng mục lá bên dưới, tổng = cộng cấp 1
const cv = [{ stt: '1', chiPhi: 10 }, { stt: '3', chiPhi: 999 }, { stt: '3.2', chiPhi: 999 },
  { stt: '3.2.1', chiPhi: 5 }, { stt: '3.2.6', chiPhi: 7 }, { stt: '3.1', chiPhi: 3 }];
const r = shared.coverComputed_(cv);
assert.strictEqual(r.cost['3.2'], 12); assert.strictEqual(r.cost['3'], 15); assert.strictEqual(r.total, 25);

// mã tờ bìa = mã cây hạng mục Bóc tách (TREE ở app.js), dòng con cộng vào mục cha
const tree = eval(app.match(/var TREE=(\[[^]*?\]);/)[1]).map(t => t[0]);
// (nhóm 5 Bảo dưỡng là gói dịch vụ, không bóc tách -> không cần có trong TREE)
shared.COVER_TEMPLATE.filter(t => t[0][0] !== '5').forEach(t => assert(tree.includes(t[0]), 'mục tờ bìa ' + t[0] + ' không có trong TREE'));
Object.keys(shared.S32_SUPPLIERS).forEach(k => assert(tree.includes(k), 'NCC ' + k + ' không có trong TREE'));
assert(shared.inCode('3.2.6.1', '3.2.6') && shared.inCode('3.2.6', '3.2.6') && !shared.inCode('3.2.60', '3.2.6'));

// mọi khoá client lưu bằng projDataSet_ phải có trong danh sách server cho phép (thiếu -> server từ chối, dữ liệu mất khi F5)
const srv = fs.readFileSync(path.join(__dirname, '..', 'server', 'store_supa.js'), 'utf8');
const choPhep = eval(srv.match(/const PROJ_DATA_KEYS = (\[[^\]]*\]);/)[1]);
fs.readdirSync(path.join(__dirname, '..', 'public')).filter(f => f.endsWith('.js')).forEach(f => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
  [...t.matchAll(/projDataSet_\('([A-Za-z]+)'/g)].forEach(m => assert(choPhep.includes(m[1]), f + ': khoá "' + m[1] + '" chưa có trong PROJ_DATA_KEYS (server/store_supa.js)'));
});

// xuất bảng Excel (tab Chi phí): nhóm gộp ô, số giữ kiểu số, dòng tổng ở 2 cột cuối
(async () => {
  const ExcelJS = require('exceljs');
  const buf = await require('../server/export').buildBangXlsx({ ten: 'BẢNG CHI PHÍ', sheet: 'Chi phi',
    cols: [{ label: 'STT' }, { label: 'Tên' }, { label: 'Thành tiền', num: true }],
    rows: [{ group: 'I. Thiết bị đèn' }, { cells: ['1.1', 'Đèn 9W', 7680000] }], tong: [['Tổng', 7680000]] });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Chi phi');
  assert.strictEqual(ws.getCell('A1').value, 'BẢNG CHI PHÍ');
  assert.strictEqual(ws.getCell('C3').value, 'Thành tiền');
  assert.strictEqual(ws.getCell('A4').value, 'I. Thiết bị đèn'); assert(ws.getCell('C4').isMerged);
  assert.strictEqual(ws.getCell('C5').value, 7680000);
  assert.strictEqual(ws.getCell('B7').value, 'Tổng'); assert.strictEqual(ws.getCell('C7').value, 7680000);
  // báo giá Excel: trang "Tổng cộng" đúng hộp tổng PDF, dòng cuối là TỔNG THANH TOÁN
  const wb2 = new ExcelJS.Workbook(), ws2 = wb2.addWorksheet('Tổng cộng');
  require('../server/export').buildTongSheet(ws2, { ten: 'Villa' }, [['Cộng (chưa VAT)', 2000000], ['Chiết khấu 10%', -200000], ['Sau chiết khấu', 1800000], ['VAT 10%', 180000], ['TỔNG THANH TOÁN', 1980000]]);
  assert.strictEqual(ws2.getCell('B4').value, -200000); assert.strictEqual(ws2.getCell('A7').value, 'TỔNG THANH TOÁN'); assert.strictEqual(ws2.getCell('B7').value, 1980000);
  // sheet Phần thô: giá NHÀ THẦU chỉ in khi client gửi kèm dgnt (đã bật in cột nội bộ) — mặc định không lộ cho khách
  const hd = function (pt) { const w = new ExcelJS.Workbook().addWorksheet('pt'); require('../server/export').buildPhanThoSheet(w, { ten: 'V' }, pt); return w.getRow(4).values.join('|'); };
  assert.ok(!/NHÀ THẦU/.test(hd([{ ten: 'A', tt: 350, items: [{ n: 'x', kl: 100, dg: 3.5, tt: 350 }] }])), 'sheet Phần thô lộ cột nhà thầu');
  assert.ok(/NHÀ THẦU/.test(hd([{ ten: 'A', tt: 350, items: [{ n: 'x', kl: 100, dg: 3.5, tt: 350, dgnt: 3, ttnt: 300 }] }])));
  console.log('test-core: tất cả đạt');
})().catch(e => { console.error(e); process.exit(1); });
