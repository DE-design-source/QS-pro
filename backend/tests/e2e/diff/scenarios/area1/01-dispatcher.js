'use strict';
/* Cổng /api/:fn (server/index.js 596-632): hàm lạ, thân hỏng, nguồn token, token hết hạn / sai, tài khoản bị khoá,
   công ty bị khoá / hết hạn, x-view-company, 3 tầng quyền. */
const { fx, PW, ID } = require('./_fx');

module.exports = {
  name: 'area1/01 cổng /api/:fn',
  async run(h) {
    const f = await fx(h), S = f.S;
    const json = { 'Content-Type': 'application/json' };
    const post = (label, path, body, headers, opts) => h.raw(label, { method: 'POST', path, headers: headers || json, body }, opts);
    // Khác biệt có chủ ý (ARCHITECTURE mục 10.1 / 10.2): luật, điều kiện ở cả 2 phía và lý do nằm trong lib/accept.js
    const { badJson, errPage, registryLeak: protoLeak } = require('../../lib/accept');

    // --- hàm lạ: 404 TRƯỚC khi xác thực ---
    for (const s of [S.anon, S.staff, S.root]) {
      await h.rpc(s, 'khongCoHamNay', []);
      await h.rpc(s, 'Login', ['dx_root', PW.root]);                // tên hàm phân biệt hoa thường
    }
    await h.rpc(S.anon, 'getProducts ', []);
    await h.rpc(S.anon, 'a/b', []);                                 // /api/a%2Fb -> tên đã giải mã
    await h.rpc(S.anon, 'hàm tiếng Việt', []);
    await h.rpc(S.anon, '__proto__', []);
    for (const fn of ['toString', 'constructor', 'hasOwnProperty', 'valueOf']) { await h.rpc(S.anon, fn, [], { accept: protoLeak }); await h.rpc(S.root, fn, [], { accept: protoLeak }); }
    // Cùng cơ chế với mục "thân JSON hỏng": Go luôn trả trang lỗi Express dạng production (<pre>tên mã HTTP</pre>), Node dev kèm stack
    await post('POST /api/%ff (tham số không giải mã được)', '/api/%ff', '{"args":[]}', json, { accept: errPage });
    await post('POST /API/me/ (hoa thường + dấu / cuối)', '/API/me/', '{"args":[]}');
    await post('POST /api/ (thiếu tên hàm)', '/api/', '{"args":[]}');
    await post('POST /api/me/extra', '/api/me/extra', '{"args":[]}');
    await post('POST /api/login?x=1 (có query)', '/api/login?x=1', JSON.stringify({ args: ['dx_root', 'sai'] }));
    for (const m of ['GET', 'PUT', 'DELETE', 'PATCH']) await h.raw(m + ' /api/me', { method: m, path: '/api/me' });
    await h.raw('HEAD /api/me', { method: 'HEAD', path: '/api/me' });
    await h.raw('GET /healthz', { method: 'GET', path: '/healthz' });

    // --- thân request ---
    for (const [label, body] of [['thân JSON cụt', '{"args":['], ['thân không phải JSON', 'xin chào'], ['thân JSON có dấu phẩy thừa', '{"args":[1,],}'], ['thân là chuỗi JSON', '"abc"'], ['thân là số', '123'], ['thân là null', 'null'], ['thân là true', 'true']])
      await post('login, ' + label, '/api/login', body, json, { accept: badJson });
    await post('hàm lạ + thân hỏng', '/api/khongCo', '{"a":', json, { accept: badJson });
    await post('login, thân rỗng', '/api/login', '');
    await post('login, thân toàn khoảng trắng', '/api/login', '  \n ', json, { accept: badJson });
    await post('login, không có thân', '/api/login', undefined, {});
    await post('login, thân là mảng', '/api/login', '["dx_root","x"]');
    await post('login, thân là object rỗng', '/api/login', '{}');
    await post('login, thân có BOM', '/api/login', '﻿' + JSON.stringify({ args: ['dx_root', 'sai'] }));
    await post('login, khoá trùng trong thân (lấy cái sau)', '/api/login', '{"args":["a","b"],"args":["dx_root","sai"]}');
    await post('login, không Content-Type (thân bị bỏ qua)', '/api/login', JSON.stringify({ args: ['dx_root', PW.root] }), {});
    await post('login, Content-Type text/plain (thân bị bỏ qua)', '/api/login', JSON.stringify({ args: ['dx_root', PW.root] }), { 'Content-Type': 'text/plain' });
    await post('login, Content-Type application/json; charset=utf-8', '/api/login', JSON.stringify({ args: ['dx_root', 'sai'] }), { 'Content-Type': 'application/json; charset=utf-8' });
    await post('login, Content-Type APPLICATION/JSON', '/api/login', JSON.stringify({ args: ['dx_root', 'sai'] }), { 'Content-Type': 'APPLICATION/JSON' });
    await post('login, Content-Type application/x-www-form-urlencoded', '/api/login', 'args=a&args=b', { 'Content-Type': 'application/x-www-form-urlencoded' });
    await post('login, charset lạ', '/api/login', JSON.stringify({ args: ['dx_root', 'sai'] }), { 'Content-Type': 'application/json; charset=latin1' }, { accept: errPage });
    const zlib = require('zlib');
    const okBody = Buffer.from(JSON.stringify({ args: ['dx_root', 'sai'] }));
    await post('login, thân nén gzip', '/api/login', zlib.gzipSync(okBody), { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
    await post('login, thân nén deflate', '/api/login', zlib.deflateSync(okBody), { 'Content-Type': 'application/json', 'Content-Encoding': 'deflate' });
    await post('login, Content-Encoding gzip nhưng thân không nén', '/api/login', okBody, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, { accept: errPage });
    await post('login, Content-Encoding lạ', '/api/login', okBody, { 'Content-Type': 'application/json', 'Content-Encoding': 'br' }, { accept: errPage });
    await post('login, thân 31 MB (quá giới hạn 30mb)', '/api/login', '{"args":["' + 'a'.repeat(31 * 1024 * 1024) + '"]}', json, { accept: errPage });
    await post('login, thân 2 MB hợp lệ (mật khẩu dài)', '/api/login', '{"args":["dx_root","' + 'a'.repeat(2 * 1024 * 1024) + '"]}');
    // args không phải mảng -> []
    for (const a of ['"dx_root"', '{"0":"dx_root","1":"x"}', 'null', '123', 'true']) await post('login, args = ' + a, '/api/login', '{"args":' + a + '}');
    await h.rpc(S.anon, 'login', undefined, { label: 'login, thân {} (không có args)' });
    await h.rpc(S.adminA, 'me', undefined, { label: 'me, thân không có args @admin A' });
    await h.rpc(S.adminA, 'me', [1, 2, 3, { a: 1 }], { label: 'me, thừa tham số @admin A' });
    await h.rpc(S.adminA, 'me', [], { body: { args: [], extra: { x: 1 }, fn: 'logout' }, label: 'me, thân có khoá thừa @admin A' });

    // --- nguồn token ---
    const tokA = S.adminA.token;
    await h.rpc(h.with(S.adminA, { via: 'body', label: 'admin A' }), 'me', []);
    await h.rpc(h.with(S.adminA, { via: 'both', label: 'admin A' }), 'me', []);
    await h.rpc(h.with(S.adminA, { via: 'both', bodyToken: S.staff.token, label: 'header admin A, body staff' }), 'me', []);
    await h.rpc(h.session('header rác + body đúng', 'rac.rac', { via: 'both', bodyToken: tokA }), 'me', []);   // header khác rỗng thắng -> 401
    await h.rpc(h.with(S.adminA, { scheme: 'bearer ', label: 'admin A, "bearer" thường' }), 'me', []);
    await h.rpc(h.with(S.adminA, { scheme: 'BEARER    ', label: 'admin A, BEARER + nhiều dấu cách' }), 'me', []);
    await h.rpc(h.with(S.adminA, { scheme: '', label: 'admin A, không tiền tố Bearer' }), 'me', []);
    await h.rpc(h.with(S.adminA, { scheme: 'Basic ', label: 'admin A, tiền tố Basic' }), 'me', []);
    await h.rpc(h.with(S.adminA, { scheme: 'Bearer', label: 'admin A, Bearer dính liền token' }), 'me', []);
    await h.rpc(S.anon, 'me', [], { headers: { Authorization: 'Bearer ' }, label: 'me, header "Bearer " rỗng' });
    await h.rpc(S.anon, 'me', [], { headers: { Authorization: 'Bearer ' }, body: { args: [], token: tokA }, label: 'me, header "Bearer " rỗng + body token đúng' });
    for (const [label, t] of [['số', 12345], ['object', { a: 1 }], ['mảng chứa token', [tokA]], ['true', true], ['null', null], ['chuỗi rỗng', '']])
      await h.rpc(S.anon, 'me', [], { body: { args: [], token: t }, label: 'me, body.token là ' + label });
    await h.rpc(S.anon, 'me', [], { rawBody: h.pair('["x"]', '["x"]'), label: 'me, thân là mảng (không có token)' });

    // --- token hỏng / hết hạn / giả ---
    const now = Date.now();
    const mk = (label, token, extra) => h.session(label, token, extra);
    const pA = { uid: f.adminAId, u: 'dx_a_admin', r: 'admin', ct: f.ctA };
    const good = h.makeToken(Object.assign({}, pA, { exp: now + 3600e3 }));
    const cut = (t, fnc) => h.pair(fnc(t.node), fnc(t.go));
    await h.rpc(mk('token tự ký hợp lệ', good), 'me', []);
    // token do server này cấp phải dùng được ở server kia (cùng AUTH_SECRET)
    await h.rpc(mk('token chéo: Go cấp -> Node, Node cấp -> Go', h.pair(tokA.go, tokA.node)), 'me', []);
    await h.rpc(mk('token chéo của super', h.pair(S.root.token.go, S.root.token.node)), 'listCongTy', []);
    await h.rpc(mk('token hết hạn', h.makeToken(Object.assign({}, pA, { exp: now - 1000 }))), 'me', []);
    await h.rpc(mk('token exp = 0', h.makeToken(Object.assign({}, pA, { exp: 0 }))), 'me', []);
    await h.rpc(mk('token không có exp', h.makeToken(pA)), 'me', []);
    await h.rpc(mk('token exp là chuỗi số', h.makeToken(Object.assign({}, pA, { exp: String(now + 3600e3) }))), 'me', []);
    await h.rpc(mk('token exp là chuỗi chữ', h.makeToken(Object.assign({}, pA, { exp: 'mai' }))), 'me', []);
    await h.rpc(mk('token exp số thực', h.makeToken(Object.assign({}, pA, { exp: now + 3600e3 + 0.5 }))), 'me', []);
    await h.rpc(mk('token ký bằng khoá khác', h.makeToken(Object.assign({}, pA, { exp: now + 3600e3 }), 'khoa-khac')), 'me', []);
    await h.rpc(mk('token sửa 1 ký tự chữ ký', cut(good, (t) => t.slice(0, -1) + (t.slice(-1) === 'A' ? 'B' : 'A'))), 'me', []);
    await h.rpc(mk('token sửa payload', cut(good, (t) => 'x' + t)), 'me', []);
    await h.rpc(mk('token không có dấu chấm', cut(good, (t) => t.replace('.', ''))), 'me', []);
    await h.rpc(mk('token 3 đoạn (đoạn thừa bị bỏ)', cut(good, (t) => t + '.thua')), 'me', []);
    await h.rpc(mk('token chỉ có payload + "."', cut(good, (t) => t.split('.')[0] + '.')), 'me', []);
    await h.rpc(mk('token "."', '.'), 'me', []);
    await h.rpc(mk('token rác', 'abc.def'), 'me', []);
    await h.rpc(mk('token có khoảng trắng cuối', cut(good, (t) => t + ' ')), 'me', []);
    await h.rpc(mk('token payload không phải JSON', h.makeToken('khong phai json')), 'me', []);
    await h.rpc(mk('token payload là null', h.makeToken('null')), 'me', []);
    await h.rpc(mk('token payload là mảng', h.makeToken('[1,2]')), 'me', []);
    await h.rpc(mk('token payload là số', h.makeToken('5')), 'me', []);
    await h.rpc(mk('token uid không tồn tại', h.makeToken({ uid: '00000000-0000-4000-8000-00000000ffff', u: 'ma', r: 'super', ct: null, exp: now + 3600e3 })), 'me', []);
    await h.rpc(mk('token uid không phải uuid', h.makeToken({ uid: 'abc', u: 'x', r: 'super', ct: null, exp: now + 3600e3 })), 'me', []);
    await h.rpc(mk('token uid là số', h.makeToken({ uid: 12345, u: 'x', r: 'super', ct: null, exp: now + 3600e3 })), 'me', []);
    await h.rpc(mk('token uid null', h.makeToken({ uid: null, u: 'x', r: 'super', ct: null, exp: now + 3600e3 })), 'me', []);
    await h.rpc(mk('token thiếu uid', h.makeToken({ u: 'x', r: 'super', exp: now + 3600e3 })), 'me', []);
    await h.rpc(mk('token uid là object', h.makeToken({ uid: { a: 1 }, u: 'x', r: 'super', exp: now + 3600e3 })), 'me', []);
    await h.rpc(mk('token uid viết HOA', h.makeToken({ uid: h.pair(String(f.adminAId.node).toUpperCase(), String(f.adminAId.go).toUpperCase()), u: 'x', r: 'admin', ct: null, exp: now + 3600e3 })), 'me', []);
    // Vai trò / công ty / tên lấy từ DATABASE, không tin payload: staff tự nhận super vẫn là staff
    const fake = mk('staff tự nhận super trong token', h.makeToken({ uid: f.staffId, u: 'gia', r: 'super', ct: f.ctB, exp: now + 3600e3 }));
    await h.rpc(fake, 'me', []);
    await h.rpc(fake, 'adminListUsers', []);
    await h.rpc(fake, 'listCongTy', []);
    await h.rpc(fake, 'logout', []);                                  // audit ghi username thật
    const extra = mk('token có khoá thừa', h.makeToken({ uid: f.adminAId, u: 'dx_a_admin', r: 'admin', ct: f.ctA, exp: now + 3600e3, username: 'khac', them: 1 }));
    await h.rpc(extra, 'logout', []);

    // --- 3 tầng quyền của cổng (401 -> 403 admin -> 403 super) ---
    for (const s of f.all) {
      await h.both(s, 'notifCount', []);         // chỉ cần đăng nhập
      await h.both(s, 'adminListUsers', []);     // ADMIN_FNS
      await h.both(s, 'listCongTy', []);         // SUPER_FNS
    }

    // --- x-view-company: chỉ super được dùng ---
    await h.both(h.with(S.adminA, { view: f.ctB, label: 'admin A gửi x-view-company = B (bị bỏ qua)' }), 'adminListUsers', []);
    await h.both(h.with(S.staff, { view: f.ctB, label: 'staff gửi x-view-company (bị bỏ qua)' }), 'notifCount', []);
    await h.both(h.with(S.root, { view: f.ctB, label: 'super xem công ty B' }), 'adminListUsers', []);
    await h.both(h.with(S.root, { view: f.dezon, label: 'super xem Dezon' }), 'adminListUsers', []);
    await h.both(h.with(S.root, { view: '00000000-0000-4000-8000-00000000eeee', label: 'super xem công ty không tồn tại' }), 'adminListUsers', []);
    await h.both(h.with(S.root, { view: 'khong-phai-uuid', label: 'super, x-view-company không phải uuid' }), 'adminListUsers', []);
    await h.both(h.with(S.root, { view: '', label: 'super, x-view-company rỗng' }), 'adminListUsers', []);
    await h.both(h.with(S.root, { view: ' ', label: 'super, x-view-company khoảng trắng' }), 'adminListUsers', []);
    await h.both(h.with(S.root, { view: h.pair(String(f.ctA.node).toUpperCase(), String(f.ctA.go).toUpperCase()), label: 'super, x-view-company viết HOA' }), 'adminListUsers', []);
    await h.both(h.with(S.root, { view: h.pair(f.ctA.node + ', ' + f.ctB.node, f.ctA.go + ', ' + f.ctB.go), label: 'super, x-view-company 2 giá trị' }), 'adminListUsers', []);

    // --- tài khoản bị khoá: phiên mất hiệu lực NGAY (forgetSession_) ---
    let r = await h.rpc(S.adminA, 'adminCreateUser', [{ username: 'dx_tmp_lock', password: PW.staff, hoTen: 'Sắp bị khoá' }]);
    const tmpId = r.val('result.id');
    const tmp = await h.login('tài khoản sẽ bị khoá', 'dx_tmp_lock', PW.staff);
    await h.both(tmp, 'me', []);
    await h.rpc(S.adminA, 'adminSetActive', [tmpId, false]);
    await h.both(tmp, 'me', []);
    await h.rpc(h.with(tmp, { via: 'body' }), 'notifCount', []);
    await h.both(S.anon, 'login', ['dx_tmp_lock', PW.staff]);
    await h.both(S.anon, 'login', ['dx_tmp_lock', 'sai-mat-khau']);
    await h.rpc(S.adminA, 'adminSetActive', [tmpId, true]);
    await h.both(tmp, 'me', []);
    // đổi vai trò có hiệu lực ngay dù token vẫn ghi vai trò cũ
    await h.rpc(S.adminA, 'adminUpdateUser', [tmpId, { role: 'admin' }]);
    await h.both(tmp, 'adminListUsers', []);
    await h.rpc(S.adminA, 'adminUpdateUser', [tmpId, { role: 'staff' }]);
    await h.both(tmp, 'adminListUsers', []);
    // xoá tài khoản: token cũ thành 401
    await h.rpc(S.adminA, 'adminDeleteUser', [tmpId]);
    await h.both(tmp, 'me', []);
    await h.both(S.anon, 'login', ['dx_tmp_lock', PW.staff]);

    // --- công ty bị khoá / hết hạn. Phiên được nhớ 30 giây -> "quên phiên" bằng 1 lần sửa tài khoản (forgetSession_) ---
    const forgetB = () => h.rpc(S.root, 'adminUpdateUser', [f.adminBId, { hoTen: 'Chủ B' }], { label: 'quên phiên admin B (sửa họ tên)' });
    await forgetB();
    await h.both(S.adminB, 'me', []);
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { active: false }]);
    await h.both(S.adminB, 'me', [], { label: 'me @admin B, công ty vừa khoá nhưng phiên còn nhớ' });
    await forgetB();
    await h.both(S.adminB, 'me', [], { label: 'me @admin B, công ty bị khoá' });
    await h.both(S.adminB, 'adminListUsers', [], { label: 'adminListUsers @admin B, công ty bị khoá' });
    await h.both(S.anon, 'login', ['dx_b_admin', PW.admin], { label: 'login admin B, công ty bị khoá' });
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { active: true, hanDung: '2020-01-31' }]);
    await forgetB();
    await h.both(S.adminB, 'me', [], { label: 'me @admin B, công ty hết hạn' });
    await h.both(S.anon, 'login', ['dx_b_admin', PW.admin], { label: 'login admin B, công ty hết hạn' });
    const vn = (d) => new Date(Date.now() + 7 * 3600e3 + d * 86400e3).toISOString().slice(0, 10);
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { hanDung: vn(-1) }], { label: 'hạn dùng = hôm qua (giờ VN)' });
    await forgetB();
    await h.both(S.adminB, 'me', [], { label: 'me @admin B, hạn dùng hôm qua' });
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { hanDung: vn(0) }], { label: 'hạn dùng = hôm nay (giờ VN) -> còn hạn' });
    await forgetB();
    await h.both(S.adminB, 'me', [], { label: 'me @admin B, hạn dùng hôm nay' });
    await h.both(S.anon, 'login', ['dx_b_admin', PW.admin], { label: 'login admin B, hạn dùng hôm nay' });
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { hanDung: '' }], { label: 'bỏ hạn dùng' });
    await forgetB();
    S.adminB = await h.login('admin B', 'dx_b_admin', PW.admin);
    f.all[4] = S.adminB;
    await h.both(S.adminB, 'me', []);
    // Tài khoản không thuộc công ty nào: token hợp lệ vẫn 401; super không công ty thì vào được
    const orphan = mk('tài khoản mồ côi (token tự ký)', h.makeToken({ uid: ID.orphan, u: 'dx_orphan', r: 'staff', ct: null, exp: now + 3600e3 }));
    await h.both(orphan, 'me', []);
    await h.both(S.root, 'me', []);
  },
};
