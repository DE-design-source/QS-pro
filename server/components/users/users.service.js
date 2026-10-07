'use strict';
const bcrypt = require('bcryptjs');
const supa = require('../../libraries/supa');
const tenant = require('../../libraries/tenant');      // công ty đang làm việc (super có thể "xem như" 1 công ty)
const { userOut, getUserById } = require('./users.repository');
const { getCongTy } = require('../cong-ty/cong-ty.repository');
const { forgetSession_ } = require('../auth/session');
const { audit } = require('../thong-bao/audit');

/* ---------- Admin: quản lý tài khoản ---------- */
// Chưa chạy db/user_phong_ban.sql -> bỏ qua cột phong_ban, không chặn thao tác tài khoản
function phongBanColErr_(e) {
  var m = (e && e.message) || '';
  return /phong_ban/.test(m) && /(column|schema cache|PGRST204)/i.test(m);
}
function permsColErr_(e) {
  var m = (e && e.message) || '';
  if (/perms/.test(m) && /(column|schema cache)/i.test(m)) {
    return new Error('Chưa cài cột phân quyền. Vào Supabase → SQL Editor chạy:  alter table public.users add column if not exists perms text default \'\';  rồi thử lại.');
  }
  return e;
}
async function adminListUsers(actor) {
  // Super xem toàn hệ thống (kể cả tài khoản chưa gán công ty để còn sửa/xoá);
  // admin công ty chỉ xem tài khoản công ty mình.
  const opt = { order: 'created_at.asc', limit: 500 };
  if (actor && actor.r === 'super') opt.noScope = true;
  const rows = await supa.select('users', opt);
  return rows.map(userOut);
}
async function adminCreateUser(actor, data) {
  data = data || {};
  const username = String(data.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,}$/.test(username)) throw new Error('Tên đăng nhập ≥3 ký tự (chữ thường, số, . _ -)');
  if (String(data.password || '').length < 4) throw new Error('Mật khẩu tối thiểu 4 ký tự');
  // Công ty của tài khoản mới: super có thể chỉ định, còn lại = công ty của người tạo
  // Công ty của tài khoản mới, theo thứ tự:
  //   1. super chọn tay trong form
  //   2. công ty super ĐANG xem (viewAs) — đang làm việc trong công ty nào thì tạo cho công ty đó
  //   3. công ty của chính người tạo
  const ctId = (actor.r === 'super' && data.congTyId) ? data.congTyId
             : (tenant.tenantId() || actor.ct || null);
  // Không cho tạo tài khoản "lạc" — không thuộc công ty nào thì không đăng nhập được
  // và cũng không hiện trong danh sách tài khoản của công ty.
  if (!ctId) throw new Error('Tài khoản của bạn chưa gắn với công ty nào nên chưa tạo được tài khoản mới — chọn một công ty ở tab Công ty rồi thử lại.');
  // Tên đăng nhập phải DUY NHẤT TOÀN HỆ THỐNG: lúc đăng nhập chưa biết công ty nào,
  // nên hai công ty trùng username sẽ khiến đăng nhập chọn nhầm tài khoản.
  const dupRows = await supa.select('users', { filter: supa.eq('username', username), limit: 1, noScope: true });
  if (dupRows.length) throw new Error('Tên đăng nhập "' + username + '" đã có người dùng — chọn tên khác');
  // Không vượt số user của gói dịch vụ
  if (ctId) {
    const ct = await getCongTy(ctId);
    if (ct && ct.gioiHanUser > 0) {
      const cur = await supa.select('users', { select: 'id', filter: supa.eq('cong_ty_id', ctId), limit: 1000, noScope: true });
      if (cur.length >= ct.gioiHanUser)
        throw new Error('Đã đạt giới hạn ' + ct.gioiHanUser + ' tài khoản của gói. Liên hệ để nâng gói.');
    }
  }
  // Chỉ super mới tạo được super admin
  const role = data.role === 'super' ? (actor.r === 'super' ? 'super' : 'staff')
             : (data.role === 'admin' ? 'admin' : 'staff');
  const perms = (role === 'admin' || role === 'super') ? '' : (Array.isArray(data.perms) ? data.perms.join(',') : '');
  const row = { username: username, ho_ten: String(data.hoTen || ''), email: String(data.email || ''),
    password_hash: bcrypt.hashSync(String(data.password), 10), role: role, perms: perms, active: true, cong_ty_id: ctId };
  if (String(data.phongBan || '').trim()) row.phong_ban = String(data.phongBan).trim();
  let res;
  try { res = await supa.insert('users', row, { noScope: true }); }
  catch (e) {
    if (phongBanColErr_(e)) { delete row.phong_ban; res = await supa.insert('users', row, { noScope: true }); }
    else throw permsColErr_(e);
  }
  await audit(actor, 'create_user', 'Tạo tài khoản ' + username + ' (' + role + ')');
  return userOut(res[0]);
}
// Tài khoản đích phải thuộc công ty đang quản lý; chỉ super đụng được tài khoản super.
async function targetUser_(actor, id) {
  const u = await getUserById(id);
  if (!u) throw new Error('Không tìm thấy tài khoản');
  if (actor.r !== 'super') {
    if (u.role === 'super' || String(u.cong_ty_id || '') !== String(tenant.tenantId() || '')) throw new Error('Không tìm thấy tài khoản');
  }
  return u;
}
// Không để công ty mất admin đang hoạt động cuối cùng
async function keepLastAdmin_(u) {
  if (u.role !== 'admin' || u.active === false) return;
  const admins = await supa.select('users', { select: 'id',
    filter: 'role=eq.admin&active=eq.true&' + (u.cong_ty_id ? supa.eq('cong_ty_id', u.cong_ty_id) : 'cong_ty_id=is.null'),
    limit: 2, noScope: true });
  if (admins.length <= 1) throw new Error('Phải còn ít nhất 1 admin đang hoạt động');
}
async function adminUpdateUser(actor, id, fields) {
  fields = fields || {};
  const u = await targetUser_(actor, id);
  const patch = {};
  if (fields.hasOwnProperty('hoTen')) patch.ho_ten = String(fields.hoTen || '');
  if (fields.hasOwnProperty('role')) {
    // 'super' chỉ super giữ/gán được; trước đây form gửi 'super' bị hạ thành 'staff'
    patch.role = fields.role === 'super' ? (actor.r === 'super' ? 'super' : u.role)
               : (fields.role === 'admin' ? 'admin' : 'staff');
    if (patch.role !== 'admin' && patch.role !== 'super') await keepLastAdmin_(u);
  }
  if (fields.hasOwnProperty('perms')) patch.perms = Array.isArray(fields.perms) ? fields.perms.join(',') : '';
  if (fields.hasOwnProperty('phongBan')) patch.phong_ban = String(fields.phongBan || '').trim();
  // Chỉ super được chuyển tài khoản sang công ty khác (dùng để sửa tài khoản chưa gán công ty)
  if (fields.hasOwnProperty('congTyId') && actor.r === 'super') patch.cong_ty_id = fields.congTyId || null;
  // Admin thì bỏ giới hạn perms
  if (patch.role === 'admin') patch.perms = '';
  if (!Object.keys(patch).length) return { ok: true };
  let res;
  try { res = await supa.update('users', supa.eq('id', id), patch, { noScope: true }); }
  catch (e) {
    if (phongBanColErr_(e)) { delete patch.phong_ban; res = await supa.update('users', supa.eq('id', id), patch, { noScope: true }); }
    else throw permsColErr_(e);
  }
  forgetSession_(id);
  await audit(actor, 'update_user', 'Sửa tài khoản ' + (res[0] && res[0].username) + ' ' + JSON.stringify(patch));
  return res[0] ? userOut(res[0]) : { ok: true };
}
async function adminSetPassword(actor, id, newPassword) {
  if (String(newPassword || '').length < 4) throw new Error('Mật khẩu tối thiểu 4 ký tự');
  const u = await targetUser_(actor, id);
  await supa.update('users', supa.eq('id', id), { password_hash: bcrypt.hashSync(String(newPassword), 10) }, { noScope: true });
  await audit(actor, 'reset_password', 'Đặt lại mật khẩu cho ' + u.username);
  return { ok: true };
}
async function adminSetActive(actor, id, active) {
  const u = await targetUser_(actor, id);
  if (!active) await keepLastAdmin_(u);
  await supa.update('users', supa.eq('id', id), { active: !!active }, { noScope: true });
  forgetSession_(id);
  await audit(actor, active ? 'unlock_user' : 'lock_user', (active ? 'Mở khóa ' : 'Khóa ') + u.username);
  return { ok: true };
}
async function adminDeleteUser(actor, id) {
  const u = await targetUser_(actor, id);
  if (u.id === actor.uid) throw new Error('Không thể tự xóa tài khoản đang đăng nhập');
  await keepLastAdmin_(u);
  await supa.remove('users', supa.eq('id', id), { noScope: true });
  forgetSession_(id);
  await audit(actor, 'delete_user', 'Xóa tài khoản ' + u.username);
  return { ok: true };
}

module.exports = { adminListUsers, adminCreateUser, adminUpdateUser, adminSetPassword, adminSetActive, adminDeleteUser };
