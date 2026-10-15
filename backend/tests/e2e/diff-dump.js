'use strict';
/* So 2 file E2E_DUMP (Node tham chiếu và Go) của test-api-go.js: từng lần gọi phải cùng hàm, cùng mã HTTP, cùng thân (tính cả thứ tự khoá).
   Chỉ chuẩn hoá những thứ vốn khác nhau giữa 2 lần chạy: token, mã sinh ngẫu nhiên, mốc thời gian, UUID.
   Chạy: node backend/tests/e2e/diff-dump.js <dump-node> <dump-go>   Thoát mã 1 nếu có chỗ khác. */
const fs = require('fs');
const [a, b] = process.argv.slice(2).map((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean));
const norm = (s) => s
  .replace(/"token":"[^"]*"/g, '"token":"<T>"')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
  .replace(/\b(DA|MH|CK|TT)-[0-9A-Z]{6,10}-[0-9A-Z]{4,12}\b/g, '$1-<MA>')
  .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g, '<TS>')
  .replace(/\b\d{1,2}:\d{2}(:\d{2})? \d{1,2}\/\d{1,2}\/\d{4}\b/g, '<TS>')
  .replace(/\b\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}(:\d{2})?\b/g, '<TS>');
let diff = 0;
if (a.length !== b.length) { diff++; console.log('Số lần gọi khác nhau: ' + a.length + ' / ' + b.length); }
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  const x = norm(a[i]), y = norm(b[i]);
  if (x === y) continue;
  diff++;
  let k = 0; while (k < x.length && x[k] === y[k]) k++;
  console.log('#' + (i + 1) + ' ' + a[i].split('\t').slice(0, 2).join(' ') + ' | ' + b[i].split('\t').slice(0, 2).join(' ') + '  (khác từ ký tự ' + k + ', dài ' + x.length + ' / ' + y.length + ')');
  console.log('   A: ' + x.slice(Math.max(0, k - 100), k + 160));
  console.log('   B: ' + y.slice(Math.max(0, k - 100), k + 160));
}
console.log('Tổng: ' + Math.min(a.length, b.length) + ' lần gọi, ' + diff + ' chỗ khác');
process.exit(diff ? 1 : 0);
