'use strict';
const config = require('../../config');
const supa = require('../../libraries/supa');
const { getUserById } = require('../users/users.repository');
const { getAdmins_, notify_ } = require('../thong-bao/thong-bao.service');
const { audit } = require('../thong-bao/audit');
const repo = require('./mua-hang.repository');
const { buildPurchaseCard } = require('./lark-card');

const PURCHASE_WEBHOOK = config.purchaseWebhook;

/* ---------- Yêu cầu mua hàng (thông báo + duyệt) ---------- */
async function notifyPurchaseAdmins(actor, orders) {
  orders = orders || [];
  const me = await getUserById(actor.uid);
  const who = me ? (me.ho_ten || me.username) : (actor.u || '');
  const admins = await getAdmins_();
  for (var i = 0; i < orders.length; i++) {
    for (var j = 0; j < admins.length; j++) {
      await notify_(admins[j].id, 'purchase_request', 'Yêu cầu mua hàng', who + ' gửi đơn ' + orders[i].maDon + (orders[i].supplier ? ' (' + orders[i].supplier + ')' : ''), String(orders[i].maDon));
    }
  }
  await audit(actor, 'request_purchase', who + ' gửi ' + orders.length + ' đơn mua hàng');
}
async function listPurchaseRequests(actor) {
  const rows = await supa.select('don_mua_hang', { order: 'ngay_gui.desc', limit: 200 });
  return rows.map(function (r) {
    return { maDon: r.ma_don, project: r.ten_du_an, supplier: r.nha_cung_cap, soSp: Number(r.so_sp) || 0,
      total: Number(r.tong_cong) || 0, status: r.trang_thai, requester: r.nguoi_gui, phongBan: r.phong_ban, at: r.ngay_gui };
  });
}
// Chi tiết 1 đơn mua hàng (header + danh sách sản phẩm) — để Admin xem trước khi duyệt
async function getPurchaseOrder(actor, maDon) {
  const h = (await supa.select('don_mua_hang', { filter: supa.eq('ma_don', maDon), limit: 1 }))[0];
  if (!h) throw new Error('Không tìm thấy đơn mua hàng');
  const dt = await supa.select('chi_tiet_mua_hang', { filter: supa.eq('ma_don', maDon), order: 'sort_no.asc' });
  const n = function (v) { return Number(v) || 0; };
  const s = function (v) { return v == null ? '' : String(v); };
  return {
    maDon: s(h.ma_don), project: s(h.ten_du_an), maDA: s(h.ma_du_an), supplier: s(h.nha_cung_cap),
    hangMuc: s(h.hang_muc), soSp: n(h.so_sp), tongTruocVat: n(h.tong_truoc_vat), vatPct: n(h.vat_pct),
    vat: n(h.vat), total: n(h.tong_cong), status: s(h.trang_thai), requester: s(h.nguoi_gui),
    phongBan: s(h.phong_ban), ghiChu: s(h.ghi_chu), at: s(h.ngay_gui),
    nguoiDuyet: s(h.nguoi_duyet), ngayDuyet: s(h.ngay_duyet),
    items: dt.map(function (r) {
      return { ma: s(r.ma_sp), ten: s(r.ten_sp), thuongHieu: s(r.thuong_hieu), phong: s(r.phong),
        dvt: s(r.dvt), sl: n(r.so_luong), donGia: n(r.don_gia), thanhTien: n(r.thanh_tien), hinhAnh: s(r.hinh_anh) };
    })
  };
}
async function resolvePurchaseRequest(actor, maDon, approve) {
  const r = (await supa.select('don_mua_hang', { filter: supa.eq('ma_don', maDon), limit: 1 }))[0];
  if (!r) throw new Error('Không tìm thấy đơn mua hàng');
  const status = approve ? 'Đã duyệt' : 'Từ chối';
  // Chỉ đổi khi còn "Chờ duyệt": bấm 2 lần / 2 admin cùng duyệt không lật được kết quả
  const upd = await supa.update('don_mua_hang', supa.eq('ma_don', maDon) + '&trang_thai=eq.' + encodeURIComponent('Chờ duyệt'), { trang_thai: status });
  if (!upd || !upd.length) throw new Error('Đơn đã được xử lý');
  if (r.requester_id) await notify_(r.requester_id, approve ? 'purchase_approved' : 'purchase_rejected',
    approve ? 'Đơn mua hàng đã được duyệt' : 'Đơn mua hàng bị từ chối',
    'Đơn ' + maDon + (r.nha_cung_cap ? ' (' + r.nha_cung_cap + ')' : ''), String(maDon));
  await audit(actor, approve ? 'approve_purchase' : 'reject_purchase', status + ' đơn ' + maDon + ' của ' + (r.nguoi_gui || ''));
  return { ok: true };
}

// Theo dõi đơn sau khi duyệt: Đã duyệt -> Đã đặt hàng -> Đã nhận hàng (phòng mua hàng bấm ở tab Mua hàng).
// Chỉ cho đi đúng 1 bước từ trạng thái liền trước (đổi có điều kiện) -> bấm trùng / 2 người cùng bấm không nhảy cóc.
const PO_BUOC = { 'Đã đặt hàng': 'Đã duyệt', 'Đã nhận hàng': 'Đã đặt hàng' };
async function setPurchaseStatus(actor, maDon, status) {
  const truoc = PO_BUOC[status]; if (!truoc) throw new Error('Trạng thái không hợp lệ');
  const upd = await supa.update('don_mua_hang', supa.eq('ma_don', maDon) + '&trang_thai=eq.' + encodeURIComponent(truoc), { trang_thai: status });
  if (!upd || !upd.length) throw new Error('Đơn phải ở trạng thái "' + truoc + '" mới chuyển sang "' + status + '"');
  await audit(actor, 'purchase_status', status + ' — đơn ' + maDon);
  return { ok: true, status: status };
}

async function sendPurchaseRequest(actor, order) {
  order = order || {};
  // 1) Lưu đơn + thông báo Admin duyệt — luồng duyệt TRONG APP, luôn chạy (không phụ thuộc webhook Lark)
  // Lưu lỗi thì báo lỗi cho người dùng (trước đây nuốt lỗi -> báo "đã gửi" mà không có đơn chờ duyệt)
  const rs = await repo.savePurchaseOrder(Object.assign({ kenh: 'Lark', ketQua: 'pending', requesterId: actor && actor.uid }, order));
  const savedMa = (rs && rs.saved) || [];
  try {
    if (savedMa.length) {
      const ords = (Array.isArray(order.orders) ? order.orders : []);
      await notifyPurchaseAdmins(actor, savedMa.map(function (ma, i) { return { maDon: ma, supplier: ords[i] && ords[i].supplier }; }));
    }
  } catch (e) { console.warn('[mua hàng] notify lỗi:', e && e.message); }
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

module.exports = { notifyPurchaseAdmins, listPurchaseRequests, getPurchaseOrder, resolvePurchaseRequest, setPurchaseStatus, sendPurchaseRequest };
