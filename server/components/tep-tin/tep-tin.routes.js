'use strict';
const express = require('express');
const lark = require('../../libraries/lark');          // chỉ còn dùng cho /media (ảnh cũ lưu trên Lark)
const { actorOf_ } = require('../../libraries/rpc');
const svc = require('./tep-tin.service');

const router = express.Router();

// Proxy ảnh attachment: /media?token=<file_token>
router.get('/media', async function (req, res) {
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

// Tải FILE tài liệu dạng nhị phân (body = nội dung file, ?name=tên gốc). Không base64 -> file lớn không phình.
router.post('/upload/file', express.raw({ type: function () { return true; }, limit: (svc.DOC_MAX_MB + 1) + 'mb' }), async function (req, res) {
  const actor = await actorOf_(req);
  if (!actor) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    const out = await svc.uploadFileBuf(req.body, String(req.query.name || ''), req.headers['content-type']);
    res.json(out);
  } catch (e) {
    console.error('[upload file] lỗi:', e && e.message);
    res.status(400).json({ error: e.message });
  }
});
// file vượt giới hạn body của express.raw -> trả JSON dễ hiểu thay vì trang lỗi HTML
router.use('/upload/file', function (err, req, res, next) {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'File quá lớn (tối đa ' + svc.DOC_MAX_MB + 'MB) — hãy dán link thay vì tải lên.' });
  next(err);
});

module.exports = {
  fns: {
    uploadImage: svc.uploadImage,
    uploadFile: svc.uploadFile        // bản cũ, giữ cho tab chưa tải lại
  },
  router: router
};
