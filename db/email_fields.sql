-- Email liên hệ công ty + email đăng nhập của người dùng
alter table public.cong_ty add column if not exists email text;       -- email liên hệ/hoá đơn
alter table public.cong_ty add column if not exists sdt   text;       -- điện thoại liên hệ
alter table public.users   add column if not exists email text;       -- email người dùng (đăng nhập được bằng email)

create index if not exists idx_users_email on public.users (lower(email));
notify pgrst, 'reload schema';
