'use strict';
const config = require('../../config');
const supa = require('../../libraries/supa');
const { getUserById } = require('../users/users.repository');
const { getAdmins_, notify_ } = require('../thong-bao/thong-bao.service');
const { audit } = require('../thong-bao/audit');
const repo = require('./de-xuat.repository');
const { buildDeXuatCard } = require('./lark-card');

const PURCHASE_WEBHOOK = config.purchaseWebhook;

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
  return rows.map(repo.dxHead_);
}
async function getDeXuat(actor, ma) {
  const h = (await supa.select('de_xuat', { filter: supa.eq('ma_de_xuat', ma), limit: 1 }))[0];
  if (!h) throw new Error('Không tìm thấy đề xuất');
  const dt = await supa.select('chi_tiet_de_xuat', { filter: supa.eq('ma_de_xuat', ma), order: 'sort_no.asc' });
  return Object.assign(repo.dxHead_(h), { items: dt.map(repo.dxItem_) });
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

// Gửi ĐỀ XUẤT: lưu vào bảng de_xuat (KHÔNG tạo đơn mua hàng), báo Admin, rồi bắn thẻ Lark
async function sendDeXuat(actor, dx) {
  dx = dx || {};
  const saved = await repo.saveDeXuat(Object.assign({ requesterId: actor && actor.uid }, dx));
  try {
    await notifyDeXuatAdmins(actor, { ma: saved.ma, loai: saved.loai, supplier: dx.supplier });
  } catch (e) { console.warn('[đề xuất] notify lỗi:', e && e.message); }
  let larkOk = false;
  try {
    const r = await fetch(PURCHASE_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDeXuatCard(dx, saved.ma))
    });
    let data = null; try { data = await r.json(); } catch (e) { data = null; }
    larkOk = !!(data && (data.code === 0 || data.StatusCode === 0 || data.msg === 'success'));
    if (!larkOk) console.warn('[đề xuất] webhook Lark trả lỗi:', (data && (data.msg || data.StatusMessage)) || ('HTTP ' + r.status));
  } catch (e) { console.warn('[đề xuất] webhook lỗi:', e && e.message); }
  return { ok: true, ma: saved.ma, loai: saved.loai, total: saved.total, lark: larkOk };
}

module.exports = { notifyDeXuatAdmins, listDeXuat, getDeXuat, resolveDeXuat, sendDeXuat };
