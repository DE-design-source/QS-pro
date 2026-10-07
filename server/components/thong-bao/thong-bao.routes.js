'use strict';
const audit = require('./audit');
const svc = require('./thong-bao.service');

module.exports = {
  fns: {
    getAuditLog: audit.getAuditLog,
    logClientError: audit.logClientError,
    notifCount: svc.notifCount,
    notifList: svc.notifList,
    notifRead: svc.notifRead,
    notifReadAll: svc.notifReadAll
  },
  actor: ['logClientError', 'notifCount', 'notifList', 'notifRead', 'notifReadAll'],
  admin: ['getAuditLog']
};
