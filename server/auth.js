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
const store = require('./store_supa');   // để xóa sản phẩm khi admin duyệt yêu cầu

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
function permsArr_(v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
function userOut(r) {
  return { id: r.id, username: r.username, hoTen: r.ho_ten || '', role: r.role || 'staff',
    perms: permsArr_(r.perms), active: r.active !== false, createdAt: r.created_at, lastLogin: r.last_login };
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
function permsColErr_(e) {
  var m = (e && e.message) || '';
  if (/perms/.test(m) && /(column|schema cache)/i.test(m)) {
    return new Error('Chưa cài cột phân quyền. Vào Supabase → SQL Editor chạy:  alter table public.users add column if not exists perms text default \'\';  rồi thử lại.');
  }
  return e;
}
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
  const perms = role === 'admin' ? '' : (Array.isArray(data.perms) ? data.perms.join(',') : '');
  const row = { username: username, ho_ten: String(data.hoTen || ''), password_hash: bcrypt.hashSync(String(data.password), 10), role: role, perms: perms, active: true };
  let res;
  try { res = await supa.insert('users', row); }
  catch (e) { throw permsColErr_(e); }
  await audit(actor, 'create_user', 'Tạo tài khoản ' + username + ' (' + role + ')');
  return userOut(res[0]);
}
async function adminUpdateUser(actor, id, fields) {
  fields = fields || {};
  const patch = {};
  if (fields.hasOwnProperty('hoTen')) patch.ho_ten = String(fields.hoTen || '');
  if (fields.hasOwnProperty('role')) patch.role = fields.role === 'admin' ? 'admin' : 'staff';
  if (fields.hasOwnProperty('perms')) patch.perms = Array.isArray(fields.perms) ? fields.perms.join(',') : '';
  // Admin thì bỏ giới hạn perms
  if (patch.role === 'admin') patch.perms = '';
  if (!Object.keys(patch).length) return { ok: true };
  let res;
  try { res = await supa.update('users', supa.eq('id', id), patch); }
  catch (e) { throw permsColErr_(e); }
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

/* ---------- Thông báo (notifications) ---------- */
async function getAdmins_() { return (await supa.select('users', { filter: supa.eq('role', 'admin') })).filter(function (u) { return u.active !== false; }); }
async function notify_(userId, kind, title, body, refId) {
  if (!userId) return;
  try { await supa.insert('notifications', { user_id: userId, kind: kind, title: title || '', body: body || '', ref_id: refId || null, is_read: false }); } catch (e) { console.warn('[notify] insert lỗi:', e && e.message); }
}
async function notifCount(actor) {
  const rows = await supa.select('notifications', { select: 'id', filter: supa.eq('user_id', actor.uid) + '&' + supa.eq('is_read', false), limit: 500 });
  return { unread: rows.length };
}
async function notifList(actor, limit) {
  const rows = await supa.select('notifications', { filter: supa.eq('user_id', actor.uid), order: 'created_at.desc', limit: Math.min(Number(limit) || 30, 100) });
  return rows.map(function (n) { return { id: n.id, kind: n.kind, title: n.title, body: n.body, refId: n.ref_id, read: n.is_read !== false ? n.is_read === true : false, at: n.created_at }; });
}
async function notifRead(actor, id) { await supa.update('notifications', supa.eq('id', id) + '&' + supa.eq('user_id', actor.uid), { is_read: true }); return { ok: true }; }
async function notifReadAll(actor) { await supa.update('notifications', supa.eq('user_id', actor.uid) + '&' + supa.eq('is_read', false), { is_read: true }); return { ok: true }; }

/* ---------- Yêu cầu xóa sản phẩm (duyệt bởi admin) ---------- */
function parseItems_(s) { try { return JSON.parse(s || '[]') || []; } catch (e) { return []; } }
async function requestDeleteProducts(actor, items) {
  items = (Array.isArray(items) ? items : []).map(function (it) { return { maSP: String(it.maSP || it.ma || ''), ten: String(it.ten || '') }; }).filter(function (it) { return it.maSP; });
  if (!items.length) throw new Error('Chưa chọn sản phẩm hợp lệ');
  const me = await getUserById(actor.uid);
  const who = me ? (me.ho_ten || me.username) : actor.u;
  const req = (await supa.insert('delete_requests', { requester_id: actor.uid, requester_name: who, items: JSON.stringify(items), status: 'pending' }))[0];
  const admins = await getAdmins_();
  for (var i = 0; i < admins.length; i++) await notify_(admins[i].id, 'delete_request', 'Yêu cầu xóa sản phẩm', who + ' yêu cầu xóa ' + items.length + ' sản phẩm', req.id);
  await audit(actor, 'request_delete', who + ' yêu cầu xóa ' + items.length + ' SP');
  return { ok: true, count: items.length };
}
async function listDeleteRequests(actor) {
  const rows = await supa.select('delete_requests', { order: 'created_at.desc', limit: 200 });
  return rows.map(function (r) { return { id: r.id, requester: r.requester_name, items: parseItems_(r.items), status: r.status, at: r.created_at, resolvedAt: r.resolved_at, resolver: r.resolver_name }; });
}
async function resolveDeleteRequest(actor, id, approve) {
  const r = (await supa.select('delete_requests', { filter: supa.eq('id', id), limit: 1 }))[0];
  if (!r) throw new Error('Không tìm thấy yêu cầu');
  if (r.status !== 'pending') throw new Error('Yêu cầu đã được xử lý');
  const items = parseItems_(r.items);
  const me = await getUserById(actor.uid);
  const resolver = me ? (me.ho_ten || me.username) : actor.u;
  const now = new Date().toISOString();
  if (approve) {
    var deleted = 0;
    for (var i = 0; i < items.length; i++) { try { await store.deleteDbProduct(items[i].maSP); deleted++; } catch (e) { } }
    await supa.update('delete_requests', supa.eq('id', id), { status: 'approved', resolver_name: resolver, resolved_at: now });
    await notify_(r.requester_id, 'delete_approved', 'Yêu cầu xóa đã được duyệt', 'Đã xóa ' + deleted + '/' + items.length + ' sản phẩm bạn yêu cầu', r.id);
    await audit(actor, 'approve_delete', 'Duyệt xóa ' + deleted + ' SP (yêu cầu #' + id + ' của ' + r.requester_name + ')');
    return { ok: true, deleted: deleted };
  } else {
    await supa.update('delete_requests', supa.eq('id', id), { status: 'rejected', resolver_name: resolver, resolved_at: now });
    await notify_(r.requester_id, 'delete_rejected', 'Yêu cầu xóa bị từ chối', 'Yêu cầu xóa ' + items.length + ' sản phẩm không được duyệt', r.id);
    await audit(actor, 'reject_delete', 'Từ chối yêu cầu xóa #' + id);
    return { ok: true };
  }
}

/* ---------- Yêu cầu mua hàng (thông báo + duyệt) ---------- */
async function notifyPurchaseAdmins(actor, orders) {
  orders = orders || [];
  const me = await getUserById(actor.uid);
  const who = me ? (me.ho_ten || me.username) : (actor.u || '');
  const admins = await getAdmins_();
  for (var i = 0; i < orders.length; i++) {
    for (var j = 0; j < admins.length; j++) {
      await notify_(admins[j].id, 'purchase_request', 'Yêu cầu mua hàng', who + ' gửi đơn ' + orders[i].maDon + (orders[i].supplier ? ' (' + orders[i].supplier + ')' : ''), String(orders[i].maDon));
    }
  }
  await audit(actor, 'request_purchase', who + ' gửi ' + orders.length + ' đơn mua hàng');
}
async function listPurchaseRequests(actor) {
  const rows = await supa.select('don_mua_hang', { order: 'ngay_gui.desc', limit: 200 });
  return rows.map(function (r) {
    return { maDon: r.ma_don, project: r.ten_du_an, supplier: r.nha_cung_cap, soSp: Number(r.so_sp) || 0,
      total: Number(r.tong_cong) || 0, status: r.trang_thai, requester: r.nguoi_gui, phongBan: r.phong_ban, at: r.ngay_gui };
  });
}
async function resolvePurchaseRequest(actor, maDon, approve) {
  const r = (await supa.select('don_mua_hang', { filter: supa.eq('ma_don', maDon), limit: 1 }))[0];
  if (!r) throw new Error('Không tìm thấy đơn mua hàng');
  const me = await getUserById(actor.uid);
  const resolver = me ? (me.ho_ten || me.username) : actor.u;
  const status = approve ? 'Đã duyệt' : 'Từ chối';
  await supa.update('don_mua_hang', supa.eq('ma_don', maDon), { trang_thai: status });
  if (r.requester_id) await notify_(r.requester_id, approve ? 'purchase_approved' : 'purchase_rejected',
    approve ? 'Đơn mua hàng đã được duyệt' : 'Đơn mua hàng bị từ chối',
    'Đơn ' + maDon + (r.nha_cung_cap ? ' (' + r.nha_cung_cap + ')' : ''), String(maDon));
  await audit(actor, approve ? 'approve_purchase' : 'reject_purchase', status + ' đơn ' + maDon + ' của ' + (r.nguoi_gui || ''));
  return { ok: true };
}

module.exports = {
  verifyToken, login, me, logout, changePassword,
  adminListUsers, adminCreateUser, adminUpdateUser, adminSetPassword, adminSetActive, adminDeleteUser, getAuditLog,
  notifCount, notifList, notifRead, notifReadAll,
  requestDeleteProducts, listDeleteRequests, resolveDeleteRequest,
  notifyPurchaseAdmins, listPurchaseRequests, resolvePurchaseRequest,
  audit
};
