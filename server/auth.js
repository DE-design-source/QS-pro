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
const tenant = require('./tenant');      // công ty đang làm việc (super có thể "xem như" 1 công ty)
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

// Token sống 7 ngày -> khoá/đổi vai trò/đổi công ty phải có hiệu lực ngay: đối chiếu DB (cache 30s).
const _sess = new Map();
const SESSION_CACHE_MS = 30 * 1000;
function forgetSession_(uid) { _sess.delete(String(uid)); }
// Hôm nay theo giờ Việt Nam 'YYYY-MM-DD' (server chạy UTC: trước đây hết hạn 30/9 vẫn dùng được tới 7h sáng 1/10)
function todayVN_() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
function hetHan_(ct) { return !!(ct && ct.hanDung && String(ct.hanDung).slice(0, 10) < todayVN_()); }
async function sessionActor(token) {
  const p = verifyToken(token);
  if (!p) return null;
  const hit = _sess.get(String(p.uid));
  if (hit && Date.now() - hit.at < SESSION_CACHE_MS) return hit.u ? Object.assign({}, p, hit.u) : null;
  const rows = await supa.select('users', { select: 'id,username,role,active,cong_ty_id', filter: supa.eq('id', p.uid), limit: 1, noScope: true });
  let u = rows[0] && rows[0].active !== false ? { r: rows[0].role, ct: rows[0].cong_ty_id || null, u: rows[0].username } : null;
  if (u && u.r !== 'super') {
    const ct = u.ct ? await getCongTy(u.ct) : null;
    if (!ct || !ct.active || hetHan_(ct)) u = null;
  }
  _sess.set(String(p.uid), { at: Date.now(), u: u });
  return u ? Object.assign({}, p, u) : null;
}

