package takeoff

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/jsval"
)

// Thân request của REST là dữ liệu động (JS value model), đưa NGUYÊN vào service như args của cổng /api/:fn:
//   POST  /projects/:id/lines         thân = {product, soLuong}
//   POST  /projects/:id/lines/blank   thân = opts của addBlankLine ({tang, nhom}; có thể bỏ trống)
//   PATCH /lines/:id                  thân = fields của updateLine
//   POST  /lines/save-as-product      thân = line của saveLineAsProduct

// addLineBody: thân của POST /projects/:id/lines. Thiếu khoá -> Undefined, như tham số bị bỏ của cổng rpc.
type addLineBody struct {
	Product any
	SoLuong any
}

func readAddLineBody(c *gin.Context) addLineBody {
	b := middleware.Body(c)
	return addLineBody{Product: jsval.Get(b, "product"), SoLuong: jsval.Get(b, "soLuong")}
}
