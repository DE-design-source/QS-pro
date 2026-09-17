-- ════════════════════════════════════════════════════════════════
--  NGÀNH HÀNG THIẾT BỊ VỆ SINH (hạng mục 3.2.5)
--  Bộ trường lấy đúng theo file mẫu "THIẾT BỊ ĐÈN (1).xlsx" — sheet
--  "Thiết bị vệ sinh": Key Product Info / THÔNG TIN CHÍNH / THÔNG SỐ THIẾT KẾ.
--  Dùng chung bảng db_san_pham với đèn; cột nganh phân biệt ngành hàng
--  ('den' = thiết bị đèn — mặc định, 'vs' = thiết bị vệ sinh).
-- ════════════════════════════════════════════════════════════════
alter table public.db_san_pham
  add column if not exists nganh          text,   -- 'den' | 'vs'
  add column if not exists kich_thuoc     text,   -- VD: L580 x W380 x H335 (mm)
  add column if not exists he_thong_xa    text,   -- VD: Tornado
  add column if not exists luong_nuoc_xa  text,   -- VD: 4.5/3L
  add column if not exists thiet_ke       text,   -- VD: Thân kín, dáng chữ D
  add column if not exists tam_xa         text,   -- VD: 220 mm
  add column if not exists ap_luc_nuoc    text,   -- VD: 0.05 ~ 0.75 MPa
  add column if not exists luu_y          text,   -- VD: Không kết hợp với van xả trực tiếp
  add column if not exists tinh_nang      text;   -- danh sách gạch đầu dòng

create index if not exists db_san_pham_nganh_idx on public.db_san_pham (nganh);

-- Sản phẩm đã có từ trước đều là thiết bị đèn
update public.db_san_pham set nganh='den' where nganh is null;

-- App dùng publishable key -> bảng phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.db_san_pham disable row level security;
grant all on public.db_san_pham to anon, authenticated, service_role;

notify pgrst, 'reload schema';
