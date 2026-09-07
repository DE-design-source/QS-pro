-- ════════════════════════════════════════════════════════════════
--  MỞ QUYỀN GHI CHO BẢNG sp_yeu_thich
--  Triệu chứng khi chưa chạy: đọc được (0 dòng) nhưng ghi báo
--  42501 "new row violates row-level security policy".
--
--  Làm CẢ HAI cách cho chắc:
--   1) tắt RLS
--   2) nếu dự án có cấu hình tự bật lại RLS -> vẫn có policy mở nên ghi được
-- ════════════════════════════════════════════════════════════════
alter table public.sp_yeu_thich disable row level security;

drop policy if exists sp_yeu_thich_all on public.sp_yeu_thich;
create policy sp_yeu_thich_all on public.sp_yeu_thich
  for all to anon, authenticated, service_role
  using (true) with check (true);

grant all on public.sp_yeu_thich to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Kiểm tra: rls_dang_bat = false, HOẶC so_policy >= 1 -> đều ghi được
select relrowsecurity as rls_dang_bat,
       (select count(*) from pg_policies
         where schemaname='public' and tablename='sp_yeu_thich') as so_policy
  from pg_class where oid = 'public.sp_yeu_thich'::regclass;
