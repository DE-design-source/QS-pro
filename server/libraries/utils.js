'use strict';
/************************************************************
 * Hàm nhỏ dùng chung cho tầng dữ liệu: ép số / chuỗi, định dạng đơn vị, giới hạn dòng truy vấn.
 ************************************************************/
const { toNumber_ } = require('./vn-number');

/*** ===== HELPERS ===== ***/
// Số từ client / file nhập: số giữ nguyên; chuỗi đọc kiểu VN ("12.500.000", "12,5", "30%") — Number() cho 0
function n(v) { if (v == null || v === '') return 0; return typeof v === 'number' ? (isFinite(v) ? v : 0) : toNumber_(v); }
function round0_(v) { return Math.round(n(v)); }
function s(v) { return v == null ? '' : String(v); }
function nowIso() { return new Date().toISOString(); }
function firstImg(v) { var a = s(v).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); return a[0] || ''; }
function fmtUnit(v, unit) { if (v == null || v === '') return ''; var t = String(v); return new RegExp(unit + '$', 'i').test(t) ? t : t + unit; }
function fmtList(v, unit) { return s(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return new RegExp(unit + '$', 'i').test(x) ? x : x + unit; }).join(', '); }

// Lỗ khoét: cho nhập tự do (Ø75 · Ø40×78 · 60×60). Chỉ thêm Ø/mm khi người dùng CHƯA gõ.
function fmtCutout_(v) {
  var t = s(v).trim(); if (!t) return '';
  if (/^[\d.,]+$/.test(t)) return 'Ø' + t + 'mm';          // chỉ có số -> đường kính tròn
  if (!/mm$/i.test(t)) t += 'mm';                            // có ký hiệu (× x *) -> giữ nguyên, thêm mm
  return t;
}

/* Truy vấn nào cũng có giới hạn dòng. Chạm đúng giới hạn = RẤT CÓ THỂ còn dữ liệu chưa lấy
   về — trước đây cắt âm thầm, bảng thiếu dòng mà không ai biết. Nay ghi cảnh báo rõ ràng. */
const LIM = 20000;
function chamTran_(rows, limit, ten) {
  if (rows && rows.length >= (limit || LIM))
    console.warn('[QS PRO] ' + ten + ': chạm giới hạn ' + (limit || LIM) + ' dòng — có thể còn dữ liệu chưa lấy về, cần phân trang.');
  return rows;
}

module.exports = { n, round0_, s, nowIso, firstImg, fmtUnit, fmtList, fmtCutout_, LIM, chamTran_ };
