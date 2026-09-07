-- ════════════════════════════════════════════════════════════════
--  COMBO SẢN PHẨM: 1 sản phẩm đi kèm với các sản phẩm khác
--  (VD: đèn âm trần đi kèm bộ nguồn; đèn rọi ray đi kèm thanh ray)
--  Mỗi dòng = 1 liên kết "sản phẩm chính -> sản phẩm đi kèm" + số lượng.
-- ════════════════════════════════════════════════════════════════
create table if not exists public.sp_combo (
  id         bigint generated always as identity primary key,
  cong_ty_id uuid,
  sp_id      bigint not null,          -- db_san_pham.id  (sản phẩm chính)
  sp_kem_id  bigint not null,          -- db_san_pham.id  (sản phẩm đi kèm)
  so_luong   numeric default 1,        -- mỗi 1 SP chính cần bao nhiêu SP kèm
  ghi_chu    text,
  sort_no    int default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists sp_combo_key on public.sp_combo (sp_id, sp_kem_id);
create index if not exists sp_combo_sp  on public.sp_combo (sp_id);
create index if not exists sp_combo_ct  on public.sp_combo (cong_ty_id);

-- App dùng publishable key -> phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.sp_combo disable row level security;
grant all on public.sp_combo to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

notify pgrst, 'reload schema';
