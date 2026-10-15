-- M15.2: lý do của yêu cầu xoá sản phẩm.
--   note            = lý do xoá do NGƯỜI GỬI nhập (tuỳ chọn, ≤ 500 ký tự). Cột có sẵn, trước đây không ai đọc/ghi
--                     (0008 ghi DEPRECATED) -> bỏ nhãn DEPRECATED, đưa vào dùng.
--   resolution_note = lý do ADMIN từ chối (tuỳ chọn). Cột mới; code: delete_requests.resolution_note (db-map.json).
-- Cả hai chỉ ghi khi có giá trị. Dữ liệu cũ giữ NULL.
-- Kiểm tra trước: resolution_note chưa có (add column báo lỗi nếu đã có -> cả file quay lui).
-- Quay lui: alter table delete_requests drop column resolution_note; trả lại comment DEPRECATED của note (xem 0008).

alter table delete_requests
  add column resolution_note text;

comment on column delete_requests.note is 'Reason for the deletion given by the requester (optional, at most 500 characters); NULL = none given';
comment on column delete_requests.resolution_note is 'Reason given by the admin when rejecting the request (optional); NULL = none given';

-- Xác minh sau
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'delete_requests' and column_name = 'resolution_note') then
    raise exception '0010: thiếu cột delete_requests.resolution_note';
  end if;
end $$;
