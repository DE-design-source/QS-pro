'use strict';
/* Dữ liệu dùng chung của vùng 2 (projects, takeoff, estimates, quotations). Dựng MỘT lần cho cả lần chạy, KHÔNG dựa vào
   tài khoản của vùng 1 (các kịch bản vùng 1 đổi mật khẩu / khoá / xoá tài khoản của nó). Chỉ super mồi chèn bằng SQL. */
const bcrypt = require('bcryptjs');
const PW = { root: 'Root@2345', admin: 'Admin@234', staff: 'Staff@234' };
const ROOT_ID = '00000000-0000-4000-8000-0000000000b1';

async function fx(h) {
  if (h.state.area2) return h.state.area2;
  const dezon = (await h.sql("select id::text id from companies where code = 'dezon'")).node[0].id;
  await h.sql("insert into users (id, username, full_name, password_hash, role, is_active, company_id, created_at) values ($1, 'dy_root', 'DY Root', $2, 'super', true, null, now())", [ROOT_ID, bcrypt.hashSync(PW.root, 10)]);
  const f = { PW, dezon, S: {} };
  const S = f.S;
  S.anon = h.anon;
  S.root = await h.login('super', 'dy_root', PW.root);
  let r = await h.rpc(S.root, 'createCongTy', [{ ten: 'DY Công ty A', ma: 'dy-a', gioiHanUser: 12, adminUser: 'dy_a_admin', adminPass: PW.admin, adminHoTen: 'Chủ A2' }]);
  f.ctA = r.val('result.id');
  r = await h.rpc(S.root, 'createCongTy', [{ ten: 'DY Công ty B', ma: 'dy-b', gioiHanUser: 5, adminUser: 'dy_b_admin', adminPass: PW.admin }]);
  f.ctB = r.val('result.id');
  const mk = async (u, hoTen, perms) => (await h.rpc(S.root, 'createCongTyUser', [f.ctA, Object.assign({ username: u, password: PW.staff, hoTen }, perms ? { perms } : {})])).val('result.id');
  await mk('dy_a_edit', 'NV sửa', ['boc', 'sanpham', 'sp_edit']);     // sửa được, KHÔNG duyệt được
  await mk('dy_a_duyet', 'NV duyệt', ['sp_duyet']);                    // sửa + duyệt
  await mk('dy_a_boc', 'NV bóc', ['boc', 'duan']);                     // không cấu hình sp_* -> sửa + duyệt (mặc định)
  await mk('dy_a_none', 'NV không quyền');                             // không perms nào -> sửa + duyệt (mặc định)
  S.adminA = await h.login('admin A', 'dy_a_admin', PW.admin);
  S.adminB = await h.login('admin B', 'dy_b_admin', PW.admin);
  S.edit = await h.login('staff A sp_edit', 'dy_a_edit', PW.staff);
  S.duyet = await h.login('staff A sp_duyet', 'dy_a_duyet', PW.staff);
  S.boc = await h.login('staff A boc', 'dy_a_boc', PW.staff);
  S.none = await h.login('staff A không perms', 'dy_a_none', PW.staff);
  S.viewA = h.with(S.root, { label: 'super xem công ty A', view: f.ctA });
  S.viewB = h.with(S.root, { label: 'super xem công ty B', view: f.ctB });
  S.viewDz = h.with(S.root, { label: 'super xem Dezon', view: dezon });
  S.adminView = h.with(S.adminA, { label: 'admin A gửi x-view-company B (bị bỏ qua)', view: f.ctB });
  // ma trận quyền: chưa đăng nhập, staff có / không quyền, admin, admin công ty khác, super không / có x-view-company
  f.all = [S.anon, S.none, S.edit, S.duyet, S.adminA, S.adminB, S.root, S.viewA];
  // gọi 1 hàm chỉ đọc với mọi cấp quyền (rpc + REST)
  f.matrix = async (fn, args, opts) => { for (const s of f.all) await h.both(s, fn, args, opts && opts.label ? Object.assign({}, opts, { label: opts.label + ' @' + s.label }) : opts); };
  // nhãn gọn cho giá trị tham số lạ
  f.show = (v) => (v === undefined ? '(thiếu)' : typeof v === 'number' ? String(v) : (JSON.stringify(v) || String(v)).slice(0, 70));
  f.badJson = require('../../lib/accept').badJson;   // ARCH 10.1: trang 400 của thân JSON hỏng (luật và lý do: lib/accept.js)
  /* [khoảng trống B.low: xác thực của route lẻ] actorOf_ (server/index.js 596-600) trên 1 route POST nhận JSON (/export/cong-tac, /export/bang):
     token hết hạn / sai khoá, header thắng thân, các dạng viết tiền tố, Content-Type không phải JSON (thân bị bỏ qua), thân quá 30 MB,
     tài khoản bị khoá / xoá, công ty bị khoá / hết hạn. body: thân hợp lệ của route (object); ten: hậu tố tên tài khoản tạm. */
  f.routeAuth = async (path, body, ten) => {
    const { errPage } = require('../../lib/accept');
    const A = S.adminA.token, json = { 'Content-Type': 'application/json' }, now = Date.now();
    const bearer = (t, pre) => h.pair((pre === undefined ? 'Bearer ' : pre) + t.node, (pre === undefined ? 'Bearer ' : pre) + t.go);
    const withTok = (t) => (t && t.node !== undefined ? h.pair(JSON.stringify(Object.assign({}, body, { token: t.node })), JSON.stringify(Object.assign({}, body, { token: t.go }))) : JSON.stringify(Object.assign({}, body, { token: t })));
    const send = (label, headers, b, opts) => h.raw('POST ' + path + ' ' + label, { method: 'POST', path, headers, body: b === undefined ? JSON.stringify(body) : b }, opts);
    const auth = (t, pre) => Object.assign({ Authorization: bearer(t, pre) }, json);
    const pA = { uid: S.adminA.uid, u: 'dy_a_admin', r: 'admin', ct: f.ctA };
    const het = h.makeToken(Object.assign({}, pA, { exp: now - 1000 }));
    await send('token tự ký hợp lệ', auth(h.makeToken(Object.assign({}, pA, { exp: now + 3600e3 }))));
    await send('token hết hạn', auth(het));
    await send('token không có exp', auth(h.makeToken(pA)));
    await send('token ký bằng khoá khác', auth(h.makeToken(Object.assign({}, pA, { exp: now + 3600e3 }), 'khoa-khac')));
    await send('token hết hạn trong thân', json, withTok(het));
    await send('header rác + token đúng trong thân (header khác rỗng thắng -> 401)', Object.assign({ Authorization: 'Bearer rac.rac' }, json), withTok(A));
    await send('header "Bearer " rỗng + token đúng trong thân', Object.assign({ Authorization: 'Bearer ' }, json), withTok(A));
    await send('header hết hạn + token đúng trong thân', auth(het), withTok(A));
    await send('"bearer" viết thường + nhiều dấu cách', auth(A, 'bearer    '));
    await send('không tiền tố Bearer', auth(A, ''));
    await send('tiền tố Basic', auth(A, 'Basic '));
    await send('Bearer dính liền token', auth(A, 'Bearer'));
    for (const t of [12345, { a: 1 }, true, null, '', ['x']]) await send('body.token là ' + JSON.stringify(t), json, withTok(t));
    // Content-Type không phải JSON: express.json bỏ qua thân -> không có dữ liệu (400) hoặc không có token (401)
    for (const ct of ['text/plain', 'application/x-www-form-urlencoded', 'application/octet-stream', 'application/json; charset=utf-8', 'APPLICATION/JSON']) {
      await send('Content-Type ' + ct + ', token ở header', { Authorization: bearer(A), 'Content-Type': ct });
      await send('Content-Type ' + ct + ', token chỉ ở thân', { 'Content-Type': ct }, withTok(A));
    }
    await send('thân 31 MB (quá giới hạn 30mb)', auth(A), '{"x":"' + 'a'.repeat(31 * 1024 * 1024) + '"}', { accept: errPage });
    await send('thân 31 MB chưa đăng nhập', json, '{"x":"' + 'a'.repeat(31 * 1024 * 1024) + '"}', { accept: errPage });
    // tài khoản bị khoá rồi bị xoá: phiên mất hiệu lực ngay
    const r = await h.rpc(S.adminA, 'adminCreateUser', [{ username: 'dy_tam_' + ten, password: PW.staff, hoTen: 'Tạm ' + ten }]);
    const tmpId = r.val('result.id'), tmp = await h.login('tài khoản tạm ' + ten, 'dy_tam_' + ten, PW.staff);
    await send('@tài khoản tạm đang mở', auth(tmp.token));
    await h.rpc(S.adminA, 'adminSetActive', [tmpId, false]);
    await send('@tài khoản vừa bị khoá', auth(tmp.token));
    await send('@tài khoản bị khoá, token trong thân', json, withTok(tmp.token));
    await h.rpc(S.adminA, 'adminSetActive', [tmpId, true]);
    await send('@tài khoản được mở lại', auth(tmp.token));
    await h.rpc(S.adminA, 'adminDeleteUser', [tmpId]);
    await send('@tài khoản đã xoá', auth(tmp.token));
    // công ty bị khoá / hết hạn (phiên được nhớ 30 giây -> "quên phiên" bằng 1 lần sửa tài khoản)
    const quenB = () => h.rpc(S.root, 'adminUpdateUser', [S.adminB.uid, { hoTen: 'Chủ B2' }], { label: 'quên phiên admin B (sửa họ tên)' });
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { active: false }]); await quenB();
    await send('@admin B, công ty bị khoá', auth(S.adminB.token));
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { active: true, hanDung: '2020-01-31' }]); await quenB();
    await send('@admin B, công ty hết hạn', auth(S.adminB.token));
    await send('@super xem công ty B đang hết hạn (super được miễn)', Object.assign(auth(S.root.token), { 'x-view-company': f.ctB }));
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { hanDung: '' }]); await quenB();
    await send('@admin B, công ty mở lại', auth(S.adminB.token));
  };
  h.state.area2 = f;
  return f;
}
module.exports = { fx, PW };
