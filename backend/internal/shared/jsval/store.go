package jsval

import "time"

// S = s() của store_supa.js:28: v == null ? "" : String(v). Cùng ngữ nghĩa với Str; giữ tên riêng để dò theo mã Node.
func S(v any) string { return Str(v) }

// NowISO = nowIso() của store_supa.js:29: new Date().toISOString().
func NowISO() string { return ToISOString(time.Now()) }
