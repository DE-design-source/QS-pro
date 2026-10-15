package files

import (
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/server/rpc"
)

// RegisterRPC: module không có hàm /api/:fn nào (uploadImage / uploadFile thuộc materials).
func (s *Service) RegisterRPC(reg *rpc.Registry) {}

// RegisterRoutes: module không có route REST nào dưới /api/v1.
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {}

// RegisterRoot gắn GET /media?token=<file_token> (server/index.js dòng 635-646). Không cần đăng nhập.
func (s *Service) RegisterRoot(root *gin.RouterGroup) {
	root.GET("/media", s.media)
}

var (
	reCharset  = regexp.MustCompile(`;\s*charset\s*=`)
	reTextType = regexp.MustCompile(`^text/|^application/(javascript|json)`)
)

// contentTypeExpress = giá trị res.set("Content-Type", v) thật sự ghi ra: Express 4 tự thêm "; charset=utf-8"
// cho text/*, application/json, application/javascript khi chưa khai charset.
func contentTypeExpress(v string) string {
	if !reCharset.MatchString(v) && reTextType.MatchString(strings.SplitN(v, ";", 2)[0]) {
		return v + "; charset=utf-8"
	}
	return v
}

func (s *Service) media(c *gin.Context) {
	token := expressQuery(rawQuery(c.Request), "token")
	if !token.Truthy {
		sendText(c, 400, "thiếu token")
		return
	}
	// token.Err: encodeURIComponent(object có khoá toString) ném TypeError trong try -> cũng 502,
	// nhưng Node đã kịp xin tenant token (và giữ lại) trước khi ném
	var buf []byte
	var ct string
	err := token.Err
	if err != nil {
		_, _ = s.tenantToken(c.Request.Context(), false)
	} else {
		buf, ct, err = s.MediaDownload(c.Request.Context(), token.Str)
	}
	if err != nil {
		sendText(c, 502, "Không tải được ảnh")
		return
	}
	h := c.Writer.Header()
	h.Set("Content-Type", contentTypeExpress(ct))
	h.Set("Cache-Control", "public, max-age=86400")
	send(c, 200, "application/octet-stream", buf)
}
