'use strict';
/* Danh sách biến thể file mẫu được đối chiếu: 1 file VS, SON / CT gộp + từng hạng mục + 1 tên gõ không dấu. */
const path = require('path');
const root = path.join(__dirname, '../../../../..');
const SON = require(path.join(root, 'backend/internal/shared/specs/js/son-spec.js'));
const CT = require(path.join(root, 'backend/internal/shared/specs/js/ct-spec.js'));
const vsT = require(path.join(root, 'server/vs-template.js'));
const sonT = require(path.join(root, 'server/son-template.js'));
const ctT = require(path.join(root, 'server/ct-template.js'));

function variants() {
  const out = [{ name: 'vs', kind: 'vs', hm: '', build: function () { return vsT.buildVsTemplate(); } }];
  const son = [''].concat(SON.HANG_MUC, ['  son  LOT ', 'khong co']);
  son.forEach(function (hm, i) { out.push({ name: 'son-' + i, kind: 'son', hm: hm, build: function () { return sonT.buildSonTemplate(hm); } }); });
  const ct = [''].concat(CT.HANG_MUC, ['cong tac co', 'khong co']);
  ct.forEach(function (hm, i) { out.push({ name: 'ct-' + i, kind: 'ct', hm: hm, build: function () { return ctT.buildCtTemplate(hm); } }); });
  return out;
}

module.exports = { variants: variants };
