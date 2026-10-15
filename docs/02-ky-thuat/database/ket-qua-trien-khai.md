# Kết quả triển khai refactor database

- **Ngày:** 2026-10-12. **Phạm vi:** database local `qspro_en2` (PostgreSQL 17, container `qspro-postgres`, cổng 5434). Production (Supabase / Render) **chưa** đụng tới.
- **Cấu trúc đang chạy:** [schema-hien-hanh.md](schema-hien-hanh.md) (sinh từ database).
- Tài liệu này ghi những gì đã làm thật, khác gì so với bản đề xuất, kết quả kiểm thử, và cách vận hành.

## 1. Đã thay đổi gì

| Hạng mục | Trước (`qspro_en`) | Sau (`qspro_en2`) |
|---|---|---|
| Bảng | 19 | 26 + 1 view đọc (`product_catalog`) |
| `products` | 141 cột | 41 cột lõi + 4 bảng thông số 1-1 theo ngành (22 / 21 / 18 / 39 cột) |
| Dòng phiếu đề xuất | 1 bảng đa nghĩa | 2 bảng: `proposal_discount_items`, `proposal_payment_installments` |
| Cấu hình cấp công ty | mã dự án giả `__cty:<id>` trong `project_data_entries` | bảng `company_settings` |
| `company_id` | 18 bảng | 13 bảng: chỉ bảng gốc của công ty và 3 bảng nhật ký / lịch sử |
| Bảng con | lặp `company_id` | chỉ có khoá ngoại tới bảng cha; công ty lấy qua bảng cha |
| Khoá ngoại | 25 | 31 |
| Giá đại lý sản phẩm | cột thường (lỗi) | cột tự tính như schema gốc |
| Username | unique theo công ty | thêm unique toàn hệ thống, không phân biệt hoa thường |
| CHECK công thức | không | 5 (thành tiền, đơn giá, giá đại lý của dòng bóc tách; tổng và thành tiền đơn mua) |

Bảy bảng con bỏ `company_id`: `quotation_lines`, `cost_estimate_lines`, `project_data_entries`, `purchase_order_items`, `proposal_discount_items`, `proposal_payment_installments`, `product_combos`.

## 2. Khác với bản đề xuất

| Đề xuất ban đầu | Đã làm | Lý do |
|---|---|---|
| Khoá ngoại kép `(company_id, mã cha)` ở bảng con | Bỏ hẳn `company_id` ở bảng con | Yêu cầu: bảng liên kết bằng khoá, không lặp một cột công ty ở mọi bảng. Cách này cũng loại luôn khả năng dòng con lệch công ty với dòng cha |
| Gán lại công ty cho 17 dòng bóc tách + 4 đơn mua lệch công ty | Không gán. 13 dòng bóc tách không thuộc công ty nào được chuyển sang khu cách ly | Thử gán thì 3 dự án của Dezon hiện thêm dòng và tổng tiền đổi (ví dụ 15,6 triệu thành 30,4 triệu). Hôm nay không tài khoản nào thấy 13 dòng này |
| CHECK công thức so sánh bằng tuyệt đối | Cho phép lệch 1 đơn vị (hoặc 1 phần tỉ với số rất lớn) | JavaScript và PostgreSQL làm tròn khác nhau ở một số số lẻ; so bằng tuyệt đối sẽ chặn lệnh ghi hợp lệ |
| `company_settings` khoá chính `(company_id, setting_key)` | `id` + unique `(company_id, setting_key)` coi NULL là trùng | Giữ được trường hợp cấu hình không thuộc công ty nào (trước là mã `__cty:0`) |
| Transaction cho 6 thao tác nhiều bước (D-13) | Chưa làm | Các chỗ đang cố ý nuốt lỗi sẽ đổi hành vi khi nằm trong transaction; khoá ngoại `ON DELETE CASCADE` đã ngăn phần lớn dữ liệu dở dang |
| Xoá 12 cột không dùng (đợt 3) | Chưa làm, chỉ đánh dấu `DEPRECATED` trong chú thích cột | Theo kế hoạch: chờ một chu kỳ chạy ổn định |

## 3. Dữ liệu được chuyển sang khu cách ly

Không dòng nào bị xoá hẳn. Schema `quarantine` giữ nguyên nội dung kèm lý do và thời điểm.

| Bảng | Dòng | Lý do |
|---|---:|---|
| `quarantine.quotation_lines` | 16 | 3 dòng trỏ tới dự án không tồn tại (dữ liệu thử); 13 dòng không thuộc công ty nào nằm trong 3 dự án của Dezon |
| `quarantine.favorite_products` | 4 | Trỏ tới sản phẩm đã xoá |
| `quarantine.notifications` | 2 | Của user đã xoá, không ai đọc được |
| `quarantine.users` | 1 | `tuannguyen` trùng tên, không công ty, vai trò staff nên không đăng nhập được |
| `quarantine.fix_log` | 2 | `requester_id` trỏ tới user đã xoá, đã đặt về NULL (tên người gửi còn nguyên) |

