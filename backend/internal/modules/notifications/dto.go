package notifications

import (
	"math"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// listLimit: giới hạn dòng của notifList đúng như Node tính.
// Node: limit = Math.min(Number(limit) || 30, 100) (A:460); supa.select ghi " limit " + Math.floor(limit) khi limit khác 0
// (supa.js:373-378). Giá trị trong (0, 1) thành "limit 0" (0 dòng) - database.SelectOpt.Limit = 0 lại nghĩa là không giới hạn,
// nên trả zero = true để service tự cắt về 0 dòng. text = con số đúng như JS ghi vào câu lệnh.
func listLimit(limit any) (n int, zero bool, text string, err error) {
	v := math.Floor(math.Min(jsval.NumOr(limit, 30), 100))
	text = jsval.ToString(v)
	switch {
	case v == 0:
		return 1, true, text, nil
	case math.IsInf(v, -1):
		// Node ghi "limit -Infinity": Postgres hiểu Infinity là tên cột
		return 0, false, text, limitErr("42703", `column "infinity" does not exist`)
	case v <= -9223372036854775808:
		// JS ghi -2^63 thành -9223372036854776000 (và -1e+21...): hằng số vượt cỡ bigint của mệnh đề LIMIT
		return 0, false, text, limitErr("22003", "bigint out of range")
	}
	return int(v), false, text, nil
}

// limitErr: lỗi Postgres mà Node nhận được với mệnh đề limit không viết được bằng số nguyên (SelectOpt.Limit là int).
func limitErr(code, message string) error {
	body, _ := omap.MarshalString(omap.Of("code", code, "details", nil, "hint", nil, "message", message))
	return &database.Error{Msg: "DB GET notifications -> 400 " + body, Code: code, Status: 400}
}
