# QS Pro backend (Go + Gin)

Bản chuyển của `server/` (Node + Express, đã gỡ khỏi repo) sang Go, chạy độc lập: giữ cổng `POST /api/<tênHàm>`
và có REST dưới `/api/v1` (giao diện React `frontend/src/pages/QS` dùng REST). Không cần app Node hay thư mục `public/`:
6 file giao diện tải thẳng từ server (`/vs-spec.js`, `/son-spec.js`, `/ct-spec.js`, `/logo.svg`, `/mau-nhap-hang-loat.xlsx`,
`/mau-nhap-cong-tac.xlsx`)
được nhúng vào binary (go:embed), xem mục "File nhúng" bên dưới.

- Kiến trúc, hợp đồng viết module, khác biệt so với bản Node (mục 10): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Database, migration: [docs/DATABASE.md](docs/DATABASE.md)
- API: [docs/API.md](docs/API.md) (tính năng mới = route REST "chỉ bản Go", mục 2.1)
- Bảng đối chiếu hàm Node -> module Go (bảng làm việc lúc chuyển mã, tiếng Anh): [docs/PORTING_MAP.md](docs/PORTING_MAP.md)

## Cấu hình

Chép `.env.example` thành `.env` rồi điền. Tối thiểu cần `DATABASE_URL`.

Mọi đường dẫn tương đối tính từ THƯ MỤC ĐANG ĐỨNG (không phải vị trí file chạy), nên luôn chạy từ `backend/`:

- `STATIC_DIR` (TUỲ CHỌN, mặc định trống = tắt): thư mục giao diện cũ kiểu `public/` của app Node, kèm thư viện bảng tính
  dưới `/vendor` lấy từ `VENDOR_DIR` (mặc định `../node_modules`). Chỉ khi đặt `STATIC_DIR` server mới phục vụ hai thư mục đó và
  lúc khởi động ghi log `thiếu <đường dẫn> ...` nếu thiếu `index.html` / thư viện. Không đặt thì không có log nào.

### File nhúng (thay cho `public/`)

| Đường dẫn | Nguồn trong `backend/` | Content-Type | Cache-Control |
|---|---|---|---|
| `/vs-spec.js`, `/son-spec.js`, `/ct-spec.js` | `internal/shared/specs/js/*-spec.js` | `application/javascript; charset=UTF-8` | `no-cache` |
| `/mau-nhap-hang-loat.xlsx` | `internal/modules/categories/assets/` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `public, max-age=0` |
| `/mau-nhap-cong-tac.xlsx` | `internal/modules/estimates/assets/` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `public, max-age=0` |
| `/logo.svg` | `internal/server/assets/` | `image/svg+xml` | `public, max-age=0` |

- Khôi phục nguyên văn từ `public/` của commit cuối còn app Node (test `TestEmbeddedAssets` kiểm mã blob git từng file).
- Header như `express.static` trước đây (GET / HEAD, Range, ETag yếu -> 304); ETag tính theo nội dung, không có `Last-Modified`.
  Bản nhúng đứng trước `STATIC_DIR`, nên luôn thắng nếu thư mục đó cũng có file cùng tên.
- Ba file `*-spec.js` là NGUỒN DUY NHẤT của thông số ngành: sửa xong chạy `node backend/scripts/gen-specs.js` để sinh lại
  `internal/shared/specs/data/*.json`, `testdata/golden.json`, `testdata/sources.json` (test Go báo nếu quên).

### Quy tắc kế thừa `.env` (đọc kỹ trước khi chạy thử)

Server đọc `backend/.env` rồi `../.env` - file cấu hình THẬT của bản Node. Với TỪNG biến, giá trị lấy theo thứ tự:

1. biến đã có trong môi trường (kể cả đặt rỗng) - không bao giờ bị file đè;
2. `backend/.env`;
3. `../.env` của bản Node;
4. mặc định trong code.

Hệ quả: chỉ truyền `PORT` và `DATABASE_URL` thì `AUTH_SECRET`, webhook Lark, khoá kho file, khoá Lark vẫn lấy từ `../.env`,
và job báo cáo vẫn BẬT. Một lượt chạy thử trên database thử vẫn có thể gửi tin vào group Lark thật.

Khi đích là database THỬ, LUÔN truyền đủ bộ biến an toàn sau (giá trị phải KHÁC RỖNG: `PURCHASE_WEBHOOK` rỗng nghĩa là
webhook Lark thật ghi sẵn trong code):

