package quotations

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/qscore"
)

// saveCoverBody: thân của PUT /projects/:id/cover - {rows}. Thiếu khoá = undefined như tham số rpc bị thiếu.
type saveCoverBody struct {
	Rows any
}

func readSaveCoverBody(c *gin.Context) saveCoverBody {
	return saveCoverBody{Rows: middleware.BodyMap(c).Val("rows")}
}

// doiLoiChiPhiAm: lỗi ràng buộc ck_cost_estimate_lines_cost (500 kèm chi tiết DB) -> 400 tiếng Việt. Đổi SAU SaveCover để
// thứ tự kiểm giống rpc (dự án mất / khác công ty báo trước); lệnh insert hỏng thì chưa ghi gì.
// Chỉ ở route REST: cổng rpc giữ đúng lỗi của bản Node (golden save-neg).
func doiLoiChiPhiAm(err error, rows any) error {
	if err == nil || !strings.Contains(err.Error(), "ck_cost_estimate_lines_cost") {
		return err
	}
	if e := kiemChiPhiTobia(rows); e != nil {
		return e
	}
	return err
}

// kiemChiPhiTobia: dòng đầu tiên có chi phí âm -> 400 (đọc số bằng qscore.N như SaveCover).
func kiemChiPhiTobia(rows any) error {
	list, ok := rows.([]any)
	if !ok {
		return nil
	}
	for i, r := range list {
		if jsval.IsNullish(r) {
			continue
		}
		if qscore.N(prop(r, "chiPhi")) < 0 {
			noi := "mục " + strings.TrimSpace(jsval.S(prop(r, "stt")))
			if noi == "mục " {
				noi = "dòng " + strconv.Itoa(i+1)
			}
			return apperr.BadRequest("Chi phí dự kiến không được âm (" + noi + ").")
		}
	}
	return nil
}

// exportBody: thân của POST /projects/:id/quotation/export - {cols, format, nodes, phanTho, anMuc, tong, org, opts}.
// opts là khoá chỉ bản Go (service_export_opts.go); thiếu = undefined, file như bản Node.
type exportBody struct {
	Cols, Format, Nodes, PhanTho, AnMuc, Tong, Org, Opts any
}

func readExportBody(c *gin.Context) exportBody {
	m := middleware.BodyMap(c)
	return exportBody{Cols: m.Val("cols"), Format: m.Val("format"), Nodes: m.Val("nodes"), PhanTho: m.Val("phanTho"),
		AnMuc: m.Val("anMuc"), Tong: m.Val("tong"), Org: m.Val("org"), Opts: m.Val("opts")}
}

// bangBody = req.body || {} của POST /export/bang.
func bangBody(v any) any {
	if !jsval.Truthy(v) {
		return omap.New()
	}
	return v
}
