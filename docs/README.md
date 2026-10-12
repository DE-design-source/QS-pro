# Tài liệu QS Pro

Mọi tài liệu của dự án nằm trong thư mục này, chia theo nhóm (quy tắc: `.claude/rules/docs/docs-placement.md`).

| Nhóm | Nội dung |
|---|---|
| `01-tong-quan/` | Mục tiêu, phạm vi, kiến trúc tổng |
| `02-ky-thuat/` | API, cơ sở dữ liệu, quyết định kỹ thuật |
| `03-san-pham/` | Đặc tả tính năng, quy trình nghiệp vụ, roadmap, changelog |
| `04-van-hanh/` | Deploy, vận hành, xử lý sự cố |
| `05-mau/` | Mẫu tài liệu, checklist |
| `06-design/` | Giao diện, sơ đồ |
| `99-ghi-chu/` | Ghi chú, nháp |

## 03-san-pham / Roadmap

- [Roadmap](03-san-pham/roadmap.md) — tiến độ 18 module, backlog tính năng làm dở, danh sách tính năng đã có

## 03-san-pham / Quy trình nghiệp vụ

Mô tả HIỆN TRẠNG, dựng từ mã nguồn ngày 2026-10-07 (chưa chạy thử ứng dụng để đối chiếu). Mục 14 của mỗi file liệt kê giả định (GD) và câu hỏi mở (Q); dấu ⚠ là chỗ mã nguồn lệch với ghi chú / giao diện hoặc có thể là lỗi.

**Hệ thống**
- [QT-01 Đăng nhập, phiên làm việc và cài đặt cá nhân](03-san-pham/flows/QT-01-dang-nhap-va-phien.md) — đăng nhập, đăng xuất, đổi mật khẩu, công ty hết hạn, nhắc bản mới
- [QT-02 Quản lý công ty](03-san-pham/flows/QT-02-quan-ly-cong-ty.md) — quản trị hệ thống tạo / sửa / xoá công ty, hạn dùng, "xem như" công ty
- [QT-03 Quản lý tài khoản và phân quyền](03-san-pham/flows/QT-03-quan-ly-tai-khoan.md) — admin tạo / khoá / xoá tài khoản, vai trò, quyền chi tiết
- [QT-04 Thông báo và nhật ký hoạt động](03-san-pham/flows/QT-04-thong-bao-va-nhat-ky.md) — thông báo trong ứng dụng, nhật ký, danh sách hành động được ghi

**Danh mục sản phẩm**
- [QT-05 Nhập sản phẩm vào danh mục](03-san-pham/flows/QT-05-nhap-san-pham.md) — form nhập, nhập hàng loạt từ Excel, file mẫu theo ngành
- [QT-06 Sửa và duyệt sản phẩm](03-san-pham/flows/QT-06-sua-va-duyet-san-pham.md) — sửa, trạng thái duyệt, lịch sử thay đổi
- [QT-07 Yêu cầu xoá sản phẩm](03-san-pham/flows/QT-07-yeu-cau-xoa-san-pham.md) — nhân viên gửi yêu cầu, admin duyệt / từ chối
- [QT-08 Sản phẩm đi kèm, biến thể, yêu thích, kho chung](03-san-pham/flows/QT-08-combo-bien-the-yeu-thich.md) — combo, nhóm biến thể, yêu thích, kho chung Dezon, xuất danh sách

**Dự án và báo giá**
- [QT-09 Quản lý dự án và bản nháp](03-san-pham/flows/QT-09-quan-ly-du-an.md) — tạo / sửa / xoá / nhân bản, mở dự án, bảng điều khiển
- [QT-10 Bóc tách khối lượng và tính giá từng dòng](03-san-pham/flows/QT-10-boc-tach-khoi-luong.md) — thêm / sửa dòng, tầng, sửa hàng loạt, công thức giá
- [QT-11 Tờ bìa (khái toán)](03-san-pham/flows/QT-11-to-bia-khai-toan.md) — dựng từ mẫu, cộng dồn theo cây hạng mục, lưu
- [QT-12 Bảng chi phí](03-san-pham/flows/QT-12-chi-phi.md) — giá vốn, giá bán, lợi nhuận, cảnh báo
- [QT-16 Công tác xây dựng và bảng Phần thô](03-san-pham/flows/QT-16-cong-tac-phan-tho.md) — danh mục công tác, duyệt, đưa vào dự án
- [QT-17 Xuất báo giá](03-san-pham/flows/QT-17-xuat-bao-gia.md) — xem trước, Excel, PDF và các nút xuất Excel khác

**Mua hàng và báo cáo**
- [QT-13 Yêu cầu mua hàng](03-san-pham/flows/QT-13-yeu-cau-mua-hang.md) — gửi, duyệt, đặt hàng, nhận hàng
- [QT-14 Phiếu đề xuất mua hàng](03-san-pham/flows/QT-14-phieu-de-xuat.md) — đề xuất chiết khấu / thanh toán theo đợt
- [QT-15 Báo cáo nhập sản phẩm gửi Lark](03-san-pham/flows/QT-15-bao-cao-nhap-san-pham.md) — tự động thứ Tư và thứ Bảy, chạy tay

**Tệp**
- [QT-18 Tải ảnh và tài liệu lên kho](03-san-pham/flows/QT-18-tai-tep-va-anh.md) — tải ảnh / tài liệu sản phẩm, hiển thị ảnh cũ
