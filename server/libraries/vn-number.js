'use strict';
/************************************************************
 * Hàm thuần về CHUỖI / SỐ kiểu Việt Nam (không chạm dữ liệu).
 * round0_ ở đây làm tròn SỐ thuần; bản hiểu chuỗi VN ("12.500") nằm ở utils.js.
 ************************************************************/

/*** ===== CHUỖI / SỐ ===== ***/
function normalize_(s) {
  return String(s == null ? '' : s).toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim();
}
function toNumber_(v) {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  var s = String(v).replace(/[^\d,.-]/g, '');
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  s = s.replace(',', '.');                     // "12,5" -> 12.5 (cùng luật với tkNum_ ở client)
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function round0_(n) { return Math.round(Number(n) || 0); }

module.exports = { normalize_, toNumber_, round0_ };
