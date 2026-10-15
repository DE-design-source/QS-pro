package quotations

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// saveCoverBody: thân của PUT /projects/:id/cover - {rows}. Thiếu khoá = undefined như tham số rpc bị thiếu.
type saveCoverBody struct {
	Rows any
}

func readSaveCoverBody(c *gin.Context) saveCoverBody {
	return saveCoverBody{Rows: middleware.BodyMap(c).Val("rows")}
}

// exportBody: thân của POST /projects/:id/quotation/export - {cols, format, nodes, phanTho, anMuc, tong, org}.
type exportBody struct {
	Cols, Format, Nodes, PhanTho, AnMuc, Tong, Org any
}

func readExportBody(c *gin.Context) exportBody {
	m := middleware.BodyMap(c)
	return exportBody{Cols: m.Val("cols"), Format: m.Val("format"), Nodes: m.Val("nodes"), PhanTho: m.Val("phanTho"),
		AnMuc: m.Val("anMuc"), Tong: m.Val("tong"), Org: m.Val("org")}
}

// bangBody = req.body || {} của POST /export/bang.
func bangBody(v any) any {
	if !jsval.Truthy(v) {
		return omap.New()
	}
	return v
}
