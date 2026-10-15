// Package jsval: các phép ép kiểu / so sánh / định dạng GIỐNG HỆT JavaScript,
// để mọi module chuyển từ Node sang cho cùng kết quả (Number(x), String(x), x || y, toFixed...).
//
// JS value model: nil = null, jsval.Undefined = undefined, bool, float64, string, []any, *omap.Map.
// Số nguyên Go (int, int64...) được chấp nhận ở đầu vào và coi như number.
package jsval

import (
	"math"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
	"unicode/utf8"

	"qspro-backend/internal/shared/omap"
)

// Undefined: giá trị undefined của JS (cùng một giá trị với omap.Undefined).
var Undefined = omap.Undefined

// IsUndefined: v === undefined.
func IsUndefined(v any) bool { return omap.IsUndefined(v) }

// IsNullish: v == null (null hoặc undefined).
func IsNullish(v any) bool { return v == nil || omap.IsUndefined(v) || isNilPtr(v) }

func isNilPtr(v any) bool {
	switch x := v.(type) {
	case *omap.Map:
		return x == nil
	}
	return false
}

// asNum đổi các kiểu số của Go về float64.
func asNum(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case int:
		return float64(x), true
	case int64:
		return float64(x), true
	case int32:
		return float64(x), true
	case float32:
		return float64(x), true
	case uint:
		return float64(x), true
	case uint64:
		return float64(x), true
	case uint32:
		return float64(x), true
	}
	return 0, false
}

// TypeOf trả kết quả của toán tử typeof.
func TypeOf(v any) string {
	if IsUndefined(v) {
		return "undefined"
	}
	switch v.(type) {
	case nil:
		return "object"
	case bool:
		return "boolean"
	case string:
		return "string"
	}
	if _, ok := asNum(v); ok {
		return "number"
	}
	return "object"
}

// IsString / IsNumber / IsBool / IsArray / IsObject: kiểm kiểu nhanh.
func IsString(v any) bool { _, ok := v.(string); return ok }
func IsNumber(v any) bool { _, ok := asNum(v); return ok }
func IsBool(v any) bool   { _, ok := v.(bool); return ok }

// IsArray: Array.isArray(v).
func IsArray(v any) bool { _, ok := v.([]any); return ok }

// IsObject: v là object thường (không null, không mảng).
func IsObject(v any) bool { m, ok := v.(*omap.Map); return ok && m != nil }

// ───────────── Khoảng trắng theo JS ─────────────

func isJSSpace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff:
		return true
	}
	return r >= 0x2000 && r <= 0x200a
}

// Trim / TrimStart / TrimEnd: như String.prototype.trim* (bộ khoảng trắng của JS, khác strings.TrimSpace).
func Trim(s string) string      { return strings.TrimFunc(s, isJSSpace) }
func TrimStart(s string) string { return strings.TrimLeftFunc(s, isJSSpace) }
func TrimEnd(s string) string   { return strings.TrimRightFunc(s, isJSSpace) }

// ───────────── Number(x) ─────────────

var reDecimal = regexp.MustCompile(`^[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)$`)

func parseRadix(s string, radix int) (float64, bool) {
	if s == "" {
		return 0, false
	}
	f := 0.0
	for i := 0; i < len(s); i++ {
		d := digitVal(s[i])
		if d < 0 || d >= radix {
			return 0, false
		}
		f = f*float64(radix) + float64(d)
	}
	return f, true
}

func digitVal(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'z':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'Z':
		return int(c-'A') + 10
	}
	return -1
}

func parseDec(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64) // tràn -> ±Inf, hụt -> 0: đúng như JS
	return f
}

func stringToNumber(s string) float64 {
	s = Trim(s)
	if s == "" {
		return 0
	}
	switch s {
	case "Infinity", "+Infinity":
		return math.Inf(1)
	case "-Infinity":
		return math.Inf(-1)
	}
	if len(s) > 2 && s[0] == '0' {
		radix := 0
		switch s[1] {
		case 'x', 'X':
			radix = 16
		case 'o', 'O':
			radix = 8
		case 'b', 'B':
			radix = 2
		}
		if radix != 0 {
			if f, ok := parseRadix(s[2:], radix); ok {
				return f
			}
			return math.NaN()
		}
	}
	if !reDecimal.MatchString(s) {
		return math.NaN()
	}
	return parseDec(s)
}