| Biến | Giá trị an toàn | Chặn việc gì |
|---|---|---|
| `REPORT_JOB` | `0` | job nền gửi báo cáo lên Lark |
| `PURCHASE_WEBHOOK` | `http://127.0.0.1:9/x` | tin yêu cầu mua hàng / đề xuất |
| `REPORT_WEBHOOK` | `http://127.0.0.1:9/x` | tin báo cáo (hàm `baoCaoNhapSP` gọi tay) |
| `SUPABASE_URL_OVERRIDE` | `http://127.0.0.1:9` | tải file lên kho thật |

## Chạy song song / thay bản Node

| Điểm | Chi tiết |
|---|---|
| Cổng | Cả hai mặc định 3000. Chạy cạnh nhau thì đặt `PORT` khác cho bản Go (ví dụ 3998). |
| Database | Không có `backend/.env` thì bản Go lấy `DATABASE_URL` từ `../.env` - CÙNG database với bản Node (trên máy phát triển là database thật). Muốn dùng database khác phải đặt `DATABASE_URL` trong `backend/.env` hoặc trong môi trường. |
| Job báo cáo | `REPORT_JOB` mặc định BẬT: 70 giây sau khi chạy server kiểm tra gửi bù, rồi gửi Lark lúc 8h00 thứ 4 và thứ 7. Hai server cùng database sẽ gửi hai báo cáo (chống trùng qua `audit_log` không chặn được hai tiến trình). Đặt `REPORT_JOB=0` ở ĐÚNG MỘT bên; bản Node không có công tắc này nên khi chạy song song thì tắt ở bản Go. |
| Webhook | `PURCHASE_WEBHOOK` trống = webhook Lark thật ghi sẵn trong code (giống bản Node); `REPORT_WEBHOOK` trống = dùng chung. Chạy thử thì đặt cả hai thành địa chỉ giả. |
| Phiên đăng nhập | Token được ký bằng `AUTH_SECRET` (trống = cùng một khoá mặc định ở cả hai bản). Hai bản cùng `AUTH_SECRET` và cùng database thì token đang dùng ở bản Node có hiệu lực ngay trên bản Go, người dùng không phải đăng nhập lại. |

Chuyển hẳn sang bản Go (`render.yaml` đã gỡ khỏi repo cùng app Node; cấu hình triển khai bản Go chưa có trong repo):

1. Chạy migration nếu còn file chưa áp dụng (xem [docs/DATABASE.md](docs/DATABASE.md)).
2. Dựng image (mục Docker bên dưới), đặt biến môi trường giống bản Node, cùng `AUTH_SECRET`.
3. Tắt bản Node, bật bản Go với `REPORT_JOB` để mặc định (chỉ còn một bên gửi báo cáo).

## Chạy bằng Go cài trên máy (Go 1.25+)

Dùng cấu hình thật của bản Node (database, webhook, kho file lấy từ `../.env`; chỉ dùng khi đã tắt bản Node hoặc đã đặt `REPORT_JOB=0`):

```
cd backend
go run ./cmd/api                 # http://localhost:3000
go run ./cmd/migrate --status    # xem migration
```

Chạy cạnh bản Node trên database thử (PowerShell):

```
cd backend
$env:PORT = '3998'; $env:DATABASE_URL = 'postgresql://qspro:<mật khẩu>@localhost:5434/qspro_gotest'
$env:REPORT_JOB = '0'; $env:PURCHASE_WEBHOOK = 'http://127.0.0.1:9/x'; $env:REPORT_WEBHOOK = 'http://127.0.0.1:9/x'
$env:SUPABASE_URL_OVERRIDE = 'http://127.0.0.1:9'
go run ./cmd/api
```

## Chạy bằng Docker

Dựng image từ GỐC repo (image cần migration ở `infra/db/migrations`; không cần app Node, `public/` hay `npm`):

```
docker build -f infra/docker/backend.Dockerfile -t qspro-backend .
docker run --rm -p 3000:3000 -e DATABASE_URL=postgresql://user:pass@host:5432/db -e AUTH_SECRET=... qspro-backend
docker run --rm -e DATABASE_URL=postgresql://user:pass@host:5432/db qspro-backend /app/qspro-migrate --status
```

- Image có sẵn `/app/qspro-api`, `/app/qspro-migrate`, `/app/migrations`; spec ngành, logo, file mẫu nằm trong binary.
  Không có file `.env`, chạy bằng user `app`.
- Image đặt sẵn `NODE_ENV=production`: tài liệu API (`/api-docs`, `/api-docs.json`) TẮT; thêm `-e SWAGGER_DOCS=1` để bật.
- Build context được thu gọn bằng `infra/docker/backend.Dockerfile.dockerignore` (BuildKit tự đọc; cần Docker 23+ hoặc `DOCKER_BUILDKIT=1`):
  `.env*`, `.git`, `node_modules`, kết quả test không được gửi vào build.
