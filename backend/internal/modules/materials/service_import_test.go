package materials

import (
	"context"
	"testing"

	"qspro-backend/internal/shared/omap"
)

// importCommit nhận object có khoá "length" (không phải mảng): Node lặp i < length và đọc list[i],
// phần tử thiếu là undefined -> TypeError ngay ở p._raw (giá trị mong đợi lấy từ server Node thật).
func TestImportCommitObjectCoLength(t *testing.T) {
	s := &Service{}
	cases := []struct {
		ten  string
		in   any
		want string
	}{
		{"thiếu phần tử", omap.Of("length", 2.0), "Cannot read properties of undefined (reading '_raw')"},
		{"length là chuỗi số", omap.Of("length", "1"), "Cannot read properties of undefined (reading '_raw')"},
		{"phần tử null", omap.Of("length", 1.0, "0", nil), "Cannot read properties of null (reading '_raw')"},
	}
	for _, c := range cases {
		_, err := s.ImportCommit(context.Background(), nil, c.in)
		if err == nil || err.Error() != c.want {
			t.Errorf("%s: lỗi = %v, muốn %q", c.ten, err, c.want)
		}
	}
}
