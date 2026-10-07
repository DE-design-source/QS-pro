'use strict';
const repo = require('./san-pham.repository');
const combo = require('./san-pham.combo');
const bienThe = require('./san-pham.bien-the');
const imp = require('./san-pham.import');
const svc = require('./san-pham.service');
const xoa = require('./yeu-cau-xoa.service');

module.exports = {
  fns: {
    getProducts: repo.getProducts,
    saveLineAsProduct: svc.saveLineAsProductGated,
    saveDbProduct: svc.createProductGated,   // cửa ngõ: cần quyền sửa + đóng dấu người tạo
    deleteDbProduct: repo.deleteDbProduct,
    getDbProduct: repo.getDbProduct,
    updateDbProductTracked: svc.updateProductGated,   // cửa ngõ: chỉ 'sp_edit' -> tạo phiếu chờ duyệt
    setSpDuyet: svc.setSpDuyet,
    setYeuThich: svc.setYeuThich,
    getCombo: combo.getCombo,
    setCombo: svc.setComboGated,
    getBienThe: bienThe.getBienThe,
    setBienThe: svc.setBienTheGated,
    spMyPerms: svc.spMyPerms,
    getProductHistory: repo.getProductHistory,
    importParse: imp.importParse,
    importCommit: svc.importGated,
    requestDeleteProducts: xoa.requestDeleteProducts,
    listDeleteRequests: xoa.listDeleteRequests,
    resolveDeleteRequest: xoa.resolveDeleteRequest
  },
  actor: ['saveLineAsProduct', 'saveDbProduct', 'deleteDbProduct', 'updateDbProductTracked', 'setSpDuyet', 'setYeuThich',
    'setCombo', 'setBienThe', 'spMyPerms', 'importCommit', 'requestDeleteProducts', 'listDeleteRequests', 'resolveDeleteRequest'],
  admin: ['listDeleteRequests', 'resolveDeleteRequest',
    'deleteDbProduct']     // Xóa sản phẩm trực tiếp: CHỈ Admin (nhân viên phải gửi yêu cầu)
};
