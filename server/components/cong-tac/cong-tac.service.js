'use strict';
const { spPerms_ } = require('../san-pham/san-pham.service');
const repo = require('./cong-tac.repository');

/* ---------- Công tác xây dựng (Phần thô) ----------
   Dùng chung quyền với sản phẩm: sửa được sản phẩm thì nhập/sửa được công tác,
   duyệt được sản phẩm thì duyệt được công tác.                                */
async function ctSaveGated(actor, data) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền thêm dữ liệu');
  return repo.ctSave(actor, data);
}
async function ctUpdateGated(actor, id, patch) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền sửa dữ liệu');
  return repo.ctUpdate(actor, id, patch);
}
async function ctDeleteGated(actor, ids) {
  const p = await spPerms_(actor);
  if (!p.edit) throw new Error('Tài khoản không có quyền xoá dữ liệu');
  return repo.ctDelete(actor, ids);
}
async function ctDuyetGated(actor, ids, approve) {
  const p = await spPerms_(actor);
  if (!p.duyet) throw new Error('Tài khoản không có quyền duyệt');
  return repo.ctDuyet(actor, ids, approve !== false);
}
async function ctFavGated(actor, ids, on) {
  return repo.ctFav(actor, ids, on !== false);   // yêu thích = dấu trang của công ty, ai cũng bật/tắt được
}

module.exports = { ctSaveGated, ctUpdateGated, ctDeleteGated, ctDuyetGated, ctFavGated };
