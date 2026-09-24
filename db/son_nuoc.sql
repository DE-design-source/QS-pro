-- ════════════════════════════════════════════════════════════════
--  SƠN NƯỚC — THÔNG SỐ SẢN PHẨM (đề mục 3.2.2)
--  Hạng mục: Sơn nội thất · Sơn ngoại thất · Sơn lót · Sơn chống thấm ·
--            Bả matit · Sơn hiệu ứng · Sơn sàn epoxy · Dung môi & phụ gia
--  Danh sách thông số của từng hạng mục: public/son-spec.js
--  Chỉ THÊM cột text -> dữ liệu cũ không đổi. Chạy lại nhiều lần vẫn an toàn.
--  (Các cột mau_sac · kich_thuoc · be_mat · luu_y · tinh_nang dùng chung với
--   thiết bị vệ sinh — đã có ở db/thiet_bi_ve_sinh.sql và _v2.sql.)
-- ════════════════════════════════════════════════════════════════
alter table public.db_san_pham
  -- Key Product Info (Thông tin chính)
  add column if not exists do_phu text,
  add column if not exists thoi_gian_kho text,
  add column if not exists so_lop text,
  -- IX. Các tính chất vật lý và hoá học
  add column if not exists trang_thai_vat_ly text,
  add column if not exists mui text,
  add column if not exists nguong_mui text,
  add column if not exists do_ph text,
  add column if not exists diem_dong text,
  add column if not exists diem_soi text,
  add column if not exists diem_bung_chay text,
  add column if not exists kha_nang_chay text,
  add column if not exists gioi_han_no text,
  add column if not exists ap_suat_hoa_hoi text,
  add column if not exists mat_do_hoi text,
  add column if not exists do_hoa_tan text,
  add column if not exists tinh_deo text,
  add column if not exists dac_tinh_hat text;

-- Render dùng publishable key nên bảng phải TẮT RLS + cấp quyền (xem db/schema.sql)
alter table public.db_san_pham disable row level security;
grant select, insert, update, delete on public.db_san_pham to anon, authenticated;

notify pgrst, 'reload schema';
