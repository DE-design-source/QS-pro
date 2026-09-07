-- ════════════════════════════════════════════════════════════════
--  TRẠNG THÁI DUYỆT nằm TRÊN SẢN PHẨM (không có phiếu "gửi duyệt")
--    - Tài khoản quyền "Được sửa"  : sửa thẳng, sửa xong SP quay về CHƯA DUYỆT
--    - Tài khoản quyền "Được duyệt": sửa thẳng + bấm Duyệt để đánh dấu ĐÃ DUYỆT
--    - Đã duyệt rồi vẫn sửa lại được (sửa xong lại chờ duyệt lần nữa)
--    - Mọi thay đổi VÀ mọi lần duyệt đều vào Lịch sử của sản phẩm
-- ════════════════════════════════════════════════════════════════
alter table public.db_san_pham add column if not exists da_duyet   boolean default false;
alter table public.db_san_pham add column if not exists nguoi_duyet text;
alter table public.db_san_pham add column if not exists ngay_duyet  timestamptz;
create index if not exists idx_sp_da_duyet on public.db_san_pham (cong_ty_id, da_duyet);

-- Bảng phiếu chờ duyệt của bản trước KHÔNG dùng nữa (đang rỗng).
drop table if exists public.sp_cho_duyet;

notify pgrst, 'reload schema';
