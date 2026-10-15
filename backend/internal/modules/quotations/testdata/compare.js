'use strict';
/* So file .xlsx của Node <-> Go ở mức Ô, cả hai đọc lại bằng ExcelJS (xlsx-dump.js), gồm cả phần chỉ có ở file thật:
   state, properties, pageSetup, views, số dòng / cột của từng sheet.
   1. node gen.js --xlsx .out/node [--real .out/node] > golden.txt          (xem đầu gen.js về biến môi trường)
   2. Trong container Go:  TEST_DATABASE_URL=<qspro_gotest> QUOT_XLSX_OUT=/repo/backend/internal/modules/quotations/testdata/.out/go \
        [QUOT_REAL=/repo/backend/internal/modules/quotations/testdata/.out/node/real-quote.json] \
        go test -count=1 -run TestDBDiff ./internal/modules/quotations/
   3. node compare.js [.out/node] [.out/go]
   Không cần database. Thoát mã 1 nếu còn khác biệt. */
const fs = require('fs');
const path = require('path');
const { dump } = require('./xlsx-dump.js');

function diff(a, b, p, out) {
  if (out.length > 200) return;
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

// styles là bảng tra theo thứ tự gặp: thay số style của từng ô bằng chính style để so trực tiếp
function inline(d) {
  d.sheets.forEach(function (s) { s.cells = s.cells.map(function (c) { return { a: c[0], type: c[1], value: c[2], style: c[3] < 0 ? {} : d.styles[c[3]], master: c[4] }; }); });
  delete d.styles;
  return d;
}

(async function () {
  const nodeDir = path.resolve(process.argv[2] || path.join(__dirname, '.out', 'node'));
  const goDir = path.resolve(process.argv[3] || path.join(__dirname, '.out', 'go'));
  let bad = 0, cells = 0, images = 0, sheets = 0, n = 0;
  for (const f of fs.readdirSync(nodeDir).filter(function (x) { return /\.xlsx$/.test(x); }).sort()) {
    const file = path.join(goDir, f);
    if (!fs.existsSync(file)) { console.log('THIẾU ' + file); bad++; continue; }
    const dn = inline(await dump(fs.readFileSync(path.join(nodeDir, f))));
    const dg = inline(await dump(fs.readFileSync(file)));
    n++;
    dn.sheets.forEach(function (s) { sheets++; cells += s.cells.length; images += s.images.length; });
    const out = [];
    diff(dn, dg, f, out);
    if (out.length) { bad++; console.log('KHÁC ' + f + ' (' + out.length + (out.length > 200 ? '+' : '') + ')'); out.slice(0, 30).forEach(function (l) { console.log('  ' + l.slice(0, 400)); }); }
    else console.log('GIỐNG ' + f);
  }
  console.log(bad ? ('CÒN ' + bad + ' file khác') : ('Tất cả giống nhau - ' + n + ' file, ' + sheets + ' sheet, ' + cells + ' ô có giá trị / style, ' + images + ' ảnh'));
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(2); });
