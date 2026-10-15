package storage

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUpload(t *testing.T) {
	var got *http.Request
	var body string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r
		b, _ := io.ReadAll(r.Body)
		body = string(b)
		if strings.Contains(r.URL.Path, "loi") {
			w.WriteHeader(400)
			_, _ = w.Write([]byte(strings.Repeat("x", 300)))
		}
	}))
	defer srv.Close()

	s := New(srv.URL+"///", "khoa", "kho")
	url, err := s.Upload(context.Background(), []byte("abc"), "sp/ảnh 1.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	want := srv.URL + "/storage/v1/object/public/kho/sp%2F%E1%BA%A3nh%201.png"
	if url != want {
		t.Errorf("url:\n got %s\nwant %s", url, want)
	}
	if got.Method != "POST" || got.URL.EscapedPath() != "/storage/v1/object/kho/sp%2F%E1%BA%A3nh%201.png" || body != "abc" {
		t.Errorf("request: %s %s %q", got.Method, got.URL.EscapedPath(), body)
	}
	if got.Header.Get("apikey") != "khoa" || got.Header.Get("Authorization") != "Bearer khoa" || got.Header.Get("Content-Type") != "image/png" || got.Header.Get("x-upsert") != "true" {
		t.Errorf("header: %v", got.Header)
	}
	if _, err := s.Upload(context.Background(), []byte("a"), "a.jpg", ""); err != nil || got.Header.Get("Content-Type") != "image/jpeg" {
		t.Errorf("content type mặc định: %v %s", err, got.Header.Get("Content-Type"))
	}
	_, err = s.Upload(context.Background(), []byte("a"), "loi.jpg", "")
	if err == nil || err.Error() != "Storage upload -> 400 "+strings.Repeat("x", 200) {
		t.Errorf("lỗi: %v", err)
	}
	down := New("http://127.0.0.1:9", "", "")
	if _, err := down.Upload(context.Background(), []byte("a"), "a.jpg", ""); err == nil || err.Error() != "fetch failed" {
		t.Errorf("lỗi mạng: %v", err)
	}
	def := New("", "", "")
	if def.URL() != DefaultURL || def.Bucket() != DefaultBucket {
		t.Error("mặc định sai")
	}
}

// Kho trả chuyển hướng: fetch() của Node theo tối đa 20 lần rồi báo "fetch failed" (21 request), và từ lần chuyển hướng
// đầu (POST -> GET) không còn gửi Content-Type. Số liệu lấy từ server Node thật qua bộ so sánh vi sai.
func TestUploadRedirectNhuFetch(t *testing.T) {
	n, ct := 0, []string{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n++
		ct = append(ct, r.Method+" "+r.Header.Get("Content-Type"))
		w.Header().Set("Location", "/storage/v1/object/kho/khac")
		w.WriteHeader(302)
	}))
	defer srv.Close()
	_, err := New(srv.URL, "khoa", "kho").Upload(context.Background(), []byte("abc"), "a.png", "image/png")
	if err == nil || err.Error() != "fetch failed" {
		t.Errorf("lỗi: %v", err)
	}
	if n != 21 {
		t.Errorf("số request = %d, muốn 21", n)
	}
	if len(ct) < 2 || ct[0] != "POST image/png" || ct[1] != "GET " {
		t.Errorf("header qua chuyển hướng: %v", ct)
	}
}
