package users

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Thân request của REST /api/v1 (đọc theo JS value model để service nhận đúng giá trị như cổng /api/:fn):
//
//	POST   /users               = data của adminCreateUser {username, password, role, perms, hoTen, email, phongBan, congTyId}
//	PATCH  /users/:id           = fields của adminUpdateUser {hoTen?, role?, perms?, phongBan?, congTyId?, email?} (có khoá = có sửa;
//	                              email là khoá chỉ bản Go - M14.1)
//	PUT    /users/:id/password  {newPassword}
//	PUT    /users/:id/active    {active}
//	GET    /audit-log?limit=

// bodyMap: thân là object -> map; không phải object -> nil (như tham số thiếu / sai kiểu bên rpc).
func bodyMap(c *gin.Context) *omap.Map { return jsval.AsMap(middleware.Body(c)) }

// bodyVal: body[key]; thiếu khoá -> Undefined (như tham số thiếu).
func bodyVal(c *gin.Context, key string) any { return bodyMap(c).Val(key) }
