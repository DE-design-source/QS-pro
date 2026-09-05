-- ════════════════════════════════════════════════════════════════
-- DUYỆT THAY ĐỔI SẢN PHẨM
--   Nhân viên có quyền "Sửa sản phẩm" -> mọi thay đổi thành PHIẾU CHỜ DUYỆT.
--   Người có quyền "Duyệt sản phẩm" (và Admin) -> ghi thẳng, và duyệt phiếu.
-- ════════════════════════════════════════════════════════════════
create table if not exists public.sp_cho_duyet (
  id             bigint generated always as identity primary key,
  cong_ty_id     uuid,
  sp_id          bigint,            -- db_san_pham.id
  ma_sp          text,
  ten_sp         text,
  thay_doi       text,              -- JSON: [{field, old, new}]
  du_lieu        text,              -- JSON: {"NHÃN TRƯỜNG": "giá trị mới"} để áp dụng khi duyệt
  trang_thai     text not null default 'cho_duyet',   -- cho_duyet | da_duyet | tu_choi
  nguoi_gui_id   uuid,
  nguoi_gui      text,
  nguoi_duyet_id uuid,
  nguoi_duyet    text,
  ly_do          text,
  ngay_gui       timestamptz not null default now(),
  ngay_duyet     timestamptz
);
create index if not exists spcd_status_idx on public.sp_cho_duyet (trang_thai, ngay_gui desc);
create index if not exists spcd_ct_idx     on public.sp_cho_duyet (cong_ty_id);
create index if not exists spcd_sp_idx     on public.sp_cho_duyet (sp_id);

-- App dùng publishable key -> phải TẮT RLS + grant (nếu không sẽ lỗi 42501)
alter table public.sp_cho_duyet disable row level security;
grant all on public.sp_cho_duyet to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

notify pgrst, 'reload schema';
