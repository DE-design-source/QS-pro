-- Bảng sp_cho_duyet vẫn BẬT RLS nên mọi INSERT bị Supabase trả 42501
-- (giống trường hợp db_san_pham_history trước đây). Chạy đoạn này là xong.
alter table public.sp_cho_duyet disable row level security;
grant all on public.sp_cho_duyet to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
notify pgrst, 'reload schema';
