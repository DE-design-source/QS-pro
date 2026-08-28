-- ═══ LỖ KHOÉT: cho nhập tự do (Ø40×78, 60×60, Ø75…) ═══
-- Đèn âm tường/âm đất cần ghi CẢ đường kính lẫn chiều sâu -> cột numeric không chứa được.
-- Đổi sang text. (An toàn: numeric -> text không mất dữ liệu cũ.)
alter table public.db_san_pham
  alter column cutout_mm type text using cutout_mm::text;

-- TUỲ CHỌN — nếu bạn có đèn vuông/chữ nhật (VD 60×60mm) thì đổi thêm 2 cột này:
-- alter table public.db_san_pham alter column duong_kinh_mm type text using duong_kinh_mm::text;
-- alter table public.db_san_pham alter column chieu_cao_mm  type text using chieu_cao_mm::text;

notify pgrst, 'reload schema';
