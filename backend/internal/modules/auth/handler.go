package auth

import (
	"context"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/response"
)

// RegisterRPC: 6 hàm. login thuộc PUBLIC_FNS và không nhận actor; 5 hàm còn lại thuộc ACTOR_FNS (I:116-118).
func (s *Service) RegisterRPC(reg *rpc.Registry) {
	reg.Register("login", rpc.Public, func(ctx context.Context, _ *actor.Actor, args rpc.Args) (any, error) {
		return s.Login(ctx, args.ArgU(0), args.ArgU(1))
	})
	reg.Register("me", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.Me(ctx, a)
	})
	reg.Register("setMyPref", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.SetMyPref(ctx, a, args.ArgU(0), args.ArgU(1))
	})
	reg.Register("logout", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.Logout(ctx, a)
	})
	reg.Register("changePassword", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.ChangePassword(ctx, a, args.ArgU(0), args.ArgU(1))
	})
	reg.Register("logClientError", rpc.Login, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.LogClientError(ctx, a, args.ArgU(0))
	})
}

// RegisterRoutes: REST /api/v1 - gọi đúng phương thức service mà hàm rpc gọi.
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {
	v1.POST("/auth/login", func(c *gin.Context) {
		r, err := s.Login(c.Request.Context(), bodyVal(c, "username"), bodyVal(c, "password"))
		response.Result(c, r, err)
	})
	g := v1.Group("/auth", middleware.RequireLogin())
	g.GET("/me", func(c *gin.Context) {
		r, err := s.Me(c.Request.Context(), actor.FromGin(c))
		response.Result(c, r, err)
	})
	g.PUT("/me/prefs/:key", func(c *gin.Context) {
		r, err := s.SetMyPref(c.Request.Context(), actor.FromGin(c), c.Param("key"), bodyVal(c, "value"))
		response.Result(c, r, err)
	})
	g.POST("/logout", func(c *gin.Context) {
		r, err := s.Logout(c.Request.Context(), actor.FromGin(c))
		response.Result(c, r, err)
	})
	g.POST("/change-password", func(c *gin.Context) {
		r, err := s.ChangePassword(c.Request.Context(), actor.FromGin(c), bodyVal(c, "oldPw"), bodyVal(c, "newPw"))
		response.Result(c, r, err)
	})
	v1.POST("/client-errors", middleware.RequireLogin(), func(c *gin.Context) {
		r, err := s.LogClientError(c.Request.Context(), actor.FromGin(c), middleware.Body(c))
		response.Result(c, r, err)
	})
}
