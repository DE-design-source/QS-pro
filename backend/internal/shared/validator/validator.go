// Package validator: vài hàm nhỏ để handler REST (/api/v1) đọc tham số rồi gọi service
// với đúng giá trị mà cổng /api/:fn sẽ truyền (JS value model).
package validator

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Body: thân JSON là object (PATCH / POST); không phải object -> 400.
func Body(c *gin.Context) (*omap.Map, error) {
	m, ok := middleware.Body(c).(*omap.Map)
	if !ok || m == nil {
		return nil, apperr.BadRequest("Thân request phải là object JSON")
	}
	return m, nil
}

// Param: tham số đường dẫn (:id...); rỗng -> 400.
func Param(c *gin.Context, name string) (string, error) {
	v := c.Param(name)
	if v == "" {
		return "", apperr.BadRequest("Thiếu tham số " + name)
	}
	return v, nil
}

// ParamNum: tham số đường dẫn là số (id kiểu bigint) -> float64 như JSON number; không phải số -> 400.
func ParamNum(c *gin.Context, name string) (float64, error) {
	f, err := strconv.ParseFloat(c.Param(name), 64)
	if err != nil {
		return 0, apperr.BadRequest("Tham số " + name + " phải là số")
	}
	return f, nil
}

// Query: tham số query dạng chuỗi; không có -> nil (để service nhận null như khi client bỏ trống).
func Query(c *gin.Context, name string) any {
	if v, ok := c.GetQuery(name); ok {
		return v
	}
	return nil
}

// QueryNum: tham số query là số; không có / không phải số -> def.
func QueryNum(c *gin.Context, name string, def float64) float64 {
	v, ok := c.GetQuery(name)
	if !ok {
		return def
	}
	f := jsval.ToNumber(v)
	if f != f {
		return def
	}
	return f
}

// QueryBool: "1" / "true" -> true.
func QueryBool(c *gin.Context, name string) bool {
	v := c.Query(name)
	return v == "1" || v == "true"
}

// Require: các khoá bắt buộc phải có và khác rỗng trong body; thiếu -> 400.
func Require(m *omap.Map, keys ...string) error {
	for _, k := range keys {
		if !jsval.Truthy(m.Val(k)) {
			return apperr.BadRequest("Thiếu trường " + k)
		}
	}
	return nil
}
