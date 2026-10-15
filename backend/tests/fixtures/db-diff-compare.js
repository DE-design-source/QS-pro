'use strict';
/* So hai file kết quả (bản Node và bản Go) từng dòng. Dùng: node db-diff-compare.js node.txt go.txt [--raw]
 * Mặc định che id / thời điểm sinh tự động; --raw so nguyên văn. */
const fs = require('fs');
const raw = process.argv.includes('--raw');
const norm = function (s) {
  s = s.replace(/\r\n/g, '\n').trim();
  if (raw) return s;
  return s.replace(/"(id|sp_id|sp_kem_id)":("[^"]*"|-?[0-9.]+)/g, '"$1":"~"')
    .replace(/\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(\.\d+)?\+00(:00)?/g, '~T~')
    .replace(/Failing row contains \(\d+/g, 'Failing row contains (~');
};
const a = norm(fs.readFileSync(process.argv[2], 'utf8')).split('\n');
const b = norm(fs.readFileSync(process.argv[3], 'utf8')).split('\n');
// UPDATE / DELETE nhiều dòng không có ORDER BY: thứ tự dòng do Postgres quyết định -> ca upd-* / del-* so không kể thứ tự
const sorted = function (line) {
  const t = line.indexOf('\t'), name = line.slice(0, t);
  if (!/^(upd|del)-/.test(name)) return line;
  let o; try { o = JSON.parse(line.slice(t + 1)); } catch (e) { return line; }
  return Array.isArray(o.ok) ? name + '\t' + o.ok.map(function (r) { return JSON.stringify(r); }).sort().join('\n') : line;
};
let bad = 0;
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] === b[i] || sorted(a[i] || '') === sorted(b[i] || '')) continue;
  bad++;
  const x = a[i] || '', y = b[i] || '';
  let j = 0; while (j < x.length && x[j] === y[j]) j++;
  console.log('KHÁC ở ca ' + (i + 1) + ' (' + x.split('\t')[0] + '), từ ký tự ' + j + ':\n  node: ' + x.slice(Math.max(0, j - 60), j + 160) + '\n    go: ' + y.slice(Math.max(0, j - 60), j + 160));
}
console.log(a.length + ' ca, ' + bad + ' khác' + (raw ? ' (so nguyên văn)' : ''));
process.exit(bad ? 1 : 0);
