'use strict';
/* Đối chiếu module auth / users: chạy các ca của 1 file diff-cases.json qua server/auth.js (bản Node - chuẩn gốc)
 * và ghi mỗi ca 1 dòng "tên<TAB>json" (đã chuẩn hoá id / thời điểm sinh tự động). Bản Go chạy cùng các ca rồi so từng dòng.
 *
 * CHỈ chạy trên database thử qspro_nodetest:
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x \
 *   node diff-node.js <P> <H> <diff-cases.json> <diff-golden.txt>
 * P = chữ phân biệt bộ thử (u = users, a = auth), H = 1 chữ số hex dùng trong id cố định.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
  process.exit(2);
}
const [P, H, casesFile, outFile] = process.argv.slice(2);
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const supa = require(path.join(root, 'server', 'supa.js'));
const tenant = require(path.join(root, 'server', 'tenant.js'));
const { Pool } = require(require.resolve('pg', { paths: [root] }));

// Nạp server/auth.js kèm các hàm nội bộ (không sửa file gốc): biên dịch nguyên văn + 1 dòng xuất thêm.
function loadAuth() {
  const file = path.join(root, 'server', 'auth.js');
  const src = fs.readFileSync(file, 'utf8') +
    '\nmodule.exports.__t = { getUserById, userOut, permsArr_, makeToken, forgetSession_, prefsOf_ };';
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(src, file);
  return m.exports;
}
const auth = loadAuth();
const ACTOR_FNS = new Set(['me', 'setMyPref', 'logClientError', 'logout', 'changePassword',
  'adminListUsers', 'adminCreateUser', 'adminUpdateUser', 'adminSetPassword', 'adminSetActive', 'adminDeleteUser']);

// {{U:0003}} = id cố định của user số 3, {{C:1}} = id công ty số 1 (xem sql/setup.sql)
function tpl(s) {
  return s.replace(/\{\{U:([0-9a-f]{4})\}\}/g, '00000000-0000-4000-8000-{{H}}0000000$1').replace(/\{\{C:([0-9a-f])\}\}/g, '00000000-0000-4000-8000-{{H}}0000000c00$1')
    .replace(/\{\{P\}\}/g, P).replace(/\{\{H\}\}/g, H);
}
function sql(name) { return tpl(fs.readFileSync(path.join(__dirname, 'sql', name), 'utf8')); }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TS_KEYS = new Set(['createdAt', 'lastLogin', 'at', 'created_at', 'last_login', 'exp']);
function b64(s) { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
// Chuẩn hoá: id sinh tự động, thời điểm, token, mật khẩu băm (muối ngẫu nhiên).
function norm(v, key) {
  if (v === null || v === undefined) return v;
  if (TS_KEYS.has(key)) return '<ts>';
  if (key === 'token' && typeof v === 'string') return { payload: norm(JSON.parse(b64(v.split('.')[0]))), parts: v.split('.').length };
  if (key === 'password_hash' && typeof v === 'string') return /^\$2[aby]\$/.test(v) ? v.slice(0, 7) + '<' + v.length + '>' : v;
  if (key === 'id' && typeof v === 'number') return '<n>';
  if (typeof v === 'string') return UUID.test(v) && v.indexOf('00000000-0000-4000-8000-') !== 0 ? '<uuid>' : v;
  if (Array.isArray(v)) return v.map(function (x) { return norm(x); });
  if (typeof v === 'object') { const o = {}; Object.keys(v).forEach(function (k) { o[k] = norm(v[k], k); }); return o; }
  return v;
}
// {{tên ca.khoá}} -> giá trị THÔ của kết quả ca trước
function fill(c, raw) {
  return JSON.parse(JSON.stringify(c).replace(/\{\{([^.}]+)(?:\.([^}]+))?\}\}/g, function (_, n, k) {
    let v = raw[n];
    (k ? k.split('.') : []).forEach(function (p) { v = v == null ? undefined : v[p]; });
    return v === undefined ? 'MISSING' : String(v);
  }));
}

(async function () {
  const spec = JSON.parse(tpl(fs.readFileSync(casesFile, 'utf8')));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await pool.query(sql('cleanup.sql'));
  await pool.query(sql('setup.sql'));
  const raw = {};
  const lines = [];
  let clockBack = false;
  async function runCase(c, who) {
    const a = who.actor || null;
    switch (c.fn) {
      case '$audit': return auth.audit.apply(null, c.args);
      case '$getUserById': return auth.__t.getUserById(c.args[0]);
      case '$sessionActor': return auth.sessionActor(c.args[0]);
      case '$verifyToken': return auth.verifyToken(c.args[0]);
      case '$forget': return auth.__t.forgetSession_(c.args[0]);
      case '$makeToken': return { token: auth.__t.makeToken(c.args[0]) };
      case '$sql': await pool.query(c.args[0]); return null;
      case '$snapshot': return JSON.parse((await pool.query(sql('snapshot.sql'))).rows[0].json_build_object);
    }
    return auth[c.fn].apply(null, ACTOR_FNS.has(c.fn) ? [a].concat(c.args || []) : (c.args || []));
  }
  try {
    for (const rawCase of spec.cases) {
      const c = fill(rawCase, raw);
      const who = spec.actors[c.as || 'none'];
      let out;
      try {
        let r = await tenant.run(who.ctx, function () { return runCase(c, who); });
        if (c.only) r = r.filter(function (x) { return String(x.username).indexOf('zz_authusers_' + P + '_') === 0; });
        raw[c.n] = r;
        out = { ok: r === undefined ? null : r };
      } catch (e) { out = { err: e.message }; }
      lines.push(c.n + '\t' + JSON.stringify(norm(out)));
    }
    // đồng hồ database bị chỉnh lùi giữa chừng -> thứ tự created_at.desc không đáng tin, không ghi file chuẩn
    clockBack = (await pool.query(sql('clock.sql'))).rows[0].back;
  } finally {
    await pool.query(sql('cleanup.sql'));
    await pool.end();
    await supa.close();
  }
  if (clockBack) { console.error('Đồng hồ database bị chỉnh lùi trong lúc chạy - hãy chạy lại'); process.exit(3); }
  fs.writeFileSync(outFile, lines.join('\n') + '\n');
  console.log('đã ghi ' + lines.length + ' ca -> ' + outFile);
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
