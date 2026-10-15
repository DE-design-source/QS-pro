package projects

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/jsval"
)

// Thân request của REST là dữ liệu động (JS value model) và được đưa NGUYÊN vào service, như args của cổng /api/:fn:
//   POST  /projects                 thân = data của createProject
//   PATCH /projects/:id             thân = fields của updateProject
//   POST  /projects/:id/duplicate   thân = opts của duplicateProject ({boc, cover, pt}; có thể bỏ trống)
//   PUT   /projects/:id/data/:khoa  thân = {giaTri}

// setDataBody: thân của PUT /projects/:id/data/:khoa.
type setDataBody struct {
	GiaTri any // thiếu khoá -> Undefined (service đổi thành null như Node)
}

func readSetDataBody(c *gin.Context) setDataBody {
	return setDataBody{GiaTri: jsval.Get(middleware.Body(c), "giaTri")}
}
