'use strict';
const repo = require('./cong-tac.repository');
const svc = require('./cong-tac.service');

module.exports = {
  fns: {
    ctList: repo.ctList,
    ctSave: svc.ctSaveGated,
    ctUpdate: svc.ctUpdateGated,
    ctDelete: svc.ctDeleteGated,
    ctDuyet: svc.ctDuyetGated,
    ctFav: svc.ctFavGated,
    ctHistory: repo.ctGetHistory
  },
  actor: ['ctSave', 'ctUpdate', 'ctDelete', 'ctDuyet', 'ctFav']
};
