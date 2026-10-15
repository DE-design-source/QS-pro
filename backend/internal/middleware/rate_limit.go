package middleware

import (
	"context"
	"math"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/platform/redis"
	"qspro-backend/internal/shared/response"
)

// MsgRateLimited: thông báo khi vượt giới hạn (bản Node không có giới hạn tần suất).
const MsgRateLimited = "Quá nhiều yêu cầu, vui lòng thử lại sau"

type bucket struct {
	tokens float64
	last   time.Time
}

// memLimiter: token bucket trong bộ nhớ, mỗi IP 1 xô.
type memLimiter struct {
	mu    sync.Mutex
	rps   float64
	burst float64
	m     map[string]*bucket
	swept time.Time
}

func (l *memLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if now.Sub(l.swept) > time.Minute { // dọn xô đã đầy lại từ lâu
		for k, b := range l.m {
			if now.Sub(b.last).Seconds()*l.rps >= l.burst {
				delete(l.m, k)
			}
		}
		l.swept = now
	}
	b := l.m[key]
	if b == nil {
		b = &bucket{tokens: l.burst, last: now}
		l.m[key] = b
	}
	b.tokens = math.Min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rps)
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// Token bucket trên Redis (dùng chung giữa nhiều tiến trình): KEYS[1] = xô, ARGV = rps, burst, now(ms).
const redisBucket = `
local d = redis.call('HMGET', KEYS[1], 't', 'ts')
local rps, burst, now = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local t, ts = tonumber(d[1]) or burst, tonumber(d[2]) or now
t = math.min(burst, t + math.max(0, now - ts) / 1000 * rps)
local ok = 0
if t >= 1 then t = t - 1; ok = 1 end
redis.call('HSET', KEYS[1], 't', t, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(burst / rps * 1000) + 1000)
return ok`

// RateLimit giới hạn số request / giây theo IP. rps <= 0 -> không giới hạn.
// Có Redis thì đếm trên Redis; Redis lỗi thì dùng tạm bộ đếm trong bộ nhớ.
func RateLimit(rps float64, rdb *redis.Client) gin.HandlerFunc {
	if rps <= 0 {
		return func(*gin.Context) {}
	}
	burst := math.Max(1, math.Ceil(rps*2))
	mem := &memLimiter{rps: rps, burst: burst, m: map[string]*bucket{}, swept: time.Now()}
	return func(c *gin.Context) {
		key, now := c.ClientIP(), time.Now()
		ok, done := false, false
		if rdb != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 200*time.Millisecond)
			n, err := rdb.Eval(ctx, redisBucket, []string{"qs:rl:" + key}, rps, burst, now.UnixMilli()).Int()
			cancel()
			if err == nil {
				ok, done = n == 1, true
			}
		}
		if !done {
			ok = mem.allow(key, now)
		}
		if !ok {
			c.Header("Retry-After", "1")
			response.Fail(c, 429, MsgRateLimited)
		}
	}
}
