package specs

import "embed"

// Mã nguồn JS (UMD) của 3 spec, khôi phục nguyên văn từ public/ của app Node cũ. Đây là NGUỒN DUY NHẤT của
// thông số ngành: giao diện nạp chính các file này (module categories phục vụ ở /vs-spec.js, /son-spec.js,
// /ct-spec.js), còn data/*.json + testdata/golden.json sinh từ chúng bằng scripts/gen-specs.js.
//
//go:embed js/vs-spec.js js/son-spec.js js/ct-spec.js
var jsFS embed.FS

// SourceFiles: tên 3 file spec theo thứ tự vs, son, ct.
var SourceFiles = []string{"vs-spec.js", "son-spec.js", "ct-spec.js"}

// Source trả nội dung file spec (vd "vs-spec.js"); không có -> nil.
func Source(file string) []byte {
	b, err := jsFS.ReadFile("js/" + file)
	if err != nil {
		return nil
	}
	return b
}
