package server

import (
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/shared/response"
)

// Logo mặc định của báo giá / giao diện, khôi phục nguyên văn từ public/ của app Node cũ.
//
//go:embed assets/logo.svg
var logoSVG []byte

// AssetModule: module có file tĩnh nhúng trong binary (go:embed), phục vụ ở gốc đúng đường dẫn cũ của public/.
// Khoá là đường dẫn URL (bắt đầu bằng "/").
type AssetModule interface {
	Assets() map[string][]byte
}

// asset: một file nhúng đã tính sẵn header.
type asset struct {
	body  []byte
	ctype string
	cache string
	etag  string
}

// addAsset đăng ký file nhúng; trùng đường dẫn = lỗi lắp ghép -> panic lúc khởi động.
func (s *Server) addAsset(urlPath string, body []byte) {
	if !strings.HasPrefix(urlPath, "/") || len(body) == 0 {
		panic("asset sai: " + urlPath)
	}
	if _, dup := s.assets[urlPath]; dup {
		panic("asset trùng đường dẫn: " + urlPath)
	}
	ext := strings.ToLower(path.Ext(urlPath))
	ct := staticTypes[ext]
	if ct == "" {
		ct = "application/octet-stream"
	}
	// như static gốc (maxAge 0) + setHeaders: HTML/JS/CSS luôn revalidate
	cache := "public, max-age=0"
	if reRevalidate.MatchString(urlPath) {
		cache = "no-cache"
	}
	sum := sha256.Sum256(body)
	s.assets[urlPath] = &asset{body: body, ctype: ct, cache: cache,
		etag: `W/"` + strconv.FormatInt(int64(len(body)), 16) + "-" + hex.EncodeToString(sum[:8]) + `"`}
}

// embeddedAssets phục vụ file nhúng (GET / HEAD, khớp đúng đường dẫn) TRƯỚC thư mục STATIC_DIR: bản nhúng là
// nguồn duy nhất. Header như static(): Cache-Control, ETag yếu (theo nội dung, vì file nhúng không có mtime),
// Content-Type, Accept-Ranges; trình duyệt hỏi lại nhận 304. Không có Last-Modified.
// files được điền trong routes() (sau khi dựng module), trước khi server nhận request.
func embeddedAssets(files map[string]*asset) gin.HandlerFunc {
	return func(c *gin.Context) {
		r := c.Request
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			return
		}
		a := files[r.URL.Path]
		if a == nil {
			// Như send / static(): chuẩn hoá "." / ".." / "//" ("/x/../vs-spec.js" hợp lệ); leo khỏi gốc, có "/" cuối
			// hoặc ký tự NUL thì bỏ qua (Node trả 403 / 404, ở đây rơi xuống 404).
			p := r.URL.Path
			if strings.HasSuffix(p, "/") || strings.ContainsRune(p, 0) {
				return
			}
			clean := path.Clean("./" + p)
			if clean == ".." || strings.HasPrefix(clean, "../") {
				return
			}
			if a = files["/"+clean]; a == nil {
				return
			}
		}
		h := c.Writer.Header()
		h.Set("Cache-Control", a.cache)
		h.Set("ETag", a.etag)
		h.Set("Content-Type", a.ctype)
		h.Set("Accept-Ranges", "bytes")
		if response.NoCache(r) {
			r = r.Clone(r.Context())
			r.Header.Del("If-None-Match")
			r.Header.Del("If-Modified-Since")
		}
		http.ServeContent(c.Writer, r, path.Base(r.URL.Path), time.Time{}, bytes.NewReader(a.body))
		c.Abort()
	}
}
