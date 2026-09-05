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
  const payload = { uid: u.id, u: u.username, r: u.role, ct: u.cong_ty_id || null, exp: Date.now() + TOKEN_TTL_MS };
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
    return p; // {uid, u, r, ct, exp}
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
    perms: permsArr_(r.perms), active: r.active !== false, createdAt: r.created_at, lastLogin: r.last_login,
    congTyId: r.cong_ty_id || null };
}
async function getUserByName(username) {
  // noScope: lúc đăng nhập chưa biết công ty nên phải tra toàn hệ thống
  const rows = await supa.select('users', { filter: supa.eq('username', String(username || '').trim()), limit: 1, noScope: true });
  return rows[0] || null;
}
/* ---------- CÔNG TY (multi-tenant) ---------- */
function ctOut_(r) {
  return { id: r.id, ten: r.ten || '', ma: r.ma || '', logoUrl: r.logo_url || '', mauChinh: r.mau_chinh || '',
    tinhNang: String(r.tinh_nang || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
    gioiHanUser: Number(r.gioi_han_user) || 0, active: r.active !== false,
    hanDung: r.han_dung || '', ghiChu: r.ghi_chu || '', ngayTao: r.ngay_tao || '' };
}
async function getCongTy(id) {
  if (!id) return null;
  const rows = await supa.select('cong_ty', { filter: supa.eq('id', id), limit: 1, noScope: true });
  return rows[0] ? ctOut_(rows[0]) : null;
}
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
    tinh_nang: Array.isArray(data.tinhNang) ? data.tinhNang.join(',') : String(data.tinhNang || ''),
    gioi_han_user: Number(data.gioiHanUser) || 10, active: data.active !== false,
    han_dung: data.hanDung || null, ghi_chu: String(data.ghiChu || '') };
  const res = await supa.insert('cong_ty', row, { noScope: true });
  const ct = ctOut_(res[0]);
  // tạo luôn tài khoản chủ công ty (nếu có)
  if (data.adminUser && data.adminPass) {
    await supa.insert('users', {
      username: String(data.adminUser).trim(), ho_ten: String(data.adminHoTen || 'Quản trị ' + ten),
      password_hash: bcrypt.hashSync(String(data.adminPass), 10), role: 'admin', perms: '',
      active: true, cong_ty_id: ct.id
    }, { noScope: true });
  }
  await audit(actor, 'create_company', 'Tạo công ty ' + ten);
  return ct;
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
  if (isSuper) {   // chỉ super được đổi gói dịch vụ
    if (data.tinhNang != null) patch.tinh_nang = Array.isArray(data.tinhNang) ? data.tinhNang.join(',') : String(data.tinhNang);
    if (data.gioiHanUser != null) patch.gioi_han_user = Number(data.gioiHanUser) || 0;
    if (data.active != null) patch.active = !!data.active;
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
  for (const t of ['db_bao_gia', 'khai_toan', 'du_an', 'chi_tiet_mua_hang', 'don_mua_hang',
                   'db_san_pham_history', 'db_san_pham', 'notifications', 'delete_requests', 'users']) {
    try { await supa.remove(t, f, { noScope: true }); } catch (e) { /* bỏ qua bảng chưa có cột */ }
  }
  await supa.remove('cong_ty', supa.eq('id', id), { noScope: true });
  await audit(actor, 'delete_company', 'Xoá công ty ' + ct.ten + ' và toàn bộ dữ liệu');
  return { ok: true, ten: ct.ten };
}
async function getUserById(id) {
  const rows = await supa.select('users', { filter: supa.eq('id', id), limit: 1, noScope: true });
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
  // Kiểm tra công ty: bị khoá hoặc hết hạn thì không cho vào (super admin miễn trừ)
  let ct = null;
  if (u.role !== 'super') {
    ct = await getCongTy(u.cong_ty_id);
    if (!ct) throw new Error('Tài khoản chưa được gán công ty — liên hệ quản trị hệ thống');
    if (!ct.active) throw new Error('Công ty "' + ct.ten + '" đang bị tạm khoá');
    if (ct.hanDung && new Date(ct.hanDung) < new Date(new Date().toDateString()))
      throw new Error('Gói dịch vụ của "' + ct.ten + '" đã hết hạn ngày ' + ct.hanDung);
  } else if (u.cong_ty_id) { ct = await getCongTy(u.cong_ty_id); }
  await supa.update('users', supa.eq('id', u.id), patch, { noScope: true });
  await audit({ uid: u.id, u: u.username }, 'login', 'Đăng nhập' + (isBcrypt ? '' : ' (tự băm mật khẩu)'));
  return { token: makeToken(u), user: userOut(u), congTy: ct };
}
async function me(actor) {
  const u = await getUserById(actor.uid);
  if (!u || u.active === false) throw new Error('Phiên không hợp lệ');
  const out = userOut(u);
  out.congTy = await getCongTy(u.cong_ty_id);
  return out;
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
  // Công ty của tài khoản mới: super có thể chỉ định, còn lại = công ty của người tạo
  const ctId = (actor.r === 'super' && data.congTyId) ? data.congTyId : (actor.ct || null);
  // Trùng tên đăng nhập chỉ tính TRONG CÙNG công ty
  const dupRows = await supa.select('users', {
    filter: supa.eq('username', username) + (ctId ? ('&' + supa.eq('cong_ty_id', ctId)) : ''),
    limit: 1, noScope: true });
  if (dupRows.length) throw new Error('Tên đăng nhập đã tồn tại trong công ty này');
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
  const row = { username: username, ho_ten: String(data.hoTen || ''), password_hash: bcrypt.hashSync(String(data.password), 10), role: role, perms: perms, active: true, cong_ty_id: ctId };
  let res;
  try { res = await supa.insert('users', row, { noScope: true }); }
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
// Chi tiết 1 đơn mua hàng (header + danh sách sản phẩm) — để Admin xem trước khi duyệt
async function getPurchaseOrder(actor, maDon) {
  const h = (await supa.select('don_mua_hang', { filter: supa.eq('ma_don', maDon), limit: 1 }))[0];
  if (!h) throw new Error('Không tìm thấy đơn mua hàng');
  const dt = await supa.select('chi_tiet_mua_hang', { filter: supa.eq('ma_don', maDon), order: 'sort_no.asc' });
  const n = function (v) { return Number(v) || 0; };
  const s = function (v) { return v == null ? '' : String(v); };
  return {
    maDon: s(h.ma_don), project: s(h.ten_du_an), maDA: s(h.ma_du_an), supplier: s(h.nha_cung_cap),
    hangMuc: s(h.hang_muc), soSp: n(h.so_sp), tongTruocVat: n(h.tong_truoc_vat), vatPct: n(h.vat_pct),
    vat: n(h.vat), total: n(h.tong_cong), status: s(h.trang_thai), requester: s(h.nguoi_gui),
    phongBan: s(h.phong_ban), ghiChu: s(h.ghi_chu), at: s(h.ngay_gui),
    nguoiDuyet: s(h.nguoi_duyet), ngayDuyet: s(h.ngay_duyet),
    items: dt.map(function (r) {
      return { ma: s(r.ma_sp), ten: s(r.ten_sp), thuongHieu: s(r.thuong_hieu), phong: s(r.phong),
        dvt: s(r.dvt), sl: n(r.so_luong), donGia: n(r.don_gia), thanhTien: n(r.thanh_tien), hinhAnh: s(r.hinh_anh) };
    })
  };
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
  listCongTy, createCongTy, updateCongTy, deleteCongTy, getCongTy,
  getPurchaseOrder,
  verifyToken, login, me, logout, changePassword,
  adminListUsers, adminCreateUser, adminUpdateUser, adminSetPassword, adminSetActive, adminDeleteUser, getAuditLog,
  notifCount, notifList, notifRead, notifReadAll,
  requestDeleteProducts, listDeleteRequests, resolveDeleteRequest,
  notifyPurchaseAdmins, listPurchaseRequests, resolvePurchaseRequest,
  audit
};
