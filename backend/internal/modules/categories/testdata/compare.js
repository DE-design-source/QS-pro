'use strict';
/* So file mẫu Node <-> Go ở mức Ô, cả hai đọc lại bằng ExcelJS (xlsx-dump.js).
   1. Trong container Go:  CATEGORIES_XLSX_OUT=/repo/backend/internal/modules/categories/testdata/.out \
                            go test -count=1 -run TestDumpTemplates ./internal/modules/categories/
   2. Trên máy:            node backend/internal/modules/categories/testdata/compare.js [thư mục .out]
   Không cần database. Thoát mã 1 nếu còn khác biệt. */
const fs = require('fs');
const path = require('path');
const { dump } = require('./xlsx-dump.js');
const { variants } = require('./variants.js');

function diff(a, b, p, out) {
  if (out.length > 60) return;
  if (a === b) return;
  const ta = Array.isArray(a) ? 'array' : (a === null ? 'null' : typeof a);
  const tb = Array.isArray(b) ? 'array' : (b === null ? 'null' : typeof b);
  if (ta !== tb || (ta !== 'object' && ta !== 'array')) { out.push(p + ': node=' + JSON.stringify(a) + ' go=' + JSON.stringify(b)); return; }
  if (ta === 'array') {
    if (a.length !== b.length) out.push(p + '.length: node=' + a.length + ' go=' + b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], p + '[' + i + ']', out);
    return;
  }
  const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).sort();
  keys.forEach(function (k) {
    if (!(k in a)) out.push(p + '.' + k + ': node=<thiếu> go=' + JSON.stringify(b[k]));
    else if (!(k in b)) out.push(p + '.' + k + ': node=' + JSON.stringify(a[k]) + ' go=<thiếu>');
    else diff(a[k], b[k], p + '.' + k, out);
  });
}

(async function () {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, '.out'));
  let bad = 0, cells = 0;
  for (const v of variants()) {
    const nodeDump = await dump(Buffer.from(await v.build()));
    const file = path.join(dir, v.name + '.xlsx');
    if (!fs.existsSync(file)) { console.log('THIẾU ' + file); bad++; continue; }
    const goDump = await dump(fs.readFileSync(file));
    nodeDump.sheets.forEach(function (s) { cells += s.rows.length * s.columnCount; });
    const out = [];
    diff(nodeDump, goDump, v.name, out);
    if (out.length) { bad++; console.log('KHÁC ' + v.name + ' (' + out.length + (out.length > 60 ? '+' : '') + ')'); out.slice(0, 25).forEach(function (l) { console.log('  ' + l); }); }
    else console.log('GIỐNG ' + v.name);
  }
  console.log(bad ? ('CÒN ' + bad + ' file khác') : ('Tất cả giống nhau - ' + cells + ' ô đã so'));
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(2); });
