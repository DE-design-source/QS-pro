package config

import (
	"os"
	"regexp"
	"strings"

	"qspro-backend/internal/shared/jsval"
)

/* Đọc file .env ĐÚNG như gói dotenv 16 của Node (lib/main.js: parse + populate), vì bản Go dùng chung
   file ../.env với bản Node. Các thư viện .env của Go đọc khác ở những chỗ dễ gặp trong mật khẩu / URL:
   "#" liền sau giá trị, "$TÊN", dấu "\", dấu nháy ngược, và bỏ cả file khi có một dòng lạ. */

// \s của JS (gồm cả BOM U+FEFF nên file có BOM vẫn đọc được)
const jsWS = `[\s\x{000B}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]`

// LINE của dotenv, \s thay bằng lớp ký tự trắng của JS.
var reEnvLine = regexp.MustCompile(strings.ReplaceAll(
	"(?m)(?:^|^)\\s*(?:export\\s+)?([\\w.-]+)(?:\\s*=\\s*?|:\\s+?)(\\s*'(?:\\\\'|[^'])*'|\\s*\"(?:\\\\\"|[^\"])*\"|\\s*`(?:\\\\`|[^`])*`|[^#\\r\\n]+)?\\s*(?:#.*)?(?:$|$)",
	`\s`, jsWS))

var reCRLF = regexp.MustCompile(`\r\n?`)

type envPair struct{ Key, Value string }

// parseDotenv: dotenv.parse(src), giữ thứ tự xuất hiện.
func parseDotenv(src string) []envPair {
	src = reCRLF.ReplaceAllString(src, "\n")
	var out []envPair
	for _, m := range reEnvLine.FindAllStringSubmatch(src, -1) {
		v := jsval.Trim(m[2])
		quoted := byte(0)
		if v != "" {
			quoted = v[0]
		}
		// bỏ cặp nháy bao ngoài (cùng loại ở đầu và cuối)
		if len(v) >= 2 && (quoted == '\'' || quoted == '"' || quoted == '`') && v[len(v)-1] == quoted {
			v = v[1 : len(v)-1]
		}
		if quoted == '"' {
			v = strings.ReplaceAll(v, `\n`, "\n")
			v = strings.ReplaceAll(v, `\r`, "\r")
		}
		out = append(out, envPair{m[1], v})
	}
	return out
}

// LoadDotenv nạp backend/.env rồi ../.env (file cấu hình của bản Node); KHÔNG đè biến đã đặt sẵn
// (kể cả biến đặt rỗng), file không đọc được thì bỏ qua - như require('dotenv').config().
//
// DOTENV=0 (đặt trên dòng lệnh): không đọc file nào. Dùng khi chạy thử trên database tạm mà không muốn thừa hưởng
// webhook / khoá thật trong ../.env của bản Node.
func LoadDotenv(files ...string) {
	if os.Getenv("DOTENV") == "0" {
		return
	}
	if len(files) == 0 {
		files = []string{".env", "../.env"}
	}
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		for _, p := range parseDotenv(string(b)) {
			if _, set := os.LookupEnv(p.Key); !set {
				_ = os.Setenv(p.Key, p.Value)
			}
		}
	}
}
