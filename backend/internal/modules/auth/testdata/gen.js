'use strict';
/* Sinh giá trị mong đợi của các hàm THUẦN từ mã Node thật (server/auth.js + bcryptjs):
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen.js > pure.json
 * Không truy vấn database: supa.insert bị thay bằng hàm bắt dòng ghi (để lấy chuỗi detail của logClientError). */
const fs = require('fs');
const path = require('path');
const Module = require('module');
if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
  console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
  process.exit(2);
}
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const file = path.join(root, 'server', 'auth.js');
const supa = require(path.join(root, 'server', 'supa.js'));
const bcrypt = require(require.resolve('bcryptjs', { paths: [root] }));
function load(secret) {
  process.env.AUTH_SECRET = secret;   // '' -> khoá mặc định của auth.js
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(fs.readFileSync(file, 'utf8') + '\nmodule.exports.__t = { b64url, sign_, makeToken, prefsOf_, pwOk_ };', file);
  return m.exports;
}
const NOW = 1790000000000;
const realNow = Date.now;
function at(ms, fn) { Date.now = function () { return ms; }; try { return fn(); } finally { Date.now = realNow; } }

const out = {};
(async function () {
  // ---- token: makeToken với đồng hồ cố định, hai khoá ký ----
  const users = [
    { id: '68cb6934-c871-4681-8cfe-def02ba28b0c', username: 'admin', role: 'super', cong_ty_id: '90c41ced-2477-4342-97da-e226344354f1' },
    { id: 5, username: 'ü名 "x"', role: 'staff', cong_ty_id: null },
    { id: 'x', username: 'n', role: null },
    { id: 'k<>&/', username: ' é\\', role: 'admin', cong_ty_id: 0 },
    { id: 1.5, username: '', role: 'staff', cong_ty_id: '' }
  ];
  out.now = NOW;
  out.makeToken = [];
  for (const secret of ['', 'zz-authusers-test-secret']) {
    const a = load(secret);
    users.forEach(function (u) { out.makeToken.push([secret, u, at(NOW, function () { return a.__t.makeToken(u); })]); });
  }
  // ---- verifyToken ----
  const a = load('zz-authusers-test-secret');
  const t = a.__t;
  function tok(payloadText) { const body = t.b64url(payloadText); return body + '.' + t.sign_(body); }
  const good = at(NOW, function () { return t.makeToken(users[0]); });
  const std = Buffer.from('{"uid":"ü?>","u":"ÿÿÿ","exp":' + (NOW + 5) + '}').toString('base64');   // có + / =
  const cands = [
    good, good + '.thua.nua', good.replace(/.$/, 'A'), good.split('.')[0], good.split('.')[0] + '.', '.' + good.split('.')[1], '.', '', 'abc',
    tok('5'), tok('null'), tok('[1]'), tok('"s"'), tok('true'), tok('{bad'), tok(''),
    tok('{"uid":1}'), tok('{"uid":1,"exp":0}'), tok('{"uid":1,"exp":null}'), tok('{"uid":1,"exp":' + (NOW - 1) + '}'), tok('{"uid":1,"exp":' + NOW + '}'),
    tok('{"uid":1,"exp":"' + (NOW + 1) + '"}'), tok('{"uid":1,"exp":"abc"}'), tok('{"uid":1,"exp":true}'), tok('{"uid":1,"exp":[]}'),
    tok('{"uid":1,"exp":[' + (NOW + 9) + ']}'), tok('{"uid":1,"exp":{}}'), tok('{"exp":' + (NOW + 1) + ',"uid":7,"x":{"y":[1,2]},"u":"k"}'),
    tok('{"uid":1,"exp":1e99}'), tok(' {"uid":2,"exp":' + (NOW + 1) + '} '),
    std + '.' + t.sign_(std)
  ];
  out.verifyToken = cands.map(function (c) { const r = at(NOW, function () { return a.verifyToken(c); }); return [c, r === undefined ? null : r]; });
  out.verifyExpired = [good, at(NOW + 7 * 24 * 3600 * 1000 + 1, function () { return a.verifyToken(good); }), at(NOW + 7 * 24 * 3600 * 1000, function () { return !!a.verifyToken(good); })];

  // ---- bcryptjs compareSync: đúng / sai / cắt 72 byte / hash hỏng (ném lỗi) ----
  const long = 'ậ' + 'x'.repeat(68) + 'ẩ' + 'tail';
  const hLong = '$2a$04$ySekLni1wm.h0zuk5avJyOG4g6f16XJOb6f9gC9r/rdASpz/ygQOi';
  const hAdmin = '$2a$04$nPfh0KpvYngT0wJESEIj1u41665aoi.9vVTNavCfkoiaFCJMi4BTO';   // adminpw1
  const h2b = '$2b$04$JaNwsnQmQXzbLRkogYsaa.M9tG5D0/DgP7qcT16HNoUMqNEkqZJXK';      // twob-pw-1
  const hEmpty = bcrypt.hashSync('', 4), hNul = bcrypt.hashSync('a\u0000b', 4), h71 = bcrypt.hashSync('y'.repeat(71), 4), h72 = bcrypt.hashSync('y'.repeat(72), 4);
  function setc(s, i, c) { return s.slice(0, i) + c + s.slice(i + 1); }
  const pairs = [
    ['adminpw1', hAdmin], ['adminpw2', hAdmin], ['', hAdmin], ['adminpw1\u0000', hAdmin], ['ADMINPW1', hAdmin],
    [long, hLong], ['ậ' + 'x'.repeat(68) + 'ẩ', hLong], ['ậ' + 'x'.repeat(68) + 'ắ khác hẳn', hLong], ['ậ' + 'x'.repeat(68) + 'é', hLong], ['ậ' + 'x'.repeat(68), hLong],
    ['twob-pw-1', h2b], ['twob-pw-1', h2b.replace('$2b$', '$2y$')], ['twob-pw-1', h2b.replace('$2b$', '$2a$')], ['twob-pw-1', h2b.replace('$2b$', '$2x$')],
    ['', hEmpty], ['x', hEmpty], ['a\u0000b', hNul], ['a', hNul], ['a\u0000c', hNul],
    ['y'.repeat(71), h71], ['y'.repeat(72), h71], ['y'.repeat(70), h71], ['y'.repeat(72), h72], ['y'.repeat(73), h72], ['y'.repeat(71), h72],
    ['adminpw1', hAdmin.slice(0, 59)], ['adminpw1', hAdmin + 'x'], ['adminpw1', ''], ['adminpw1', 'plainpw'],
    ['adminpw1', 'x'.repeat(60)], ['adminpw1', '$3a$04$' + hAdmin.slice(7)], ['adminpw1', '$2$04$n' + hAdmin.slice(7)], ['adminpw1', '$2aa04$' + hAdmin.slice(7)],
    ['adminpw1', '$2a$03$' + hAdmin.slice(7)], ['adminpw1', '$2a$32$' + hAdmin.slice(7)], ['adminpw1', '$2a$99$' + hAdmin.slice(7)], ['adminpw1', '$2a$4x$' + hAdmin.slice(7)],
    ['adminpw1', '$2a$x4$' + hAdmin.slice(7)], ['adminpw1', '$2a$ 4$' + hAdmin.slice(7)], ['adminpw1', '$2a$04#' + hAdmin.slice(7)], ['adminpw1', '$2a$04%' + hAdmin.slice(7)],
    ['adminpw1', '$2a$0404' + hAdmin.slice(8)], ['adminpw1', '$2a$04é' + hAdmin.slice(7)],
    ['adminpw1', setc(hAdmin, 7, '!')], ['adminpw1', setc(hAdmin, 9, '!')], ['adminpw1', setc(hAdmin, 10, '!')], ['adminpw1', setc(hAdmin, 12, '=')],
    ['adminpw1', setc(hAdmin, 27, '!')], ['adminpw1', setc(hAdmin, 28, '!')], ['adminpw1', setc(hAdmin, 28, 'v')], ['adminpw1', setc(hAdmin, 28, 'é')],
    ['adminpw1', setc(hAdmin, 20, 'é')], ['adminpw1', setc(hAdmin, 40, 'é')], ['adminpw1', setc(hAdmin, 59, 'P')], ['adminpw1', setc(hAdmin, 59, '!')],
    ['adminpw1', setc(hAdmin, 29, '!')], ['adminpw1', hAdmin.slice(0, 58) + '😀'], ['adminpw1', '😀' + hAdmin.slice(2)]
  ];
  out.compareSync = pairs.map(function (p) {
    try { return [p[0], p[1], bcrypt.compareSync(p[0], p[1])]; } catch (e) { return [p[0], p[1], { err: e.message }]; }
  });
  // ---- pwOk_ ----
  const rowsPw = [
    [{ password_hash: hAdmin }, 'adminpw1'], [{ password_hash: hAdmin }, 'sai'], [{ password_hash: 'plainpw' }, 'plainpw'], [{ password_hash: 'plainpw' }, 'Plainpw'],
    [{ password_hash: '' }, ''], [{ password_hash: null }, ''], [{}, 'x'], [null, ''], [{ password_hash: '$2a$' }, '$2a$'], [{ password_hash: '$2x$abc' }, '$2x$abc'],
    [{ password_hash: ' $2a$04$' }, ' $2a$04$'], [{ password_hash: '$2a$03$' + hAdmin.slice(7) }, 'adminpw1']
  ];
  out.pwOk = rowsPw.map(function (p) { try { return [p[0], p[1], t.pwOk_(p[0], p[1])]; } catch (e) { return [p[0], p[1], { err: e.message }]; } });

  // ---- sắp ứng viên đăng nhập: cùng phép so của login (A:228-232; hàm so nằm trong login nên chép nguyên văn) ----
  const lists = [
    [{ id: 1, active: true, cong_ty_id: null }, { id: 2, active: true, cong_ty_id: 'c' }, { id: 3, active: false, cong_ty_id: 'c' }, { id: 4, active: false, cong_ty_id: null }, { id: 5, active: null, cong_ty_id: 'c' }, { id: 6, cong_ty_id: '' }, { id: 7, active: true, cong_ty_id: 'd' }],
    [{ id: 1, active: false }, { id: 2, active: false, cong_ty_id: 0 }, { id: 3, active: 0, cong_ty_id: 1 }, { id: 4 }],
    []
  ];
  out.sort = lists.map(function (rows) {
    const copy = rows.slice();
    copy.sort(function (a, b) {
      const sa = (a.active === false ? 0 : 2) + (a.cong_ty_id ? 1 : 0);
      const sb = (b.active === false ? 0 : 2) + (b.cong_ty_id ? 1 : 0);
      return sb - sa;
    });
    return [rows, copy.map(function (r) { return r.id; })];
  });
  // ---- prefsOf_ ----
  out.prefsOf = [{ ui_prefs: { b: 1, a: [2] } }, { ui_prefs: [1] }, { ui_prefs: null }, { ui_prefs: 'x' }, { ui_prefs: 5 }, {}, { ui_prefs: {} }]
    .map(function (u) { return [u, t.prefsOf_(u)]; });

  // ---- logClientError: chuỗi detail ghi vào audit_log ----
  let last = null;
  supa.insert = async function (table, row) { last = { table: table, row: row }; return [row]; };
  const infos = [
    null, {}, 'chuoi', 5, [1],
    { tab: 'boc', msg: 'x is not defined', src: 'https://app.example.com/boc.js?v=1' },
    { tab: 'mộtcáitabrấtdàivượtquá20kýtự', msg: 'm'.repeat(305), src: 'http://localhost:3000/' + 's'.repeat(130) },
    { tab: null, msg: null, src: null }, { tab: 0, msg: 0, src: 0 }, { tab: 7, msg: true, src: 12 },
    { msg: 'chỉ msg' }, { src: '/tuong-doi.js' }, { src: 'ftp://x/y.js' }, { src: 'HTTPS://X/y.js' }, { src: 'https://x' }, { src: 'https:///y.js' },
    { src: 'x https://a/b.js' }, { tab: ['a', 'b'], msg: { a: 1 }, src: ['https://h/p.js'] }, { tab: '😀'.repeat(11), msg: 'é😀'.repeat(160), src: 'https://h/' + '😀'.repeat(61) },
    { src: 'https://h\n/p/q.js' }
  ];
  out.logClientError = [];
  const origWarn = console.warn; console.warn = function () {};
  for (const info of infos) {
    last = null;
    const r = await a.logClientError({ uid: 'u1', u: 'ten' }, info);
    out.logClientError.push([info, last.row, r]);
  }
  console.warn = origWarn;
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
