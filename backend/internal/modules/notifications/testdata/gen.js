'use strict';
/* Sinh giá trị mong đợi cho test của module notifications từ MÃ NODE THẬT (server/auth.js).
 *
 *   node gen.js pure   -> golden_pure.json  (DX_TEN, phép tính limit của notifList, phép đổi dòng -> object)
 *   node gen.js db     -> golden_db.json    (kịch bản trên database thử qspro_nodetest)
 *
 * Chạy "db" CHỈ với biến môi trường tường minh:
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen.js db
 * Kịch bản trong service_test.go (TestDiffDB) phải đi đúng từng bước như ở đây.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const mode = process.argv[2] || 'pure';

function pure() {
  const src = fs.readFileSync(path.join(root, 'server', 'auth.js'), 'utf8');
  const supaSrc = fs.readFileSync(path.join(root, 'server', 'supa.js'), 'utf8');
  const pick = function (s, re) { const m = s.match(re); if (!m) throw new Error('không tìm thấy ' + re); return m; };
  const DX_TEN = new Function('return ' + pick(src, /const DX_TEN = (\{.*\});/)[1])();
  const dxDefault = pick(src, /const ten = DX_TEN\[dx\.loai\] \|\| '(.*?)';/)[1];
  // limit của notifList (auth.js) rồi mệnh đề limit của supa.select (supa.js) - lấy nguyên biểu thức từ mã nguồn
  const limExpr = pick(src, /async function notifList\(actor, limit\) \{[\s\S]*?limit: (Math\.min\(.*?\)) \}\);/)[1];
  const supaLim = pick(supaSrc, /const lim = (Number\(opt\.limit\) \|\| 0);/)[1];
  const supaClause = pick(supaSrc, /\+ (\(lim \? ' limit ' \+ Math\.floor\(lim\) : ''\)) \+/)[1];
  const clause = new Function('limit', 'const opt = { limit: ' + limExpr + ' }; const lim = ' + supaLim + '; return ' + supaClause + ';');
  const mapExpr = pick(src, /async function notifList\(actor, limit\) \{[\s\S]*?return rows\.map\((function \(n\) \{.*?\})\);/)[1];
  const mapRow = new Function('return ' + mapExpr)();

  const out = { dxTen: [], limit: [], row: [] };
  ['ck', 'tt', 'zz', '', 'CK', 'undefined', 'null'].forEach(function (k) { out.dxTen.push({ loai: k, out: DX_TEN[k] || dxDefault }); });
  // undefined không viết được trong JSON: dùng chuỗi đánh dấu "__undefined__"
  [undefined, null, 0, 1, 2, 30, 99, 100, 101, 1e9, '5', ' 7 ', 'abc', '', true, false, 0.5, 0.999, 1.5, 99.9, -1, -0.5, -3.7, [], [4], {}, '0x10', '1e2', NaN, -3e9, -5e18, -9223372036854774784, -(2 ** 63), -1e19, -1e21, '-Infinity', -Infinity, Infinity]
    .forEach(function (v) {
      const k = v === undefined ? '__undefined__' : (typeof v === 'number' && isNaN(v) ? '__nan__' : v === -Infinity ? '__neginf__' : v === Infinity ? '__inf__' : v);
      out.limit.push({ limit: k, out: clause(v) });
    });
  [
    { id: 1, kind: 'k', title: 't', body: 'b', ref_id: 'R', is_read: true, created_at: '2026-01-01T00:00:00+00:00', cong_ty_id: 'x', user_id: 'u' },
    { id: 2, kind: null, title: null, body: null, ref_id: null, is_read: false, created_at: null },
    { id: 3, is_read: null },
    { id: 4, is_read: 1, ref_id: 5 },
    { id: 5, is_read: 'true' }
  ].forEach(function (r) { out.row.push({ row: r, out: mapRow(r) }); });

  fs.writeFileSync(path.join(__dirname, 'golden_pure.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('golden_pure.json:', out.dxTen.length, 'dxTen,', out.limit.length, 'limit,', out.row.length, 'row');
}

async function db() {
  if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
    console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
    process.exit(2);
  }
  const { Pool } = require(path.join(root, 'node_modules', 'pg'));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const supa = require(path.join(root, 'server', 'supa.js'));
  const tenant = require(path.join(root, 'server', 'tenant.js'));
  const auth = require(path.join(root, 'server', 'auth.js'));

  const sweep = async function () {
    const ct = "(select id from companies where code like 'zz-notifications%')";
    await pool.query('delete from notifications where company_id in ' + ct);
    await pool.query('delete from audit_logs where company_id in ' + ct + " or username like 'zz_notifications%'");
    await pool.query("delete from users where username like 'zz_notifications%'");
    await pool.query("delete from companies where code like 'zz-notifications%'");
  };
  await sweep();

  const NS = { noScope: true };
  const GHOST = '00000000-0000-4000-8000-00000000abcd';
  const labels = [[GHOST, '<ghost>']];
  const steps = {};
  try {
    const ct = (await supa.insert('cong_ty', { ten: 'ZZ_notifications Cty', ma: 'zz-notifications-1' }, NS))[0];
    labels.push([ct.id, '<CT>']);
    const mk = async function (name, hoTen, role, active) {
      const u = (await supa.insert('users', { username: 'zz_notifications_' + name, ho_ten: hoTen, password_hash: 'x', role: role, active: active, cong_ty_id: ct.id }, NS))[0];
      labels.push([u.id, '<U:' + name + '>']);
      return { actor: { uid: u.id, u: u.username, r: role, ct: ct.id }, ctx: { uid: u.id, role: role, congTyId: ct.id, viewAs: null } };
    };
    const A1 = await mk('adm1', 'ZZ Admin Một', 'admin', true);
    const A2 = await mk('adm2', '', 'admin', true);
    await mk('adm3', 'ZZ khoá', 'admin', false);
    const ST = await mk('stf', '', 'staff', true);
    const GH = { actor: { uid: GHOST, u: 'zz_notifications_ghost', r: 'staff', ct: ct.id }, ctx: { uid: GHOST, role: 'staff', congTyId: ct.id, viewAs: null } };

    // id thông báo khác nhau giữa hai database -> đổi thành thứ tự tạo trong công ty thử
    const nid = async function () {
      const r = await pool.query('select id from notifications where company_id = $1 order by id', [ct.id]);
      const m = {}; r.rows.forEach(function (x, i) { m[String(x.id)] = '<N' + (i + 1) + '>'; }); return m;
    };
    const norm = async function (v) {
      const m = await nid();
      let s = JSON.stringify(v === undefined ? null : v, function (k, x) { return (k === 'id' && m[String(x)]) ? m[String(x)] : x; });
      labels.forEach(function (p) { s = s.split(p[0]).join(p[1]); });
      return JSON.parse(s.replace(/"\d{4}-\d\d-\d\dT[\d:.]+\+00:00"/g, '"<ts>"'));
    };
    const step = async function (name, who, fn) {
      let r;
      try { r = { ok: await tenant.run(who.ctx, function () { return fn(who.actor); }) }; } catch (e) { r = { err: String(e && e.message) }; }
      steps[name] = await norm(r);
      return r.ok;
    };
    const dump = async function () {
      const r = await pool.query('select id, user_id, kind, title, body, ref_id, is_read, company_id from notifications where company_id = $1 order by id', [ct.id]);
      return r.rows.map(function (x) { return { id: Number(x.id), user: x.user_id, kind: x.kind, title: x.title, body: x.body, refId: x.ref_id, read: x.is_read, ct: x.company_id }; });
    };

    await step('n01a_count_empty', A1, function (a) { return auth.notifCount(a); });
    await step('n01b_list_empty', A1, function (a) { return auth.notifList(a); });
    await step('n02_purchase', ST, function (a) {
      return auth.notifyPurchaseAdmins(a, [{ maDon: 'ZZ_notifications_PO1', supplier: 'NCC A' }, { maDon: 'ZZ_notifications_PO2' }, { maDon: 77, supplier: 0 }]);
    });
    await step('n03a_dexuat_ck', A1, function (a) { return auth.notifyDeXuatAdmins(a, { ma: 'ZZ_notifications_DX1', loai: 'ck', supplier: 'S' }); });
    await step('n03b_dexuat_tt', ST, function (a) { return auth.notifyDeXuatAdmins(a, { ma: 'ZZ_notifications_DX2', loai: 'tt' }); });
    await step('n03c_dexuat_la', A1, function (a) { return auth.notifyDeXuatAdmins(a, { ma: 5, loai: 'zz', supplier: '' }); });
    await step('n04a_ghost_null', GH, function (a) { return auth.notifyPurchaseAdmins(a, null); });
    await step('n04b_ghost_one', GH, function (a) { return auth.notifyPurchaseAdmins(a, [{ maDon: 'ZZ_notifications_PO3', supplier: 'G' }]); });
    await step('n05_null_order', ST, function (a) { return auth.notifyPurchaseAdmins(a, [null]); });
    await step('n06a_count_a1', A1, function (a) { return auth.notifCount(a); });
    await step('n06b_count_a2', A2, function (a) { return auth.notifCount(a); });
    await step('n06c_count_staff', ST, function (a) { return auth.notifCount(a); });
    await step('n06d_list', A1, function (a) { return auth.notifList(a); });
    await step('n06e_list_2', A1, function (a) { return auth.notifList(a, 2); });
    await step('n06f_list_str3', A1, function (a) { return auth.notifList(a, '3'); });
    await step('n06g_list_half', A1, function (a) { return auth.notifList(a, 0.5); });
    await step('n06h_list_neg', A1, function (a) { return auth.notifList(a, -1); });
    await step('n06i_list_big', A1, function (a) { return auth.notifList(a, 1000); });
    await step('n06j_list_null', A2, function (a) { return auth.notifList(a, null); });
    await step('n06k_list_1_5', A1, function (a) { return auth.notifList(a, 1.5); });

    // limit âm quá cỡ bigint / -Infinity: Postgres báo lỗi khác với limit âm thường
    await step('n06l_list_neg_3e9', A1, function (a) { return auth.notifList(a, -3e9); });
    await step('n06m_list_neg_5e18', A1, function (a) { return auth.notifList(a, -5e18); });
    await step('n06n_list_neg_2p63', A1, function (a) { return auth.notifList(a, -(2 ** 63)); });
    await step('n06o_list_neg_1e19', A1, function (a) { return auth.notifList(a, -1e19); });
    await step('n06p_list_neg_1e21', A1, function (a) { return auth.notifList(a, -1e21); });
    await step('n06q_list_neg_inf_str', A1, function (a) { return auth.notifList(a, '-Infinity'); });
    await step('n06r_list_neg_inf', A1, function (a) { return auth.notifList(a, -Infinity); });
    await step('n06s_list_neg_below', A1, function (a) { return auth.notifList(a, -9223372036854774784); });

    const rows = await dump();
    const ofA1 = rows.filter(function (x) { return x.user === A1.actor.uid; }), ofA2 = rows.filter(function (x) { return x.user === A2.actor.uid; });
    await step('n07a_read', A1, function (a) { return auth.notifRead(a, ofA1[0].id); });
    await step('n07b_read_str', A1, function (a) { return auth.notifRead(a, String(ofA1[1].id)); });
    await step('n07c_read_other', A1, function (a) { return auth.notifRead(a, ofA2[0].id); });
    await step('n07d_read_bad', A1, function (a) { return auth.notifRead(a, 'abc'); });
    await step('n07e_read_undefined', A1, function (a) { return auth.notifRead(a); });
    await step('n07f_count_a1', A1, function (a) { return auth.notifCount(a); });
    await step('n07g_list_a1', A1, function (a) { return auth.notifList(a); });
    await step('n07h_count_a2', A2, function (a) { return auth.notifCount(a); });
    steps.n07z_rows = await norm(await dump());
    await step('n08a_read_all', A1, function (a) { return auth.notifReadAll(a); });
    await step('n08b_count_a1', A1, function (a) { return auth.notifCount(a); });
    await step('n08c_count_a2', A2, function (a) { return auth.notifCount(a); });
    await step('n08d_read_all_again', A1, function (a) { return auth.notifReadAll(a); });
    steps.n08z_rows = await norm(await dump());

    const au = await pool.query('select username, action, detail, user_id from audit_logs where company_id = $1 order by id', [ct.id]);
    steps.audit = await norm(au.rows.map(function (r) { return { username: r.username, action: r.action, detail: r.detail, uid: r.user_id }; }));
  } finally {
    await sweep();
    await pool.end();
    await supa.close();
  }
  fs.writeFileSync(path.join(__dirname, 'golden_db.json'), JSON.stringify(steps, null, 1) + '\n');
  console.log('golden_db.json:', Object.keys(steps).length, 'bước');
}

if (mode === 'pure') pure();
else if (mode === 'db') db().catch(function (e) { console.error(e); process.exit(1); });
else { console.error('dùng: node gen.js pure|db'); process.exit(2); }
