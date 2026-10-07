-- ============================================================
-- QS Pro — Phiên đăng nhập lưu phía server (chạy trên Supabase SQL Editor)
-- Mỗi lần đăng nhập = 1 dòng. Đăng xuất xoá dòng -> token của phiên đó hết hiệu lực NGAY
-- (trước đây token vẫn dùng được tới khi tự hết hạn sau 7 ngày).
-- Chưa chạy file này thì app vẫn đăng nhập bình thường, chỉ là đăng xuất chưa thu hồi được token.
-- ============================================================
create table if not exists public.phien_dang_nhap (
  id       text primary key,                 -- mã phiên ngẫu nhiên, nằm trong token (cookie HttpOnly)
  user_id  uuid not null references public.users (id) on delete cascade,
  tao_luc  timestamptz not null default now(),
  het_han  timestamptz not null
);
create index if not exists phien_dang_nhap_user_idx on public.phien_dang_nhap (user_id);

-- Render dùng publishable key nên bảng phải TẮT RLS + cấp quyền
alter table public.phien_dang_nhap disable row level security;
grant select, insert, update, delete on public.phien_dang_nhap to anon, authenticated;

notify pgrst, 'reload schema';
