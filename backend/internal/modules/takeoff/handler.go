package takeoff

import (
	"context"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/response"
)

// RegisterRPC: 6 hàm /api/:fn của module. Chỉ saveLineAsProduct thuộc ACTOR_FNS (index.js:127) và đi qua cửa ngõ kiểm quyền.
func (s *Service) RegisterRPC(reg *rpc.Registry) {
	reg.Register("getLines", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.GetLines(ctx, args.ArgU(0))
	})
	reg.Register("addLine", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.AddLine(ctx, args.ArgU(0), args.ArgU(1), args.ArgU(2))
	})
	reg.Register("addBlankLine", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.AddBlankLine(ctx, args.ArgU(0), args.ArgU(1))
	})
	reg.Register("updateLine", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.UpdateLine(ctx, args.ArgU(0), args.ArgU(1))
	})
	reg.Register("deleteLine", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.DeleteLine(ctx, args.ArgU(0))
	})
	reg.Register("saveLineAsProduct", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.SaveLineAsProductGated(ctx, a, args.ArgU(0))
	})
}

// RegisterRoutes: REST /api/v1 (PORTING_MAP mục A). /projects/:id là mã dự án, /lines/:id là id dòng.
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {
	p := v1.Group("/projects", middleware.RequireLogin())
	p.GET("/:id/lines", func(c *gin.Context) {
		r, err := s.GetLines(c.Request.Context(), c.Param("id"))
		response.Result(c, r, err)
	})
	p.POST("/:id/lines", func(c *gin.Context) {
		b := readAddLineBody(c)
		r, err := s.AddLine(c.Request.Context(), c.Param("id"), b.Product, b.SoLuong)
		response.Result(c, r, err)
	})
	p.POST("/:id/lines/blank", func(c *gin.Context) {
		r, err := s.AddBlankLine(c.Request.Context(), c.Param("id"), middleware.Body(c))
		response.Result(c, r, err)
	})
	l := v1.Group("/lines", middleware.RequireLogin())
	l.PATCH("/:id", func(c *gin.Context) {
		r, err := s.UpdateLine(c.Request.Context(), c.Param("id"), middleware.Body(c))
		response.Result(c, r, err)
	})
	l.DELETE("/:id", func(c *gin.Context) {
		r, err := s.DeleteLine(c.Request.Context(), c.Param("id"))
		response.Result(c, r, err)
	})
	l.POST("/save-as-product", func(c *gin.Context) {
		r, err := s.SaveLineAsProductGated(c.Request.Context(), actor.FromGin(c), middleware.Body(c))
		response.Result(c, r, err)
	})
}
