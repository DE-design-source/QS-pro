'use strict';
const supa = require('../../libraries/supa');
const { hasShareCol_, ctOut_, getCongTy } = require('./cong-ty.repository');
const { userOut } = require('../users/users.repository');
const { adminCreateUser } = require('../users/users.service');
const { audit } = require('../thong-bao/audit');

// Danh sách công ty — chỉ SUPER ADMIN
async function listCongTy(actor) {
  if (actor.r !== 'super') throw new Error('Chỉ quản trị hệ thống mới xem được');
  const rows = await supa.select('cong_ty', { order: 'ngay_tao.desc', limit: 500, noScope: true });
  const users = await supa.select('users', { select: 'id,cong_ty_id,active', limit: 5000, noScope: true });
  return rows.map(function (r) {
    const o = ctOut_(r);
    o.soUser = users.filter(function (u) { return String(u.cong_ty_id) === String(r.id); }).length;
    return o;
  });
}
async function createCongTy(actor, data) {
  if (actor.r !== 'super') throw new Error('Chỉ quản trị hệ thống mới tạo được công ty');
  data = data || {};
  const ten = String(data.ten || '').trim();
  if (!ten) throw new Error('Chưa nhập tên công ty');
  const ma = String(data.ma || ten).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  const dup = await supa.select('cong_ty', { filter: supa.eq('ma', ma), limit: 1, noScope: true });
  if (dup.length) throw new Error('Mã công ty "' + ma + '" đã tồn tại');
  const row = { ten: ten, ma: ma, logo_url: String(data.logoUrl || ''),
    email: String(data.email || ''), sdt: String(data.sdt || ''),
    tinh_nang: Array.isArray(data.tinhNang) ? data.tinhNang.join(',') : String(data.tinhNang || ''),
    gioi_han_user: Number(data.gioiHanUser) || 10, active: data.active !== false,
    han_dung: data.hanDung || null, ghi_chu: String(data.ghiChu || '') };
  if (data.dungSpDezon === true) {
    if (!await hasShareCol_()) throw new Error('Chưa bật được kho SP chung: cơ sở dữ liệu thiếu cột dung_sp_dezon. Hãy chạy db/share_catalog.sql trong Supabase rồi thử lại.');
    row.dung_sp_dezon = true;
  }
  const adminUser = String(data.adminUser || '').trim().toLowerCase();
  if (adminUser && data.adminPass) {   // kiểm tra trước để không tạo công ty mồ côi
    const dup = await supa.select('users', { select: 'id', filter: supa.eq('username', adminUser), limit: 1, noScope: true });
    if (dup.length) throw new Error('Tên đăng nhập "' + adminUser + '" đã có người dùng — chọn tên khác');
  }
  const res = await supa.insert('cong_ty', row, { noScope: true });
  const ct = ctOut_(res[0]);
  // tạo luôn tài khoản chủ công ty (nếu có) — cùng kiểm tra như tạo user thường
  if (adminUser && data.adminPass) {
    await adminCreateUser(actor, { username: adminUser, password: data.adminPass, role: 'admin', congTyId: ct.id,
      hoTen: data.adminHoTen || 'Quản trị ' + ten, email: data.adminEmail || data.email || '' });
  }
  await audit(actor, 'create_company', 'Tạo công ty ' + ten);
  return ct;
}
// Danh sách user của 1 CÔNG TY — super admin xem/quản lý được mọi công ty
async function listCongTyUsers(actor, congTyId) {
  if (actor.r !== 'super') throw new Error('Chỉ quản trị hệ thống');
  const rows = await supa.select('users', {
    filter: supa.eq('cong_ty_id', congTyId), order: 'created_at.asc', limit: 500, noScope: true });
  return rows.map(userOut);
}
// Super admin tạo user cho MỘT công ty bất kỳ
async function createCongTyUser(actor, congTyId, data) {
  if (actor.r !== 'super') throw new Error('Chỉ quản trị hệ thống');
  data = Object.assign({}, data || {}, { congTyId: congTyId });
  return adminCreateUser(actor, data);
}
async function updateCongTy(actor, id, data) {
  // Super sửa mọi công ty; chủ công ty chỉ sửa CÔNG TY MÌNH và chỉ vài trường
  const isSuper = actor.r === 'super';
  if (!isSuper) {
    if (actor.r !== 'admin') throw new Error('Không có quyền');
    if (String(actor.ct || '') !== String(id)) throw new Error('Chỉ sửa được công ty của bạn');
  }
  data = data || {};
  const patch = {};
  if (data.ten != null) patch.ten = String(data.ten);
  if (data.logoUrl != null) patch.logo_url = String(data.logoUrl);
  if (data.mauChinh != null) patch.mau_chinh = String(data.mauChinh);
  if (data.email != null) patch.email = String(data.email);
  if (data.sdt != null) patch.sdt = String(data.sdt);
  if (isSuper) {   // chỉ super được đổi gói dịch vụ
    if (data.tinhNang != null) patch.tinh_nang = Array.isArray(data.tinhNang) ? data.tinhNang.join(',') : String(data.tinhNang);
    if (data.gioiHanUser != null) patch.gioi_han_user = Number(data.gioiHanUser) || 0;
    if (data.active != null) patch.active = !!data.active;
    if (data.dungSpDezon != null) {
      if (!await hasShareCol_()) { if (data.dungSpDezon) throw new Error('Chưa bật được kho SP chung: cơ sở dữ liệu thiếu cột dung_sp_dezon. Hãy chạy db/share_catalog.sql trong Supabase rồi thử lại.'); }
      else patch.dung_sp_dezon = !!data.dungSpDezon;
    }
    if (data.hanDung != null) patch.han_dung = data.hanDung || null;
    if (data.ghiChu != null) patch.ghi_chu = String(data.ghiChu);
  }
  if (!Object.keys(patch).length) return getCongTy(id);
  const res = await supa.update('cong_ty', supa.eq('id', id), patch, { noScope: true });
  await audit(actor, 'update_company', 'Cập nhật công ty ' + (patch.ten || id));
  return res[0] ? ctOut_(res[0]) : getCongTy(id);
}
async function deleteCongTy(actor, id) {
  if (actor.r !== 'super') throw new Error('Chỉ quản trị hệ thống mới xoá được công ty');
  const ct = await getCongTy(id);
  if (!ct) throw new Error('Không tìm thấy công ty');
  const f = 'cong_ty_id=eq.' + encodeURIComponent(id);
  const tables = Object.keys(supa.TENANT_TABLES).filter(function (t) { return t !== 'users'; }).concat('users');
  for (const t of tables) {
    try { await supa.remove(t, f, { noScope: true }); } catch (e) { /* bỏ qua bảng chưa có cột */ }
  }
  await supa.remove('cong_ty', supa.eq('id', id), { noScope: true });
  await audit(actor, 'delete_company', 'Xoá công ty ' + ct.ten + ' và toàn bộ dữ liệu');
  return { ok: true, ten: ct.ten };
}

module.exports = { listCongTy, createCongTy, listCongTyUsers, createCongTyUser, updateCongTy, deleteCongTy };