// ToNumber: Number(v).
func ToNumber(v any) float64 {
	if f, ok := asNum(v); ok {
		return f
	}
	switch x := v.(type) {
	case nil:
		return 0
	case bool:
		if x {
			return 1
		}
		return 0
	case string:
		return stringToNumber(x)
	case []any:
		return stringToNumber(ToString(x))
	case *omap.Map:
		if x == nil {
			return 0
		}
	}
	return math.NaN() // undefined, object
}

// Num0: Number(v) || 0  (NaN -> 0).
func Num0(v any) float64 {
	f := ToNumber(v)
	if math.IsNaN(f) || f == 0 { // -0 cũng là falsy: -0 || 0 = +0
		return 0
	}
	return f
}

// NumOr: Number(v) || def.
func NumOr(v any, def float64) float64 {
	f := ToNumber(v)
	if math.IsNaN(f) || f == 0 {
		return def
	}
	return f
}

// ───────────── String(x) ─────────────

// NumberToString: String(f) cho số.
func NumberToString(f float64) string { return omap.FormatNumber(f) }

// ToString: String(v). Mảng nối bằng dấu phẩy (null / undefined thành rỗng), object -> "[object Object]".
func ToString(v any) string {
	if f, ok := asNum(v); ok {
		return omap.FormatNumber(f)
	}
	switch x := v.(type) {
	case nil:
		return "null"
	case string:
		return x
	case bool:
		if x {
			return "true"
		}
		return "false"
	case []any:
		var sb strings.Builder
		for i, it := range x {
			if i > 0 {
				sb.WriteByte(',')
			}
			if !IsNullish(it) {
				sb.WriteString(ToString(it))
			}
		}
		return sb.String()
	case *omap.Map:
		if x == nil {
			return "null"
		}
		return "[object Object]"
	}
	if IsUndefined(v) {
		return "undefined"
	}
	return "[object Object]"
}

// Str: String(v ?? "") - null / undefined thành chuỗi rỗng.
func Str(v any) string {
	if IsNullish(v) {
		return ""
	}
	return ToString(v)
}

// StrOr: String(v || def).
func StrOr(v any, def string) string {
	if !Truthy(v) {
		return def
	}
	return ToString(v)
}

// AsString: v nếu là string, ngược lại "".
func AsString(v any) string { s, _ := v.(string); return s }

// ───────────── Truthiness ─────────────

// Truthy: !!v.
func Truthy(v any) bool {
	if f, ok := asNum(v); ok {
		return f != 0 && !math.IsNaN(f)
	}
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case *omap.Map:
		return x != nil
	}
	return !IsUndefined(v)
}

// Or: a || b || c ... (giá trị truthy đầu tiên, không có thì giá trị cuối).
func Or(vals ...any) any {
	for _, v := range vals {
		if Truthy(v) {
			return v
		}
	}
	if len(vals) == 0 {
		return Undefined
	}
	return vals[len(vals)-1]
}

// And: a && b && c ... (giá trị falsy đầu tiên, không có thì giá trị cuối).
func And(vals ...any) any {
	for _, v := range vals {
		if !Truthy(v) {
			return v
		}
	}
	if len(vals) == 0 {
		return Undefined
	}
	return vals[len(vals)-1]
}

// Coalesce: a ?? b ?? c ... (giá trị khác null / undefined đầu tiên).
func Coalesce(vals ...any) any {
	for _, v := range vals {
		if !IsNullish(v) {
			return v
		}
	}
	if len(vals) == 0 {
		return Undefined
	}
	return vals[len(vals)-1]
}

// ───────────── So sánh ─────────────

// StrictEquals: a === b. Object / mảng so theo tham chiếu.
func StrictEquals(a, b any) bool {
	if fa, ok := asNum(a); ok {
		fb, ok2 := asNum(b)
		return ok2 && fa == fb
	}
	switch x := a.(type) {
	case nil:
		return b == nil
	case bool:
		y, ok := b.(bool)
		return ok && x == y
	case string:
		y, ok := b.(string)
		return ok && x == y
	case *omap.Map:
		y, ok := b.(*omap.Map)
		return ok && x == y
	case []any:
		y, ok := b.([]any)
		return ok && len(x) == len(y) && len(x) > 0 && &x[0] == &y[0]
	}
	return IsUndefined(a) && IsUndefined(b)
}

