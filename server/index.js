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
app.use(express.static(path.join(__dirname, '..', 'public')));

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
  exportBaoGia: exportBaoGia
};

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
