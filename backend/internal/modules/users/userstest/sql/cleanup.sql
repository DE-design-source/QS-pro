-- Dọn mọi dòng của bộ thử {{P}} (chỉ dòng mang tiền tố zz_authusers_{{P}}; không đụng dòng có sẵn).
delete from audit_logs where username ilike 'zz\_authusers\_{{P}}\_%'
   or company_id in (select id from companies where code like 'zz-authusers-{{P}}-%')
   or user_id in (select id from users where username like 'zz\_authusers\_{{P}}\_%');
delete from users where username like 'zz\_authusers\_{{P}}\_%';
delete from companies where code like 'zz-authusers-{{P}}-%';
