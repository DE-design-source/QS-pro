-- ════════════════════════════════════════════════════════════════
--  NHÓM BIẾN THỂ do người dùng tự đặt
--  Trước đây biến thể chỉ suy ra từ MÃ SP trùng nhau (xem variants_v2.sql),
--  người dùng không tự gom được. Cột nhom_bt cho phép gom tay:
--    · nhom_bt rỗng  -> vẫn gom tự động theo mã SP như cũ
--    · nhom_bt có giá trị -> các SP cùng giá trị này là biến thể của nhau
--      (gom được cả SP khác mã, bỏ ra lúc nào cũng được, không đụng tới mã SP)
-- ════════════════════════════════════════════════════════════════
alter table public.db_san_pham add column if not exists nhom_bt text;
create index if not exists db_san_pham_nhom_bt_idx on public.db_san_pham (nhom_bt);

-- App dùng publishable key -> bảng phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.db_san_pham disable row level security;
grant all on public.db_san_pham to anon, authenticated, service_role;

notify pgrst, 'reload schema';
