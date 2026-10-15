package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CORS: server Node không bật CORS (giao diện cùng origin). Bản Go chỉ bật khi đặt CORS_ORIGINS,
// để giao diện chạy ở origin khác gọi được API. origins rỗng -> middleware không làm gì.
func CORS(origins []string) gin.HandlerFunc {
	allowAll := false
	set := map[string]bool{}
	for _, o := range origins {
		if o == "*" {
			allowAll = true
		}
		set[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if len(origins) == 0 || origin == "" || (!allowAll && !set[origin]) {
			return
		}
		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Add("Vary", "Origin")
		h.Set("Access-Control-Expose-Headers", "x-app-ver, Content-Disposition, X-Row-Count")
		if c.Request.Method == http.MethodOptions && c.GetHeader("Access-Control-Request-Method") != "" {
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, x-view-company")
			h.Set("Access-Control-Max-Age", "600")
			c.AbortWithStatus(http.StatusNoContent)
		}
	}
}