// LooseEquals: a == b.
func LooseEquals(a, b any) bool {
	if IsNullish(a) || IsNullish(b) {
		return IsNullish(a) && IsNullish(b)
	}
	if TypeOf(a) == TypeOf(b) {
		return StrictEquals(a, b)
	}
	if x, ok := a.(bool); ok {
		return LooseEquals(ToNumber(x), b)
	}
	if y, ok := b.(bool); ok {
		return LooseEquals(a, ToNumber(y))
	}
	ta, tb := TypeOf(a), TypeOf(b)
	if ta == "object" { // ToPrimitive: mảng / object thành chuỗi
		return LooseEquals(ToString(a), b)
	}
	if tb == "object" {
		return LooseEquals(a, ToString(b))
	}
	return ToNumber(a) == ToNumber(b) // number với string
}

// ───────────── parseFloat / parseInt / Math.round / toFixed ─────────────

var rePrefixFloat = regexp.MustCompile(`^[+-]?(?:Infinity|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)`)

// ParseFloat: parseFloat(v).
func ParseFloat(v any) float64 {
	if f, ok := asNum(v); ok {
		if f == 0 { // parseFloat(-0) đi qua String(-0) = "0"
			return 0
		}
		return f
	}
	s := TrimStart(ToString(v))
	m := rePrefixFloat.FindString(s)
	if m == "" {
		return math.NaN()
	}
	switch m {
	case "Infinity", "+Infinity":
		return math.Inf(1)
	case "-Infinity":
		return math.Inf(-1)
	}
	return parseDec(m)
}

// ParseInt: parseInt(v, radix). radix = 0 nghĩa là không truyền (tự nhận 0x).
func ParseInt(v any, radix int) float64 {
	s := TrimStart(ToString(v))
	neg := false
	if s != "" && (s[0] == '+' || s[0] == '-') {
		neg = s[0] == '-'
		s = s[1:]
	}
	if radix != 0 && (radix < 2 || radix > 36) {
		return math.NaN()
	}
	if (radix == 0 || radix == 16) && len(s) >= 2 && s[0] == '0' && (s[1] == 'x' || s[1] == 'X') {
		s = s[2:]
		radix = 16
	}
	if radix == 0 {
		radix = 10
	}
	n := 0
	for n < len(s) {
		d := digitVal(s[n])
		if d < 0 || d >= radix {
			break
		}
		n++
	}
	if n == 0 {
		return math.NaN()
	}
	var f float64
	if radix == 10 {
		f = parseDec(s[:n])
	} else {
		f, _ = parseRadix(s[:n], radix)
	}
	if neg {
		return -f
	}
	return f
}

// Round: Math.round(x) - .5 làm tròn LÊN (về phía +Infinity), kể cả số âm.
func Round(x float64) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return x
	}
	f := math.Floor(x)
	if x-f >= 0.5 {
		f++
	}
	if f == 0 && (x < 0 || math.Signbit(x)) {
		return math.Copysign(0, -1)
	}
	return f
}

// RoundTo: Math.round(x * 10^d) / 10^d - mẫu làm tròn hay gặp trong mã Node.
func RoundTo(x float64, d int) float64 {
	p := math.Pow(10, float64(d))
	return Round(x*p) / p
}

// ToFixed: x.toFixed(digits).
func ToFixed(x float64, digits int) string {
	if math.IsNaN(x) {
		return "NaN"
	}
	if math.Abs(x) >= 1e21 || math.IsInf(x, 0) {
		return omap.FormatNumber(x)
	}
	neg := x < 0
	if neg {
		x = -x
	}
	// làm tròn nửa-lên trên GIÁ TRỊ CHÍNH XÁC của số thực (như đặc tả ECMAScript)
	r := new(big.Rat).SetFloat64(x)
	pow := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits)), nil)
	r.Mul(r, new(big.Rat).SetInt(pow))
	r.Add(r, big.NewRat(1, 2))
	n := new(big.Int).Quo(r.Num(), r.Denom())
	s := n.String()
	if digits > 0 {
		if len(s) <= digits {
			s = strings.Repeat("0", digits-len(s)+1) + s
		}
		s = s[:len(s)-digits] + "." + s[len(s)-digits:]
	}
	if neg {
		return "-" + s
	}
	return s
}

