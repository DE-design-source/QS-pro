-- M17.3 (giả định, chờ chủ sản phẩm xác nhận): nhắc gia hạn công ty TRONG ỨNG DỤNG (không Lark, không email).
-- Hai cột cũ của tính năng nhắc qua Lark (gỡ ở 42af44d) được dùng lại, nên bỏ nhãn DEPRECATED của 0008
-- và ra khỏi danh sách xoá D-09 (docs/02-ky-thuat/database/decisions.md).
-- Code: cong_ty.nhac_moc / cong_ty.nhac_lan_cuoi (db-map.json đã có). Chỉ đổi COMMENT, không đổi dữ liệu.
-- KHÔNG thêm CHECK: dữ liệu cũ có giá trị ngoài tập mốc (vd -1, 5, 3, 1 của bản Lark); code coi giá trị ngoài
-- {30,14,7,3,1,0} như chưa nhắc.
-- Quay lui: chạy lại 2 dòng comment tương ứng của 0008_comments.sql.

comment on column companies.reminder_milestone is
  'In-app expiry reminder (M17.3): last milestone sent, one of 30/14/7/3/1/0 days before expiry_date. NULL = not reminded yet; values outside that set (legacy -1, 5...) are treated as NULL. Cleared when expiry_date changes.';
comment on column companies.last_reminder_date is
  'In-app expiry reminder (M17.3): date (Vietnam time) the last reminder was sent. Cleared together with reminder_milestone when expiry_date changes.';
