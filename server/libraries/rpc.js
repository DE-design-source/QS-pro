'use strict';
/************************************************************
 * POST /api/:fn -> gọi hàm nghiệp vụ tương ứng (thay google.script.run).
 * Mỗi domain khai báo phần của mình trong <domain>.routes.js:
 *   { fns: {tên: hàm}, public: [...], actor: [...], admin: [...], super: [...] }
 * gom() ghép tất cả thành 1 whitelist (REGISTRY) + các tập quyền.
 ************************************************************/
const tenant = require('./tenant');
const { sessionActor, tokenFromReq, setSessionCookie, clearSessionCookie, sameOrigin_ } = require('../components/auth/session');

function gom(modules) {
  // Whitelist các hàm client được phép gọi (đúng API surface của index.html)
  const REGISTRY = {};
  const PUBLIC_FNS = new Set();   // Hàm không cần đăng nhập
  const ACTOR_FNS = new Set();    // Hàm cần đưa "actor" (người thao tác) làm tham số đầu
  const ADMIN_FNS = new Set();    // Hàm chỉ Admin được gọi
  const SUPER_FNS = new Set();    // Hàm chỉ quản trị hệ thống (super) được gọi
  modules.forEach(function (m) {
    Object.keys(m.fns || {}).forEach(function (fn) {
      if (REGISTRY[fn]) throw new Error('Trùng tên hàm API: ' + fn);
      if (typeof m.fns[fn] !== 'function') throw new Error('Hàm API chưa được định nghĩa: ' + fn);
      REGISTRY[fn] = m.fns[fn];
    });
    [[m.public, PUBLIC_FNS], [m.actor, ACTOR_FNS], [m.admin, ADMIN_FNS], [m.super, SUPER_FNS]].forEach(function (p) {
      (p[0] || []).forEach(function (fn) {
        if (!(m.fns || {})[fn]) throw new Error('Khai quyền cho hàm không có trong fns: ' + fn);
        p[1].add(fn);
      });
    });
  });
  return { REGISTRY: REGISTRY, PUBLIC_FNS: PUBLIC_FNS, ACTOR_FNS: ACTOR_FNS, ADMIN_FNS: ADMIN_FNS, SUPER_FNS: SUPER_FNS };
}

// Người đăng nhập của request: token trong cookie phiên hợp lệ + tài khoản còn mở/đúng vai trò trong DB
async function actorOf_(req) {
  if (!sameOrigin_(req)) return null;
  const tok = tokenFromReq(req);
  if (!tok) return null;
  try { return await sessionActor(tok); } catch (e) { console.error('[auth] kiểm tra phiên lỗi:', e && e.message); return null; }
}
// Mã phiên bản đang chạy: đổi sau mỗi lần deploy -> trang đang mở biết mà nhắc tải lại (không chạy mã cũ)
const APP_VER = process.env.RENDER_GIT_COMMIT || String(Date.now());
function mount(app, reg) {
  const REGISTRY = reg.REGISTRY, PUBLIC_FNS = reg.PUBLIC_FNS, ACTOR_FNS = reg.ACTOR_FNS, ADMIN_FNS = reg.ADMIN_FNS, SUPER_FNS = reg.SUPER_FNS;
  app.post('/api/:fn', async function (req, res) {
    res.set('x-app-ver', APP_VER);
    const fn = req.params.fn;
    const handler = REGISTRY[fn];
    if (typeof handler !== 'function') {
      return res.status(404).json({ error: 'Không hỗ trợ hàm: ' + fn });
    }
    // ---- Xác thực & phân quyền ----
    const actor = await actorOf_(req);
    if (!PUBLIC_FNS.has(fn)) {
      if (!actor) {
        if (tokenFromReq(req) && sameOrigin_(req)) clearSessionCookie(req, res);   // phiên hết hạn / bị khoá -> dọn cookie
        return res.status(401).json({ error: 'Chưa đăng nhập', code: 'NOAUTH' });
      }
      // 'super' (quản trị hệ thống) có mọi quyền của admin
      const isAdminRole = actor.r === 'admin' || actor.r === 'super';
      if (ADMIN_FNS.has(fn) && !isAdminRole) return res.status(403).json({ error: 'Không có quyền (chỉ Admin)' });
      if (SUPER_FNS.has(fn) && actor.r !== 'super') return res.status(403).json({ error: 'Chỉ quản trị hệ thống' });
    }
    const args = (req.body && Array.isArray(req.body.args)) ? req.body.args : [];
    // Ngữ cảnh CÔNG TY: mọi truy vấn bên dưới tự động lọc theo công ty của người đăng nhập.
    // Super admin không gán công ty -> thấy toàn hệ thống; có thể "xem như" 1 công ty qua header.
    const viewAs = actor && actor.r === 'super' ? (req.headers['x-view-company'] || '') : '';
    const tctx = actor ? { uid: actor.uid, role: actor.r, congTyId: actor.ct || null, viewAs: viewAs || null } : null;
    try {
      const callArgs = ACTOR_FNS.has(fn) ? [actor].concat(args) : args;
      const result = await tenant.run(tctx, function () { return handler.apply(null, callArgs); });
      // Đăng nhập / đăng xuất trả _sessionToken -> đổi thành cookie HttpOnly, không gửi token về cho trang
      if (result && Object.prototype.hasOwnProperty.call(result, '_sessionToken')) {
        if (result._sessionToken) setSessionCookie(req, res, result._sessionToken); else clearSessionCookie(req, res);
        delete result._sessionToken;
      }
      res.json({ ok: true, result: result === undefined ? null : result });
    } catch (e) {
      console.error('[api] ' + fn + ' lỗi:', e && e.message);
      res.status(500).json({ error: (e && e.message) || 'Lỗi máy chủ' });
    }
  });
}

module.exports = { gom, mount, actorOf_ };
