'use strict';
/************************************************************
 * Token phiên (HMAC-SHA256 tự ký, không cần lib ngoài) + đối chiếu phiên với DB.
 * Token CHỈ nằm trong cookie HttpOnly — JavaScript của trang không đọc được, không lưu localStorage.
 ************************************************************/
const crypto = require('crypto');
const supa = require('../../libraries/supa');
const { tblErr_ } = require('../../libraries/db-errors');
const { getCongTy } = require('../cong-ty/cong-ty.repository');

const SECRET = process.env.AUTH_SECRET || 'qs-pro-dev-secret-change-me';
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000; // 7 ngày

/* ---------- token ---------- */
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sign_(data) { return b64url(crypto.createHmac('sha256', SECRET).update(data).digest()); }
function makeToken(u, sid) {
  const payload = { uid: u.id, u: u.username, r: u.role, ct: u.cong_ty_id || null, exp: Date.now() + TOKEN_TTL_MS };
  if (sid) payload.sid = sid;
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
    return p; // {uid, u, r, ct, exp, sid}
  } catch (e) { return null; }
}

// Token sống 7 ngày -> khoá/đổi vai trò/đổi công ty phải có hiệu lực ngay: đối chiếu DB (cache 30s).
const _sess = new Map();          // khoá = mã phiên (sid) -> { at, uid, u }
const SESSION_CACHE_MS = 30 * 1000;
function sessKey_(p) { return p.sid ? String(p.sid) : 'u:' + p.uid; }
function forgetSession_(uid) { _sess.forEach(function (v, k) { if (String(v.uid) === String(uid)) _sess.delete(k); }); }

/* ---------- phiên lưu phía server (bảng phien_dang_nhap — db/phien_dang_nhap.sql) ----------
   Mỗi lần đăng nhập = 1 dòng; token mang mã phiên (sid). Đăng xuất xoá dòng -> token đó hết hiệu lực NGAY,
   kể cả khi ai đó đã chép được cookie. Chưa chạy file SQL thì chạy như cũ (token tự hết hạn sau 7 ngày). */
const TBL = 'phien_dang_nhap';
let _coBang = null;               // null = chưa biết · true = đã có bảng · false = chưa chạy SQL
function thieuBang_(e) {
  const m = String((e && e.message) || '');
  return /phien_dang_nhap/.test(m) && /(does not exist|not find the table|42P01|PGRST205|404)/i.test(m);
}
// Mở phiên cho người vừa đăng nhập -> token
async function openSession(u) {
  const sid = crypto.randomBytes(18).toString('base64url');
  try {
    // dọn phiên đã quá hạn của chính tài khoản này để bảng không phình mãi
    await supa.remove(TBL, supa.eq('user_id', u.id) + '&het_han=lt.' + encodeURIComponent(new Date().toISOString()), { noScope: true });
    await supa.insert(TBL, { id: sid, user_id: u.id, het_han: new Date(Date.now() + TOKEN_TTL_MS).toISOString() }, { noScope: true });
    _coBang = true;
    return makeToken(u, sid);
  } catch (e) {
    if (!thieuBang_(e)) throw tblErr_(e, TBL, 'db/phien_dang_nhap.sql');
    if (_coBang !== false) console.warn('[auth] chưa có bảng ' + TBL + ' — chạy db/phien_dang_nhap.sql để đăng xuất vô hiệu token ngay.');
    _coBang = false;
    return makeToken(u);
  }
}
// Đóng phiên (đăng xuất): xoá dòng + quên cache -> request kế tiếp bằng token này bị từ chối
async function closeSession(actor) {
  if (!actor || !actor.sid) return;
  _sess.delete(String(actor.sid));
  try { await supa.remove(TBL, supa.eq('id', actor.sid), { noScope: true }); }
  catch (e) { if (!thieuBang_(e)) throw e; }
}
async function phienConSong_(p) {
  if (p.sid) {
    try {
      const rows = await supa.select(TBL, { select: 'id', filter: supa.eq('id', p.sid), limit: 1, noScope: true });
      _coBang = true;
      return rows.length > 0;
    } catch (e) { if (thieuBang_(e)) { _coBang = false; return true; } throw e; }
  }
  // Token không mang mã phiên: chỉ nhận khi CHƯA có bảng (đã có bảng thì phải đăng nhập lại để có phiên thu hồi được)
  if (_coBang === null) {
    try { await supa.select(TBL, { select: 'id', limit: 1, noScope: true }); _coBang = true; }
    catch (e) { if (thieuBang_(e)) _coBang = false; else throw e; }
  }
  return _coBang === false;
}
// Hôm nay theo giờ Việt Nam 'YYYY-MM-DD' (server chạy UTC: trước đây hết hạn 30/9 vẫn dùng được tới 7h sáng 1/10)
function todayVN_() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
function hetHan_(ct) { return !!(ct && ct.hanDung && String(ct.hanDung).slice(0, 10) < todayVN_()); }
async function sessionActor(token) {
  const p = verifyToken(token);
  if (!p) return null;
  const key = sessKey_(p);
  const hit = _sess.get(key);
  if (hit && Date.now() - hit.at < SESSION_CACHE_MS) return hit.u ? Object.assign({}, p, hit.u) : null;
  if (!await phienConSong_(p)) { _sess.set(key, { at: Date.now(), uid: p.uid, u: null }); return null; }   // đã đăng xuất
  const rows = await supa.select('users', { select: 'id,username,role,active,cong_ty_id', filter: supa.eq('id', p.uid), limit: 1, noScope: true });
  let u = rows[0] && rows[0].active !== false ? { r: rows[0].role, ct: rows[0].cong_ty_id || null, u: rows[0].username } : null;
  if (u && u.r !== 'super') {
    const ct = u.ct ? await getCongTy(u.ct) : null;
    if (!ct || !ct.active || hetHan_(ct)) u = null;
  }
  _sess.set(key, { at: Date.now(), uid: p.uid, u: u });
  return u ? Object.assign({}, p, u) : null;
}

/* ---------- cookie phiên ---------- */
const COOKIE = 'qs_sess';
// Secure khi chạy sau HTTPS (Render đặt x-forwarded-proto); localhost http vẫn đăng nhập được
function cookieOpts_(req) {
  const https = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return { httpOnly: true, sameSite: 'lax', secure: https, path: '/' };
}
function tokenFromReq(req) {
  const parts = String(req.headers.cookie || '').split(';');
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i > 0 && p.slice(0, i).trim() === COOKIE) { try { return decodeURIComponent(p.slice(i + 1).trim()); } catch (e) { return ''; } }
  }
  return '';
}
function setSessionCookie(req, res, token) { res.cookie(COOKIE, token, Object.assign({ maxAge: TOKEN_TTL_MS }, cookieOpts_(req))); }
function clearSessionCookie(req, res) { res.clearCookie(COOKIE, cookieOpts_(req)); }
// Cookie tự gửi kèm mọi request -> chặn request đến từ trang khác (CSRF): Origin phải trùng host đang phục vụ
function sameOrigin_(req) {
  const o = req.headers.origin;
  if (!o) return true;                       // không phải trình duyệt gọi chéo trang
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

module.exports = { makeToken, verifyToken, forgetSession_, hetHan_, sessionActor, openSession, closeSession,
  tokenFromReq, setSessionCookie, clearSessionCookie, sameOrigin_ };
