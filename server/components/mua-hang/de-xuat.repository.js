'use strict';
const supa = require('../../libraries/supa');
const { n, s, round0_ } = require('../../libraries/utils');

/*** ===== ĐỀ XUẤT MUA HÀNG (chiết khấu / thanh toán) =====
 Tách hẳn khỏi don_mua_hang: đề xuất KHÔNG phải đơn đặt hàng, nên không trộn
 vào hàng chờ duyệt của mua hàng. Bảng: de_xuat + chi_tiet_de_xuat.       ***/
function dxThieuBang_(e) {
  const m = String((e && e.message) || '');
  return /de_xuat/.test(m) && /(does not exist|not find the table|42P01|PGRST205|404)/i.test(m);
}
function genMaDeXuat_(loai) {
  return (loai === 'tt' ? 'TT-' : 'CK-') + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1e4);
}
// payload: {loai, maDA, project, hangMuc, supplier, vatPct, nguoiGui, phongBan, ghiChu, requesterId,
//           items:[...]  (loai 'ck')   |   dots:[...] (loai 'tt')}
async function saveDeXuat(dx) {
  dx = dx || {};
  const loai = dx.loai === 'tt' ? 'tt' : 'ck';
  const ma = genMaDeXuat_(loai);
  const items = Array.isArray(dx.items) ? dx.items : [];
  const dots = Array.isArray(dx.dots) ? dx.dots : [];
  const vatPct = n(dx.vatPct);
  let tongGoc = 0, tongDx = 0, soDong = 0;
  if (loai === 'ck') {
    items.forEach(function (it) { tongGoc += n(it.sl) * n(it.donGiaGoc); tongDx += n(it.sl) * n(it.donGia); });
    soDong = items.length;
  } else {
    tongDx = dots.reduce(function (a, d) { return a + n(d.tien); }, 0);
    tongGoc = n(dx.tongDon) || tongDx;
    soDong = dots.length;
  }
  const vat = loai === 'ck' ? round0_(tongDx * vatPct / 100) : 0;
  try {
  await supa.insert('de_xuat', {
    ma_de_xuat: ma, loai: loai, ma_du_an: s(dx.maDA), ten_du_an: s(dx.project), hang_muc: s(dx.hangMuc),
    nha_cung_cap: s(dx.supplier), so_dong: soDong,
    tong_goc: round0_(tongGoc), tong_de_xuat: round0_(tongDx), tien_giam: round0_(Math.max(0, tongGoc - tongDx)),
    vat_pct: vatPct, vat: vat, tong_cong: round0_(tongDx + vat),
    trang_thai: 'Chờ duyệt', nguoi_gui: s(dx.nguoiGui), phong_ban: s(dx.phongBan), ghi_chu: s(dx.ghiChu),
    requester_id: dx.requesterId || null
  });
  } catch (e) {
    if (dxThieuBang_(e)) throw new Error('Chưa có bảng "de_xuat" trong CSDL — mở Supabase → SQL Editor và chạy file db/de_xuat.sql một lần, rồi gửi lại.');
    throw e;
  }
  try {
  if (loai === 'ck' && items.length) {
    await supa.insert('chi_tiet_de_xuat', items.map(function (it, i) {
      const sl = n(it.sl), dg = n(it.donGia);
      return { ma_de_xuat: ma, sort_no: i, ma_sp: s(it.ma), ten_sp: s(it.ten), thuong_hieu: s(it.thuongHieu),
        phong: s(it.khuVuc), dvt: s(it.dvt) || 'Cái', so_luong: sl, don_gia_goc: n(it.donGiaGoc),
        ty_le_pct: n(it.giamGiaPct), don_gia: dg, thanh_tien: round0_(sl * dg), hinh_anh: s(it.hinhAnh) };
    }));
  }
  if (loai === 'tt' && dots.length) {
    await supa.insert('chi_tiet_de_xuat', dots.map(function (d, i) {
      return { ma_de_xuat: ma, sort_no: i, ten_sp: 'Đợt ' + (n(d.dot) || i + 1), ty_le_pct: n(d.pct),
        thanh_tien: round0_(n(d.tien)), ngay_du_kien: d.ngay || null, ghi_chu: s(d.gc) };
    }));
  }
  } catch (e) { try { await supa.remove('de_xuat', supa.eq('ma_de_xuat', ma)); } catch (x) {} throw e; }   // không để phiếu rỗng
  return { ma: ma, loai: loai, total: round0_(tongDx + vat) };
}
function dxHead_(h) {
  return { ma: s(h.ma_de_xuat), loai: s(h.loai) || 'ck', maDA: s(h.ma_du_an), project: s(h.ten_du_an),
    hangMuc: s(h.hang_muc), supplier: s(h.nha_cung_cap), soDong: n(h.so_dong),
    tongGoc: n(h.tong_goc), tongDeXuat: n(h.tong_de_xuat), tienGiam: n(h.tien_giam),
    vatPct: n(h.vat_pct), vat: n(h.vat), total: n(h.tong_cong), status: s(h.trang_thai),
    requester: s(h.nguoi_gui), phongBan: s(h.phong_ban), ghiChu: s(h.ghi_chu),
    nguoiDuyet: s(h.nguoi_duyet), ngayDuyet: s(h.ngay_duyet), at: s(h.ngay_gui) };
}
function dxItem_(r) {
  return { ma: s(r.ma_sp), ten: s(r.ten_sp), thuongHieu: s(r.thuong_hieu), phong: s(r.phong), dvt: s(r.dvt),
    sl: n(r.so_luong), donGiaGoc: n(r.don_gia_goc), pct: n(r.ty_le_pct), donGia: n(r.don_gia),
    thanhTien: n(r.thanh_tien), ngay: s(r.ngay_du_kien), ghiChu: s(r.ghi_chu), hinhAnh: s(r.hinh_anh) };
}
// Đề xuất của 1 bản nháp (kèm chi tiết) — hiện trong tab Mua hàng
async function getDeXuatList(maDA) {
  let heads = [];
  try { heads = await supa.select('de_xuat', { filter: supa.eq('ma_du_an', maDA), order: 'ngay_gui.desc', limit: 300 }); }
  catch (e) { if (dxThieuBang_(e)) return []; throw e; }
  if (!heads.length) return [];
  const out = [];
  for (const h of heads) {
    const dt = await supa.select('chi_tiet_de_xuat', { filter: supa.eq('ma_de_xuat', h.ma_de_xuat), order: 'sort_no.asc' });
    out.push(Object.assign(dxHead_(h), { items: dt.map(dxItem_) }));
  }
  return out;
}

module.exports = { saveDeXuat, getDeXuatList, dxHead_, dxItem_ };
