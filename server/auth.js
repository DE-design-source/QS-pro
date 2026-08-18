'use strict';
/************************************************************
 * QS Pro — Auth & phân quyền (tự xây trên Supabase)
 *  - Mật khẩu: bcrypt (bcryptjs)
 *  - Token phiên: HMAC-SHA256 tự ký (không cần lib ngoài)
 *  - Vai trò: 'admin' | 'staff'
 ************************************************************/
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supa = require('./supa');

const SECRET = process.env.AUTH_SECRET || 'qs-pro-dev-secret-change-me';
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000; // 7 ngày

/* ---------- token ---------- */
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sign_(data) { return b64url(crypto.createHmac('sha256', SECRET).update(data).digest()); }
function makeToken(u) {
  const payload = { uid: u.id, u: u.username, r: u.role, exp: Date.now() + TOKEN_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  return body + '.' + sign_(body);
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  if (sign_(body) !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!p || !p.exp || p.exp < Date.now()) return null;
    return p; // {uid, u, r, exp}
  } catch (e) { return null; }
}

/* ---------- audit ---------- */
async function audit(actor, action, detail) {
  try {
    await supa.insert('audit_log', {
      user_id: actor && actor.uid ? actor.uid : null,
      username: actor ? (actor.u || actor.username || '') : '',
      action: String(action || ''), detail: String(detail || '')
    });
  } catch (e) { /* nhật ký không được làm hỏng nghiệp vụ */ }
}

/* ---------- helpers ---------- */
function userOut(r) {
  return { id: r.id, username: r.username, hoTen: r.ho_ten || '', role: r.role || 'staff',
    active: r.active !== false, createdAt: r.created_at, lastLogin: r.last_login };
}
async function getUserByName(username) {
  const rows = await supa.select('users', { filter: supa.eq('username', String(username || '').trim()), limit: 1 });
  return rows[0] || null;
}
async function getUserById(id) {
  const rows = await supa.select('users', { filter: supa.eq('id', id), limit: 1 });
  return rows[0] || null;
}

/* ---------- đăng nhập / phiên ---------- */
async function login(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  const u = await getUserByName(username);
  const stored = u ? String(u.password_hash || '') : '';
  const isBcrypt = /^\$2[aby]\$/.test(stored);
  const ok = u && (isBcrypt ? bcrypt.compareSync(password, stored) : (password !== '' && password === stored));
  if (!ok) {
    await audit({ u: username }, 'login_fail', 'Sai tài khoản hoặc mật khẩu');
    throw new Error('Sai tài khoản hoặc mật khẩu');
  }
  if (u.active === false) throw new Error('Tài khoản đã bị khóa');
  const patch = { last_login: new Date().toISOString() };
  // Tự nâng cấp mật khẩu chữ thường (nhập tay trên Supabase) -> băm bcrypt để an toàn
  if (!isBcrypt) patch.password_hash = bcrypt.hashSync(password, 10);
  await supa.update('users', supa.eq('id', u.id), patch);
  await audit({ uid: u.id, u: u.username }, 'login', 'Đăng nhập' + (isBcrypt ? '' : ' (tự băm mật khẩu)'));
  return { token: makeToken(u), user: userOut(u) };
}
async function me(actor) {
  const u = await getUserById(actor.uid);
  if (!u || u.active === false) throw new Error('Phiên không hợp lệ');
  return userOut(u);
}
async function logout(actor) { await audit(actor, 'logout', 'Đăng xuất'); return { ok: true }; }
async function changePassword(actor, oldPw, newPw) {
  const u = await getUserById(actor.uid);
  if (!u || !bcrypt.compareSync(String(oldPw || ''), u.password_hash || '')) throw new Error('Mật khẩu hiện tại không đúng');
  if (String(newPw || '').length < 4) throw new Error('Mật khẩu mới tối thiểu 4 ký tự');
  await supa.update('users', supa.eq('id', u.id), { password_hash: bcrypt.hashSync(String(newPw), 10) });
  await audit(actor, 'change_password', 'Tự đổi mật khẩu');
  return { ok: true };
}

