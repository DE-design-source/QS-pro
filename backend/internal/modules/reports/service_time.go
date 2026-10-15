package reports

import (
	"fmt"
	"math"
	"time"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Date của JS được giữ dưới dạng time value: số mili giây (float64), NaN = Invalid Date.
// "Giờ VN" là time value đã cộng 7 tiếng rồi đọc bằng các hàm getUTC* (I:323-364).

// nowVN = nowVN_().
func (s *Service) nowVN() float64 { return float64(s.now().UnixMilli()) + vnOffsetMs }

func utcOf(ms float64) time.Time { return time.UnixMilli(int64(ms)).UTC() }

func laNgayGui(t time.Time) bool {
	for _, d := range baoCaoThu {
		if int(t.Weekday()) == d {
			return true
		}
	}
	return false
}

// moBaoCaoTruoc = moBaoCaoTruoc_(vnNow): mốc bắt đầu của kỳ = 8h sáng của ngày gửi TRƯỚC đó trong lịch.
func moBaoCaoTruoc(vnNow float64) float64 {
	t := utcOf(vnNow)
	d := float64(time.Date(t.Year(), t.Month(), t.Day(), baoCaoGioVN, 0, 0, 0, time.UTC).UnixMilli())
	if d > vnNow { // chưa tới giờ hôm nay -> lùi 1 ngày
		d -= msNgay
	}
	for {
		d -= msNgay
		if laNgayGui(utcOf(d)) {
			return d
		}
	}
}

// isoString = date.toISOString(); Invalid Date -> ok = false (JS ném RangeError "Invalid time value").
func isoString(ms float64) (string, bool) {
	if ms != ms || math.Abs(ms) > maxTimeMs {
		return "", false
	}
	t := utcOf(ms)
	y := t.Year()
	rest := t.Format("-01-02T15:04:05.000Z")
	switch {
	case y >= 0 && y <= 9999:
		return fmt.Sprintf("%04d", y) + rest, true
	case y < 0:
		return fmt.Sprintf("-%06d", -y) + rest, true
	}
	return fmt.Sprintf("+%06d", y) + rest, true
}

// ddmm = ddmm_(vnDate). Invalid Date -> "NaN/NaN" như JS.
func ddmm(ms float64) string {
	if ms != ms {
		return "NaN/NaN"
	}
	t := utcOf(ms)
	return fmt.Sprintf("%02d/%02d", t.Day(), int(t.Month()))
}

// timeClip: phép TimeClip của Date.
func timeClip(x float64) float64 {
	if x != x || math.IsInf(x, 0) || math.Abs(x) > maxTimeMs {
		return math.NaN()
	}
	return math.Trunc(x) + 0
}

// newDate = new Date(v) với MỘT tham số. loc là múi giờ của tiến trình (chuỗi ngày-giờ không ghi múi giờ được hiểu theo nó).
func newDate(v any, loc *time.Location) float64 {
	switch x := v.(type) {
	case nil:
		return 0
	case bool:
		if x {
			return 1
		}
		return 0
	case string:
		return parseDate(x, loc)
	}
	if omap.IsUndefined(v) {
		return math.NaN()
	}
	if jsval.IsNumber(v) {
		return timeClip(jsval.ToNumber(v))
	}
	return parseDate(jsval.ToString(v), loc) // mảng / object: đổi sang chuỗi trước
}
