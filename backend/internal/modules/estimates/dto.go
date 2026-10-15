package estimates

import "qspro-backend/internal/shared/omap"

// batchReq: thân của POST /work-items/delete | approval | favorites.
//
//	{"ids": <id hoặc mảng id>, "approve": <bool>}   (approval)
//	{"ids": <id hoặc mảng id>, "on": <bool>}        (favorites)
//
// Khoá vắng mặt giữ là Undefined - đúng như tham số thiếu của cổng /api/:fn (approve / on thiếu = true).
type batchReq struct {
	IDs  any
	Flag any
}

func readBatch(body *omap.Map, flagKey string) batchReq {
	return batchReq{IDs: body.Val("ids"), Flag: body.Val(flagKey)}
}
