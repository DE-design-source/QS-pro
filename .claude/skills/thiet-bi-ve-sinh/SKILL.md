---
name: thiet-bi-ve-sinh
description: Thêm/sửa/bỏ thông số (metric) của ngành Thiết bị vệ sinh theo từng hạng mục (Bồn cầu, Lavabo, Sen tắm…) trong QS Pro — form Nhập dữ liệu, file mẫu nhập hàng loạt, bộ lọc panel Bóc tách, panel chi tiết SP, cột Thông tin chính / Thông số thiết kế. Dùng khi user nói tới "thiết bị vệ sinh", "vs", "metric hạng mục", "file mẫu vệ sinh", "bộ lọc vệ sinh", hoặc thêm hạng mục vệ sinh mới.
---

# Thiết bị vệ sinh — thông số theo hạng mục

## Nguồn DUY NHẤT: `public/vs-spec.js`
Module UMD (`window.VS_SPEC` ở trình duyệt, `require('../public/vs-spec.js')` ở server). Mọi nơi đọc từ đây — **không** khai báo lại danh sách thông số ở chỗ khác.

- `METRIC[NHÃN] = [cột DB, nhãn hiển thị, kiểu 'text'|'sel'|'area', gợi ý nhập]` — NHÃN cũng là tiêu đề cột Excel và khoá của `DB_LABEL2COL`.
- `HM[hạng mục] = { chinh:[…], tk:[…], req:[…], opt:{NHÃN:[lựa chọn]}, mau:{dòng ví dụ} }`
  - `chinh` → khối "Key Product Info" + cột **Thông tin chính** (bảng bóc tách/báo giá)
  - `tk` → khối/cột **Thông số thiết kế**
  - `req` → bắt buộc (form chặn lưu, import báo lỗi từng dòng)
  - `opt` → danh sách chọn riêng hạng mục (datalist form, dropdown Excel, thứ tự chip bộ lọc)
- Helper: `chuanHM` (chuẩn hoá tên hạng mục), `labelsOf`, `optsOf`, `isReq`, `nganhOf(nganh, hangMuc)` (ngành trống + hạng mục vệ sinh ⇒ 'vs' — dùng ở CẢ client & server), `CHINH_ALL`/`TK_ALL`/`gom` (hợp thông số, dùng cho bảng, file mẫu, prodToObj), `CHUNG` (trường chung — import vệ sinh bỏ mọi cột ngoài CHUNG + thông số hạng mục), `kem` (hạng mục gợi ý combo), `VD` = tiền tố `[VÍ DỤ]` của dòng ví dụ trong file mẫu (tự bỏ qua khi nhập).

## Nơi tiêu thụ (tự đổi theo khi sửa vs-spec.js)
| Chỗ | File / hàm |
|---|---|
| Form Nhập + modal Sửa: chỉ hiện thông số của hạng mục đang chọn | `app.js` `DB_GROUPS_VS` (hợp mọi hạng mục), `vsApplyHM_`, `tdSave`, `speField_`, `spEditSave` (xoá thông số không thuộc hạng mục) |
| File mẫu nhập hàng loạt — **bố cục y hệt file mẫu đèn** (user yêu cầu): 1 sheet `San pham` phẳng, tiêu đề xanh sáng `FF2563EB` = bắt buộc / xanh đậm `FF12324C` = tuỳ chọn, 3 dòng ví dụ nền `FFF7F9FC` chữ nghiêng, tên bắt đầu `[VÍ DỤ]` (tự bỏ qua khi nhập), không dropdown/ghi chú; sheet `Hướng dẫn` đánh số + bảng thông số theo hạng mục | `server/vs-template.js` → route `GET /mau-nhap-thiet-bi-ve-sinh.xlsx` (tạo động, không có file tĩnh) |
| Đọc file: đọc MỌI sheet (trừ "Hướng dẫn"), HẠNG MỤC trống = tên sheet (vẫn nhận file kiểu cũ 1 sheet/hạng mục) | `server/store.js` `importParse(b64, ext, 'vs')` |
| Commit: đóng dấu `nganh='vs'`, chuẩn hoá hạng mục, bỏ cột của hạng mục khác, chặn thiếu bắt buộc | `server/store_supa.js` `importCommit` (client gửi `p._nganh='vs'`) |
| Xem trước import: ô "—" = không áp dụng, viền đỏ = thiếu bắt buộc | `app.js` `impVsCheck_`, `impRow_`, `impVsSummary_` |
| Ghép Thông tin chính / Thông số thiết kế | `store_supa.js` `prodToObj` nhánh `nganh==='vs'` |
| Panel chi tiết SP + chip thông số | `app.js` `pdSpecsVS_`, `vsChip_`, `vsVal_` (đọc `p.raw[cột]`) |
| Bộ lọc panel trái tab Bóc tách (đề mục 3.2.5) | `app.js` `renderVsFilters_`, `vsFltMatch_`, state `S.fVs={cột:{giá trị:1}}` |

