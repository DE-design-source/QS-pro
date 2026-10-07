'use strict';
/* Test phiên đăng nhập bằng COOKIE HttpOnly (không gọi Supabase thật — server/libraries/supa được thay bằng DB giả).
   Chạy: npm run test:auth. Thoát mã 1 nếu có lỗi.
   Phủ: login đặt cookie + không trả token cho trang, gọi hàm bằng cookie, không nhận Bearer / token trong body,
   chặn request từ trang khác (Origin), đăng xuất xoá cookie + vô hiệu token ngay (bảng phien_dang_nhap), cookie hỏng bị dọn. */
const path = require('path'), R = p => path.join(__dirname, '..', p);
const bcrypt = require('bcryptjs');
let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', m); } };

const users = [{ id: 7, username: 'an', password_hash: bcrypt.hashSync('matkhau', 4), role: 'admin', active: true, cong_ty_id: 1, ho_ten: 'An' }];
const congTy = [{ id: 1, ten: 'Công ty thử', ma: 'thu', active: true }];
let phien = [], coBangPhien = true;      // bảng phien_dang_nhap giả; coBangPhien=false = chưa chạy db/phien_dang_nhap.sql
const thieu = () => { if (!coBangPhien) throw new Error('relation "public.phien_dang_nhap" does not exist'); };
const fake = {
  eq: (c, v) => c + '=eq.' + encodeURIComponent(v),
  select: async (t, o) => {
    const f = (o && o.filter) || '';
    if (t === 'users') return users.filter(u => !f || f === 'username=eq.' + u.username || f === 'id=eq.' + u.id);
    if (t === 'cong_ty') return congTy;
    if (t === 'phien_dang_nhap') { thieu(); return phien.filter(p => !f || f === 'id=eq.' + encodeURIComponent(p.id)); }
    return [];
  },
  insert: async (t, r) => { if (t === 'phien_dang_nhap') { thieu(); phien.push(r); } return [{}]; },
  update: async () => [{}],
  remove: async (t, f) => { if (t === 'phien_dang_nhap') { thieu(); phien = phien.filter(p => f !== 'id=eq.' + encodeURIComponent(p.id)); } return []; }
};
require.cache[require.resolve(R('server/libraries/supa'))] = { id: 'x', filename: 'x', loaded: true, exports: new Proxy(fake, { get: (o, k) => o[k] || (async () => []) }) };
const { app } = require(R('server/app'));

