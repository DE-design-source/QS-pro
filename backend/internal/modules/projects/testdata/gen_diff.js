'use strict';
/* Sinh diff.json: chạy kịch bản diff_cases.json bằng hàm GỐC của server/store_supa.js trên database thử qspro_nodetest,
 * ghi kết quả đã chuẩn hoá (id, thời điểm, mã sinh ngẫu nhiên). Test Go (TestDiffDB) chạy lại đúng kịch bản trên
 * qspro_gotest và so từng bước. Mọi dòng tạo ra mang tiền tố ZZ_ và được xoá ở cuối kịch bản.
 *
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen_diff.js > diff.json
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
const spec = require('./diff_cases.json');

const saved = {};
function fill(v) {
  return JSON.parse(JSON.stringify(v).replace(/\{\{(\w+)\}\}/g, function (_, n) { return saved[n] === undefined ? 'MISSING' : saved[n]; }));
}
function norm(v) {
  let t = JSON.stringify(v);
  // id dạng số không thay theo chuỗi (dễ trùng với số khác); đã có các mẫu "id" / "lineId" bên dưới
  Object.keys(saved).forEach(function (n) { if (!/^\d+$/.test(saved[n])) t = t.split(saved[n]).join('<' + n + '>'); });
  return t.replace(/"id":\d+/g, '"id":"<id>"').replace(/"lineId":"\d+"/g, '"lineId":"<id>"').replace(/Failing row contains \(\d+,/g, 'Failing row contains (<id>,')
    .replace(/\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d(:\d\d)?)/g, '<ts>');
}
async function runStep(st) {
  if (st.op === 'insert') { await supa.insert(st.table, st.rows, { noScope: !!st.noScope }); return { ok: true }; }
  if (st.op === 'remove') { await supa.remove(st.table, st.filter, { noScope: !!st.noScope }); return { ok: true }; }
  if (st.op === 'rows') {
    const o = { filter: st.filter, noScope: !!st.noScope };
    if (st.select) o.select = st.select;
    if (st.order) o.order = st.order;
    return { rows: await supa.select(st.table, o) };
  }
  if (st.op === 'bootstrap') {
    const r = await store.bootstrap.apply(null, st.args);
    st.aux = { nhom: r.products.map(function (p) { return p.nhom === undefined ? null : p.nhom; }) };
    return { keys: Object.keys(r), projects: r.projects.filter(function (p) { return String(p.ten).indexOf(st.only) === 0; }),
      catSheets: r.catSheets, sheetCols: r.sheetCols };
  }
  const args = st.fn === 'setProjData' ? [spec.actor].concat(st.args) : st.args;
  let r = await store[st.fn].apply(null, args);
  if (r === undefined) r = null;
  if (st.save) saved[st.save.name] = String(r[st.save.key]);
  if (st.only && Array.isArray(r)) r = r.filter(function (p) { return String(p.ten).indexOf(st.only) === 0; });
  if (st.pick && r) { const o = {}; Object.keys(r).forEach(function (k) { if (st.pick.indexOf(k) >= 0) o[k] = r[k]; }); r = o; }
  return { result: r };
}
// Kịch bản ghi rồi xoá khoá btFmt trong cai_dat_cong_ty (khoá nằm trong danh sách cho phép nên không gắn được tiền tố ZZ_):
// đã có sẵn dòng btFmt không phải của test thì dừng, không ghi đè / xoá dữ liệu có sẵn.
async function coSanCaiDat_() {
  const seen = {};
  for (const k of Object.keys(spec.contexts)) {
    const ct = spec.contexts[k].congTyId;
    if (seen[ct]) continue;
    seen[ct] = 1;
    const rows = await supa.select('cai_dat_cong_ty', { filter: 'khoa=eq.btFmt&cong_ty_id=' + (ct ? 'eq.' + ct : 'is.null'), noScope: true });
    if (rows.some(function (r) { return r.nguoi_sua !== spec.actor.u; })) return true;
  }
  return false;
}
(async function () {
  if (await tenant.run(spec.contexts.none, coSanCaiDat_)) {
    console.error('Từ chối chạy: cai_dat_cong_ty đã có dòng btFmt không phải của test');
    process.exit(3);
  }
  const steps = [];
  for (const raw of spec.steps) {
    const st = fill(raw);
    let out;
    try { out = await tenant.run(spec.contexts[st.ctx], function () { return runStep(st); }); }
    catch (e) { out = { error: e.message }; }
    const rec = Object.assign({}, raw, { out: norm(out) });
    if (st.aux) rec.aux = st.aux;
    steps.push(rec);
  }
  process.stdout.write(JSON.stringify({ contexts: spec.contexts, actor: spec.actor, steps: steps }, null, 1) + '\n');
  process.exit(0);
})();
