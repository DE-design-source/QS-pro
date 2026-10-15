-- Bất biến số học của cột dẫn xuất / tổng lưu sẵn (code vẫn tự tính rồi ghi).
-- Sai số cho phép = 1 đơn vị, hoặc 1 phần tỉ của giá trị nếu số rất lớn:
--   * JavaScript làm tròn trên số thực (1.15*150 = 172.4999...) còn PostgreSQL làm tròn trên số thập phân
--     chính xác (172.5), nên so sánh bằng tuyệt đối sẽ chặn nhầm lệnh ghi hợp lệ;
--   * số vượt 2^53 mất độ chính xác ở JavaScript, lệch tuyệt đối có thể lớn hơn 1.
alter table quotation_lines
  add constraint ck_quotation_lines_amount_formula
    check (abs(amount - quantity * unit_price) <= greatest(1, abs(quantity * unit_price) * 1e-9)),
  add constraint ck_quotation_lines_dealer_price_formula
    check (abs(dealer_price - retail_price * (1 - dealer_discount_pct / 100.0)) <= greatest(1, abs(retail_price) * 1e-9)),
  add constraint ck_quotation_lines_unit_price_formula
    check (abs(unit_price - selling_price * (1 - customer_discount_pct / 100.0)) <= greatest(1, abs(selling_price) * 1e-9));
alter table purchase_orders
  add constraint ck_purchase_orders_total_formula
    check (abs(total_amount - (subtotal_before_vat + vat_amount)) <= greatest(1, abs(total_amount) * 1e-9));
alter table purchase_order_items
  add constraint ck_purchase_order_items_amount_formula
    check (abs(amount - quantity * unit_price) <= greatest(1, abs(quantity * unit_price) * 1e-9));
