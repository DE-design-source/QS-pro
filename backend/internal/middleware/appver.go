package middleware

import "github.com/gin-gonic/gin"

// AppVer gắn header x-app-ver (mã phiên bản đang chạy, cùng giá trị với cổng /api/:fn) cho mọi response của group.
// Giao diện React QS đọc header này để nhắc "Đã có bản cập nhật mới" sau khi deploy (roadmap M1.1).
// Gắn TRƯỚC Auth để cả response 401 / 403 cũng có header.
func AppVer(ver string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("x-app-ver", ver)
	}
}
