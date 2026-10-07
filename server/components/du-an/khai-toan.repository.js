'use strict';
const supa = require('../../libraries/supa');
const { n, s } = require('../../libraries/utils');
const { COVER_TEMPLATE, inCode } = require('./cover-template');
const { getLines } = require('./dong-boc-tach.repository');

/*** ===== KHÁI TOÁN (khai_toan) ===== ***/
async function getCover(maDA) {
  const rows = await supa.select('khai_toan', { filter: supa.eq('ma_da', maDA), order: 'sort_no.asc', limit: 2000 });
  return rows.map(function (r) { return { stt: s(r.stt), hangMuc: s(r.hang_muc), moTa: s(r.mo_ta), chiPhi: n(r.chi_phi) }; });
}
// Nạp mẫu tờ bìa + tự cộng chi phí theo nhóm (đọc dòng từ Supabase, KHÔNG gọi Lark)
async function buildCoverFromTemplate(maDA) {
  // STT tờ bìa = mã hạng mục Bóc tách -> mục LÁ cộng thành tiền mọi dòng có nhom thuộc mục đó
  // (mẫu cũ khớp theo tên nhóm kiểu Lark '3.2.5.THIẾT BỊ ...' nên luôn ra 0)
  const tmpl = COVER_TEMPLATE;
  const lines = maDA ? await getLines(maDA) : [];
  const isLeaf = function (st) { return !tmpl.some(function (t) { return t[0] !== st && t[0].indexOf(st + '.') === 0; }); };
  return tmpl.map(function (t) {
    let chiPhi = 0;
    if (isLeaf(t[0])) lines.forEach(function (l) { if (inCode(l.nhom, t[0])) chiPhi += n(l.thanhTienBan); });
    return { stt: t[0], hangMuc: t[1], moTa: t[2], chiPhi: Math.round(chiPhi) };
  });
}
async function getCoverOrInit(maDA) {
  const cur = await getCover(maDA);
  if (cur.length) return cur;
  return buildCoverFromTemplate(maDA);
}
async function saveCover(maDA, rows) {
  // Ghi bản mới TRƯỚC rồi mới xoá bản cũ: ghi lỗi giữa chừng không làm mất tờ bìa
  const old = await supa.select('khai_toan', { select: 'id', filter: supa.eq('ma_da', maDA), limit: 2000 });
  const arr = (rows || []).map(function (r, i) { return { ma_da: maDA, stt: s(r.stt), hang_muc: s(r.hangMuc), mo_ta: s(r.moTa), chi_phi: n(r.chiPhi), sort_no: i }; });
  if (arr.length) await supa.insert('khai_toan', arr);
  if (old.length) await supa.remove('khai_toan', 'id=in.(' + old.map(function (r) { return r.id; }).join(',') + ')');
  return getCover(maDA);   // client gán thẳng S.cover = kết quả -> phải là mảng dòng
}

module.exports = { getCover, buildCoverFromTemplate, getCoverOrInit, saveCover };
