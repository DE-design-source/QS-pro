-- Ghi chú trong catalog: cột không còn dùng (DEPRECATED, chưa xoá) và tham chiếu mềm cố ý không có khoá ngoại.

-- Cột không còn nơi nào đọc. Giữ lại cho tới khi code ngừng ghi; xem docs/02-ky-thuat/database/decisions.md (D-09).
comment on column quotation_lines.zone is 'DEPRECATED: never referenced by the app (the API field khuVuc maps to room).';
comment on column quotation_lines.line_no is 'DEPRECATED: always String(sort_order); written, never read.';
comment on column quotation_lines.markup_pct is 'DEPRECATED: derived, written by calc_, never read (the client recomputes it).';
comment on column quotation_lines.margin_pct is 'DEPRECATED: derived, written by calc_, never read (the client recomputes it).';
comment on column quotation_lines.profit_amount is 'DEPRECATED: derived, written by calc_, never read (the client recomputes it).';
comment on column quotation_lines.is_manual_entry is 'DEPRECATED: always 0; no client code reads or sets it.';
comment on column quotation_lines.is_saved_to_catalog is 'DEPRECATED: always 0; no client code reads or sets it.';
comment on column companies.last_reminder_date is 'DEPRECATED: expiry reminder feature was removed from the code.';
comment on column companies.reminder_milestone is 'DEPRECATED: expiry reminder feature was removed from the code.';
comment on column delete_requests.note is 'DEPRECATED: never read or written.';
comment on column product_combos.note is 'DEPRECATED: clients always send an empty string; never displayed.';
comment on column favorite_products.product_code is 'DEPRECATED: copy of the product code at the time of marking; never read back.';

-- Tham chiếu mềm: KHÔNG có khoá ngoại là có chủ ý.
comment on column purchase_orders.project_code is 'Project code at the time of sending. Soft reference - no FK by design: orders outlive their project (project_name keeps the snapshot).';
comment on column purchase_proposals.project_code is 'Project code at the time of sending. Soft reference - no FK by design: proposals outlive their project.';
comment on column quotation_lines.product_code is 'Product code snapshot, user-editable. Soft reference - no FK by design: product codes are not unique (variants share one code).';
comment on column purchase_order_items.product_code is 'Product code snapshot. Soft reference - no FK by design.';
comment on column product_histories.product_code is 'Product code (or product name when the product has no code). Soft reference - no FK by design: history outlives the product.';
comment on column audit_logs.user_id is 'Acting user. Soft reference - no FK by design: the audit trail outlives the account (username keeps the snapshot).';
comment on column audit_logs.company_id is 'Tenant of the action; NULL for system rows. Soft reference - no FK by design: the audit trail outlives the company.';
comment on column work_item_histories.work_item_id is 'Work item. Soft reference - no FK by design: the "deleted" history row is written after the work item is removed.';
comment on column notifications.ref_id is 'Polymorphic text reference by kind: delete_requests.id, purchase_orders.order_code or purchase_proposals.proposal_code. No FK by design.';