- Biến cần cho triển khai thật: `DATABASE_URL`, `AUTH_SECRET`, `PURCHASE_WEBHOOK` / `REPORT_WEBHOOK` (trống = webhook thật trong code),
  `SUPABASE_URL_OVERRIDE` / `SUPABASE_KEY_OVERRIDE` / `SUPABASE_BUCKET` (trống = project mặc định), `LARK_APP_ID` / `LARK_APP_SECRET` (ảnh cũ qua `/media`),
  `REPORT_JOB=0` nếu còn một server khác gửi báo cáo. Danh sách đầy đủ: `.env.example`.
- Chạy image trên database thử: thêm bộ biến an toàn ở mục Cấu hình (image không có `.env` nhưng webhook mặc định trong code vẫn là webhook thật).

Không cài Go trên máy: dùng container để phát triển.

```
docker run -d --name qspro-go -v <gốc repo>:/repo -w /repo/backend -p 3998:3998 golang:1.25 sleep infinity
docker exec qspro-go go build ./...
docker exec qspro-go go vet ./...
docker exec -e PORT=3998 -e DATABASE_URL=postgresql://qspro:<mật khẩu>@host.docker.internal:5434/qspro_gotest -e REPORT_JOB=0 -e PURCHASE_WEBHOOK=http://127.0.0.1:9/x -e REPORT_WEBHOOK=http://127.0.0.1:9/x -e SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 qspro-go go run ./cmd/api
```

- Container `qspro-go` đã có thì bỏ dòng `docker run` (dùng `docker start qspro-go` nếu nó đang dừng).
- Trong container, `localhost` là chính container: database chạy trên máy phải gọi qua `host.docker.internal`.
- Repo được gắn vào `/repo` nên quy tắc kế thừa ở mục Cấu hình áp dụng nguyên vẹn: biến nào không truyền bằng `-e` được lấy từ
  `/repo/backend/.env` rồi `/repo/.env` (file thật của bản Node).
- Chạy nền: build ra file rồi chạy bằng `docker exec -d ... qspro-go sh -c "go build -o /tmp/qsapi ./cmd/api && /tmp/qsapi > /tmp/qsapi.log 2>&1"`;
  dừng bằng `docker exec qspro-go pkill qsapi`.

## Kiểm thử

Test Go (trong container; chạy trên máy có Go thì bỏ `docker exec ... qspro-go`):

```
docker exec qspro-go sh -c "go build ./... && go vet ./... && gofmt -l ."     # gofmt -l phải in rỗng
docker exec qspro-go go test -count=1 ./...          # không có TEST_DATABASE_URL: test cần database tự bỏ qua
docker exec -e TEST_DATABASE_URL=postgresql://qspro:<mật khẩu>@host.docker.internal:5434/qspro_gotest qspro-go go test -race -count=1 -p 1 ./...
```

> **Công cụ lịch sử (cần app Node đã gỡ khỏi repo).** Từ bước 2 dưới đây, bảng "Test trên server đang chạy", mục "Hạ tầng thử mà
> `run.ps1` cần" và các script `gen*.js` ở mục "Dữ liệu mong đợi" (trừ `scripts/gen-specs.js`) đều cần mã Node (`server/*.js`,
> `package.json`, `scripts/test-api.js`) của commit cuối còn app Node (`83d264e`) và `node_modules` (`pg`, `bcryptjs`, `exceljs`).
> Trên cây hiện tại chúng KHÔNG chạy được: `check-node-sync.sh` luôn in `KHÁC` (thiếu `server/db-map.json`), `sync-api-docs.js` lỗi
> `ENOENT` (thiếu `server/index.js`). Muốn chạy lại: lấy mã Node ra thư mục riêng (`git show 83d264e:server/<file>` hoặc
> `git worktree add <thư mục> 83d264e`, rồi `npm install` trong đó) và trỏ script tới đó. Dữ liệu mong đợi đã sinh vẫn nằm trong repo,
> nên `go test` không cần Node. Chỉ có bước 1 và `node backend/scripts/gen-specs.js` (cần Node.js, không cần gói nào) là dùng được ngay.

Ba bộ kiểm tra dùng ở lượt nghiệm thu, theo đúng thứ tự (mỗi bộ bắt đầu từ hai database vừa đặt lại về seed, xem lệnh đặt lại ở mục
"Hạ tầng thử"):

