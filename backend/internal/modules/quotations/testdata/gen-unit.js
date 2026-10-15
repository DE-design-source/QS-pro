'use strict';
/* Giá trị mong đợi của các hàm thuần trong export.js (nz_, cellOfLine_, px, roman_, sheetName_), lấy từ MÃ NODE THẬT:
     DATABASE_URL=<qspro_nodetest> SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 PURCHASE_WEBHOOK=http://127.0.0.1:9/x \
     REPORT_WEBHOOK=http://127.0.0.1:9/x node gen-unit.js > unit.json
   (không chạm database; noderef.js vẫn đòi DATABASE_URL trỏ qspro_nodetest vì nạp store_supa.js). */
const ref = require('./noderef');
const X = ref.exportInternals();

const KEYS = ['nganh', 'giaNCC', 'giaDaiLy', 'donGia', 'donGiaCK', 'markup', 'margin', 'lnVnd', 'thanhTien', 'ten', 'stt', 1, null];
const LINES = [
  { donGiaVon: 200000, chietKhau: 30, soLuong: 10, donGia: 159600, donGiaBan: 168000, ckKhach: 5, thanhTienBan: 1596000, extra: { nganh: 'den' } },
  { donGiaVon: 333333, chietKhau: 12.5, soLuong: 2.5, donGia: 0, donGiaBan: 291666, ckKhach: 7.5, thanhTienBan: 729165.5, extra: {} },
  { donGiaVon: '1000', chietKhau: '10', soLuong: '3', donGia: null, donGiaBan: '1500', ckKhach: '50', thanhTienBan: '4500' },
  { donGiaVon: 5, chietKhau: 50, soLuong: 1, donGia: 1, donGiaBan: 0, ckKhach: 0, thanhTienBan: 0, extra: { nganh: 0 } },
  { donGiaVon: 1, chietKhau: 150, soLuong: -3, donGia: -2, donGiaBan: 0, ckKhach: 0, thanhTienBan: -6, extra: null },
  { donGiaVon: 3, chietKhau: 50, soLuong: 0.5, donGia: 2.5, donGiaBan: 9, ckKhach: 0, thanhTienBan: 1.25, extra: { nganh: ['a'] } },
  { donGiaVon: 'abc', chietKhau: true, soLuong: [], donGia: '', donGiaBan: '12,5', ckKhach: {}, thanhTienBan: null, extra: 'x' },
  { donGiaVon: 1000, chietKhau: 0, soLuong: 7, donGia: 995, donGiaBan: 1000, ckKhach: 0.5, thanhTienBan: 6965 },
  { donGiaVon: 3, chietKhau: 16.5, soLuong: 1, donGiaBan: 5, ckKhach: 50 },
  {}
];
const out = {
  nz: [0, 1, -2.5, '3', '1.5e3', ' 7 ', '', 'x', null, true, false, [], [5], {}, '0x10', '12,5'].map(function (v) { return [v, X.nz_(v)]; }),
  px: [34, 120, 66, 60, 63, 59.5, 66.5, 73.5, 10, 0, 1, 41.9, 42, 44, 175, 90, null, -70, 'x', '70'].map(function (v) { return [v, X.px(v)]; }),
  roman: [-1, 0, 1, 2, 4, 9, 14, 19, 20, 21, 100].map(function (v) { return [v, X.roman_(v)]; }),
  sheetName: [null, '', 0, 'Sheet', '  a  ', 'a:b\c/d?e*f[g]h', '3.2.6.1', ':::', ' : x', 'Nhóm rất dài hơn ba mươi ký tự để cắt bớt đi nhé', '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀', 12345, "'q'",
    'đúng ba mươi ký tự không hơn x'].map(function (v) { return [v, X.sheetName_(v)]; }),
  cellOfLine: []
};
LINES.forEach(function (l) { KEYS.forEach(function (k) { out.cellOfLine.push([l, k, X.cellOfLine_(l, k)]); }); });
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
