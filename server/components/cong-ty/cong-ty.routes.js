'use strict';
const svc = require('./cong-ty.service');

module.exports = {
  fns: {
    listCongTy: svc.listCongTy,
    createCongTy: svc.createCongTy,
    updateCongTy: svc.updateCongTy,
    deleteCongTy: svc.deleteCongTy,
    listCongTyUsers: svc.listCongTyUsers,
    createCongTyUser: svc.createCongTyUser
  },
  actor: ['listCongTy', 'createCongTy', 'updateCongTy', 'deleteCongTy', 'listCongTyUsers', 'createCongTyUser'],
  admin: ['updateCongTy'],      // Chủ công ty đổi logo/tên công ty mình (hàm tự kiểm đúng công ty)
  super: ['listCongTy', 'createCongTy', 'deleteCongTy', 'listCongTyUsers', 'createCongTyUser']
};
