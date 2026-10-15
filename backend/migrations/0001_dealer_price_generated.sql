-- Giá đại lý của sản phẩm phải là cột TỰ TÍNH như schema gốc (db/schema.sql:46).
-- Bản đổi tên tiếng Anh làm mất thuộc tính generated; code không bao giờ ghi cột này, nên sản phẩm
-- tạo / sửa giá trên schema đó có giá đại lý NULL hoặc cũ. Cột generated tính lại đúng cho mọi dòng.
alter table products drop constraint if exists ck_products_dealer_price;
alter table products drop column dealer_price;
alter table products add column dealer_price numeric
  generated always as (round(coalesce(retail_price, 0) * (1 - coalesce(dealer_discount_pct, 0) / 100.0))) stored;
alter table products add constraint ck_products_dealer_price check (dealer_price >= 0);
comment on column products.dealer_price is 'Dealer price, GENERATED = round(retail_price * (1 - dealer_discount_pct/100)). Never written by the app.';
