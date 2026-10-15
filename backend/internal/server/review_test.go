package server

import (
	"bytes"
	"compress/gzip"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// Các ca lấy từ đợt đối chiếu với Express 4.22 thật (server/index.js).

func TestExpressRouteMatching(t *testing.T) {
	s := newTestServer(t)
	// HEAD dùng handler của GET (máy theo dõi uptime hay gọi HEAD /healthz)
	w := do(s, req{method: "HEAD", path: "/healthz"})
	if w.Code != 200 || w.Header().Get("ETag") == "" || w.Header().Get("Content-Length") != "11" {
		t.Errorf("HEAD /healthz: %d %v", w.Code, w.Header())
	}
	expect(t, "GET /healthz/", do(s, req{method: "GET", path: "/healthz/"}), 200, `{"ok":true}`)
	expect(t, "GET /HEALTHZ", do(s, req{method: "GET", path: "/HEALTHZ"}), 200, `{"ok":true}`)
	expect(t, "POST /API/adminOnly/", do(s, req{path: "/API/adminOnly/", token: "a"}), 200, `{"ok":true,"result":"ok"}`)
	// tên hàm giữ nguyên hoa thường
	expect(t, "POST /api/ADMINONLY", do(s, req{path: "/api/ADMINONLY", token: "a"}), 404, `{"error":"Không hỗ trợ hàm: ADMINONLY"}`)
	expect(t, "POST /api/a%2Fb", do(s, req{path: "/api/a%2Fb"}), 404, `{"error":"Không hỗ trợ hàm: a/b"}`)
	if w := do(s, req{path: "/api/%ff"}); w.Code != 400 || w.Header().Get("x-app-ver") != "" {
		t.Errorf("/api/%%ff: %d %s", w.Code, w.Body.String())
	}
	w = do(s, req{method: "GET", path: "/khong/co"})
	if w.Code != 404 || !bytes.Contains(w.Body.Bytes(), []byte("<pre>Cannot GET /khong/co</pre>")) {
		t.Errorf("404: %d %s", w.Code, w.Body.String())
	}
	w = do(s, req{method: "HEAD", path: "/khong/co"})
	if w.Code != 404 || !bytes.Contains(w.Body.Bytes(), []byte("<pre>Cannot HEAD /khong/co</pre>")) {
		t.Errorf("404 HEAD: %d %s", w.Code, w.Body.String())
	}
	// Cache-Control có no-cache lẫn chỉ thị khác -> không 304
	tag := do(s, req{method: "GET", path: "/healthz"}).Header().Get("ETag")
	if w := do(s, req{method: "GET", path: "/healthz", hdr: map[string]string{"If-None-Match": tag}}); w.Code != 304 {
		t.Errorf("If-None-Match: %d", w.Code)
	}
	if w := do(s, req{method: "GET", path: "/healthz", hdr: map[string]string{"If-None-Match": tag, "Cache-Control": "max-age=0, no-cache"}}); w.Code != 200 {
		t.Errorf("no-cache: %d", w.Code)
	}
}

func TestBodyParserEdges(t *testing.T) {
	s := newTestServer(t)
	echo := `{"ok":true,"result":{"z":1,"a":true,"n":1}}`
	empty := `{"ok":true,"result":{"z":null,"a":true,"n":0}}`
	expect(t, "BOM", do(s, req{path: "/api/pub", body: "\xEF\xBB\xBF" + `{"args":[1]}`}), 200, echo)

	var gz bytes.Buffer
	zw := gzip.NewWriter(&gz)
	_, _ = zw.Write([]byte(`{"args":[1]}`))
	_ = zw.Close()
	expect(t, "gzip", do(s, req{path: "/api/pub", body: gz.String(), hdr: map[string]string{"Content-Encoding": "gzip"}}), 200, echo)
	if w := do(s, req{path: "/api/pub", body: `{"args":[1]}`, hdr: map[string]string{"Content-Encoding": "br"}}); w.Code != 415 {
		t.Errorf("br: %d", w.Code)
	}
	if w := do(s, req{path: "/api/pub", body: `{"args":[1]}`, ctype: "application/json; charset=iso-8859-1"}); w.Code != 415 {
		t.Errorf("iso-8859-1: %d", w.Code)
	}
	if w := do(s, req{path: "/api/pub", body: `{"args":[1]}`, ctype: "application/json; charset=utf-16"}); w.Code != 400 {
		t.Errorf("utf-16: %d", w.Code)
	}
	expect(t, "charset UTF-8", do(s, req{path: "/api/pub", body: `{"args":[1]}`, ctype: "application/json; charset=UTF-8"}), 200, echo)
	// Content-Type sai cú pháp: body-parser không đọc thân
	expect(t, "ctype ;", do(s, req{path: "/api/pub", body: `{"args":[1]}`, ctype: "application/json;"}), 200, empty)
	expect(t, "ctype ; foo", do(s, req{path: "/api/pub", body: `{"args":[1]}`, ctype: "application/json; foo"}), 200, empty)
	// byte không phải UTF-8: chuỗi cụt tính là MỘT U+FFFD
	expect(t, "utf-8 hỏng", do(s, req{path: "/api/pub", body: "{\"args\":[\"a\xff\xfeb\xe2\x82\"]}"}), 200,
		"{\"ok\":true,\"result\":{\"z\":\"a��b�\",\"a\":true,\"n\":1}}")
}

func TestStaticLikeSend(t *testing.T) {
	s := newTestServer(t)
	dir := s.deps.Cfg.StaticDir
	for _, p := range []string{".well-known", "sub", filepath.Join("sub", ".git")} {
		if err := os.MkdirAll(filepath.Join(dir, p), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	for p, body := range map[string]string{".well-known/x.txt": "wk", "sub/.hidden": "h", "sub/.git/config.txt": "cfg", "notes.md": "# a", "../outside.txt": "out"} {
		if err := os.WriteFile(filepath.Join(dir, filepath.FromSlash(p)), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	get := func(path string, hdr map[string]string) *httptest.ResponseRecorder {
		q := httptest.NewRequest("GET", "/", nil)
		q.URL.Path, q.URL.RawPath, q.RequestURI = path, "", path // giữ nguyên ".." (httptest không chuẩn hoá)
		for k, v := range hdr {
			q.Header.Set(k, v)
		}
		w := httptest.NewRecorder()
		s.Engine().ServeHTTP(w, q)
		return w
	}
	for path, want := range map[string]int{
		"/.well-known/x.txt":     200, // chỉ xét đoạn cuối
		"/sub/.git/config.txt":   200,
		"/sub/.hidden":           404,
		"/.secret":               404,
		"/sub/../app.js":         200,
		"/../outside.txt":        404,
		"/sub/../../outside.txt": 404,
	} {
		if w := get(path, nil); w.Code != want {
			t.Errorf("%s: %d, muốn %d", path, w.Code, want)
		}
	}
	if ct := get("/notes.md", nil).Header().Get("Content-Type"); ct != "text/markdown; charset=UTF-8" {
		t.Errorf(".md: %s", ct)
	}
	w := do(s, req{method: "GET", path: "/sub?x=1&y=<"})
	if w.Code != 301 || w.Header().Get("Location") != "/sub/?x=1&y=%3C" {
		t.Errorf("301: %d %s", w.Code, w.Header().Get("Location"))
	}
	first := get("/app.js", nil)
	cond := map[string]string{"If-None-Match": first.Header().Get("ETag")}
	if w := get("/app.js", cond); w.Code != http.StatusNotModified || w.Header().Get("Accept-Ranges") != "bytes" {
		t.Errorf("304: %d %v", w.Code, w.Header())
	}
	cond["Cache-Control"] = "no-cache"
	if w := get("/app.js", cond); w.Code != 200 {
		t.Errorf("no-cache: %d", w.Code)
	}
}