/* ---------- audit ---------- */
async function audit(actor, action, detail, congTyId) {
  try {
    const row = {
      user_id: actor && actor.uid ? actor.uid : null,
      username: actor ? (actor.u || actor.username || '') : '',
      action: String(action || ''), detail: String(detail || '')
    };
    if (congTyId) row.cong_ty_id = congTyId;   // login chạy ngoài ngữ cảnh công ty
    await supa.insert('audit_log', row);
  } catch (e) { /* nhật ký không được làm hỏng nghiệp vụ */ }
}

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
/* ---------- CÔNG TY (multi-tenant) ---------- */
let _shareCol = null;   // cột dung_sp_dezon có tồn tại chưa (chưa chạy db/share_catalog.sql thì chưa có)
async function hasShareCol_() {
  if (_shareCol !== null) return _shareCol;
  try { await supa.select('cong_ty', { select: 'dung_sp_dezon', limit: 1, noScope: true }); _shareCol = true; }
  catch (e) { _shareCol = false; }
  return _shareCol;
}
function ctOut_(r) {
  return { id: r.id, ten: r.ten || '', ma: r.ma || '', logoUrl: r.logo_url || '', mauChinh: r.mau_chinh || '',
    tinhNang: String(r.tinh_nang || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
    gioiHanUser: Number(r.gioi_han_user) || 0, active: r.active !== false,
    hanDung: r.han_dung || '', ghiChu: r.ghi_chu || '', ngayTao: r.ngay_tao || '',
    email: r.email || '', sdt: r.sdt || '', dungSpDezon: r.dung_sp_dezon === true };
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
async function getUserById(id) {
  const rows = await supa.select('users', { filter: supa.eq('id', id), limit: 1, noScope: true });
  return rows[0] || null;
}

/* ---------- đăng nhập / phiên ---------- */
function pwOk_(row, password) {
  const stored = String((row && row.password_hash) || '');
  const isBcrypt = /^\$2[aby]\$/.test(stored);
  return { ok: isBcrypt ? bcrypt.compareSync(password, stored) : (password !== '' && password === stored), isBcrypt: isBcrypt };
}
async function login(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  const rows = await getUsersByName_(username);
  // Ưu tiên tài khoản đang mở khoá và đã thuộc một công ty
  rows.sort(function (a, b) {
    const sa = (a.active === false ? 0 : 2) + (a.cong_ty_id ? 1 : 0);
    const sb = (b.active === false ? 0 : 2) + (b.cong_ty_id ? 1 : 0);
    return sb - sa;
  });
  let u = null, isBcrypt = false;
  for (const r of rows) { const t = pwOk_(r, password); if (t.ok) { u = r; isBcrypt = t.isBcrypt; break; } }
  const ok = !!u;
  if (!ok) {
    await audit({ u: username }, 'login_fail', 'Sai tài khoản hoặc mật khẩu', rows[0] && rows[0].cong_ty_id);
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
    if (hetHan_(ct))
      throw new Error('Gói dịch vụ của "' + ct.ten + '" đã hết hạn ngày ' + ct.hanDung);
  } else if (u.cong_ty_id) { ct = await getCongTy(u.cong_ty_id); }
  await supa.update('users', supa.eq('id', u.id), patch, { noScope: true });
  await audit({ uid: u.id, u: u.username }, 'login', 'Đăng nhập' + (isBcrypt ? '' : ' (tự băm mật khẩu)'), u.cong_ty_id);
  return { token: makeToken(u), user: Object.assign(userOut(u), { uiPrefs: prefsOf_(u) }), congTy: ct };
}
async function me(actor) {
  const u = await getUserById(actor.uid);
  if (!u || u.active === false) throw new Error('Phiên không hợp lệ');
  const out = userOut(u);
  out.uiPrefs = prefsOf_(u);
  out.congTy = await getCongTy(u.cong_ty_id);
  return out;
}
/* ---------- Cài đặt giao diện RIÊNG từng tài khoản (db/user_ui_prefs.sql) ----------
   ui_prefs = { tkCols: [...] } — bộ cột "Của tôi" của bảng Bóc tách, theo tài khoản
   nên đăng nhập máy khác vẫn giữ. value = null -> xoá khoá đó.                     */
function prefsOf_(u) { const p = u && u.ui_prefs; return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {}; }
// Bộ cột lưu theo tài khoản: mỗi bảng một khoá (Bóc tách + Xuất báo giá dùng chung tkCols)
const PREF_KEYS = ['tkCols', 'cpCols', 'daCols', 'spCols', 'tkColSets'];
async function setMyPref(actor, key, value) {
  if (PREF_KEYS.indexOf(key) < 0) throw new Error('Khoá cài đặt không hợp lệ');
  if (value != null && /Cols$/.test(key) && !(Array.isArray(value) && value.length <= 60 && value.every(function (x) { return typeof x === 'string' && x.length < 40; })))
    throw new Error('Bộ cột không hợp lệ');
  // tkColSets: các bảng cột ĐẶT TÊN của tab Bóc tách — [{ ten, cols: [...] }]
  if (value != null && key === 'tkColSets' && !(Array.isArray(value) && value.length <= 30 && value.every(function (b) {
    return b && typeof b.ten === 'string' && b.ten.length > 0 && b.ten.length <= 60 && Array.isArray(b.cols) && b.cols.length <= 60
      && b.cols.every(function (x) { return typeof x === 'string' && x.length < 40; }); })))
    throw new Error('Bảng cột không hợp lệ');
  const u = await getUserById(actor.uid);
  if (!u) throw new Error('Phiên không hợp lệ');
  const prefs = Object.assign({}, prefsOf_(u));
  if (value == null) delete prefs[key]; else prefs[key] = value;
  try { await supa.update('users', supa.eq('id', u.id), { ui_prefs: prefs }, { noScope: true }); }
  catch (e) {
    const m = (e && e.message) || '';
    if (/ui_prefs/.test(m) && /(column|schema cache|PGRST204)/i.test(m))
      throw new Error('Cơ sở dữ liệu chưa có cột "ui_prefs". Vào Supabase → SQL Editor chạy file db/user_ui_prefs.sql rồi thử lại.');
    throw e;
  }
  return { ok: true, uiPrefs: prefs };
}
async function logout(actor) { await audit(actor, 'logout', 'Đăng xuất'); return { ok: true }; }
async function changePassword(actor, oldPw, newPw) {
  const u = await getUserById(actor.uid);
  if (!u || !bcrypt.compareSync(String(oldPw || ''), u.password_hash || '')) throw new Error('Mật khẩu hiện tại không đúng');
  if (String(newPw || '').length < 4) throw new Error('Mật khẩu mới tối thiểu 4 ký tự');
  await supa.update('users', supa.eq('id', u.id), { password_hash: bcrypt.hashSync(String(newPw), 10) }, { noScope: true });
  await audit(actor, 'change_password', 'Tự đổi mật khẩu');
  return { ok: true };
}

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
// Lỗi JS phía trình duyệt người dùng: ghi lại để thấy được lỗi vặt thay vì chỉ nằm trong console máy họ
async function logClientError(actor, info) {
  info = info || {};
  const d = ['[' + String(info.tab || '').slice(0, 20) + ']', String(info.msg || '').slice(0, 300),
    info.src ? '@ ' + String(info.src).replace(/^https?:\/\/[^/]+\//, '').slice(0, 120) : ''].filter(Boolean).join(' ');
  console.warn('[lỗi giao diện] ' + ((actor && actor.u) || '?') + ' ' + d);
  await audit(actor, 'loi_giao_dien', d);
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
  items = (Array.isArray(items) ? items : []).map(function (it) { return { maSP: String(it.maSP || it.ma || ''), id: it.id ? String(it.id) : '', ten: String(it.ten || '') }; }).filter(function (it) { return it.maSP; });
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
  const claim = await supa.update('delete_requests', supa.eq('id', id) + '&status=eq.pending',
    { status: approve ? 'approved' : 'rejected', resolver_name: resolver, resolved_at: now });
  if (!claim || !claim.length) throw new Error('Yêu cầu đã được xử lý');
  if (approve) {
    var deleted = 0;
    var loiXoa = '';
    // xoá theo id dòng = đúng biến thể người gửi chọn (theo mã thì xoá nhầm biến thể có id nhỏ nhất)
    for (var i = 0; i < items.length; i++) { try { await store.deleteDbProduct(actor, items[i].id || items[i].maSP); deleted++; } catch (e) { loiXoa = loiXoa || (e && e.message) || ''; } }
    await notify_(r.requester_id, 'delete_approved', 'Yêu cầu xóa đã được duyệt', 'Đã xóa ' + deleted + '/' + items.length + ' sản phẩm bạn yêu cầu', r.id);
    await audit(actor, 'approve_delete', 'Duyệt xóa ' + deleted + ' SP (yêu cầu #' + id + ' của ' + r.requester_name + ')');
    return { ok: true, deleted: deleted, loi: loiXoa };
  } else {
    await notify_(r.requester_id, 'delete_rejected', 'Yêu cầu xóa bị từ chối', 'Yêu cầu xóa ' + items.length + ' sản phẩm không được duyệt', r.id);
    await audit(actor, 'reject_delete', 'Từ chối yêu cầu xóa #' + id);
    return { ok: true };
  }
}

/* ═══════════════════════════════════════════════════════════════
   QUYỀN SỬA / DUYỆT SẢN PHẨM  (trạng thái duyệt nằm TRÊN sản phẩm)
   - 'sp_edit'  : sửa thẳng. Sửa xong sản phẩm quay về CHƯA DUYỆT.
   - 'sp_duyet' : sửa thẳng + bấm Duyệt để đánh dấu ĐÃ DUYỆT.
   - admin/super: có cả hai.
   Không có bước "gửi duyệt": mọi thay đổi ghi ngay vào danh mục, trạng thái
   duyệt và toàn bộ lịch sử sửa nằm ở chính sản phẩm.
   ═══════════════════════════════════════════════════════════════ */
async function spPerms_(actor) {
  if (!actor) return { edit: false, duyet: false };
  if (actor.r === 'admin' || actor.r === 'super') return { edit: true, duyet: true, admin: true };
  const u = await getUserById(actor.uid);
  const ps = permsArr_(u && u.perms);
  // Chưa cấu hình gì -> giữ như cũ: sửa + duyệt (tránh khoá tài khoản đang dùng)
  if (ps.indexOf('sp_edit') < 0 && ps.indexOf('sp_duyet') < 0) return { edit: true, duyet: true };
  const duyet = ps.indexOf('sp_duyet') >= 0;
  return { edit: duyet || ps.indexOf('sp_edit') >= 0, duyet: duyet };
}
async function spMyPerms(actor) { return spPerms_(actor); }
// CỬA NGÕ: mọi lệnh sửa sản phẩm của client đều vào đây để kiểm quyền
async function updateProductGated(actor, key, data) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền sửa sản phẩm');
  return store.updateDbProductTracked(actor, key, data);
}
// THÊM sản phẩm (form Nhập dữ liệu, lưu dòng bóc tách thành SP) — cần quyền sửa
async function createProductGated(actor, data) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền thêm/sửa sản phẩm');
  return store.saveDbProduct(actor, data);
}
// NHẬP HÀNG LOẠT từ file — cần quyền sửa
async function importGated(actor, products) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền nhập sản phẩm');
  return store.importCommit(actor, products);
}
// Lưu 1 dòng bóc tách thành sản phẩm trong danh mục — cần quyền sửa
async function saveLineAsProductGated(actor, line) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền thêm sản phẩm vào danh mục');
  return store.saveLineAsProduct(actor, line);
}
// Đặt danh sách sản phẩm đi kèm (combo) — cần quyền sửa
async function setComboGated(actor, key, items) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền sửa sản phẩm');
  return store.setCombo(actor, key, items);
}
// Gom nhóm biến thể — cần quyền sửa (giống combo)
async function setBienTheGated(actor, key, ids) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền sửa sản phẩm');
  return store.setBienThe(actor, key, ids);
}
// Duyệt / bỏ duyệt sản phẩm — chỉ tài khoản có quyền duyệt
async function setSpDuyet(actor, keys, approve) {
  const p = await spPerms_(actor);
  if (!p.duyet) throw new Error('Tài khoản không có quyền duyệt sản phẩm');
  return store.setSpDuyet(actor, keys, approve !== false);
}

