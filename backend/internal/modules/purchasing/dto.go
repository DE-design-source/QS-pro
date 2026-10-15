package purchasing

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/jsval"
)

// bodyKey: 1 trường của thân JSON REST; thân không phải object hoặc thiếu khoá -> undefined (như rpc thiếu tham số).
// Dùng cho {"approve": true} của .../resolve và {"status": "..."} của .../status.
func bodyKey(c *gin.Context, key string) any {
	return jsval.Get(middleware.Body(c), key)
}
