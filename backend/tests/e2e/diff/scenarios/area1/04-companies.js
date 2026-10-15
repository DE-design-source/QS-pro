'use strict';
/* Module companies: listCongTy, createCongTy, updateCongTy, deleteCongTy, listCongTyUsers, createCongTyUser (server/auth.js 92-211). */
const { fx, PW, ID } = require('./_fx');

module.exports = {
  name: 'area1/04 companies',
  async run(h) {
    const f = await fx(h), S = f.S;
    const NOID = '00000000-0000-4000-8000-00000000dead';
    const viewB = h.with(S.root, { view: f.ctB, label: 'super xem công ty B' });
    const up = (p) => h.pair(String(p.node).toUpperCase(), String(p.go).toUpperCase());

    /* ================= listCongTy ================= */
    for (const s of f.all.concat([viewB])) await h.both(s, 'listCongTy', []);
    await h.both(S.root, 'listCongTy', ['thừa']);

    /* ================= createCongTy ================= */
    const C = (data, s, opts) => h.both(s || S.root, 'createCongTy', data === undefined ? [] : [data], opts);
    for (const s of [S.anon, S.staff0, S.staff, S.adminA, S.adminB]) await C({ ten: 'DX không quyền' }, s);
    // lỗi trước khi ghi -> gọi cả rpc lẫn REST
    for (const d of [undefined, null, 'chuỗi', 5, [], {}, { ten: '' }, { ten: '   ' }, { ten: null }, { ten: 0 }, { ten: false }, { ma: 'dx-chi-co-ma' }, { ten: 'DX trùng mã', ma: 'dx-a' }, { ten: 'DX trùng mã', ma: '  DX A  ' }, { ten: 'DX trùng mã', ma: 'Đx_Á' }, { ten: 'dx a' },
      { ten: 'DX trùng mã', ma: 'dezon', dungSpDezon: true }, { ten: 'DX chủ trùng', ma: 'dx-chu-trung', adminUser: 'dx_a_admin', adminPass: 'x' }, { ten: 'DX chủ trùng', ma: 'dx-chu-trung', adminUser: '  MAI ', adminPass: PW.admin }]) await C(d);
    // lỗi do database từ chối (không tạo dòng nào)
    for (const d of [{ ten: 'DX lỗi', ma: 'dx-e1', gioiHanUser: -3 }, { ten: 'DX lỗi', ma: 'dx-e2', hanDung: 'khong-phai-ngay' }, { ten: 'DX lỗi', ma: 'dx-e3', gioiHanUser: 1e10 }, { ten: 'DX lỗi', ma: 'dx-e4', gioiHanUser: 2.5 }, { ten: 'DX lỗi', ma: 'dx-e5', hanDung: '2031-02-30' },
      { ten: 'DX lỗi', ma: 'dx-e6', hanDung: true }, { ten: 'DX lỗi', ma: 'dx-e7', hanDung: 20301231 }, { ten: 'DX lỗi', ma: 'dx-e8', hanDung: { a: 1 } }, { ten: 'DX lỗi', ma: 'dx-e9', hanDung: ['2030-01-01'] }]) await C(d);
    // tạo thật, xen kẽ rpc / REST
    const made = {};
    const mk = async (via, key, data, s) => { const r = await h[via](s || S.root, 'createCongTy', [data], { label: 'createCongTy ' + key + ' ' + JSON.stringify(data).slice(0, 90) }); made[key] = r && r.val('result.id'); return r; };
    await mk('rpc', 'c1', { ten: 'DX Công ty Đông Á – Số 1! ĐẶNG  Ầẫ' });
    await mk('rest', 'c2', { ten: 'DX Hai', ma: '  DX_Hai Mã DÀI quá ba mươi hai ký tự luôn nhé  ', logoUrl: 'http://x/l.png', email: 'e@x', sdt: '09', tinhNang: 'boc, sanpham ,,duan', gioiHanUser: '7', active: false, hanDung: '2030-12-31', ghiChu: 'ghi chú', dungSpDezon: true, mauChinh: '#fff' });
    await mk('rpc', 'c3', { ten: 123, gioiHanUser: 0, tinhNang: ['a', 1, null, ['b', 'c']], active: null, hanDung: '', ghiChu: 5, dungSpDezon: 'true', logoUrl: null, email: 0, sdt: 912345678 });
    await mk('rpc', 'c4', { ten: '!!!' });                                       // mã rỗng
    await C({ ten: '???' }, S.root, { label: 'createCongTy mã rỗng lần 2 (trùng mã "")' });
    await mk('rest', 'c5', { ten: 'DX Năm', adminUser: ' DX_C5_ADMIN ', adminPass: 'Owner@123', adminEmail: 'o@x', email: 'c@x', tinhNang: { a: 1 }, gioiHanUser: 'abc', hanDung: '2030-01-01T10:00:00Z' });
    await mk('rpc', 'c6', { ten: 'DX Sáu', adminUser: 'ab', adminPass: 'Owner@123' });              // tạo chủ lỗi SAU khi đã tạo công ty
    await mk('rpc', 'c7', { ten: 'DX Bảy', adminUser: 'dx_c7_admin' });                              // không có adminPass -> không tạo chủ
    await mk('rest', 'c8', { ten: 'DX Tám', adminUser: 'dx_c8_admin', adminPass: 'abc' });
    await mk('rpc', 'c9', { ten: 'DX Chín ß İ ǅ Σ', ma: 0, adminUser: 'dx_c9_admin', adminPass: 1234, adminHoTen: 0, adminEmail: '', gioiHanUser: 1, active: 0, dungSpDezon: false }, S.rootView);
    await mk('rpc', 'c10', { ten: 'x'.repeat(70) + ' ĐỦ DÀI', gioiHanUser: true, hanDung: 0, tinhNang: [] }, viewB);
    await mk('rpc', 'c11', { ten: 'DX mười một', ma: '--Mã--có--gạch--', active: 'false', gioiHanUser: '0x10', id: NOID, ngayTao: '2000-01-01', soUser: 99 });
    // c6, c8: công ty ĐÃ được tạo nhưng API trả lỗi (tạo chủ thất bại) -> lấy id từ database
    for (const [k, code] of [['c6', 'dx-sau'], ['c8', 'dx-tam']]) {
      const q = await h.sql('select id::text id from companies where code = $1', [code]);
      h.check('công ty ' + k + ' (' + code + ') tồn tại ở cả 2 phía dù API trả lỗi', q.node.length === 1 && q.go.length === 1, q.node.length, q.go.length);
      made[k] = h.pair(q.node[0] && q.node[0].id, q.go[0] && q.go[0].id);
      if (q.node[0] && q.go[0]) h.norm.bind(q.node[0].id, q.go[0].id);
    }
    await h.both(S.root, 'listCongTy', [], { label: 'listCongTy @super sau khi tạo' });
    const owner5 = await h.login('chủ công ty c5', 'dx_c5_admin', 'Owner@123');
    await h.both(S.anon, 'login', ['dx_c9_admin', '1234'], { label: 'login chủ công ty c9 (công ty tạo với active = 0)' });
    await h.both(S.anon, 'login', ['dx_c7_admin', PW.admin]);
    await h.both(S.anon, 'login', ['dx_c8_admin', 'abc']);

    /* ================= listCongTyUsers ================= */
    for (const s of f.all) await h.both(s, 'listCongTyUsers', [f.ctA]);
    for (const id of [f.ctB, made.c5, made.c6, f.dezon, NOID, 'khong-phai-uuid', '', null, 0, 5, true, {}, [], up(f.ctA), "x' or '1'='1"]) await h.both(S.root, 'listCongTyUsers', [id]);
    await h.both(S.root, 'listCongTyUsers', []);
    await h.both(viewB, 'listCongTyUsers', [f.ctA, 'thừa']);

    /* ================= createCongTyUser ================= */
    const CU = (args, s, opts) => h.both(s || S.root, 'createCongTyUser', args, opts);
    for (const s of [S.anon, S.staff0, S.staff, S.adminA, S.adminB]) await CU([f.ctA, { username: 'dx_cu_x', password: PW.staff }], s);
    for (const a of [[], [f.ctB], [f.ctB, null], [f.ctB, 'chuỗi'], [f.ctB, []], [f.ctB, { username: 'ab', password: PW.staff }], [f.ctB, { username: 'dx_cu_x', password: 'abc' }], [f.ctB, { username: 'dx_a_admin', password: PW.staff }],
      [null, { username: 'dx_cu_x', password: PW.staff }], ['', { username: 'dx_cu_x', password: PW.staff }], [0, { username: 'dx_cu_x', password: PW.staff }], [NOID, { username: 'dx_cu_x', password: PW.staff }], ['rac', { username: 'dx_cu_x', password: PW.staff }],
      [null, { username: 'dx_cu_x', password: PW.staff, congTyId: f.ctB }], [made.c9, { username: 'dx_cu_x', password: PW.staff }]]) await CU(a);
    let r = await h.rpc(S.root, 'createCongTyUser', [f.ctB, { username: 'dx_cu1', password: PW.staff, congTyId: f.ctA, role: 'admin', hoTen: 'Tham số công ty thắng data.congTyId' }]);
    const cu1 = r.val('result.id');
    r = await h.rest(S.root, 'createCongTyUser', [made.c3, { username: 'dx_cu2', password: PW.staff, role: 'super', perms: ['boc'], phongBan: ' P ' }]);
    const cu2 = r.val('result.id');
    r = await h.rpc(S.rootView, 'createCongTyUser', [null, { username: 'dx_cu3', password: PW.staff }], { label: 'createCongTyUser công ty null @super xem A (rơi về công ty đang xem)' });
    const cu3 = r.val('result.id');
    r = await h.rpc(viewB, 'createCongTyUser', [made.c7, { username: 'dx_cu4', password: PW.staff, perms: ['a', 'b'] }, 'thừa']);
    const cu4 = r.val('result.id');
    await h.both(S.root, 'listCongTyUsers', [f.ctB], { label: 'listCongTyUsers B sau khi thêm' });
    await h.both(S.root, 'listCongTyUsers', [made.c3]);

    /* ================= updateCongTy ================= */
    const U = (id, data, s, opts) => h.both(s || S.root, 'updateCongTy', data === undefined ? [id] : [id, data], opts);
    const full = { ten: 'DX Công ty A (đổi)', logoUrl: 'http://x/logo.png', mauChinh: '#123456', email: 'moi@dx.test', sdt: '0988', tinhNang: ['x', 'y'], gioiHanUser: 1, active: false, hanDung: '2020-01-01', ghiChu: 'không được ghi', dungSpDezon: true };
    for (const s of [S.anon, S.staff0, S.staff]) await U(f.ctA, { ten: 'không quyền' }, s);
    await U(f.ctA, full, S.adminA, { label: 'updateCongTy @admin A sửa công ty mình (chỉ 5 trường được ghi)' });
    await U(f.ctA, { tinhNang: ['x'], gioiHanUser: 1, active: false, hanDung: '2020-01-01', ghiChu: 'g', dungSpDezon: true }, S.adminA, { label: 'updateCongTy @admin A chỉ gửi trường của super (không ghi gì)' });
    await U(f.ctB, { ten: 'chiếm công ty khác' }, S.adminA);
    await U(f.ctA, { ten: 'chiếm công ty khác' }, S.adminB);
    await U(up(f.ctA), { ten: 'id viết HOA' }, S.adminA, { label: 'updateCongTy @admin A, id công ty mình viết HOA' });
    for (const id of [NOID, '', null, 0, {}, [], 'rac']) await U(id, { ten: 'x' }, S.adminA);
    await h.both(S.adminA, 'updateCongTy', []);
    for (const d of [undefined, null, {}, 'chuỗi', 5, [], { khac: 1 }, { ten: null, logoUrl: null, email: null }]) await U(f.ctA, d, S.adminA);
    for (const d of [{ ten: '' }, { ten: 0 }, { ten: 'DX Công ty A' }, { logoUrl: '' }, { mauChinh: 0 }, { email: ['a', 'b'] }, { sdt: 901 }, { ten: 'DX Công ty A', sdt: '0901', email: 'a@dx.test', logoUrl: '', mauChinh: '' }]) await U(f.ctA, d, S.adminA);
    // super: từng trường
    const c1 = made.c1;
    for (const d of [undefined, null, {}, 'chuỗi', [], { ten: '' }, { ten: false }, { ten: 'DX Một (đổi)' }, { logoUrl: 5 }, { mauChinh: '#000' }, { email: 'x@y' }, { sdt: '' },
      { tinhNang: 'a, b ,c' }, { tinhNang: ['a', 'b'] }, { tinhNang: [] }, { tinhNang: 0 }, { tinhNang: '' }, { tinhNang: { a: 1 } },
      { gioiHanUser: 12 }, { gioiHanUser: '15' }, { gioiHanUser: 'x' }, { gioiHanUser: 0 }, { gioiHanUser: -1 }, { gioiHanUser: 2.5 }, { gioiHanUser: true }, { gioiHanUser: [9] }, { gioiHanUser: 3e9 },
      { active: false }, { active: 1 }, { active: 0 }, { active: 'no' }, { active: '' }, { active: true },
      { dungSpDezon: true }, { dungSpDezon: 0 }, { dungSpDezon: 'x' }, { dungSpDezon: false }, { dungSpDezon: '' },
      { hanDung: '2031-05-06' }, { hanDung: '' }, { hanDung: 0 }, { hanDung: false }, { hanDung: '2031-02-30' }, { hanDung: '31/12/2030' }, { hanDung: '2031-05-06T23:30:00+07:00' }, { hanDung: 'mai' }, { hanDung: 20310506 }, { hanDung: '2031-05-06' },
      { ghiChu: 'ghi chú mới' }, { ghiChu: 0 }, { ghiChu: '' }, { id: NOID, ma: 'doi-ma', ngayTao: '2000-01-01', soUser: 5 }, Object.assign({}, full, { ten: 'DX Một (đủ trường)', hanDung: '2032-01-01', active: true })]) await U(c1, d);
    await h.both(S.root, 'updateCongTy', [c1, { ghiChu: 'thừa tham số' }, { ten: 'bị bỏ' }]);
    for (const id of [NOID, 'rac', '', null, 0, 5, {}, [], up(c1)]) { await U(id, { ghiChu: 'id lạ' }); await U(id, {}); }
    await h.both(S.root, 'updateCongTy', []);
    await U(c1, { ten: 'DX Một (qua view A)' }, S.rootView);
    await U(f.ctB, { ghiChu: 'qua view B' }, viewB);
    await h.both(S.root, 'listCongTy', [], { label: 'listCongTy @super sau khi sửa' });
    await h.both(S.adminA, 'me', [], { label: 'me @admin A: congTy sau khi sửa' });

    /* ================= deleteCongTy ================= */
    const D = (args, s, opts) => h.both(s || S.root, 'deleteCongTy', args, opts);
    for (const s of [S.anon, S.staff0, S.staff, S.adminA, S.adminB]) await D([made.c6], s);
    for (const a of [[], [null], [''], [0], [NOID], ['rac'], [5], [{}], [[]]]) await D(a);
    await h.rpc(S.root, 'deleteCongTy', [up(made.c8)], { label: 'deleteCongTy c8, id viết HOA (uuid không phân biệt hoa thường)' });
    // c5: có chủ + dữ liệu ở vài bảng theo công ty -> xoá sạch
    await h.rpc(owner5, 'logClientError', [{ tab: 'x', msg: 'dữ liệu của công ty sắp bị xoá' }]);
    await h.rpc(owner5, 'createProject', [{ ten: 'DX dự án của c5' }]);
    await h.rpc(owner5, 'requestDeleteProducts', [[{ maSP: 'DX-KHONG-CO', ten: 'x' }]]);
    await h.rpc(owner5, 'setMyPref', ['tkCols', ['a']]);
    await h.rpc(S.root, 'adminUpdateUser', [owner5.uid, { hoTen: 'Chủ c5' }], { label: 'quên phiên chủ c5' });
    await h.rpc(owner5, 'notifCount', [], { label: 'notifCount @chủ c5 (nạp lại phiên)' });
    await h.rpc(S.root, 'deleteCongTy', [made.c5, 'thừa'], { label: 'deleteCongTy c5 (có chủ + dữ liệu)' });
    await h.both(owner5, 'me', [], { label: 'me @chủ c5 ngay sau khi xoá công ty (phiên còn nhớ <= 30 giây)' });
    await h.both(owner5, 'setMyPref', ['tkCols', ['a']], { label: 'setMyPref @chủ c5 đã mất tài khoản (phiên còn nhớ)' });
    await h.both(owner5, 'changePassword', ['Owner@123', 'abcd1234'], { label: 'changePassword @chủ c5 đã mất tài khoản' });
    await h.both(owner5, 'adminListUsers', [], { label: 'adminListUsers @chủ c5 đã mất công ty' });
    await h.both(owner5, 'adminCreateUser', [{ username: 'dx_ma', password: PW.staff }], { label: 'adminCreateUser @chủ c5 đã mất công ty (lỗi khoá ngoại)' });
    await h.both(owner5, 'updateCongTy', [made.c5, { ten: 'đã xoá' }], { label: 'updateCongTy công ty đã xoá @chủ c5' });
    await h.both(owner5, 'notifCount', [], { label: 'notifCount @chủ c5 đã mất tài khoản' });
    await h.both(owner5, 'logout', [], { label: 'logout @chủ c5 đã mất tài khoản (audit gắn công ty đã xoá)' });
    await h.both(S.anon, 'login', ['dx_c5_admin', 'Owner@123'], { label: 'login chủ công ty đã xoá' });
    await D([made.c5], S.root, { label: 'deleteCongTy lần 2' });
    await h.rest(S.root, 'deleteCongTy', [made.c6], { label: 'deleteCongTy c6 qua REST' });
    await h.rpc(S.rootView, 'deleteCongTy', [made.c4], { label: 'deleteCongTy c4 (mã rỗng) @super xem A' });
    await h.rpc(viewB, 'deleteCongTy', [made.c3], { label: 'deleteCongTy c3 (có super dx_cu2) @super xem B' });
    for (const k of ['c2', 'c7', 'c9', 'c10', 'c11']) await h.rpc(S.root, 'deleteCongTy', [made[k]], { label: 'dọn ' + k });
    // công ty tạo được ngoài dự tính trong vòng "lỗi do database" (Postgres nhận hanDung là số / mảng 1 phần tử)
    const rest = await h.sql("select id::text id, code from companies where code like 'dx-e%' order by code");
    h.check('công ty dx-e* còn lại giống nhau ở 2 phía', rest.node.map((x) => x.code).join() === rest.go.map((x) => x.code).join(), rest.node.map((x) => x.code), rest.go.map((x) => x.code));
    for (let i = 0; i < Math.min(rest.node.length, rest.go.length); i++) await h.rpc(S.root, 'deleteCongTy', [h.pair(rest.node[i].id, rest.go[i].id)], { label: 'dọn ' + rest.node[i].code });
    await h.rpc(S.root, 'adminDeleteUser', [cu1], { label: 'dọn dx_cu1' });
    await h.rpc(S.root, 'adminDeleteUser', [cu3], { label: 'dọn dx_cu3' });
    await h.both(S.root, 'adminDeleteUser', [cu4], { label: 'dx_cu4 đã mất theo công ty c7' });
    await h.both(S.root, 'adminDeleteUser', [cu2], { label: 'dx_cu2 đã mất theo công ty c3' });
    await h.rpc(S.root, 'deleteCongTy', [c1], { label: 'dọn c1' });
    await h.both(S.root, 'listCongTy', [], { label: 'listCongTy @super sau khi dọn' });
    await h.both(S.root, 'getAuditLog', [200], { label: 'getAuditLog 200 @super sau companies' });
    // phiên của tài khoản thuộc công ty đã xoá hết hiệu lực sau khi bộ nhớ phiên (30 giây) hết hạn
    // DIFF_FAST=1 (chỉ dùng khi đang dò lỗi, chạy lọc từng kịch bản): bỏ bước chờ 31 giây này. Lần chạy đầy đủ KHÔNG đặt biến đó.
    if (process.env.DIFF_FAST === '1') { h.out('  bỏ   bước chờ 31 giây (DIFF_FAST=1)'); return; }
    await h.sleep(31000);
    await h.both(owner5, 'me', [], { label: 'me @chủ c5 sau 31 giây' });
  },
};
