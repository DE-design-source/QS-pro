# QS Pro (Dezon Pro) – Bóc tách khối lượng / báo giá

Web app Node.js + Express: danh mục sản phẩm, dự án, bóc tách hạng mục, chi phí, tờ bìa (khái toán), xuất báo giá, mua hàng.
Nhiều công ty dùng chung (multi-tenant), dữ liệu trên **Supabase**.

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
server/index.js        Điểm khởi động: mở cổng + bật lịch báo cáo
server/app.js          Tạo Express, file tĩnh, gắn /api/:fn và route của từng domain, Swagger (/api-docs khi chạy dev)
server/config/         Biến môi trường: cổng, Lark, webhook
server/libraries/      Dùng chung, không chứa nghiệp vụ:
  rpc.js                 POST /api/:fn — ghép fns + quyền của mọi domain thành whitelist REGISTRY, kiểm đăng nhập/quyền
  supa.js                Client PostgREST + Storage; TỰ lọc theo công ty cho các bảng trong TENANT_TABLES
  tenant.js              Ngữ cảnh công ty theo request (AsyncLocalStorage)
  utils.js · vn-number.js · db-errors.js   Ép số/chuỗi, đọc số VN, đổi lỗi thiếu cột/bảng thành hướng dẫn chạy SQL
  lark.js · swagger.js   Tải ảnh cũ trên Lark cho /media · tài liệu API sinh tự động từ REGISTRY
server/components/     Nghiệp vụ, chia theo DOMAIN — mỗi thư mục: <domain>.routes.js (hàm API + quyền),
                       *.service.js (nghiệp vụ, kiểm quyền), *.repository.js (đọc/ghi Supabase)
  auth/                  Đăng nhập, phiên trong cookie HttpOnly (đối chiếu DB), cài đặt giao diện, đổi mật khẩu
  users/ · cong-ty/      Tài khoản (admin) · công ty (super admin)
  san-pham/              Danh mục SP: mapper (dòng DB -> object), combo, biến thể, yêu thích, nhập hàng loạt, yêu cầu xoá
  du-an/                 Dự án, dòng bóc tách, khái toán (tờ bìa), dữ liệu rời của dự án
  cong-tac/              Công tác xây dựng (phần thô)
  mua-hang/              Đơn mua hàng, đề xuất, thẻ Lark
  thong-bao/             Thông báo + nhật ký hoạt động (audit_log)
  bao-cao/               Báo cáo nhập SP gửi Lark theo lịch
  xuat-file/             Xuất Excel (báo giá, danh sách), file mẫu nhập hàng loạt
  tep-tin/               Tải ảnh/tài liệu lên kho, /media
db/*.sql               Migration — chạy tay trong Supabase SQL Editor
```

Quy ước quan trọng:
- **Mã tờ bìa = mã cây hạng mục Bóc tách** (`TREE` trong `app.js`). Dòng có `nhom='3.2.6.1'` cộng vào mục `3.2.6`.
- **Đổi dự án chỉ qua `openProject_()`** (client) — tải xong mới gán `S.cur` + `S.lines`, bỏ phản hồi cũ.
- **Đọc số người dùng gõ bằng `tkNum_()`** (hiểu `1.234.567` và `12,5`); chèn dữ liệu vào `onclick` bằng `escJs_()`, vào `href` bằng `safeUrl_()`.
- Các file giao diện dùng chung biến toàn cục (không bundler). Code chạy NGAY lúc nạp chỉ được gọi tới file đã nạp trước — `npm test` (scripts/check-load.js) kiểm tra; hàm gọi lúc người dùng bấm thì ở file nào cũng được. Thêm hàm mới: đặt vào file của tab dùng nó, dùng từ 2 tab trở lên thì đặt ở app.js.
- Công thức giá 1 dòng: server `calc_()` (components/du-an/dong-boc-tach.repository.js) ↔ client `recalcLine_()` / `giaDaiLy_()` / `donGiaCK_()` — sửa một bên phải sửa bên kia.

## Chạy
```bash
npm install
npm start          # http://localhost:3000
npm test           # kiểm tra hàm thuần + luồng nhập thiết bị vệ sinh / sơn (DB giả, không đụng dữ liệu thật)
```
Lưu ý: chạy local vẫn nối **Supabase production** (URL/key ghi sẵn trong `server/libraries/supa.js`). Muốn trỏ project khác: `SUPABASE_URL_OVERRIDE` / `SUPABASE_KEY_OVERRIDE`.

## Deploy
Render (`render.yaml`), tự deploy khi push `main`. Biến bí mật nhập trên Render Dashboard: `LARK_APP_ID`, `LARK_APP_SECRET` (tải ảnh cũ), `REPORT_WEBHOOK`, `PURCHASE_WEBHOOK`, `AUTH_SECRET`.
