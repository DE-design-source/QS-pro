'use strict';
/* Sinh genma.json: mã dự án do genMaDA_ THẬT của store_supa.js tạo ra (gọi qua createProject với tầng supa giả),
 * với Date.now và Math.random cố định. Không chạm database.
 *
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen_ma.js > genma.json
 */
const path = require('path');
if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
  process.exit(2);
}
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const supa = require(path.join(root, 'server', 'supa.js'));
const store = require(path.join(root, 'server', 'store_supa.js'));

let last = null;
supa.insert = async function (table, row) { last = row.ma_da; return [row]; };
const realNow = Date.now, realRand = Math.random;
const times = [0, 1760317200000, 1760374799999, 1760374800000, 1767200399000, 1767200400000, 1709139599000, 1709226000000, 1791111111111, 4102444799000];
const rands = [0, 0.5, 0.123456789, 0.999999999, 1 / 36, 35 / 36, 0.027, 1e-7, 0.7071067811865476, 0.25, 1 / 3, 0.0001, 0.99, 37 / 1296, 0.9999999999999999, 5e-324, 0.1, 0.2, 0.3];
let seed = 20261013;
for (let i = 0; i < 400; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; rands.push(seed / 2147483648); }
for (let i = 0; i < 400; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; const hi = seed; seed = (seed * 1103515245 + 12345) % 2147483648; rands.push((hi * 2097152 + (seed % 2097152)) / 4503599627370496); }
(async function () {
  const out = [];
  for (let i = 0; i < Math.max(times.length, rands.length); i++) {
    const ms = times[i % times.length], x = rands[i % rands.length];
    Date.now = function () { return ms; }; Math.random = function () { return x; };
    await store.createProject({});
    out.push([ms, x, last]);
  }
  Date.now = realNow; Math.random = realRand;
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
})();
