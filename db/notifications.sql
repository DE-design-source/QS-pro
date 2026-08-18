-- ============================================================
-- QS Pro — Thông báo + Yêu cầu xóa sản phẩm (chạy trên Supabase SQL Editor)
-- ============================================================

-- (nếu chưa chạy) cột phân quyền cho users
alter table public.users add column if not exists perms text default '';

-- Thông báo cho từng người dùng
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid,                 -- người nhận
  kind       text,                 -- delete_request | delete_approved | delete_rejected | purchase_request | purchase_approved | purchase_rejected
  title      text,
  body       text,
  ref_id     text,                 -- id yêu cầu xóa (bigint) hoặc mã đơn mua hàng
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- cột người gửi cho đơn mua hàng (để thông báo lại khi admin duyệt)
alter table public.don_mua_hang add column if not exists requester_id uuid;
create index if not exists notif_user_idx on public.notifications (user_id, is_read, created_at desc);

-- Yêu cầu xóa sản phẩm (nhân viên gửi, admin duyệt)
create table if not exists public.delete_requests (
  id            bigint generated always as identity primary key,
  requester_id  uuid,
  requester_name text,
  items         text,              -- JSON: [{maSP, ten}]
  status        text not null default 'pending',   -- pending | approved | rejected
  note          text,
  resolver_name text,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists delreq_status_idx on public.delete_requests (status, created_at desc);

-- Tắt RLS + cấp quyền (server dùng publishable key)
alter table public.notifications  disable row level security;
alter table public.delete_requests disable row level security;
grant all on public.notifications  to anon, authenticated, service_role;
grant all on public.delete_requests to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

notify pgrst, 'reload schema';
