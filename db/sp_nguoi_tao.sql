-- ════════════════════════════════════════════════════════════════
--  GHI DẤU NGƯỜI THAO TÁC trên từng sản phẩm
--    nguoi_tao / ngay_tao : ai tạo sản phẩm (nhập tay hoặc nhập hàng loạt)
--    nguoi_sua            : ai sửa gần nhất (ngay_cap_nhat đã có sẵn)
--  Lịch sử chi tiết vẫn nằm ở db_san_pham_history; 3 cột này để xem nhanh
--  ngay trên bảng Danh sách sản phẩm mà không phải mở lịch sử.
-- ════════════════════════════════════════════════════════════════
alter table public.db_san_pham add column if not exists nguoi_tao text;
alter table public.db_san_pham add column if not exists ngay_tao  timestamptz default now();
alter table public.db_san_pham add column if not exists nguoi_sua text;
create index if not exists idx_sp_nguoi_tao on public.db_san_pham (cong_ty_id, nguoi_tao);
notify pgrst, 'reload schema';
