'use strict';
const svc = require('./auth.service');

module.exports = {
  fns: {
    login: svc.login,
    me: svc.me,
    setMyPref: svc.setMyPref,
    logout: svc.logout,
    changePassword: svc.changePassword
  },
  public: ['login'],
  actor: ['me', 'setMyPref', 'logout', 'changePassword']
};
