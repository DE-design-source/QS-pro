'use strict';
/* Sinh unit.json: chạy hàm GỐC của server/store_supa.js với tầng supa GIẢ (không chạm database), ghi lại
 * từng lệnh đọc / ghi (đặt tên theo phương thức của Repository bên Go) và kết quả / lỗi.
 *
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen_unit.js > unit.json
 */
const path = require('path');
if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
  process.exit(2);
}
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const supa = require(path.join(root, 'server', 'supa.js'));
const tenant = require(path.join(root, 'server', 'tenant.js'));
const store = require(path.join(root, 'server', 'store_supa.js'));
const cases = require('./unit_cases.json');

let cur = null;
function rt(v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
function dec(filter, col) {
  const m = new RegExp('(?:^|&)' + col + '=eq\\.([^&]*)').exec(filter || '');
  return m ? decodeURIComponent(m[1]) : null;
}
function call(m, a, dflt) {
  cur.log.push({ m: m, a: rt(a) });
  const f = cur.fake || {};
  if (f.err && f.err[m]) throw new Error(f.err[m]);
  if (f.ret && f.ret[m] !== undefined) return rt(f.ret[m]);
  return dflt ? dflt() : [];
}
supa.select = async function (table, o) {
  o = o || {};
  if (table === 'du_an') return o.order ? call('ListProjects', []) : call('FindProject', [dec(o.filter, 'ma_da')]);
  if (table === 'db_bao_gia') return call('ListLinesRaw', [dec(o.filter, 'ma_du_an')]);
  if (table === 'khai_toan') return call('ListCoverRaw', [dec(o.filter, 'ma_da')]);
  if (table === 'du_an_data') {
    if (o.select === '*') return call('ListProjDataRaw', [dec(o.filter, 'ma_da')]);
    if (o.select === 'khoa,gia_tri') return call('ListProjDataKV', [dec(o.filter, 'ma_da')]);
    return call('FindProjData', [o.filter]);
  }
  if (table === 'cai_dat_cong_ty') {
    if (o.select === 'khoa,gia_tri') {
      if (!!o.noScope !== (o.filter === 'cong_ty_id=is.null')) throw new Error('stub: lọc cài đặt công ty lạ');
      return call('ListCompanySettings', [!!o.noScope]);
    }
    return call('FindCompanySetting', [o.filter, !!o.noScope]);
  }
  throw new Error('stub: select bảng lạ ' + table);
};
supa.insert = async function (table, row, o) {
  if (table === 'du_an') return call('InsertProject', [row], function () { return [Object.assign({ id: 900 }, rt(row))]; });
  if (table === 'db_bao_gia') return call('InsertLines', [row]);
  if (table === 'khai_toan') return call('InsertCover', [row]);
  if (table === 'du_an_data') return Array.isArray(row) ? call('InsertProjDataRows', [row]) : call('InsertProjData', [row]);
  if (table === 'cai_dat_cong_ty') return call('InsertCompanySetting', [row, !!(o && o.noScope)]);
  throw new Error('stub: insert bảng lạ ' + table);
};
supa.update = async function (table, filter, patch, o) {
  if (table === 'du_an') return call('UpdateProject', [dec(filter, 'ma_da'), patch]);
  if (table === 'du_an_data') return call('UpdateProjData', [filter, patch]);
  if (table === 'cai_dat_cong_ty') return call('UpdateCompanySetting', [filter, patch, !!(o && o.noScope)]);
  throw new Error('stub: update bảng lạ ' + table);
};
supa.remove = async function (table, filter) {
  const m = { du_an: 'DeleteProject', db_bao_gia: 'DeleteLines', khai_toan: 'DeleteCover', du_an_data: 'DeleteProjData' }[table];
  if (!m) throw new Error('stub: remove bảng lạ ' + table);
  return call(m, [dec(filter, table === 'db_bao_gia' ? 'ma_du_an' : 'ma_da')]);
};

const TS = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, MA = /DA-\d{8}-\d{6}[0-9A-Z]{0,2}/g;
(async function () {
  const out = [];
  for (const c of cases) {
    cur = { fake: c.fake || {}, log: [] };
    const args = c.fn === 'setProjData' ? [c.actor || null].concat(c.args) : c.args;
    const expect = { log: cur.log };
    try {
      const r = await tenant.run(c.ctx || {}, function () { return store[c.fn].apply(null, args); });
      expect.result = r === undefined ? null : r;
    } catch (e) { expect.error = e.message; }
    const o = Object.assign({}, c);
    o.expect = JSON.parse(JSON.stringify(expect).replace(TS, '<ts>').replace(MA, '<ma>'));
    out.push(o);
  }
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  process.exit(0);
})();
