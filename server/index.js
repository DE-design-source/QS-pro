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
  getLines: store.getLines,
  addLine: store.addLine,
  addBlankLine: store.addBlankLine,
  updateLine: store.updateLine,
  deleteLine: store.deleteLine,
  saveLineAsProduct: store.saveLineAsProduct,
  saveDbProduct: store.saveDbProduct,
  uploadImage: store.uploadImage,
  deleteDbProduct: store.deleteDbProduct,
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
  getPurchaseOrders: store.getPurchaseOrders
};

// ===== Gửi yêu cầu mua hàng tới webhook Lark (bot incoming webhook) =====
const PURCHASE_WEBHOOK = process.env.PURCHASE_WEBHOOK ||
  'https://open.larksuite.com/open-apis/bot/v2/hook/42c47fe7-d95e-472b-bb0c-6473d456b91a';
function fmtVN(n) { return (Math.round(Number(n) || 0)).toLocaleString('vi-VN'); }
function buildPurchaseCard(o) {
  o = o || {};
  const orders = Array.isArray(o.orders) ? o.orders : [];
  const els = [];
  // Thông tin dự án — 2 cột
  els.push({
    tag: 'div', fields: [
      { is_short: true, text: { tag: 'lark_md', content: '**🏗 Dự án**\n' + (o.project || '—') } },
      { is_short: true, text: { tag: 'lark_md', content: '**🔖 Mã dự án**\n' + (o.maDA || '—') } },
      { is_short: true, text: { tag: 'lark_md', content: '**👤 Khách hàng**\n' + (o.khachHang || '—') } },
      { is_short: true, text: { tag: 'lark_md', content: '**📞 Điện thoại**\n' + (o.sdt || '—') } }
    ]
  });
  // Người gửi / Phòng ban (nếu có)
  if (o.nguoiGui || o.phongBan) {
    els.push({
      tag: 'div', fields: [
        { is_short: true, text: { tag: 'lark_md', content: '**🙋 Người gửi**\n' + (o.nguoiGui || '—') } },
        { is_short: true, text: { tag: 'lark_md', content: '**🏢 Phòng ban**\n' + (o.phongBan || '—') } }
      ]
    });
  }
  if (o.ghiChu) els.push({ tag: 'div', text: { tag: 'lark_md', content: '**📝 Ghi chú:** ' + o.ghiChu } });
  let grand = 0, nSup = 0, nItems = 0;
  orders.forEach(function (od) {
    grand += Number(od.total) || 0; nSup++;
    els.push({ tag: 'hr' });
    els.push({ tag: 'div', text: { tag: 'lark_md', content: '🏭 **Nhà cung cấp:** <font color=\'blue\'>**' + (od.supplier || '—') + '**</font>' } });
    // Bảng SP bằng fields 2 cột (Lark render đẹp)
    const pf = [
      { is_short: true, text: { tag: 'lark_md', content: '<font color=\'grey\'>**SẢN PHẨM**</font>' } },
      { is_short: true, text: { tag: 'lark_md', content: '<font color=\'grey\'>**THÀNH TIỀN**</font>' } }
    ];
    (od.items || []).forEach(function (it, i) {
      nItems++;
      const tt = (Number(it.sl) || 0) * (Number(it.donGia) || 0);
      pf.push({ is_short: true, text: { tag: 'lark_md', content: '**' + (i + 1) + '.** ' + (it.ten || '') + '\n<font color=\'grey\'>' + (it.sl || 0) + ' ' + (it.dvt || '') + ' × ' + fmtVN(it.donGia) + ' đ</font>' } });
      pf.push({ is_short: true, text: { tag: 'lark_md', content: '**' + fmtVN(tt) + ' đ**' } });
    });
    els.push({ tag: 'div', fields: pf });
    els.push({
      tag: 'div', text: {
        tag: 'lark_md',
        content: 'VAT ' + (od.vatPct || 0) + '%: ' + fmtVN(od.vat) + ' đ　　💰 <font color=\'red\'>**TỔNG: ' + fmtVN(od.total) + ' đ**</font>'
      }
    });
  });
  els.push({ tag: 'hr' });
  els.push({
    tag: 'div', text: {
      tag: 'lark_md',
      content: (orders.length > 1 ? '💵 <font color=\'red\'>**TỔNG TẤT CẢ: ' + fmtVN(grand) + ' đ**</font>\n' : '') +
        '📦 ' + nSup + ' nhà cung cấp · ' + nItems + ' sản phẩm'
    }
  });
  els.push({ tag: 'note', elements: [{ tag: 'plain_text', content: '⚡ Gửi tự động từ Dezon QS Pro' }] });
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: 'blue',
        title: { tag: 'plain_text', content: '🛒 Yêu cầu mua hàng' },
        subtitle: { tag: 'plain_text', content: (o.project || '') }
      },
      elements: els
    }
  };
}
async function sendPurchaseRequest(order) {
  const payload = buildPurchaseCard(order || {});
  const r = await fetch(PURCHASE_WEBHOOK, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  let data = null; try { data = await r.json(); } catch (e) { data = null; }
  const ok = data && (data.code === 0 || data.StatusCode === 0 || data.msg === 'success');
  if (!ok) throw new Error((data && (data.msg || data.StatusMessage)) || ('HTTP ' + r.status));
  // Lưu đơn mua hàng vào DB (best-effort — không chặn kết quả gửi Lark)
  let savedMa = [];
  try {
    if (typeof store.savePurchaseOrder === 'function') {
      const rs = await store.savePurchaseOrder(Object.assign({ kenh: 'Lark', ketQua: 'ok' }, order || {}));
      savedMa = (rs && rs.saved) || [];
    }
  } catch (e) { console.warn('[mua hàng] lưu DB lỗi:', e && e.message); }
  return { ok: true, saved: savedMa };
}

app.post('/api/:fn', async function (req, res) {
  const fn = req.params.fn;
  const handler = REGISTRY[fn];
  if (typeof handler !== 'function') {
    return res.status(404).json({ error: 'Không hỗ trợ hàm: ' + fn });
  }
  const args = (req.body && Array.isArray(req.body.args)) ? req.body.args : [];
  try {
    const result = await handler.apply(null, args);
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
