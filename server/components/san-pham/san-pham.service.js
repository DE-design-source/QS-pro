'use strict';
const { getUserById, permsArr_ } = require('../users/users.repository');
const repo = require('./san-pham.repository');
const imp = require('./san-pham.import');
const combo = require('./san-pham.combo');
const bienThe = require('./san-pham.bien-the');
const yeuThich = require('./san-pham.yeu-thich');

/* ═══════════════════════════════════════════════════════════════
   QUYỀN SỬA / DUYỆT SẢN PHẨM  (trạng thái duyệt nằm TRÊN sản phẩm)
   - 'sp_edit'  : sửa thẳng. Sửa xong sản phẩm quay về CHƯA DUYỆT.
   - 'sp_duyet' : sửa thẳng + bấm Duyệt để đánh dấu ĐÃ DUYỆT.
   - admin/super: có cả hai.
   Không có bước "gửi duyệt": mọi thay đổi ghi ngay vào danh mục, trạng thái
   duyệt và toàn bộ lịch sử sửa nằm ở chính sản phẩm.
   ═══════════════════════════════════════════════════════════════ */
async function spPerms_(actor) {
  if (!actor) return { edit: false, duyet: false };
  if (actor.r === 'admin' || actor.r === 'super') return { edit: true, duyet: true, admin: true };
  const u = await getUserById(actor.uid);
  const ps = permsArr_(u && u.perms);
  // Chưa cấu hình gì -> giữ như cũ: sửa + duyệt (tránh khoá tài khoản đang dùng)
  if (ps.indexOf('sp_edit') < 0 && ps.indexOf('sp_duyet') < 0) return { edit: true, duyet: true };
  const duyet = ps.indexOf('sp_duyet') >= 0;
  return { edit: duyet || ps.indexOf('sp_edit') >= 0, duyet: duyet };
}
async function spMyPerms(actor) { return spPerms_(actor); }
// CỬA NGÕ: mọi lệnh sửa sản phẩm của client đều vào đây để kiểm quyền
async function updateProductGated(actor, key, data) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền sửa sản phẩm');
  return repo.updateDbProductTracked(actor, key, data);
}
// THÊM sản phẩm (form Nhập dữ liệu, lưu dòng bóc tách thành SP) — cần quyền sửa
async function createProductGated(actor, data) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền thêm/sửa sản phẩm');
  return repo.saveDbProduct(actor, data);
}
// NHẬP HÀNG LOẠT từ file — cần quyền sửa
async function importGated(actor, products) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền nhập sản phẩm');
  return imp.importCommit(actor, products);
}
// Lưu 1 dòng bóc tách thành sản phẩm trong danh mục — cần quyền sửa
async function saveLineAsProductGated(actor, line) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền thêm sản phẩm vào danh mục');
  return repo.saveLineAsProduct(actor, line);
}
// Đặt danh sách sản phẩm đi kèm (combo) — cần quyền sửa
async function setComboGated(actor, key, items) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền sửa sản phẩm');
  return combo.setCombo(actor, key, items);
}
// Gom nhóm biến thể — cần quyền sửa (giống combo)
async function setBienTheGated(actor, key, ids) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền sửa sản phẩm');
  return bienThe.setBienThe(actor, key, ids);
}
// Duyệt / bỏ duyệt sản phẩm — chỉ tài khoản có quyền duyệt
async function setSpDuyet(actor, keys, approve) {
  const p = await spPerms_(actor);
  if (!p.duyet) throw new Error('Tài khoản không có quyền duyệt sản phẩm');
  return repo.setSpDuyet(actor, keys, approve !== false);
}

/* Yêu thích: chỉ là dấu trang của công ty, không đụng vào dữ liệu sản phẩm
   -> mọi tài khoản đăng nhập đều được bật/tắt, không cần quyền sp_edit. */
async function setYeuThich(actor, keys, on) {
  return yeuThich.setYeuThich(actor, keys, on !== false);
}

module.exports = {
  spPerms_, spMyPerms, updateProductGated, createProductGated, importGated, saveLineAsProductGated,
  setComboGated, setBienTheGated, setSpDuyet, setYeuThich
};
