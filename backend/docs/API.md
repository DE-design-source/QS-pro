# API

Hai lối vào dùng chung một tầng service: cổng tương thích `POST /api/<tênHàm>` và REST `/api/v1`.

## 1. Cổng tương thích: `POST /api/<tênHàm>`

Giao diện cũ `public/` của app Node (đã gỡ khỏi repo) dùng lối này. Hành vi giữ đúng như `server/index.js`.

Request:

```
POST /api/getLines
Authorization: Bearer <token>          (hoặc "token" trong thân JSON, cạnh "args")
x-view-company: <id công ty>           (chỉ có tác dụng với super)
Content-Type: application/json

{"args": ["DA-001"]}
```

- `args` là mảng tham số theo đúng thứ tự của hàm Node (không tính actor).
- Token ở header được ưu tiên hơn `token` trong thân.

Response (luôn kèm header `x-app-ver`):

| Trường hợp | Mã | Thân |
|---|---|---|
| Thành công | 200 | `{"ok":true,"result":<giá trị>}` (hàm không trả gì -> `null`) |
| Tên hàm không có | 404 | `{"error":"Không hỗ trợ hàm: <tên>"}` |
| Chưa đăng nhập / token sai / tài khoản bị khoá | 401 | `{"error":"Chưa đăng nhập","code":"NOAUTH"}` |
| Hàm chỉ Admin | 403 | `{"error":"Không có quyền (chỉ Admin)"}` |
| Hàm chỉ quản trị hệ thống | 403 | `{"error":"Chỉ quản trị hệ thống"}` |
| Hàm báo lỗi | 500 | `{"error":"<thông báo>"}` (không có thông báo -> `Lỗi máy chủ`) |
| Thân JSON hỏng | 400 | trang lỗi HTML kiểu Express (`Bad Request`) |
| Thân JSON quá 30 MB | 413 | trang lỗi HTML (`Payload Too Large`) |

Cổng này LUÔN trả 500 cho lỗi của hàm, kể cả khi service trả lỗi có mã 4xx.

### Quyền của từng hàm (theo `server/index.js`)

- Không cần đăng nhập: `login`.
- Chỉ super: `listCongTy`, `createCongTy`, `deleteCongTy`, `listCongTyUsers`, `createCongTyUser`, `baoCaoNhapSP`.
- Chỉ admin (super cũng được): `adminListUsers`, `adminCreateUser`, `adminUpdateUser`, `adminSetPassword`, `adminSetActive`,
  `adminDeleteUser`, `getAuditLog`, `listDeleteRequests`, `resolveDeleteRequest`, `listPurchaseRequests`, `getPurchaseOrder`,
  `resolvePurchaseRequest`, `listDeXuat`, `getDeXuat`, `resolveDeXuat`, `deleteDbProduct`, `updateCongTy`.
- Còn lại: chỉ cần đăng nhập.

Danh sách hàm đang đăng ký trên server đang chạy: `Registry.Names()` (xem `internal/server/rpc`).
Tham số của từng hàm: `docs/PORTING_MAP.md` mục A, hoặc `GET /api-docs.json`.

## 2. REST: `/api/v1`

Chỉ bản Go có. Cùng cách xác thực (`Authorization: Bearer <token>`, `x-view-company`), cùng phong bì:

- thành công: `{"ok":true,"result":...}`
- lỗi: `{"error":"...","code":"..."}`; mã HTTP lấy từ lỗi của service (4xx nếu service đặt), lỗi thường là 500
- chưa đăng nhập 401 `{"error":"Chưa đăng nhập","code":"NOAUTH"}`; sai quyền 403 như cổng rpc
- response REST KHÔNG có header `x-app-ver` (chỉ cổng `/api/:fn` gắn header này)

Mỗi route gọi đúng phương thức service mà hàm rpc tương ứng gọi, nên kết quả và quy tắc nghiệp vụ giống nhau.

Quy ước truyền tham số:

- Tham số đường dẫn (`:id`, `:key`, `:code`, `:khoa`) ứng với các tham số ĐẦU của hàm rpc, theo thứ tự.
- Tham số còn lại: `GET` lấy từ query string, phương thức khác lấy từ thân JSON theo tên tham số
  (tên tham số từng hàm: `docs/PORTING_MAP.md` mục A; hàm nhận nguyên một object thì thân JSON chính là object đó).
- Phương thức dùng: `GET` đọc, `POST` tạo / thao tác, `PATCH` sửa một phần, `PUT` ghi đè một giá trị, `DELETE` xoá.