Khôi phục một dòng: `insert into public.<bảng> select <các cột gốc> from quarantine.<bảng> where ...`.

13 dòng bóc tách: nếu chúng là dữ liệu thật của 3 dự án `DA-20260903-101840`, `DA-20260904-070257`, `DA-20260904-074807`, chèn lại vào `quotation_lines` (bỏ cột `company_id`) là chúng hiện ra trong dự án.

## 4. Code đã đổi

| File | Thay đổi |
|---|---|
| `server/supa.js` | Đọc bảng tách qua view, ghi tách cột theo bảng trong một transaction có khoá dòng; bảng con: `cong_ty_id` là cột ảo tra qua bảng cha, chèn dòng con phải có dòng cha thuộc công ty đang đăng nhập; nạp lại danh mục khi cấu trúc đổi; cảnh báo khi database chưa migrate |
| `server/db-map.json` | Khai báo `view` + `parts` cho sản phẩm, `tenant` cho 7 bảng con, 3 bảng mới |
| `server/store_supa.js` | `getProjData` / `setProjData` dùng `company_settings`; dòng đề xuất theo 2 bảng; thông báo rõ khi bản nháp không còn |
| `server/auth.js` | `getDeXuat` đọc đúng bảng dòng theo loại phiếu |
| `public/app.js` | 1 dòng: sau khi tải lại danh sách, bản nháp đang mở mà không còn trong danh sách thì chuyển sang bản nháp đầu tiên |
| `scripts/`, `infra/scripts/` | `infra/scripts/migrate.js` (mới), `scripts/test-db.js`, `scripts/test-api.js` (mới), `infra/scripts/sync-from-supabase.js` (dựng schema gốc + nạp + migrate) |

Client không đổi gì khác: mọi API trả đúng hình dạng cũ.

## 5. Kiểm thử đã chạy (2026-10-12)

| Kiểm tra | Kết quả |
|---|---|
| Dữ liệu sản phẩm trước và sau khi tách bảng | 154.113 ô (1.093 dòng x 141 cột), 0 ô khác |
| Kết quả hàm đọc, code cũ + database cũ so với code mới + database mới, với tài khoản thuộc Dezon | 354 / 354 lệnh gọi giống hệt |
| Như trên, với ngữ cảnh "super admin không thuộc công ty nào" (không tài khoản nào hiện có ngữ cảnh này) | 399 / 409 giống hệt; 10 khác biệt đều do 13 dòng bóc tách và 1 tài khoản đã chuyển sang khu cách ly |
| `npm run test:db` (tầng dữ liệu, ràng buộc, cách ly công ty, ghi đồng thời) | 61 đạt, 0 lỗi |
| `npm run test:api` (server thật, gọi API qua HTTP, webhook Lark giả) | 96 đạt, 0 lỗi |
| `npm test` | 1.341 đạt, 0 lỗi |
| Import `sql-en2` vào database trống (cả 1 file và 2 file) | Số dòng mọi bảng khớp; `migrate.js` nhận là đã cập nhật |
| `sync-from-supabase.js` trên database trống | Ra đúng schema của `qspro_en2` |
| Rà soát phản biện độc lập (4 hướng, mỗi phát hiện được tái hiện lại) | 12 phát hiện xác nhận; đã sửa các mục ghi ở mục 6 |

**Chưa kiểm:** thao tác tay trên trình duyệt; gửi Lark thật; xuất Excel (đường đọc dữ liệu không đổi, nhưng chưa mở file kiểm tra).

## 6. Phát hiện từ rà soát và cách xử lý

