'use strict';
/* Đọc 1 file .xlsx bằng ExcelJS và trả về mô tả chuẩn hoá ở mức Ô, dạng gọn (style gom vào bảng styles):
   { sheets: [{ name, ySplit, merges, widths, heights, cells: [[địa chỉ, kiểu, giá trị, số style, ô chính]], images,
                file: { state, properties, pageSetup, views, rowCount, columnCount } }], styles: [...] }
   Phần "file" chỉ có khi đọc file thật (bản Go dựng lại phần còn lại từ mô hình trước khi ghi file).
   Kiểu ô theo ExcelJS: 0 trống, 1 ô bị gộp, 2 số, 3 chuỗi, 8 richText, 9 boolean. */
const crypto = require('crypto');
const path = require('path');
const ExcelJS = require(path.join(__dirname, '../../../../../node_modules/exceljs'));

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

async function dump(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const styles = [], styleIdx = {};
  function styleOf(st) {
    const js = JSON.stringify(clean(st || {}));
    if (js === '{}') return -1;
    if (styleIdx[js] === undefined) { styleIdx[js] = styles.length; styles.push(JSON.parse(js)); }
    return styleIdx[js];
  }
  const out = { sheets: [], styles: styles };
  wb.eachSheet(function (ws) {
    const nCol = Math.max(ws.columnCount, ws.actualColumnCount);
    const v0 = (ws.views || [])[0] || {};
    const sh = { name: ws.name, ySplit: v0.state === 'frozen' ? (v0.ySplit || 0) : 0,
      merges: (ws.model.merges || []).slice().sort(), widths: {}, heights: {}, cells: [], images: [],
      file: { state: ws.state, properties: clean(ws.properties), pageSetup: clean(ws.pageSetup), views: clean(ws.views),
        rowCount: ws.rowCount, columnCount: nCol } };
    for (let c = 1; c <= nCol; c++) {
      const col = ws.getColumn(c);
      if (col.width != null) sh.widths[c] = col.width;
      if (styleOf(col.style) >= 0 || col.hidden) sh.file['col' + c] = { style: clean(col.style), hidden: !!col.hidden };
    }
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      if (row.height != null) sh.heights[r] = row.height;
      for (let c = 1; c <= nCol; c++) {
        const cell = row.getCell(c);
        const st = styleOf(cell.style);
        if (cell.type === 0 && st < 0) continue;
        sh.cells.push([cell.address, cell.type, cell.type === 1 ? null : clean(cell.value), st, cell.isMerged && cell.type === 1 ? cell.master.address : null]);
      }
    }
    ws.getImages().forEach(function (im) {
      const media = wb.getImage(im.imageId) || {};
      const tl = im.range.tl, ext = im.range.ext || {};
      sh.images.push({ col: tl.nativeCol, colOff: tl.nativeColOff, row: tl.nativeRow, rowOff: tl.nativeRowOff,
        w: ext.width, h: ext.height, editAs: im.range.editAs || null, ext: media.extension || null,
        sha1: media.buffer ? crypto.createHash('sha1').update(Buffer.from(media.buffer)).digest('hex') : null });
    });
    out.sheets.push(sh);
  });
  return out;
}

// Bỏ phần chỉ có ở file thật (dùng cho golden mà bản Go so với mô hình).
function model(d) {
  return { sheets: d.sheets.map(function (s) { const o = Object.assign({}, s); delete o.file; return o; }), styles: d.styles };
}

module.exports = { dump: dump, model: model, clean: clean };
