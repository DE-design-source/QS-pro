// Package jobs: job nền của server - bản chuyển của phần hẹn giờ trong server/index.js (I:565-593).
//
// Job 1: BÁO CÁO SẢN PHẨM NHẬP MỚI gửi Lark vào THỨ 4 và THỨ 7, 8h00 giờ VN.
//   - 70 giây sau khi server chạy: kiểm tra gửi bù (server thức dậy muộn vẫn gửi, có chống trùng), rồi bật lịch.
//   - Lịch tự hẹn lại: mỗi lần chỉ hẹn tới mốc 8h00 thứ 4 / thứ 7 kế tiếp.
//   - Chống gửi trùng: trong ngày đã có dòng audit_log "bao_cao_nhap_sp" thì thôi (reports.DaGuiHomNay).
//
// Job 2 (CHỈ BẢN GO, roadmap M17.3 - giả định): NHẮC GIA HẠN CÔNG TY trong ứng dụng, 8h05 giờ VN MỖI NGÀY.
//   - 70 giây sau khi server chạy: nếu hôm nay đã qua 8h05 giờ VN thì gửi bù, rồi bật lịch.
//   - Chống gửi trùng nằm ở database (cột nhac_moc của mỗi công ty, giành bằng UPDATE có điều kiện trong
//     companies.NhacGiaHan): chạy lại, hay hai tiến trình cùng database, không gửi lại mốc cũ.
//   - Không Lark, không email: chỉ thông báo trong chuông của admin.
//
// Công tắc REPORT_JOB (config.Config.ReportJob) chung cho CẢ HAI job: mặc định BẬT; đặt REPORT_JOB=0 để tắt.
// Khi server Node và server Go chạy song song trên cùng database thì chỉ để MỘT bên gửi: hai bên kiểm tra
// audit_log gần như cùng lúc nên chống trùng không chặn được, group Lark sẽ nhận hai báo cáo.
package jobs

import (
	"context"
	"fmt"
	"math"
	"os"
	"sync"
	"time"

	"qspro-backend/internal/config"
	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/contracts"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

const (
	vnOffsetMs  = 7 * 60 * 60 * 1000 // VN_OFFSET_MS
	baoCaoGioVN = 8                  // BAO_CAO_GIO_VN
	msNgay      = 24 * 60 * 60 * 1000
	choKhoiDong = 70 * time.Second // gửi bù 70 giây sau khi server chạy
	logTag      = "báo cáo nhập SP"

	nhacGioVN  = 8 // nhắc gia hạn: 8h05 giờ VN mỗi ngày
	nhacPhutVN = 5
	logTagNhac = "nhắc gia hạn"
)

// baoCaoThu = BAO_CAO_THU: 3 = thứ 4, 6 = thứ 7.
var baoCaoThu = [...]int{3, 6}

// Deps: Reports cho job báo cáo, Expiry (module companies) cho job nhắc gia hạn; thiếu cái nào thì job đó không bật.
// Cfg = cấu hình đã nạp (công tắc ReportJob); nil thì tự đọc REPORT_JOB.
type Deps struct {
	Reports contracts.ReportRunner
	Expiry  contracts.ExpiryReminder
	Cfg     *config.Config
}

// Worker: bộ hẹn giờ của các job nền.
type Worker struct {
	reports contracts.ReportRunner
	expiry  contracts.ExpiryReminder
	now     func() time.Time                                // thay được trong test
	sleep   func(ctx context.Context, d time.Duration) bool // false = ctx đã huỷ
	logf    func(tag string, args ...any)
	wg      sync.WaitGroup
	cancel  context.CancelFunc
}

func newWorker(d Deps) *Worker {
	return &Worker{reports: d.Reports, expiry: d.Expiry, now: time.Now, sleep: sleepCtx, logf: logger.Info}
}

// Enabled: công tắc REPORT_JOB đọc thẳng từ môi trường - chỉ giá trị "0" mới tắt job.
func Enabled() bool { return os.Getenv("REPORT_JOB") != "0" }

func (d Deps) enabled() bool {
	if d.Cfg != nil {
		return d.Cfg.ReportJob
	}
	return Enabled()
}

// Start bật job nền và trả về ngay. Job dừng khi ctx bị huỷ hoặc khi gọi Stop.
// REPORT_JOB=0 hoặc thiếu cả Reports lẫn Expiry: không bật gì, Worker trả về vẫn dùng được (Stop không làm gì).
func Start(ctx context.Context, d Deps) *Worker {
	w := newWorker(d)
	if !d.enabled() {
		logger.Info(logTag, "job gửi tự động đang TẮT (REPORT_JOB=0)")
		logger.Info(logTagNhac, "job nhắc gia hạn đang TẮT (REPORT_JOB=0)")
		return w
	}
	if d.Reports == nil {
		logger.Error(logTag, "không bật được job gửi tự động: thiếu module reports")
	}
	if d.Expiry == nil {
		logger.Error(logTagNhac, "không bật được job nhắc gia hạn: thiếu module companies")
	}
	if d.Reports == nil && d.Expiry == nil {
		return w
	}
	ctx, w.cancel = context.WithCancel(ctx)
	if d.Reports != nil {
		w.wg.Add(1)
		go func() {
			defer w.wg.Done()
			w.run(ctx)
		}()
	}
	if d.Expiry != nil {
		w.wg.Add(1)
		go func() {
			defer w.wg.Done()
			w.runNhac(ctx)
		}()
	}
	return w
}

// Stop dừng bộ hẹn giờ và chờ lượt gửi đang chạy dở (nếu có) xong hoặc tới khi ctx hết hạn.
// Dùng với server.OnShutdown.
func (w *Worker) Stop(ctx context.Context) {
	if w == nil {
		return
	}
	if w.cancel != nil {
		w.cancel()
	}
	done := make(chan struct{})
	go func() { w.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-ctx.Done():
	}
}

func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-ctx.Done():
		return false
	}
}

