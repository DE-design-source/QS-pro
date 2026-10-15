'use strict';
/* Đối chiếu tầng dữ liệu: chạy các ca trong db-diff-cases.json qua server/supa.js (bản Node - chuẩn gốc)
 * và in mỗi ca 1 dòng "tên<TAB>json". Bản Go in cùng định dạng (TestDiffDump) rồi so từng dòng.
 *
 * CHỈ chạy trên database thử qspro_nodetest:
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node db-diff-node.js > out-node.txt
 */
const path = require('path');
if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
  process.exit(2);
}
const root = path.join(__dirname, '..', '..', '..');
const supa = require(path.join(root, 'server', 'supa.js'));
const tenant = require(path.join(root, 'server', 'tenant.js'));
const spec = require('./db-diff-cases.json');

function fill(c, results) {
  return JSON.parse(JSON.stringify(c).replace(/\{\{([^.}]+)\.(\d+)\.([^.}]+)\}\}/g, function (_, n, i, k) {
    const r = results[n] && results[n].ok && results[n].ok[Number(i)];
    return r ? String(r[k]) : 'MISSING';
  }));
}
async function runCase(c) {
  const o = { noScope: !!c.noScope };
  if (c.op === 'select') return c.opt === undefined ? supa.select(c.table) : supa.select(c.table, c.opt);
  if (c.op === 'insert') return supa.insert(c.table, c.rows, o);
  if (c.op === 'update') return supa.update(c.table, c.filter, c.patch, o);
  if (c.op === 'remove') return supa.remove(c.table, c.filter, o);
  throw new Error('op lạ: ' + c.op);
}
(async function () {
  const results = {};
  for (const raw of spec.cases) {
    const c = fill(raw, results);
    let out;
    try {
      out = { ok: await tenant.run(spec.contexts[c.ctx], function () { return runCase(c); }) };
    } catch (e) {
      out = { err: e.message, code: e.code === undefined ? null : e.code, status: e.status === undefined ? null : e.status };
    }
    results[c.n] = out;
    process.stdout.write(c.n + '\t' + JSON.stringify(out) + '\n');
  }
  await supa.close();
})().catch(function (e) { console.error(e); process.exit(1); });
