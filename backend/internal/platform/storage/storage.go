// Package storage: kho FILE trên Supabase Storage (ảnh / tài liệu) - bản chuyển của uploadToStorage()
// trong server/supa.js. Publishable key là khoá công khai, chỉ dùng cho Storage.
package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"qspro-backend/internal/shared/jsval"
)

// Mặc định như server/supa.js; đổi project bằng SUPABASE_URL_OVERRIDE / SUPABASE_KEY_OVERRIDE / SUPABASE_BUCKET.
const (
	DefaultURL    = "https://xcjnpjpkmwhekkabpjzw.supabase.co"
	DefaultKey    = "sb_publishable_Am7BKsK-MM3at1Gv34iY0g_bHJopSsV"
	DefaultBucket = "products"
)

// Client tải file lên Storage.
type Client struct {
	url, key, bucket string
	http             *http.Client
}

// New: tham số rỗng thì lấy mặc định. URL bị cắt các dấu / ở cuối.
func New(url, key, bucket string) *Client {
	if url == "" {
		url = DefaultURL
	}
	if key == "" {
		key = DefaultKey
	}
	if bucket == "" {
		bucket = DefaultBucket
	}
	return &Client{url: strings.TrimRight(url, "/"), key: key, bucket: bucket, http: &http.Client{Timeout: 5 * time.Minute, CheckRedirect: nhuFetch}}
}

// nhuFetch: theo chuyển hướng như fetch() của Node - tối đa 20 lần (lần thứ 21 là lỗi mạng "fetch failed"),
// và khi phương thức bị đổi (POST -> GET ở 301 / 302 / 303) thì bỏ các header mô tả thân.
func nhuFetch(req *http.Request, via []*http.Request) error {
	if len(via) > 20 {
		return errors.New("redirect count exceeded")
	}
	if req.Method != via[0].Method {
		for _, h := range []string{"Content-Type", "Content-Encoding", "Content-Language", "Content-Location"} {
			req.Header.Del(h)
		}
	}
	return nil
}

// URL: địa chỉ gốc của Storage (supa._url).
func (s *Client) URL() string { return s.url }

// Bucket: tên bucket (supa._bucket).
func (s *Client) Bucket() string { return s.bucket }

// PublicURL: đường dẫn công khai của 1 file.
func (s *Client) PublicURL(path string) string {
	return s.url + "/storage/v1/object/public/" + s.bucket + "/" + jsval.EncodeURIComponent(path)
}

// Upload tải buf lên (ghi đè nếu trùng tên) và trả public URL. contentType rỗng -> image/jpeg.
func (s *Client) Upload(ctx context.Context, buf []byte, path, contentType string) (string, error) {
	if contentType == "" {
		contentType = "image/jpeg"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.url+"/storage/v1/object/"+s.bucket+"/"+jsval.EncodeURIComponent(path), bytes.NewReader(buf))
	if err != nil {
		return "", errors.New("fetch failed")
	}
	req.Header.Set("apikey", s.key)
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "true")
	res, err := s.http.Do(req)
	if err != nil {
		return "", errors.New("fetch failed") // thông báo của fetch() bên Node khi lỗi mạng
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
		return "", errors.New("Storage upload -> " + strconv.Itoa(res.StatusCode) + " " + jsval.Slice(string(body), 0, 200))
	}
	_, _ = io.Copy(io.Discard, res.Body)
	return s.PublicURL(path), nil
}
