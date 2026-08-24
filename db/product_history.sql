-- Lịch sử cập nhật sản phẩm (ai đổi gì, lúc nào)
create table if not exists public.db_san_pham_history (
  id              bigint generated always as identity primary key,
  ma_sp           text,
  field           text,          -- nhãn trường đã đổi (VD: GIÁ BÁN LẺ, ẢNH SẢN PHẨM)
  old_value       text,
  new_value       text,
  changed_by      uuid,          -- id người sửa (users.id)
  changed_by_name text,          -- tên đăng nhập người sửa
  changed_at      timestamptz not null default now()
);
create index if not exists dsp_hist_idx on public.db_san_pham_history (ma_sp, changed_at desc);

-- App dùng publishable key -> phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.db_san_pham_history disable row level security;
grant all on public.db_san_pham_history to anon, authenticated, service_role;
