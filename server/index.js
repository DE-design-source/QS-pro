'use strict';
/************************************************************
 * QS PRO – Express server
 *  - Phục vụ giao diện public/index.html
 *  - POST /api/:fn  -> gọi hàm nghiệp vụ tương ứng (thay google.script.run)
 *  - GET  /media    -> proxy ảnh attachment của Lark (dùng token server)
 ************************************************************/
const path = require('path');
const express = require('express');
const config = require('./config');
const supa = require('./supa');
// Dùng Supabase nếu đã cấu hình (SUPABASE_URL/KEY), ngược lại dùng Lark.
const store = supa.ok() ? require('./store_supa') : require('./store');
const lark = require('./lark');
const auth = require('./auth');
const tenant = require('./tenant');
const exportBaoGia = require('./export');
console.log('Nguồn dữ liệu:', supa.ok() ? 'Supabase' : 'Lark');

const app = express();
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: function (res, filePath) {
    // HTML/JS/CSS luôn revalidate -> deploy mới là trình duyệt lấy ngay (không kẹt cache cũ)
    if (/\.(html|js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Whitelist các hàm client được phép gọi (đúng API surface của index.html)
const REGISTRY = {
  bootstrap: store.bootstrap,
  buildCatalog: store.buildCatalog,
  getProducts: store.getProducts,
  getCatalogSheets: store.getCatalogSheets,
  getProjects: store.getProjects,
  getProject: store.getProject,
  createProject: store.createProject,
  updateProject: store.updateProject,
  deleteProject: store.deleteProject,
  duplicateProject: store.duplicateProject,
  getLines: store.getLines,
  addLine: store.addLine,
  addBlankLine: store.addBlankLine,
  updateLine: store.updateLine,
  deleteLine: store.deleteLine,
  saveLineAsProduct: store.saveLineAsProduct,
  saveDbProduct: store.saveDbProduct,
  uploadImage: store.uploadImage,
  deleteDbProduct: store.deleteDbProduct,
  getDbProduct: store.getDbProduct,
  updateDbProductTracked: store.updateDbProductTracked,
  getProductHistory: store.getProductHistory,
  getCover: store.getCover,
  saveCover: store.saveCover,
  buildCoverFromTemplate: store.buildCoverFromTemplate,
  getCoverOrInit: store.getCoverOrInit,
  getDashboard: store.getDashboard,
  getQuote: store.getQuote,
  importParse: store.importParse,
  importCommit: store.importCommit,
  exportBaoGia: exportBaoGia,
  sendPurchaseRequest: sendPurchaseRequest,
  getPurchaseOrders: store.getPurchaseOrders,
  // ===== Auth & phân quyền =====
  login: auth.login,
  me: auth.me,
  logout: auth.logout,
  changePassword: auth.changePassword,
  adminListUsers: auth.adminListUsers,
  adminCreateUser: auth.adminCreateUser,
  adminUpdateUser: auth.adminUpdateUser,
  adminSetPassword: auth.adminSetPassword,
  adminSetActive: auth.adminSetActive,
  adminDeleteUser: auth.adminDeleteUser,
  getAuditLog: auth.getAuditLog,
  notifCount: auth.notifCount,
  notifList: auth.notifList,
  notifRead: auth.notifRead,
  notifReadAll: auth.notifReadAll,
  requestDeleteProducts: auth.requestDeleteProducts,
  listDeleteRequests: auth.listDeleteRequests,
  resolveDeleteRequest: auth.resolveDeleteRequest,
  listPurchaseRequests: auth.listPurchaseRequests,
  getPurchaseOrder: auth.getPurchaseOrder,
  listCongTy: auth.listCongTy,
  createCongTy: auth.createCongTy,
  updateCongTy: auth.updateCongTy,
  deleteCongTy: auth.deleteCongTy,
  listCongTyUsers: auth.listCongTyUsers,
  createCongTyUser: auth.createCongTyUser,
  checkExpiry: checkExpiry,
  resolvePurchaseRequest: auth.resolvePurchaseRequest
};
// Hàm không cần đăng nhập
const PUBLIC_FNS = new Set(['login']);
// Hàm cần đưa "actor" (người thao tác) làm tham số đầu
const ACTOR_FNS = new Set(['me', 'logout', 'changePassword',
  'adminCreateUser', 'adminUpdateUser', 'adminSetPassword', 'adminSetActive', 'adminDeleteUser',
  'notifCount', 'notifList', 'notifRead', 'notifReadAll',
  'requestDeleteProducts', 'listDeleteRequests', 'resolveDeleteRequest',
  'sendPurchaseRequest', 'listPurchaseRequests', 'getPurchaseOrder', 'resolvePurchaseRequest',
  'listCongTy', 'createCongTy', 'updateCongTy', 'deleteCongTy', 'listCongTyUsers', 'createCongTyUser', 'checkExpiry',
  'updateDbProductTracked']);
// Hàm chỉ Admin được gọi
const SUPER_FNS = new Set(['listCongTy', 'createCongTy', 'deleteCongTy', 'listCongTyUsers', 'createCongTyUser', 'checkExpiry']);
const ADMIN_FNS = new Set(['adminListUsers', 'adminCreateUser', 'adminUpdateUser',
  'adminSetPassword', 'adminSetActive', 'adminDeleteUser', 'getAuditLog',
  'listDeleteRequests', 'resolveDeleteRequest', 'listPurchaseRequests', 'getPurchaseOrder', 'resolvePurchaseRequest',
  'deleteDbProduct',     // Xóa sản phẩm trực tiếp: CHỈ Admin (nhân viên phải gửi yêu cầu)
  'updateCongTy']);      // Chủ công ty đổi logo/tên công ty mình (hàm tự kiểm đúng công ty)

// ===== Gửi yêu cầu mua hàng tới webhook Lark (bot incoming webhook) =====
const PURCHASE_WEBHOOK = process.env.PURCHASE_WEBHOOK ||
  'https://open.larksuite.com/open-apis/bot/v2/hook/42c47fe7-d95e-472b-bb0c-6473d456b91a';
function fmtVN(n) { return (Math.round(Number(n) || 0)).toLocaleString('vi-VN'); }
function buildPurchaseCard(o) {
  o = o || {};
  const orders = Array.isArray(o.orders) ? o.orders : [];
  // ---- helpers dựng bảng bằng column_set (nhìn như bảng thật) ----
  const md = function (content, align) { const e = { tag: 'markdown', content: content }; if (align) e.text_align = align; return e; };
  const colv = function (content, weight, align) { return { tag: 'column', width: 'weighted', weight: weight, vertical_align: 'center', elements: [md(content, align)] }; };
  const rowset = function (cols, bg) { const cs = { tag: 'column_set', flex_mode: 'none', horizontal_spacing: 'small', columns: cols }; if (bg) cs.background_style = bg; return cs; };
  const info = function (label, val) { return { is_short: true, text: { tag: 'lark_md', content: '<font color=\'grey\'>' + label + '</font>\n**' + (val || '—') + '**' } }; };
  const els = [];

  // ==== Khối thông tin dự án / người gửi ====
  const infoFields = [info('🏗 Dự án', o.project), info('🔖 Mã dự án', o.maDA)];
  if (o.khachHang || o.sdt) infoFields.push(info('👤 Khách hàng', o.khachHang), info('📞 Điện thoại', o.sdt));
  infoFields.push(info('🙋 Người gửi', o.nguoiGui), info('🏢 Phòng ban', o.phongBan));
  els.push({ tag: 'div', fields: infoFields });
  if (o.ghiChu) els.push({ tag: 'div', text: { tag: 'lark_md', content: '<font color=\'grey\'>📝 Ghi chú</font>\n' + o.ghiChu } });

  let grand = 0, nSup = 0, nItems = 0;
  orders.forEach(function (od) {
    grand += Number(od.total) || 0; nSup++;
    const items = od.items || [];
    els.push({ tag: 'hr' });
    // Tiêu đề NCC
    els.push(md('🏭 <font color=\'blue\'>**' + (od.supplier || '—') + '**</font>　·　' + items.length + ' sản phẩm'));
    let sumGoc = 0;
    items.forEach(function (it, i) {
      nItems++;
      const sl = Number(it.sl) || 0;
      const disc = Number(it.giamGiaPct) || 0;
      const goc = Number(it.donGiaGoc) || Number(it.donGia) || 0;
      const tt = sl * (Number(it.donGia) || 0);
      sumGoc += sl * goc;
      const sub = [it.khuVuc, it.thuongHieu].filter(Boolean).join(' · ');
      let left = '**' + (i + 1) + '. ' + (it.ten || '') + '**';
      left += '\n<font color=\'grey\'>' + sl + ' ' + (it.dvt || '') + ' × ' + fmtVN(it.donGia) + ' đ' + (sub ? '　·　' + sub : '') + '</font>';
      if (disc > 0) left += '\n<font color=\'green\'>▼ giảm ' + disc + '% (gốc ' + fmtVN(goc) + ' đ)</font>';
      els.push(rowset([
        colv(left, 3),
        colv('**' + fmtVN(tt) + ' đ**', 1, 'right')
      ]));
    });
    // Khối tổng của NCC — căn phải
    const tamTinh = Number(od.total) - Number(od.vat);
    const tienGiam = Math.max(0, sumGoc - tamTinh);
    els.push({ tag: 'hr' });
    let tot = '<font color=\'grey\'>Tạm tính</font>　　' + fmtVN(sumGoc) + ' đ';
    if (tienGiam > 0) tot += '\n<font color=\'green\'>Giảm giá NCC</font>　　<font color=\'green\'>−' + fmtVN(tienGiam) + ' đ</font>';
    if (Number(od.vat) > 0) tot += '\n<font color=\'grey\'>VAT ' + (od.vatPct || 0) + '%</font>　　' + fmtVN(od.vat) + ' đ';
    tot += '\n**💰 TỔNG THANH TOÁN**　　<font color=\'red\'>**' + fmtVN(od.total) + ' đ**</font>';
    els.push(md(tot, 'right'));
  });

  // ==== Tổng tất cả (nếu nhiều NCC) ====
  els.push({ tag: 'hr' });
  if (orders.length > 1) {
    els.push(md('💵 <font color=\'red\'>**TỔNG CỘNG: ' + fmtVN(grand) + ' đ**</font>', 'right'));
  }
  els.push(md('📦 ' + nSup + ' nhà cung cấp　·　' + nItems + ' sản phẩm　·　⏳ <font color=\'orange\'>**Chờ duyệt**</font>'));
  const now = new Date();
  const stamp = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear();
  els.push({ tag: 'note', elements: [{ tag: 'plain_text', content: '⚡ Gửi tự động từ Dezon QS Pro · ' + stamp }] });

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: 'blue',
        title: { tag: 'plain_text', content: '🛒 YÊU CẦU MUA HÀNG' },
        subtitle: { tag: 'plain_text', content: (o.project || '') + (o.nguoiGui ? ' — ' + o.nguoiGui : '') }
      },
      elements: els
    }
  };
}
async function sendPurchaseRequest(actor, order) {
  order = order || {};
  // 1) Lưu đơn + thông báo Admin duyệt — luồng duyệt TRONG APP, luôn chạy (không phụ thuộc webhook Lark)
  let savedMa = [];
  try {
    if (typeof store.savePurchaseOrder === 'function') {
      const rs = await store.savePurchaseOrder(Object.assign({ kenh: 'Lark', ketQua: 'pending', requesterId: actor && actor.uid }, order));
      savedMa = (rs && rs.saved) || [];
      if (savedMa.length) {
        const ords = (Array.isArray(order.orders) ? order.orders : []);
        await auth.notifyPurchaseAdmins(actor, savedMa.map(function (ma, i) { return { maDon: ma, supplier: ords[i] && ords[i].supplier }; }));
      }
    }
  } catch (e) { console.warn('[mua hàng] lưu/notify lỗi:', e && e.message); }
  // 2) Gửi thẻ qua Lark — best-effort, KHÔNG chặn duyệt trong app nếu webhook lỗi
  let larkOk = false;
  try {
    const payload = buildPurchaseCard(order);
    const r = await fetch(PURCHASE_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    let data = null; try { data = await r.json(); } catch (e) { data = null; }
    larkOk = !!(data && (data.code === 0 || data.StatusCode === 0 || data.msg === 'success'));
    if (!larkOk) console.warn('[mua hàng] webhook Lark trả lỗi:', (data && (data.msg || data.StatusMessage)) || ('HTTP ' + r.status));
  } catch (e) { console.warn('[mua hàng] webhook Lark lỗi:', e && e.message); }
  return { ok: true, saved: savedMa, lark: larkOk };
}


// ===== NHẮC GIA HẠN: gửi thẻ Lark khi công ty sắp/đã hết hạn =====
const NHAC_MOC = [5, 3, 1];   // chỉ nhắc khi còn 5 / 3 / 1 ngày
function ngayConLai_(han) {
  if (!han) return null;
  const h = new Date(String(han).slice(0, 10) + 'T00:00:00');
  const t = new Date(new Date().toDateString());
  return Math.round((h - t) / 86400000);
}
function buildExpiryCard(items) {
  const hetHan = items.filter(function (x) { return x.con < 0; });
  const sapHet = items.filter(function (x) { return x.con >= 0; });
  const gap = sapHet.some(function (x) { return x.con <= 3; }) || hetHan.length;
  const el = [];
  function md(t) { return { tag: 'markdown', content: t }; }
  function row(x) {
    const tt = x.con < 0 ? ('<font color=\'red\'>ĐÃ HẾT HẠN ' + Math.abs(x.con) + ' ngày</font>')
      : (x.con === 0 ? '<font color=\'red\'>HẾT HẠN HÔM NAY</font>'
        : (x.con <= 7 ? ('<font color=\'orange\'>Còn ' + x.con + ' ngày</font>')
          : ('Còn ' + x.con + ' ngày')));
    return {
      tag: 'column_set', flex_mode: 'none',
      columns: [
        { tag: 'column', width: 'weighted', weight: 3, elements: [md('**' + x.ten + '**\n' + (x.email || x.ma))] },
        { tag: 'column', width: 'weighted', weight: 2, elements: [md(tt + '\n' + x.han)] },
        { tag: 'column', width: 'weighted', weight: 2, elements: [md(x.soUser + ' người dùng')] }
      ]
    };
  }
  if (hetHan.length) { el.push(md('**⛔ Đã hết hạn (' + hetHan.length + ')**')); hetHan.forEach(function (x) { el.push(row(x)); }); }
  if (hetHan.length && sapHet.length) el.push({ tag: 'hr' });
  if (sapHet.length) { el.push(md('**⏳ Sắp hết hạn (' + sapHet.length + ')**')); sapHet.forEach(function (x) { el.push(row(x)); }); }
  el.push({ tag: 'hr' });
  el.push({ tag: 'note', elements: [{ tag: 'plain_text', content: 'Dezon Pro · Nhắc gia hạn tự động · ' + new Date().toLocaleString('vi-VN') }] });
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: gap ? 'red' : 'orange',
        title: { tag: 'plain_text', content: 'Nhắc gia hạn dịch vụ' },
        subtitle: { tag: 'plain_text', content: items.length + ' công ty cần xử lý' }
      },
      elements: el
    }
  };
}
// Quét công ty sắp hết hạn -> gửi Lark (chống gửi trùng trong ngày)
async function checkExpiry(actor, opts) {
  opts = opts || {};
  const rows = await supa.select('cong_ty', { limit: 500, noScope: true });
  const today = new Date().toISOString().slice(0, 10);
  const items = [], toMark = [];
  rows.forEach(function (r) {
    if (r.active === false || !r.han_dung) return;
    const con = ngayConLai_(r.han_dung);
    if (con === null || con > NHAC_MOC[0]) return;   // ngoài mốc 5 ngày -> chưa nhắc
    // mốc gần nhất mà số ngày còn lại đã chạm tới
    const moc = con < 0 ? -1 : NHAC_MOC.filter(function (m) { return con <= m; }).pop();
    const daNhac = String(r.nhac_lan_cuoi || '').slice(0, 10) === today && Number(r.nhac_moc) === moc;
    if (daNhac && !opts.force) return;               // hôm nay đã nhắc mốc này rồi
    items.push({ id: r.id, ten: r.ten, ma: r.ma, email: r.email || '', han: r.han_dung, con: con,
      soUser: 0, moc: moc });
    toMark.push({ id: r.id, moc: moc });
  });
  if (!items.length) return { sent: false, count: 0, message: 'Không có công ty nào cần nhắc' };
  // đếm user từng công ty
  try {
    const us = await supa.select('users', { select: 'id,cong_ty_id', limit: 5000, noScope: true });
    items.forEach(function (x) { x.soUser = us.filter(function (u) { return String(u.cong_ty_id) === String(x.id); }).length; });
  } catch (e) { /* không quan trọng */ }
  let larkOk = false;
  try {
    const r = await fetch(PURCHASE_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildExpiryCard(items))
    });
    let d = null; try { d = await r.json(); } catch (e) { d = null; }
    larkOk = !!(d && (d.code === 0 || d.StatusCode === 0 || d.msg === 'success'));
    if (!larkOk) console.warn('[nhắc gia hạn] webhook Lark lỗi:', (d && (d.msg || d.StatusMessage)) || ('HTTP ' + r.status));
  } catch (e) { console.warn('[nhắc gia hạn] webhook Lark lỗi:', e && e.message); }
  // đánh dấu đã nhắc
  if (larkOk) {
    for (const m of toMark) {
      try { await supa.update('cong_ty', supa.eq('id', m.id), { nhac_lan_cuoi: today, nhac_moc: m.moc }, { noScope: true }); }
      catch (e) { /* chưa có cột -> bỏ qua */ }
    }
  }
  return { sent: larkOk, count: items.length,
    companies: items.map(function (x) { return x.ten + ' (' + (x.con < 0 ? 'hết hạn ' + Math.abs(x.con) + ' ngày' : 'còn ' + x.con + ' ngày') + ')'; }) };
}