// run = timer khởi động (I:590-593) + scheduleBaoCaoSP_ (I:584-589).
func (w *Worker) run(ctx context.Context) {
	if !w.sleep(ctx, choKhoiDong) {
		return
	}
	w.autoBaoCaoSP(ctx, "gửi bù sau khi server thức")
	for {
		wait := w.msToNextBaoCao()
		w.logf(logTag, cauHenGio(wait))
		if !w.sleep(ctx, time.Duration(wait)*time.Millisecond) {
			return
		}
		w.autoBaoCaoSP(ctx, "đúng giờ")
	}
}

// cauHenGio: dòng log của scheduleBaoCaoSP_ (I:587-588).
func cauHenGio(wait float64) string {
	h := math.Floor(wait / 3600000)
	m := jsval.Round(math.Mod(wait, 3600000) / 60000)
	return "lần gửi kế tiếp sau " + jsval.NumberToString(h) + "h" + jsval.NumberToString(m) + "p (thứ 4 & thứ 7, 8h00 giờ VN)"
}

func (w *Worker) nowVN() time.Time { return time.UnixMilli(w.now().UnixMilli() + vnOffsetMs).UTC() }

func laNgayGui(t time.Time) bool {
	for _, d := range baoCaoThu {
		if int(t.Weekday()) == d {
			return true
		}
	}
	return false
}

// denHan: hai điều kiện đồng bộ của autoBaoCaoSP_ (I:567-568) - đúng thứ 4 / thứ 7 và đã qua 8h giờ VN.
func denHan(vn time.Time) bool { return laNgayGui(vn) && vn.Hour() >= baoCaoGioVN }

// msToNextBaoCao = msToNextBaoCao_(): số mili giây tới 8h00 (giờ VN) của thứ 4 / thứ 7 kế tiếp.
func (w *Worker) msToNextBaoCao() float64 {
	vn := w.nowVN()
	next := time.Date(vn.Year(), vn.Month(), vn.Day(), baoCaoGioVN, 0, 0, 0, time.UTC).UnixMilli()
	if next <= vn.UnixMilli() {
		next += msNgay
	}
	for !laNgayGui(time.UnixMilli(next).UTC()) {
		next += msNgay
	}
	return float64(next - vn.UnixMilli())
}

