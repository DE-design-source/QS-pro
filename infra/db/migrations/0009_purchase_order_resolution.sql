-- M15.1 (QT-13 Q-04): ghi ai duyệt / từ chối đơn mua hàng và lúc nào, giống delete_requests.resolver_name / resolved_at.
-- Code: don_mua_hang.nguoi_duyet / ngay_duyet (db-map.json). Máy chủ ghi bằng một lệnh RIÊNG sau khi đổi trạng thái thành công;
-- database chưa chạy file này (lỗi 42703) thì chỉ ghi log, việc duyệt vẫn thành công.
-- Đơn đã duyệt / từ chối trước file này giữ NULL (không đoán người duyệt).
-- Kiểm tra trước: hai cột chưa có (add column báo lỗi nếu đã có -> cả file quay lui).
-- Quay lui: alter table purchase_orders drop column resolver_name, drop column resolved_at;

alter table purchase_orders
  add column resolver_name text,
  add column resolved_at   timestamptz;

comment on column purchase_orders.resolver_name is 'Snapshot of the name of the admin who approved or rejected the order; NULL = not resolved yet, or resolved before migration 0009';
comment on column purchase_orders.resolved_at is 'When the order was approved or rejected; NULL = not resolved yet, or resolved before migration 0009';

-- Xác minh sau
do $$
begin
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'purchase_orders'
        and column_name in ('resolver_name', 'resolved_at')) <> 2 then
    raise exception '0009: thiếu cột purchase_orders.resolver_name / resolved_at';
  end if;
end $$;
