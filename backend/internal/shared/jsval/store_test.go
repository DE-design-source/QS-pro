package jsval

import (
	"math"
	"regexp"
	"testing"
	"time"

	"qspro-backend/internal/shared/omap"
)

// Giá trị mong đợi: s() cắt nguyên văn từ server/store_supa.js, chạy bằng node thật
// (internal/shared/errors/testdata/gen.js, khoá "s" của colerr.json).
func TestS(t *testing.T) {
	a, b := 0.1, 0.2 // biến, vì hằng 0.1 + 0.2 của Go được tính chính xác thành 0.3
	got := []string{S(nil), S(Undefined), S(""), S(0.0), S(math.Copysign(0, -1)), S(false), S(true), S(12.5), S(1e21), S(1e-7), S(a + b),
		S(nan), S(inf), S("abc"), S([]any{1.0, nil, "a"}), S(omap.New()), S([]any{}), S(123456789012345680000.0)}
	want := []string{"", "", "", "0", "0", "false", "true", "12.5", "1e+21", "1e-7", "0.30000000000000004",
		"NaN", "Infinity", "abc", "1,,a", "[object Object]", "", "123456789012345680000"}
	eq(t, "S", got, want)
	if S((*omap.Map)(nil)) != "" {
		t.Error("S(con trỏ nil) phải rỗng")
	}
}

func TestNowISO(t *testing.T) {
	// node: /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(new Date().toISOString()) === true
	a := time.Now().UTC().Truncate(time.Millisecond)
	s := NowISO()
	b := time.Now().UTC()
	if !regexp.MustCompile(`^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$`).MatchString(s) {
		t.Fatalf("NowISO = %q", s)
	}
	got, err := time.Parse("2006-01-02T15:04:05.000Z", s)
	if err != nil || got.Before(a) || got.After(b) {
		t.Errorf("NowISO = %q ngoài khoảng [%v, %v] (%v)", s, a, b, err)
	}
}
