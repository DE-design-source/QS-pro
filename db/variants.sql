-- ═══ BIẾN THỂ SẢN PHẨM: cùng MÃ SP nhưng khác nhiệt độ màu / công suất / góc chiếu ═══
-- Hiện db_san_pham đang UNIQUE trên ma_sp -> không thể lưu 2 biến thể cùng mã.
-- Đổi thành UNIQUE theo tổ hợp (mã + 3 trục biến thể).

-- 1) Gỡ ràng buộc unique cũ trên ma_sp
alter table public.db_san_pham drop constraint if exists db_san_pham_ma_sp_key;
drop index if exists db_san_pham_ma_sp_key;

-- 2) Unique theo TỔ HỢP biến thể (coalesce để cột trống vẫn so sánh được)
create unique index if not exists db_san_pham_variant_key
  on public.db_san_pham (
    ma_sp,
    coalesce(nhiet_do_mau_k::text,''),
    coalesce(cong_suat_w::text,''),
    coalesce(goc_chieu_deg::text,'')
  );

-- 3) Index tra cứu nhanh theo mã
create index if not exists db_san_pham_ma_idx on public.db_san_pham (ma_sp);

notify pgrst, 'reload schema';
