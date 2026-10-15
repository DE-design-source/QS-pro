'use strict';
/* Module users: adminListUsers, adminCreateUser, adminUpdateUser, adminSetPassword, adminSetActive, adminDeleteUser, getAuditLog
   (server/auth.js 311-447). */
const { fx, PW, ID } = require('./_fx');

module.exports = {
  name: 'area1/03 users',
  async run(h) {
    const f = await fx(h), S = f.S;
    const NOID = '00000000-0000-4000-8000-00000000dead';
    const badIds = [NOID, 'khong-phai-uuid', '', null, 0, 12345, true, {}, [], ['x'], 'a b', "x' or 1=1--", '(1,2)', 'null'];
    const viewB = h.with(S.root, { view: f.ctB, label: 'super xem công ty B' });

    /* ================= adminListUsers ================= */
    for (const s of f.all.concat([viewB])) await h.both(s, 'adminListUsers', []);
    await h.both(S.adminA, 'adminListUsers', ['thừa', { x: 1 }]);

    /* ================= adminCreateUser ================= */
    const C = (data, s, opts) => h.both(s || S.adminA, 'adminCreateUser', data === undefined ? [] : [data], opts);
    // lỗi kiểm tra đầu vào (không ghi gì) -> gọi cả rpc lẫn REST
    for (const d of [undefined, null, 'chuỗi', 123, [], {}, { username: 'ab', password: PW.staff }, { username: 'a b c', password: PW.staff }, { username: 'tên_có_dấu', password: PW.staff }, { username: 'abc!', password: PW.staff },
      { username: 'abc', password: 'abc' }, { username: 'abc' }, { username: 'abc', password: null }, { username: 'abc', password: 123 }, { username: 'abc', password: '😀a' }, { password: PW.staff }, { username: null, password: PW.staff },
      { username: '', password: PW.staff }, { username: '   ', password: PW.staff }, { username: { a: 1 }, password: PW.staff }, { username: ['ab'], password: PW.staff }, { username: 'a@b.c', password: PW.staff }, { username: 'abc\n', password: PW.staff + '1' },
      { username: 'dx_a_admin', password: PW.staff }, { username: ' DX_A_ADMIN ', password: PW.staff }, { username: 'dx_b_admin', password: PW.staff }, { username: 'dx_root', password: PW.staff }, { username: 'mai', password: PW.staff }]) await C(d);
    for (const s of [S.anon, S.staff0, S.staff]) await C({ username: 'dx_khong_quyen', password: PW.staff }, s);
    // tạo thật: mỗi biến thể một tài khoản, xen kẽ rpc / REST
    const made = {};
    const mk = async (via, s, data, label) => { const r = await h[via](s, 'adminCreateUser', [data], label ? { label } : undefined); made[data.username] = r && r.val('result.id'); return r; };
    // giới hạn số tài khoản của gói (công ty A đang có 3 tài khoản)
    await h.rpc(S.root, 'updateCongTy', [f.ctA, { gioiHanUser: 3 }]);
    await C({ username: 'dx_u8', password: PW.staff }, S.adminA, { label: 'adminCreateUser khi công ty A đã chạm giới hạn 3' });
    await C({ username: 'dx_u8', password: PW.staff, congTyId: f.ctA }, S.root, { label: 'adminCreateUser @super khi công ty A đã chạm giới hạn 3' });
    await h.rpc(S.root, 'updateCongTy', [f.ctA, { gioiHanUser: 2 }]);
    await C({ username: 'dx_u8', password: PW.staff }, S.adminA, { label: 'adminCreateUser khi số tài khoản đã vượt giới hạn 2' });
    await h.rpc(S.root, 'updateCongTy', [f.ctA, { gioiHanUser: 0 }], { label: 'giới hạn 0 = không giới hạn' });
    await mk('rpc', S.adminA, { username: 'dx_u8', password: PW.staff });
    await h.rpc(S.root, 'updateCongTy', [f.ctA, { gioiHanUser: 40 }]);
    await mk('rpc', S.adminA, { username: 'dx_u1', password: PW.staff });
    await mk('rest', S.adminA, { username: 'dx_u2', password: PW.staff, hoTen: 'Qua REST', email: 'u2@dx.test', phongBan: 'Kỹ thuật', perms: ['boc', 'duan'] });
    await mk('rpc', S.adminA, { username: '  DX_U3.Ten-x  ', password: 1234, hoTen: 123, email: 456, phongBan: '   ', perms: 'boc,duan', role: 'staff' });
    await mk('rpc', S.adminA, { username: 'dx_u4', password: PW.staff, role: 'admin', perms: ['boc'], phongBan: '  Có khoảng trắng  ' });
    await mk('rest', S.adminA, { username: 'dx_u5', password: PW.staff, role: 'super', perms: ['boc', 'sp_duyet', 'boc', ''], hoTen: null, email: null });        // admin không tạo được super -> staff
    await mk('rpc', S.adminA, { username: 'dx_u6', password: PW.staff, role: 'ADMIN', perms: [1, null, { a: 1 }, ['x', 'y'], true], congTyId: f.ctB, active: false, id: NOID, cong_ty_id: f.ctB });   // admin không chỉ định được công ty
    await mk('rpc', S.adminA, { username: 123456, password: PW.staff, hoTen: { a: 1 }, perms: [] });
    await mk('rpc', S.adminA, { username: 'dx_u7', password: '😀😀', perms: null, phongBan: 0, role: null });
    await C({ username: 'dx_u1', password: PW.staff }, S.adminB, { label: 'adminCreateUser trùng username ở công ty khác' });
    // super: chỉ định công ty, đang xem công ty, không có công ty
    await C({ username: 'dx_s0', password: PW.staff }, S.root, { label: 'adminCreateUser @super không công ty, không chỉ định' });
    await mk('rpc', S.root, { username: 'dx_s1', password: PW.staff, congTyId: f.ctB, role: 'super', perms: ['boc'] });
    await mk('rest', S.root, { username: 'dx_s2', password: PW.staff, congTyId: f.ctB, role: 'admin' });
    await mk('rpc', S.rootView, { username: 'dx_s3', password: PW.staff, role: 'staff', perms: ['muahang'] }, 'adminCreateUser @super xem công ty A (không chỉ định)');
    await mk('rpc', S.rootView, { username: 'dx_s4', password: PW.staff, congTyId: f.ctB }, 'adminCreateUser @super xem công ty A, chỉ định công ty B');
    await mk('rest', viewB, { username: 'dx_s5', password: PW.staff, congTyId: '' }, 'adminCreateUser @super xem công ty B, congTyId rỗng');
    await C({ username: 'dx_s6', password: PW.staff, congTyId: NOID }, S.root, { label: 'adminCreateUser @super, công ty không tồn tại (lỗi khoá ngoại)' });
    await C({ username: 'dx_s6', password: PW.staff, congTyId: 'khong-phai-uuid' }, S.root, { label: 'adminCreateUser @super, congTyId không phải uuid' });
    await C({ username: 'dx_s6', password: PW.staff, congTyId: 12345 }, S.root, { label: 'adminCreateUser @super, congTyId là số' });
    await C({ username: 'dx_s6', password: PW.staff, congTyId: { a: 1 } }, S.root, { label: 'adminCreateUser @super, congTyId là object' });
    await C({ username: 'dx_s6', password: PW.staff }, h.with(S.root, { view: NOID, label: 'super xem công ty không tồn tại' }));
    await C({ username: 'dx_s6', password: PW.staff }, h.with(S.root, { view: 'rac', label: 'super, x-view-company rác' }));
    await h.both(S.root, 'adminListUsers', [], { label: 'adminListUsers @super sau khi tạo' });
    await h.both(S.adminA, 'adminListUsers', [], { label: 'adminListUsers @admin A sau khi tạo' });
    for (const u of ['dx_u3.ten-x', '123456', 'dx_u7', 'dx_s1']) await h.rpc(S.anon, 'login', [u, u === 'dx_u3.ten-x' ? '1234' : u === 'dx_u7' ? '😀😀' : PW.staff], { label: 'login tài khoản vừa tạo ' + u });
    const s1 = await h.login('super thứ hai (thuộc công ty B)', 'dx_s1', PW.staff);
    // super được miễn kiểm tra công ty: công ty bị khoá / hết hạn vẫn đăng nhập và dùng được
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { active: false, hanDung: '2020-02-02' }]);
    await h.both(S.anon, 'login', ['dx_s1', PW.staff], { label: 'login super thuộc công ty bị khoá + hết hạn' });
    await h.rpc(S.root, 'adminUpdateUser', [made.dx_s1, { hoTen: 'Super của B' }], { label: 'quên phiên dx_s1' });
    await h.both(s1, 'me', [], { label: 'me @super thuộc công ty bị khoá' });
    await h.both(s1, 'listCongTy', [], { label: 'listCongTy @super thuộc công ty bị khoá' });
    await h.rpc(S.root, 'updateCongTy', [f.ctB, { active: true, hanDung: '' }]);

    /* ================= adminUpdateUser ================= */
    const U = (id, fields, s, opts) => h.both(s || S.adminA, 'adminUpdateUser', fields === undefined ? [id] : [id, fields], opts);
    const u1 = made.dx_u1, u2 = made.dx_u2, u4 = made.dx_u4;
    for (const id of badIds) { await U(id, { hoTen: 'x' }); await U(id, { hoTen: 'x' }, S.root); }
    await h.both(S.adminA, 'adminUpdateUser', []);
    for (const s of [S.anon, S.staff0, S.staff]) await U(u1, { hoTen: 'không quyền' }, s);
    await U(u1, { hoTen: 'công ty khác' }, S.adminB, { label: 'adminUpdateUser tài khoản công ty khác @admin B' });
    await U(ID.root, { hoTen: 'đụng super' }, S.adminA, { label: 'adminUpdateUser tài khoản super @admin A' });
    await U(made.dx_s1, { hoTen: 'đụng super cùng công ty' }, S.adminB, { label: 'adminUpdateUser super thuộc công ty B @admin B' });
    await U(ID.orphan, { hoTen: 'mồ côi' }, S.adminA, { label: 'adminUpdateUser tài khoản không công ty @admin A' });
    for (const fl of [undefined, null, {}, 'chuỗi', 5, [], ['hoTen'], { khac: 1 }, { hasOwnProperty: 1 }, { hasOwnProperty: 1, hoTen: 'x' }, { congTyId: f.ctB }, { congTyId: null }, { username: 'doi_ten', password: 'x', active: false, id: NOID }]) await U(u1, fl);
    for (const fl of [{ hoTen: 'Tên mới' }, { hoTen: null }, { hoTen: 0 }, { hoTen: ['a', 'b'] }, { hoTen: 'Có "nháy" \\ và \n xuống dòng 😀' }, { perms: ['boc', 'duan'] }, { perms: 'boc' }, { perms: null }, { perms: [] }, { perms: [1, null, ['a', 'b'], { x: 1 }] },
      { phongBan: '  Phòng QS  ' }, { phongBan: null }, { phongBan: 0 }, { phongBan: 12 }, { role: 'staff' }, { role: 'xyz' }, { role: null }, { role: 'super' }, { role: 'admin', perms: ['boc'], hoTen: 'Lên admin' }, { perms: ['duan'] }, { role: 'super' },
      { role: 'staff', perms: ['a', 'b'], phongBan: 'P', hoTen: 'Đủ trường', congTyId: f.ctB }, { hoTen: undefined }]) await U(u1, fl);
    await h.both(S.adminA, 'adminUpdateUser', [u1, { hoTen: 'thừa tham số' }, { role: 'admin' }, 1]);
    // admin cuối cùng: công ty B có dx_b_admin + dx_s2 (admin) + dx_s1 (super)
    await U(made.dx_s2, { role: 'staff' }, S.adminB, { label: 'hạ quyền 1 trong 2 admin của B' });
    await U(f.adminBId, { role: 'staff' }, S.adminB, { label: 'hạ quyền admin cuối cùng của B (tự hạ)' });
    await U(f.adminBId, { role: 'xyz', hoTen: 'x' }, S.root, { label: 'hạ quyền admin cuối cùng của B @super' });
    await U(f.adminBId, { role: 'admin' }, S.adminB, { label: 'admin cuối cùng giữ nguyên admin' });
    await U(f.adminBId, { role: 'super' }, S.adminB, { label: 'admin tự nâng super (giữ vai trò cũ)' });
    // super: nâng super, tài khoản đang là super luôn giữ super, chuyển công ty
    await U(made.dx_s2, { role: 'super' }, S.root, { label: 'super nâng tài khoản lên super' });
    await U(made.dx_s2, { role: 'staff', hoTen: 'vẫn super' }, S.root, { label: 'tài khoản đang super: role staff bị bỏ qua' });
    await U(made.dx_s2, { role: 'admin', perms: ['boc'] }, s1, { label: 'super khác sửa super: giữ super, perms giữ' });
    await U(u2, { congTyId: f.ctB }, S.root, { label: 'super chuyển tài khoản sang công ty B' });
    await U(u2, { hoTen: 'đã sang B' }, S.adminA, { label: 'admin A không còn thấy tài khoản đã chuyển' });
    await U(u2, { congTyId: null }, S.root, { label: 'super gỡ công ty (congTyId null)' });
    await U(u2, { congTyId: '' }, S.root);
    await U(u2, { congTyId: 0 }, S.root);
    await U(u2, { congTyId: NOID }, S.root, { label: 'super chuyển sang công ty không tồn tại' });
    await U(u2, { congTyId: 'rac' }, S.root);
    await U(u2, { congTyId: f.ctA, role: 'admin', perms: ['x'], phongBan: ' về A ' }, S.root, { label: 'super chuyển về A + lên admin' });
    await U(u2, { hoTen: 'qua view' }, S.rootView);
    await U(u2, { hoTen: 'qua view B (super không bị giới hạn công ty)' }, viewB);
    await h.both(S.root, 'adminUpdateUser', [ID.root, { hoTen: 'DX Root (tự sửa)', role: 'staff' }], { label: 'super tự sửa mình: giữ super' });
    await h.both(S.root, 'me', []);

    /* [khoảng trống B.low: auth.js:373-378 nhánh cong_ty_id=is.null] keepLastAdmin_ với admin KHÔNG thuộc công ty nào: hạ quyền / khoá / xoá
       admin không công ty duy nhất bị chặn; khi có admin không công ty thứ hai thì được. Tài khoản tạo trong công ty A rồi super gỡ công ty. */
    const k1 = (await h.rpc(S.root, 'adminCreateUser', [{ username: 'dx_k1', password: PW.staff, congTyId: f.ctA, hoTen: 'Admin mồ côi 1' }])).val('result.id');
    const k2 = (await h.rpc(S.root, 'adminCreateUser', [{ username: 'dx_k2', password: PW.staff, congTyId: f.ctA, hoTen: 'Admin mồ côi 2' }])).val('result.id');
    await h.rpc(S.root, 'adminUpdateUser', [k1, { congTyId: null, role: 'admin' }], { label: 'dx_k1 thành admin không công ty' });
    await U(k1, { role: 'staff' }, S.root, { label: 'hạ quyền admin không công ty duy nhất @super (bị chặn)' });
    await U(k1, { role: 'xyz', hoTen: 'x' }, S.root, { label: 'hạ quyền (role lạ) admin không công ty duy nhất @super (bị chặn)' });
    await U(k1, { role: 'admin', hoTen: 'vẫn admin' }, S.root, { label: 'admin không công ty duy nhất giữ admin (được)' });
    await U(k1, { role: 'staff' }, S.adminA, { label: 'admin A không thấy admin không công ty' });
    await h.both(S.root, 'adminSetActive', [k1, false], { label: 'khoá admin không công ty duy nhất @super (bị chặn)' });
    await h.both(S.root, 'adminDeleteUser', [k1], { label: 'xoá admin không công ty duy nhất @super (bị chặn)' });
    await h.rpc(S.root, 'adminUpdateUser', [k2, { congTyId: '', role: 'admin' }], { label: 'dx_k2 thành admin không công ty thứ hai' });
    await h.rpc(S.root, 'adminUpdateUser', [k1, { role: 'staff' }], { label: 'hạ quyền dx_k1 khi còn admin không công ty khác (được)' });
    await h.rest(S.root, 'adminUpdateUser', [k1, { role: 'admin' }], { label: 'dx_k1 lên admin lại qua REST' });
    await h.rpc(S.root, 'adminSetActive', [k1, false], { label: 'khoá dx_k1 khi còn admin không công ty khác (được)' });
    await h.both(S.root, 'adminSetActive', [k2, false], { label: 'khoá dx_k2: admin không công ty đang hoạt động cuối cùng (bị chặn)' });
    await h.both(S.root, 'adminDeleteUser', [k2], { label: 'xoá dx_k2: admin không công ty đang hoạt động cuối cùng (bị chặn)' });
    await h.rest(S.root, 'adminSetActive', [k1, true], { label: 'mở lại dx_k1 qua REST' });
    await h.rest(S.root, 'adminDeleteUser', [k1], { label: 'xoá dx_k1 khi còn admin không công ty khác (được)' });
    await U(k2, { congTyId: f.ctA, role: 'staff' }, S.root, { label: 'chuyển về A kèm hạ quyền: kiểm admin cuối theo công ty CŨ (null) -> bị chặn' });
    await h.rpc(S.root, 'adminUpdateUser', [k2, { congTyId: f.ctA }], { label: 'dx_k2 về công ty A (vẫn admin)' });
    await h.rpc(S.root, 'adminUpdateUser', [k2, { role: 'staff' }], { label: 'hạ quyền dx_k2 trong công ty A (còn admin khác)' });
    await h.rpc(S.root, 'adminDeleteUser', [k2], { label: 'dọn dx_k2' });

    /* ================= adminSetPassword ================= */
    const SP = (args, s, opts) => h.both(s || S.adminA, 'adminSetPassword', args, opts);
    for (const a of [[], [u1], [u1, null], [u1, ''], [u1, 'abc'], [u1, 123], [u1, false], [u1, {}], [u1, ['a', 'b']], [NOID, 'abcd'], ['rac', 'abcd'], [null, 'abcd'], [NOID, 'abc'], [ID.root, 'abcd1234'], [f.adminBId, 'abcd1234'], [ID.orphan, 'abcd1234']]) await SP(a);
    for (const s of [S.anon, S.staff0, S.staff, S.adminB]) await SP([u1, 'Khong@123'], s);
    await h.rpc(S.adminA, 'adminSetPassword', [u1, 'Moi@1234', 'thừa']);
    await h.both(S.anon, 'login', ['dx_u1', 'Moi@1234']);
    await h.rest(S.adminA, 'adminSetPassword', [u1, 12345]);
    await h.both(S.anon, 'login', ['dx_u1', '12345']);
    await h.rpc(S.root, 'adminSetPassword', [u1, 'abcd']);
    await h.rpc(S.rootView, 'adminSetPassword', [f.adminBId, PW.admin], { label: 'super đang xem A đặt mật khẩu cho admin B' });
    await h.rpc(S.adminA, 'adminSetPassword', [f.adminAId, PW.admin], { label: 'admin tự đặt lại mật khẩu mình' });
    await h.rpc(S.root, 'adminSetPassword', [ID.orphan, PW.staff]);

    /* ================= adminSetActive ================= */
    const A = (args, s, opts) => h.both(s || S.adminA, 'adminSetActive', args, opts);
    for (const a of [[], [null, true], [NOID, false], ['rac', true], [ID.root, false], [f.adminBId, false], [ID.orphan, false]]) await A(a);
    for (const s of [S.anon, S.staff0, S.staff, S.adminB]) await A([u1, false], s);
    for (const v of [false, true, 0, 1, '', 'no', 'false', null, {}, [], 'x']) await A([u1, v], S.adminA, { label: 'adminSetActive u1 = ' + JSON.stringify(v) });
    await A([u1], S.adminA, { label: 'adminSetActive thiếu active (= khoá)' });
    await h.both(S.anon, 'login', ['dx_u1', 'abcd'], { label: 'login tài khoản đang khoá' });
    await A([u1, true, 'thừa']);
    // admin cuối cùng: A có dx_a_admin + dx_u4 + dx_u2 (admin)
    await A([u4, false], S.adminA, { label: 'khoá admin thứ 2 của A' });
    await A([u2, false], S.adminA, { label: 'khoá admin thứ 3 của A' });
    await A([f.adminAId, false], S.adminA, { label: 'tự khoá admin cuối cùng đang hoạt động' });
    await A([f.adminAId, false], S.root, { label: 'super khoá admin cuối cùng của A' });
    await A([u4, false], S.adminA, { label: 'khoá lại admin đã khoá (không tính là admin hoạt động)' });
    await A([u4, true]);
    await A([f.adminAId, false], S.root, { label: 'super khoá dx_a_admin khi còn admin khác' });
    await h.both(S.adminA, 'me', [], { label: 'me @admin A vừa bị khoá' });
    await A([f.adminAId, true], S.root);
    await h.both(S.adminA, 'me', [], { label: 'me @admin A được mở lại' });
    await A([made.dx_s2, false], S.root, { label: 'super khoá super khác' });
    await A([made.dx_s2, true], viewB);

    /* ================= adminDeleteUser ================= */
    const D = (args, s, opts) => h.both(s || S.adminA, 'adminDeleteUser', args, opts);
    for (const id of badIds) await D([id]);
    await D([]);
    for (const s of [S.anon, S.staff0, S.staff, S.adminB]) await D([u1], s);
    await D([f.adminAId], S.adminA, { label: 'tự xoá tài khoản đang đăng nhập' });
    await D([ID.root], S.root, { label: 'super tự xoá' });
    await D([ID.root], S.adminA, { label: 'admin xoá super' });
    await D([f.adminBId], S.adminA, { label: 'admin A xoá admin B' });
    await D([f.adminBId], S.root, { label: 'super xoá admin cuối cùng của B' });
    await h.rpc(S.adminA, 'adminSetActive', [u2, false]);
    await h.rpc(S.adminA, 'adminSetActive', [u4, false]);
    await D([u4], S.adminA, { label: 'xoá admin đang bị khoá (không kiểm admin cuối)' });
    await h.rpc(S.adminA, 'adminSetActive', [u2, true]);
    await h.rpc(S.adminA, 'adminDeleteUser', [u1, 'thừa'], { label: 'xoá u1 qua rpc' });
    await D([u1], S.adminA, { label: 'xoá lại tài khoản đã xoá' });
    await h.rest(S.adminA, 'adminDeleteUser', [made.dx_u5], { label: 'xoá u5 qua REST' });
    await h.rpc(S.adminA, 'adminDeleteUser', [u2], { label: 'xoá admin khi còn admin khác' });
    await h.rpc(S.rootView, 'adminDeleteUser', [made.dx_s4], { label: 'super đang xem A xoá tài khoản của B' });
    await h.rest(S.root, 'adminDeleteUser', [made.dx_s2], { label: 'super xoá super khác qua REST' });
    await h.rpc(s1, 'adminDeleteUser', [made.dx_s5], { label: 'super thuộc công ty B xoá tài khoản của B' });
    await h.rpc(S.root, 'adminDeleteUser', [ID.plain2], { label: 'super xoá tài khoản seed mồi' });
    // tài khoản đã có thông báo / nhật ký: xoá vẫn được (khoá ngoại ON DELETE)
    await h.rpc(S.staff, 'logClientError', [{ tab: 'x', msg: 'trước khi bị xoá' }]);
    for (const n of ['dx_u3.ten-x', '123456', 'dx_u6', 'dx_u7', 'dx_u8', 'dx_s3']) await h.rpc(S.root, 'adminDeleteUser', [made[n === 'dx_u3.ten-x' ? '  DX_U3.Ten-x  ' : n]], { label: 'dọn ' + n });
    const abc = await h.sql("select id::text id from users where username = 'abc'");     // tạo được từ {username: 'abc\n'} (trim)
    h.check("tài khoản 'abc' (username có xuống dòng cuối) có ở cả 2 phía", abc.node.length === 1 && abc.go.length === 1, abc.node.length, abc.go.length);
    if (abc.node[0] && abc.go[0]) await h.rpc(S.root, 'adminDeleteUser', [h.pair(abc.node[0].id, abc.go[0].id)], { label: 'dọn abc' });
    await h.rpc(S.root, 'adminDeleteUser', [made.dx_s1], { label: 'dọn dx_s1 (super)' });
    await h.both(s1, 'me', [], { label: 'me @super vừa bị xoá' });
    await h.both(S.root, 'adminListUsers', [], { label: 'adminListUsers @super sau khi dọn' });

    /* [khoảng trống B.low: trần kết quả, auth.js:314 / 160 / 342] adminListUsers và listCongTyUsers trả tối đa 500 tài khoản; adminCreateUser đếm
       tài khoản của công ty để so giới hạn gói. 505 tài khoản của công ty B chèn bằng SQL (mỗi dòng cách nhau 1 ms: thứ tự created_at xác định),
       thử xong thì xoá. Mật khẩu là chuỗi không phải bcrypt nên không đăng nhập được. */
    await h.sql("insert into users (username, full_name, password_hash, role, is_active, company_id, created_at) select 'dx_tran_' || lpad(g::text, 3, '0'), 'Trần ' || g, 'x', 'staff', true, $1::uuid, now() + make_interval(secs => g * 0.001) from generate_series(1, 505) g", [f.ctB]);
    await h.both(S.adminB, 'adminListUsers', [], { label: 'adminListUsers @admin B khi công ty có hơn 500 tài khoản (trần 500)' });
    await h.both(viewB, 'adminListUsers', [], { label: 'adminListUsers @super xem B khi công ty có hơn 500 tài khoản' });
    await h.both(S.root, 'listCongTyUsers', [f.ctB], { label: 'listCongTyUsers công ty B có hơn 500 tài khoản (trần 500)' });
    await h.both(S.root, 'listCongTy', [], { label: 'listCongTy khi công ty B có hơn 500 tài khoản (số tài khoản từng công ty)' });
    await C({ username: 'dx_tran_them', password: PW.staff }, S.adminB, { label: 'adminCreateUser @admin B khi công ty đã vượt giới hạn gói (5) rất xa' });
    await h.sql("delete from users where username like 'dx\\_tran\\_%'");

    /* ================= getAuditLog ================= */
    for (const s of f.all.concat([viewB])) await h.both(s, 'getAuditLog', [15]);
    for (const l of [undefined, null, 0, 1, 3, '4', ' 5 ', 5.9, 0.4, -1, -5.5, '-2', 1000, 1001, 5000, 1e21, 'abc', '', true, false, [7], [1, 2], {}, '0x10', '1e1', 'Infinity', '-Infinity', NaN, -2147483649, -1e19])
      await h.both(S.adminA, 'getAuditLog', l === undefined ? [] : [l], { label: 'getAuditLog limit = ' + (typeof l === 'number' ? String(l) : JSON.stringify(l)) + ' @admin A' });
    await h.both(S.root, 'getAuditLog', [1000], { label: 'getAuditLog 1000 @super (toàn hệ thống)' });
    await h.both(S.rootView, 'getAuditLog', [1000], { label: 'getAuditLog 1000 @super xem A' });
    await h.both(S.adminB, 'getAuditLog', [1000, 'thừa'], { label: 'getAuditLog 1000 @admin B' });
  },
};
