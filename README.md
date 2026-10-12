# QS Pro (Dezon Pro) – Bóc tách khối lượng / báo giá

Web app Node.js + Express: danh mục sản phẩm, dự án, bóc tách hạng mục, chi phí, tờ bìa (khái toán), xuất báo giá, mua hàng.
Nhiều công ty dùng chung (multi-tenant), dữ liệu trên **PostgreSQL** (nối trực tiếp qua `DATABASE_URL`); file ảnh / tài liệu vẫn lưu trên Supabase Storage.

## Kiến trúc
```
public/index.html      Giao diện + CSS (SPA)
public/app.js          Lõi dùng chung: S, api(), đăng nhập/quyền, dự án (openProject_, projData*), công thức giá,
                       editLine, cellInput, bộ cột, popup, hộp xác nhận, cây hạng mục, thanh cuộn tự vẽ
public/boc.js          Tab Bóc tách (bảng theo tầng, thêm SP, menu chuột phải, tìm nhanh, sửa hàng loạt, đồng bộ giá)
public/sanpham.js      Tab Danh sách sản phẩm          public/nhap.js      Tab Nhập dữ liệu (+ upload ảnh dùng chung)
public/phantho.js      Phần thô 3.1 + công tác         public/chiphi.js    Tab Chi phí
public/duan.js         Tab Dự án                        public/muahang.js   Tab Mua hàng + phiếu đề xuất
public/baogia.js       Tab Xuất báo giá + tờ bìa        public/dash.js      Tab Bảng điều khiển
public/admin.js        Tab Admin                        public/congty.js    Tab Công ty (super admin)
public/main.js         Khởi động — luôn nạp SAU CÙNG (index.html: app.js → các file tab → main.js)
public/vs-spec.js      Thông số thiết bị vệ sinh theo hạng mục (dùng cả client lẫn server)
public/son-spec.js     Thông số sơn nước theo hạng mục
server/index.js        Express: /api/:fn (whitelist REGISTRY + phân quyền), /export/*, /media, thẻ Lark, lịch báo cáo
server/auth.js         Đăng nhập, phiên (token + đối chiếu DB), tài khoản, công ty, duyệt đơn/đề xuất/yêu cầu xoá
server/store_supa.js   Nghiệp vụ: sản phẩm, dự án, dòng bóc tách, tờ bìa, công tác, mua hàng
server/supa.js         Tầng dữ liệu PostgreSQL (pg) — giữ giao diện select/insert/update/remove + chuỗi lọc kiểu PostgREST;
                       dịch tên bảng/cột tiếng Việt trong code <-> tiếng Anh trong DB; TỰ lọc theo công ty (TENANT_TABLES)
server/db-map.json     Bảng đối chiếu tên bảng / cột: tiếng Việt (code) -> tiếng Anh (database)
server/tenant.js       Ngữ cảnh công ty theo request (AsyncLocalStorage)
server/shared.js       Hàm thuần: mẫu tờ bìa, NCC 3.2, đọc số VN, đọc file nhập hàng loạt
server/export.js       Xuất Excel báo giá (ExcelJS)
server/lark.js         Chỉ còn tải ảnh cũ lưu trên Lark cho /media
db/postgres/schema.sql Schema PostgreSQL hiện hành (tên tiếng Anh) — dựng database mới: psql -d <db> -f db/postgres/schema.sql
db/*.sql               Migration cũ thời Supabase (tên tiếng Việt) — chỉ để tham khảo
scripts/sync-from-supabase.js  Chép toàn bộ dữ liệu Supabase -> PostgreSQL (xoá rồi nạp lại, cần --yes)
```

Quy ước quan trọng:
- **Mã tờ bìa = mã cây hạng mục Bóc tách** (`TREE` trong `app.js`). Dòng có `nhom='3.2.6.1'` cộng vào mục `3.2.6`.
- **Đổi dự án chỉ qua `openProject_()`** (client) — tải xong mới gán `S.cur` + `S.lines`, bỏ phản hồi cũ.
- **Đọc số người dùng gõ bằng `tkNum_()`** (hiểu `1.234.567` và `12,5`); chèn dữ liệu vào `onclick` bằng `escJs_()`, vào `href` bằng `safeUrl_()`.
- Các file giao diện dùng chung biến toàn cục (không bundler). Code chạy NGAY lúc nạp chỉ được gọi tới file đã nạp trước — `npm test` (scripts/check-load.js) kiểm tra; hàm gọi lúc người dùng bấm thì ở file nào cũng được. Thêm hàm mới: đặt vào file của tab dùng nó, dùng từ 2 tab trở lên thì đặt ở app.js.
- Công thức giá 1 dòng: server `calc_()` (store_supa.js) ↔ client `recalcLine_()` / `giaDaiLy_()` / `donGiaCK_()` — sửa một bên phải sửa bên kia.

## Chạy
```bash
npm install
npm start          # http://localhost:3000
npm test           # kiểm tra hàm thuần + luồng nhập thiết bị vệ sinh / sơn (DB giả, không đụng dữ liệu thật)
```
Cần file `.env` có `DATABASE_URL=postgresql://user:pass@host:port/db` (xem `.env.example`).

Thêm cột / bảng mới: viết `ALTER TABLE` cho PostgreSQL rồi cập nhật `db/postgres/schema.sql`. Cột đặt tên tiếng Anh thì thêm cặp `"ten_trong_code": "name_in_db"` vào `server/db-map.json`; cột không có trong file này được dùng nguyên tên.

File tải lên (ảnh SP, tài liệu) vẫn đi Supabase Storage — URL/key ghi sẵn trong `server/supa.js`, đổi project bằng `SUPABASE_URL_OVERRIDE` / `SUPABASE_KEY_OVERRIDE`.

## Deploy
Render (`render.yaml`), tự deploy khi push `main`. Biến bí mật nhập trên Render Dashboard: `DATABASE_URL` (PostgreSQL mà Render truy cập được — không phải localhost), `LARK_APP_ID`, `LARK_APP_SECRET` (tải ảnh cũ), `REPORT_WEBHOOK`, `PURCHASE_WEBHOOK`, `AUTH_SECRET`.
