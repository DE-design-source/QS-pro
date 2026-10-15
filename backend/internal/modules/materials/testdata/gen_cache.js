'use strict';
/* Sinh cache.json: cache danh mục (_cache của store_supa.js:157) phải bị xoá sau MỖI chỗ ghi sản phẩm - 9 chỗ gọi
 * _cacheClear_ (S:542, 556, 570, 653, 714, 793, 894, 947, 1074) - và KHÔNG bị xoá khi lệnh ghi dừng sớm.
 * Mỗi nhóm: nạp cache -> đọc lại (không lệnh nào) -> gọi hàm ghi -> getProductsCached: có lệnh select hay không là do
 * MÃ NODE THẬT quyết định (chạy trên tầng supa giả như gen_unit.js, không chạm database).
 *
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen_cache.js > cache.json
 */
const ref = require('./noderef');
const supa = ref.supa;

console.warn = function () {};
console.error = function () {};
function rt(v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
function ts(v) { return JSON.parse(JSON.stringify(v === undefined ? null : v).replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, '<ts>')); }

const C1 = 'c1c1c1c1-0000-4000-8000-000000000001', C2 = 'c2c2c2c2-0000-4000-8000-000000000002';
const ctxs = { c1: { uid: 'U1', role: 'admin', congTyId: C1, viewAs: null }, sup: { uid: 'U0', role: 'super', congTyId: null, viewAs: null } };
const actors = { adm: { uid: 'U1', u: 'adm', r: 'admin', ct: C1 }, sup: { uid: 'U0', u: 'root', r: 'super', ct: null } };
let script = [], log = [], seq = 0;
function fake(m, table, a, dflt) {
  const rec = { m: m, table: table, a: ts(a) };
  log.push(rec);
  const key = JSON.stringify(a);
  let rule = null;
  for (let i = 0; i < script.length; i++) {
    const r = script[i];
    if (r.m !== m || r.table !== table || (r.has && key.indexOf(r.has) < 0) || (r.once && r.used)) continue;
    rule = r; r.used = true; break;
  }
  if (rule && rule.err) { rec.err = rule.err; throw new Error(rule.err); }
  rec.ret = rt(rule ? rule.ret : dflt());
  return rt(rec.ret);
}
function nul(v) { return v === undefined || v === '' || v === 0 ? null : v; }
supa.select = async function (table, o) {
  o = o || {};
  return fake('select', table, { select: nul(o.select), filter: nul(o.filter), order: nul(o.order), limit: nul(o.limit), noScope: !!o.noScope }, function () { return []; });
};
supa.insert = async function (table, rows, o) {
  return fake('insert', table, { rows: rows, noScope: !!(o && o.noScope) }, function () {
    return (Array.isArray(rows) ? rows : [rows]).map(function (r) { return Object.assign({ id: 9000 + (++seq) }, r); });
  });
};
supa.update = async function (table, filter, patch, o) {
  return fake('update', table, { filter: filter, patch: patch, noScope: !!(o && o.noScope) }, function () { return []; });
};
supa.remove = async function (table, filter, o) {
  return fake('remove', table, { filter: filter, noScope: !!(o && o.noScope) }, function () { return []; });
};

const sel = function (table, has, ret) { return { m: 'select', table: table, has: has, ret: ret }; };
const err = function (m, table, msg, has) { return { m: m, table: table, err: msg, has: has }; };
const P = function (id, o) { return Object.assign({ id: id, ma_sp: 'M' + id, ten_sp: 'SP ' + id, cong_ty_id: C1, da_duyet: false, nhom_bt: null }, o || {}); };
const COL = 'DB PATCH db_san_pham -> 400 {"code":"42703","details":null,"hint":null,"message":"column \\"nhom_bt\\" of relation \\"products\\" does not exist"}';

