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
  resolvePurchaseRequest: auth.resolvePurchaseRequest
};
// Hàm không cần đăng nhập
const PUBLIC_FNS = new Set(['login']);
// Hàm cần đưa "actor" (người thao tác) làm tham số đầu
const ACTOR_FNS = new Set(['me', 'logout', 'changePassword',
  'adminCreateUser', 'adminUpdateUser', 'adminSetPassword', 'adminSetActive', 'adminDeleteUser',
  'notifCount', 'notifList', 'notifRead', 'notifReadAll',
  'requestDeleteProducts', 'listDeleteRequests', 'resolveDeleteRequest',
  'sendPurchaseRequest', 'listPurchaseRequests', 'resolvePurchaseRequest',
  'updateDbProductTracked']);
// Hàm chỉ Admin được gọi
const ADMIN_FNS = new Set(['adminListUsers', 'adminCreateUser', 'adminUpdateUser',
  'adminSetPassword', 'adminSetActive', 'adminDeleteUser', 'getAuditLog',
  'listDeleteRequests', 'resolveDeleteRequest', 'listPurchaseRequests', 'resolvePurchaseRequest',
  'deleteDbProduct']);   // Xóa sản phẩm trực tiếp: CHỈ Admin (nhân viên phải gửi yêu cầu)

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
    // Hàng tiêu đề bảng (nền xám)
    els.push(rowset([
      colv('<font color=\'grey\'>**#**</font>', 1),
      colv('<font color=\'grey\'>**SẢN PHẨM**</font>', 8),
      colv('<font color=\'grey\'>**SL × ĐƠN GIÁ**</font>', 6, 'right'),
      colv('<font color=\'grey\'>**THÀNH TIỀN**</font>', 5, 'right')
    ], 'grey'));
    let sumGoc = 0;
    items.forEach(function (it, i) {
      nItems++;
      const sl = Number(it.sl) || 0;
      const disc = Number(it.giamGiaPct) || 0;
      const goc = Number(it.donGiaGoc) || Number(it.donGia) || 0;
      const tt = sl * (Number(it.donGia) || 0);
      sumGoc += sl * goc;
      const sub = [it.khuVuc, it.thuongHieu].filter(Boolean).join(' · ');
      const nameCell = '**' + (it.ten || '') + '**' + (sub ? '\n<font color=\'grey\'>' + sub + '</font>' : '');
      const priceCell = disc > 0
        ? sl + ' ' + (it.dvt || '') + ' × ' + fmtVN(it.donGia) + '\n<font color=\'green\'>▼ ' + disc + '% (gốc ' + fmtVN(goc) + ')</font>'
        : sl + ' ' + (it.dvt || '') + ' × ' + fmtVN(it.donGia);
      els.push(rowset([
        colv(String(i + 1), 1),
        colv(nameCell, 8),
        colv(priceCell, 6, 'right'),
        colv('**' + fmtVN(tt) + '**', 5, 'right')
      ]));
    });
    // Khối tổng của NCC — căn phải
    const tamTinh = Number(od.total) - Number(od.vat);
    const tienGiam = Math.max(0, sumGoc - tamTinh);
    let tot = '<font color=\'grey\'>Tạm tính: ' + fmtVN(sumGoc) + ' đ</font>';
    if (tienGiam > 0) tot += '\n<font color=\'green\'>Giảm giá NCC: −' + fmtVN(tienGiam) + ' đ</font>';
    if (Number(od.vat) > 0) tot += '\n<font color=\'grey\'>VAT ' + (od.vatPct || 0) + '%: ' + fmtVN(od.vat) + ' đ</font>';
    tot += '\n💰 <font color=\'red\'>**TỔNG: ' + fmtVN(od.total) + ' đ**</font>';
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
    if (ADMIN_FNS.has(fn) && actor.r !== 'admin') return res.status(403).json({ error: 'Không có quyền (chỉ Admin)' });
  }
  const args = (req.body && Array.isArray(req.body.args)) ? req.body.args : [];
  try {
    const callArgs = ACTOR_FNS.has(fn) ? [actor].concat(args) : args;
    const result = await handler.apply(null, callArgs);
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
