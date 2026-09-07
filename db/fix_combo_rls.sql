-- Bảng sp_combo đã tạo nhưng VẪN BẬT RLS nên mọi INSERT bị Supabase trả 42501.
-- (Giống hệt trường hợp db_san_pham_history và sp_cho_duyet trước đây.)
alter table public.sp_combo disable row level security;
grant all on public.sp_combo to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
notify pgrst, 'reload schema';