| Phát hiện | Xử lý |
|---|---|
| Hai lệnh sửa cùng lúc lên một sản phẩm chưa có dòng thông số: một lệnh lỗi trùng khoá | Đã sửa: khoá dòng lõi trước khi ghi + upsert; có test |
| Sửa có điều kiện chạy cùng lúc có thể cùng "thắng" | Đã sửa (cùng cơ chế khoá); có test |
| Khoá ngoại kép báo lỗi 409 khi super admin đổi công ty xem mà còn mở bản nháp cũ | Không còn khoá kép. Chèn dòng vào bản nháp không thuộc công ty đang xem bị từ chối với thông báo rõ; client tự chuyển bản nháp sau khi tải lại |
| Ghi vào bản nháp đã bị xoá: trước âm thầm tạo dòng mồ côi, nay báo lỗi thô | `setProjData` bỏ qua như trước (không tạo dòng mồ côi); `addLine`, `saveCover` báo "Bản nháp không còn tồn tại..." |
| CHECK công thức chặn số lớn hơn 2^53 | Đã nới theo tỉ lệ |
| Migration giá đại lý dừng nếu có sản phẩm tạo trên schema cũ | Đã bỏ điều kiện dừng: cột tự tính tính lại đúng |
| Thứ tự cách ly user trùng tên làm migration khoá ngoại lỗi trên dữ liệu khác | Đã đưa lên đầu; phần dọn dữ liệu viết tổng quát cho mọi quan hệ |
| Database dựng từ `schema.sql` bị coi là chưa chạy migration nào | `schema.sql` giờ kèm các dòng `schema_migrations` |
| Server đang chạy giữ danh mục cột cũ sau migration | `migrate.js` nhắc khởi động lại; lớp dữ liệu tự nạp lại danh mục khi gặp lỗi thiếu cột / bảng |
| Thêm cột vào `products` hoặc bảng thông số mà không tạo lại view thì app không thấy cột | `migrate.js` và `test:db` kiểm tra và báo; quy trình ghi ở mục 7 |
| `migrate.js` nhận cờ lạ, không khoá chống chạy song song | Đã sửa: từ chối cờ lạ, in database đích, khoá advisory |
| Test có thể trỏ nhầm database đang dùng | So host + cổng + tên; tên database tạm phải chứa `test` / `tmp` hoặc kết thúc bằng `_t` |

## 7. Vận hành

**Chuyển app sang database mới:** `.env` đã trỏ `qspro_en2`. Khởi động lại server sau mọi lần migrate.

**Quay lui:** đổi `DATABASE_URL` về `.../qspro_en` **và** hoàn code về commit trước refactor (code mới không chạy trên schema cũ). Dữ liệu ghi vào `qspro_en2` sau lúc chuyển sẽ không có ở `qspro_en`.

**Migration:**

```bash
npm run migrate                 # chạy file chưa áp dụng trên DATABASE_URL
node infra/scripts/migrate.js --status
```

File mới đặt ở `infra/db/migrations/NNNN_ten.sql`; không sửa file đã chạy. Sau khi chạy: sinh lại `infra/db/schema.sql`, cập nhật `server/db-map.json`.

**Thêm cột thông số sản phẩm:**

1. Chọn bảng: cột dùng cho từ 2 ngành trở lên thì vào `products`; cột riêng một ngành thì vào `product_<ngành>_specs`.
2. Viết migration: `alter table ... add column ...`, rồi `drop view product_catalog` và tạo lại view (chép định nghĩa trong `schema.sql`, thêm cột mới).
3. Thêm cặp tên vào `db_san_pham.columns` trong `server/db-map.json`.
4. `npm run migrate`, khởi động lại server, chạy `npm run test:db` (có kiểm tra view đủ cột).

**Ngành sản phẩm mới:** tạo bảng `product_<ngành>_specs (product_id bigint primary key references products(id) on delete cascade, ...)`, thêm vào view và vào `parts` của `db_san_pham` trong `db-map.json`.

**Dựng database mới:**

- Từ bộ xuất: `psql -d <db trống> -f export/supabase-2026-10-07/sql-en2/_all.sql` (cấu trúc + dữ liệu ngày 2026-10-12).
- Chỉ cấu trúc: `psql -d <db trống> -f infra/db/schema.sql`.
- Từ Supabase: `DATABASE_URL=<db trống> node infra/scripts/sync-from-supabase.js --yes`.

**Test trên database thật:** tạo bản sao (`pg_dump <db> | psql <db>_test`), rồi `TEST_DATABASE_URL=.../<db>_test npm run test:db` và `npm run test:api`. `test:api` để lại dữ liệu thử trong bản sao; dùng xong xoá bản sao.

## 8. Việc còn lại

1. Người dùng thử trên trình duyệt qua các tab chính, đặc biệt: nhập sản phẩm 4 ngành, bóc tách, tờ bìa, mua hàng, đề xuất, xuất Excel.
2. Quyết định về 13 dòng bóc tách trong khu cách ly (mục 3).
3. Kế hoạch cắt chuyển production: cần máy chủ PostgreSQL mà Render truy cập được; xem [migration-plan.md](migration-plan.md) mục 9.
4. Các điểm bảo mật không thuộc phạm vi database, vẫn còn nguyên: `AUTH_SECRET` có giá trị dự phòng trong source, project Supabase cũ còn mở, đọc sản phẩm chéo công ty qua combo, webhook Lark dùng chung. Xem [tenant-security.md](tenant-security.md).
5. Bọc transaction cho các thao tác nhiều bước (D-13) và xoá 12 cột `DEPRECATED` (D-09).
