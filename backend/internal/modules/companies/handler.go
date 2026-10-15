package companies

import (
	"context"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/response"
)

// RegisterRPC: 6 hàm, đều thuộc ACTOR_FNS. updateCongTy chỉ nằm trong ADMIN_FNS (hàm tự kiểm đúng công ty),
// 5 hàm còn lại thuộc SUPER_FNS (I:124-135).
func (s *Service) RegisterRPC(reg *rpc.Registry) {
	reg.Register("listCongTy", rpc.Super, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.ListCongTy(ctx, a)
	})
	reg.Register("createCongTy", rpc.Super, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.CreateCongTy(ctx, a, args.ArgU(0))
	})
	reg.Register("updateCongTy", rpc.Admin, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.UpdateCongTy(ctx, a, args.ArgU(0), args.ArgU(1))
	})
	reg.Register("deleteCongTy", rpc.Super, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.DeleteCongTy(ctx, a, args.ArgU(0))
	})
	reg.Register("listCongTyUsers", rpc.Super, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.ListCongTyUsers(ctx, a, args.ArgU(0))
	})
	reg.Register("createCongTyUser", rpc.Super, func(ctx context.Context, a *actor.Actor, args rpc.Args) (any, error) {
		return s.CreateCongTyUser(ctx, a, args.ArgU(0), args.ArgU(1))
	})
	// Route chỉ bản Go (roadmap M17.3, giả định): nhắc gia hạn trong ứng dụng, không Lark / email.
	reg.RegisterGoRoute(rpc.GoRoute{
		Name: "nhacGiaHan", Method: "POST", Path: "/companies/expiry-reminders", Perm: rpc.Super, Tag: "Công ty",
		Summary: "Nhắc gia hạn công ty trong ứng dụng (mốc 30/14/7/3/1/0 ngày, mỗi mốc 1 lần): thông báo cho admin đang hoạt động; " +
			"dryRun chỉ trả danh sách. Job nền tự chạy 8h05 giờ VN (tắt khi REPORT_JOB=0)",
		Fields: []rpc.GoField{
			{Name: "dryRun", In: "body", Type: "boolean",
				Desc: "false = gửi thật; true hoặc bỏ trống = chạy thử, không gửi thông báo, không ghi mốc"},
		},
	})
}

// RegisterRoutes: REST dưới /api/v1/companies, gọi đúng các phương thức mà cổng rpc gọi.
func (s *Service) RegisterRoutes(v1 *gin.RouterGroup) {
	g := v1.Group("/companies")
	g.GET("", middleware.RequireSuper(), func(c *gin.Context) {
		r, err := s.ListCongTy(c.Request.Context(), actor.FromGin(c))
		response.Result(c, r, err)
	})
	g.POST("", middleware.RequireSuper(), func(c *gin.Context) {
		r, err := s.CreateCongTy(c.Request.Context(), actor.FromGin(c), bodyData(c))
		response.Result(c, r, err)
	})
	g.POST("/expiry-reminders", middleware.RequireSuper(), func(c *gin.Context) {
		// an toàn: chỉ gửi thật khi thân có đúng dryRun = false; thiếu / khác (kể cả thân rỗng) = chạy thử
		dry := true
		if m := middleware.BodyMap(c); m != nil {
			dry = !jsval.StrictEquals(m.Val("dryRun"), false)
		}
		r, err := s.nhacGiaHan(c.Request.Context(), actor.FromGin(c), dry)
		response.Result(c, r, err)
	})
	g.PATCH("/:id", middleware.RequireAdmin(), func(c *gin.Context) {
		r, err := s.UpdateCongTy(c.Request.Context(), actor.FromGin(c), c.Param("id"), bodyData(c))
		response.Result(c, r, err)
	})
	g.DELETE("/:id", middleware.RequireSuper(), func(c *gin.Context) {
		r, err := s.DeleteCongTy(c.Request.Context(), actor.FromGin(c), c.Param("id"))
		response.Result(c, r, err)
	})
	g.GET("/:id/users", middleware.RequireSuper(), func(c *gin.Context) {
		r, err := s.ListCongTyUsers(c.Request.Context(), actor.FromGin(c), c.Param("id"))
		response.Result(c, r, err)
	})
	g.POST("/:id/users", middleware.RequireSuper(), func(c *gin.Context) {
		r, err := s.CreateCongTyUser(c.Request.Context(), actor.FromGin(c), c.Param("id"), bodyData(c))
		response.Result(c, r, err)
	})
}
