package reports

import (
	"context"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/response"
)

// RegisterRPC: baoCaoNhapSP thuộc ACTOR_FNS và SUPER_FNS (I:124, 129) - super chạy tay / dryRun.
func (s *Service) RegisterRPC(reg *rpc.Registry) {
	reg.Register("baoCaoNhapSP", rpc.Super, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		// opts = opts || {}; tham số không phải object thì opts.tuVN / opts.dryRun đều là undefined, như object rỗng
		return s.BaoCaoNhapSP(ctx, a, args.Map(0))
	})
}

// RegisterRoutes: POST /api/v1/reports/new-products, thân = opts ({tuVN?, dryRun?}); không có thân = {}.
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {
	g := v1.Group("/reports", middleware.RequireSuper())
	g.POST("/new-products", func(c *gin.Context) {
		r, err := s.BaoCaoNhapSP(c.Request.Context(), actor.FromGin(c), optsOf(c))
		response.Result(c, r, err)
	})
}
