select json_build_object(
  'users', (select coalesce(json_agg(t), '[]'::json) from (
     select id, username, full_name, left(password_hash, 7) as ph, length(password_hash) as phlen, role, is_active,
            (last_login_at is not null) as has_login, permissions, company_id, email, department, ui_preferences
       from users where username like 'zz\_authusers\_{{P}}\_%' order by username) t),
  'audit', (select coalesce(json_agg(t), '[]'::json) from (
     select user_id, username, action, detail, company_id
       from audit_logs
      where username ilike 'zz\_authusers\_{{P}}\_%'
         or company_id in (select id from companies where code like 'zz-authusers-{{P}}-%')
      order by id) t)
)::text
