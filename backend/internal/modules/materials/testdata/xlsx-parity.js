'use strict';
/* So file xuất danh sách sản phẩm của Go với file của Node ở mức Ô: cả hai được đọc lại bằng ExcelJS.
     DATABASE_URL=<qspro_nodetest> ... node xlsx-parity.js <file .xlsx do Go ghi> [--raw]
   File của Go: MATERIALS_XLSX_OUT=<đường dẫn> TEST_DATABASE_URL=<qspro_gotest> go test -run TestExportWriteFile ./internal/modules/materials/
   Hai bên xuất cùng danh sách id có sẵn của công ty dezon (export-keys.json) trong ngữ cảnh công ty đó.
   So: creator, tên sheet, khung cố định, autoFilter, merge, độ rộng + style cột, chiều cao + style dòng,
   kiểu + giá trị + TOÀN BỘ style (font, alignment, fill, numFmt, border) từng ô.
   Thoát mã 1 khi có khác biệt ngoài 2 điểm CHẤP NHẬN dưới đây (--raw: không chấp nhận gì, in hết):
   1. font.scheme: font mặc định của ExcelJS có <scheme val="minor"/>, của excelize thì không (cùng là Calibri 11).
   2. autoFilter: (đã hết) bản Go ghi lại ref tương đối "A1:EA1" như ExcelJS. */
const fs = require('fs');
const path = require('path');
const ref = require('./noderef');
const ExcelJS = ref.ExcelJS();

const RAW = process.argv.indexOf('--raw') > 0;
const files = process.argv.slice(2).filter(function (a) { return a !== '--raw'; });

function clean(v) {
  if (v === undefined) return null;
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
function diff(a, b, p, out) {
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
  const keys = JSON.parse(fs.readFileSync(path.join(__dirname, 'export-keys.json'), 'utf8'));
  const dz = (await ref.tenant.run({ role: 'super' }, function () { return ref.supa.select('cong_ty', { select: 'id', filter: 'ma=eq.dezon', noScope: true }); }))[0];
  const nodeRes = await ref.tenant.run({ uid: null, role: 'admin', congTyId: dz.id, viewAs: null }, function () { return ref.loadExport()(keys); });
  const dn = await dump(nodeRes.buf);
  const dg = await dump(fs.readFileSync(files[0]));
  const out = [];
  diff(dn, dg, '', out);
  const cells = dn.sheets.reduce(function (s, sh) { return s + sh.rows.length * sh.columnCount; }, 0);
  if (out.length) { console.log('KHÁC (' + out.length + '):\n' + out.slice(0, 80).join('\n')); process.exit(1); }
  console.log('GIỐNG: ' + dn.sheets.length + ' sheet "' + dn.sheets[0].name + '", ' + nodeRes.count + ' sản phẩm, ' + dn.sheets[0].rowCount + ' dòng x ' + dn.sheets[0].columnCount +
    ' cột = ' + cells + ' ô (kiểu + giá trị + style), cột, dòng, khung, autoFilter');
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
