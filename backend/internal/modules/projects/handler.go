package projects

import (
	"context"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/response"
	"qspro-backend/internal/shared/validator"
)

// RegisterRPC: 8 hàm /api/:fn của module. Chỉ setProjData thuộc ACTOR_FNS (index.js:118).
func (s *Service) RegisterRPC(reg *rpc.Registry) {
	reg.Register("bootstrap", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.Bootstrap(ctx, args.ArgU(0))
	})
	reg.Register("getProjects", rpc.Login, func(ctx context.Context, _ *actor.Actor, _ rpc.Args) (any, error) {
		return s.GetProjects(ctx)
	})
	reg.Register("createProject", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.CreateProject(ctx, args.ArgU(0))
	})
	reg.Register("updateProject", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.UpdateProject(ctx, args.ArgU(0), args.ArgU(1))
	})
	reg.Register("deleteProject", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.DeleteProject(ctx, args.ArgU(0))
	})
	reg.Register("duplicateProject", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.DuplicateProject(ctx, args.ArgU(0), args.ArgU(1))
	})
	reg.Register("getProjData", rpc.Login, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.GetProjData(ctx, args.ArgU(0))
	})
	reg.Register("setProjData", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.SetProjData(ctx, a, args.ArgU(0), args.ArgU(1), args.ArgU(2))
	})
}

// RegisterRoutes: REST /api/v1 (PORTING_MAP mục A). :id là mã dự án (ma_da); với .../data/:khoa có thể là "__cty".
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {
	v1.GET("/bootstrap", middleware.RequireLogin(), func(c *gin.Context) {
		// tham số query luôn là chuỗi: ?maDA=0 tương đương rpc bootstrap("0") (truthy, mã dự án "0"), không phải bootstrap(0)

		r, err := s.Bootstrap(c.Request.Context(), validator.Query(c, "maDA"))
		response.Result(c, r, err)
	})
	g := v1.Group("/projects", middleware.RequireLogin())
	g.GET("", func(c *gin.Context) {
		r, err := s.GetProjects(c.Request.Context())
		response.Result(c, r, err)
	})
	g.POST("", func(c *gin.Context) {
		r, err := s.CreateProject(c.Request.Context(), middleware.Body(c))
		response.Result(c, r, err)
	})
	g.PATCH("/:id", func(c *gin.Context) {
		r, err := s.UpdateProject(c.Request.Context(), c.Param("id"), middleware.Body(c))
		response.Result(c, r, err)
	})
	g.DELETE("/:id", func(c *gin.Context) {
		r, err := s.DeleteProject(c.Request.Context(), c.Param("id"))
		response.Result(c, r, err)
	})
	g.POST("/:id/duplicate", func(c *gin.Context) {
		r, err := s.DuplicateProject(c.Request.Context(), c.Param("id"), middleware.Body(c))
		response.Result(c, r, err)
	})
	g.GET("/:id/data", func(c *gin.Context) {
		r, err := s.GetProjData(c.Request.Context(), c.Param("id"))
		response.Result(c, r, err)
	})
	g.PUT("/:id/data/:khoa", func(c *gin.Context) {
		b := readSetDataBody(c)
		r, err := s.SetProjData(c.Request.Context(), actor.FromGin(c), c.Param("id"), c.Param("khoa"), b.GiaTri)
		response.Result(c, r, err)
	})
}
