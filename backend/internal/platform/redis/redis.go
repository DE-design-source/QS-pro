// Package redis: client Redis TUỲ CHỌN. Server Node không dùng Redis; ở đây chỉ để
// giới hạn tần suất dùng chung giữa nhiều tiến trình. Không đặt REDIS_URL -> nil, mọi thứ chạy trong bộ nhớ.
package redis

import (
	"context"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// Client: bí danh để các gói khác không phải import go-redis trực tiếp.
type Client = goredis.Client

// New trả nil, nil khi url rỗng. Có url thì thử PING 1 lần (lỗi -> trả lỗi, nơi gọi quyết định bỏ qua).
func New(url string) (*Client, error) {
	if url == "" {
		return nil, nil
	}
	opt, err := goredis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	c := goredis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := c.Ping(ctx).Err(); err != nil {
		_ = c.Close()
		return nil, err
	}
	return c, nil
}