Bảng route đầy đủ (80 route, sinh từ `RestRoutes` trong `internal/server/rest.go`; quyền lấy từ `tests/fixtures/registry.json`).
Quyền `admin` nghĩa là admin hoặc super. Test `TestRestRoutes` buộc bảng trong `rest.go` khớp với route thật.

| Phương thức | Đường dẫn (sau `/api/v1`) | Hàm rpc | Quyền |
|---|---|---|---|
| `GET` | `/audit-log` | `getAuditLog` | admin |
| `POST` | `/auth/change-password` | `changePassword` | đăng nhập |
| `POST` | `/auth/login` | `login` | không cần đăng nhập |
| `POST` | `/auth/logout` | `logout` | đăng nhập |
| `GET` | `/auth/me` | `me` | đăng nhập |
| `PUT` | `/auth/me/prefs/:key` | `setMyPref` | đăng nhập |
| `GET` | `/bootstrap` | `bootstrap` | đăng nhập |
| `POST` | `/client-errors` | `logClientError` | đăng nhập |
| `GET` | `/companies` | `listCongTy` | super |
| `POST` | `/companies` | `createCongTy` | super |
| `DELETE` | `/companies/:id` | `deleteCongTy` | super |
| `PATCH` | `/companies/:id` | `updateCongTy` | admin |
| `GET` | `/companies/:id/users` | `listCongTyUsers` | super |
| `POST` | `/companies/:id/users` | `createCongTyUser` | super |
| `DELETE` | `/lines/:id` | `deleteLine` | đăng nhập |
| `PATCH` | `/lines/:id` | `updateLine` | đăng nhập |
| `POST` | `/lines/save-as-product` | `saveLineAsProduct` | đăng nhập |
| `GET` | `/notifications` | `notifList` | đăng nhập |
| `POST` | `/notifications/:id/read` | `notifRead` | đăng nhập |
| `POST` | `/notifications/read-all` | `notifReadAll` | đăng nhập |
| `GET` | `/notifications/unread-count` | `notifCount` | đăng nhập |
| `POST` | `/product-approvals` | `setSpDuyet` | đăng nhập |
| `GET` | `/product-delete-requests` | `listDeleteRequests` | admin |
| `POST` | `/product-delete-requests` | `requestDeleteProducts` | đăng nhập |
| `POST` | `/product-delete-requests/:id/resolve` | `resolveDeleteRequest` | admin |
| `POST` | `/product-favorites` | `setYeuThich` | đăng nhập |
| `POST` | `/product-imports/commit` | `importCommit` | đăng nhập |
| `POST` | `/product-imports/parse` | `importParse` | đăng nhập |
| `GET` | `/product-permissions` | `spMyPerms` | đăng nhập |
| `GET` | `/products` | `getProducts` | đăng nhập |
| `POST` | `/products` | `saveDbProduct` | đăng nhập |
| `DELETE` | `/products/:key` | `deleteDbProduct` | admin |
| `GET` | `/products/:key` | `getDbProduct` | đăng nhập |
| `PATCH` | `/products/:key` | `updateDbProductTracked` | đăng nhập |
| `GET` | `/products/:key/combo` | `getCombo` | đăng nhập |
| `PUT` | `/products/:key/combo` | `setCombo` | đăng nhập |
| `GET` | `/products/:key/history` | `getProductHistory` | đăng nhập |
| `GET` | `/products/:key/variants` | `getBienThe` | đăng nhập |
| `PUT` | `/products/:key/variants` | `setBienThe` | đăng nhập |
| `GET` | `/projects` | `getProjects` | đăng nhập |
| `POST` | `/projects` | `createProject` | đăng nhập |
| `DELETE` | `/projects/:id` | `deleteProject` | đăng nhập |
| `PATCH` | `/projects/:id` | `updateProject` | đăng nhập |
| `GET` | `/projects/:id/cover` | `getCoverOrInit` | đăng nhập |
| `PUT` | `/projects/:id/cover` | `saveCover` | đăng nhập |
| `GET` | `/projects/:id/cover/template` | `buildCoverFromTemplate` | đăng nhập |
| `GET` | `/projects/:id/data` | `getProjData` | đăng nhập |
| `PUT` | `/projects/:id/data/:khoa` | `setProjData` | đăng nhập |
| `POST` | `/projects/:id/duplicate` | `duplicateProject` | đăng nhập |
| `GET` | `/projects/:id/lines` | `getLines` | đăng nhập |
| `POST` | `/projects/:id/lines` | `addLine` | đăng nhập |
| `POST` | `/projects/:id/lines/blank` | `addBlankLine` | đăng nhập |
| `GET` | `/projects/:id/proposals` | `getDeXuatList` | đăng nhập |
| `GET` | `/projects/:id/purchase-orders` | `getPurchaseOrders` | đăng nhập |
| `POST` | `/projects/:id/quotation/export` | `exportBaoGia` | đăng nhập |
| `GET` | `/proposals` | `listDeXuat` | admin |
| `POST` | `/proposals` | `sendDeXuat` | đăng nhập |
| `GET` | `/proposals/:code` | `getDeXuat` | admin |
| `POST` | `/proposals/:code/resolve` | `resolveDeXuat` | admin |
| `GET` | `/purchase-orders` | `listPurchaseRequests` | admin |
| `POST` | `/purchase-orders` | `sendPurchaseRequest` | đăng nhập |
| `GET` | `/purchase-orders/:code` | `getPurchaseOrder` | admin |
| `POST` | `/purchase-orders/:code/resolve` | `resolvePurchaseRequest` | admin |
| `PATCH` | `/purchase-orders/:code/status` | `setPurchaseStatus` | đăng nhập |
| `POST` | `/reports/new-products` | `baoCaoNhapSP` | super |
| `POST` | `/uploads/files-base64` | `uploadFile` | đăng nhập |
| `POST` | `/uploads/images` | `uploadImage` | đăng nhập |
| `GET` | `/users` | `adminListUsers` | admin |
| `POST` | `/users` | `adminCreateUser` | admin |
| `DELETE` | `/users/:id` | `adminDeleteUser` | admin |
| `PATCH` | `/users/:id` | `adminUpdateUser` | admin |
| `PUT` | `/users/:id/active` | `adminSetActive` | admin |
| `PUT` | `/users/:id/password` | `adminSetPassword` | admin |
| `GET` | `/work-items` | `ctList` | đăng nhập |
| `POST` | `/work-items` | `ctSave` | đăng nhập |
| `PATCH` | `/work-items/:id` | `ctUpdate` | đăng nhập |
| `GET` | `/work-items/:id/history` | `ctHistory` | đăng nhập |
| `POST` | `/work-items/approval` | `ctDuyet` | đăng nhập |
| `POST` | `/work-items/delete` | `ctDelete` | đăng nhập |
| `POST` | `/work-items/favorites` | `ctFav` | đăng nhập |

