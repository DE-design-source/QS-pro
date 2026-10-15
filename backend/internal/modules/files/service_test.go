package files

import (
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/config"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Giá trị mong đợi trong testdata/golden.json do testdata/gen.js ghi lại từ server/lark.js và handler /media THẬT của Node,
// chạy với cùng một Lark giả như dưới đây. Không test nào gọi Lark thật.

func loadGolden(t *testing.T) *omap.Map {
	t.Helper()
	raw, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(raw)
	if err != nil {
		t.Fatal(err)
	}
	return jsval.AsMap(v)
}

// larkGia: server Lark giả, cùng hành vi với larkSrv trong testdata/gen.js.
type larkGia struct {
	mu   sync.Mutex
	fake *omap.Map // {token: {status, body}, media: {status, ctype, b64}}
	seen []any
	srv  *httptest.Server
}

func newLarkGia(t *testing.T) *larkGia {
	l := &larkGia{}
	l.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		l.mu.Lock()
		defer l.mu.Unlock()
		url := r.URL.EscapedPath()
		if r.URL.RawQuery != "" {
			url += "?" + r.URL.RawQuery
		}
		hdr := func(k string) any {
			if v := r.Header.Get(k); v != "" {
				return v
			}
			return nil
		}
		// các header fetch của Node tự gắn
		fetchHdr := func(m *omap.Map) *omap.Map {
			return m.Set("userAgent", hdr("User-Agent")).Set("accept", hdr("Accept")).
				Set("acceptLanguage", hdr("Accept-Language")).Set("secFetchMode", hdr("Sec-Fetch-Mode"))
		}
		if r.Method == http.MethodPost && url == "/open-apis/auth/v3/tenant_access_token/internal" {
			l.seen = append(l.seen, fetchHdr(omap.Of("method", r.Method, "url", url, "contentType", hdr("Content-Type"), "body", string(body))))
			tk := jsval.AsMap(l.fake.Val("token"))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(int(jsval.ToNumber(tk.Val("status"))))
			_, _ = io.WriteString(w, jsval.AsString(tk.Val("body")))
			return
		}
		// Node đọc giá trị header theo Latin-1 (1 byte = 1 ký tự)
		var auth any
		if v := r.Header.Get("Authorization"); v != "" {
			rs := make([]rune, len(v))
			for i := 0; i < len(v); i++ {
				rs[i] = rune(v[i])
			}
			auth = string(rs)
		}
		l.seen = append(l.seen, fetchHdr(omap.Of("method", r.Method, "url", url, "authorization", auth)))
		md := jsval.AsMap(l.fake.Val("media"))
		w.Header()["Content-Type"] = nil // không cho net/http tự đoán content-type
		switch ct := md.Val("ctype").(type) {
		case string:
			w.Header().Set("Content-Type", ct)
		case []any: // nhiều dòng header content-type
			for _, x := range ct {
				w.Header().Add("Content-Type", jsval.AsString(x))
			}
		}
		if loc, ok := md.Val("location").(string); ok {
			w.Header().Set("Location", loc)
		}
		w.WriteHeader(int(jsval.ToNumber(md.Val("status"))))
		buf, _ := base64.StdEncoding.DecodeString(jsval.AsString(md.Val("b64")))
		_, _ = w.Write(buf)
	}))
	t.Cleanup(l.srv.Close)
	return l
}

func (l *larkGia) set(fake *omap.Map) {
	l.mu.Lock()
	l.fake, l.seen = fake, []any{}
	l.mu.Unlock()
}

func (l *larkGia) requests() []any {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.seen
}

func js(t *testing.T, v any) string {
	t.Helper()
	s, err := omap.MarshalString(v)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

// lark.mediaDownload + cache token: từng bước phải cho cùng kết quả VÀ cùng các request gửi tới Lark như Node.
func TestMediaDownloadGolden(t *testing.T) {
	lark := newLarkGia(t)
	for _, scv := range jsval.AsArray(loadGolden(t).Val("lark")) {
		sc := jsval.AsMap(scv)
		name := jsval.AsString(sc.Val("name"))
		domain := lark.srv.URL
		if d, ok := sc.Val("domain").(string); ok {
			domain = d
		}
		svc := New(Deps{Cfg: &config.Config{LarkDomain: domain, LarkAppID: jsval.AsString(sc.Val("appId")), LarkAppSecret: jsval.AsString(sc.Val("secret"))}})
		for i, stv := range jsval.AsArray(sc.Val("steps")) {
			st := jsval.AsMap(stv)
			lark.set(jsval.AsMap(st.Val("fake")))
			buf, ct, err := svc.MediaDownload(context.Background(), jsval.AsString(st.Val("fileToken")))
			var got *omap.Map
			if err != nil {
				got = omap.Of("error", err.Error())
			} else {
				got = omap.Of("contentType", ct, "b64", base64.StdEncoding.EncodeToString(buf))
			}
			if g, w := js(t, got), js(t, st.Val("result")); g != w {
				t.Errorf("%s bước %d: kết quả\n go:   %s\n node: %s", name, i, g, w)
			}
			if g, w := js(t, lark.requests()), js(t, st.Val("requests")); g != w {
				t.Errorf("%s bước %d: request tới Lark\n go:   %s\n node: %s", name, i, g, w)
			}
		}
	}
}

// mediaApp: server HTTP thật gọi thẳng handler /media.
func mediaApp(svc *Service, engine *gin.Engine) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := gin.CreateTestContextOnly(w, engine)
		c.Request = r
		svc.media(c)
	}))
}

