package companies

// Nhắc gia hạn công ty TRONG ỨNG DỤNG (roadmap M17.3) - CHỈ BẢN GO, giả định chờ chủ sản phẩm xác nhận.
// Bản Node từng gửi thẻ Lark (7e0804d) rồi gỡ ở 42af44d; bản này không gửi Lark, không gửi email: chỉ thông báo trong
// chuông của admin đang hoạt động (chèn thẳng bảng notifications qua repo để biết lỗi chèn; contracts.Notifier nuốt lỗi). Job nền (internal/jobs) gọi lúc 8h05 giờ VN mỗi ngày + gửi bù sau khởi động;
// super gọi tay qua POST /api/v1/companies/expiry-reminders. Hợp đồng: contracts.ExpiryReminder.

import (
	"context"
	"sort"
	"strconv"
	"time"

	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/contracts"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

var _ contracts.ExpiryReminder = (*Service)(nil)

// mocNhac: các mốc (số ngày trước han_dung) theo thứ tự tăng dần; mỗi mốc gửi 1 lần.
var mocNhac = []int{0, 1, 3, 7, 14, 30}

const (
	kindNhac       = "expiry_notice"
	tieuDeNhac     = "Công ty sắp hết hạn sử dụng"
	tieuDeNhacHom  = "Công ty hết hạn hôm nay"
	actionNhac     = "nhac_gia_han"
	logTagNhac     = "nhắc gia hạn"
	ngayISO        = "2006-01-02"
	ngayHienThiFmt = "02/01/2006"
)

// mocCua: mốc nhỏ nhất trong mocNhac mà n <= mốc; ok = false khi n < 0 hoặc n > 30.
func mocCua(n int) (int, bool) {
	if n < 0 {
		return 0, false
	}
	for _, m := range mocNhac {
		if n <= m {
			return m, true
		}
	}
	return 0, false
}

// mocCu: nhac_moc đã lưu; null / không phải số / ngoài tập mốc (dữ liệu cũ -1, 5...) -> chưa nhắc (ok = false).
func mocCu(v any) (int, bool) {
	if jsval.IsNullish(v) {
		return 0, false
	}
	f := jsval.ToNumber(v)
	for _, m := range mocNhac {
		if f == float64(m) {
			return m, true
		}
	}
	return 0, false
}

// canGui: chưa nhắc mốc này (mốc cũ null / lạ, hoặc mốc mới gần hạn hơn mốc cũ).
func canGui(moc int, cu any) bool {
	c, ok := mocCu(cu)
	return !ok || moc < c
}

// ngayCua: "YYYY-MM-DD" đầu chuỗi -> ngày (UTC 0h); ok = false khi không phải ngày.
func ngayCua(v any) (time.Time, bool) {
	t, err := time.Parse(ngayISO, jsval.Slice(jsval.ToString(v), 0, 10))
	return t, err == nil
}

// thanNhac: nội dung thông báo.
func thanNhac(ten string, han time.Time, n int) string {
	return "Gói của " + ten + " hết hạn ngày " + han.Format(ngayHienThiFmt) + " (còn " + strconv.Itoa(n) +
		" ngày). Liên hệ quản trị hệ thống để gia hạn."
}

// NhacGiaHan: cài contracts.ExpiryReminder (job nền gọi, actor = super khuyết như job báo cáo).
func (s *Service) NhacGiaHan(ctx context.Context, dryRun bool) (*omap.Map, error) {
	return s.nhacGiaHan(ctx, &actor.Actor{R: "super"}, dryRun)
}

// nhacGiaHan: a là người chạy (ghi nhật ký); route REST truyền super đang đăng nhập.
// Chống gửi trùng: giành mốc bằng một UPDATE có điều kiện trong DB (NhanMocNhac) TRƯỚC khi gửi, nên hai tiến trình chạy
// cùng lúc trên một database chỉ một bên gửi. Không chèn được thông báo nào thì trả lại mốc cũ để lần sau thử lại.
func (s *Service) nhacGiaHan(ctx context.Context, a *actor.Actor, dryRun bool) (*omap.Map, error) {
	if a == nil {
		a = &actor.Actor{R: "super"}
	}
	s.nhacMu.Lock() // trong một tiến trình: job và nút "Gửi nhắc ngay" không chạy chồng nhau
	defer s.nhacMu.Unlock()

	homNay := s.todayVN()
	today, _ := time.Parse(ngayISO, homNay)
	den := today.AddDate(0, 0, mocNhac[len(mocNhac)-1]).Format(ngayISO)
	rows, err := s.repo.CongTyCanNhac(ctx, homNay, den)
	if err != nil {
		return nil, err
	}
	type muc struct {
		row  *omap.Map
		han  time.Time
		n    int
		moc  int
		gui  bool
		item *omap.Map
	}
	var ds []*muc
	for _, r := range rows {
		if !notFalse(r.Val("active")) || jsval.IsNullish(r.Val("han_dung")) {
			continue
		}
		han, ok := ngayCua(r.Val("han_dung"))
		if !ok {
			continue
		}
		n := int(han.Sub(today).Hours() / 24)
		moc, ok := mocCua(n)
		if !ok {
			continue
		}
		var cu any
		if c, ok := mocCu(r.Val("nhac_moc")); ok {
			cu = float64(c)
		}
		m := &muc{row: r, han: han, n: n, moc: moc, gui: canGui(moc, r.Val("nhac_moc"))}
		m.item = omap.Of("id", r.Val("id"), "ten", jsval.Or(r.Val("ten"), ""), "hanDung", han.Format(ngayISO),
			"conLai", float64(n), "moc", float64(moc), "mocCu", cu, "soAdmin", 0.0, "canGui", m.gui, "daGui", false)
		ds = append(ds, m)
	}
	sort.SliceStable(ds, func(i, j int) bool { return ds[i].n < ds[j].n })

	soCongTy, soThongBao := 0, 0
	out := make([]any, 0, len(ds))
	for _, m := range ds {
		out = append(out, m.item)
		id := m.row.Val("id")
		ten := jsval.ToString(jsval.Or(m.row.Val("ten"), ""))
		// ngữ cảnh của đúng công ty này: đọc admin / ghi thông báo / ghi nhật ký đều theo công ty đó
		cctx := tenant.With(ctx, tenant.Ctx{UID: a.UID, Role: "super", CongTyID: id, ViewAs: id})
		var admins []any
		if s.admins != nil {
			if admins, err = s.admins.ActiveAdmins(cctx); err != nil {
				logger.Error(logTagNhac, "đọc admin của", ten, "lỗi:", err.Error())
				m.item.Set("loi", "Không đọc được danh sách admin")
				continue
			}
		}
		m.item.Set("soAdmin", float64(len(admins)))
		if !m.gui {
			continue
		}
		if dryRun || len(admins) == 0 {
			soCongTy++
			continue // không admin nào nhận thì chưa giành mốc: lần chạy sau thử lại
		}
		gianh, err := s.repo.NhanMocNhac(ctx, id, m.moc, homNay)
		if err != nil {
			logger.Error(logTagNhac, "ghi mốc của", ten, "lỗi:", err.Error())
			soCongTy++
			m.item.Set("loi", "Không ghi được mốc, chưa gửi: "+err.Error())
			continue
		}
		if !gianh { // tiến trình khác vừa nhắc mốc này
			m.item.Set("canGui", false)
			continue
		}
		soCongTy++
		tieuDe := tieuDeNhac
		if m.n == 0 {
			tieuDe = tieuDeNhacHom
		}
		than := thanNhac(ten, m.han, m.n)
		ok, loiCuoi := 0, ""
		for _, ad := range admins {
			uid := jsval.Get(ad, "id")
			if !jsval.Truthy(uid) {
				continue
			}
			if err := s.repo.ChenThongBao(cctx, omap.Of("user_id", uid, "kind", kindNhac, "title", tieuDe, "body", than,
				"ref_id", jsval.ToString(id), "is_read", false)); err != nil {
				logger.Error(logTagNhac, "chèn thông báo cho", ten, "lỗi:", err.Error())
				loiCuoi = err.Error()
				continue
			}
			ok++
		}
		if ok == 0 {
			// không ai nhận được: trả mốc cũ để lần chạy sau gửi lại
			if err := s.repo.TraMocNhac(ctx, id, m.moc, homNay, m.row.Val("nhac_moc"), m.row.Val("nhac_lan_cuoi")); err != nil {
				logger.Error(logTagNhac, "trả mốc của", ten, "lỗi:", err.Error())
			}
			m.item.Set("loi", "Không gửi được thông báo: "+jsval.ToString(jsval.Or(loiCuoi, "không có admin hợp lệ")))
			continue
		}
		soThongBao += ok
		m.item.Set("daGui", true)
		if ok < len(admins) {
			m.item.Set("loi", "Chỉ gửi được "+strconv.Itoa(ok)+"/"+strconv.Itoa(len(admins))+" admin: "+loiCuoi)
		}
		s.audit(cctx, a, actionNhac, "Nhắc gia hạn "+ten+": còn "+strconv.Itoa(m.n)+" ngày (mốc "+strconv.Itoa(m.moc)+
			"), gửi "+strconv.Itoa(ok)+" admin")
	}
	return omap.Of("dryRun", dryRun, "ngay", homNay, "soCongTy", float64(soCongTy), "soThongBao", float64(soThongBao),
		"ds", out), nil
}

// xoaMocNeuDoiHan: sau khi updateCongTy đổi han_dung, xoá mốc đã nhắc (lệnh riêng) để hạn mới được nhắc lại từ đầu.
// Chỉ chạy khi hạn thật sự đổi và cột đang khác null; lỗi chỉ ghi log (không làm hỏng việc sửa công ty).
func (s *Service) xoaMocNeuDoiHan(ctx context.Context, id any, cu, moi *omap.Map) {
	if cu == nil || moi == nil {
		return
	}
	if jsval.IsNullish(cu.Val("nhac_moc")) && jsval.IsNullish(cu.Val("nhac_lan_cuoi")) {
		return
	}
	hanCu := jsval.Slice(jsval.ToString(jsval.Or(cu.Val("han_dung"), "")), 0, 10)
	hanMoi := jsval.Slice(jsval.ToString(jsval.Or(moi.Val("han_dung"), "")), 0, 10)
	if hanCu == hanMoi {
		return
	}
	if _, err := s.repo.UpdateCongTy(ctx, id, omap.Of("nhac_moc", nil, "nhac_lan_cuoi", nil)); err != nil {
		logger.Error(logTagNhac, "xoá mốc sau khi đổi hạn dùng lỗi:", err.Error())
	}
}
