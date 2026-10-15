'use strict';
/* Sinh giá trị mong đợi cho test của module companies từ MÃ NODE THẬT (server/auth.js).
 *
 *   node gen.js pure   -> golden_pure.json  (hàm thuần: todayVN_, hetHan_, ctOut_, biểu thức tạo mã công ty)
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
  const pick = function (re) { const m = src.match(re); if (!m) throw new Error('không tìm thấy ' + re); return m[0]; };
  const fnToday = pick(/function todayVN_\(\) \{.*\}/);
  const fnHetHan = pick(/function hetHan_\(ct\) \{.*\}/);
  const fnCtOut = pick(/function ctOut_\(r\) \{[\s\S]*?\n\}/);
  const maExpr = src.match(/const ma = (String\(data\.ma \|\| ten\)[\s\S]*?\.slice\(0, 32\));/);
  if (!maExpr) throw new Error('không tìm thấy biểu thức mã công ty');
  const auExpr = src.match(/const adminUser = (String\(data\.adminUser \|\| ''\)\.trim\(\)\.toLowerCase\(\));/);
  if (!auExpr) throw new Error('không tìm thấy biểu thức adminUser');
  const adminUserOf = new Function('data', 'return ' + auExpr[1] + ';');
  const f = new Function(fnToday + '\n' + fnHetHan + '\n' + fnCtOut +
    '\nreturn { todayVN_: todayVN_, hetHan_: hetHan_, ctOut_: ctOut_, ma: function (data, ten) { return ' + maExpr[1] + '; } };')();

  const realNow = Date.now;
  const at = function (ms, fn) { Date.now = function () { return ms; }; try { return fn(); } finally { Date.now = realNow; } };

  const out = { slug: [], adminUser: [], ctOut: [], todayVN: [], hetHan: [] };

  // chữ hoa mới có từ Unicode 16 (Node 22): bảng của golang.org/x/text cũ hơn nên phải kiểm riêng
  const U16 = ['\u1C89', '\uA7CB', '\uA7CC', '\uA7DA', '\uA7DC'].concat(Array.from({ length: 22 }, function (_, i) { return String.fromCodePoint(0x10D50 + i); })).join('');
  [undefined, null, 0, '', '  Admin  ', 'ZZ_Companies_ĐỖ', 'İstanbul ΣΑΣ', 'ΟΔΟΣ\uA7CB', 123, true, ['A', 'B'], U16, ' x' + U16 + 'Y ']
    .forEach(function (v) { out.adminUser.push({ in: v === undefined ? '__undefined__' : v, out: adminUserOf({ adminUser: v }) }); });

  const slugIn = [
    [null, 'a' + U16 + 'b'],
    [null, 'Công Ty Đỗ Ánh #1'], ['  --Hello__World--  ', 'x'], [null, 'ĐẠI ĐỒNG đỏ'], [null, 'İstanbul ΣΑΣ Straße'],
    [null, 'a'.repeat(40)], [null, 'abc ' + 'x'.repeat(27) + ' yz'], [null, '!!!'], [123, 'x'], [null, 'Å K ﬁ'],
    [null, 'Tiếng Việt có dấu & ký tự'], [null, 'Cty 😀 vui'], ['ZZ_companies_Mã 2', 'x'], [0, 'Số Không'], ['', 'Rỗng'],
    [true, 'x'], [null, 'é è ơ'], [null, 'ǅ ẞ Ω']
  ];
  slugIn.forEach(function (c) { out.slug.push({ ma: c[0], ten: c[1], out: f.ma({ ma: c[0] }, c[1]) }); });

  const rows = [
    { id: 'u-1', ten: 'A', ma: 'a', logo_url: 'http://l', mau_chinh: '#fff', tinh_nang: ' a, b ,,c ', gioi_han_user: 12, active: true,
      han_dung: '2030-01-02', ghi_chu: 'g', ngay_tao: '2026-01-01T00:00:00+00:00', email: 'e', sdt: 's', dung_sp_dezon: true },
    { id: 'u-2', ten: null, ma: null, logo_url: null, mau_chinh: null, tinh_nang: null, gioi_han_user: null, active: null,
      han_dung: null, ghi_chu: null, ngay_tao: null, email: null, sdt: null, dung_sp_dezon: null },
    { ten: 'thiếu khoá' },
    { id: 3, ten: '', tinh_nang: ',, ,', gioi_han_user: '15', active: false, dung_sp_dezon: false },
    { id: 4, gioi_han_user: 'x', active: 0, dung_sp_dezon: 'true', tinh_nang: 'một' },
    { id: 5, gioi_han_user: -2.5, active: 'false', dung_sp_dezon: 1, tinh_nang: 0, han_dung: 0 }
  ];
  rows.forEach(function (r) { out.ctOut.push({ row: r, out: f.ctOut_(r) }); });

  const T = function (iso) { return Date.parse(iso); };
  ['2026-09-30T16:59:59.999Z', '2026-09-30T17:00:00.000Z', '2026-12-31T17:00:00Z', '2024-02-28T23:30:00Z', '2026-10-13T03:00:00Z']
    .forEach(function (iso) { out.todayVN.push({ now: T(iso), out: at(T(iso), f.todayVN_) }); });

  const now1 = T('2026-09-30T16:59:59.999Z'), now2 = T('2026-09-30T17:00:00.000Z');
  [
    [now1, null], [now1, {}], [now1, { hanDung: '' }], [now1, { hanDung: '2026-09-30' }], [now2, { hanDung: '2026-09-30' }],
    [now2, { hanDung: '2026-10-01' }], [now2, { hanDung: '2026-09-30T23:59:59+00:00' }], [now2, { hanDung: '2026-10-01T00:00:00+00:00' }],
    [now2, { hanDung: 20200101 }], [now2, { hanDung: 0 }], [now2, { hanDung: '9' }], [now2, { hanDung: '2026' }],
    [now2, { hanDung: '2026-10-01x' }], [now2, { hanDung: true }], [now2, { hanDung: 'abc' }], [now2, { hanDung: '2026-1-1' }]
  ].forEach(function (c) { out.hetHan.push({ now: c[0], ct: c[1], out: at(c[0], function () { return f.hetHan_(c[1]); }) }); });

  fs.writeFileSync(path.join(__dirname, 'golden_pure.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('golden_pure.json:', out.slug.length, 'slug,', out.adminUser.length, 'adminUser,', out.ctOut.length, 'ctOut,', out.todayVN.length, 'todayVN,', out.hetHan.length, 'hetHan');
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
    await pool.query("delete from audit_logs where username like 'zz_companies%'");
    await pool.query("delete from notifications where company_id in (select id from companies where code like 'zz-companies%')");
    await pool.query("delete from users where username like 'zz_companies%'");
    await pool.query("delete from companies where code like 'zz-companies%'");
  };
  await sweep();

  const NS = { noScope: true };
  const admin = (await supa.select('users', { filter: supa.eq('username', 'admin'), limit: 1, noScope: true }))[0];
  const dezon = (await supa.select('cong_ty', { filter: supa.eq('ma', 'dezon'), limit: 1, noScope: true }))[0];
  const ctx = { uid: admin.id, role: 'super', congTyId: dezon.id, viewAs: null };
  const SA = { uid: admin.id, u: 'zz_companies_u', r: 'super', ct: dezon.id };
  const AD = function (ct) { return { uid: admin.id, u: 'zz_companies_u', r: 'admin', ct: ct }; };
  const ST = { uid: admin.id, u: 'zz_companies_u', r: 'staff', ct: dezon.id };
  const ZERO = '00000000-0000-0000-0000-000000000000';

  const labels = [];   // [id, nhãn]
  const label = function (id, name) { labels.push([String(id), name]); };
  const norm = function (v) {
    let s = JSON.stringify(v === undefined ? null : v);
    labels.forEach(function (p) { s = s.split(p[0]).join(p[1]); });
    return JSON.parse(s.replace(/"\d{4}-\d\d-\d\dT[\d:.]+\+00:00"/g, '"<ts>"').replace(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d+)?\+00/g, '<ts>'));
  };
  const steps = {};
  const step = async function (name, fn) {
    let r;
    try { r = { ok: await tenant.run(ctx, fn) }; } catch (e) { r = { err: String(e && e.message) }; }
    steps[name] = norm(r);
    return r.ok;
  };
  const BASE = ['dezon', 'b-123', 'decox-basic'];

  try {
    await step('s01_list_admin', function () { return auth.listCongTy(AD(dezon.id)); });
    await step('s02_list_super', async function () {
      return (await auth.listCongTy(SA)).filter(function (c) { return BASE.indexOf(c.ma) >= 0; })
        .map(function (c) { return Object.assign({}, c, { soUser: typeof c.soUser }); });
    });
    await step('s03a_create_null', function () { return auth.createCongTy(SA, null); });
    await step('s03b_create_blank', function () { return auth.createCongTy(SA, { ten: '   ' }); });
    await step('s03c_create_admin', function () { return auth.createCongTy(AD(dezon.id), { ten: 'ZZ_companies X' }); });
    await step('s03d_create_string', function () { return auth.createCongTy(SA, 'abc'); });

    const ct1 = await step('s04_create_full', async function () {
      const c = await auth.createCongTy(SA, { ten: '  ZZ_companies Công Ty Đỗ Ánh #1 ', email: 'a@zz.vn', sdt: '0909', logoUrl: 'http://x/l.png',
        tinhNang: ['boc', null, ' duan '], gioiHanUser: '7', active: false, hanDung: '2030-01-02', ghiChu: 'ghi chú', dungSpDezon: true, mauChinh: '#fff' });
      label(c.id, '<CT1>'); return c;
    });
    await step('s05_create_dup', function () { return auth.createCongTy(SA, { ten: 'zz companies cong ty do anh 1' }); });
    const ct2 = await step('s06_create_ma', async function () {
      const c = await auth.createCongTy(SA, { ten: 'ZZ_companies Hai', ma: 'ZZ_companies_Mã 2', tinhNang: 'x, y', gioiHanUser: 0, hanDung: '', active: null,
        email: 5, logoUrl: 0, dungSpDezon: 'true' });
      label(c.id, '<CT2>'); return c;
    });
    await step('s07_create_dup_user', function () { return auth.createCongTy(SA, { ten: 'ZZ_companies Ba', adminUser: ' Admin ', adminPass: 'secret1' }); });
    await step('s07b_orphan_check', async function () { return (await supa.select('cong_ty', { filter: supa.eq('ma', 'zz-companies-ba'), noScope: true })).length; });
    const ct3 = await step('s08_create_with_owner', async function () {
      const c = await auth.createCongTy(SA, { ten: 'ZZ_companies Bốn', adminUser: ' ZZ_Companies_Adm ', adminPass: 'secret1', adminHoTen: '', email: 'e@zz.vn' });
      label(c.id, '<CT3>'); return c;
    });
    await step('s08b_owner_no_pass', async function () {
      const c = await auth.createCongTy(SA, { ten: 'ZZ_companies Năm', adminUser: 'zz_companies_nopass', adminPass: '', gioiHanUser: 'abc', hanDung: 0 });
      label(c.id, '<CT5>'); return c;
    });
    const usersOf = function (rows) {
      return rows.map(function (u) { return { username: u.username, hoTen: u.hoTen, role: u.role, perms: u.perms, active: u.active, congTyId: u.congTyId, email: u.email, phongBan: u.phongBan }; });
    };
    await step('s09_users_ct3', async function () { return usersOf(await auth.listCongTyUsers(SA, ct3.id)); });
    await step('s09b_users_ct1', function () { return auth.listCongTyUsers(SA, ct1.id); });
    await step('s09c_users_admin', function () { return auth.listCongTyUsers(AD(ct3.id), ct3.id); });
    await step('s09d_users_undefined', function () { return auth.listCongTyUsers(SA, undefined); });
    await step('s09e_users_bad_id', function () { return auth.listCongTyUsers(SA, 'not-a-uuid'); });

    await step('s10a_get', function () { return auth.getCongTy(ct1.id); });
    await step('s10b_get_null', function () { return auth.getCongTy(null); });
    await step('s10c_get_missing', function () { return auth.getCongTy(ZERO); });
    await step('s10d_get_zero', function () { return auth.getCongTy(0); });

    await step('s11a_upd_staff', function () { return auth.updateCongTy(ST, ct1.id, { ten: 'ZZ_companies x' }); });
    await step('s11b_upd_other', function () { return auth.updateCongTy(AD(ct2.id), ct1.id, { ten: 'ZZ_companies x' }); });
    await step('s11b2_upd_admin_noct', function () { return auth.updateCongTy(AD(null), ct1.id, { ten: 'ZZ_companies x' }); });
    await step('s11c_upd_owner', function () {
      return auth.updateCongTy(AD(ct1.id), ct1.id, { ten: 'ZZ_companies Một đổi', logoUrl: '', mauChinh: '#123', email: null, sdt: 123,
        gioiHanUser: 99, active: true, ghiChu: 'bị bỏ qua', tinhNang: 'bo', hanDung: '2040-01-01', dungSpDezon: false });
    });
    await step('s11d_upd_super', function () {
      return auth.updateCongTy(SA, ct1.id, { tinhNang: ['a', 'b', null, 3], gioiHanUser: 'abc', active: 0, dungSpDezon: false, hanDung: '', ghiChu: 5 });
    });
    await step('s11e_upd_super2', function () {
      return auth.updateCongTy(SA, ct1.id, { tinhNang: 'k1,k2', gioiHanUser: '12', active: 'yes', dungSpDezon: 1, hanDung: '2031-12-31', email: 'm@zz.vn' });
    });
    await step('s11f_upd_empty', function () { return auth.updateCongTy(SA, ct1.id, {}); });
    await step('s11g_upd_null', function () { return auth.updateCongTy(SA, ct1.id, null); });
    await step('s11h_upd_missing', function () { return auth.updateCongTy(SA, ZERO, { ten: 'ZZ_companies y' }); });
    await step('s11i_upd_owner_empty', function () { return auth.updateCongTy(AD(ct1.id), ct1.id, { gioiHanUser: 5 }); });
    await step('s11j_upd_bad_id', function () { return auth.updateCongTy(SA, 'not-a-uuid', { ten: 'ZZ_companies z' }); });
    await step('s11k_upd_bad_date', function () { return auth.updateCongTy(SA, ct1.id, { hanDung: 'không phải ngày' }); });
    await step('s11l_upd_neg_limit', function () { return auth.updateCongTy(SA, ct1.id, { gioiHanUser: -3 }); });
    await step('s11m_upd_undefined_id', function () { return auth.updateCongTy(SA, undefined, { ten: 'ZZ_companies u' }); });
    await step('s11z_final', function () { return auth.getCongTy(ct1.id); });

    await step('s12a_del_admin', function () { return auth.deleteCongTy(AD(ct3.id), ct3.id); });
    await step('s12b_del_missing', function () { return auth.deleteCongTy(SA, ZERO); });
    await step('s12c_del_undefined', function () { return auth.deleteCongTy(SA, undefined); });
    await step('s12d_del_bad_id', function () { return auth.deleteCongTy(SA, 'not-a-uuid'); });
    const count = async function (id) {
      const o = {};
      for (const t of ['users', 'notifications', 'audit_log']) o[t] = (await supa.select(t, { filter: supa.eq('cong_ty_id', id), noScope: true })).length;
      o.cong_ty = (await supa.select('cong_ty', { filter: supa.eq('id', id), noScope: true })).length;
      return o;
    };
    await step('s12e_children', async function () {
      const u = (await supa.select('users', { filter: supa.eq('cong_ty_id', ct3.id), limit: 1, noScope: true }))[0];
      await supa.insert('notifications', { user_id: u.id, kind: 'zz', title: 'ZZ_companies', body: '', ref_id: null, is_read: false, cong_ty_id: ct3.id }, NS);
      await supa.insert('audit_log', { user_id: null, username: 'zz_companies_child', action: 'zz', detail: '', cong_ty_id: ct3.id }, NS);
      return count(ct3.id);
    });
    await step('s12f_del_ct3', function () { return auth.deleteCongTy(SA, ct3.id); });
    await step('s12g_after', function () { return count(ct3.id); });
    await step('s12h_del_ct2', function () { return auth.deleteCongTy(SA, ct2.id); });
    await step('s12i_del_ct1', function () { return auth.deleteCongTy(SA, ct1.id); });
    await step('s12j_del_again', function () { return auth.deleteCongTy(SA, ct1.id); });

    // nhật ký do các bước trên ghi (bỏ create_user: bản Go dùng UserCreator giả, không ghi dòng đó)
    const au = await pool.query("select action, detail, user_id from audit_logs where username = 'zz_companies_u' and action <> 'create_user' order by id");
    steps.audit = norm(au.rows.map(function (r) { return { action: r.action, detail: r.detail, uid: r.user_id === admin.id ? '<admin>' : r.user_id }; }));
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
