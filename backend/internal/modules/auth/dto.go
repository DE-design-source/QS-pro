package auth

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Thân request của REST /api/v1 (đọc theo JS value model để service nhận đúng giá trị như cổng /api/:fn):
//
//	POST /auth/login             {username, password}
//	PUT  /auth/me/prefs/:key     {value}            (value null / thiếu = xoá khoá)
//	POST /auth/change-password   {oldPw, newPw}
//	POST /client-errors          = info của logClientError {tab, msg, src}

// bodyMap: thân là object -> map; không phải object -> nil.
func bodyMap(c *gin.Context) *omap.Map { return jsval.AsMap(middleware.Body(c)) }

// bodyVal: body[key]; thiếu khoá -> Undefined (như tham số thiếu bên rpc).
func bodyVal(c *gin.Context, key string) any { return bodyMap(c).Val(key) }
