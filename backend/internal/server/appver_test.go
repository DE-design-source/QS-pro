package server

import (
	"strings"
	"testing"

	"qspro-backend/internal/config"
)

// M1.1: REST /api/v1 gửi header x-app-ver cùng giá trị với cổng /api/:fn (kể cả khi bị chặn 401 / 403),
// và CORS cho trình duyệt ở origin khác đọc được header này.
func TestAppVerHeaderREST(t *testing.T) {
	s := newTestServer(t)
	rpcVer := do(s, req{path: "/api/khongCo", body: `{"args":[]}`}).Header().Get("x-app-ver")
	if rpcVer != "ver-1" {
		t.Fatalf("rpc x-app-ver = %q", rpcVer)
	}
	cases := []struct {
		name   string
		r      req
		status int
	}{
		{"chưa đăng nhập", req{method: "GET", path: "/api/v1/auth/me"}, 401},
		{"sai quyền", req{method: "GET", path: "/api/v1/companies", token: "u"}, 403},
	}
	for _, c := range cases {
		w := do(s, c.r)
		if w.Code != c.status {
			t.Errorf("%s: status %d, muốn %d (%s)", c.name, w.Code, c.status, w.Body.String())
		}
		if got := w.Header().Get("x-app-ver"); got != rpcVer {
			t.Errorf("%s: x-app-ver = %q, muốn %q như /api/:fn", c.name, got, rpcVer)
		}
	}
	// đường dẫn /api/v1 không có route: 404 do NoRoute trả, vẫn phải có header như rpc gọi hàm không có
	for _, p := range []string{"/api/v1/zz-khong-co", "/api/v1"} {
		w := do(s, req{method: "GET", path: p})
		if w.Code != 404 || w.Header().Get("x-app-ver") != rpcVer {
			t.Errorf("%s: status %d, x-app-ver %q, muốn 404 + %q", p, w.Code, w.Header().Get("x-app-ver"), rpcVer)
		}
	}
	// route ngoài /api/v1 không đổi hành vi: /healthz và 404 ngoài /api/v1 không có header
	for _, p := range []string{"/healthz", "/zz-khong-co", "/api/v10"} {
		if got := do(s, req{method: "GET", path: p}).Header().Get("x-app-ver"); got != "" {
			t.Errorf("%s không được có x-app-ver, được %q", p, got)
		}
	}
}

func TestAppVerHeaderCORSExpose(t *testing.T) {
	cfg := &config.Config{AppVer: "ver-2", CORSOrigins: []string{"http://localhost:5161"}}
	s := New(&Deps{Cfg: cfg})
	s.deps.Sessions.Set(fakeSessions{})
	w := do(s, req{method: "GET", path: "/api/v1/auth/me", token: "zzz", hdr: map[string]string{"Origin": "http://localhost:5161"}})
	if w.Code != 401 || w.Header().Get("x-app-ver") != "ver-2" {
		t.Errorf("status %d, x-app-ver %q", w.Code, w.Header().Get("x-app-ver"))
	}
	exp := strings.Split(w.Header().Get("Access-Control-Expose-Headers"), ",")
	ok := false
	for _, h := range exp {
		if strings.EqualFold(strings.TrimSpace(h), "x-app-ver") {
			ok = true
		}
	}
	if !ok || w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5161" {
		t.Errorf("CORS phải cho đọc x-app-ver: %v", w.Header())
	}
}
