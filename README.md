# QS Pro (Dezon Pro) – Bóc tách khối lượng / báo giá

Web app Node.js + Express: danh mục sản phẩm, dự án, bóc tách hạng mục, chi phí, tờ bìa (khái toán), xuất báo giá, mua hàng.
Nhiều công ty dùng chung (multi-tenant), dữ liệu trên **Supabase**.

## Kiến trúc
```
public/index.html      Giao diện + CSS (SPA)
public/app.js          Lõi giao diện dùng chung: S, api(), công thức giá, editLine, cột, popup, cây hạng mục + các tab chưa tách
public/boc.js          Tab Bóc tách: bảng theo tầng, thêm SP, menu chuột phải, tìm nhanh, chọn/sửa hàng loạt, chọn vùng ô
public/main.js         Khởi động — luôn nạp SAU CÙNG (index.html: app.js → <tab>.js → main.js)
public/vs-spec.js      Thông số thiết bị vệ sinh theo hạng mục (dùng cả client lẫn server)
public/son-spec.js     Thông số sơn nước theo hạng mục
server/index.js        Express: /api/:fn (whitelist REGISTRY + phân quyền), /export/*, /media, thẻ Lark, lịch báo cáo
server/auth.js         Đăng nhập, phiên (token + đối chiếu DB), tài khoản, công ty, duyệt đơn/đề xuất/yêu cầu xoá
server/store_supa.js   Nghiệp vụ trên Supabase: sản phẩm, dự án, dòng bóc tách, tờ bìa, công tác, mua hàng
server/supa.js         Client PostgREST + Storage; TỰ lọc theo công ty cho các bảng trong TENANT_TABLES
server/tenant.js       Ngữ cảnh công ty theo request (AsyncLocalStorage)
server/shared.js       Hàm thuần: mẫu tờ bìa, NCC 3.2, đọc số VN, đọc file nhập hàng loạt
server/export.js       Xuất Excel báo giá (ExcelJS)
server/lark.js         Chỉ còn tải ảnh cũ lưu trên Lark cho /media
db/*.sql               Migration — chạy tay trong Supabase SQL Editor
```

Quy ước quan trọng:
- **Mã tờ bìa = mã cây hạng mục Bóc tách** (`TREE` trong `app.js`). Dòng có `nhom='3.2.6.1'` cộng vào mục `3.2.6`.
- **Đổi dự án chỉ qua `openProject_()`** (client) — tải xong mới gán `S.cur` + `S.lines`, bỏ phản hồi cũ.
- **Đọc số người dùng gõ bằng `tkNum_()`** (hiểu `1.234.567` và `12,5`); chèn dữ liệu vào `onclick` bằng `escJs_()`, vào `href` bằng `safeUrl_()`.
- Tách thêm tab ra file riêng: code chạy NGAY lúc nạp chỉ được gọi tới file đã nạp trước; `npm test` (scripts/check-load.js) kiểm tra việc này.
- Công thức giá 1 dòng: server `calc_()` (store_supa.js) ↔ client `recalcLine_()` / `giaDaiLy_()` / `donGiaCK_()` — sửa một bên phải sửa bên kia.

## Chạy
```bash
npm install
npm start          # http://localhost:3000
npm test           # kiểm tra hàm thuần + luồng nhập thiết bị vệ sinh / sơn (DB giả, không đụng dữ liệu thật)
```
Lưu ý: chạy local vẫn nối **Supabase production** (URL/key ghi sẵn trong `server/supa.js`). Muốn trỏ project khác: `SUPABASE_URL_OVERRIDE` / `SUPABASE_KEY_OVERRIDE`.

## Deploy
Render (`render.yaml`), tự deploy khi push `main`. Biến bí mật nhập trên Render Dashboard: `LARK_APP_ID`, `LARK_APP_SECRET` (tải ảnh cũ), `REPORT_WEBHOOK`, `PURCHASE_WEBHOOK`, `AUTH_SECRET`.
