-- ════════════════════════════════════════════════════════════════
--  PHÒNG BAN CHO TÀI KHOẢN
--  Báo cáo "sản phẩm nhập mới" gửi Lark cần biết người nhập thuộc
--  phòng ban nào. Bảng users chưa có cột này -> thêm vào.
--  Điền phòng ban trong Admin → Tài khoản → Sửa.
-- ════════════════════════════════════════════════════════════════
alter table public.users add column if not exists phong_ban text;

notify pgrst, 'reload schema';

-- Kiểm tra: phải thấy cột phong_ban trong danh sách
select column_name from information_schema.columns
 where table_schema='public' and table_name='users' and column_name='phong_ban';
