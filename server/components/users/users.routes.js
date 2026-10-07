'use strict';
const svc = require('./users.service');

const FNS = ['adminListUsers', 'adminCreateUser', 'adminUpdateUser', 'adminSetPassword', 'adminSetActive', 'adminDeleteUser'];

module.exports = {
  fns: {
    adminListUsers: svc.adminListUsers,
    adminCreateUser: svc.adminCreateUser,
    adminUpdateUser: svc.adminUpdateUser,
    adminSetPassword: svc.adminSetPassword,
    adminSetActive: svc.adminSetActive,
    adminDeleteUser: svc.adminDeleteUser
  },
  actor: FNS,
  admin: FNS
};
