'use strict';
/************************************************************
 * Đổi lỗi kỹ thuật của Supabase (thiếu cột / thiếu bảng / RLS) thành hướng dẫn cụ thể:
 * migration chạy tay nên DB có thể chưa có cột/bảng mới.
 ************************************************************/
const VS = require('../../public/vs-spec.js');
const SON = require('../../public/son-spec.js');

// Migration chạy tay -> nếu DB chưa có cột thì đổi lỗi kỹ thuật thành hướng dẫn cụ thể
const COL_SQL = { ten_chip_led: 'db/chip_name.sql', gia_ban_bo_nguon: 'db/gia_bo_nguon.sql', da_duyet: 'db/sp_duyet_status.sql',
  nguoi_duyet: 'db/sp_duyet_status.sql', ngay_duyet: 'db/sp_duyet_status.sql',
  nganh: 'db/thiet_bi_ve_sinh.sql', kich_thuoc: 'db/thiet_bi_ve_sinh.sql', he_thong_xa: 'db/thiet_bi_ve_sinh.sql',
  luong_nuoc_xa: 'db/thiet_bi_ve_sinh.sql', thiet_ke: 'db/thiet_bi_ve_sinh.sql', tam_xa: 'db/thiet_bi_ve_sinh.sql',
  ap_luc_nuoc: 'db/thiet_bi_ve_sinh.sql', luu_y: 'db/thiet_bi_ve_sinh.sql', tinh_nang: 'db/thiet_bi_ve_sinh.sql',
  nhom_bt: 'db/bien_the_nhom.sql', link_dezon: 'db/du_an_link_dezon.sql' };
['thong_so_file', 'huong_dan_lap_dat', 'file_ban_ve'].forEach(function (c) { COL_SQL[c] = 'db/tai_lieu_sp.sql'; });
// Mọi cột thông số vệ sinh chưa có trong bảng trên -> trỏ về migration v2 (thêm metric mới thì nhớ thêm SQL)
Object.keys(VS.METRIC).forEach(function (lb) { const c = VS.METRIC[lb][0]; if (!COL_SQL[c]) COL_SQL[c] = 'db/thiet_bi_ve_sinh_v2.sql'; });
Object.keys(SON.METRIC).forEach(function (lb) { const c = SON.METRIC[lb][0]; if (!COL_SQL[c]) COL_SQL[c] = 'db/son_nuoc.sql'; });
function colErr_(e) {
  const m = (e && e.message) || '';
  for (const col in COL_SQL) {
    if (m.indexOf(col) >= 0 && /(column|schema cache)/i.test(m))
      return new Error('Cơ sở dữ liệu chưa có cột "' + col + '". Vào Supabase → SQL Editor chạy file ' + COL_SQL[col] + ' rồi thử lại.');
  }
  return e;
}
// Dịch lỗi Supabase của 1 bảng thành hướng dẫn ĐÚNG nguyên nhân
function tblErr_(e, table, file) {
  const m = (e && e.message) || '';
  if (!new RegExp(table).test(m)) return e;
  if (/42501|row-level security/i.test(m))
    return new Error('Bảng ' + table + ' đang BẬT RLS nên không ghi được. Vào Supabase → SQL Editor chạy: ' +
      'alter table public.' + table + ' disable row level security; ' +
      'grant all on public.' + table + ' to anon, authenticated, service_role;');
  if (/does not exist|schema cache|PGRST205|404/i.test(m))
    return new Error('Chưa có bảng ' + table + '. Vào Supabase → SQL Editor chạy file ' + file + ' rồi thử lại.');
  return e;
}

module.exports = { COL_SQL, colErr_, tblErr_ };
