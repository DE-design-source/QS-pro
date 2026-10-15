'use strict';
/* Dữ liệu dùng chung của vùng 1 (auth, users, companies, notifications). Dựng MỘT lần cho cả lần chạy.
   Chỉ 3 tài khoản mồi phải chèn bằng SQL (giống hệt nhau ở 2 database, id cố định): không có đường API nào tạo được
   super đầu tiên, tài khoản mật khẩu chữ thường và tài khoản không thuộc công ty nào. Mọi thứ khác tạo qua API. */
const bcrypt = require('bcryptjs');
const PW = { root: 'Root@1234', admin: 'Admin@123', staff: 'Staff@123' };
const ID = { root: '00000000-0000-4000-8000-0000000000a1', plain: '00000000-0000-4000-8000-0000000000a2', plain2: '00000000-0000-4000-8000-0000000000a3', orphan: '00000000-0000-4000-8000-0000000000a4' };

async function fx(h) {
  if (h.state.area1) return h.state.area1;
  const dezon = (await h.sql("select id::text id from companies where code = 'dezon'")).node[0].id;
  const bird = (await h.sql("select id::text id from companies where code = 'b-123'")).node[0].id;   // seed: đã hết hạn 2026-09-10
  const hash = bcrypt.hashSync(PW.root, 10), hashO = bcrypt.hashSync(PW.staff, 10);
  await h.sql("insert into users (id, username, full_name, password_hash, role, is_active, company_id, created_at) values ($1, 'dx_root', 'DX Root', $2, 'super', true, null, now()), ($3, 'dx_plain', 'DX chữ thường', 'plain-pw-1', 'staff', true, $7, now() + interval '1 ms'), ($4, 'dx_plain2', 'DX chữ thường 2', 'plain-pw-2', 'staff', true, $7, now() + interval '2 ms'), ($5, 'dx_orphan', 'DX mồ côi', $6, 'staff', true, null, now() + interval '3 ms')",
    [ID.root, hash, ID.plain, ID.plain2, ID.orphan, hashO, dezon]);
  const f = { PW, ID, dezon, bird, S: {} };
  const S = f.S;
  S.anon = h.anon;
  S.root = await h.login('super', 'dx_root', PW.root);
  // 2 công ty + chủ công ty, tạo qua API
  let r = await h.rpc(S.root, 'createCongTy', [{ ten: 'DX Công ty A', ma: 'dx-a', gioiHanUser: 8, email: 'a@dx.test', sdt: '0901', tinhNang: ['boc', 'sanpham'], adminUser: 'dx_a_admin', adminPass: PW.admin, adminHoTen: 'Chủ A' }]);
  f.ctA = r.val('result.id');
  r = await h.rpc(S.root, 'createCongTy', [{ ten: 'DX Công ty B', ma: 'dx-b', gioiHanUser: 5, adminUser: 'dx_b_admin', adminPass: PW.admin }]);
  f.ctB = r.val('result.id');
  r = await h.rpc(S.root, 'createCongTyUser', [f.ctA, { username: 'dx_a_staff', password: PW.staff, hoTen: 'NV A', perms: ['boc', 'sanpham', 'sp_edit'], email: 'dx_a.staff@dx.test', phongBan: ' QS ' }]);
  f.staffId = r.val('result.id');
  r = await h.rpc(S.root, 'createCongTyUser', [f.ctA, { username: 'dx_a_staff0', password: PW.staff, hoTen: 'NV A không quyền' }]);
  f.staff0Id = r.val('result.id');
  S.adminA = await h.login('admin A', 'dx_a_admin', PW.admin);
  S.adminB = await h.login('admin B', 'dx_b_admin', PW.admin);
  S.staff = await h.login('staff A có perms', 'dx_a_staff', PW.staff);
  S.staff0 = await h.login('staff A không perms', 'dx_a_staff0', PW.staff);
  S.rootView = h.with(S.root, { label: 'super xem công ty A', view: f.ctA });
  f.adminAId = S.adminA.uid; f.adminBId = S.adminB.uid;
  // Thứ tự dùng cho ma trận quyền
  f.all = [S.anon, S.staff0, S.staff, S.adminA, S.adminB, S.root, S.rootView];
  h.state.area1 = f;
  return f;
}
module.exports = { fx, PW, ID };
