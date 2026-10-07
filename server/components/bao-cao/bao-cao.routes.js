'use strict';
const svc = require('./bao-cao.service');

module.exports = {
  fns: {
    baoCaoNhapSP: svc.baoCaoNhapSP   // super chạy tay / dryRun báo cáo nhập SP
  },
  actor: ['baoCaoNhapSP'],
  super: ['baoCaoNhapSP']
};
