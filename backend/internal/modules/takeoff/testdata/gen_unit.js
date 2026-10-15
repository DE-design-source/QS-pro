'use strict';
/* Sinh unit.json: chạy hàm GỐC của server/store_supa.js (và cửa ngõ saveLineAsProductGated của server/auth.js)
 * với tầng supa GIẢ (không chạm database), ghi lại từng lệnh trên db_bao_gia (đặt tên theo phương thức của
 * Repository bên Go) và kết quả / lỗi. Với saveLineAsProduct, saveDbProduct thật chạy trên tầng giả; kết quả
 * của nó được ghi vào "saver" để bản giả ProductSaver bên Go trả lại đúng như vậy.
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
const auth = require(path.join(root, 'server', 'auth.js'));
const cases = require('./unit_cases.json');
const KHONG_QUYEN = 'Tài khoản không có quyền thêm sản phẩm vào danh mục';

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
function other(table) { return rt((cur.fake.other && cur.fake.other[table]) || []); }
supa.select = async function (table, o) {
  o = o || {};
  if (table !== 'db_bao_gia') return other(table);
  if (o.select === 'sort_no') return call('MaxSortNo', [dec(o.filter, 'ma_du_an')]);
  if (/^id=eq\./.test(o.filter)) return call('FindLine', [dec(o.filter, 'id')]);
  return call('ListLines', [dec(o.filter, 'ma_du_an')]);
};
supa.insert = async function (table, row) {
  if (table === 'db_bao_gia') return call('InsertLine', [row], function () { return [Object.assign({ id: 900 }, rt(row))]; });
  const r = Array.isArray(row) ? row[0] : row;
  if (table === 'db_san_pham') cur.who = r.nguoi_tao || null;
  return [Object.assign({ id: 555 }, rt(r))];
};
supa.update = async function (table, filter, patch) {
  if (table === 'db_bao_gia') {
    return call('UpdateLine', [dec(filter, 'id'), patch], function () {
      const c = ((cur.fake.ret && cur.fake.ret.FindLine) || [])[0];
      return [Object.assign({}, rt(c) || {}, rt(patch))];
    });
  }
  if (table === 'db_san_pham') cur.who = patch.nguoi_sua || null;
  return [];
};
supa.remove = async function (table, filter) {
  if (table === 'db_bao_gia') return call('DeleteLine', [dec(filter, 'id')]);
  return [];
};

(async function () {
  const out = [];
  for (const c of cases) {
    cur = { fake: c.fake || {}, log: [], who: null };
    const expect = { log: cur.log };
    try {
      const r = await tenant.run(c.ctx || {}, function () {
        if (c.fn === 'saveLineAsProduct') return auth.saveLineAsProductGated.apply(null, [c.actor || null].concat(c.args));
        return store[c.fn].apply(null, c.args);
      });
      expect.result = r === undefined ? null : r;
    } catch (e) { expect.error = e.message; }
    const o = Object.assign({}, c);
    if (c.fn === 'saveLineAsProduct') {
      const r = expect.result;
      if (r) {
        // kết quả của saveDbProduct: {updated|created, ma, ten, id} (store_supa.js:545, 559)
        o.saver = r.updated ? { updated: true, ma: r.ma, ten: r.ten, id: r.id } : { created: true, ma: r.ma, ten: r.ten, id: r.id };
        o.who = cur.who;
      } else if (expect.error !== KHONG_QUYEN) o.saverErr = expect.error;
    }
    o.expect = rt(expect);
    out.push(o);
  }
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  process.exit(0);
})();
