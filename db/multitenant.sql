-- ══════════════════════════════════════════════════════════════
--  MULTI-TENANT: tách dữ liệu theo CÔNG TY (mô hình bán cloud)
--  Chạy 1 lần. An toàn: dữ liệu cũ được gán hết vào công ty "Dezon".
-- ══════════════════════════════════════════════════════════════

-- 1) BẢNG CÔNG TY
create table if not exists public.cong_ty (
  id          uuid primary key default gen_random_uuid(),
  ten         text not null,
  ma          text unique,                 -- mã ngắn, vd: dezon
  logo_url    text,
  mau_chinh   text,                        -- màu thương hiệu (tuỳ chọn)
  tinh_nang   text default '',             -- tính năng được bật, cách nhau dấu phẩy
  gioi_han_user int default 10,            -- số user tối đa
  active      boolean default true,
  han_dung    date,                        -- hạn sử dụng (để trống = không giới hạn)
  ghi_chu     text,
  ngay_tao    timestamptz default now()
);
alter table public.cong_ty disable row level security;
grant all on public.cong_ty to anon, authenticated, service_role;

-- 2) THÊM CỘT CÔNG TY cho mọi bảng dữ liệu
alter table public.users                add column if not exists cong_ty_id uuid;
alter table public.du_an                add column if not exists cong_ty_id uuid;
alter table public.db_bao_gia           add column if not exists cong_ty_id uuid;
alter table public.khai_toan            add column if not exists cong_ty_id uuid;
alter table public.db_san_pham          add column if not exists cong_ty_id uuid;
alter table public.db_san_pham_history  add column if not exists cong_ty_id uuid;
alter table public.don_mua_hang         add column if not exists cong_ty_id uuid;
alter table public.chi_tiet_mua_hang    add column if not exists cong_ty_id uuid;
alter table public.notifications        add column if not exists cong_ty_id uuid;
alter table public.delete_requests      add column if not exists cong_ty_id uuid;
alter table public.audit_log            add column if not exists cong_ty_id uuid;

-- 3) VAI TRÒ SUPER ADMIN (anh) — quản lý toàn hệ thống
--    users.role: 'super' | 'admin' (chủ công ty) | 'staff'

-- 4) TẠO CÔNG TY ĐẦU TIÊN + GÁN TOÀN BỘ DỮ LIỆU CŨ
do $$
declare ct uuid;
begin
  select id into ct from public.cong_ty where ma = 'dezon';
  if ct is null then
    insert into public.cong_ty (ten, ma, tinh_nang, gioi_han_user, active)
    values ('Dezon', 'dezon', 'dash,boc,chiphi,export,muahang,duan,sanpham,import', 50, true)
    returning id into ct;
  end if;

  update public.users               set cong_ty_id = ct where cong_ty_id is null;
  update public.du_an               set cong_ty_id = ct where cong_ty_id is null;
  update public.db_bao_gia          set cong_ty_id = ct where cong_ty_id is null;
  update public.khai_toan           set cong_ty_id = ct where cong_ty_id is null;
  update public.db_san_pham         set cong_ty_id = ct where cong_ty_id is null;
  update public.db_san_pham_history set cong_ty_id = ct where cong_ty_id is null;
  update public.don_mua_hang        set cong_ty_id = ct where cong_ty_id is null;
  update public.chi_tiet_mua_hang   set cong_ty_id = ct where cong_ty_id is null;
  update public.notifications       set cong_ty_id = ct where cong_ty_id is null;
  update public.delete_requests     set cong_ty_id = ct where cong_ty_id is null;
  update public.audit_log           set cong_ty_id = ct where cong_ty_id is null;
end $$;

-- 5) NÂNG tài khoản admin thành SUPER ADMIN (toàn hệ thống)
update public.users set role = 'super' where username = 'admin';

-- 6) INDEX cho truy vấn theo công ty
create index if not exists idx_users_ct      on public.users            (cong_ty_id);
create index if not exists idx_duan_ct       on public.du_an            (cong_ty_id);
create index if not exists idx_baogia_ct     on public.db_bao_gia       (cong_ty_id);
create index if not exists idx_sp_ct         on public.db_san_pham      (cong_ty_id);
create index if not exists idx_muahang_ct    on public.don_mua_hang     (cong_ty_id);
create index if not exists idx_notif_ct      on public.notifications    (cong_ty_id);

-- 7) MÃ SP chỉ cần duy nhất TRONG 1 CÔNG TY (2 công ty được trùng mã)
drop index if exists db_san_pham_variant_key;
create unique index if not exists db_san_pham_variant_key
  on public.db_san_pham (
    cong_ty_id, ma_sp,
    coalesce(nhiet_do_mau_k::text,''),
    coalesce(cong_suat_w::text,''),
    coalesce(goc_chieu_deg::text,''),
    coalesce(mau_sac,'')
  );

-- 8) TÊN ĐĂNG NHẬP chỉ cần duy nhất TRONG 1 CÔNG TY
alter table public.users drop constraint if exists users_username_key;
drop index if exists users_username_key;
create unique index if not exists users_username_ct_key on public.users (cong_ty_id, username);

notify pgrst, 'reload schema';
