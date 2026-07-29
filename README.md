# QS Pro – Hệ thống bóc tách khối lượng / báo giá (Decox)

Web app độc lập (Node.js + Express) cho quy trình QS: danh mục sản phẩm, dự án, bóc tách hạng mục, chi phí, khái toán (tờ bìa) và xuất báo giá.

Bản này **clone từ web app Google Apps Script** cũ nhưng **thay Google Sheets bằng Lark Base** làm nguồn dữ liệu. Giao diện (`public/index.html`) giữ gần như nguyên; toàn bộ lời gọi server đi qua `POST /api/:fn`.

## Kiến trúc
```
public/index.html   Giao diện (SPA). api(fn,...args) -> POST /api/:fn
server/index.js     Express: static + /api/:fn (dispatch) + /media (proxy ảnh Lark)
server/store.js     Nghiệp vụ port từ Code.gs, chạy trên Lark Base
server/lark.js      Client Lark Open API (token, CRUD bitable, tables/fields, media)
server/export.js    Xuất Excel (.xlsx) bằng ExcelJS  (PDF = In trình duyệt, ở client)
server/config.js    Đọc .env + nhớ id các bảng app tự tạo (server/tables.local.json)
server/introspect.js  `npm run introspect` — in field bảng sản phẩm để kiểm tra mapping
```

## Dữ liệu trên Lark Base
Cùng một Base (`app_token` trong `.env`) gồm 4 bảng:

| Bảng | Vai trò |
|---|---|
| **Danh mục sản phẩm** | Sản phẩm gốc: Tên sản phẩm, Nhóm, Hạng mục, Thương hiệu, Nhà cung cấp, Mã SP, Mô tả, Kích thước, ĐVT, Đơn giá, Hình ảnh |
| **Dự án** | Mỗi record 1 dự án |
| **Chi tiết báo giá** | Mỗi record 1 hạng mục, gắn `Mã DA` |
| **Khái toán** | Dòng tờ bìa (ước tính chi phí) |

Cả 4 bảng đều **app tự tạo/tự khớp theo tên** ở lần chạy đầu (nếu Lark app có quyền tạo bảng — scope `base:table:create`) và lưu id vào `server/tables.local.json`. Nếu đã có sẵn bảng danh mục mặt hàng (có Đơn giá), điền `LARK_TBL_PRODUCTS` vào `.env` để dùng bảng đó thay vì tạo mới. Nếu app không có quyền tạo bảng: tự tạo trên Lark rồi điền các `LARK_TBL_*` vào `.env`.

> Lưu ý: bảng `tblnJMfzuGgTxzII` trong Base mẫu là **Nhà cung cấp/Thương hiệu**, không phải danh mục mặt hàng — nên để `LARK_TBL_PRODUCTS` trống cho app tạo bảng `Danh mục sản phẩm` riêng.

Tên cột bảng sản phẩm được dò **theo tên** (fuzzy, dấu tiếng Việt) nên không sợ đổi thứ tự; alias xem trong `server/store.js` (`productFieldMap`).

## Cài đặt & chạy
1. Yêu cầu **Node.js ≥ 18** (khuyến nghị 20+).
2. Tạo Lark custom app (Developer Console), bật quyền **Bitable đọc/ghi** (và tạo bảng nếu muốn auto-provision), rồi **thêm app vào Base** (Base ▸ ••• ▸ Add app / Cấp quyền).
3. Sao chép cấu hình:
   ```bash
   cp .env.example .env
   ```
   Điền `LARK_APP_ID`, `LARK_APP_SECRET` (và kiểm tra `LARK_APP_TOKEN`, `LARK_TBL_PRODUCTS`).
4. Cài phụ thuộc:
   ```bash
   npm install
   ```
5. (Khuyến nghị) Kiểm tra kết nối + tên cột bảng sản phẩm:
   ```bash
   npm run introspect
   ```
6. Chạy:
   ```bash
   npm start
   ```
   Mở http://localhost:3000

## Xuất báo giá
- **Excel (.xlsx):** dựng bằng ExcelJS (Tờ bìa · 3.2 Phần hoàn thiện · mỗi Nhóm 1 sheet), tải file trực tiếp.
- **PDF:** mở trang in tự chứa và gọi hộp thoại **In → Lưu thành PDF** của trình duyệt.

## Deploy web (Render)
Repo có sẵn `render.yaml` (Blueprint). Các bước:
1. Đăng nhập [render.com](https://render.com) (đăng ký bằng GitHub).
2. **New ▸ Blueprint** → kết nối GitHub → chọn repo `DE-design-source/QS-pro`.
3. Render đọc `render.yaml` và hỏi 2 biến bí mật — nhập:
   - `LARK_APP_ID`
   - `LARK_APP_SECRET`
   (App Token & table id đã cấu hình sẵn trong `render.yaml`; secret không nằm trong code.)
4. **Apply / Deploy** → chờ build. Xong sẽ có link cố định dạng `https://qs-pro-xxxx.onrender.com`.

> Gói **free** của Render sẽ "ngủ" sau ~15 phút không dùng; request đầu tiên sau khi ngủ mất ~30–60s để dậy. Cần chạy liên tục thì nâng lên gói trả phí.

## Ghi chú
- `.env` và `server/tables.local.json` **không commit** (đã có trong `.gitignore`).
- Ảnh sản phẩm dạng attachment của Lark được phục vụ qua proxy `/media?token=…` (dùng token phía server).
- Cụm quốc tế (larksuite.com) dùng `LARK_DOMAIN=https://open.larksuite.com`; cụm Trung Quốc (feishu.cn) dùng `https://open.feishu.cn`.
