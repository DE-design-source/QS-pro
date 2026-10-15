package reports

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/omap"
)

// Thân của POST /api/v1/reports/new-products (đều tuỳ chọn):
//
//	tuVN   mốc bắt đầu kỳ, đọc như new Date(tuVN) rồi coi là ĐỒNG HỒ VN (vd "2026-10-07T08:00:00.000Z" = 8h00 ngày 07/10 giờ VN)
//	dryRun true = chỉ trả số liệu từng công ty, không gửi Lark, không ghi audit
//
// Kết quả là object động (4 dạng, xem PORTING_MAP F65) nên không khai struct.

// optsOf: thân JSON là object thì dùng làm opts, ngược lại nil (= {}).
func optsOf(c *gin.Context) *omap.Map { return middleware.BodyMap(c) }
