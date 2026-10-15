-- M1.2: phiên đăng nhập lưu phía máy chủ - đăng xuất làm token hết hiệu lực NGAY (trước đây token sống tới hết 7 ngày).
-- Mỗi lần đăng nhập = 1 dòng; token mang id của dòng (khoá "sid"). Đăng xuất xoá dòng; tự đổi mật khẩu xoá các phiên khác.
-- Thiết kế theo db/phien_dang_nhap.sql của nhánh refactor cũ (148b5b0), đổi sang tên tiếng Anh + uuid.
-- Code: phien_dang_nhap (db-map.json) - cột id, user_id, tao_luc, het_han. Bảng xuyên công ty: chỉ truy cập noScope
-- (như đăng nhập), không có company_id - công ty của phiên là công ty của users (dòng cha).
-- Kiểm tra trước: bảng chưa có (create table báo lỗi nếu đã có -> cả file quay lui).
-- Quay lui: drop table user_sessions;  (mọi token mang sid thành không hợp lệ -> người dùng đăng nhập lại;
--           server bản mới báo lỗi đích danh "chưa có bảng user_sessions" khi thiếu bảng).

create table user_sessions (
  id         uuid        not null default gen_random_uuid(),
  user_id    uuid        not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint pk_user_sessions primary key (id),
  constraint fk_user_sessions_user_id foreign key (user_id) references users (id) on delete cascade,
  constraint ck_user_sessions_expires_at check (expires_at > created_at)
);

-- Phục vụ: thu hồi mọi phiên của 1 tài khoản (đổi mật khẩu) và dọn phiên quá hạn lúc đăng nhập
-- (backend/internal/modules/auth/postgres.go: RemoveSessions / RemoveExpiredSessions).
create index idx_user_sessions_user_id on user_sessions (user_id);

comment on table user_sessions is
  'Server-side login sessions (M1.2): one row per login; the signed token carries the row id (sid). Logout deletes the row so the token stops working immediately. Cross-company table, always accessed without company scope.';
comment on column user_sessions.id is 'Session id, embedded in the token payload as "sid"';
comment on column user_sessions.user_id is 'Account that logged in; sessions are deleted with the account';
comment on column user_sessions.created_at is 'Login time';
comment on column user_sessions.expires_at is 'Same as the token expiry (login time + 7 days); rows past this time are ignored and cleaned up at the next login of the account';

-- Xác minh sau
do $$
begin
  if to_regclass('public.user_sessions') is null then
    raise exception '0014: thiếu bảng user_sessions';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_user_sessions_user_id') then
    raise exception '0014: thiếu khoá ngoại fk_user_sessions_user_id';
  end if;
end $$;