/* ---------- Công tác xây dựng (Phần thô) ----------
   Dùng chung quyền với sản phẩm: sửa được sản phẩm thì nhập/sửa được công tác,
   duyệt được sản phẩm thì duyệt được công tác.                                */
async function ctSaveGated(actor, data) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền thêm dữ liệu');
  return store.ctSave(actor, data);
}
async function ctUpdateGated(actor, id, patch) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền sửa dữ liệu');
  return store.ctUpdate(actor, id, patch);
}
async function ctDeleteGated(actor, ids) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền xoá dữ liệu');
  return store.ctDelete(actor, ids);
}
async function ctDuyetGated(actor, ids, approve) {
  const p = await spPerms_(actor);
  if (!p.duyet) throw new Error('Tài khoản không có quyền duyệt');
  return store.ctDuyet(actor, ids, approve !== false);
}
async function ctFavGated(actor, ids, on) {
  return store.ctFav(actor, ids, on !== false);   // yêu thích = dấu trang của công ty, ai cũng bật/tắt được
}

/* Yêu thích: chỉ là dấu trang của công ty, không đụng vào dữ liệu sản phẩm
   -> mọi tài khoản đăng nhập đều được bật/tắt, không cần quyền sp_edit. */
async function setYeuThich(actor, keys, on) {
  return store.setYeuThich(actor, keys, on !== false);
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
  const status = approve ? 'Đã duyệt' : 'Từ chối';
  // Chỉ đổi khi còn "Chờ duyệt": bấm 2 lần / 2 admin cùng duyệt không lật được kết quả
  const upd = await supa.update('don_mua_hang', supa.eq('ma_don', maDon) + '&trang_thai=eq.' + encodeURIComponent('Chờ duyệt'), { trang_thai: status });
  if (!upd || !upd.length) throw new Error('Đơn đã được xử lý');
  if (r.requester_id) await notify_(r.requester_id, approve ? 'purchase_approved' : 'purchase_rejected',
    approve ? 'Đơn mua hàng đã được duyệt' : 'Đơn mua hàng bị từ chối',
    'Đơn ' + maDon + (r.nha_cung_cap ? ' (' + r.nha_cung_cap + ')' : ''), String(maDon));
  await audit(actor, approve ? 'approve_purchase' : 'reject_purchase', status + ' đơn ' + maDon + ' của ' + (r.nguoi_gui || ''));
  return { ok: true };
}

