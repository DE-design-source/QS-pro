-- ============================================================================
--  ĐỀ XUẤT MUA HÀNG  (tách riêng khỏi đơn mua hàng)
--  · loai = 'ck' : đề xuất chiết khấu gửi nhà cung cấp
--  · loai = 'tt' : đề xuất thanh toán chia đợt
--  Chạy lại file này bao nhiêu lần cũng được (idempotent).
-- ============================================================================

create table if not exists public.de_xuat (
  id            bigserial primary key,
  ma_de_xuat    text unique not null,
  loai          text not null default 'ck',
  ma_du_an      text,
  ten_du_an     text,
  hang_muc      text,
  nha_cung_cap  text,
  so_dong       int            default 0,
  tong_goc      numeric        default 0,   -- giá trị trước khi áp đề xuất
  tong_de_xuat  numeric        default 0,   -- giá trị sau khi áp đề xuất (chưa VAT)
  tien_giam     numeric        default 0,
  vat_pct       numeric        default 0,
  vat           numeric        default 0,
  tong_cong     numeric        default 0,
  trang_thai    text           default 'Chờ duyệt',
  nguoi_gui     text,
  phong_ban     text,
  ghi_chu       text,
  nguoi_duyet   text,
  ngay_duyet    timestamptz,
  requester_id  bigint,
  cong_ty_id    bigint,
  ngay_gui      timestamptz    default now()
);

-- Dòng chi tiết dùng chung cho cả 2 loại:
--  · 'ck' : mỗi dòng = 1 sản phẩm (ty_le_pct = % đề xuất giảm, don_gia = đơn giá sau đề xuất)
--  · 'tt' : mỗi dòng = 1 đợt      (ty_le_pct = % đợt, thanh_tien = số tiền, ngay_du_kien = ngày)
create table if not exists public.chi_tiet_de_xuat (
  id            bigserial primary key,
  ma_de_xuat    text not null,
  sort_no       int            default 0,
  ma_sp         text,
  ten_sp        text,
  thuong_hieu   text,
  phong         text,
  dvt           text,
  so_luong      numeric        default 0,
  don_gia_goc   numeric        default 0,
  ty_le_pct     numeric        default 0,
  don_gia       numeric        default 0,
  thanh_tien    numeric        default 0,
  ngay_du_kien  date,
  ghi_chu       text,
  hinh_anh      text,
  cong_ty_id    bigint
);

create index if not exists de_xuat_da_idx     on public.de_xuat(ma_du_an);
create index if not exists de_xuat_ct_idx     on public.de_xuat(cong_ty_id);
create index if not exists de_xuat_loai_idx   on public.de_xuat(loai);
create index if not exists de_xuat_tt_idx     on public.de_xuat(trang_thai);
create index if not exists ct_de_xuat_ma_idx  on public.chi_tiet_de_xuat(ma_de_xuat);
create index if not exists ct_de_xuat_ct_idx  on public.chi_tiet_de_xuat(cong_ty_id);

-- App dùng publishable key nên phải TẮT RLS, đồng thời thêm policy cho chắc
alter table public.de_xuat            disable row level security;
alter table public.chi_tiet_de_xuat   disable row level security;
drop policy if exists de_xuat_all          on public.de_xuat;
drop policy if exists chi_tiet_de_xuat_all on public.chi_tiet_de_xuat;
create policy de_xuat_all          on public.de_xuat          for all using (true) with check (true);
create policy chi_tiet_de_xuat_all on public.chi_tiet_de_xuat for all using (true) with check (true);
grant all on public.de_xuat          to anon, authenticated;
grant all on public.chi_tiet_de_xuat to anon, authenticated;
grant usage, select on sequence public.de_xuat_id_seq          to anon, authenticated;
grant usage, select on sequence public.chi_tiet_de_xuat_id_seq to anon, authenticated;

notify pgrst, 'reload schema';

-- Kiểm tra lại: rls_dang_bat phải = false cho cả 2 bảng
select relname as bang,
       relrowsecurity as rls_dang_bat,
       (select count(*) from pg_policies where tablename = c.relname) as so_policy
from pg_class c
where relname in ('de_xuat', 'chi_tiet_de_xuat');
