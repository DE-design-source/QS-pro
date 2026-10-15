package categories

import (
	"encoding/json"
	"os"
	"testing"
)

// expressQuery phải cho cùng String(giá trị), !!giá trị và lỗi như qs thật của Express (testdata/qs.json do categories/testdata/gen-qs.js sinh).
func TestExpressQueryGolden(t *testing.T) {
	raw, err := os.ReadFile("testdata/qs.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases [][]any
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	if len(cases) < 100 {
		t.Fatalf("golden thiếu ca: %d", len(cases))
	}
	for _, c := range cases {
		q, key := c[0].(string), c[1].(string)
		got := expressQuery(q, key)
		if len(q) > 80 {
			q = q[:80] + "..."
		}
		if msg, loi := c[4].(string); loi {
			if got.Err == nil || got.Err.Error() != msg || !got.Truthy {
				t.Errorf("%q [%s]: node ném %q, go %+v", q, key, msg, got)
			}
			continue
		}
		if got.Err != nil || got.Str != c[2].(string) || got.Truthy != c[3].(bool) {
			t.Errorf("%q [%s]: go %q %v %v, node %q %v", q, key, got.Str, got.Truthy, got.Err, c[2], c[3])
		}
	}
}