// ───────────── toLocaleString('vi-VN') ─────────────

// FormatVN: x.toLocaleString('vi-VN') - nhóm nghìn bằng ".", thập phân bằng ",", tối đa 3 số lẻ.
func FormatVN(x float64) string { return FormatLocale(x, 0, 3, ".", ",") }

// FormatVNFrac: x.toLocaleString('vi-VN', {minimumFractionDigits, maximumFractionDigits}).
func FormatVNFrac(x float64, minFrac, maxFrac int) string {
	return FormatLocale(x, minFrac, maxFrac, ".", ",")
}

// FormatEN: x.toLocaleString('en-US').
func FormatEN(x float64) string { return FormatLocale(x, 0, 3, ",", ".") }

// FormatLocale: lõi của toLocaleString - làm tròn nửa-ra-xa-0 trên dạng thập phân ngắn nhất của số.
func FormatLocale(x float64, minFrac, maxFrac int, group, dec string) string {
	if math.IsNaN(x) {
		return "NaN"
	}
	sign := ""
	if math.Signbit(x) {
		sign = "-"
		x = -x
	}
	if math.IsInf(x, 0) {
		return sign + "∞"
	}
	if maxFrac < minFrac {
		maxFrac = minFrac
	}
	e := strconv.FormatFloat(x, 'e', -1, 64)
	ePos := strings.IndexByte(e, 'e')
	exp, _ := strconv.Atoi(e[ePos+1:])
	digits := strings.Replace(e[:ePos], ".", "", 1)
	n := exp + 1
	var ip, fp string
	switch {
	case n <= 0:
		ip, fp = "0", strings.Repeat("0", -n)+digits
	case len(digits) <= n:
		ip = digits + strings.Repeat("0", n-len(digits))
	default:
		ip, fp = digits[:n], digits[n:]
	}
	if len(fp) > maxFrac {
		up := fp[maxFrac] >= '5'
		fp = fp[:maxFrac]
		if up {
			all := []byte(ip + fp)
			i := len(all) - 1
			for ; i >= 0; i-- {
				if all[i] == '9' {
					all[i] = '0'
					continue
				}
				all[i]++
				break
			}
			s := string(all)
			if i < 0 {
				s = "1" + s
			}
			ip, fp = s[:len(s)-maxFrac], s[len(s)-maxFrac:]
		}
	}
	for len(fp) > minFrac && fp[len(fp)-1] == '0' {
		fp = fp[:len(fp)-1]
	}
	if len(fp) < minFrac {
		fp += strings.Repeat("0", minFrac-len(fp))
	}
	var sb strings.Builder
	sb.WriteString(sign)
	for i := 0; i < len(ip); i++ {
		if i > 0 && (len(ip)-i)%3 == 0 {
			sb.WriteString(group)
		}
		sb.WriteByte(ip[i])
	}
	if fp != "" {
		sb.WriteString(dec)
		sb.WriteString(fp)
	}
	return sb.String()
}

// ───────────── Thời gian ─────────────

// ToISOString: date.toISOString() - UTC, đúng 3 chữ số mili giây.
func ToISOString(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

// NowMs: Date.now().
func NowMs() float64 { return float64(time.Now().UnixMilli()) }

// FromMs: new Date(ms).
func FromMs(ms float64) time.Time { return time.UnixMilli(int64(ms)).UTC() }

// ───────────── encodeURIComponent / decodeURIComponent ─────────────

func uriUnreserved(c byte) bool {
	switch {
	case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9':
		return true
	}
	switch c {
	case '-', '_', '.', '!', '~', '*', '\'', '(', ')':
		return true
	}
	return false
}

// EncodeURIComponent: encodeURIComponent(String(v)).
func EncodeURIComponent(v any) string {
	s := ToString(v)
	const up = "0123456789ABCDEF"
	var sb strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if uriUnreserved(c) {
			sb.WriteByte(c)
		} else {
			sb.WriteByte('%')
			sb.WriteByte(up[c>>4])
			sb.WriteByte(up[c&0xf])
		}
	}
	return sb.String()
}

