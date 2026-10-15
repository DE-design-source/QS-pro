package config

import (
	"os"
	"path/filepath"
	"testing"
)

// Giá trị mong đợi = dotenv 16.6.1 (require('dotenv').parse) trên cùng nội dung.
func TestParseDotenvLikeNode(t *testing.T) {
	src := string([]byte{0xEF, 0xBB, 0xBF}) + "A=1\r\nD=a#b\nW=p%40ss#word\nX=${HOME}/x\nM=a\\$b\nY=\"a\\\\b\"\nU=`bt $x`\n" +
		"dòng rác không có dấu bằng\nexport E = ' q ' # ghi chú\nN=\"l1\\nl2\"\nS='l1\\nl2'\nK: v\nEMPTY=\nH=\"a#b\" # c\nZ=  tr  \n"
	want := []envPair{
		{"A", "1"}, {"D", "a"}, {"W", "p%40ss"}, {"X", "${HOME}/x"}, {"M", `a\$b`}, {"Y", `a\\b`}, {"U", "bt $x"},
		{"E", " q "}, {"N", "l1\nl2"}, {"S", `l1\nl2`}, {"K", "v"}, {"EMPTY", ""}, {"H", "a#b"}, {"Z", "tr"},
	}
	got := parseDotenv(src)
	if len(got) != len(want) {
		t.Fatalf("số biến %d != %d: %q", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("[%d] got %q, want %q", i, got[i], want[i])
		}
	}
}

func TestLoadDotenvKeepsExisting(t *testing.T) {
	f := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(f, []byte("QS_T_A=file\nQS_T_B=file\nQS_T_C=file\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("QS_T_A", "env")
	t.Setenv("QS_T_B", "") // đặt rỗng vẫn tính là đã đặt
	t.Setenv("QS_T_C", "x")
	os.Unsetenv("QS_T_C")
	LoadDotenv(filepath.Join(t.TempDir(), "khong-co"), f)
	if a, b, c := os.Getenv("QS_T_A"), os.Getenv("QS_T_B"), os.Getenv("QS_T_C"); a != "env" || b != "" || c != "file" {
		t.Errorf("a=%q b=%q c=%q", a, b, c)
	}
}
