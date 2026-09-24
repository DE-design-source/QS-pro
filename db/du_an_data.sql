-- ════════════════════════════════════════════════════════════════
--  DỮ LIỆU RỜI CỦA DỰ ÁN (trước đây chỉ nằm ở localStorage máy người dùng)
--   · phanTho : bảng ước tính chi phí xây dựng thô + VAT của nó
--   · area    : bảng diện tích ở tab Xuất báo giá
--   · ptInfo  : ảnh / thông số / link tài liệu công tác do người dùng nhập
--               (dùng chung cả công ty -> lưu với ma_da = '__cty')
--  Mỗi dòng là 1 khoá của 1 dự án. Chạy lại nhiều lần vẫn an toàn.
-- ════════════════════════════════════════════════════════════════
create table if not exists public.du_an_data (
  ma_da      text not null,
  khoa       text not null,
  gia_tri    jsonb,
  cong_ty_id uuid,
  cap_nhat   timestamptz not null default now(),
  nguoi_sua  text,
  primary key (ma_da, khoa)
);
create index if not exists du_an_data_ma_idx on public.du_an_data (ma_da);

-- Render dùng publishable key nên bảng phải TẮT RLS + cấp quyền
alter table public.du_an_data disable row level security;
grant select, insert, update, delete on public.du_an_data to anon, authenticated;

notify pgrst, 'reload schema';
