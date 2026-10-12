# Folder Structure — QS Pro

> **Level:** MANDATORY.
> **Rule:** File mới phải đặt đúng vị trí theo layout HIỆN CÓ của repo. Không tự chế layout riêng,
> không refactor layout chỉ để khớp một chuẩn bên ngoài (trừ khi user yêu cầu rõ).

Stack: Node.js + Express (CommonJS, không TypeScript, không bundler) · giao diện là script thuần
dùng chung biến toàn cục · dữ liệu trên Supabase. Sơ đồ file chi tiết: [README.md](../../../README.md).

---

## Layout

```
server/
├── index.js                 # mở cổng + bật job nền — KHÔNG đặt route ở đây
├── app.js                   # tạo Express, gắn ROUTES của mọi domain
├── config/                  # biến môi trường
├── libraries/               # dùng chung, KHÔNG chứa nghiệp vụ (rpc, supa, tenant, utils…)
└── components/<domain>/     # nghiệp vụ, chia theo domain (tên thư mục tiếng Việt không dấu, kebab-case)
    ├── <domain>.routes.js       # fns + quyền (public/actor/admin/super) + router Express nếu có route lẻ
    ├── <tên>.service.js         # nghiệp vụ, kiểm quyền chi tiết (hàm ...Gated)
    ├── <tên>.repository.js      # đọc/ghi Supabase, đổi dòng DB <-> object
    └── <domain>.<phần>.js       # phần tách riêng của domain (vd san-pham.import.js, san-pham.mapper.js)
public/
├── index.html               # markup + toàn bộ CSS
├── app.js                   # lõi dùng chung
├── <tab>.js                 # mỗi tab 1 file (boc, sanpham, nhap, phantho, bangtinh, chiphi, duan, muahang, baogia, dash, admin, congty)
├── main.js                  # khởi động — luôn nạp SAU CÙNG
└── *-spec.js                # thông số theo ngành, dùng cả client lẫn server (UMD)
db/<ten>.sql                 # migration, chạy tay trên Supabase SQL Editor
scripts/                     # test (test-*.js, check-load.js) + script sinh file mẫu
docs/                        # tài liệu cho người đọc — xem ../docs/docs-placement.md
```

Khác với layout `nodebestpractices` gốc: thư mục là `server/` (không phải `src/`), **không có lớp
controller** (routes khai báo thẳng hàm service/repository vào `fns`), không có thư mục `test/`.

---

## Đặt file mới ở đâu

| Việc | Vị trí |
|---|---|
| Hàm API mới của domain có sẵn | hàm vào `*.service.js` / `*.repository.js`, khai tên + quyền trong `<domain>.routes.js` |
| Domain mới | `server/components/<domain>/` + thêm vào `ROUTES` trong `server/app.js` |
| Tiện ích không gắn nghiệp vụ | `server/libraries/` |
| Route tải file / upload (không phải `/api/:fn`) | `router` trong `<domain>.routes.js` — tự gọi `actorOf_` + `tenant.run` |
| Hàm giao diện dùng cho 1 tab | file của tab đó |
| Hàm giao diện dùng từ 2 tab trở lên | `public/app.js` |
| File script giao diện mới | `public/` + thêm thẻ `<script>` vào `index.html` đúng thứ tự (trước `main.js`) |
| Thêm cột / bảng | file mới `db/<ten>.sql` (không sửa file SQL đã chạy) + `COL_SQL` trong `libraries/db-errors.js`; bảng theo công ty thêm vào `TENANT_TABLES` |
| Test | `scripts/test-<ten>.js` + nối vào script `test` trong `package.json` |

---

## Anti-patterns

- Gọi `supa.*` trực tiếp từ `*.routes.js`, hoặc đặt nghiệp vụ trong `libraries/`.
- Thêm route vào `server/index.js` / `server/app.js` thay vì routes của domain.
- Tạo `src/`, `controllers/`, `models/`, `utils/` toàn cục — repo chia theo domain.
- Thêm bundler / module ES / framework giao diện vào `public/` khi user không yêu cầu.
- Code chạy ngay lúc nạp ở một file tab mà gọi hàm của file nạp sau (`node scripts/check-load.js` báo lỗi).
