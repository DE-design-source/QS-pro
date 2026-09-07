-- ════════════════════════════════════════════════════════════════
--  SẢN PHẨM YÊU THÍCH  (slide "Update QS" — Lê Hoàng Nghĩa, 03/09)
--  "tạo một [trang] sản phẩm yêu thích để lưu trữ những sản phẩm
--   hay sử dụng để dùng cho các dự án sau"
--
--  Vì sao là BẢNG RIÊNG chứ không phải 1 cột trên db_san_pham:
--  sản phẩm trong kho chung của Dezon thuộc tenant khác, công ty
--  khác không được ghi vào dòng đó -> đánh dấu yêu thích phải nằm
--  riêng theo từng công ty.
-- ════════════════════════════════════════════════════════════════
create table if not exists public.sp_yeu_thich (
  id         bigint generated always as identity primary key,
  cong_ty_id uuid,
  sp_id      bigint not null,          -- db_san_pham.id
  ma_sp      text,                     -- lưu kèm cho dễ tra cứu
  nguoi_tao  text,                     -- ai đã đánh dấu
  created_at timestamptz not null default now()
);
-- mỗi công ty chỉ đánh dấu 1 lần cho 1 sản phẩm
create unique index if not exists sp_yeu_thich_key on public.sp_yeu_thich (cong_ty_id, sp_id);
create index if not exists sp_yeu_thich_sp on public.sp_yeu_thich (sp_id);

-- App dùng publishable key -> phải TẮT RLS + grant (nếu không sẽ lỗi 42501 khi ghi)
alter table public.sp_yeu_thich disable row level security;
grant all on public.sp_yeu_thich to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

notify pgrst, 'reload schema';