(async () => {
  const srv = app.listen(0); const base = 'http://127.0.0.1:' + srv.address().port;
  const call = async (fn, args, headers) => {
    const r = await fetch(base + '/api/' + fn, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(args && args.raw ? args.raw : { args: args || [] }) });
    return { status: r.status, body: await r.json().catch(() => ({})), setCookie: r.headers.get('set-cookie') || '' };
  };

  console.log('1. Đăng nhập: token nằm trong cookie HttpOnly, không trả về cho trang');
  let r = await call('login', ['an', 'sai']); ok(r.status === 500 && !r.setCookie, 'sai mật khẩu vẫn đặt cookie');
  r = await call('login', ['an', 'matkhau']);
  ok(r.status === 200 && r.body.result && r.body.result.user && r.body.result.user.username === 'an', 'login không trả user');
  ok(!/token/i.test(JSON.stringify(r.body)), 'kết quả login còn chứa token: ' + JSON.stringify(r.body).slice(0, 120));
  ok(/^qs_sess=[^;]+;/.test(r.setCookie), 'không đặt cookie qs_sess');
  ok(/HttpOnly/i.test(r.setCookie) && /SameSite=Lax/i.test(r.setCookie) && /Max-Age=\d+/i.test(r.setCookie), 'cookie thiếu HttpOnly / SameSite / Max-Age: ' + r.setCookie);
  ok(!/;\s*Secure/i.test(r.setCookie), 'http thường không được gắn Secure (localhost sẽ không đăng nhập được)');
  const cookie = r.setCookie.split(';')[0], token = decodeURIComponent(cookie.split('=')[1]);
  r = await call('login', ['an', 'matkhau'], { 'x-forwarded-proto': 'https' }); ok(/;\s*Secure/i.test(r.setCookie), 'sau HTTPS phải gắn Secure');

  console.log('2. Gọi hàm bằng cookie');
  r = await call('me', [], { Cookie: cookie }); ok(r.status === 200 && r.body.result.username === 'an', 'me bằng cookie: ' + r.status);
  r = await call('me', []); ok(r.status === 401 && r.body.code === 'NOAUTH', 'không cookie phải 401');
  r = await call('me', [], { Authorization: 'Bearer ' + token }); ok(r.status === 401, 'vẫn nhận token qua header Authorization');
  r = await call('me', { raw: { args: [], token: token } }); ok(r.status === 401, 'vẫn nhận token trong body');
  r = await call('adminListUsers', [], { Cookie: 'a=1; ' + cookie + '; b=2' }); ok(r.status === 200 && r.body.result.length === 1, 'cookie lẫn cookie khác: ' + r.status);

  console.log('3. Chặn request từ trang khác (CSRF)');
  r = await call('me', [], { Cookie: cookie, Origin: 'https://trang-la.example' }); ok(r.status === 401, 'Origin lạ phải bị từ chối');
  ok(!r.setCookie, 'Origin lạ không được làm mất cookie của người dùng');
  r = await call('me', [], { Cookie: cookie, Origin: base }); ok(r.status === 200, 'Origin của chính app phải qua: ' + r.status);
  let x = await fetch(base + '/export/bang', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://trang-la.example' }, body: '{"cols":[{"label":"A"}]}' });
  ok(x.status === 401, '/export/bang từ Origin lạ: ' + x.status);
  x = await fetch(base + '/export/bang', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{"cols":[{"label":"A"}],"rows":[]}' });
  ok(x.status === 200, '/export/bang bằng cookie: ' + x.status);

  console.log('4. Đăng xuất / cookie hỏng');
  r = await call('logout', [], { Cookie: cookie }); ok(r.status === 200 && /^qs_sess=;/.test(r.setCookie) && /Expires=Thu, 01 Jan 1970/i.test(r.setCookie), 'logout không xoá cookie: ' + r.setCookie);
  ok(!('_sessionToken' in (r.body.result || {})), 'logout lộ _sessionToken');
  r = await call('me', [], { Cookie: 'qs_sess=hong.hong' }); ok(r.status === 401 && /^qs_sess=;/.test(r.setCookie), 'cookie hỏng phải bị dọn');

  console.log('5. Đăng xuất vô hiệu token NGAY (phiên lưu phía server)');
  ok(phien.length === 1, 'sau khi đăng xuất phiên 1 phải còn đúng phiên của lần đăng nhập thứ 2, đang có ' + phien.length);
  r = await call('me', [], { Cookie: cookie }); ok(r.status === 401, 'cookie của phiên ĐÃ ĐĂNG XUẤT vẫn dùng được: ' + r.status);
  const dn = async () => (await call('login', ['an', 'matkhau'])).setCookie.split(';')[0];
  const mayA = await dn(), mayB = await dn();
  ok((await call('me', [], { Cookie: mayA })).status === 200 && (await call('me', [], { Cookie: mayB })).status === 200, '2 máy đăng nhập cùng lúc');
  await call('logout', [], { Cookie: mayA });
  ok((await call('me', [], { Cookie: mayA })).status === 401, 'máy A đăng xuất rồi vẫn vào được');
  ok((await call('me', [], { Cookie: mayB })).status === 200, 'máy A đăng xuất làm văng luôn máy B');
  ok((await call('logout', [], { Cookie: mayA })).status === 401, 'đăng xuất lần 2 bằng cookie đã chết');
  users[0].active = false; require(R('server/components/auth/session')).forgetSession_(7);
  r = await call('me', [], { Cookie: mayB }); ok(r.status === 401, 'tài khoản bị khoá vẫn dùng được cookie cũ');
  users[0].active = true; require(R('server/components/auth/session')).forgetSession_(7);

  console.log('6. Chưa chạy db/phien_dang_nhap.sql: vẫn đăng nhập được (chạy như cũ)');
  coBangPhien = false; phien = [];
  const cu = await dn(); ok(/^qs_sess=.+/.test(cu), 'thiếu bảng thì không đăng nhập được');
  ok((await call('me', [], { Cookie: cu })).status === 200, 'thiếu bảng: cookie không dùng được');
  ok((await call('logout', [], { Cookie: cu })).status === 200, 'thiếu bảng: đăng xuất lỗi');
  coBangPhien = true;
  const moi = await dn();           // có bảng trở lại: lần đăng nhập kế tiếp tạo phiên thu hồi được
  ok(phien.length === 1 && (await call('me', [], { Cookie: moi })).status === 200, 'có bảng lại: phiên mới không chạy');
  require(R('server/components/auth/session')).forgetSession_(7);   // bỏ cache 30s của phiên
  ok((await call('me', [], { Cookie: cu })).status === 401, 'đã có bảng mà token không mã phiên vẫn được nhận');

  console.log('7. Giao diện không còn giữ token');
  const js = require('fs').readFileSync(R('public/app.js'), 'utf8');
  ok(!/setItem\(\s*'qs_token'/.test(js) && !/Authorization/.test(js) && !/authToken\(/.test(js), 'public/app.js còn lưu / gửi token');

  srv.close();
  console.log('\nKẾT QUẢ: ' + pass + ' đạt, ' + fail + ' lỗi');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