// [tên, hàm ghi, args, kịch bản của lệnh ghi]
const writes = [
  // 9 chỗ xoá cache
  ['saveDbProduct cập nhật (S:542)', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M' }], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 6, da_duyet: false }])]],
  ['saveDbProduct tạo mới (S:556)', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'Đèn X' }], []],
  ['deleteDbProduct (S:570)', 'deleteDbProduct', ['7'], [sel('db_san_pham', 'id,cong_ty_id', [{ id: 7, cong_ty_id: C1 }]), sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['updateDbProductTracked (S:653)', 'updateDbProductTracked', ['M7', { 'TÊN SẢN PHẨM': 'Tên mới' }], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)])]],
  ['setSpDuyet (S:714)', 'setSpDuyet', [['13'], true], [sel('db_san_pham', 'id=eq.13', [P(13)])]],
  ['setYeuThich (S:793)', 'setYeuThich', [[7], true], [sel('db_san_pham', 'id=eq.7', [{ id: 7, ma_sp: 'M7' }])]],
  ['setCombo (S:894)', 'setCombo', ['7', [{ id: 8, soLuong: 1 }]], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['setBienThe (S:947)', 'setBienThe', [7, [8, 9]], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['importCommit (S:1074)', 'importCommit', [[{ ten: 'Đèn nhập', ma: 'IMP-1' }]], []],
  // lệnh ghi dừng sớm / lỗi: cache còn hay mất là theo Node
  ['saveDbProduct thiếu tên', 'saveDbProduct', [{ 'MÃ SẢN PHẨM': 'M' }], []],
  ['saveDbProduct lỗi tra trùng', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M' }], [err('select', 'db_san_pham', 'DB GET db_san_pham -> 500 {}')]],
  ['saveDbProduct lỗi chèn', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T' }], [err('insert', 'db_san_pham', 'DB POST db_san_pham -> 409 {"code":"23505"}')]],
  ['deleteDbProduct không thấy', 'deleteDbProduct', ['M9'], []],
  ['deleteDbProduct lỗi xoá', 'deleteDbProduct', ['M7'], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)]), err('remove', 'db_san_pham', 'DB DELETE db_san_pham -> 409 {}')]],
  ['deleteDbProduct kho chung', 'deleteDbProduct', ['M50'], [sel('db_san_pham', 'id,cong_ty_id', [{ id: 50, cong_ty_id: C2 }])]],
  ['updateDbProductTracked không đổi', 'updateDbProductTracked', [7, { 'TÊN SẢN PHẨM': 'SP 7' }], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['updateDbProductTracked không thấy', 'updateDbProductTracked', ['M9', { 'TÊN SẢN PHẨM': 'x' }], []],
  ['updateDbProductTracked lỗi cột', 'updateDbProductTracked', ['M7', { 'TÊN SẢN PHẨM': 'Tên mới' }], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)]), err('update', 'db_san_pham', COL)]],
  ['setSpDuyet không khoá nào', 'setSpDuyet', [[], true], []],
  ['setSpDuyet không thấy sản phẩm', 'setSpDuyet', [['KHONG'], true], []],
  ['setSpDuyet đã duyệt sẵn', 'setSpDuyet', [['13'], true], [sel('db_san_pham', 'id=eq.13', [P(13, { da_duyet: true })])]],
  ['setYeuThich không khoá nào', 'setYeuThich', [[], true], []],
  ['setYeuThich không thấy sản phẩm', 'setYeuThich', [['KHONG'], true], []],
  ['setCombo không thấy', 'setCombo', ['M9', []], []],
  ['setCombo lỗi chèn', 'setCombo', ['7', [{ id: 8 }]], [sel('db_san_pham', 'id=eq.7', [P(7)]), err('insert', 'sp_combo', 'DB POST sp_combo -> 409 {"code":"23503"}')]],
  ['setBienThe không thấy', 'setBienThe', ['M9', [8]], []],
  ['setBienThe thiếu cột', 'setBienThe', [7, [8]], [sel('db_san_pham', 'id=eq.7', [P(7)]), err('update', 'db_san_pham', COL)]],
  ['importCommit danh sách rỗng', 'importCommit', [[]], []],
  ['importCommit không phải mảng', 'importCommit', [{ ten: 'A' }], []],
  ['importCommit mọi dòng đều lỗi', 'importCommit', [[{ ten: 'Lỗi', ma: 'IMP-ERR' }]], [err('select', 'db_san_pham', 'DB GET db_san_pham -> 500 {}', 'ma_sp=eq.IMP-ERR')]],
  // lệnh đọc: không bao giờ xoá cache
  ['getDbProduct (đọc)', 'getDbProduct', ['7'], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['getCombo (đọc)', 'getCombo', [7], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['getBienThe (đọc)', 'getBienThe', [7], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['getProductHistory (đọc)', 'getProductHistory', ['M7'], []]
];

const catalog = [sel('db_san_pham', 'ten_sp.asc', [P(1, { ten_sp: 'A', nhom_sp: 'N1' }), P(2, { ten_sp: 'B', dong_sp: 'D2' })])];
const flows = [];
writes.forEach(function (w) {
  // cache của công ty c1 VÀ của super (_all) cùng được nạp: _cacheClear_ xoá cache của MỌI công ty
  flows.push([w[0] + ' | nạp cache c1', 'c1', 'adm', '$getProductsCached', [], catalog]);
  flows.push([w[0] + ' | nạp cache super', 'sup', 'sup', '$getProductsCached', [], catalog]);
  flows.push([w[0] + ' | đang có cache', 'c1', 'adm', '$getProductsCached', [], []]);
  flows.push([w[0] + ' | GHI', 'c1', 'adm', w[1], w[2], w[3]]);
  flows.push([w[0] + ' | c1 đọc lại', 'c1', 'adm', '$getProductsCached', [], catalog]);
  flows.push([w[0] + ' | super đọc lại', 'sup', 'sup', '$getProductsCached', [], catalog]);
});

(async function () {
  const out = { flows: [], summary: [] };
  let nSel = 0;
  for (const f of flows) {
    script = f[5].map(function (r) { return Object.assign({}, r, { used: false }); });
    log = [];
    const rec = { name: f[0], ctx: ctxs[f[1]], actor: actors[f[2]], fn: f[3], args: rt(f[4]) };
    try { rec.result = ts(await ref.tenant.run(ctxs[f[1]], function () { return ref.call(f[3], actors[f[2]], rt(f[4])); })); }
    catch (e) { rec.error = e.message; }
    rec.calls = log;
    out.flows.push(rec);
    // tóm tắt cho người đọc: sau lệnh ghi, cache của c1 / super có phải đọc lại không
    const reread = log.some(function (c) { return c.table === 'db_san_pham' && c.a.order === 'ten_sp.asc'; });
    if (/\| c1 đọc lại$/.test(f[0])) nSel = reread ? 1 : 0;
    if (/\| super đọc lại$/.test(f[0])) out.summary.push([f[0].split(' | ')[0], nSel === 1, reread]);
  }
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  process.exit(0);
})().catch(function (e) { process.stderr.write(String(e && e.stack) + '\n'); process.exit(1); });
