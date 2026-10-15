# Roadmap QS Pro

> **Cập nhật:** 2026-10-15 · **Phiên bản mới nhất:** 1.0.0 (số cuối của `package.json` trước khi gỡ app Node; chưa có changelog)
>
> **Backlog từ 2026-10-15:** mục 2.1 làm trên server Go (`backend/`) + module QS React (`frontend/src/pages/QS`). Mục "cần chốt nghiệp vụ" được
> chọn phương án hợp lý nhất từ mã + quy trình QT, giả định ghi ngay trong dòng của mục đó (chủ sản phẩm có thể đổi).
>
> **Ký hiệu:** ✅ xong · 🟡 một phần · ⬜ chưa làm · 🔑 cần credential · 🏗 subsystem lớn
>
> **Nguồn của bản đầu tiên này:** dựng từ mã nguồn và 18 quy trình nghiệp vụ trong [flows/](flows/) ngày 2026-10-07.
> Trạng thái được xác định bằng **đọc mã nguồn, chưa chạy thử ứng dụng** — ✅ ở đây nghĩa là "có trong mã nguồn".
> Backlog (mục 2) chỉ gồm tính năng mà mã nguồn / cơ sở dữ liệu / giao diện đã bắt đầu hoặc đã hứa nhưng chưa làm xong.
> Lỗi, thiếu kiểm tra quyền và câu hỏi thiết kế KHÔNG nằm ở đây — xem mục 14 của từng quy trình (227 câu hỏi mở).

---

## 1. Tổng quan tiến độ

### App User

