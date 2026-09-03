-- ═══ CHẠY 1 LẦN — 3 việc ═══

-- 1) LỖ KHOÉT: cho nhập "Ø60", "Ø40×78", "100x100x60mm"
alter table public.db_san_pham
  alter column cutout_mm type text using cutout_mm::text;

-- 2) CÔNG SUẤT: cho nhập dạng cặp "2×5W", "9/18W"
alter table public.db_san_pham
  alter column cong_suat_w type text using cong_suat_w::text;

-- 3) BIẾN THỂ: thêm MÀU SẮC làm trục thứ 4
--    (cùng mã + cùng nhiệt độ/công suất/góc nhưng KHÁC MÀU = 2 sản phẩm riêng)
drop index if exists db_san_pham_variant_key;
create unique index db_san_pham_variant_key
  on public.db_san_pham (
    ma_sp,
    coalesce(nhiet_do_mau_k::text,''),
    coalesce(cong_suat_w::text,''),
    coalesce(goc_chieu_deg::text,''),
    coalesce(mau_sac,'')
  );

notify pgrst, 'reload schema';