Không có route `GET /projects/:id` (chi tiết một dự án): dùng `GET /bootstrap?maDA=` hoặc các route con của dự án.

### 2.1 REST chỉ bản Go

Từ khi gỡ app Node, tính năng mới KHÔNG thêm hàm `POST /api/<tênHàm>` (cổng rpc giữ đúng 80 hàm của Node, test
`TestRegistryParity` so với `tests/fixtures/registry.json`) và KHÔNG thêm dòng vào bảng `RestRoutes`. Tính năng mới là route REST
"chỉ bản Go" dưới `/api/v1`, do chính module khai ở hai chỗ:

1. Trong `RegisterRPC`: `reg.RegisterGoRoute(rpc.GoRoute{...})` - tên, method, đường dẫn, quyền, nhóm tài liệu, tham số.
   Trùng `Name`, trùng `Method + Path`, hoặc `Name` trùng một hàm rpc -> panic lúc khởi động.
2. Trong `RegisterRoutes`: route gin CÙNG method + đường dẫn, với middleware khớp `Perm`:

| `Perm` | Middleware | Chặn |
|---|---|---|
| `rpc.Login` | `middleware.RequireLogin()` | 401 `{"error":"Chưa đăng nhập","code":"NOAUTH"}` |
| `rpc.Admin` | `middleware.RequireAdmin()` | 401 như trên; nhân viên 403 `{"error":"Không có quyền (chỉ Admin)"}` |
| `rpc.Super` | `middleware.RequireSuper()` | 401 như trên; nhân viên / admin 403 `{"error":"Chỉ quản trị hệ thống"}` |
| `rpc.Admin\|rpc.Super` | `middleware.RequireAdminSuper()` | như `Admin` rồi `Super` |
| `rpc.Public` | (không gắn) | không chặn |

```go
// internal/modules/<tên>/handler.go
func (s *Service) RegisterRPC(reg *rpc.Registry) {
    // ... các reg.Register(...) cũ giữ nguyên ...
    reg.RegisterGoRoute(rpc.GoRoute{
        Name: "productPrivateCopy", Method: "POST", Path: "/products/:key/private-copy", Perm: rpc.Login,
        Tag: "Sản phẩm", Summary: "Chép sản phẩm kho chung sang công ty mình",
        Fields: []rpc.GoField{
            {Name: "key", In: "path", Desc: "Khoá sản phẩm"},
            {Name: "ghiChu", In: "body", Type: "string", Desc: "Ghi chú (tuỳ chọn)"},
        },
    })
}

func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {
    v1.POST("/products/:key/private-copy", middleware.RequireLogin(), func(c *gin.Context) {
        r, err := s.PrivateCopy(c.Request.Context(), actor.FromGin(c), c.Param("key"), middleware.BodyMap(c))
        response.Result(c, r, err)
    })
}
```

