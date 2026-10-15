// Package response: ghi JSON trả về client GIỐNG res.json() của Express + JSON.stringify
// (không escape HTML, số kiểu JS, giữ thứ tự khoá, undefined trong object bị bỏ, có ETag yếu).
package response

import (
	"crypto/sha1"
	"encoding/base64"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"

	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/omap"
)

const contentType = "application/json; charset=utf-8"

// etag: ETag yếu của Express - W/"<độ dài hex>-<27 ký tự đầu của sha1 base64>".
func etag(b []byte) string {
	if len(b) == 0 {
		return `W/"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"`
	}
	sum := sha1.Sum(b)
	return `W/"` + strconv.FormatInt(int64(len(b)), 16) + "-" + base64.StdEncoding.EncodeToString(sum[:])[:27] + `"`
}

var reNoCache = regexp.MustCompile(`(?:^|,)\s*?no-cache\s*?(?:,|$)`)

// NoCache: client gửi Cache-Control có no-cache (thư viện fresh của Express) -> không bao giờ trả 304.
func NoCache(r *http.Request) bool { return reNoCache.MatchString(r.Header.Get("Cache-Control")) }

func write(c *gin.Context, status int, b []byte) {
	h := c.Writer.Header()
	tag := h.Get("ETag")
	if tag == "" {
		tag = etag(b)
		h.Set("ETag", tag)
	}
	// req.fresh của Express: GET / HEAD, trả 2xx, client đã có đúng bản này -> 304
	if m := c.Request.Method; (m == http.MethodGet || m == http.MethodHead) && status >= 200 && status < 300 {
		if inm := c.GetHeader("If-None-Match"); inm != "" && !NoCache(c.Request) {
			for _, t := range strings.Split(inm, ",") {
				t = strings.TrimSpace(t)
				if t == "*" || strings.TrimPrefix(t, "W/") == strings.TrimPrefix(tag, "W/") {
					c.Status(http.StatusNotModified)
					c.Writer.WriteHeaderNow()
					return
				}
			}
		}
	}
	h.Set("Content-Length", strconv.Itoa(len(b))) // HEAD cũng phải có độ dài như Express
	c.Data(status, contentType, b)
}

// JSON ghi v với mã status.
func JSON(c *gin.Context, status int, v any) {
	b, err := omap.Marshal(v)
	if err != nil {
		write(c, 500, []byte(`{"error":"Lỗi máy chủ"}`))
		return
	}
	write(c, status, b)
}

// bufPool: bộ đệm ghi JSON dùng lại giữa các request. Thân lớn (danh mục sản phẩm vài MB) mà để append tự nới từ 512
// byte thì mỗi request cấp phát gấp khoảng 5 lần thân. Dùng lại được vì gin / net/http không giữ slice sau khi Write trả về.
var bufPool = sync.Pool{New: func() any { b := make([]byte, 0, 512); return &b }}

// maxPooled: bộ đệm lớn hơn mức này thì bỏ, không giữ lại trong pool.
const maxPooled = 64 << 20

// OK: {"ok":true,"result":...}; result nil / undefined -> null.
func OK(c *gin.Context, result any) {
	bp := bufPool.Get().(*[]byte)
	b := append((*bp)[:0], `{"ok":true,"result":`...)
	b, err := omap.AppendJSON(b, result)
	if err != nil {
		Fail(c, 500, apperr.Message(err))
	} else {
		b = append(b, '}')
		write(c, 200, b)
	}
	if cap(b) <= maxPooled {
		*bp = b
		bufPool.Put(bp)
	}
}

// Fail: {"error":msg} hoặc {"error":msg,"code":code}; dừng chuỗi handler.
func Fail(c *gin.Context, status int, msg string, code ...string) {
	m := omap.Of("error", msg)
	if len(code) > 0 && code[0] != "" {
		m.Set("code", code[0])
	}
	JSON(c, status, m)
	c.Abort()
}

// Error: dùng cho REST - mã HTTP lấy từ AppError, lỗi thường -> 500 (như dispatcher Node).
func Error(c *gin.Context, err error) {
	status, code := apperr.Status(err)
	Fail(c, status, apperr.Message(err), code)
}

// Result: gọn cho handler REST - response.Result(c, result, err).
func Result(c *gin.Context, result any, err error) {
	if err != nil {
		Error(c, err)
		return
	}
	OK(c, result)
}
