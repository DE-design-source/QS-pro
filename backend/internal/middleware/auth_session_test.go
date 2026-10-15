package middleware

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/response"
)

type loiPhien struct{ err error }

func (l loiPhien) SessionActor(context.Context, string) (*actor.Actor, error) { return nil, l.err }

// Kho phiên hỏng (chưa chạy migration 0014) -> 500 kèm thông báo đích danh, dừng chuỗi handler;
// lỗi thường của database -> vẫn coi như chưa đăng nhập (401) như trước.
func TestActorOfSessionStoreError(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	for _, c := range []struct {
		err  error
		code int
		body string
	}{
		{&SessionStoreError{Msg: "thiếu bảng user_sessions"}, 500, `{"error":"thiếu bảng user_sessions"}`},
		{errors.New("mất kết nối"), 401, `{"error":"Chưa đăng nhập","code":"NOAUTH"}`},
	} {
		e := gin.New()
		chay := false
		e.GET("/x", Auth(loiPhien{c.err}), RequireLogin(), func(ctx *gin.Context) {
			chay = true
			response.OK(ctx, 1)
		})
		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/x", nil)
		r.Header.Set("Authorization", "Bearer abc.def")
		e.ServeHTTP(w, r)
		if w.Code != c.code || w.Body.String() != c.body || chay {
			t.Errorf("%v: %d %s (handler chạy: %v)", c.err, w.Code, w.Body.String(), chay)
		}
	}
}