(Ví dụ minh hoạ cách khai; tên hàm service là giả định.)

- `GoField.In`: `path` | `query` | `body` (body = một khoá của thân JSON object); `Type` là kiểu OpenAPI, bỏ trống được.
  Tham số đường dẫn không khai trong `Fields` vẫn được ghi vào tài liệu (kiểu `string`); field `In: "path"` luôn bắt buộc
  (`Required` bỏ qua). `RegisterGoRoute` panic khi: field `path` không có `:ten` tương ứng trong `Path`, trùng cặp (`In`, `Name`),
  `Path` có đoạn `*` / `:` không tên / tham số trùng.
- Phong bì như mọi route REST: `{"ok":true,"result":...}` / `{"error":"...","code":"..."}` (dùng `response.Result` / `response.Fail`).
- Tài liệu `/api-docs.json` tự có thao tác của route: nhóm `REST - <Tag> (chỉ bản Go)` (`Tag` trống -> `Khác`),
  `operationId` = `v1go_<Name>`. Không sửa `internal/server/apidocs/*` (dữ liệu của Node, đóng băng).
- Test `TestRestRoutes` coi route `/api/v1` ngoài bảng `RestRoutes` là hợp lệ khi đã khai bằng `RegisterGoRoute`, và kiểm 401 / 403 theo `Perm`
  (người không đủ quyền bị chặn đúng thân; người đủ quyền KHÔNG bị middleware chặn - gắn middleware chặt hơn `Perm` cũng hỏng test);
  route gắn mà không khai, hoặc khai mà không gắn, đều làm test hỏng. Ca đủ quyền chạy handler thật với request đã huỷ context
  và server không có database: handler không được ghi gì ngoài database / dịch vụ ngoài khi đó.
- Hàm rpc cũ (80 hàm) chỉ được thêm tham số TUỲ CHỌN ở CUỐI `args`, hoặc nối khoá MỚI vào CUỐI object kết quả; không đổi tên, quyền,
  thứ tự tham số, kiểu kết quả của hàm cũ.
- Cột database mới: chạy `go run ./cmd/migrate` TRƯỚC khi chạy bản server mới (server không tự migrate). Lệnh ghi cột mới là lệnh RIÊNG,
  chạy sau lệnh chính; gặp lỗi `42703` (database chưa migrate) thì ghi log và bỏ qua, không làm hỏng thao tác chính.

Route chỉ bản Go hiện có: chưa có (các đơn vị của backlog sẽ thêm; danh sách đầy đủ luôn ở `/api-docs.json`, nhóm `(chỉ bản Go)`).

Tham số / kiểm tra mới trên route cũ (chỉ bản Go; chi tiết ở `ARCHITECTURE.md` mục 10.4):

- `PATCH /users/:id` (`adminUpdateUser`): khoá thân `email` (tuỳ chọn). Trùng email đang lưu (trim + chữ thường) = không đổi, không ghi.
  Đổi: trim + chữ thường; `""` / null = xoá; sai dạng -> `Email không hợp lệ`; trùng tài khoản khác cùng công ty ->
  `Email đã dùng cho tài khoản khác trong công ty`. `POST /users` (`adminCreateUser`) không đổi.
- `POST /companies`, `PATCH /companies/:id` (`createCongTy`, `updateCongTy`): `mauChinh` khác null phải là `""`, `#RGB` hoặc `#RRGGBB`,
  khác -> `Màu chính phải dạng #RRGGBB`. `createCongTy` không lưu màu (như Node): lưu bằng `updateCongTy` sau khi tạo.

Tài liệu Swagger của 80 route cũ là dữ liệu Node đóng băng nên KHÔNG ghi các khoá mới này.

## 3. Route khác

Route lẻ của nghiệp vụ (giữ nguyên đường dẫn của bản Node, bảng `RootRoutes` trong `rest.go`):

