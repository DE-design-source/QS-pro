-- ════════════════════════════════════════════════════════════════
--  TÀI LIỆU SẢN PHẨM: Thông số kỹ thuật · Hướng dẫn cài đặt · File bản vẽ
--  (cùng với link_datasheet = Tài liệu kỹ thuật / Catalogue đã có).
--  Mỗi cột lưu 1 link (file tải lên kho Supabase hoặc link dán vào).
--  Chỉ THÊM cột text -> dữ liệu cũ không đổi.
-- ════════════════════════════════════════════════════════════════
alter table public.db_san_pham
  add column if not exists thong_so_file     text,
  add column if not exists huong_dan_lap_dat text,
  add column if not exists file_ban_ve       text;

-- App dùng publishable key -> bảng phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.db_san_pham disable row level security;
grant all on public.db_san_pham to anon, authenticated, service_role;

notify pgrst, 'reload schema';