| Module | Tên | Trạng thái | Còn lại |
|---|---|---|---|
| [M1](#xong-1) | Đăng nhập & phiên | ✅ | - |
| [M2](#xong-2) | Bảng điều khiển | ✅ | - |
| [M3](#xong-3) | Dự án | ✅ | - |
| [M4](#xong-4) | Bóc tách | ✅ | - |
| [M5](#xong-5) | Phần thô & công tác | 🟡 | [M5.1](#m5-1) · [M5.2](#m5-2) · [M5.3](#m5-3) |
| [M6](#xong-6) | Tờ bìa (khái toán) | 🟡 | [M6.1](#m6-1) |
| [M7](#xong-7) | Chi phí | ✅ | - |
| [M8](#xong-8) | Xuất báo giá | 🟡 | [M8.1](#m8-1) · [M8.2](#m8-2) · [M8.3](#m8-3) |
| [M9](#xong-9) | Mua hàng & đề xuất | 🟡 | [M9.1](#m9-1) |
| [M10](#xong-10) | Danh sách sản phẩm | 🟡 | [M10.1](#m10-1) |
| [M11](#xong-11) | Nhập dữ liệu | ✅ | - |
| [M12](#xong-12) | Tệp & ảnh | ✅ | - |
| [M13](#xong-13) | Thông báo | 🟡 | [M13.1](#m13-1) |

### App Admin

| Module | Tên | Trạng thái | Còn lại |
|---|---|---|---|
| [M14](#xong-14) | Tài khoản & phân quyền | ✅ | - |
| [M15](#xong-15) | Duyệt yêu cầu (xoá sản phẩm, mua hàng, đề xuất) | 🟡 | [M15.1](#m15-1) · [M15.2](#m15-2) |
| [M16](#xong-16) | Nhật ký hoạt động | ✅ | - |
| [M17](#xong-17) | Công ty (quản trị hệ thống) | 🟡 | [M17.3](#m17-3) |
| [M18](#xong-18) | Báo cáo nhập sản phẩm qua Lark | ✅ | - |

### Tính năng mới (N)

| Mã | Tính năng | Trạng thái | Còn lại |
|---|---|---|---|
| [N1](#xong-n1) | Database PostgreSQL trực tiếp, tên bảng / cột tiếng Anh | 🟡 | [N1](#n1): thử tay trên trình duyệt, chuyển production |
| [N2](#xong-n2) | Server Go + Gin (`backend/`) | 🟡 | [N2](#n2): chuyển deploy sang bản Go, so vi sai phần còn mở |
| [N3](#xong-n3) | Tích hợp QS vào frontend React SiteFlow (`frontend/`) với API Go | ✅ | - |

---

## 2. Backlog

### 2.1 Làm được ngay

| Mã | Tính năng | App | Trạng thái |
|---|---|---|---|
| <a id="m5-1"></a>M5.1 | Nhập công tác hàng loạt từ file Excel mẫu: file mẫu `mau-nhap-cong-tac.xlsx` đã có và server Go đã phục vụ ở `/mau-nhap-cong-tac.xlsx` (file nhúng, 2026-10-15), chưa có nút tải / chọn file / đọc file (QT-16 Q-01) | User | ⬜ |
| <a id="m5-2"></a>M5.2 | Đơn giá theo nhà thầu: chọn "Tên nhà thầu" ở thư viện Phần thô mới chỉ lưu tên, chưa đổi đơn giá hay lọc công tác (QT-16 Q-07) | User | 🟡 |
| <a id="m5-3"></a>M5.3 | Sắp xếp danh mục công tác theo cột "Thứ tự": cột đã có, chưa có chỗ nhập (QT-16 mục 10) | User | 🟡 |
| <a id="m6-1"></a>M6.1 | Tính đơn giá xây thô từ "Diện tích khu đất" trong bảng tính diện tích: ô nhập đã có, chưa có phép tính nào dùng (QT-11 mục 11) | User | ⬜ |
| <a id="m8-1"></a>M8.1 | File Excel báo giá theo thông tin công ty, tiến độ thanh toán và ghi chú điều khoản như bản xem trước / PDF; hiện Excel ghi cứng tên một công ty (QT-17 Q-02) | User | 🟡 |
| <a id="m8-2"></a>M8.2 | File Excel theo lựa chọn Mẫu 1 / Mẫu 2 của tờ bìa và thứ tự cột đã kéo ở bản xem trước (QT-17 Q-04) | User | 🟡 |
| <a id="m8-3"></a>M8.3 | Ô "Hiện trạng" ở phần đầu báo giá: đã có cột lưu `projects.current_condition` (migration 0011, code `hien_trang`); chưa có chỗ nhập, máy chủ chưa đọc / ghi nên ô "Hiện trạng" ở bản xem trước luôn trống, Excel chưa in (QT-17 GD-02) | User | 🟡 |
| <a id="m9-1"></a>M9.1 | Cập nhật và hiển thị kết quả gửi Lark của đơn mua hàng cho người gửi: đã có chỗ lưu, luôn ở trạng thái chờ (QT-13 Q-06) | User | 🟡 |
| <a id="m10-1"></a>M10.1 | Tạo bản sao riêng từ sản phẩm kho chung Dezon: thông báo chặn đã hướng dẫn nhưng chưa có nút (QT-08 Q-08) | User | ⬜ |
| <a id="m13-1"></a>M13.1 | Bấm thông báo về phiếu đề xuất thì mở đúng phiếu; hiện chỉ đánh dấu đã đọc (QT-04 Q-01, QT-14 Q-04) | User | 🟡 |
| <a id="m15-1"></a>M15.1 | Lưu và hiện Người duyệt / Ngày duyệt của đơn mua hàng: chi tiết đơn đã có chỗ hiện; đã có cột lưu `purchase_orders.resolver_name` / `resolved_at` (migration 0009, code `nguoi_duyet` / `ngay_duyet`); máy chủ chưa ghi khi duyệt / từ chối nên vẫn chưa có dữ liệu (QT-13 Q-04) | Admin | 🟡 |
| <a id="m15-2"></a>M15.2 | Lý do xoá và lý do từ chối cho yêu cầu xoá sản phẩm: đã có cột lưu (migration 0010: `delete_requests.note` = lý do người gửi, cột mới `resolution_note` = lý do từ chối); chưa có ô nhập và chưa hiển thị (QT-07 Q-05) | Admin | 🟡 |
| <a id="m17-3"></a>M17.3 | Nhắc gia hạn trước khi công ty hết hạn (mốc 30/14/7/3/1/0 ngày): mới có 2 cột trong `db/expiry_notice.sql`; chưa rõ gửi qua kênh nào (QT-02 Q-11) | Admin | ⬜ |

### 2.2 Tính năng mới

| Mã | Tính năng | App | Trạng thái |
|---|---|---|---|
| - | Chưa có | - | - |

### 2.3 Cần credential 🔑

| Mã | Tính năng | App | Trạng thái |
|---|---|---|---|
| - | Chưa có | - | - |

### 2.4 Subsystem lớn 🏗

| Mã | Tính năng | App | Trạng thái |
|---|---|---|---|
| <a id="n1"></a>N1 | Refactor database sang PostgreSQL trực tiếp (`pg`, `DATABASE_URL`): đã triển khai trên database local `qspro_en2`; còn thử tay trên trình duyệt các tab chính, chuyển production (cần máy chủ PostgreSQL mà Render truy cập được), transaction cho thao tác nhiều bước (D-13), xoá 10 cột `DEPRECATED` (D-09; `delete_requests.note` và `product_combos.note` đã ra khỏi danh sách ngày 2026-10-15 vì M15.2 / M10.2 dùng lại) - xem `docs/02-ky-thuat/database/ket-qua-trien-khai.md` mục 8 | Toàn hệ thống | 🟡 |
| <a id="n2"></a>N2 | Chuyển server Node + Express sang Go + Gin (`backend/`, chưa commit): đã chuyển mã; còn chuyển deploy (`render.yaml` vẫn `runtime: node`, `npm start`), so vi sai job báo cáo và các nhánh chỉ chạy khi database thiếu cột - xem `backend/docs/ARCHITECTURE.md` mục "Việc còn mở" | Toàn hệ thống | 🟡 |

---

## 3. Ưu tiên tiếp theo

> Thứ tự dưới đây là **gợi ý của Claude, chưa được duyệt** — xếp theo "chỉ còn thiếu nối giao diện" trước, "cần quyết định nghiệp vụ" sau.

1. Nối giao diện cho phần máy chủ đã có sẵn: [M13.1](#m13-1)
2. Bổ sung dữ liệu còn trống trên màn hình đã có: [M15.1](#m15-1) · [M15.2](#m15-2) · [M9.1](#m9-1) · [M5.3](#m5-3) · [M8.3](#m8-3)
3. Đồng bộ file Excel báo giá với bản xem trước: [M8.1](#m8-1) · [M8.2](#m8-2)
4. Tính năng cần chốt nghiệp vụ trước khi làm: [M5.1](#m5-1) · [M5.2](#m5-2) · [M6.1](#m6-1) · [M10.1](#m10-1) · [M17.3](#m17-3)

---

## 4. Cách thêm tính năng

- Việc thuộc module có sẵn → mục 2.1, mã `M<số module>.<số thứ tự>` (số kế tiếp trong module đó), anchor `m<module>-<số>`.
- Tính năng mới ngoài các module trên → mục 2.2, mã N tiếp theo (`hiện tại: N4`), anchor `n<số>`; dùng xong thì tăng số ở đây.
- Cần tài khoản / khoá bên thứ ba → mục 2.3. Hạng mục lớn cần làm riêng một đợt → mục 2.4.
- Quy tắc cập nhật đầy đủ: `.claude/rules/docs/roadmap-sync.md`.

---

## 5. Đã xong

### App User

<a id="xong-1"></a>
#### M1 - Đăng nhập & phiên

- Đăng nhập bằng tên đăng nhập hoặc email cùng mật khẩu
- Tự vào thẳng ứng dụng khi trình duyệt còn phiên hợp lệ
- Phiên làm việc 7 ngày, một tài khoản dùng được nhiều máy cùng lúc
- Chặn đăng nhập khi tài khoản bị khoá, chưa thuộc công ty, công ty tạm khoá hoặc hết hạn
- Kiểm tra lại tài khoản và công ty ở mỗi thao tác, mất phiên trong tối đa 30 giây khi bị khoá
- Tự mã hoá mật khẩu đang lưu dạng chữ thường ở lần đăng nhập đầu
- Hiện tên, vai trò, công ty; đổi logo và tên trang theo công ty
- Ẩn các tab không được cấp, tự chuyển sang tab đầu tiên được phép
- Tự đổi mật khẩu (phải nhập đúng mật khẩu hiện tại)
- Lưu và xoá bộ cột "Của tôi" theo tài khoản, giữ khi sang máy khác
- Lưu các bảng cột đặt tên của Bóc tách theo tài khoản
- Dải nhắc "Đã có bản cập nhật mới" với nút Tải lại
- Đăng xuất, phiên hết hiệu lực ngay (cần bảng phiên đăng nhập - `db/phien_dang_nhap.sql`)
- Ghi nhật ký đăng nhập, đăng nhập sai, đăng xuất, đổi mật khẩu

<a id="xong-2"></a>
#### M2 - Bảng điều khiển

- Thẻ "Đang làm việc" cho bản nháp đang mở
- 5 ô số liệu: số dòng, giá vốn, giá bán chưa VAT, tổng thanh toán gồm VAT, lợi nhuận và biên
- Biểu đồ giá trị theo nhóm hạng mục
- Danh sách dự án gom các bản nháp cùng tên thành một thẻ
- Ô tìm kiếm dự án
- Tự mở bản nháp đầu danh sách khi vào ứng dụng
- Nút "Dùng" để chuyển sang bản nháp khác
- Đổi tên bản nháp ngay trên Bảng điều khiển
- Chip gắn / bỏ link Dezon của dự án
- Mở hộp "Thông tin dự án" từ thẻ dự án

<a id="xong-3"></a>
#### M3 - Dự án

- Tạo dự án mới (tên, khách hàng, số điện thoại, địa chỉ, link Dezon, VAT)
- Thêm bản nháp mới cho một dự án
- Mở bản nháp và nạp dòng bóc tách cùng dữ liệu rời
- Sửa thông tin chung, áp cho mọi bản nháp của dự án
- Sửa thông tin riêng từng bản nháp (trạng thái, VAT, mã báo giá, quy mô, diện tích, ghi chú...)
- Cập nhật phần trăm tiến độ
- Nhân bản bản nháp, chọn phần sao chép (Bóc tách, Xuất báo giá, Phần thô)
- Xoá một bản nháp
- Xoá cả dự án
- Tự lưu dữ liệu rời của bản nháp lên máy chủ
- Tự đưa bản lưu cũ trên trình duyệt lên máy chủ
- Mỗi công ty chỉ thấy dự án của mình
- Ô chọn dự án và thẻ dự án phía trên các màn hình
- Lối mở "Thông tin dự án" (M3.1, QT-09 Q-12): hộp Thông tin dự án (cùng nội dung trang `v-project` cũ, không dựng trang riêng) mở từ thẻ dự án ở Bóc tách, Chi phí, Xuất báo giá, Mua hàng, Dự án và từ banner, thẻ dự án, dòng bản nháp ở Bảng điều khiển; kiểm bằng admin + nhân viên 2026-10-15

<a id="xong-4"></a>
#### M4 - Bóc tách

- Chọn đề mục trong cây hạng mục, lọc bảng theo đề mục
- Thêm tầng / phòng và đặt tầng đang thêm
- Thêm sản phẩm từ danh mục (bấm dấu cộng hoặc kéo thả), tự cộng dồn số lượng khi trùng
- Thêm dòng trống để tự nhập
- Chọn sản phẩm cho dòng hoặc tạo sản phẩm mới vào danh mục
- Sửa ô trực tiếp, tự tính giá đại lý, đơn giá, thành tiền
- Gõ Markup, Margin hoặc Lợi nhuận (VND) để tính ngược giá bán
- Sửa hàng loạt: chuyển tầng, đặt lợi nhuận, sửa cột
- Sao chép, nhân bản, xoá nhiều dòng
- Kéo thả đổi vị trí dòng và thứ tự tầng, đổi tên tầng
- Sắp xếp và lọc theo cột
- Cập nhật dòng lệch so với danh mục (từng dòng hoặc cả bản nháp)
- Chế độ Bảng tính và Bảng thường
- Hạng mục tự tạo trong cây

<a id="xong-5"></a>
#### M5 - Phần thô & công tác

- Nhập công tác bằng form (tên, hạng mục, đơn vị tính, giá, ảnh, ghi chú, thông số) với giá bán lẻ / chiết khấu / giá đại lý tự tính qua lại
- Danh sách chờ trên trình duyệt: sửa, xoá rồi lưu hàng loạt vào cơ sở dữ liệu, dòng lỗi ở lại kèm lý do
- Tuỳ chọn thêm luôn công tác vừa lưu vào bảng khái toán của dự án đang chọn
- Danh mục công tác ở 3.1 Phần thô: thẻ lọc Tất cả / Chưa duyệt / Đã duyệt / Yêu thích, tìm kiếm và bộ lọc
- Sửa công tác trong cửa sổ cập nhật, sửa nhanh từng ô trên bảng và sửa hàng loạt một trường
- Duyệt / bỏ duyệt công tác (từng dòng hoặc nhiều dòng); sửa nội dung tự đưa về Chưa duyệt
- Đánh dấu yêu thích dùng chung cho cả công ty
- Xoá một hoặc nhiều công tác
- Xem lịch sử thay đổi của từng công tác (200 dòng mới nhất)
- Tải danh sách công tác ra Excel (toàn bộ đang lọc hoặc các dòng đã chọn)
- Thư viện công tác trong tab Bóc tách theo 4 loại báo giá; thêm vào bảng Phần thô bằng dấu cộng, kéo thả, cả nhóm, một dự án mẫu có sẵn, bộ dự toán
- Bảng Phần thô tự tính khối lượng, thành tiền, lợi nhuận, VAT và tổng theo hạng mục
- Bảng Phần thô tự lưu theo dự án lên máy chủ
- Công tác có phân loại đề mục hiện thêm ở đề mục hoàn thiện 3.2.x và thêm được vào bảng bóc tách
- 🟡 phần còn lại ở 2.1

<a id="xong-6"></a>
#### M6 - Tờ bìa (khái toán)

- Tự dựng tờ bìa 26 mục từ mẫu chuẩn khi bản nháp chưa có tờ bìa
- Tự cộng tiền từng mục nhỏ từ các dòng bóc tách cùng mã hạng mục
- Cộng thêm bảng Phần thô vào mục 3.1
- Mục cha tự bằng tổng mục con, tổng tờ bìa và tỷ trọng % từng mục
- Sửa tay ô chi phí (lưu ngay) kèm nhãn "tự động" / "sửa tay"
- Bỏ sửa tay từng mục hoặc "Lấy lại số từ bóc tách" cho cả tờ bìa
- Sửa số thứ tự, tên, mô tả; thêm mục lớn / mục nhỏ; xoá mục (xoá mục và sửa tên mục lớn chỉ có ở Mẫu 2)
- Ẩn / hiện mục lớn trên tờ bìa, lưu theo bản nháp
- Sửa thông tin đầu tờ bìa (mã báo giá, khách hàng, quy mô, diện tích, nhu cầu, phân khúc)
- Nạp lại mẫu chuẩn và Lưu tờ bìa
- Hai kiểu trình bày Mẫu 1 / Mẫu 2, nhớ trên máy
- Bảng tính diện tích theo hệ số và nút "Áp vào tờ bìa"
- Tự lưu số đang hiện vào tờ bìa trước khi xuất Excel
- 🟡 phần còn lại ở 2.1

<a id="xong-7"></a>
#### M7 - Chi phí

- Dải tổng đầu trang: vốn, giá bán, lợi nhuận, biên, VAT, tổng thanh toán
- Lọc theo hạng mục dùng chung cho mọi màn hình
- Cộng Phần thô và trừ chiết khấu báo giá khi xem tất cả hạng mục
- Thẻ Tổng quan chi phí kèm biểu đồ theo hạng mục và theo nhà cung cấp
- Tìm kiếm và chip cảnh báo: đang lỗ, biên thấp, chưa có giá bán, chưa có giá vốn
- Gom theo hạng mục / tầng / nhà cung cấp, có tổng từng nhóm
- Sắp xếp theo cột, bật tắt 14 cột hiển thị
- Sửa giá và số lượng ngay trong bảng, ghi thẳng vào dòng bóc tách
- Đặt nhanh lợi nhuận % cho nhiều dòng
- Đặt biên lợi nhuận mục tiêu để tính lại giá bán
- Biên tối thiểu theo bản nháp, tô vàng dòng biên thấp
- Sửa VAT của bản nháp
- So sánh các bản nháp của cùng dự án
- Xuất Excel đúng bảng đang xem; gợi ý khi hạng mục đang lọc trống

<a id="xong-8"></a>
#### M8 - Xuất báo giá

- Xem trước báo giá nhiều trang: trang 1 tờ bìa, từ trang 2 bảng chi tiết
- Chọn hạng mục đã bóc để đưa vào báo giá
- Chọn cột xuất, dùng chung với bảng Bóc tách
- Mặc định ẩn cột nội bộ, có lựa chọn "Xuất kèm (bản nội bộ)"
- Chỉnh trình bày: mỗi phần 1 trang, số dòng mỗi trang, mức phóng, kéo đổi thứ tự / độ rộng cột
- Tổng kết & điều khoản: chiết khấu tổng, ngày báo giá, hiệu lực, tiến độ thanh toán, ghi chú
- Thông tin công ty (tên, logo, địa chỉ, liên hệ) trên bản xem trước và bản in
- Xuất Excel nhiều trang tính: Tờ bìa, Tổng cộng, 3.2 Phần hoàn thiện, 3.1 Phần thô, chi tiết theo nhóm
- Nhúng ảnh sản phẩm vào file Excel (bỏ qua ảnh webp / gif / svg và ảnh trên 5 MB)
- Cảnh báo dòng đang dùng giá cũ trước khi xuất Excel
- Xuất PDF / In khổ A4 ngang qua trình duyệt
- Tự chốt phiên bản khi xuất, chốt tay, lịch sử phiên bản, xem lại và so sánh
- Cảnh báo khi tổng tờ bìa khác tổng trang cuối
- Nút xuất Excel ở các tab khác, tải danh sách sản phẩm và file mẫu nhập liệu
- Cột lưu "Hiện trạng" của dự án (`projects.current_condition`, migration 0011, M8.3) - 🟡 phần còn lại ở 2.1

<a id="xong-9"></a>
#### M9 - Mua hàng & đề xuất

- Xem sản phẩm bóc tách của dự án gom theo nhà cung cấp, có VAT và tổng tiền
- Nhập giảm giá nhà cung cấp theo từng dòng hoặc cho cả nhà cung cấp
- Chọn / bỏ chọn nhà cung cấp và gửi một hoặc nhiều đơn cùng lúc
- Bắt buộc nhập Người gửi và Phòng ban trước khi gửi
- Mỗi nhà cung cấp thành một đơn riêng ở trạng thái Chờ duyệt
- Báo admin trong ứng dụng và gửi thẻ yêu cầu mua hàng vào nhóm Lark
- Danh sách Đơn đã gửi theo dự án, có nút tải lại
- Đánh dấu Đã đặt hàng rồi Đã nhận hàng cho đơn đã duyệt
- Tải Excel của từng đơn
- Cảnh báo sản phẩm đã nằm trong đơn trước đó
- Lập đề xuất chiết khấu theo từng dòng và gửi phiếu
- Lập đề xuất thanh toán theo đợt (chia nhanh 2 / 3 / 4 đợt, lưu nháp) và gửi phiếu
- Danh sách và chi tiết Phiếu đề xuất đã gửi của dự án
- Người gửi nhận thông báo khi đơn hoặc phiếu được duyệt / từ chối
- 🟡 phần còn lại ở 2.1

<a id="xong-10"></a>
#### M10 - Danh sách sản phẩm

- Xem danh mục theo bốn khung nhìn: Tất cả, Chưa duyệt, Đã duyệt, Yêu thích
- Sửa sản phẩm trong hộp Cập nhật, kèm lịch sử thay đổi từng trường
- Sửa nhanh ngay trên bảng và hoàn tác (Ctrl+Z, tối đa 50 bước)
- Sửa hàng loạt một trường cho nhiều sản phẩm
- Duyệt / bỏ duyệt từng sản phẩm, cả nhóm biến thể hoặc hàng loạt
- Lưu & duyệt trong một lần bấm
- Sản phẩm đã duyệt tự về Chưa duyệt khi bị sửa ở Danh sách sản phẩm (cập nhật đè qua Nhập dữ liệu thì không)
- Khai báo sản phẩm đi kèm (combo) hai chiều, có số lượng
- Gom biến thể khác mã thành nhóm; tự nhận biến thể cùng mã
- Tạo biến thể, tạo nhanh nhiều biến thể, sao chép thành sản phẩm mới
- Đánh dấu yêu thích từng sản phẩm hoặc hàng loạt
- Xem kho chung Dezon ở chế độ chỉ xem (khi công ty được bật)
- Tải danh sách sản phẩm ra Excel (theo dòng đã chọn hoặc theo bộ lọc)
- Nhân viên gửi yêu cầu xoá; admin xoá trực tiếp một hoặc nhiều sản phẩm
- Ghi chú cho từng sản phẩm đi kèm (M10.2): ô "Ghi chú" ở form Cập nhật sản phẩm cho liên kết do chính sản phẩm đặt; liên kết ngược (hai chiều) chỉ xem, kèm "Sửa ghi chú ở sản phẩm kia"; hiện "Ghi chú: …" trong hộp xem sản phẩm (chưa hiện ở dòng mở rộng của bảng và thư viện Bóc tách)
- 🟡 phần còn lại ở 2.1

<a id="xong-11"></a>
#### M11 - Nhập dữ liệu

- Chọn ngành hàng: Thiết bị đèn, Thiết bị vệ sinh, Sơn nước
- Form nhập theo ngành, thông số hiện theo hạng mục
- Thêm ảnh bằng chọn file, kéo-thả, dán Ctrl+V hoặc dán link
- Tải tài liệu hoặc dán link tài liệu cho sản phẩm
- Giá đại lý tự tính từ giá bán lẻ và % chiết khấu
- Chọn sản phẩm đi kèm ngay lúc nhập
- Nhập biến thể: tự nhân tổ hợp thành nhiều sản phẩm
- Danh sách chờ lưu: thêm, sửa, bỏ trước khi ghi vào danh mục
- Tải file mẫu theo ngành (sơn nước theo hạng mục)
- Đọc file Excel/CSV, tự dò cột và tự nhận ngành
- Bảng xem trước: sửa ô, gắn ảnh từng dòng, đánh dấu ô thiếu
- Cảnh báo trùng trước khi lưu, cho chọn cập nhật đè hoặc xem lại
- Lưu vào danh mục kèm ghi danh vào dự án; dòng lỗi ở lại kèm lý do
- Lưu một dòng bóc tách thành sản phẩm mới trong danh mục

<a id="xong-12"></a>
#### M12 - Tệp & ảnh

- Tải ảnh sản phẩm: chọn file, kéo-thả, dán Ctrl+V
- Tự thu nhỏ và nén ảnh trước khi tải
- Tự thử lại khi tải ảnh lỗi mạng
- Dán link ảnh có sẵn thay cho tải lên
- Hình đại diện một ảnh, hình chi tiết nhiều ảnh
- Tải tài liệu sản phẩm (PDF, bản vẽ, file nén, Word, Excel), tối đa 50MB mỗi file
- Dán link tài liệu thay cho tải file
- Bốn ô tài liệu: tài liệu kỹ thuật, thông số, hướng dẫn cài đặt, bản vẽ
- Tải ảnh cho công tác phần thô
- Tải logo công ty
- Chờ ảnh tải xong (tối đa 15-20 giây) rồi mới lưu sản phẩm
- Hiển thị ảnh cũ lưu trên Lark

<a id="xong-13"></a>
#### M13 - Thông báo

- Chuông thông báo với số chưa đọc, tự đếm lại mỗi 30 giây
- Danh sách 30 thông báo mới nhất, làm nổi thông báo chưa đọc
- Bấm thông báo để đánh dấu đã đọc
- Nút "Đánh dấu đã đọc" cho toàn bộ thông báo
- Báo admin công ty khi có yêu cầu xoá sản phẩm
- Báo admin công ty khi có đơn mua hàng mới
- Báo admin công ty khi có đề xuất mua hàng mới
- Báo người gửi khi yêu cầu được duyệt hoặc bị từ chối
- Thông báo đơn mua hàng dẫn admin tới đúng chi tiết đơn, nhân viên tới tab Mua hàng
- Thông báo yêu cầu xoá dẫn admin tới đúng yêu cầu và nháy sáng
- Gửi thẻ vào nhóm Lark khi có đơn mua hàng hoặc đề xuất
- Báo cáo sản phẩm nhập mới gửi Lark tự động thứ 4 và thứ 7 lúc 8 giờ sáng
- 🟡 phần còn lại ở 2.1

### App Admin

<a id="xong-14"></a>
#### M14 - Tài khoản & phân quyền

- Danh sách tài khoản của công ty: vai trò, quyền, trạng thái, đăng nhập gần nhất
- Thêm tài khoản với tên đăng nhập, họ tên, phòng ban, mật khẩu
- Chọn vai trò Nhân viên hoặc Quản trị công ty
- Cấp quyền vào từng mục (8 mục), có Chọn tất cả / Bỏ hết
- Ba mức quyền trong Danh sách sản phẩm: không giới hạn, chỉ sửa, sửa và duyệt
- Sửa họ tên, phòng ban, vai trò, quyền của tài khoản (⚠ lưu biểu mẫu trên tài khoản quản trị hệ thống sẽ hạ vai trò xuống nhân viên - QT-03 Q-01)
- Đặt lại mật khẩu cho người khác
- Khoá và mở khoá tài khoản, người bị khoá mất phiên ngay
- Xoá tài khoản có xác nhận, không tự xoá được chính mình
- Luôn giữ ít nhất một admin đang hoạt động cho mỗi công ty
- Chặn tạo tài khoản khi công ty đã đủ số người dùng của gói
- Tên đăng nhập duy nhất trong toàn hệ thống
- Quản trị hệ thống chọn công ty, chuyển công ty và gán công ty cho tài khoản chưa có
- Ghi nhật ký tạo, sửa, khoá, mở, đặt lại mật khẩu, xoá tài khoản
- Sửa email tài khoản ở hộp Sửa tài khoản tab Admin (M14.1): lưu chữ thường, để trống = xoá, báo "Email không hợp lệ" khi sai dạng; không trùng tài khoản khác trong CÙNG công ty (khác công ty được phép, đăng nhập tự chọn đúng tài khoản); email cũ sai dạng vẫn sửa được các mục khác; đăng nhập được bằng email mới. Giả định: đường tạo tài khoản giữ như cũ (kiểm dạng ở giao diện); email có `*`, `%`, `\` lưu được nhưng không dùng để đăng nhập (có cảnh báo)

<a id="xong-15"></a>
#### M15 - Duyệt yêu cầu (xoá sản phẩm, mua hàng, đề xuất)

- Ô thống kê Đơn mua hàng chờ duyệt và Đề xuất chờ duyệt (đếm trong 200 đơn / phiếu mới nhất)
- Danh sách Yêu cầu mua hàng của công ty kèm số chờ duyệt
- Xem chi tiết đơn mua hàng: sản phẩm, tạm tính, VAT, tổng thanh toán
- Duyệt hoặc từ chối đơn mua hàng (từ chối có hỏi xác nhận)
- Chặn xử lý lại đơn đã được duyệt / từ chối
- Danh sách Đề xuất mua hàng (chiết khấu, thanh toán) của công ty
- Xem chi tiết phiếu đề xuất chiết khấu và thanh toán theo đợt
- Duyệt hoặc từ chối phiếu đề xuất, lưu người duyệt và ngày duyệt
- Báo lại người gửi trong ứng dụng khi duyệt / từ chối
- Ghi nhật ký hoạt động khi duyệt / từ chối
- Bấm thông báo đơn mua hàng mở thẳng chi tiết đơn
- Chỉ admin công ty và quản trị hệ thống được duyệt
- Admin nhận thông báo trên chuông khi có yêu cầu xoá mới
- Bấm thông báo mở thẳng đúng yêu cầu ở tab Admin
- Danh sách yêu cầu xoá kèm người gửi, sản phẩm, thời điểm, trạng thái
- Ô đếm số yêu cầu đang chờ duyệt
- Duyệt & xoá: xoá đúng các sản phẩm trong yêu cầu
- Từ chối yêu cầu (có hỏi xác nhận)
- Mỗi yêu cầu chỉ xử lý được một lần
- Báo kết quả cho người gửi (đã xoá X/N hoặc bị từ chối)
- Hiện người xử lý
- Yêu cầu chỉ hiện trong công ty của người gửi
- Cột lưu người duyệt / ngày duyệt đơn mua hàng (migration 0009, M15.1) và lý do xoá / lý do từ chối yêu cầu xoá (migration 0010, M15.2) - 🟡 phần còn lại ở 2.1

<a id="xong-16"></a>
#### M16 - Nhật ký hoạt động

- Tự ghi nhật ký cho các thao tác quan trọng: ai làm, hành động, chi tiết, thời gian, công ty
- Thẻ "Nhật ký hoạt động" ở tab Admin với 120 dòng mới nhất
- Admin công ty chỉ thấy nhật ký của công ty mình
- Quản trị hệ thống thấy toàn hệ thống hoặc theo công ty đang xem
- Ghi nhật ký đăng nhập, tài khoản, công ty
- Ghi nhật ký sản phẩm, công tác, mua hàng, đề xuất, yêu cầu xoá
- Tự ghi lỗi giao diện trên máy người dùng vào nhật ký (kèm tên tab)
- Ghi nhật ký báo cáo tự động gửi Lark
- Ghi nhật ký lỗi không làm hỏng thao tác chính

<a id="xong-17"></a>
#### M17 - Công ty (quản trị hệ thống)

- Danh sách công ty dạng thẻ kèm bốn ô thống kê
- Tạo công ty với tên, mã, email, điện thoại, logo
- Tải logo lên hoặc dùng đường dẫn ảnh
- Đặt số người dùng tối đa, hạn dùng, trạng thái, ghi chú (chưa bỏ được hạn dùng đã đặt)
- Bật/tắt từng tính năng (8 mục) cho công ty
- Cho công ty dùng danh sách sản phẩm của Dezon
- Tạo kèm tài khoản quản trị khi tạo công ty (⚠ tên đăng nhập sai dạng thì công ty vẫn được tạo mà không có quản trị - QT-02 Q-03)
- Sửa thông tin, gia hạn, tạm khoá và mở lại công ty
- Công ty tạm khoá hoặc hết hạn thì người dùng bị chặn
- Xem danh sách người dùng của một công ty và thêm tài khoản
- "Xem dữ liệu" như một công ty và thoát chế độ xem
- Xoá công ty cùng toàn bộ dữ liệu, phải gõ đúng mã xác nhận
- Ghi nhật ký tạo, sửa, xoá công ty
- Thẻ "Thông tin công ty" ở tab Admin (M17.1): admin sửa tên, logo, email, điện thoại, màu chính của công ty mình, áp ngay (thanh trên đổi màu, không tải lại); quản trị hệ thống sửa khi đang xem một công ty (không đổi công ty đang dùng của chính mình)
- Ô chọn màu chính (bảng màu + mã hex + Mặc định) ở thẻ trên và tab Thông tin của hộp Tạo / Sửa công ty (M17.2); máy chủ chỉ nhận trống, `#RGB` hoặc `#RRGGBB`, báo "Màu chính phải dạng #RRGGBB"
- 🟡 phần còn lại ở 2.1

<a id="xong-18"></a>
#### M18 - Báo cáo nhập sản phẩm qua Lark

- Tự gửi báo cáo lúc 8 giờ sáng thứ Tư và thứ Bảy (giờ Việt Nam)
- Gửi bù khi máy chủ khởi động lại trong ngày gửi
- Chống gửi trùng trong cùng một ngày
- Kỳ báo cáo tính từ lần gửi theo lịch liền trước
- Mỗi công ty một thẻ Lark "Sản phẩm nhập mới"
- Thống kê số sản phẩm, nhà cung cấp, người nhập
- Bảng theo ngành hàng
- Bảng theo người nhập và ngày, kèm phòng ban
- Cảnh báo số sản phẩm chưa ghi nhận người nhập
- Gom sản phẩm chưa gắn công ty vào thẻ riêng
- Ghi nhật ký hoạt động sau khi gửi
- Dùng đường Lark riêng cho báo cáo, chưa đặt thì dùng chung với mua hàng
- Thẻ "Báo cáo sản phẩm nhập mới (Lark)" ở tab Công ty, chỉ quản trị hệ thống (M18.1): chọn Từ ngày (tính từ 0h giờ Việt Nam) hoặc để trống = kỳ hiện tại; Chạy thử xem số sản phẩm theo từng công ty và theo người nhập; Gửi ngay có hỏi lại; kết quả Đã gửi / Lỗi gửi Lark từng công ty (chi tiết lỗi chỉ ở log máy chủ). Lần gửi tay thành công tính là lần gửi của hôm nay (lịch 8h cùng ngày bỏ qua; có cảnh báo trên thẻ)

### Tính năng mới (N)

<a id="xong-n1"></a>
#### N1 - Database PostgreSQL trực tiếp

- Server đọc / ghi PostgreSQL qua `pg` và `DATABASE_URL`; Supabase chỉ còn làm kho file
- Tên bảng / cột trong database sang tiếng Anh, `server/db-map.json` ánh xạ hai chiều với tên trong code
- Tách bảng sản phẩm thành bảng lõi + 4 bảng thông số theo ngành; cấu hình cấp công ty sang bảng `company_settings`; phiếu đề xuất tách 2 bảng dòng
- Bảng con bỏ cột công ty, lấy công ty qua bảng cha; thêm khoá ngoại và CHECK công thức
- Migration đánh số trong `infra/db/migrations/`, chạy bằng `npm run migrate`
- Dữ liệu sai chuyển sang schema `quarantine`, không xoá hẳn
- Test `npm run test:db` (61 đạt) và `npm run test:api` (96 đạt) trên database local `qspro_en2` (2026-10-12)
- 🟡 phần còn lại ở 2.4

<a id="xong-n2"></a>
#### N2 - Server Go + Gin

- Bản chuyển `server/` sang Go + Gin trong `backend/`, chạy độc lập, dùng lại nguyên `public/`
- Giữ `POST /api/<tênHàm>`, thêm REST dưới `/api/v1`
- Migration (`go run ./cmd/migrate`) và chạy bằng Docker
- 🟡 phần còn lại ở 2.4

<a id="xong-n3"></a>
#### N3 - Tích hợp QS vào frontend React SiteFlow

- Module QS của frontend React (`frontend/src/pages/QS`, bản clone giao diện cũ) dùng dữ liệu thật qua REST `/api/v1` của server Go; đăng nhập riêng cho QS, bỏ toàn bộ dữ liệu giả
- Bổ sung phần bản clone còn thiếu: nhập dữ liệu, sửa sản phẩm (combo, biến thể, lịch sử), phần thô, quản trị tài khoản, công ty, thông báo
- Server Go tự phục vụ thông số ngành (`*-spec.js`), logo, file mẫu nhập hàng loạt và file mẫu công tác `/mau-nhap-cong-tac.xlsx` (nhúng trong binary, byte = bản cuối trong git), không còn cần `public/`; kiểm lại 2026-10-15 với `STATIC_DIR` trống
- Chạy React với server Go: đặt `CORS_ORIGINS` của server Go đúng origin của frontend (cấu hình chạy, không phải phần mã còn thiếu; deploy production thuộc [N2](#n2))
- Kiểm thử 2026-10-15: build OK, 62.658 golden test công thức đạt, so từng tab với bản gốc không thiếu số tiền nào (admin, staff, super), file Excel báo giá trùng bản gốc, 20 trang SiteFlow khác không đổi pixel nào, chạy được không có `public/` (cả bản Docker)