1. Lệnh `go test -race -count=1 -p 1 ./...` ở trên.
2. E2E trên server Go chạy nền với bộ biến an toàn (lệnh "Chạy nền" ở mục Docker, thêm `-e AUTH_SECRET=<giá trị thử>`), rồi từ gốc repo:
   `$env:BASE_URL = 'http://localhost:3998'; $env:TEST_DATABASE_URL = 'postgresql://qspro:<mật khẩu>@localhost:5434/qspro_gotest'; node backend/tests/e2e/test-api-go.js`.
   Đúng: `KẾT QUẢ test-api (http://localhost:3998): 96 đạt, 0 lỗi`, bằng kết quả cùng lệnh trên server Node (`BASE_URL` 3997, `qspro_nodetest`).
3. `powershell -ExecutionPolicy Bypass -File backend/tests/e2e/diff/run.ps1` (cả bộ, khoảng 20 phút). Đúng: dòng `TỔNG: ... 0 KHÁC ...`, mã thoát 0.

- `-p 1` BẮT BUỘC khi có database: các gói dùng chung `qspro_gotest`, chạy song song thì gói này thấy dòng tạm của gói kia
  (đã gặp ở `estimates`, `notifications`, `purchasing`).
- `./...` gồm cả `tests/integration/server_test.go`; `./internal/...` thì bỏ sót gói này.
- `TEST_DATABASE_URL` chỉ được trỏ tới database THỬ: test có ghi và xoá dữ liệu đánh dấu.
- Mật khẩu database thử: `docker exec qspro-postgres printenv POSTGRES_PASSWORD`.

Test trên server đang chạy (Node.js, chạy từ gốc repo). Cả hai server phải chạy trên database thử với bộ biến an toàn ở mục Cấu hình:

| Bộ | Lệnh |
|---|---|
| E2E một server | `node backend/tests/e2e/test-api-go.js` với biến `BASE_URL` (mặc định `http://localhost:3998`) và `TEST_DATABASE_URL` (chỉ nhận `qspro_gotest` / `qspro_nodetest`); để lại dữ liệu thử trong database |
| Kiểm tra nhanh hai server | `node backend/tests/integration/smoke.js <url go> <url node> <admin> <nhân viên> <mật khẩu>` (hai database phải có cùng tài khoản thử) |
| So lớp HTTP | `backend/scripts/http-diff.sh <url node> <url go>`; hai server phải cùng `RENDER_GIT_COMMIT` (header `x-app-ver` được so), kết quả đúng là `30 request, 0 khác` |
| So vi sai đầu-cuối Node <-> Go | `powershell -ExecutionPolicy Bypass -File backend/tests/e2e/diff/run.ps1 [-Filter area1/02,area2/01] [-ShowAll] [-KeepServers] [-NoReset]` |
| Tự kiểm bộ so sánh | `node backend/tests/e2e/diff/selftest.js` |
| Bản sao chép tay từ bản Node | `sh backend/scripts/check-node-sync.sh` (db-map.json; không cần database). Lịch sử: thiếu `server/db-map.json` nên luôn in `KHÁC` |

PowerShell không nhận dạng `BIEN=giatri lenh`; đặt biến trước: `$env:BASE_URL = 'http://localhost:3998'; $env:TEST_DATABASE_URL = '...'; node backend/tests/e2e/test-api-go.js`.

Bộ so vi sai chạy cả bộ mất nhiều phút; khi đang sửa một module thì chạy riêng kịch bản bằng `-Filter`, chỉ chạy đủ ở lượt cuối.
Nó tự đặt lại hai database, tự bật và tắt hai server; chỉ chấp nhận khác biệt đã ghi ở mục 10 của `docs/ARCHITECTURE.md`.

### Hạ tầng thử mà `run.ps1` cần

- Container Postgres tên `qspro-postgres`, user `qspro`, mật khẩu lấy từ biến `POSTGRES_PASSWORD` của container, mở cổng `5434` trên máy.
- Hai database `qspro_nodetest` và `qspro_gotest`: script tự xoá và tạo lại mỗi lần chạy (trừ khi có `-NoReset`). Đặt lại bằng tay (đã tắt
  server đang nối vào): `docker exec qspro-postgres sh -c "dropdb -U qspro --if-exists --force <db> && createdb -U qspro <db> && psql -q -U qspro -d <db> -f /tmp/qspro_seed.sql >/dev/null"`.
- Sau khi đặt lại, script chèn vào CẢ HAI database một dòng `audit_logs` hành động `bao_cao_nhap_sp` của hôm nay để job báo cáo tự động của
  Node (không tắt được bằng env) không chạy giữa lượt so; xem `docs/ARCHITECTURE.md` mục 10.6.
