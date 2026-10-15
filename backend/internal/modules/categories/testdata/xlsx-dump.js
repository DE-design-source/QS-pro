'use strict';
/* Đọc 1 file .xlsx bằng ExcelJS và trả về mô tả chuẩn hoá ở mức Ô (dùng để so file mẫu Node <-> Go):
   tên sheet, giá trị + kiểu từng ô, style (font / fill / border / alignment / numFmt), merge, độ rộng cột,
   chiều cao dòng, khung cố định, data validation, ghi chú. Không gồm ngày tạo / sửa (đổi theo từng lần chạy). */
const path = require('path');
const ExcelJS = require(path.join(__dirname, '../../../../../node_modules/exceljs'));

function clean(v) {
  if (v === undefined) return null;
  if (v instanceof Date) return { $date: v.toISOString() };
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
  const out = {
    creator: wb.creator == null ? null : wb.creator,
    lastModifiedBy: wb.lastModifiedBy == null ? null : wb.lastModifiedBy,
    wbViews: clean(wb.views), definedNames: clean(wb.definedNames.model),
    sheets: []
  };
  wb.eachSheet(function (ws) {
    const nCol = Math.max(ws.columnCount, ws.actualColumnCount);
    const sh = {
      name: ws.name, state: ws.state, properties: clean(ws.properties), views: clean(ws.views),
      pageSetup: clean(ws.pageSetup), headerFooter: clean(ws.headerFooter), autoFilter: clean(ws.autoFilter),
      merges: clean((ws.model.merges || []).slice().sort()),
      dataValidations: clean(ws.dataValidations && ws.dataValidations.model),
      conditionalFormattings: clean(ws.conditionalFormattings),
      rowCount: ws.rowCount, columnCount: nCol, columns: [], rows: []
    };
    for (let c = 1; c <= nCol; c++) {
      const col = ws.getColumn(c);
      sh.columns.push({ n: c, width: col.width == null ? null : col.width, hidden: !!col.hidden,
        outlineLevel: col.outlineLevel || 0, style: clean(col.style || {}) });
    }
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells = [];
      for (let c = 1; c <= nCol; c++) {
        const cell = row.getCell(c);
        cells.push({ a: cell.address, type: cell.type, value: clean(cell.value), style: clean(cell.style || {}),
          note: clean(cell.note), master: cell.isMerged ? cell.master.address : null });
      }
      sh.rows.push({ n: r, height: row.height == null ? null : row.height, hidden: !!row.hidden,
        outlineLevel: row.outlineLevel || 0, cells: cells });
    }
    out.sheets.push(sh);
  });
  return out;
}

module.exports = { dump: dump };
