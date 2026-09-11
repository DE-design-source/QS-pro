-- ============================================================
--  BẢNG CÔNG TÁC XÂY DỰNG (Phần thô)
--  Cho phép công tác dùng đủ chức năng như sản phẩm đèn:
--  có ảnh, có duyệt, sửa được, nhập được từ tab Nhập dữ liệu.
--  Chạy toàn bộ file này trong Supabase → SQL Editor.
-- ============================================================
create table if not exists public.cong_tac (
  id               uuid primary key default gen_random_uuid(),
  cong_ty_id       uuid,
  loai             text not null default 'kt_chitiet',   -- kt_chitiet | kt_sobo | dt_nhancong | dt_vattu
  che_do           text not null default 'item',         -- item | area | area0 | none
  ma_nhom          text,                                 -- I, II, III…
  hang_muc         text not null default '',
  ten              text not null default '',
  dvt              text,
  khoi_luong       numeric,
  dien_tich        numeric,
  he_so            numeric,
  don_gia_nha_thau numeric,
  don_gia          numeric,
  ghi_chu          text,
  hinh_anh         text,          -- nhiều ảnh: mỗi dòng 1 link
  thong_so         text,
  pham_vi          text,
  link_tai_lieu    text,
  da_duyet         boolean not null default false,
  nguoi_duyet      text,
  ngay_duyet       timestamptz,
  nguoi_tao        text,
  ngay_tao         timestamptz not null default now(),
  nguoi_sua        text,
  ngay_cap_nhat    timestamptz,
  thu_tu           int not null default 0
);

-- Cột bổ sung (chạy lại file này bao nhiêu lần cũng được)
alter table public.cong_tac add column if not exists nha_cung_cap text;
alter table public.cong_tac add column if not exists yeu_thich boolean not null default false;

create index if not exists cong_tac_ct_idx   on public.cong_tac(cong_ty_id);
create index if not exists cong_tac_loai_idx on public.cong_tac(loai);
create index if not exists cong_tac_hm_idx   on public.cong_tac(hang_muc);

-- App dùng publishable key nên phải TẮT RLS, đồng thời thêm policy cho chắc
alter table public.cong_tac disable row level security;
drop policy if exists cong_tac_all on public.cong_tac;
create policy cong_tac_all on public.cong_tac for all using (true) with check (true);
grant all on public.cong_tac to anon, authenticated;

notify pgrst, 'reload schema';

-- Kiểm tra lại: rls_dang_bat phải = false
select relrowsecurity as rls_dang_bat,
       (select count(*) from pg_policies where tablename = 'cong_tac') as so_policy
from pg_class where relname = 'cong_tac';

-- ============================================================================
--  LỊCH SỬ CẬP NHẬT CÔNG TÁC  (đồng bộ với db_san_pham_history của sản phẩm đèn)
--  Chạy lại file này là có ngay, không ảnh hưởng dữ liệu công tác đang có.
-- ============================================================================
create table if not exists public.cong_tac_history (
  id              bigserial primary key,
  cong_tac_id     uuid not null,
  field           text,
  old_value       text,
  new_value       text,
  changed_by      uuid,
  changed_by_name text,
  changed_at      timestamptz default now(),
  cong_ty_id      uuid
);
create index if not exists ct_history_id_idx on public.cong_tac_history(cong_tac_id);
create index if not exists ct_history_ct_idx on public.cong_tac_history(cong_ty_id);

alter table public.cong_tac_history disable row level security;
drop policy if exists cong_tac_history_all on public.cong_tac_history;
create policy cong_tac_history_all on public.cong_tac_history for all using (true) with check (true);
grant all on public.cong_tac_history to anon, authenticated;
grant usage, select on sequence public.cong_tac_history_id_seq to anon, authenticated;

notify pgrst, 'reload schema';