/* ---------- Admin: quản lý tài khoản ---------- */
async function adminListUsers() {
  const rows = await supa.select('users', { order: 'created_at.asc', limit: 500 });
  return rows.map(userOut);
}
async function adminCreateUser(actor, data) {
  data = data || {};
  const username = String(data.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,}$/.test(username)) throw new Error('Tên đăng nhập ≥3 ký tự (chữ thường, số, . _ -)');
  if (String(data.password || '').length < 4) throw new Error('Mật khẩu tối thiểu 4 ký tự');
  if (await getUserByName(username)) throw new Error('Tên đăng nhập đã tồn tại');
  const role = data.role === 'admin' ? 'admin' : 'staff';
  const res = await supa.insert('users', {
    username: username, ho_ten: String(data.hoTen || ''), password_hash: bcrypt.hashSync(String(data.password), 10),
    role: role, active: true
  });
  await audit(actor, 'create_user', 'Tạo tài khoản ' + username + ' (' + role + ')');
  return userOut(res[0]);
}
async function adminUpdateUser(actor, id, fields) {
  fields = fields || {};
  const patch = {};
  if (fields.hasOwnProperty('hoTen')) patch.ho_ten = String(fields.hoTen || '');
  if (fields.hasOwnProperty('role')) patch.role = fields.role === 'admin' ? 'admin' : 'staff';
  if (!Object.keys(patch).length) return { ok: true };
  const res = await supa.update('users', supa.eq('id', id), patch);
  await audit(actor, 'update_user', 'Sửa tài khoản ' + (res[0] && res[0].username) + ' ' + JSON.stringify(patch));
  return res[0] ? userOut(res[0]) : { ok: true };
}
async function adminSetPassword(actor, id, newPassword) {
  if (String(newPassword || '').length < 4) throw new Error('Mật khẩu tối thiểu 4 ký tự');
  const u = await getUserById(id); if (!u) throw new Error('Không tìm thấy tài khoản');
  await supa.update('users', supa.eq('id', id), { password_hash: bcrypt.hashSync(String(newPassword), 10) });
  await audit(actor, 'reset_password', 'Đặt lại mật khẩu cho ' + u.username);
  return { ok: true };
}
async function adminSetActive(actor, id, active) {
  const u = await getUserById(id); if (!u) throw new Error('Không tìm thấy tài khoản');
  if (u.role === 'admin' && !active) {
    const admins = (await supa.select('users', { filter: supa.eq('role', 'admin') })).filter(function (x) { return x.active !== false; });
    if (admins.length <= 1) throw new Error('Phải còn ít nhất 1 admin đang hoạt động');
  }
  await supa.update('users', supa.eq('id', id), { active: !!active });
  await audit(actor, active ? 'unlock_user' : 'lock_user', (active ? 'Mở khóa ' : 'Khóa ') + u.username);
  return { ok: true };
}
async function adminDeleteUser(actor, id) {
  const u = await getUserById(id); if (!u) throw new Error('Không tìm thấy tài khoản');
  if (u.id === actor.uid) throw new Error('Không thể tự xóa tài khoản đang đăng nhập');
  if (u.role === 'admin') {
    const admins = await supa.select('users', { filter: supa.eq('role', 'admin') });
    if (admins.length <= 1) throw new Error('Phải còn ít nhất 1 admin');
  }
  await supa.remove('users', supa.eq('id', id));
  await audit(actor, 'delete_user', 'Xóa tài khoản ' + u.username);
  return { ok: true };
}
async function getAuditLog(limit) {
  const rows = await supa.select('audit_log', { order: 'created_at.desc', limit: Math.min(Number(limit) || 200, 1000) });
  return rows.map(function (r) { return { id: r.id, username: r.username, action: r.action, detail: r.detail, at: r.created_at }; });
}

module.exports = {
  verifyToken, login, me, logout, changePassword,
  adminListUsers, adminCreateUser, adminUpdateUser, adminSetPassword, adminSetActive, adminDeleteUser, getAuditLog,
  audit
};
