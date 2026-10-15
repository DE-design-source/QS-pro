-- Đồng hồ của máy chạy Postgres có bị chỉnh LÙI giữa lúc chạy không (Docker Desktop đồng bộ giờ):
-- khi đó created_at không còn tăng theo id và thứ tự của getAuditLog (created_at.desc) không so được.
select coalesce(bool_or(back), false) as back from (
  select created_at < lag(created_at) over (order by id) as back
    from audit_logs
   where username ilike 'zz\_authusers\_{{P}}\_%'
      or company_id in (select id from companies where code like 'zz-authusers-{{P}}-%')
) x
