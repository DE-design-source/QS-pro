package system

import (
	"github.com/gin-gonic/gin"

	"qspro-backend/internal/server/rpc"
)

// RegisterRPC đăng ký các hàm /api/:fn của module. Module mẫu không có hàm nào.
//
// Module thật viết, ví dụ:
//
//	reg.Register("getProjects", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
//		return s.GetProjects(ctx)
//	})
func (s *Service) RegisterRPC(reg *rpc.Registry) {}

// RegisterRoutes gắn route REST dưới /api/v1. Module mẫu không có route nào.
//
// Module thật viết, ví dụ:
//
//	g := v1.Group("/projects", middleware.RequireLogin())
//	g.GET("", s.list)
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {}
