package categories

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/jsval"
)

const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// RegisterRPC: module không có hàm /api/:fn nào.
func (s *Service) RegisterRPC(reg *rpc.Registry) {}

// RegisterRoutes: module không có route REST nào dưới /api/v1.
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {}

// RegisterRoot gắn 3 route tải file mẫu nhập hàng loạt (server/index.js dòng 797-829). Không cần đăng nhập.
func (s *Service) RegisterRoot(root *gin.RouterGroup) {
	root.GET("/mau-nhap-thiet-bi-ve-sinh.xlsx", func(c *gin.Context) {
		buf, err := BuildVsTemplate()
		sendTemplate(c, "Mau-nhap-thiet-bi-ve-sinh", buf, err)
	})
	root.GET("/mau-nhap-cong-tac-o-cam.xlsx", func(c *gin.Context) {
		hm, err := queryHM(c)
		var buf []byte
		if err == nil {
			buf, err = BuildCtTemplate(hm)
		}
		sendTemplate(c, "Mau-nhap-cong-tac-o-cam", buf, err)
	})
	root.GET("/mau-nhap-son-nuoc.xlsx", func(c *gin.Context) {
		hm, err := queryHM(c)
		var buf []byte
		if err == nil {
			buf, err = BuildSonTemplate(hm)
		}
		sendTemplate(c, SonTemplateName(hm), buf, err)
	})
}

// queryHM = String((req.query && req.query.hm) || "").trim(). Lỗi = String() ném TypeError (nằm trong try của Node -> 500).
func queryHM(c *gin.Context) (string, error) {
	q := expressQuery(rawQuery(c.Request), "hm")
	return jsval.Trim(q.Str), q.Err
}

func sendTemplate(c *gin.Context, ten string, buf []byte, err error) {
	if err != nil {
		sendText(c, 500, "Lỗi tạo file mẫu: "+err.Error())
		return
	}
	h := c.Writer.Header()
	h.Set("Content-Type", xlsxMime)
	h.Set("Content-Disposition", `attachment; filename="`+ten+`-DezonQS.xlsx"`)
	h.Set("Cache-Control", "no-cache")
	send(c, 200, xlsxMime, buf)
}
