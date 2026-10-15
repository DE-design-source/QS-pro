package quotations

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
)

// Giá trị mong đợi lấy từ Node 22.14: s.toUpperCase() / s.toLowerCase().
var caseRef = [][3]string{
	{"Báo giá ĐIỆN nước", "BÁO GIÁ ĐIỆN NƯỚC", "báo giá điện nước"},
	{"straße ǆ ŉ ΐ", "STRASSE Ǆ ʼN Ϊ́", "straße ǆ ŉ ΐ"},
	{"ΟΔΟΣ Σ", "ΟΔΟΣ Σ", "οδος σ"},
	{"İstanbul I ı", "İSTANBUL I I", "i̇stanbul i ı"},
	{"ﬁ ﬃ ǅ", "FI FFI Ǆ", "ﬁ ﬃ ǆ"},
	{"Ᲊ Ɤ Ꟍ Ꟛ Ƛ \U00010D50", "Ᲊ Ɤ Ꟍ Ꟛ Ƛ \U00010D50", "ᲊ ɤ ꟍ ꟛ ƛ \U00010D70"},
	{"ᲊ ɤ ꟍ ꟛ ƛ \U00010D70", "Ᲊ Ɤ Ꟍ Ꟛ Ƛ \U00010D50", "ᲊ ɤ ꟍ ꟛ ƛ \U00010D70"},
}

func TestJSCase(t *testing.T) {
	for _, c := range caseRef {
		if got := jsUpper(c[0]); got != c[1] {
			t.Errorf("jsUpper(%q) = %q, Node %q", c[0], got, c[1])
		}
		if got := jsLower(c[0]); got != c[2] {
			t.Errorf("jsLower(%q) = %q, Node %q", c[0], got, c[2])
		}
	}
}

// TestJSCaseBang: mọi điểm mã Unicode so với bảng của Node (testdata/case-node.txt do gen-case.js sinh).
func TestJSCaseBang(t *testing.T) {
	b, err := os.ReadFile(filepath.Join("testdata", "case-node.txt"))
	if err != nil {
		t.Fatal(err)
	}
	dec := func(s string) string {
		var sb strings.Builder
		for _, h := range strings.Fields(s) {
			n, err := strconv.ParseInt(h, 16, 32)
			if err != nil {
				t.Fatalf("case-node.txt: %q", s)
			}
			sb.WriteRune(rune(n))
		}
		return sb.String()
	}
	want := map[rune][2]string{}
	for _, ln := range strings.Split(strings.ReplaceAll(string(b), "\r", ""), "\n") {
		if ln == "" || ln[0] == '#' {
			continue
		}
		p := strings.Split(ln, "\t")
		if len(p) != 3 {
			t.Fatalf("case-node.txt: %q", ln)
		}
		want[[]rune(dec(p[0]))[0]] = [2]string{dec(p[1]), dec(p[2])}
	}
	bad := 0
	for cp := rune(0); cp <= 0x10FFFF; cp++ {
		if cp >= 0xD800 && cp <= 0xDFFF {
			continue
		}
		s := string(cp)
		w, ok := want[cp]
		if !ok {
			w = [2]string{s, s}
		}
		if u, l := jsUpper(s), jsLower(s); u != w[0] || l != w[1] {
			if bad++; bad <= 10 {
				t.Errorf("U+%04X: upper %+q lower %+q, Node %+q %+q", cp, u, l, w[0], w[1])
			}
		}
	}
	if bad > 0 {
		t.Errorf("%d điểm mã khác Node", bad)
	}
}

// Xuất báo giá gọi jsUpper / jsLower từ nhiều request cùng lúc: chạy với -race để bắt việc dùng chung trạng thái.
func TestJSCaseSongSong(t *testing.T) {
	var wg sync.WaitGroup
	for g := 0; g < 32; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				c := caseRef[i%len(caseRef)]
				if jsUpper(c[0]) != c[1] || jsLower(c[0]) != c[2] {
					t.Errorf("sai khi chạy song song: %q", c[0])
					return
				}
			}
		}()
	}
	wg.Wait()
}
