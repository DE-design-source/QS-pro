-- ════════════════════════════════════════════════════════════════
--  CÀI ĐẶT GIAO DIỆN THEO TÀI KHOẢN (vd bộ cột "Của tôi" ở bảng Bóc tách)
--  Mỗi tài khoản 1 object JSON: { tkCols: ['stt','ten',...] , ... }
--  Chỉ THÊM 1 cột -> dữ liệu cũ không đổi.
-- ════════════════════════════════════════════════════════════════
alter table public.users add column if not exists ui_prefs jsonb not null default '{}'::jsonb;

-- App dùng publishable key -> bảng phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.users disable row level security;
grant all on public.users to anon, authenticated, service_role;

notify pgrst, 'reload schema';