// autoBaoCaoSP = autoBaoCaoSP_(lyDo): đúng ngày, đã tới giờ và hôm nay chưa gửi thì gửi.
// Như bên Node, phần đọc database và gửi Lark chạy nền, không chặn việc hẹn lần kế tiếp.
func (w *Worker) autoBaoCaoSP(ctx context.Context, lyDo string) {
	if !denHan(w.nowVN()) {
		return
	}
	// Lượt gửi đã bắt đầu thì chạy hết kể cả khi server đang tắt: dừng giữa chừng sẽ có thẻ đã gửi mà chưa ghi audit.
	ctx = context.WithoutCancel(ctx)
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				logger.Error(logTag, "lỗi:", fmt.Sprint(r))
			}
		}()
		w.guiNeuChua(ctx, lyDo)
	}()
}

func (w *Worker) guiNeuChua(ctx context.Context, lyDo string) {
	if w.reports.DaGuiHomNay(ctx) {
		return
	}
	r, err := w.reports.BaoCaoNhapSP(ctx, &actor.Actor{R: "super"}, omap.New())
	if err != nil {
		logger.Error(logTag, "lỗi:", err.Error())
		return
	}
	if r == nil {
		return
	}
	dau := "[" + logTag + "][" + lyDo + "]"
	if jsval.Truthy(r.Val("sent")) {
		w.logf("", dau+" đã gửi Lark:", jsval.ToString(r.Val("count")), "sản phẩm")
	} else {
		w.logf("", dau, jsval.ToString(jsval.Or(r.Val("message"), "không gửi")))
	}
}

// ═══════════════════ NHẮC GIA HẠN (M17.3, chỉ bản Go) ═══════════════════

// runNhac: chờ 70 giây, gửi bù nếu hôm nay đã qua 8h05 giờ VN, rồi mỗi ngày chạy lúc 8h05 giờ VN.
func (w *Worker) runNhac(ctx context.Context) {
	if !w.sleep(ctx, choKhoiDong) {
		return
	}
	if daQuaGioNhac(w.nowVN()) {
		w.nhacGiaHan(ctx, "gửi bù sau khi server thức")
	}
	for {
		wait := w.msToNextNhac()
		w.logf(logTagNhac, cauHenNhac(wait))
		if !w.sleep(ctx, time.Duration(wait)*time.Millisecond) {
			return
		}
		w.nhacGiaHan(ctx, "đúng giờ")
	}
}

// daQuaGioNhac: giờ VN đã tới 8h05 của hôm nay chưa.
func daQuaGioNhac(vn time.Time) bool {
	return vn.Hour() > nhacGioVN || (vn.Hour() == nhacGioVN && vn.Minute() >= nhacPhutVN)
}

// msToNextNhac: số mili giây tới 8h05 giờ VN kế tiếp (đúng 8h05 thì hẹn sang ngày mai).
func (w *Worker) msToNextNhac() float64 {
	vn := w.nowVN()
	next := time.Date(vn.Year(), vn.Month(), vn.Day(), nhacGioVN, nhacPhutVN, 0, 0, time.UTC).UnixMilli()
	if next <= vn.UnixMilli() {
		next += msNgay
	}
	return float64(next - vn.UnixMilli())
}

func cauHenNhac(wait float64) string {
	h := math.Floor(wait / 3600000)
	m := jsval.Round(math.Mod(wait, 3600000) / 60000)
	return "lần nhắc kế tiếp sau " + jsval.NumberToString(h) + "h" + jsval.NumberToString(m) + "p (mỗi ngày 8h05 giờ VN)"
}

// nhacGiaHan: một lượt nhắc. Đã bắt đầu thì chạy hết kể cả khi server đang tắt (tránh gửi thông báo mà chưa ghi mốc).
func (w *Worker) nhacGiaHan(ctx context.Context, lyDo string) {
	ctx = context.WithoutCancel(ctx)
	defer func() {
		if r := recover(); r != nil {
			logger.Error(logTagNhac, "lỗi:", fmt.Sprint(r))
		}
	}()
	r, err := w.expiry.NhacGiaHan(ctx, false)
	if err != nil {
		logger.Error(logTagNhac, "lỗi:", err.Error())
		return
	}
	dau := "[" + logTagNhac + "][" + lyDo + "]"
	if r == nil || jsval.ToNumber(r.Val("soThongBao")) == 0 {
		w.logf("", dau, "không có công ty cần nhắc")
		return
	}
	w.logf("", dau, "đã gửi", jsval.ToString(r.Val("soThongBao")), "thông báo,", jsval.ToString(r.Val("soCongTy")), "công ty tới mốc nhắc")
}