/* ===== LỊCH NHẮC GIA HẠN: 10h00 sáng (giờ VN) mỗi ngày =====
   Server chạy giờ UTC nên quy đổi: 10h VN = 03h UTC.
   Chống gửi trùng bằng nhac_lan_cuoi/nhac_moc -> mỗi mốc chỉ 1 thẻ/ngày,
   nên nếu server ngủ (Render free) rồi thức dậy sau 10h thì GỬI BÙ, không bỏ sót. */
const NHAC_GIO_VN = 10;                        // 10h sáng giờ Việt Nam
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;       // UTC+7
function nowVN_() { return new Date(Date.now() + VN_OFFSET_MS); }
function msToNextRun_() {
  const vn = nowVN_();
  const next = new Date(vn); next.setUTCHours(NHAC_GIO_VN, 0, 0, 0);
  if (next <= vn) next.setUTCDate(next.getUTCDate() + 1);   // qua giờ hôm nay -> hẹn ngày mai
  return next - vn;
}
function autoExpiryScan_(lyDo) {
  checkExpiry({ r: 'super' }, {})
    .then(function (r) {
      if (r && r.sent) console.log('[nhắc gia hạn][' + lyDo + '] đã gửi Lark cho', r.count, 'công ty');
    })
    .catch(function (e) { console.warn('[nhắc gia hạn] lỗi:', e && e.message); });
}
function scheduleExpiry_() {
  const wait = msToNextRun_();
  setTimeout(function () { autoExpiryScan_('đúng giờ'); scheduleExpiry_(); }, wait);
  const h = Math.floor(wait / 3600000), m = Math.round((wait % 3600000) / 60000);
  console.log('[nhắc gia hạn] lần gửi kế tiếp sau ' + h + 'h' + m + 'p (10h00 giờ VN mỗi ngày)');
}
// Khởi động: nếu HÔM NAY đã qua 10h mà chưa gửi -> gửi bù (hàm tự bỏ qua nếu đã gửi rồi)
setTimeout(function () {
  if (nowVN_().getUTCHours() >= NHAC_GIO_VN) autoExpiryScan_('gửi bù sau khi server thức');
  scheduleExpiry_();
}, 60 * 1000);

