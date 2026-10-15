'use strict';
/* So 2 file .xlsx bằng ExcelJS: người tạo (creator), sheet (tên, thứ tự, trạng thái, khung nhìn), độ rộng cột, chiều cao dòng, ô (giá trị, kiểu,
   định dạng số, font, nền, viền, căn lề), vùng gộp, ảnh (vị trí + băm nội dung), kiểm tra dữ liệu, định dạng có điều kiện. */
const crypto = require('crypto');
const ExcelJS = require('exceljs');

function isXlsx(buf, contentType) {
  return /spreadsheetml|ms-excel/i.test(contentType || '') || (buf && buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 3 && buf[3] === 4);
}
function val(v) {
  if (v instanceof Date) return { date: v.toISOString() };
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = val(v[k]); }); return Array.isArray(v) ? v.map(val) : o; }
  return v === undefined ? null : v;
}
async function describe(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  // creator: Node đặt 'Dezon Pro' cho /export/cong-tac và /export/san-pham. created / modified là giờ lúc xuất nên KHÔNG so.
  const out = { creator: wb.creator === undefined ? null : wb.creator, sheets: [], definedNames: val(wb.definedNames && wb.definedNames.model) };
  wb.eachSheet((ws) => {
    const s = { name: ws.name, state: ws.state, views: val(ws.views), props: val(ws.properties), pageSetup: val(ws.pageSetup),
      autoFilter: val(ws.autoFilter), cols: {}, rows: {}, cells: {}, merges: (ws.model.merges || []).slice().sort(), images: [],
      validations: val(ws.dataValidations && ws.dataValidations.model), conditional: val(ws.conditionalFormattings) };
    for (let i = 1; i <= ws.columnCount; i++) { const c = ws.getColumn(i); s.cols[i] = { width: c.width == null ? null : c.width, hidden: !!c.hidden }; }
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      s.rows[n] = { height: row.height == null ? null : row.height, hidden: !!row.hidden };
      row.eachCell({ includeEmpty: true }, (cell) => {
        s.cells[cell.address] = { type: cell.type, value: val(cell.value), numFmt: cell.numFmt || null, font: val(cell.font), fill: val(cell.fill),
          border: val(cell.border), alignment: val(cell.alignment), protection: val(cell.protection) };
      });
    });
    ws.getImages().forEach((im) => {
      const media = wb.getImage(im.imageId) || {};
      // im.range.tl / br là Anchor của ExcelJS, có trỏ ngược về worksheet (vòng lặp): chỉ lấy 4 toạ độ của nó
      const anchor = (a) => (a && typeof a === 'object' ? { col: a.nativeCol, colOff: a.nativeColOff, row: a.nativeRow, rowOff: a.nativeRowOff } : a === undefined ? null : a);
      const rg = im.range || {};
      s.images.push({ range: { tl: anchor(rg.tl), br: anchor(rg.br), ext: val(rg.ext), editAs: rg.editAs === undefined ? null : rg.editAs, hyperlinks: val(rg.hyperlinks) }, ext: media.extension || null, sha1: media.buffer ? crypto.createHash('sha1').update(media.buffer).digest('hex') : null });
    });
    out.sheets.push(s);
  });
  return out;
}
function deepDiff(a, b, path, out, max) {
  if (out.length >= max) return;
  if (a === b) return;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a, tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb || (ta !== 'object' && ta !== 'array')) { out.push(path + ': ' + JSON.stringify(a) + ' <> ' + JSON.stringify(b)); return; }
  const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
  for (const k of keys) {
    if (!(k in a)) out.push(path + '.' + k + ': (thiếu ở Node) <> ' + JSON.stringify(b[k]).slice(0, 200));
    else if (!(k in b)) out.push(path + '.' + k + ': ' + JSON.stringify(a[k]).slice(0, 200) + ' <> (thiếu ở Go)');
    else deepDiff(a[k], b[k], path + '.' + k, out, max);
    if (out.length >= max) return;
  }
}
// Trả mảng mô tả chỗ khác (rỗng = giống)
async function diffXlsx(bufNode, bufGo, max) {
  let a, b;
  try { a = await describe(bufNode); } catch (e) { return ['Node: không đọc được xlsx: ' + e.message]; }
  try { b = await describe(bufGo); } catch (e) { return ['Go: không đọc được xlsx: ' + e.message]; }
  const out = [];
  deepDiff(a, b, 'wb', out, max || 25);
  return out;
}
module.exports = { isXlsx, describe, diffXlsx, deepDiff };
