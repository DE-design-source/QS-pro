package contracts

import (
	"context"

	"qspro-backend/internal/shared/omap"
)

// ExpiryReminder - chủ: companies. Nhắc gia hạn công ty TRONG ỨNG DỤNG (roadmap M17.3, chỉ bản Go, giả định chờ chủ
// sản phẩm xác nhận; bản Node gửi Lark đã gỡ ở 42af44d). Không Lark, không email.
//
// NhacGiaHan quét cong_ty (noScope, không giới hạn số dòng) có active và han_dung trong [hôm nay, hôm nay + 30].
// N = han_dung - hôm nay (giờ VN), chỉ xét N >= 0;
// mốc = số nhỏ nhất trong {30,14,7,3,1,0} mà N <= mốc. nhac_moc ngoài tập đó (dữ liệu cũ -1, 5...) coi như null.
// Gửi khi nhac_moc null hoặc mốc < nhac_moc: trước hết một UPDATE có điều kiện giành mốc (ghi nhac_moc, nhac_lan_cuoi;
// tiến trình khác đã giành thì bỏ qua), rồi mỗi admin đang hoạt động của công ty nhận 1 thông báo kind "expiry_notice"
// (ref = id công ty) và nhật ký "nhac_gia_han". Không chèn được thông báo nào thì trả lại mốc cũ để lần sau gửi lại.
// dryRun = true chỉ trả danh sách, không ghi gì. ctx không cần ngữ cảnh công ty (hàm tự đặt cho từng công ty).
// Kết quả: {dryRun, ngay, soCongTy, soThongBao, ds: [{id, ten, hanDung, conLai, moc, mocCu, soAdmin, canGui, daGui, loi?}]}.
// Lỗi đọc danh sách công ty trả về; lỗi của từng công ty ghi log + ds[i].loi và đi tiếp. Gọi song song được, kể cả từ
// nhiều tiến trình trên cùng database (chống trùng nằm ở UPDATE có điều kiện, không ở khoá trong bộ nhớ).
type ExpiryReminder interface {
	NhacGiaHan(ctx context.Context, dryRun bool) (*omap.Map, error)
}
