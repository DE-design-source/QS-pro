// Package middleware: xác thực, ngữ cảnh công ty, phân quyền, CORS, giới hạn tần suất, đọc thân JSON.
// Thông báo và mã trạng thái giữ đúng như dispatcher /api/:fn của server/index.js.
package middleware

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"sync"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/response"
)

// SessionResolver: token -> người đăng nhập (auth.sessionActor của Node: token hợp lệ + tài khoản còn mở /
// đúng vai trò trong DB). Trả nil, nil khi token sai / hết hạn / tài khoản bị khoá. Module auth cài đặt.
type SessionResolver interface {
	SessionActor(ctx context.Context, token string) (*actor.Actor, error)
}

// SessionHolder: chỗ cắm SessionResolver, gắn sau khi module auth được tạo.
// Chưa gắn thì mọi token đều coi như chưa đăng nhập (không panic).
type SessionHolder struct {
	mu sync.RWMutex
	r  SessionResolver
}

// NewSessionHolder tạo holder rỗng.
func NewSessionHolder() *SessionHolder { return &SessionHolder{} }

// Set gắn resolver thật.
func (h *SessionHolder) Set(r SessionResolver) {
	h.mu.Lock()
	h.r = r
	h.mu.Unlock()
}

// SessionActor chuyển tiếp cho resolver đã gắn; chưa gắn -> nil, nil.
func (h *SessionHolder) SessionActor(ctx context.Context, token string) (*actor.Actor, error) {
	if h == nil {
		return nil, nil
	}
	h.mu.RLock()
	r := h.r
	h.mu.RUnlock()
	if r == nil {
		return nil, nil
	}
	return r.SessionActor(ctx, token)
}

var reBearer = regexp.MustCompile(`(?i)^Bearer\s+`)

// BearerToken: header Authorization sau khi bỏ tiền tố "Bearer " (không phân biệt hoa thường).
func BearerToken(r *http.Request) string {
	return reBearer.ReplaceAllString(r.Header.Get("Authorization"), "")
}

// SessionStoreError: kho phiên đăng nhập không dùng được vì cấu trúc database (vd chưa chạy migration 0014 -
// thiếu bảng user_sessions). ActorOf trả 500 kèm thông báo đích danh và dừng request, thay vì coi như chưa
// đăng nhập (401 mù mờ, giao diện chỉ thấy "Phiên đã hết").
type SessionStoreError struct{ Msg string }

func (e *SessionStoreError) Error() string { return e.Msg }

// ActorOf: người đăng nhập của request (actorOf_ của Node). Token lấy từ header Authorization,
// không có thì từ body.token. Lỗi khi kiểm tra phiên -> ghi log và coi như chưa đăng nhập;
// riêng SessionStoreError -> trả 500 + thông báo và c.Abort() (nơi gọi phải kiểm c.IsAborted()).
func ActorOf(c *gin.Context, s SessionResolver) *actor.Actor {
	var tok any = BearerToken(c.Request)
	if tok == "" {
		tok = BodyMap(c).Val("token")
	}
	str, ok := tok.(string) // token không phải chuỗi: verifyToken trả null
	if !ok || str == "" || s == nil {
		return nil
	}
	a, err := s.SessionActor(context.WithoutCancel(c.Request.Context()), str)
	if err != nil {
		logger.Error("auth", "kiểm tra phiên lỗi:", err.Error())
		var se *SessionStoreError
		if errors.As(err, &se) {
			response.Fail(c, 500, se.Msg)
		}
		return nil
	}
	return a
}

// Auth xác định người đăng nhập và gắn vào gin.Context (actor.FromGin). KHÔNG chặn request chưa đăng nhập -
// việc chặn là của RequireLogin / RequireAdmin / RequireSuper.
func Auth(s SessionResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor.Set(c, ActorOf(c, s))
	}
}