// rawRequest: gửi đúng chuỗi đường dẫn như http.request của Node (kể cả "#...", net/http bình thường sẽ cắt mất).
func rawRequest(t *testing.T, method, base, target string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(method, base, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.URL.Opaque = target
	return req
}

func resGolden(res *http.Response, body []byte) *omap.Map {
	hdr := func(k string) any {
		if v := res.Header.Get(k); v != "" {
			return v
		}
		return nil
	}
	return omap.Of("status", float64(res.StatusCode), "contentType", hdr("Content-Type"), "cacheControl", hdr("Cache-Control"),
		"etag", hdr("ETag"), "contentLength", hdr("Content-Length"), "b64", base64.StdEncoding.EncodeToString(body))
}

// ?token[toString]=x khi chưa có token trong cache: Node xin tenant token trước rồi mới ném lỗi -> Go cũng phải gọi Lark 1 lần.
func TestMediaRouteTokenTruocKhiLoi(t *testing.T) {
	gin.SetMode(gin.TestMode)
	lark := newLarkGia(t)
	svc := New(Deps{Cfg: &config.Config{LarkDomain: lark.srv.URL, LarkAppID: "cli_x", LarkAppSecret: "sec"}})
	app := mediaApp(svc, gin.New())
	defer app.Close()
	fr := jsval.AsMap(loadGolden(t).Val("fresh"))
	lark.set(omap.Of(
		"token", omap.Of("status", 200.0, "body", `{"code":0,"msg":"ok","tenant_access_token":"t-abc123","expire":7200}`),
		"media", omap.Of("status", 200.0, "ctype", "image/png", "b64", "AAEC")))
	res, err := (&http.Client{}).Do(rawRequest(t, "GET", app.URL, jsval.AsString(fr.Val("url"))))
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if g, w := js(t, resGolden(res, body)), js(t, fr.Val("res")); g != w {
		t.Errorf("phản hồi\n go:   %s\n node: %s", g, w)
	}
	if g, w := js(t, lark.requests()), js(t, fr.Val("requests")); g != w {
		t.Errorf("request tới Lark\n go:   %s\n node: %s", g, w)
	}
	if svc.token == nil {
		t.Error("token phải được giữ lại trong cache")
	}
}

// Thân phản hồi đứng yên quá bodyTimeout thì bị huỷ (undici: bodyTimeout), không treo mãi.
func TestBodyTimeout(t *testing.T) {
	stop := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_, _ = io.WriteString(w, `{"code":`)
		w.(http.Flusher).Flush()
		select {
		case <-stop:
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()
	defer close(stop)
	svc := New(Deps{Cfg: &config.Config{LarkDomain: srv.URL, LarkAppID: "a", LarkAppSecret: "b"}})
	svc.bodyTimeout = 100 * time.Millisecond
	done := make(chan error, 1)
	go func() {
		_, _, err := svc.MediaDownload(context.Background(), "f")
		done <- err
	}()
	select {
	case err := <-done:
		if err == nil || err.Error() != "terminated" {
			t.Fatalf("lỗi = %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("request treo, không bị huỷ")
	}
}

// GET /media: mã trạng thái, header và thân phải giống handler Express của Node (kể cả ETag, 304, cách đọc query).
func TestMediaRouteGolden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	lark := newLarkGia(t)
	svc := New(Deps{Cfg: &config.Config{LarkDomain: lark.srv.URL, LarkAppID: "cli_x", LarkAppSecret: "sec"}})
	engine := gin.New()
	svc.RegisterRoot(&engine.RouterGroup)
	if rs := engine.Routes(); len(rs) != 1 || rs[0].Method != "GET" || rs[0].Path != "/media" {
		t.Fatalf("RegisterRoot phải gắn đúng GET /media, có: %+v", rs)
	}
	// Gọi thẳng handler qua server HTTP thật để HEAD cũng tới được (server chính tự chuyển HEAD sang handler GET)
	app := mediaApp(svc, engine)
	defer app.Close()
	client := &http.Client{Transport: &http.Transport{DisableCompression: true}}
	tokenOK := omap.Of("status", 200.0, "body", `{"code":0,"msg":"ok","tenant_access_token":"t-abc123","expire":7200}`)

	for i, cv := range jsval.AsArray(loadGolden(t).Val("http")) {
		c := jsval.AsMap(cv)
		lark.set(omap.Of("token", tokenOK, "media", c.Val("media")))
		req := rawRequest(t, jsval.AsString(c.Val("method")), app.URL, jsval.AsString(c.Val("url")))
		jsval.AsMap(c.Val("headers")).Each(func(k string, v any) { req.Header.Set(k, jsval.AsString(v)) })
		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("ca %d %v: %v", i, c.Val("url"), err)
		}
		body, _ := io.ReadAll(res.Body)
		res.Body.Close()
		got := resGolden(res, body)
		if g, w := js(t, got), js(t, c.Val("res")); g != w {
			t.Errorf("ca %d %v %v %s:\n go:   %s\n node: %s", i, c.Val("method"), c.Val("url"), js(t, c.Val("headers")), g, w)
		}
		urls := []any{}
		for _, r := range lark.requests() {
			if m := jsval.AsMap(r); m.Val("method") == "GET" {
				urls = append(urls, m.Val("url"))
			}
		}
		if g, w := js(t, urls), js(t, c.Val("larkUrls")); g != w {
			t.Errorf("ca %d %v: URL gọi Lark\n go:   %s\n node: %s", i, c.Val("url"), g, w)
		}
	}
}

// Hai request cùng lúc không được làm hỏng cache token (chạy với -race).
func TestTenantTokenConcurrent(t *testing.T) {
	lark := newLarkGia(t)
	lark.set(omap.Of(
		"token", omap.Of("status", 200.0, "body", `{"code":0,"tenant_access_token":"t-1","expire":7200}`),
		"media", omap.Of("status", 200.0, "ctype", "image/png", "b64", "AAEC")))
	svc := New(Deps{Cfg: &config.Config{LarkDomain: lark.srv.URL, LarkAppID: "a", LarkAppSecret: "b"}})
	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, _, err := svc.MediaDownload(context.Background(), "f"); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if _, _, err := svc.MediaDownload(context.Background(), "f"); err != nil {
		t.Fatal(err)
	}
	n := 0
	for _, r := range lark.requests() {
		if jsval.AsMap(r).Val("method") == "POST" {
			n++
		}
	}
	if n < 1 || n > 16 {
		t.Fatalf("số lần xin token = %d", n)
	}
}

// Hạn của token Lark (lark.js:10-11, 20): dùng lại khi còn HƠN 60 giây, còn đúng 60 giây trở xuống thì xin lại; force
// luôn xin lại; expire thiếu / 0 / không phải số -> 7200 giây, chuỗi số thì dùng như số. Cột token và "số lần xin" lấy
// từ tenantToken của Node chạy với Date.now và fetch giả, cùng các mốc thời gian (ms) dưới đây.
func TestTenantTokenExpiryWindow(t *testing.T) {
	var mu sync.Mutex
	expire, posts := "100", 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		posts++
		_, _ = io.WriteString(w, `{"code":0,"tenant_access_token":"t-`+strconv.Itoa(posts)+`","expire":`+expire+`}`)
	}))
	defer srv.Close()
	svc := New(Deps{Cfg: &config.Config{LarkDomain: srv.URL, LarkAppID: "a", LarkAppSecret: "b"}})
	const t0 = 1700000000000.0
	now := t0
	svc.now = func() float64 { return now }
	for _, c := range []struct {
		name   string
		dt     float64 // ms kể từ t0
		force  bool
		expire string // JSON của trường expire nếu lần này phải xin token ("" = giữ như trước)
		want   string
		posts  int
	}{
		{"lần đầu", 0, false, "100", "t-1", 1},
		{"ngay sau", 1, false, "", "t-1", 0},
		{"còn 61 giây", 39000, false, "", "t-1", 0},
		{"còn 60 giây + 1 ms", 39999, false, "", "t-1", 0},
		{"còn đúng 60 giây (biên)", 40000, false, "100", "t-2", 1},
		{"token mới còn 61 giây", 79000, false, "", "t-2", 0},
		{"token mới còn 59 giây", 81000, false, "100", "t-3", 1},
		{"force khi còn hạn", 82000, true, "100", "t-4", 1},
		{"sau force", 83000, false, "", "t-4", 0},
		{"đã hết hạn", 300000, false, "0", "t-5", 1},
		{"expire 0 -> 7200 giây: còn 61 giây", 7439000, false, "", "t-5", 0},
		{"expire 0 -> 7200 giây: còn 59 giây", 7441000, false, `"120"`, "t-6", 1},
		{"expire chuỗi 120: còn 61 giây", 7500000, false, "", "t-6", 0},
		{"expire chuỗi 120: còn 60 giây", 7501000, false, `"abc"`, "t-7", 1},
		{"expire abc -> 7200 giây: còn 61 giây", 14640000, false, "", "t-7", 0},
		{"expire abc -> 7200 giây: còn 59 giây", 14642000, false, "null", "t-8", 1},
		{"expire null -> 7200 giây: còn 3601 giây", 18241000, false, "", "t-8", 0},
	} {
		mu.Lock()
		if c.expire != "" {
			expire = c.expire
		}
		before := posts
		mu.Unlock()
		now = t0 + c.dt
		got, err := svc.tenantToken(context.Background(), c.force)
		mu.Lock()
		n := posts - before
		mu.Unlock()
		if err != nil || got != c.want || n != c.posts {
			t.Errorf("%s: token %v, xin %d lần (lỗi %v); Node: %s, %d lần", c.name, got, n, err, c.want, c.posts)
		}
	}
}
