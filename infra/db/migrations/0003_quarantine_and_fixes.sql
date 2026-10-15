-- Dọn dữ liệu sai TRƯỚC khi tạo khoá. KHÔNG xoá hẳn: dòng bị loại được chép nguyên vẹn sang schema
-- quarantine (kèm lý do); giá trị bị sửa được ghi lại (giá trị cũ) trong quarantine.fix_log.
-- Viết tổng quát cho mọi quan hệ sẽ nhận khoá ngoại, không chỉ các dòng sai đang có hôm nay.
create schema if not exists quarantine;
create table quarantine.fix_log (
  id bigint generated always as identity primary key,
  table_name text not null, row_key text not null, column_name text not null,
  old_value text, new_value text, reason text not null,
  fixed_at timestamptz not null default now()
);

-- 1) Tài khoản trùng username (không phân biệt hoa thường), KHÔNG thuộc công ty nào và không phải super.
--    Tài khoản loại này không đăng nhập được (auth.js: user thường phải có công ty) nên cách ly không làm mất chức năng.
--    Làm ĐẦU TIÊN để các bước sau dọn luôn dữ liệu trỏ tới tài khoản này.
create table quarantine.users (like public.users, quarantine_reason text not null, quarantined_at timestamptz not null default now());
insert into quarantine.users
  select u.*, 'trùng username với tài khoản khác; không có công ty nên không đăng nhập được', now() from users u
  where u.company_id is null and u.role <> 'super'
    and exists (select 1 from users o where lower(o.username) = lower(u.username) and o.id <> u.id);
delete from users u
  where u.company_id is null and u.role <> 'super'
    and exists (select 1 from users o where lower(o.username) = lower(u.username) and o.id <> u.id);

-- 2) Bảng CON sắp bỏ cột company_id (công ty sẽ được xác định qua bảng cha):
--    a) dòng mồ côi (không có dòng cha)                                   -> cách ly
--    b) dòng mà hôm nay công ty của dòng cha KHÔNG nhìn thấy (company_id của dòng con khác dòng cha,
--       vd dòng do super admin thêm khi chưa chọn công ty). Giữ lại thì sau khi bỏ cột chúng sẽ HIỆN RA
--       với công ty của dòng cha và làm đổi số liệu trên màn hình         -> cách ly, chờ người quyết định.
--    Dòng con có công ty nhưng dòng cha không thuộc công ty nào thì giữ: chúng theo dòng cha (vốn không ai mở được).
do $$
declare r record; n bigint;
begin
  for r in select * from (values
      ('quotation_lines',         'project_code',  'projects',           'project_code'),
      ('cost_estimate_lines',     'project_code',  'projects',           'project_code'),
      ('project_data_entries',    'project_code',  'projects',           'project_code'),
      ('purchase_order_items',    'order_code',    'purchase_orders',    'order_code'),
      ('purchase_proposal_items', 'proposal_code', 'purchase_proposals', 'proposal_code'),
      ('product_combos',          'product_id',    'products',           'id')
    ) v(child, col, parent, pkey)
  loop
    execute format('create table quarantine.%1$I (like public.%1$I, quarantine_reason text not null, quarantined_at timestamptz not null default now())', r.child);
    execute format('insert into quarantine.%1$I select c.*, %5$L, now() from public.%1$I c where not exists (select 1 from public.%3$I p where p.%4$I = c.%2$I)',
                   r.child, r.col, r.parent, r.pkey, 'không có dòng cha trong ' || r.parent);
    execute format('delete from public.%1$I c where not exists (select 1 from public.%3$I p where p.%4$I = c.%2$I)', r.child, r.col, r.parent, r.pkey);
    execute format('insert into quarantine.%1$I select c.*, %5$L, now() from public.%1$I c join public.%3$I p on p.%4$I = c.%2$I where p.company_id is not null and c.company_id is distinct from p.company_id',
                   r.child, r.col, r.parent, r.pkey, 'company_id khác dòng cha trong ' || r.parent || ': công ty của dòng cha đang không nhìn thấy dòng này');
    execute format('delete from public.%1$I c using public.%3$I p where p.%4$I = c.%2$I and p.company_id is not null and c.company_id is distinct from p.company_id', r.child, r.col, r.parent, r.pkey);
  end loop;
  -- sản phẩm đi kèm trỏ tới sản phẩm đã xoá
  insert into quarantine.product_combos select c.*, 'companion_product_id không tồn tại trong products', now() from product_combos c
    where not exists (select 1 from products p where p.id = c.companion_product_id);
  delete from product_combos c where not exists (select 1 from products p where p.id = c.companion_product_id);
end $$;

-- 3) Yêu thích trỏ tới sản phẩm đã xoá
create table quarantine.favorite_products (like public.favorite_products, quarantine_reason text not null, quarantined_at timestamptz not null default now());
insert into quarantine.favorite_products
  select c.*, 'product_id không tồn tại trong products', now() from favorite_products c
  where not exists (select 1 from products p where p.id = c.product_id);
delete from favorite_products c where not exists (select 1 from products p where p.id = c.product_id);

-- 4) Thông báo của user đã xoá (không ai đọc được nữa)
create table quarantine.notifications (like public.notifications, quarantine_reason text not null, quarantined_at timestamptz not null default now());
insert into quarantine.notifications
  select c.*, 'user_id không tồn tại trong users', now() from notifications c
  where c.user_id is not null and not exists (select 1 from users u where u.id = c.user_id);
delete from notifications c where c.user_id is not null and not exists (select 1 from users u where u.id = c.user_id);

-- 5) requester_id trỏ tới user đã xoá -> NULL (tên người gửi vẫn nằm ở cột tên)
insert into quarantine.fix_log (table_name, row_key, column_name, old_value, new_value, reason)
  select 'purchase_orders', c.id::text, 'requester_id', c.requester_id::text, null, 'user đã xoá'
  from purchase_orders c where c.requester_id is not null and not exists (select 1 from users u where u.id = c.requester_id);
update purchase_orders c set requester_id = null
  where c.requester_id is not null and not exists (select 1 from users u where u.id = c.requester_id);
insert into quarantine.fix_log (table_name, row_key, column_name, old_value, new_value, reason)
  select 'delete_requests', c.id::text, 'requester_id', c.requester_id::text, null, 'user đã xoá'
  from delete_requests c where c.requester_id is not null and not exists (select 1 from users u where u.id = c.requester_id);
update delete_requests c set requester_id = null
  where c.requester_id is not null and not exists (select 1 from users u where u.id = c.requester_id);
