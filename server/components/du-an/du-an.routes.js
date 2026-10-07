'use strict';
const repo = require('./du-an.repository');
const dong = require('./dong-boc-tach.repository');
const khaiToan = require('./khai-toan.repository');
const svc = require('./du-an.service');

module.exports = {
  fns: {
    bootstrap: svc.bootstrap,
    getProjects: repo.getProjects,
    createProject: repo.createProject,
    updateProject: repo.updateProject,
    deleteProject: repo.deleteProject,
    duplicateProject: repo.duplicateProject,
    getProjData: repo.getProjData,
    setProjData: repo.setProjData,
    getLines: dong.getLines,
    addLine: dong.addLine,
    addBlankLine: dong.addBlankLine,
    updateLine: dong.updateLine,
    deleteLine: dong.deleteLine,
    saveCover: khaiToan.saveCover,
    buildCoverFromTemplate: khaiToan.buildCoverFromTemplate,
    getCoverOrInit: khaiToan.getCoverOrInit
  },
  actor: ['setProjData']
};