// URIError: decodeURIComponent gặp chuỗi sai (JS ném URIError).
type URIError struct{}

func (URIError) Error() string { return "URI malformed" }

// DecodeURIComponent: decodeURIComponent(s); chuỗi %XX sai hoặc không phải UTF-8 -> URIError.
func DecodeURIComponent(s string) (string, error) {
	if strings.IndexByte(s, '%') < 0 {
		return s, nil
	}
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); {
		if s[i] != '%' {
			out = append(out, s[i])
			i++
			continue
		}
		// gom cả cụm %XX liền nhau rồi kiểm tra UTF-8 một lần
		start := len(out)
		for i < len(s) && s[i] == '%' {
			if i+2 >= len(s) {
				return "", URIError{}
			}
			h, l := digitVal(s[i+1]), digitVal(s[i+2])
			if h < 0 || h > 15 || l < 0 || l > 15 {
				return "", URIError{}
			}
			out = append(out, byte(h<<4|l))
			i += 3
		}
		if !utf8.Valid(out[start:]) {
			return "", URIError{}
		}
	}
	return string(out), nil
}

// ───────────── Chuỗi theo đơn vị UTF-16 (length / slice / substring của JS) ─────────────

func isASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] >= utf8.RuneSelf {
			return false
		}
	}
	return true
}

// Len16: s.length.
func Len16(s string) int {
	if isASCII(s) {
		return len(s)
	}
	n := 0
	for _, r := range s {
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
	}
	return n
}

func cut16(s string, a, b int) string {
	if a >= b {
		return ""
	}
	if isASCII(s) {
		return s[a:b]
	}
	u := utf16.Encode([]rune(s))
	return string(utf16.Decode(u[a:b]))
}

// Slice: s.slice(start, end). Bỏ end = tới hết chuỗi. Chỉ số âm tính từ cuối.
func Slice(s string, start int, end ...int) string {
	n := Len16(s)
	rel := func(i int) int {
		if i < 0 {
			i += n
			if i < 0 {
				i = 0
			}
		} else if i > n {
			i = n
		}
		return i
	}
	e := n
	if len(end) > 0 {
		e = rel(end[0])
	}
	return cut16(s, rel(start), e)
}

// Substring: s.substring(start, end) - chỉ số âm coi là 0, start > end thì đổi chỗ.
func Substring(s string, start int, end ...int) string {
	n := Len16(s)
	clamp := func(i int) int {
		if i < 0 {
			return 0
		}
		if i > n {
			return n
		}
		return i
	}
	a, b := clamp(start), n
	if len(end) > 0 {
		b = clamp(end[0])
	}
	if a > b {
		a, b = b, a
	}
	return cut16(s, a, b)
}

// ───────────── Đọc giá trị lồng nhau ─────────────

// AsMap: v nếu là object, ngược lại nil (đọc trên nil vẫn an toàn).
func AsMap(v any) *omap.Map { m, _ := v.(*omap.Map); return m }

// AsArray: v nếu là mảng, ngược lại nil.
func AsArray(v any) []any { a, _ := v.([]any); return a }

// Get: v[key] - object lấy theo khoá, mảng lấy theo chỉ số; không có -> Undefined.
func Get(v any, key string) any {
	switch x := v.(type) {
	case *omap.Map:
		return x.Val(key)
	case []any:
		if key == "length" {
			return float64(len(x))
		}
		if i, err := strconv.Atoi(key); err == nil && i >= 0 && i < len(x) && strconv.Itoa(i) == key {
			return x[i]
		}
	case string:
		if key == "length" {
			return float64(Len16(x))
		}
	}
	return Undefined
}

// GetPath: v?.a?.b?.c - đi theo từng khoá, đứt ở đâu trả Undefined ở đó.
func GetPath(v any, keys ...string) any {
	for _, k := range keys {
		if IsNullish(v) {
			return Undefined
		}
		v = Get(v, k)
	}
	return v
}

// Rows đổi []*omap.Map thành []any (để đặt vào object / trả về client).
func Rows(rows []*omap.Map) []any {
	out := make([]any, len(rows))
	for i, r := range rows {
		out[i] = r
	}
	return out
}
