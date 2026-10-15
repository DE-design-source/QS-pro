package notifications

import (
	"context"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/response"
	"qspro-backend/internal/shared/validator"
)

// RegisterRPC: 4 hàm, đều thuộc ACTOR_FNS và chỉ cần đăng nhập (I:120).
func (s *Service) RegisterRPC(reg *rpc.Registry) {
	reg.Register("notifCount", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.NotifCount(ctx, a)
	})
	reg.Register("notifList", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.NotifList(ctx, a, args.ArgU(0))
	})
	reg.Register("notifRead", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.NotifRead(ctx, a, args.ArgU(0))
	})
	reg.Register("notifReadAll", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.NotifReadAll(ctx, a)
	})
}

// RegisterRoutes: REST dưới /api/v1/notifications, gọi đúng các phương thức mà cổng rpc gọi.
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {
	g := v1.Group("/notifications", middleware.RequireLogin())
	g.GET("/unread-count", func(c *gin.Context) {
		r, err := s.NotifCount(c.Request.Context(), actor.FromGin(c))
		response.Result(c, r, err)
	})
	g.GET("", func(c *gin.Context) {
		r, err := s.NotifList(c.Request.Context(), actor.FromGin(c), validator.Query(c, "limit"))
		response.Result(c, r, err)
	})
	g.POST("/read-all", func(c *gin.Context) {
		r, err := s.NotifReadAll(c.Request.Context(), actor.FromGin(c))
		response.Result(c, r, err)
	})
	g.POST("/:id/read", func(c *gin.Context) {
		r, err := s.NotifRead(c.Request.Context(), actor.FromGin(c), c.Param("id"))
		response.Result(c, r, err)
	})
}