- File seed `/tmp/qspro_seed.sql` nằm TRONG container `qspro-postgres` (mất khi tạo lại container). CHƯA RÕ file này được tạo bằng cách nào:
  trong repo không có script hay tài liệu nào sinh ra nó. Cần hỏi người dựng môi trường và đưa file hoặc script sinh vào repo.
- Container `qspro-go` (lệnh ở mục Docker) để build và chạy server Go ở cổng 3998; server Node chạy trên máy ở cổng 3997.
- Script đặt env an toàn cho cả hai server (`REPORT_JOB=0` cho Go, cùng `AUTH_SECRET` và `RENDER_GIT_COMMIT`, webhook / kho file / Lark trỏ vào
  server giả cổng 4101 / 4102), không đọc `DATABASE_URL` trong `.env`.
- `backend/scripts/sync-test-sequences.sh`: đưa sequence của hai database thử về cùng giá trị (cũng dùng container `qspro-postgres`).

### File do test sinh ra

Báo cáo của bộ so vi sai nằm ở `tests/e2e/diff/.out/`. Các biến sau bật việc ghi file kết quả; giá trị phải là đường dẫn TUYỆT ĐỐI
(`go test` đứng ở thư mục của từng gói), nên trỏ vào một thư mục `.out/` (mọi thư mục `.out/` trong `backend/` đã được git bỏ qua):
`DIFF_OUT`, `DIFF_GOLDEN` (platform/database), `CATEGORIES_XLSX_OUT`, `MATERIALS_XLSX_OUT`, `QUOT_XLSX_OUT`, `ESTIMATES_XLSX_OUT`,
`ESTIMATES_DIFF_OUT`, `PURCHASING_DIFF_OUT`, `INTEROP_OUT` (auth), `E2E_OUT`, `E2E_DUMP` (test-api-go.js).

### Dữ liệu mong đợi (golden)

Dữ liệu mong đợi trong `internal/**/testdata/` (khoảng 6 MB) và `tests/fixtures/` được sinh từ mã Node thật và ĐƯỢC LƯU trong repo
để `go test` chạy không cần Node. Sửa hành vi bên Node thì sinh lại bằng script `gen*.js` nằm cạnh file dữ liệu (chạy từ gốc repo,
cách dùng ghi ở đầu mỗi script):

- không đọc `DATABASE_URL`: `internal/shared/{errors,qscore}/testdata/gen.js`, `internal/jobs/testdata/gen.js`, `scripts/gen-specs.js`,
  `scripts/sync-api-docs.js`, `tests/fixtures/gen-registry.js`, `tests/fixtures/gen-swagger.js`;
- các script trong `internal/modules/*/testdata/` nạp mã Node thật (`server/*.js`) nên hầu hết đọc `DATABASE_URL`: có script chỉ cần một
  giá trị giả, có script ghi rồi dọn dòng đánh dấu (`ZZ_` / `zz_`) trong database. Đọc phần đầu script trước khi chạy.

Khi chạy các script này LUÔN đặt `DATABASE_URL` tường minh trỏ `qspro_nodetest` cùng bộ biến an toàn ở mục Cấu hình: mã Node cũng
đọc `.env` ở gốc repo, không đặt thì script chạy trên database thật.

## Thư mục

```
cmd/api, cmd/migrate     điểm khởi chạy server và công cụ migration
internal/config          biến môi trường, đọc file .env
internal/server          gin engine, route, file tĩnh, bảng route REST (rest.go), Swagger, cổng /api/:fn (rpc)
internal/middleware      auth, tenant, rbac, cors, rate limit, đọc thân JSON
internal/platform        database (PostgreSQL), storage (Supabase Storage), redis, logger
internal/shared          omap, jsval, tenant, actor, response, errors, validator, contracts, qscore, specs, httpx
internal/modules         nghiệp vụ theo module (14 gói)
internal/jobs            job nền (báo cáo nhập sản phẩm)
scripts                  đồng bộ api-docs, sinh specs, so HTTP, đồng bộ sequence database thử, kiểm bản sao từ bản Node
tests/fixtures           dữ liệu và script đối chiếu tầng dữ liệu, registry, swagger
tests/integration        test Go trên server đã nối đủ module + smoke.js
tests/e2e                test-api-go.js và bộ so vi sai (diff/)
docs                     tài liệu
```

Migration và Dockerfile nằm ngoài `backend/`: `infra/db/migrations/` (dùng chung với bản Node), `infra/docker/backend.Dockerfile`.
