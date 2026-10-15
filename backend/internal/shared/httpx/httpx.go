// Package httpx: phần dùng chung cho các lời gọi HTTP ra ngoài phải giống fetch của Node.
package httpx

import (
	"io"
	"net/http"
)

// thanRong là thân rỗng KHÁC http.NoBody: net/http coi request có thân mà không có GetBody là không gửi lại được.
type thanRong struct{}

func (thanRong) Read([]byte) (int, error) { return 0, io.EOF }
func (thanRong) Close() error             { return nil }

type motLan struct{ rt http.RoundTripper }

// RoundTrip gắn thân rỗng vào BẢN SAO của request không thân. net/http đọc thử thân, thấy rỗng nên trên dây không đổi gì
// (không Content-Length, không chunked); http.Client vẫn thấy request gốc nên chuyển hướng 307 / 308 không bị ảnh hưởng.
func (m motLan) RoundTrip(r *http.Request) (*http.Response, error) {
	if r.Body == nil || r.Body == http.NoBody {
		r2 := *r
		r2.Body = thanRong{}
		r2.GetBody = nil
		r = &r2
	}
	return m.rt.RoundTrip(r)
}

// OneShot bọc transport để GET / HEAD chỉ được gửi ĐÚNG MỘT LẦN như fetch của Node (undici). Mặc định net/http tự gửi lại
// request không thân khi kết nối keep-alive đang dùng lại bị đóng trước khi có byte trả lời: dịch vụ ngoài nhận 2 request.
func OneShot(rt http.RoundTripper) http.RoundTripper { return motLan{rt} }

// Inner trả transport nằm trong lớp bọc của OneShot (chính rt nếu không bọc); test dùng để chỉnh DialContext.
func Inner(rt http.RoundTripper) http.RoundTripper {
	if m, ok := rt.(motLan); ok {
		return m.rt
	}
	return rt
}
