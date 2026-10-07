'use strict';
const express = require('express');
const tenant = require('../../libraries/tenant');
const { actorOf_ } = require('../../libraries/rpc');
const exportBaoGia = require('./bao-gia.export');
const { exportProductsXlsx, exportCongTacXlsx } = require('./danh-sach.export');

const router = express.Router();

// Tải file: POST vì danh sách mã có thể dài, và cần token trong body
router.post('/export/cong-tac', async function (req, res) {
  const actor = await actorOf_(req);
  if (!actor) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    const rows = (req.body && Array.isArray(req.body.rows)) ? req.body.rows.slice(0, 5000) : [];
    if (!rows.length) return res.status(400).json({ error: 'Không có dòng nào để xuất' });
    const out = await exportCongTacXlsx(rows);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="' + out.name + '"');
    res.set('X-Row-Count', String(out.count));
    res.send(Buffer.from(out.buf));
  } catch (e) {
    console.error('[export cong tac] lỗi:', e && e.message);
    res.status(500).json({ error: e.message });
  }
});
router.post('/export/san-pham', async function (req, res) {
  const actor = await actorOf_(req);
  if (!actor) return res.status(401).json({ error: 'Chưa đăng nhập' });
  const viewAs = actor.r === 'super' ? (req.headers['x-view-company'] || '') : '';
  const tctx = { uid: actor.uid, role: actor.r, congTyId: actor.ct || null, viewAs: viewAs || null };
  try {
    const keys = (req.body && Array.isArray(req.body.keys)) ? req.body.keys : null;
    const out = await tenant.run(tctx, function () { return exportProductsXlsx(keys); });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="' + out.name + '"');
    res.set('X-Row-Count', String(out.count));
    res.send(Buffer.from(out.buf));
  } catch (e) {
    console.error('[export SP] lỗi:', e && e.message);
    res.status(500).json({ error: e.message });
  }
});

// Xuất 1 bảng do client dựng sẵn ra Excel: {ten, sheet, cols:[{label,num}], rows:[{cells}|{group}], tong:[[nhãn,số]]}
router.post('/export/bang', async function (req, res) {
  const actor = await actorOf_(req);
  if (!actor) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    const b = req.body || {};
    if (!Array.isArray(b.cols) || !b.cols.length) return res.status(400).json({ error: 'Không có cột nào để xuất' });
    const buf = await exportBaoGia.buildBangXlsx(b);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="bang.xlsx"');
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[export bảng] lỗi:', e && e.message);
    res.status(500).json({ error: e.message });
  }
});

// File mẫu nhập hàng loạt THIẾT BỊ VỆ SINH — tạo động từ public/vs-spec.js (1 sheet "San pham" như mẫu đèn)
router.get('/mau-nhap-thiet-bi-ve-sinh.xlsx', async function (req, res) {
  try {
    const buf = await require('./vs-template').buildVsTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', "attachment; filename=\"Mau-nhap-thiet-bi-ve-sinh-DezonQS.xlsx\"");
    res.setHeader('Cache-Control', 'no-cache');
    res.send(Buffer.from(buf));
  } catch (e) { res.status(500).send('Lỗi tạo file mẫu: ' + (e && e.message)); }
});
// File mẫu nhập hàng loạt SƠN NƯỚC — tạo động từ public/son-spec.js (1 sheet "San pham" như mẫu đèn)
router.get('/mau-nhap-son-nuoc.xlsx', async function (req, res) {
  try {
    const hm = String((req.query && req.query.hm) || '').trim();
    const buf = await require('./son-template').buildSonTemplate(hm);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const SON = require('../../../public/son-spec.js');
    const ten = SON.chuanHM(hm) ? ('Mau-nhap-' + SON.chuanHM(hm).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').replace(/[^\w]+/g,'-')) : 'Mau-nhap-son-nuoc';
    res.setHeader('Content-Disposition', 'attachment; filename="' + ten + '-DezonQS.xlsx"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(Buffer.from(buf));
  } catch (e) { res.status(500).send('Lỗi tạo file mẫu: ' + (e && e.message)); }
});

module.exports = {
  fns: { exportBaoGia: exportBaoGia },
  router: router
};
