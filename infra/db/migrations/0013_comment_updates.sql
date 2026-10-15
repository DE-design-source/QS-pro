-- Sửa chú thích 2 cột mà tính năng backlog đã dùng lại / đổi nghĩa (chuyển từ steward đợt 1-2; 0012 đã chạy trên qspro_gotest
-- nên không sửa 0012 vì checksum). Chỉ đổi COMMENT, không đổi dữ liệu.
-- - product_combos.note: M10.2 (React) ghi / hiện ghi chú của liên kết sản phẩm đi kèm; 0008 vẫn ghi DEPRECATED.
-- - purchase_orders.send_result: M9.1 (server Go) ghi 'ok' / 'loi' sau khi gửi thẻ Lark; chú thích cũ chỉ có (ok / pending).
-- Quay lui: chạy lại dòng comment product_combos.note của 0008_comments.sql; send_result về 'Result of sending to the channel (ok / pending)'.

comment on column product_combos.note is
  'Note for the companion-product link (M10.2): entered on the product that owns the link, shown read-only on the reverse (two-way) link.';
comment on column purchase_orders.send_result is
  'Lark send result: pending (saved, not sent yet) / ok (card sent) / loi (send failed). Rows "ok" created before M9.1 are a save-time default, not a confirmed delivery';
