package materials

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/jsval"
)

// Thân request của REST là dữ liệu động (JS value model), đưa NGUYÊN vào service như args của cổng /api/:fn.
// Tham số là MỘT object thì lấy cả thân; nhiều tham số thì đọc theo tên tham số của hàm Node:
//
//	POST  /products                              thân = data của saveDbProduct ({nhãn: giá trị})
//	PATCH /products/:key                         thân = data của updateDbProductTracked
//	PUT   /products/:key/combo                   {items}
//	PUT   /products/:key/variants                {ids}
//	POST  /product-approvals                     {keys, approve}
//	POST  /product-favorites                     {keys, on}
//	POST  /uploads/images, /uploads/files-base64 {base64, fileName}
//	POST  /product-imports/parse                 {base64, ext, nganh}
//	POST  /product-imports/commit                {products}
//	POST  /product-delete-requests               {items}
//	POST  /product-delete-requests/:id/resolve   {approve}

// bodyVal: thân[key]; thiếu khoá -> Undefined, như tham số bị bỏ của cổng rpc.
func bodyVal(c *gin.Context, key string) any {
	return jsval.Get(middleware.Body(c), key)
}
