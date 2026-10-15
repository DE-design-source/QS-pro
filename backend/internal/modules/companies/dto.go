package companies

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/jsval"
)

// bodyData: tham số "data" của REST. Theo quy ước PORTING_MAP mục A, tham số nằm trong thân JSON dưới tên của nó
// ({"data": {...}}); thân không có khoá "data" thì cả thân là data (như ví dụ ở ARCHITECTURE mục 5).
func bodyData(c *gin.Context) any {
	body := middleware.Body(c)
	if m := jsval.AsMap(body); m != nil && m.Has("data") {
		return m.Val("data")
	}
	return body
}
