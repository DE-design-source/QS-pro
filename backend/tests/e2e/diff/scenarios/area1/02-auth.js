'use strict';
/* Module auth: login, me, setMyPref, logout, changePassword, logClientError (server/auth.js 218-296, 436-443). */
const { fx, PW, ID } = require('./_fx');

module.exports = {
  name: 'area1/02 auth',
  async run(h) {
    const f = await fx(h), S = f.S;
    const now = Date.now();

    /* ================= login ================= */
    const L = (args, opts) => h.both(S.anon, 'login', args, opts);
    // kiểu / thiếu tham số
    for (const a of [[], [null, null], ['dx_a_admin'], ['dx_a_admin', null], ['dx_a_admin', ''], ['', ''], ['   ', PW.admin], [null, PW.admin], [123, 456], [true, false], [{}, {}], [{ username: 'dx_a_admin' }, PW.admin],
      [['dx_a_admin'], [PW.admin]], [['dx_a_admin', 'x'], PW.admin], ['dx_a_admin', 'sai mật khẩu'], ['khong_co_ai', PW.admin], ['dx_a_admin', PW.admin + ' '], ['dx_a_admin', ' ' + PW.admin],
      ['dx_a_admin', PW.admin.toLowerCase()], ['dx_a_admin', 0], ['dx_a_admin', PW.admin, 'thừa', { x: 1 }], ['  DX_A_Admin \t', PW.admin], ['DX_A_ADMIN', PW.admin], ['dx_a_admin\n', PW.admin], ['dx-a-admin', PW.admin],
      ['dx_a_adm%', PW.admin], ['dx_a_admi_', PW.admin], ["dx_a_admin' or '1'='1", PW.admin], ['dx_a_admin,dx_root', PW.admin], ['(dx_a_admin)', PW.admin], ['dx_a_admin"', PW.admin], ['Đx_a_admin', PW.admin]]) await L(a);
    // đăng nhập bằng email (ilike, chặn ký tự đại diện, escape "_")
    for (const u of ['dx_a.staff@dx.test', 'DX_A.Staff@DX.TEST', ' dx_a.staff@dx.test ', 'dx_a_staff@dx.test', 'dxxa.staff@dx.test', 'dx%@dx.test', 'dx*@dx.test', 'dx\\_a.staff@dx.test', '@dx.test', 'dx_a.staff@', 'a@dx.test', 'dx_a.staff@dx.tes', '%@%', 'dx_a.staff@dx.test,x', 'dx_a.staff@dx.test&id=1'])
      await L([u, PW.staff]);
    await L(['dx_a.staff@dx.test', 'sai']);
    // 2 tài khoản cùng email ở 2 công ty: chọn theo mật khẩu khớp; xếp ưu tiên tài khoản đang mở + có công ty (sort ổn định)
    let r = await h.rpc(S.adminB, 'adminCreateUser', [{ username: 'dx_b_mail', password: 'MailB@123', email: 'DX_A.staff@dx.test', hoTen: 'Trùng email' }]);
    const mailB = r.val('result.id');
    await L(['dx_a.staff@dx.test', 'MailB@123']);
    await L(['dx_a.staff@dx.test', PW.staff]);
    await L(['dx_a.staff@dx.test', 'sai-ca-hai']);
    await h.rpc(S.root, 'adminSetActive', [f.staffId, false]);
    await L(['dx_a.staff@dx.test', 'sai-ca-hai'], { label: 'login email trùng, sai mật khẩu, 1 tài khoản bị khoá (audit theo dòng đầu sau khi xếp)' });
    await L(['dx_a.staff@dx.test', PW.staff], { label: 'login email trùng, đúng mật khẩu của tài khoản bị khoá' });
    await L(['dx_a.staff@dx.test', 'MailB@123']);
    await h.rpc(S.root, 'adminSetActive', [f.staffId, true]);
    await h.rpc(S.adminB, 'adminDeleteUser', [mailB]);
    // mật khẩu chữ thường (nhập tay trong database): tự băm lại sau lần đăng nhập đúng đầu tiên
    await L(['dx_plain', 'sai']);
    await L(['dx_plain', '']);
    await h.rpc(S.anon, 'login', ['dx_plain', 'plain-pw-1'], { label: 'login mật khẩu chữ thường -> tự băm' });
    const hp = await h.sql('select password_hash from users where id = $1', [ID.plain]);
    h.check('mật khẩu chữ thường đã thành bcrypt cost 10 ở cả 2 phía', /^\$2[aby]\$10\$/.test(hp.node[0].password_hash) && /^\$2[aby]\$10\$/.test(hp.go[0].password_hash) && hp.node[0].password_hash.slice(0, 7) === hp.go[0].password_hash.slice(0, 7), hp.node[0].password_hash.slice(0, 7), hp.go[0].password_hash.slice(0, 7));
    await L(['dx_plain', 'plain-pw-1'], { label: 'login lại sau khi đã băm' });
    await h.rest(S.anon, 'login', ['dx_plain2', 'plain-pw-2'], { label: 'login mật khẩu chữ thường qua REST -> tự băm' });
    /* [khoảng trống B.low: token do REST cấp chưa từng được kiểm] đăng nhập phía Go qua POST /api/v1/auth/login: giải mã payload, so với token của Node,
       rồi DÙNG chính token đó cho rpc và REST (token sai chữ ký / sai payload sẽ thành 401 ở đây). */
    for (const [label, u, p] of [['admin A, token do REST cấp', 'dx_a_admin', PW.admin], ['staff A, token do REST cấp', 'dx_a_staff', PW.staff], ['super, token do REST cấp', 'dx_root', PW.root]]) {
      const viaRest = await h.loginRest(label, u, p);
      await h.both(viaRest, 'me', []);
      await h.both(viaRest, 'adminListUsers', []);
      await h.rpc(h.with(viaRest, { via: 'body' }), 'notifCount', []);
      // token chéo: token REST của Go dùng ở Node, token rpc của Node dùng ở REST của Go
      await h.both(h.session(label + ' (đổi chéo 2 phía)', h.pair(viaRest.token.go, viaRest.token.node)), 'me', []);
    }
    // [khoảng trống B.low] các dạng viết header Authorization trên route REST (trước chỉ thử ở cổng rpc, area1/01 dòng 75-81)
    for (const [label, scheme] of [['"bearer" thường', 'bearer '], ['BEARER + nhiều dấu cách', 'BEARER    '], ['không tiền tố Bearer', ''], ['tiền tố Basic', 'Basic '], ['Bearer dính liền token', 'Bearer'], ['Bearer + tab', 'Bearer\t']])
      for (const fn of ['me', 'notifCount']) await h.rest(h.with(S.adminA, { scheme, label: 'admin A, ' + label }), fn, []);
    await h.rest(h.session('header rác', 'rac.rac'), 'me', []);
    await h.rest(h.session('token hết hạn', h.makeToken({ uid: f.adminAId, u: 'dx_a_admin', r: 'admin', ct: f.ctA, exp: now - 1000 })), 'me', []);
    await h.rest(h.session('token ký bằng khoá khác', h.makeToken({ uid: f.adminAId, u: 'dx_a_admin', r: 'admin', ct: f.ctA, exp: now + 3600e3 }, 'khoa-khac')), 'me', []);
    // tài khoản không thuộc công ty nào; công ty hết hạn (seed Bird: 2026-09-10); super có công ty
    await L(['dx_orphan', PW.staff]);
    await L(['dx_orphan', 'sai']);
    const seed = (await h.sql("select (select id::text from users where username = 'bird.admin') bird, (select id::text from users where username = 'admin') adm, (select id::text from users where username = 'mai') mai")).node[0];
    await h.rpc(S.root, 'adminSetPassword', [seed.bird, 'Bird@1234']);
    await L(['bird.admin', 'Bird@1234'], { label: 'login công ty seed đã hết hạn 2026-09-10' });
    await L(['bird.admin', 'sai'], { label: 'login công ty hết hạn, sai mật khẩu' });
    await h.rpc(S.root, 'adminSetPassword', [seed.adm, 'Seed@1234']);
    const seedSuper = await h.login('super seed (có công ty Dezon)', 'admin', 'Seed@1234');
    await h.both(seedSuper, 'me', []);
    // mật khẩu dài: bcryptjs cắt ở 72 byte
    const L80 = 'Abcd1234'.repeat(10), U = 'Mật khẩu có dấu 😀 ß 中文';
    r = await h.rpc(S.adminA, 'adminCreateUser', [{ username: 'dx_long', password: L80 }]);
    const longId = r.val('result.id');
    await L(['dx_long', L80]);
    await L(['dx_long', L80.slice(0, 72)], { label: 'login 72 ký tự đầu của mật khẩu 80 ký tự' });
    await L(['dx_long', L80.slice(0, 72) + 'KHAC'], { label: 'login 72 ký tự đầu + đuôi khác' });
    await L(['dx_long', L80.slice(0, 71)], { label: 'login 71 ký tự đầu' });
    await h.rpc(S.adminA, 'adminSetPassword', [longId, U]);
    await L(['dx_long', U]);
    await L(['dx_long', U.normalize('NFD')], { label: 'login mật khẩu có dấu dạng NFD (khác byte)' });
    await h.rpc(S.adminA, 'adminSetPassword', [longId, 'ấ'.repeat(30)]);       // 30 ký tự = 90 byte
    await L(['dx_long', 'ấ'.repeat(24)], { label: 'login 24 ký tự 3 byte (= 72 byte) của mật khẩu 90 byte' });
    await L(['dx_long', 'ấ'.repeat(23)], { label: 'login 23 ký tự 3 byte' });
    await h.rpc(S.adminA, 'adminSetPassword', [longId, 'ab\u0000cd']);
    await L(['dx_long', 'ab\u0000cd'], { label: 'login mật khẩu có ký tự NUL' });
    await L(['dx_long', 'ab'], { label: 'login phần trước ký tự NUL' });
    await L(['dx_long', 'ab\u0000khac'], { label: 'login NUL + đuôi khác' });
    await h.rpc(S.adminA, 'adminDeleteUser', [longId]);
    // đăng nhập khi đang mang token (hàm public: bỏ qua token, kể cả token hỏng)
    await h.rpc(S.adminA, 'login', ['dx_a_staff0', PW.staff]);
    await h.rpc(h.session('token rác', 'x.y'), 'login', ['dx_a_staff0', PW.staff]);
    await h.rpc(h.with(S.root, { view: f.ctA, label: 'super + view' }), 'login', ['dx_a_staff0', 'sai']);

    /* ================= me ================= */
    for (const s of f.all) await h.both(s, 'me', []);
    await h.both(S.adminA, 'me', ['thừa', 1]);
    await h.both(h.with(S.root, { view: f.ctB, label: 'super xem B' }), 'me', []);

    /* ================= setMyPref ================= */
    const P = (args, s, opts) => h.both(s || S.adminA, 'setMyPref', args, opts);
    for (const a of [['tkCols', ['ma', 'ten', 'donGia']], ['spCols', ['ma']], ['cpCols', ['x', 'y']], ['daCols', []], ['tkCols', ['ten']], ['cpCols', null], ['cpCols'], ['cpCols', ['z']], ['daCols', null],
      ['khac', ['a']], ['', ['a']], [null, ['a']], [], [1, ['a']], [['tkCols'], ['a']], ['TKCOLS', ['a']], ['tkCols ', ['a']], ['__proto__', ['a']], ['constructor', null], ['toString'], ['length', null],
      ['tkCols', 'abc'], ['tkCols', 5], ['tkCols', 0], ['tkCols', false], ['tkCols', true], ['tkCols', ''], ['tkCols', {}], ['tkCols', { 0: 'a', length: 1 }], ['tkCols', ['a', 1]], ['tkCols', ['a', null]], ['tkCols', [['a']]], ['tkCols', [{}]],
      ['tkCols', ['']], ['tkCols', ['a', 'a', 'a']], ['tkCols', ['có dấu', '中文', '😀']], ['tkCols', ['a"b\\c', '<b>', "x'y"]],
      ['tkCols', ['x'.repeat(39)]], ['tkCols', ['x'.repeat(40)]], ['tkCols', ['😀'.repeat(19) + 'a']], ['tkCols', ['😀'.repeat(20)]], ['tkCols', ['ấ'.repeat(39)]], ['tkCols', ['ấ'.repeat(40)]],
      ['tkCols', Array.from({ length: 60 }, (x, i) => 'c' + i)], ['tkCols', Array.from({ length: 61 }, (x, i) => 'c' + i)], ['spCols', ['a'], 'thừa'], ['tkCols', ['cuoi']]]) await P(a);
    await h.both(S.adminA, 'me', [], { label: 'me @admin A sau setMyPref (thứ tự khoá uiPrefs theo jsonb)' });
    await h.both(S.anon, 'login', ['dx_a_admin', PW.admin], { label: 'login admin A: uiPrefs trong kết quả login' });
    for (const s of [S.anon, S.staff0, S.staff, S.adminB, S.root, S.rootView]) { await P(['tkCols', ['q1', 'q2']], s); await P(['khac', 1], s); }
    await P(['tkCols', null], S.root);
    await P(['spCols', ['chưa từng đăng nhập']], h.session('token tự ký của dx_plain', h.makeToken({ uid: ID.plain, u: 'dx_plain', r: 'staff', ct: f.dezon, exp: now + 3600e3 })));
    // ui_prefs trong database không phải object (mảng / chuỗi / số) -> coi như {}
    for (const [label, js] of [['mảng', '["a","b"]'], ['chuỗi', '"abc"'], ['số', '5'], ['null jsonb', 'null'], ['object lồng', '{"zz":{"b":1,"a":2},"tkCols":["cũ"],"a":null}']]) {
      await h.sql('update users set ui_preferences = $2::jsonb where id = $1', [f.staff0Id, js]);
      await h.both(S.staff0, 'me', [], { label: 'me, ui_prefs là ' + label });
      await h.both(S.staff0, 'setMyPref', ['cpCols', ['m']], { label: 'setMyPref khi ui_prefs là ' + label });
      await h.both(S.staff0, 'me', [], { label: 'me sau setMyPref, ui_prefs trước đó là ' + label });
    }

    /* ================= logout ================= */
    for (const s of f.all) await h.both(s, 'logout', []);
    await h.both(S.adminA, 'logout', [1, 2]);
    await h.both(S.adminA, 'me', [], { label: 'me sau logout (token vẫn dùng được)' });

    /* ================= changePassword ================= */
    r = await h.rpc(S.adminA, 'adminCreateUser', [{ username: 'dx_pw', password: PW.staff, hoTen: 'Đổi mật khẩu' }]);
    const pwId = r.val('result.id');
    const pw = await h.login('tài khoản đổi mật khẩu', 'dx_pw', PW.staff);
    const C = (args, opts) => h.both(pw, 'changePassword', args, opts);
    for (const a of [[], [null, null], ['sai', 'MoiMoi@123'], [PW.staff], [PW.staff, null], [PW.staff, ''], [PW.staff, 'abc'], [PW.staff, 123], [PW.staff, 'ấbc'], [PW.staff, '😀a'], [PW.staff, false], [PW.staff, {}],
      [PW.staff.toLowerCase(), 'MoiMoi@123'], [' ' + PW.staff, 'MoiMoi@123'], [[PW.staff, 'x'], 'MoiMoi@123'], [true, true], [{ a: 1 }, 'MoiMoi@123'], ['', 'MoiMoi@123']]) await C(a);
    await h.rpc(pw, 'changePassword', [PW.staff, 1234], { label: 'changePassword mới là số 1234' });
    await C([PW.staff, 'x1y2z3'], { label: 'changePassword bằng mật khẩu cũ đã hết hiệu lực' });
    await h.rpc(pw, 'changePassword', [1234, '😀😀'], { label: 'changePassword cũ là số, mới 2 emoji (length 4)' });
    await h.rpc(pw, 'changePassword', [['😀😀'], [L80]], { label: 'changePassword tham số là mảng 1 phần tử' });
    await h.rpc(pw, 'changePassword', [L80.slice(0, 72) + 'đuôi khác', 'abcd'], { label: 'changePassword cũ = 72 ký tự đầu, mới đúng 4 ký tự' });
    await h.rest(pw, 'changePassword', ['abcd', 'Rest@1234'], { label: 'changePassword qua REST' });
    await L(['dx_pw', 'Rest@1234']);
    await L(['dx_pw', 'abcd']);
    await h.rpc(pw, 'changePassword', ['Rest@1234', 'Rest@1234'], { label: 'changePassword mới = cũ' });
    await h.rpc(pw, 'changePassword', ['Rest@1234', '    '], { label: 'changePassword mới là 4 dấu cách' });
    await L(['dx_pw', '    ']);
    await h.both(S.anon, 'changePassword', [PW.staff, 'abcd1234']);
    await h.both(h.session('token tự ký của dx_plain2... (mật khẩu chữ thường chưa băm)', h.makeToken({ uid: ID.orphan, u: 'x', r: 'staff', ct: null, exp: now + 3600e3 })), 'changePassword', [PW.staff, 'abcd1234'], { label: 'changePassword @tài khoản mồ côi (401)' });
    await h.sql("update users set password_hash = 'plain-again' where id = $1", [pwId]);
    await C(['plain-again', 'abcd1234'], { label: 'changePassword khi mật khẩu đang là chữ thường (chỉ so bcrypt)' });
    await h.sql("update users set password_hash = '' where id = $1", [pwId]);
    await C(['', 'abcd1234'], { label: 'changePassword khi password_hash rỗng' });
    await h.rpc(S.adminA, 'adminSetPassword', [pwId, PW.staff]);
    for (const s of [S.staff0, S.adminB, S.rootView]) await h.both(s, 'changePassword', ['sai', 'abcd1234']);
    await h.rpc(S.staff0, 'changePassword', [PW.staff, PW.staff + 'x']);
    await h.rest(S.staff0, 'changePassword', [PW.staff + 'x', PW.staff]);
    await h.rpc(S.adminA, 'adminDeleteUser', [pwId]);
    await C([PW.staff, 'abcd1234'], { label: 'changePassword sau khi tài khoản bị xoá' });

    /* ================= logClientError ================= */
    const E = (args, s, opts) => h.both(s || S.adminA, 'logClientError', args, opts);
    for (const a of [[{ tab: 'boc', msg: 'Lỗi X is not a function', src: 'https://app.dezon.vn/boc.js?v=12' }], [], [null], ['chuỗi'], [123], [true], [['a', 'b']], [{}], [{ tab: null, msg: null, src: null }],
      [{ tab: 5, msg: { a: 1 }, src: 12 }], [{ msg: 0 }], [{ msg: '0' }], [{ msg: false, tab: false, src: false }], [{ tab: ['a', 'b'], msg: [1, [2, 3]], src: ['http://h/x'] }], [{ src: 'chỉ có src' }], [{ tab: 'chỉ có tab' }],
      [{ tab: 'x'.repeat(30), msg: 'm'.repeat(400), src: 'http://h.vn/' + 's'.repeat(200) }], [{ tab: 'ấ'.repeat(25), msg: 'ô'.repeat(350), src: 'https://h/' + 'đ'.repeat(130) }],
      [{ src: 'http://localhost:3000/public/app.js' }], [{ src: 'https://host-khong-co-duong-dan' }], [{ src: 'HTTP://X/y.js' }], [{ src: 'ftp://x/y.js' }], [{ src: '  https://a/b.js' }], [{ src: 'https:///b.js' }], [{ src: 'http://a/http://b/c.js' }],
      [{ src: 'https://a/' }], [{ msg: 'dòng 1\ndòng 2\ttab "nháy" \\ <script>' }], [{ msg: '   ' }], [{ tab: ' ', msg: ' ', src: ' ' }], [{ msg: 1e21, tab: -0, src: 0.1 }], [{ msg: 'a', them: 'bỏ qua' }, 'thừa'],
      [{ msg: 'a'.repeat(298) + '😀' }], [{ msg: 'a'.repeat(299) + '😀' }], [{ tab: 'a'.repeat(19) + '😀' }], [{ tab: 'a'.repeat(18) + '😀' }], [{ src: 'http://h/' + 'a'.repeat(119) + '😀' }], [{ msg: '😀'.repeat(160) }]]) await E(a);
    for (const s of [S.anon, S.staff0, S.staff, S.adminB, S.root, S.rootView]) await E([{ tab: 'sp', msg: 'lỗi theo vai trò' }], s);
    await h.both(S.root, 'getAuditLog', [80], { label: 'getAuditLog 80 @super sau các bước auth' });
  },
};
