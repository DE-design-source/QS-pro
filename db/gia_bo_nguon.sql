-- Giá bán bộ nguồn (driver / chấn lưu) — bán rời kèm đèn
alter table public.db_san_pham add column if not exists gia_ban_bo_nguon numeric;
notify pgrst, 'reload schema';
