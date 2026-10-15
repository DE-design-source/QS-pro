-- Bảng con chỉ liên kết với bảng cha bằng KHOÁ NGOẠI; không lặp lại company_id.
-- Công ty của một dòng con = công ty của dòng cha (server/supa.js xét quyền qua bảng cha, xem "tenant" trong db-map.json).
--   quotation_lines, cost_estimate_lines, project_data_entries -> projects (project_code)
--   purchase_order_items                                       -> purchase_orders (order_code)
--   purchase_proposal_items                                    -> purchase_proposals (proposal_code)
--   product_combos                                             -> products (product_id)
-- company_id chỉ còn ở các bảng GỐC của công ty (khoá ngoại trực tiếp tới companies) và ở 3 bảng nhật ký / lịch sử.
alter table quotation_lines         drop column company_id;
alter table cost_estimate_lines     drop column company_id;
alter table project_data_entries    drop column company_id;
alter table purchase_order_items    drop column company_id;
alter table purchase_proposal_items drop column company_id;
alter table product_combos          drop column company_id;

alter table quotation_lines
  add constraint fk_quotation_lines_project_code foreign key (project_code) references projects (project_code) on delete cascade;
alter table project_data_entries
  add constraint fk_project_data_entries_project_code foreign key (project_code) references projects (project_code) on delete cascade;
-- cost_estimate_lines, purchase_order_items, purchase_proposal_items, product_combos đã có sẵn khoá ngoại tới bảng cha.

-- Khoá ngoại còn thiếu ở các bảng khác. favorite_products.product_id và product_combos.companion_product_id
-- được phép trỏ sang sản phẩm của công ty Dezon (kho dùng chung).
alter table favorite_products
  add constraint fk_favorite_products_product_id foreign key (product_id) references products (id) on delete cascade;
alter table notifications
  add constraint fk_notifications_user_id foreign key (user_id) references users (id) on delete cascade;
alter table purchase_orders
  add constraint fk_purchase_orders_requester_id foreign key (requester_id) references users (id) on delete set null;
alter table delete_requests
  add constraint fk_delete_requests_requester_id foreign key (requester_id) references users (id) on delete set null;
create index if not exists idx_purchase_orders_requester_id on purchase_orders (requester_id);
create index if not exists idx_delete_requests_requester_id on delete_requests (requester_id);

-- Username duy nhất TOÀN HỆ THỐNG, không phân biệt hoa thường (code vẫn kiểm trước khi tạo; đây là chốt chặn ở database).
create unique index uq_users_lower_username on users (lower(username));
