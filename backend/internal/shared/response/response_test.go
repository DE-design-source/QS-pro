package response

import (
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/shared/omap"
)

// danhMuc: mảng n object cùng dạng một sản phẩm của getProducts (chuỗi tiếng Việt, số, bool, object con, undefined).
func danhMuc(n int) []any {
	out := make([]any, n)
	for i := range out {
		out[i] = omap.Of("ma", "SP-"+strconv.Itoa(i), "ten", "Đèn Led âm trần \"Mini\" "+strings.Repeat("ắ", i%61), "giaBanLe", float64(i)*1250.5,
			"daDuyet", i%2 == 0, "bo", omap.Undefined, "moTa", "Công suất: 7W\nCRI: 90\t<b>&</b>",
			"raw", omap.Of("ten_sp", "x", "ghi_chu", strings.Repeat("y", (i*37)%900), "cot", []any{nil, 1.5, "z"}))
	}
	return out
}

// thamChieu: thân và ETag tính độc lập với response.OK (ghép từng phần tử, băm lại từ đầu).
func thamChieu(t *testing.T, v any) (body, tag string) {
	t.Helper()
	enc := func(x any) string {
		b, err := omap.AppendJSON(nil, x)
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	inner := ""
	if a, ok := v.([]any); ok && a != nil {
		parts := make([]string, len(a))
		for i, it := range a {
			parts[i] = enc(it)
		}
		inner = "[" + strings.Join(parts, ",") + "]"
	} else {
		inner = enc(v)
	}
	body = `{"ok":true,"result":` + inner + `}`
	sum := sha1.Sum([]byte(body))
	return body, `W/"` + strconv.FormatInt(int64(len(body)), 16) + "-" + base64.StdEncoding.EncodeToString(sum[:])[:27] + `"`
}

func goiOK(v any) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/getProducts", nil)
	OK(c, v)
	return w
}

func soSanh(t *testing.T, name string, w *httptest.ResponseRecorder, body, tag string) {
	t.Helper()
	if w.Code != 200 {
		t.Errorf("%s: mã %d", name, w.Code)
	}
	if got := w.Body.String(); got != body {
		t.Errorf("%s: thân khác (%d byte, muốn %d)", name, len(got), len(body))
	}
	h := w.Header()
	if h.Get("ETag") != tag || h.Get("Content-Length") != strconv.Itoa(len(body)) || h.Get("Content-Type") != "application/json; charset=utf-8" {
		t.Errorf("%s: header %v, muốn ETag %s", name, h, tag)
	}
	if len(h) != 3 {
		t.Errorf("%s: thừa / thiếu header: %v", name, h)
	}
}

// Thân và ETag của response.OK không đổi một byte nào dù bộ đệm được dùng lại giữa các request to nhỏ xen kẽ.
func TestOKBytesAndETag(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// Thân + ETag lấy từ node thật: JSON.stringify({ok:true,result}) và require('etag')(buf, {weak:true}) của Express
	for _, c := range []struct {
		v         any
		body, tag string
	}{
		{nil, `{"ok":true,"result":null}`, `W/"19-Kz9H58HJeZozqbXkJKFA6qJIpek"`},
		{omap.Of("ten", "Đèn Led âm trần", "gia", 1250.5, "a", []any{1.0, nil, "x"}),
			`{"ok":true,"result":{"ten":"Đèn Led âm trần","gia":1250.5,"a":[1,null,"x"]}}`, `W/"51-EFbB1bot1dQWy0oJlYlF1RIOk/s"`},
	} {
		soSanh(t, "node "+c.body, goiOK(c.v), c.body, c.tag)
	}
	cases := []any{nil, omap.Undefined, true, 1.5, "chuỗi", []any{}, []any(nil), omap.New(), omap.Of("a", 1.0),
		danhMuc(1), danhMuc(31), danhMuc(32), danhMuc(949), omap.Of("products", danhMuc(949), "lines", []any{}, "user", omap.Of("u", "nv")),
		danhMuc(3), "nhỏ sau lớn", danhMuc(2000)}
	for round := 0; round < 3; round++ {
		for i, v := range cases {
			body, tag := thamChieu(t, v)
			soSanh(t, fmt.Sprintf("vòng %d ca %d", round, i), goiOK(v), body, tag)
		}
	}
}

// Nhiều request cùng lúc trả cùng một danh mục (slice trong cache): mỗi response phải nguyên vẹn, không lẫn bộ đệm của nhau.
func TestOKConcurrent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	big, small := danhMuc(949), omap.Of("ok", "nhỏ")
	bigBody, bigTag := thamChieu(t, big)
	smallBody, smallTag := thamChieu(t, small)
	var wg sync.WaitGroup
	for g := 0; g < 32; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for n := 0; n < 6; n++ {
				if (g+n)%2 == 0 {
					soSanh(t, "lớn", goiOK(big), bigBody, bigTag)
				} else {
					soSanh(t, "nhỏ", goiOK(small), smallBody, smallTag)
				}
			}
		}(g)
	}
	wg.Wait()
}

// Lỗi khi ghi JSON (giá trị không ghi được): 500 như trước, và bộ đệm dở dang không rò sang request sau.
func TestOKEncodeError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := goiOK([]any{"a", make(chan int)})
	if w.Code != 500 || !strings.HasPrefix(w.Body.String(), `{"error":`) {
		t.Errorf("lỗi ghi JSON: %d %s", w.Code, w.Body.String())
	}
	body, tag := thamChieu(t, "sau lỗi")
	soSanh(t, "sau lỗi", goiOK("sau lỗi"), body, tag)
}

// 304: GET kèm If-None-Match đúng ETag -> không thân; POST thì luôn trả thân (req.fresh của Express).
func TestOKNotModified(t *testing.T) {
	gin.SetMode(gin.TestMode)
	v := danhMuc(40)
	body, tag := thamChieu(t, v)
	for _, method := range []string{"GET", "POST"} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(method, "/api/v1/products", nil)
		c.Request.Header.Set("If-None-Match", tag)
		OK(c, v)
		if method == "GET" && (w.Code != http.StatusNotModified || w.Body.Len() != 0 || w.Header().Get("ETag") != tag) {
			t.Errorf("GET: %d, %d byte", w.Code, w.Body.Len())
		}
		if method == "POST" && (w.Code != 200 || w.Body.String() != body) {
			t.Errorf("POST: %d", w.Code)
		}
	}
}

// BenchmarkOKCatalog: cấp phát / request khi trả danh mục 949 sản phẩm qua response.OK.
func BenchmarkOKCatalog(b *testing.B) {
	gin.SetMode(gin.TestMode)
	v := danhMuc(949)
	b.SetBytes(int64(goiOK(v).Body.Len()))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := &boThan{h: http.Header{}}
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Writer = w
		c.Request = httptest.NewRequest("POST", "/api/getProducts", nil)
		OK(c, v)
	}
}

// boThan: ResponseWriter bỏ thân, để không tính bộ đệm của máy thu vào số đo.
type boThan struct {
	gin.ResponseWriter
	h http.Header
}

func (w *boThan) Header() http.Header         { return w.h }
func (w *boThan) WriteHeader(int)             {}
func (w *boThan) WriteHeaderNow()             {}
func (w *boThan) Status() int                 { return 200 }
func (w *boThan) Written() bool               { return false }
func (w *boThan) Write(b []byte) (int, error) { return len(b), nil }
