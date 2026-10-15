'use strict';
/* So file xuất công tác của Go với file của Node ở mức Ô: cả hai được đọc lại bằng ExcelJS.
     DATABASE_URL=<qspro_nodetest> ... node xlsx-parity.js <file .xlsx do Go ghi> [rows.json] [--raw]
   (rows mặc định: export-rows.json; noderef.js đòi DATABASE_URL trỏ qspro_nodetest dù script này không chạm database)
   File của Go lấy từ: ESTIMATES_XLSX_OUT=<đường dẫn> go test -run TestExportWriteFile ./internal/modules/estimates/
   So: creator, tên sheet, khung cố định, autoFilter, merge, độ rộng + style cột, chiều cao + style dòng,
   kiểu + giá trị + TOÀN BỘ style (font, alignment, fill, numFmt, border) từng ô.
   Thoát mã 1 khi có khác biệt ngoài 3 điểm CHẤP NHẬN dưới đây (--raw: không chấp nhận gì, in hết):
   1. font.scheme: font mặc định của ExcelJS có <scheme val="minor"/>, của excelize thì không (cùng là Calibri 11).
   2. autoFilter: excelize ghi ref tuyệt đối "$A$1:$K$1", ExcelJS ghi "A1:K1" - Excel hiểu như nhau.
   3. Ô số vô hạn (client gửi "1e999"): ExcelJS ghi <v>Infinity</v> vào ô số (file không hợp lệ với Excel),
      bản Go ghi ô chữ "Infinity". */
const fs = require('fs');
const path = require('path');
const ref = require('./noderef');
const ExcelJS = ref.ExcelJS();

const RAW = process.argv.indexOf('--raw') > 0;
const files = process.argv.slice(2).filter(function (a) { return a !== '--raw'; });

function clean(v) {
  if (v === undefined) return null;
  if (typeof v === 'number' && !isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).sort().forEach(function (k) { if (v[k] !== undefined) o[k] = clean(v[k]); });
    return o;
  }
  return v;
}
function style(st) {
  const o = clean(st || {});
  if (!RAW && o.font) delete o.font.scheme;
  return o;
}
async function dump(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out = { creator: wb.creator || null, lastModifiedBy: wb.lastModifiedBy || null, sheets: [] };
  wb.eachSheet(function (ws) {
    const nCol = Math.max(ws.columnCount, ws.actualColumnCount);
    const v = (ws.views || [])[0] || {};
    let af = clean(ws.autoFilter);
    if (!RAW && typeof af === 'string') af = af.replace(/\$/g, '');
    const sh = { name: ws.name, state: ws.state,
      view: { state: v.state || null, xSplit: v.xSplit || 0, ySplit: v.ySplit || 0, topLeftCell: v.topLeftCell || null },
      autoFilter: af, merges: (ws.model.merges || []).slice().sort(),
      rowCount: ws.rowCount, columnCount: nCol, columns: [], rows: [] };
    for (let c = 1; c <= nCol; c++) {
      const col = ws.getColumn(c);
      sh.columns.push({ n: c, width: col.width == null ? null : col.width, hidden: !!col.hidden, style: style(col.style) });
    }
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells = [];
      for (let c = 1; c <= nCol; c++) {
        const cell = row.getCell(c);
        cells.push({ a: cell.address, type: cell.type, value: clean(cell.value), style: style(cell.style) });
      }
      sh.rows.push({ n: r, height: row.height == null ? null : row.height, hidden: !!row.hidden, style: style(row.style), cells: cells });
    }
    out.sheets.push(sh);
  });
  return out;
}
const voHan = [];
function diff(a, b, p, out) {
  if (!RAW && a && b && a.a && a.type === 2 && /^-?Infinity$/.test(String(a.value)) && b.type === 3 && b.value === a.value) {
    voHan.push(a.a);
    a = Object.assign({}, a, { type: b.type });
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Array.isArray(a) ? Array.from({ length: Math.max(a.length, b.length) }, function (_, i) { return i; })
      : Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).sort();
    keys.forEach(function (k) { diff(a[k], b[k], p + '.' + k, out); });
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(p + ': node=' + JSON.stringify(a) + ' go=' + JSON.stringify(b));
}

(async function () {
  if (!files[0]) { console.error('thiếu đường dẫn file .xlsx của Go'); process.exit(2); }
  const rows = JSON.parse(fs.readFileSync(files[1] || path.join(__dirname, 'export-rows.json'), 'utf8'));
  const nodeRes = await ref.loadExport()(rows);
  const dn = await dump(nodeRes.buf);
  const dg = await dump(fs.readFileSync(files[0]));
  const out = [];
  diff(dn, dg, '', out);
  const cells = dn.sheets.reduce(function (s, sh) { return s + sh.rows.length * sh.columnCount; }, 0);
  if (out.length) { console.log('KHÁC (' + out.length + '):\n' + out.slice(0, 80).join('\n')); process.exit(1); }
  console.log('GIỐNG: ' + dn.sheets.length + ' sheet, ' + dn.sheets[0].rowCount + ' dòng, ' + cells +
    ' ô (kiểu + giá trị + style), cột, dòng, khung, autoFilter' + (voHan.length ? '; ô số vô hạn (khác biệt đã biết): ' + voHan.join(', ') : ''));
})().catch(function (e) { console.error(e); process.exit(1); });
