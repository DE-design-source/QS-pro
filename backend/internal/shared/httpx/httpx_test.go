package httpx

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// may: server đếm request; đường dẫn /dut thì cắt kết nối không trả lời.
func may(t *testing.T) (*httptest.Server, func() []string) {
	t.Helper()
	var mu sync.Mutex
	var log []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		mu.Lock()
		log = append(log, r.Method+" "+r.URL.Path+" cl="+r.Header.Get("Content-Length")+" te="+strings.Join(r.TransferEncoding, ",")+" body="+string(b))
		mu.Unlock()
		switch r.URL.Path {
		case "/dut":
			c, _, _ := w.(http.Hijacker).Hijack()
			c.Close()
		case "/307":
			http.Redirect(w, r, "/ok", http.StatusTemporaryRedirect)
		default:
			_, _ = w.Write([]byte("ok"))
		}
	}))
	t.Cleanup(srv.Close)
	return srv, func() []string { mu.Lock(); defer mu.Unlock(); out := log; log = nil; return out }
}

func get(t *testing.T, cl *http.Client, url string) error {
	t.Helper()
	res, err := cl.Get(url)
	if err != nil {
		return err
	}
	_, _ = io.Copy(io.Discard, res.Body)
	return res.Body.Close()
}

// Hồi quy bước "Lark: media đứt kết nối" của bộ so vi sai: Node gửi 1 GET, Go (transport mặc định) gửi 2.
func TestOneShotKhongGuiLai(t *testing.T) {
	srv, take := may(t)
	for _, c := range []struct {
		ten  string
		rt   http.RoundTripper
		want int
	}{{"mặc định của net/http", &http.Transport{}, 2}, {"OneShot", OneShot(&http.Transport{}), 1}} {
		cl := &http.Client{Transport: c.rt}
		if err := get(t, cl, srv.URL+"/ok"); err != nil { // mở kết nối keep-alive
			t.Fatalf("%s: %v", c.ten, err)
		}
		take()
		if err := get(t, cl, srv.URL+"/dut"); err == nil {
			t.Fatalf("%s: kết nối bị cắt mà không lỗi", c.ten)
		}
		if got := take(); len(got) != c.want {
			t.Errorf("%s: server nhận %d request %v, muốn %d", c.ten, len(got), got, c.want)
		}
	}
}

// Trên dây không đổi (không Content-Length, không chunked, thân rỗng) và chuyển hướng 307 vẫn đi tiếp.
func TestOneShotGiuNguyenRequest(t *testing.T) {
	srv, take := may(t)
	cl := &http.Client{Transport: OneShot(&http.Transport{})}
	if err := get(t, cl, srv.URL+"/307"); err != nil {
		t.Fatal(err)
	}
	got := strings.Join(take(), "\n")
	if want := "GET /307 cl= te= body=\nGET /ok cl= te= body="; got != want {
		t.Errorf("request:\n%s\nmuốn:\n%s", got, want)
	}
	res, err := cl.Post(srv.URL+"/ok", "text/plain", strings.NewReader("abc"))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if got := strings.Join(take(), "\n"); got != "POST /ok cl=3 te= body=abc" {
		t.Errorf("POST: %s", got)
	}
}
