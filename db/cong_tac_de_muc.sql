-- QS PRO — Công tác xây dựng: ghim ĐỀ MỤC BÓC TÁCH cho từng công tác
-- Chạy trên Supabase → SQL Editor. Chạy lại nhiều lần vẫn an toàn.
--
-- Trước đây đề mục được ĐOÁN theo tên hạng mục (sơn / thạch cao / ốp lát…), tên lạ là
-- công tác chỉ nằm ở 3.1 Phần thô. Cột de_muc cho phép chọn thẳng khi nhập:
--   ''      = vẫn tự nhận theo tên hạng mục
--   '0'     = chỉ nằm ở 3.1 Phần thô
--   '3.2.2' = hiện cả ở đề mục 3.2.2 Sơn nước khi bóc tách (vẫn còn ở 3.1)

alter table public.cong_tac add column if not exists de_muc text;

-- Render dùng publishable key nên bảng phải tắt RLS + cấp quyền (xem db/cong_tac.sql)
alter table public.cong_tac disable row level security;
grant select, insert, update, delete on public.cong_tac to anon, authenticated;

notify pgrst, 'reload schema';
