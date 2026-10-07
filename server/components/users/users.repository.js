'use strict';
const supa = require('../../libraries/supa');

/* ---------- helpers ---------- */
function permsArr_(v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
function userOut(r) {
  return { id: r.id, username: r.username, hoTen: r.ho_ten || '', role: r.role || 'staff',
    perms: permsArr_(r.perms), active: r.active !== false, createdAt: r.created_at, lastLogin: r.last_login,
    congTyId: r.cong_ty_id || null, email: r.email || '', phongBan: r.phong_ban || '' };
}
async function getUsersByName_(username) {
  // Cho đăng nhập bằng TÊN ĐĂNG NHẬP hoặc EMAIL. noScope: lúc này chưa biết công ty.
  // Trả về TẤT CẢ dòng trùng tên: dữ liệu cũ có thể có 2 tài khoản cùng username
  // (1 dòng lạc không thuộc công ty nào) — lấy limit 1 sẽ chọn nhầm dòng và báo sai mật khẩu.
  const key = String(username || '').trim();
  if (!key) return [];
  let rows = await supa.select('users', { filter: supa.eq('username', key.toLowerCase()), limit: 20, noScope: true });
  if (rows.length) return rows;
  if (key.indexOf('@') > 0 && !/[*%\\]/.test(key)) {   // chặn ký tự đại diện: '%@%' từng khớp mọi tài khoản
    try { rows = await supa.select('users', { filter: 'email=ilike.' + encodeURIComponent(key.replace(/_/g, '\\_')), limit: 20, noScope: true }); }
    catch (e) { rows = []; }
  }
  return rows || [];
}
async function getUserById(id) {
  const rows = await supa.select('users', { filter: supa.eq('id', id), limit: 1, noScope: true });
  return rows[0] || null;
}

module.exports = { permsArr_, userOut, getUsersByName_, getUserById };
