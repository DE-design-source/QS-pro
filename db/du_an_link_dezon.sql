-- ════════════════════════════════════════════════════════════════
--  DỰ ÁN: link bài dự án trên dezon.vn (ô "Link dự án trên Dezon" ở Thông tin dự án)
--  Chỉ THÊM 1 cột text -> dữ liệu cũ không đổi.
-- ════════════════════════════════════════════════════════════════
alter table public.du_an add column if not exists link_dezon text;

-- App dùng publishable key -> bảng phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.du_an disable row level security;
grant all on public.du_an to anon, authenticated, service_role;

notify pgrst, 'reload schema';