// Theo dõi đơn sau khi duyệt: Đã duyệt -> Đã đặt hàng -> Đã nhận hàng (phòng mua hàng bấm ở tab Mua hàng).
// Chỉ cho đi đúng 1 bước từ trạng thái liền trước (đổi có điều kiện) -> bấm trùng / 2 người cùng bấm không nhảy cóc.
const PO_BUOC = { 'Đã đặt hàng': 'Đã duyệt', 'Đã nhận hàng': 'Đã đặt hàng' };
async function setPurchaseStatus(actor, maDon, status) {
  const truoc = PO_BUOC[status]; if (!truoc) throw new Error('Trạng thái không hợp lệ');
  const upd = await supa.update('don_mua_hang', supa.eq('ma_don', maDon) + '&trang_thai=eq.' + encodeURIComponent(truoc), { trang_thai: status });
  if (!upd || !upd.length) throw new Error('Đơn phải ở trạng thái "' + truoc + '" mới chuyển sang "' + status + '"');
  await audit(actor, 'purchase_status', status + ' — đơn ' + maDon);
  return { ok: true, status: status };
}

/* ===== ĐỀ XUẤT MUA HÀNG — thông báo + duyệt (tách khỏi đơn mua hàng) ===== */
const DX_TEN = { ck: 'đề xuất chiết khấu', tt: 'đề xuất thanh toán' };
async function notifyDeXuatAdmins(actor, dx) {
  const me = await getUserById(actor.uid);
  const who = me ? (me.ho_ten || me.username) : (actor.u || '');
  const admins = await getAdmins_();
  const ten = DX_TEN[dx.loai] || 'đề xuất';
  for (var j = 0; j < admins.length; j++) {
    await notify_(admins[j].id, 'de_xuat', 'Đề xuất mua hàng',
      who + ' gửi ' + ten + ' ' + dx.ma + (dx.supplier ? ' (' + dx.supplier + ')' : ''), String(dx.ma));
  }
  await audit(actor, 'request_de_xuat', who + ' gửi ' + ten + ' ' + dx.ma);
}
async function listDeXuat(actor, loai) {
  const filter = loai ? supa.eq('loai', loai) : '';
  let rows = [];
  try { rows = await supa.select('de_xuat', { filter: filter, order: 'ngay_gui.desc', limit: 200 }); }
  catch (e) { if (/de_xuat/.test(String(e && e.message)) ) return []; throw e; }   // chưa chạy db/de_xuat.sql
  return rows.map(store.dxHead_);
}
async function getDeXuat(actor, ma) {
  const h = (await supa.select('de_xuat', { filter: supa.eq('ma_de_xuat', ma), limit: 1 }))[0];
  if (!h) throw new Error('Không tìm thấy đề xuất');
  const dt = await supa.select('chi_tiet_de_xuat', { filter: supa.eq('ma_de_xuat', ma), order: 'sort_no.asc' });
  return Object.assign(store.dxHead_(h), { items: dt.map(store.dxItem_) });
}
async function resolveDeXuat(actor, ma, approve) {
  const r = (await supa.select('de_xuat', { filter: supa.eq('ma_de_xuat', ma), limit: 1 }))[0];
  if (!r) throw new Error('Không tìm thấy đề xuất');
  const me = await getUserById(actor.uid);
  const resolver = me ? (me.ho_ten || me.username) : actor.u;
  const status = approve ? 'Đã duyệt' : 'Từ chối';
  const upd = await supa.update('de_xuat', supa.eq('ma_de_xuat', ma) + '&trang_thai=eq.' + encodeURIComponent('Chờ duyệt'),
    { trang_thai: status, nguoi_duyet: resolver, ngay_duyet: new Date().toISOString() });
  if (!upd || !upd.length) throw new Error('Đề xuất đã được xử lý');
  const ten = DX_TEN[r.loai] || 'đề xuất';
  if (r.requester_id) await notify_(r.requester_id, approve ? 'de_xuat_approved' : 'de_xuat_rejected',
    approve ? 'Đề xuất đã được duyệt' : 'Đề xuất bị từ chối',
    'Phiếu ' + ma + (r.nha_cung_cap ? ' (' + r.nha_cung_cap + ')' : ''), String(ma));
  await audit(actor, approve ? 'approve_de_xuat' : 'reject_de_xuat', status + ' ' + ten + ' ' + ma + ' của ' + (r.nguoi_gui || ''));
  return { ok: true };
}

module.exports = {
  updateProductGated, createProductGated, importGated, saveLineAsProductGated, setSpDuyet, setComboGated, setBienTheGated, spMyPerms,
  setYeuThich,
  ctSaveGated, ctUpdateGated, ctDeleteGated, ctDuyetGated, ctFavGated,
  listCongTyUsers, createCongTyUser,
  listCongTy, createCongTy, updateCongTy, deleteCongTy, getCongTy,
  getPurchaseOrder,
  verifyToken, sessionActor, login, me, logout, changePassword, setMyPref,
  adminListUsers, adminCreateUser, adminUpdateUser, adminSetPassword, adminSetActive, adminDeleteUser, getAuditLog, logClientError,
  notifCount, notifList, notifRead, notifReadAll,
  requestDeleteProducts, listDeleteRequests, resolveDeleteRequest,
  notifyPurchaseAdmins, listPurchaseRequests, resolvePurchaseRequest, setPurchaseStatus,
  notifyDeXuatAdmins, listDeXuat, getDeXuat, resolveDeXuat,
  audit
};
