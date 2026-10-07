'use strict';
// Lịch tự gửi báo cáo nhập SP lên Lark (thứ 4 & thứ 7, 8h00 giờ VN) — index.js gọi start() khi server chạy
const { baoCaoNhapSP, daGuiBaoCaoHomNay_, nowVN_, BAO_CAO_GIO_VN, BAO_CAO_THU } = require('./bao-cao.service');

function autoBaoCaoSP_(lyDo) {
  const vn = nowVN_();
  if (BAO_CAO_THU.indexOf(vn.getUTCDay()) < 0) return;              // không phải T4/T7
  if (vn.getUTCHours() < BAO_CAO_GIO_VN) return;                    // chưa tới 8h
  daGuiBaoCaoHomNay_().then(function (daGui) {
    if (daGui) return;
    return baoCaoNhapSP({ r: 'super' }, {}).then(function (r) {
      if (r && r.sent) console.log('[báo cáo nhập SP][' + lyDo + '] đã gửi Lark:', r.count, 'sản phẩm');
      else if (r) console.log('[báo cáo nhập SP][' + lyDo + ']', r.message || 'không gửi');
    });
  }).catch(function (e) { console.warn('[báo cáo nhập SP] lỗi:', e && e.message); });
}
function msToNextBaoCao_() {
  const vn = nowVN_();
  const next = new Date(vn); next.setUTCHours(BAO_CAO_GIO_VN, 0, 0, 0);
  if (next <= vn) next.setUTCDate(next.getUTCDate() + 1);
  while (BAO_CAO_THU.indexOf(next.getUTCDay()) < 0) next.setUTCDate(next.getUTCDate() + 1);
  return next - vn;
}
function scheduleBaoCaoSP_() {
  const wait = msToNextBaoCao_();
  setTimeout(function () { autoBaoCaoSP_('đúng giờ'); scheduleBaoCaoSP_(); }, wait);
  const h = Math.floor(wait / 3600000), m = Math.round((wait % 3600000) / 60000);
  console.log('[báo cáo nhập SP] lần gửi kế tiếp sau ' + h + 'h' + m + 'p (thứ 4 & thứ 7, 8h00 giờ VN)');
}
function start() {
  setTimeout(function () {
    autoBaoCaoSP_('gửi bù sau khi server thức');       // server ngủ dậy muộn vẫn gửi, có chống trùng
    scheduleBaoCaoSP_();
  }, 70 * 1000);
}

module.exports = { start };
