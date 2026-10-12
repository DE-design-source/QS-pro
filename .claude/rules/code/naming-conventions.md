# Naming Conventions — QS Pro

> Quy ước đặt tên ĐANG DÙNG trong repo. Code mới theo đúng, không đổi tên hàng loạt cái cũ.
> Repo không có cache/Redis, hàng đợi, sự kiện hay REST có phiên bản — không áp quy ước của các thứ đó.

## Ngôn ngữ

- Tên nghiệp vụ (bảng, cột, thư mục domain, nhiều hàm) là **tiếng Việt không dấu**; chú thích và chuỗi
  hiển thị là tiếng Việt có dấu. Giữ nguyên, không dịch sang tiếng Anh.

## Cơ sở dữ liệu (Supabase / Postgres)

| Thứ | Quy ước | Ví dụ |
|---|---|---|
| Bảng | `snake_case`, tiếng Việt không dấu, **số ít** | `du_an`, `db_san_pham`, `don_mua_hang`, `chi_tiet_de_xuat` |
| Bảng lịch sử | `<bảng>_history` | `db_san_pham_history`, `cong_tac_history` |
| Cột | `snake_case` | `ma_du_an`, `ten_sp`, `gia_ban_le`, `ck_dai_ly_pct` |
| Khoá công ty | luôn là `cong_ty_id` | — |
| Phần trăm / thời điểm | hậu tố `_pct` / `created_at`, `changed_at` | `loi_nhuan_pct` |
| Index (file mới) | `<bảng>_<cột>_idx`; unique: `<bảng>_<ý nghĩa>_key` | `de_xuat_tt_idx`, `db_san_pham_variant_key` |
| File migration | `db/<snake_case>.sql`; bản sau thêm `_v2`, `_v3` | `db/thiet_bi_ve_sinh_v2.sql` |

Cột thông số theo ngành khai báo trong `public/vs-spec.js` / `public/son-spec.js`; nhãn trùng giữa
hai spec phải trỏ cùng một cột.

## Server

| Thứ | Quy ước | Ví dụ |
|---|---|---|
| Thư mục domain | kebab-case không dấu | `san-pham/`, `mua-hang/`, `xuat-file/` |
| File | `<domain>.<vai trò>.js` | `du-an.routes.js`, `dong-boc-tach.repository.js`, `san-pham.import.js` |
| Hàm API (`fns`) | `camelCase`, **duy nhất toàn hệ thống** (trùng là server không khởi động) | `getProjects`, `ctSave`, `adminCreateUser`, `sendDeXuat` |
| Hàm API chỉ admin | tiền tố `admin` | `adminSetActive` |
| Cửa ngõ kiểm quyền trong service | hậu tố `Gated` | `updateProductGated`, `ctSaveGated` |
| Hàm nội bộ / helper | hậu tố `_` | `calc_`, `tblErr_`, `spPerms_`, `toNumber_` |
| Object trả về client | khoá `camelCase` (đổi từ cột `snake_case` ở repository/mapper) | `donGiaVon`, `maDA`, `thanhTienBan` |
| Biến môi trường | `UPPER_SNAKE_CASE` | `AUTH_SECRET`, `REPORT_WEBHOOK`, `SUPABASE_URL_OVERRIDE` |

## Client (`public/`)

| Thứ | Quy ước | Ví dụ |
|---|---|---|
| File tab | chữ thường viết liền, không gạch | `sanpham.js`, `muahang.js`, `baogia.js` |
| Hàm helper dùng chung | hậu tố `_` | `tkNum_`, `escJs_`, `safeUrl_`, `openProject_` |
| Hàm theo tab | tiền tố viết tắt của tab / tính năng | `imp*` (nhập), `sp*` (sản phẩm), `ct*` (công tác), `hm*` (hạng mục), `vs*` (vệ sinh) |
| Trạng thái toàn cục | trong object `S`; trường tạm có tiền tố `_` | `S.cur`, `S.lines`, `S._pending`, `S._viewAs` |
| Hằng toàn cục | `UPPER_SNAKE_CASE` | `TREE`, `DB_GROUPS_VS`, `VS_SPEC` |

Hàm client được `scripts/test-core.js` trích bằng regex phải là khai báo `function tên(` ở cấp cao nhất.

## Đường dẫn

- API nghiệp vụ: `POST /api/<tênHàm>` — không thêm REST `/api/v1/...`.
- Route lẻ: kebab-case tiếng Việt không dấu — `/export/san-pham`, `/upload/file`, `/mau-nhap-son-nuoc.xlsx`.

## Tài liệu

- File trong `docs/`: kebab-case không dấu (xem [docs-placement.md](../docs/docs-placement.md)).
- Quy trình nghiệp vụ: `docs/03-san-pham/flows/QT-<nn>-<slug>.md`.
