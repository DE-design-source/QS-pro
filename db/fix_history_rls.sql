-- LỊCH SỬ SỬA SẢN PHẨM đang KHÔNG ghi được: bảng db_san_pham_history vẫn bật RLS
-- nên mọi INSERT bị Supabase trả 42501 (server chỉ ghi cảnh báo rồi bỏ qua).
alter table public.db_san_pham_history disable row level security;
grant all on public.db_san_pham_history to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
notify pgrst, 'reload schema';