app.post('/api/:fn', async function (req, res) {
  const fn = req.params.fn;
  const handler = REGISTRY[fn];
  if (typeof handler !== 'function') {
    return res.status(404).json({ error: 'Không hỗ trợ hàm: ' + fn });
  }
  // ---- Xác thực & phân quyền ----
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || (req.body && req.body.token) || '';
  const actor = tok ? auth.verifyToken(tok) : null;
  if (!PUBLIC_FNS.has(fn)) {
    if (!actor) return res.status(401).json({ error: 'Chưa đăng nhập', code: 'NOAUTH' });
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
    res.json({ ok: true, result: result === undefined ? null : result });
  } catch (e) {
    console.error('[api] ' + fn + ' lỗi:', e && e.message);
    res.status(500).json({ error: (e && e.message) || 'Lỗi máy chủ' });
  }
});

// Proxy ảnh attachment: /media?token=<file_token>
app.get('/media', async function (req, res) {
  const token = req.query.token;
  if (!token) return res.status(400).send('thiếu token');
  try {
    const m = await lark.mediaDownload(token);
    res.set('Content-Type', m.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(m.buffer);
  } catch (e) {
    res.status(502).send('Không tải được ảnh');
  }
});

app.get('/healthz', function (req, res) { res.json({ ok: true }); });

app.listen(config.port, function () {
  console.log('QS Pro chạy tại http://localhost:' + config.port);
  console.log('Lark domain:', config.domain, '| Base:', config.appToken);
  // Khởi tạo bảng sớm (chỉ khi dùng Lark; Supabase đã có schema sẵn)
  if (typeof store.setup === 'function') {
    store.setup().then(function () {
      console.log('Bảng Lark: products=' + config.tables.products + ' projects=' + config.tables.projects +
        ' lines=' + config.tables.lines + ' cover=' + config.tables.cover);
    }).catch(function (e) { console.warn('CẢNH BÁO setup Lark:', e.message); });
  }
});
