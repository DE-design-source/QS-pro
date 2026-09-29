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
  console.log('test-core: tất cả đạt');
})().catch(e => { console.error(e); process.exit(1); });
