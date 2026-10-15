package rpc

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/middleware"
	"qspro-backend/internal/shared/actor"
)

type khoPhienHong struct{}

func (khoPhienHong) SessionActor(context.Context, string) (*actor.Actor, error) {
	return nil, &middleware.SessionStoreError{Msg: "thiếu bảng user_sessions"}
}

// Kho phiên hỏng (chưa chạy migration 0014): /api/:fn trả đúng MỘT thân 500 kèm thông báo, hàm không chạy -
// kể cả hàm công khai (login).
func TestHandleSessionStoreError(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	r := NewRegistry()
	chay := 0
	h := func(context.Context, *actor.Actor, Args) (any, error) { chay++; return 1, nil }
	r.Register("me", Login, h)
	r.Register("login", Public, h)
	e := gin.New()
	e.POST("/api/:fn", r.Handle(khoPhienHong{}, "v"))
	for _, fn := range []string{"me", "login"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/"+fn, strings.NewReader(`{"args":[]}`))
		req.Header.Set("Authorization", "Bearer abc.def")
		e.ServeHTTP(w, req)
		if w.Code != 500 || w.Body.String() != `{"error":"thiếu bảng user_sessions"}` {
			t.Errorf("%s: %d %s", fn, w.Code, w.Body.String())
		}
	}
	if chay != 0 {
		t.Errorf("hàm vẫn chạy %d lần", chay)
	}
}
