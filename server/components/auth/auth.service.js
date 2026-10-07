'use strict';
/************************************************************
 * Đăng nhập / phiên của CHÍNH người dùng: login, me, cài đặt giao diện, đổi mật khẩu.
 *  - Mật khẩu: bcrypt (bcryptjs)
 *  - Vai trò: 'super' | 'admin' | 'staff'
 ************************************************************/
const bcrypt = require('bcryptjs');
const supa = require('../../libraries/supa');
const { openSession, closeSession, hetHan_ } = require('./session');
const { userOut, getUsersByName_, getUserById } = require('../users/users.repository');
const { getCongTy } = require('../cong-ty/cong-ty.repository');
const { audit } = require('../thong-bao/audit');

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
  // _sessionToken: rpc.js đặt vào cookie HttpOnly rồi gỡ khỏi kết quả — token không bao giờ tới JavaScript của trang
  return { _sessionToken: await openSession(u), user: Object.assign(userOut(u), { uiPrefs: prefsOf_(u) }), congTy: ct };
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
// Đóng phiên phía server (token hết hiệu lực ngay) rồi xoá cookie ('' -> rpc.js xoá cookie phiên)
async function logout(actor) { await closeSession(actor); await audit(actor, 'logout', 'Đăng xuất'); return { ok: true, _sessionToken: '' }; }
async function changePassword(actor, oldPw, newPw) {
  const u = await getUserById(actor.uid);
  if (!u || !bcrypt.compareSync(String(oldPw || ''), u.password_hash || '')) throw new Error('Mật khẩu hiện tại không đúng');
  if (String(newPw || '').length < 4) throw new Error('Mật khẩu mới tối thiểu 4 ký tự');
  await supa.update('users', supa.eq('id', u.id), { password_hash: bcrypt.hashSync(String(newPw), 10) }, { noScope: true });
  await audit(actor, 'change_password', 'Tự đổi mật khẩu');
  return { ok: true };
}

module.exports = { login, me, setMyPref, logout, changePassword };