## Checklist khi THÊM thông số mới
1. Thêm vào `METRIC` (cột DB snake_case, kiểu `text` — cột mới luôn là **text**, không đưa vào `DB_NUM`).
2. Gắn vào `chinh`/`tk` (+ `req`/`opt` nếu cần) của các hạng mục liên quan.
3. Viết migration `db/thiet_bi_ve_sinh_vN.sql` (`add column if not exists … text`, tắt RLS + grant, `notify pgrst,'reload schema'`) và thêm cột vào `COL_SQL` trong `store_supa.js` để lỗi thiếu cột hiện hướng dẫn.
4. **User phải chạy SQL trên Supabase** (không chạy được từ máy này — không có psql/connection string). Nhắc rõ trong câu trả lời.
5. Kiểm tra: `node --check public/app.js` và **`npm run test:vs`** (test hồi quy, DB giả — thêm ca test khi thêm logic mới).

## Ngành SƠN NƯỚC — cùng khuôn, khác spec
`public/son-spec.js` (`SON_SPEC`) là bản song song của vs-spec cho đề mục **3.2.2 Sơn nước**: cùng API (`METRIC`/`HM`/`HANG_MUC`/`CHUNG`/`chuanHM`/`labelsOf`/`optsOf`/`isReq`/`CHINH_ALL`/`TK_ALL`/`VD`), hạng mục = dòng sơn (Sơn nội thất · ngoại thất · lót · chống thấm · Bả matit · hiệu ứng · sàn epoxy · Dung môi), `chinh` = Key Product Info, `tk` = mục IX tính chất lý hoá. File mẫu `server/son-template.js` → `GET /mau-nhap-son-nuoc.xlsx`; migration `db/son_nuoc.sql`.

Chỗ chọn spec theo ngành (thêm ngành mới thì sửa đúng mấy chỗ này):
| Nơi | Hàm |
|---|---|
| Client | `specNganh_(ng)`, `nganhCuaSP_(p)`, `impGroups_`/`impFlat_`, `DB_GROUPS_SON`, `vsApplyHM_(box,hm,hienHet,ng)`, `impSpec_`, `spSpec_(p)` |
| Server | `nganhCua_`, `specNganh_`, `MUC_NGANH` (store_supa) và tham số `nganh` của `importParse` (store.js) |

Nhãn TRÙNG giữa 2 spec phải trỏ **cùng một cột DB** (MÀU SẮC · KÍCH THƯỚC · BỀ MẶT HOÀN THIỆN · LƯU Ý) — `npm run test:vs` có kiểm.

## Lưu ý / bẫy
- Nhãn phải DUY NHẤT toàn hệ thống (đèn + vệ sinh dùng chung `DB_LABEL2COL`); dùng lại nhãn đèn đã có (vd `CHẤT LIỆU`, `MÀU SẮC`) thì trùng cột là đúng ý.
- Tránh tiêu đề cột chứa chuỗi alias của `IMPORT_ALIAS` (`store.js`) đứng TRƯỚC cột gốc (vd "PRODUCT", "TÊN") — dò header theo chuỗi con.
- Đổi ngành đèn ↔ vệ sinh ở panel Bóc tách tự xoá `S.fNhomSet`/`S.fVs`; bộ lọc đèn (Công suất/Nhiệt độ/Góc) bị bỏ qua khi ở 3.2.5.
- Thứ tự ô trên form theo thứ tự khai báo của hạng mục (CSS `order`), không theo `DB_GROUPS_VS`.
- Nhập dữ liệu dùng **danh sách chờ** (`S._pending` sản phẩm / `S._ctPending` công tác): form/file chỉ đưa vào chờ, nút Thêm mới ghi DB. Có khoá `S._committing` chống bấm 2 lần; khi lưu xong chỉ bỏ các dòng đã lưu theo `uid` (dòng thêm trong lúc lưu được giữ). Lỗi `importCommit` trả `{i, ten, error}` — client ghép theo chỉ số `i`, KHÔNG theo tên (biến thể trùng tên).
- Khớp tiêu đề cột Excel (`matchAlias_`) theo NGUYÊN TỪ — tránh "ẢNH" khớp nhầm "BẢO HÀNH".
- **Ghi danh SP vào dự án phải theo ĐỀ MỤC CỦA NGÀNH**: vệ sinh → `3.2.5`, đèn → `3.2.6.1`. `addProdObj` lấy đề mục qua `prodNode_` (trong tab Bóc tách thì theo `S.node` người dùng chọn, ngoài Bóc tách theo `spNodeCodeOf_(p)` từ trường `muc`); form Nhập dùng `impLoai_()`. Đóng dấu sai đề mục ⇒ dòng vẫn lưu nhưng tab Dự án / Chi phí / Mua hàng lọc theo hạng mục sẽ không thấy — `hmLacNote_` báo "đang nằm ở hạng mục khác", `hmSaiNote_` + `hmSaiFix_` chuyển các dòng cũ về đúng đề mục.
