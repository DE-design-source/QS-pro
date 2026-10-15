package server

import (
	"html"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/shared/response"
)

// Kiểu nội dung theo đuôi file như express.static (send + mime 1.6) trả về.
var staticTypes = map[string]string{
	".html":  "text/html; charset=UTF-8",
	".htm":   "text/html; charset=UTF-8",
	".js":    "application/javascript; charset=UTF-8",
	".mjs":   "application/javascript; charset=UTF-8",
	".css":   "text/css; charset=UTF-8",
	".json":  "application/json; charset=UTF-8",
	".map":   "application/json; charset=UTF-8",
	".txt":   "text/plain; charset=UTF-8",
	".md":    "text/markdown; charset=UTF-8",
	".csv":   "text/csv; charset=UTF-8",
	".xml":   "application/xml",
	".svg":   "image/svg+xml",
	".png":   "image/png",
	".jpg":   "image/jpeg",
	".jpeg":  "image/jpeg",
	".gif":   "image/gif",
	".webp":  "image/webp",
	".ico":   "image/x-icon",
	".woff":  "font/woff",
	".woff2": "font/woff2",
	".ttf":   "font/ttf",
	".pdf":   "application/pdf",
	".xlsx":  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".ts":    "video/mp2t",
}

// static phục vụ file tĩnh như express.static(root, { maxAge }):
//   - chỉ GET / HEAD; không tìm thấy file thì cho đi tiếp (route phía sau xử lý);
//   - bỏ qua file / thư mục bắt đầu bằng dấu chấm; thư mục thì trả index.html (thiếu "/" cuối -> 301);
//   - Cache-Control: public, max-age=<giây>, trừ khi setHeaders đã đặt; có ETag yếu + Last-Modified
//     nên trình duyệt hỏi lại nhận 304.
//
// prefix "" = gắn ở gốc. setHeaders có thể nil.
func static(prefix, root string, maxAgeSec int, setHeaders func(h http.Header, filePath string)) gin.HandlerFunc {
	return func(c *gin.Context) {
		r := c.Request
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			return
		}
		urlPath := r.URL.Path
		rel := urlPath
		if prefix != "" {
			if urlPath != prefix && !strings.HasPrefix(urlPath, prefix+"/") {
				return
			}
			rel = urlPath[len(prefix):]
		}
		if strings.ContainsRune(rel, 0) {
			return
		}
		if runtime.GOOS == "windows" {
			rel = strings.ReplaceAll(rel, `\`, "/") // path.normalize của Node trên Windows coi \ là dấu ngăn
		}
		// Như send: chuẩn hoá trước ("/sub/../app.js" hợp lệ), còn ".." sau chuẩn hoá = leo khỏi gốc -> bỏ qua;
		// file ẩn chỉ xét ĐOẠN CUỐI (thư mục bắt đầu bằng dấu chấm như /.well-known/ vẫn phục vụ).
		clean := path.Clean("./" + rel)
		if clean == ".." || strings.HasPrefix(clean, "../") {
			return
		}
		if base := path.Base(clean); !strings.HasSuffix(rel, "/") && base != "." && strings.HasPrefix(base, ".") {
			return
		}
		if clean != "." && !filepath.IsLocal(filepath.FromSlash(clean)) {
			return
		}
		file := filepath.Join(root, filepath.FromSlash(clean))
		st, err := os.Stat(file)
		if err != nil {
			return
		}
		if st.IsDir() {
			if !strings.HasSuffix(urlPath, "/") {
				// serve-static: lấy đường dẫn GỐC (còn mã hoá) + "/", giữ query, rồi encodeUrl
				rawPath, rawQuery, hasQ := strings.Cut(r.RequestURI, "?")
				if !strings.HasPrefix(rawPath, "/") {
					rawPath = r.URL.EscapedPath()
				}
				target := "/" + strings.TrimLeft(rawPath, "/") + "/"
				if hasQ {
					target += "?" + rawQuery
				}
				target = encodeURL(target)
				// trang chuyển hướng của serve-static
				h := c.Writer.Header()
				h.Set("Content-Security-Policy", "default-src 'none'")
				h.Set("X-Content-Type-Options", "nosniff")
				h.Set("Location", target)
				c.Data(http.StatusMovedPermanently, "text/html; charset=UTF-8", []byte("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Redirecting</title>\n</head>\n<body>\n<pre>Redirecting to "+
					html.EscapeString(target)+"</pre>\n</body>\n</html>\n"))
				c.Abort()
				return
			}
			file = filepath.Join(file, "index.html")
			if st, err = os.Stat(file); err != nil || st.IsDir() {
				return
			}
		} else if strings.HasSuffix(urlPath, "/") {
			return
		}
		f, err := os.Open(file)
		if err != nil {
			return
		}
		defer f.Close()

		h := c.Writer.Header()
		if setHeaders != nil {
			setHeaders(h, file)
		}
		if h.Get("Cache-Control") == "" {
			h.Set("Cache-Control", "public, max-age="+strconv.Itoa(maxAgeSec))
		}
		// mtime làm tròn tới mili giây như Date của JS (không cắt bỏ)
		mtimeMs := (st.ModTime().UnixNano() + 500000) / 1000000
		h.Set("ETag", `W/"`+strconv.FormatInt(st.Size(), 16)+"-"+strconv.FormatInt(mtimeMs, 16)+`"`)
		ext := strings.ToLower(filepath.Ext(file))
		ct := staticTypes[ext]
		if ct == "" {
			// ngoài bảng: kiểu của Go, charset viết như mime 1.6 (UTF-8 cho text/*, javascript, json)
			ct, _, _ = mime.ParseMediaType(mime.TypeByExtension(ext))
			switch {
			case ct == "":
				ct = "application/octet-stream"
			case strings.HasPrefix(ct, "text/") || ct == "application/javascript" || ct == "application/json":
				ct += "; charset=UTF-8"
			}
		}
		h.Set("Content-Type", ct)
		h.Set("Accept-Ranges", "bytes") // send đặt cả ở 304
		if response.NoCache(r) {
			// client gửi Cache-Control: no-cache -> send không bao giờ trả 304
			r = r.Clone(r.Context())
			r.Header.Del("If-None-Match")
			r.Header.Del("If-Modified-Since")
		}
		http.ServeContent(c.Writer, r, st.Name(), st.ModTime(), f) // lo Range, If-None-Match, If-Modified-Since, Last-Modified
		c.Abort()
	}
}

// encodeURL: thư viện encodeurl 2.0 - mã hoá ký tự ngoài tập cho phép, giữ nguyên %XX đã có.
func encodeURL(s string) string {
	isHex := func(c byte) bool {
		return c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F'
	}
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		ok := c == 0x21 || c >= 0x23 && c <= 0x3B || c == 0x3D || c >= 0x3F && c <= 0x5F || c >= 0x61 && c <= 0x7A || c == 0x7C || c == 0x7E
		if c == '%' {
			ok = i+2 < len(s) && isHex(s[i+1]) && isHex(s[i+2])
		}
		if ok {
			b.WriteByte(c)
		} else {
			b.WriteString("%" + strings.ToUpper(strconv.FormatInt(int64(c)+0x100, 16)[1:]))
		}
	}
	return b.String()
}
