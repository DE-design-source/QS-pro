'use strict';
const supa = require('../../libraries/supa');
const { n, s } = require('../../libraries/utils');

/*** ===== MUA HÀNG ===== ***/
function genMaDon_() { return 'MH-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1e4); }
// Lưu đơn mua hàng vào DB (mỗi nhà cung cấp = 1 đơn). Payload giống sendPurchaseRequest.
async function savePurchaseOrder(order) {
  order = order || {};
  const orders = Array.isArray(order.orders) ? order.orders : [];
  const saved = [];
  let dang = '';
  try {
  for (const od of orders) {
    const maDon = dang = genMaDon_();
    const items = Array.isArray(od.items) ? od.items : [];
    const total = n(od.total), vat = n(od.vat);
    await supa.insert('don_mua_hang', {
      ma_don: maDon, ma_du_an: s(order.maDA), ten_du_an: s(order.project), hang_muc: s(order.hangMuc || order.node),
      nha_cung_cap: s(od.supplier), so_sp: items.length, tong_truoc_vat: total - vat, vat_pct: n(od.vatPct),
      vat: vat, tong_cong: total, trang_thai: 'Chờ duyệt', kenh_gui: s(order.kenh) || 'Lark',
      ket_qua_gui: s(order.ketQua) || 'ok', nguoi_gui: s(order.nguoiGui), phong_ban: s(order.phongBan), ghi_chu: s(order.ghiChu),
      requester_id: order.requesterId || null
    });
    if (items.length) {
      await supa.insert('chi_tiet_mua_hang', items.map(function (it, i) {
        const sl = n(it.sl), dg = n(it.donGia);
        return { ma_don: maDon, ma_sp: s(it.ma), ten_sp: s(it.ten), thuong_hieu: s(it.thuongHieu), phong: s(it.khuVuc),
          dvt: s(it.dvt) || 'Cái', so_luong: sl, don_gia: dg, thanh_tien: sl * dg, hinh_anh: s(it.hinhAnh), sort_no: i };
      }));
    }
    saved.push(maDon);
  }
  } catch (e) {        // lỗi giữa chừng -> gỡ các phiếu của lần gửi này (không để phiếu thiếu dòng hàng / gửi lại bị trùng)
    for (const m of saved.concat(saved.indexOf(dang) < 0 && dang ? [dang] : [])) {
      try { await supa.remove('chi_tiet_mua_hang', supa.eq('ma_don', m)); await supa.remove('don_mua_hang', supa.eq('ma_don', m)); } catch (x) {}
    }
    throw e;
  }
  return { saved: saved };
}
// Lịch sử đơn mua hàng của 1 bản nháp (kèm chi tiết)
async function getPurchaseOrders(maDA) {
  const heads = await supa.select('don_mua_hang', { filter: supa.eq('ma_du_an', maDA), order: 'ngay_gui.desc' });
  if (!heads.length) return [];
  const out = [];
  for (const h of heads) {
    const dt = await supa.select('chi_tiet_mua_hang', { filter: supa.eq('ma_don', h.ma_don), order: 'sort_no.asc' });
    out.push({
      maDon: s(h.ma_don), ncc: s(h.nha_cung_cap), hangMuc: s(h.hang_muc), soSP: n(h.so_sp),
      tongTruocVat: n(h.tong_truoc_vat), vatPct: n(h.vat_pct), vat: n(h.vat), tongCong: n(h.tong_cong),
      trangThai: s(h.trang_thai), nguoiGui: s(h.nguoi_gui), phongBan: s(h.phong_ban), ghiChu: s(h.ghi_chu), ngayGui: s(h.ngay_gui),
      items: dt.map(function (r) { return { ma: s(r.ma_sp), ten: s(r.ten_sp), thuongHieu: s(r.thuong_hieu), khuVuc: s(r.phong), dvt: s(r.dvt), sl: n(r.so_luong), donGia: n(r.don_gia), thanhTien: n(r.thanh_tien), hinhAnh: s(r.hinh_anh) }; })
    });
  }
  return out;
}

module.exports = { savePurchaseOrder, getPurchaseOrders };
