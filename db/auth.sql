-- ============================================================
-- QS Pro — Phân quyền & tài khoản (chạy trên Supabase SQL Editor)
-- Server dùng publishable key + truy cập server-side => TẮT RLS + grant
-- ============================================================

-- Bảng tài khoản
create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  username     text unique not null,
  ho_ten       text default '',
  password_hash text not null,
  role         text not null default 'staff',   -- 'admin' | 'staff'
  perms        text default '',                 -- staff: danh sách tab được vào, phân tách bằng dấu phẩy
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_login   timestamptz
);

-- Nhật ký hoạt động
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  username   text,
  action     text,
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- Tắt RLS + cấp quyền (đồng bộ với các bảng khác của app)
alter table public.users     disable row level security;
alter table public.audit_log disable row level security;
grant all on public.users     to anon, authenticated, service_role;
grant all on public.audit_log to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- Tài khoản admin đầu tiên: username = admin, mật khẩu = admin123 (ĐỔI NGAY sau khi đăng nhập)
insert into public.users (username, ho_ten, password_hash, role, active)
values ('admin','Quản trị viên','$2a$10$75AYN2cDNyWi7mz8fQCSO.pBgbPwLn35qRpjMQbFVHXesg2qgNeKK','admin',true)
on conflict (username) do nothing;

notify pgrst, 'reload schema';
