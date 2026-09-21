-- ════════════════════════════════════════════════════════════════
--  THIẾT BỊ VỆ SINH v2 — THÔNG SỐ RIÊNG CHO TỪNG HẠNG MỤC
--  (Bồn cầu · Nắp rửa điện tử · Lavabo · Vòi lavabo · Sen tắm · Bồn tắm ·
--   Bồn tiểu · Chậu rửa · Phụ kiện vệ sinh · Thiết bị khác)
--  Danh sách thông số của từng hạng mục: public/vs-spec.js
--  Chạy SAU db/thiet_bi_ve_sinh.sql. Chỉ THÊM cột text -> dữ liệu cũ không đổi.
-- ════════════════════════════════════════════════════════════════
alter table public.db_san_pham
  add column if not exists kieu_lap_dat text,
  add column if not exists loai_nap text,
  add column if not exists loai_voi text,
  add column if not exists loai_sen text,
  add column if not exists kieu_dieu_khien text,
  add column if not exists massage text,
  add column if not exists so_ho text,
  add column if not exists luu_luong text,
  add column if not exists loi_van text,
  add column if not exists bat_sen text,
  add column if not exists che_do_phun text,
  add column if not exists so_lo_voi text,
  add column if not exists xa_tran text,
  add column if not exists dung_tich text,
  add column if not exists nguon_dien text,
  add column if not exists bon_cau_tuong_thich text,
  add column if not exists do_day text,
  add column if not exists be_mat text;

-- App dùng publishable key -> bảng phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.db_san_pham disable row level security;
grant all on public.db_san_pham to anon, authenticated, service_role;

notify pgrst, 'reload schema';