| Route | Đăng nhập | Ý nghĩa |
|---|---|---|
| `GET /media?token=` | không | tải ảnh cũ từ Lark |
| `POST /export/cong-tac` | có | xuất Excel công tác (header `X-Row-Count`) |
| `POST /export/san-pham` | có | xuất Excel sản phẩm (header `X-Row-Count`) |
| `POST /export/bang` | có | xuất Excel một bảng bất kỳ |
| `POST /upload/file` | có | tải file lên kho (tối đa 50 MB) |
| `GET /mau-nhap-thiet-bi-ve-sinh.xlsx` | không | file mẫu nhập thiết bị vệ sinh |
| `GET /mau-nhap-cong-tac-o-cam.xlsx` | không | file mẫu nhập công tắc - ổ cắm |
| `GET /mau-nhap-son-nuoc.xlsx` | không | file mẫu nhập sơn nước |
| `GET /healthz` | không | `{"ok":true}` |

Route lẻ cần đăng nhập nhận token ở header hoặc `token` trong thân; thiếu thì trả 401 `{"error":"Chưa đăng nhập"}` (không có `code`).

Tài liệu API (Swagger), bật / tắt như bản Node: `SWAGGER_DOCS=0` tắt; `NODE_ENV=production` thì cần `SWAGGER_DOCS=1` mới bật.
Image Docker đặt sẵn `NODE_ENV=production`, nên trong image các route dưới đây trả 404 cho tới khi đặt `SWAGGER_DOCS=1`.
| Route | Ý nghĩa |
|---|---|
| `GET /api-docs.json` | spec OpenAPI: phần của Node (80 path `/api/<fn>` + 9 route lẻ) cộng 80 thao tác REST `/api/v1` và thao tác của các route chỉ bản Go (mục 2.1) |
| `/api-docs` | chuyển hướng 301 sang `/api-docs/` |
| `/api-docs/*` | Swagger UI nhúng sẵn (không gọi CDN); `*/package.json` trả 404 `Not Found` |

`/api-docs` và mọi đường dẫn con trả lời MỌI phương thức và không phân biệt hoa thường, như `app.use('/api-docs', ...)` của bản Node.

Giao diện:

| Route | Ý nghĩa |
|---|---|
| `GET /vs-spec.js`, `/son-spec.js`, `/ct-spec.js` | spec ngành (UMD) nhúng trong binary, `application/javascript; charset=UTF-8`, `Cache-Control: no-cache`; không cần đăng nhập |
| `GET /logo.svg` | logo mặc định nhúng trong binary, `image/svg+xml`, `Cache-Control: public, max-age=0` |
| `GET /mau-nhap-hang-loat.xlsx` | file mẫu nhập hàng loạt sản phẩm nhúng trong binary, `Cache-Control: public, max-age=0` |
| `GET /mau-nhap-cong-tac.xlsx` | file mẫu nhập công tác (Phần thô) nhúng trong binary (module estimates), `Cache-Control: public, max-age=0` |
| `GET /` và file trong `STATIC_DIR` | TUỲ CHỌN (chỉ khi đặt `STATIC_DIR`): giao diện cũ (HTML / JS / CSS luôn `Cache-Control: no-cache`) |
| `GET /vendor/jspreadsheet/*`, `/vendor/formula/*`, `/vendor/jsuites/*` | TUỲ CHỌN (chỉ khi đặt `STATIC_DIR`): thư viện bảng tính lấy từ `VENDOR_DIR`, cache 7 ngày |

File nhúng trả như `express.static` trước đây: GET / HEAD, `Accept-Ranges: bytes`, ETag yếu theo nội dung (gửi lại `If-None-Match` -> 304), không có `Last-Modified`.

## 4. Lỗi chung cho mọi route

| Trường hợp | Mã | Thân |
|---|---|---|
| Đường dẫn không có (kể cả dưới `/api/v1`) hoặc sai phương thức | 404 | trang HTML kiểu Express: `Cannot <METHOD> <đường dẫn>` |
| Thân JSON quá 30 MB gửi tới `/upload/file` | 413 | JSON `{"error":"File quá lớn (tối đa 50MB) — hãy dán link thay vì tải lên."}` (giống bản Node từng byte) |
| Thân JSON quá 30 MB gửi tới route khác | 413 | trang HTML `Payload Too Large` |
| `Content-Encoding` hoặc charset không hỗ trợ | 415 | trang HTML `Unsupported Media Type` |
| Vượt giới hạn tần suất (chỉ khi đặt `RATE_LIMIT_RPS` > 0) | 429 | `{"error":"Quá nhiều yêu cầu, vui lòng thử lại sau"}` + header `Retry-After: 1` |
| Panic ngoài cổng rpc | 500 | trang HTML `Internal Server Error` |

Khớp đường dẫn như Express 4: `HEAD` dùng handler của `GET`; phần cố định không phân biệt hoa thường; cho phép thừa một dấu `/` cuối.
