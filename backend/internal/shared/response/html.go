package response

import (
	"html"

	"github.com/gin-gonic/gin"
)

// HTMLError: trang lỗi mặc định của Express (finalhandler) - dùng cho 404 không khớp route,
// thân JSON hỏng (400), thân quá lớn (413). msg đã là chữ thường, hàm tự escape HTML.
func HTMLError(c *gin.Context, status int, msg string) {
	h := c.Writer.Header()
	h.Set("Content-Security-Policy", "default-src 'none'")
	h.Set("X-Content-Type-Options", "nosniff")
	body := "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>" +
		html.EscapeString(msg) + "</pre>\n</body>\n</html>\n"
	c.Data(status, "text/html; charset=utf-8", []byte(body))
	c.Abort()
}
