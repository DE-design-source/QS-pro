'use strict';
const supa = require('../../libraries/supa');

/* ---------- CÔNG TY (multi-tenant) ---------- */
let _shareCol = null;   // cột dung_sp_dezon có tồn tại chưa (chưa chạy db/share_catalog.sql thì chưa có)
async function hasShareCol_() {
  if (_shareCol !== null) return _shareCol;
  try { await supa.select('cong_ty', { select: 'dung_sp_dezon', limit: 1, noScope: true }); _shareCol = true; }
  catch (e) { _shareCol = false; }
  return _shareCol;
}
function ctOut_(r) {
  return { id: r.id, ten: r.ten || '', ma: r.ma || '', logoUrl: r.logo_url || '', mauChinh: r.mau_chinh || '',
    tinhNang: String(r.tinh_nang || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
    gioiHanUser: Number(r.gioi_han_user) || 0, active: r.active !== false,
    hanDung: r.han_dung || '', ghiChu: r.ghi_chu || '', ngayTao: r.ngay_tao || '',
    email: r.email || '', sdt: r.sdt || '', dungSpDezon: r.dung_sp_dezon === true };
}
async function getCongTy(id) {
  if (!id) return null;
  const rows = await supa.select('cong_ty', { filter: supa.eq('id', id), limit: 1, noScope: true });
  return rows[0] ? ctOut_(rows[0]) : null;
}

module.exports = { hasShareCol_, ctOut_, getCongTy };
