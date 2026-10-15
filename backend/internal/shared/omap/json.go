package omap

import (
	"bytes"
	"encoding/json"
	"math"
	"reflect"
	"slices"
	"strconv"
	"time"
	"unicode/utf16"
	"unicode/utf8"
)

// SyntaxError: JSON đầu vào sai cú pháp.
type SyntaxError struct {
	Msg string
	Pos int
}

func (e *SyntaxError) Error() string {
	return "JSON không hợp lệ ở vị trí " + strconv.Itoa(e.Pos) + ": " + e.Msg
}

// ───────────── Số: định dạng như Number.prototype.toString của JS ─────────────

// FormatNumber trả chuỗi giống String(x) của JS (1e+21, 1e-7, "NaN", "Infinity", -0 -> "0").
func FormatNumber(f float64) string {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	case f == 0:
		return "0"
	}
	return string(appendNumber(make([]byte, 0, 24), f))
}

func appendNumber(dst []byte, f float64) []byte {
	if f < 0 {
		dst = append(dst, '-')
		f = -f
	}
	// số nguyên nhỏ: đường nhanh
	if f < 1e15 && f == math.Trunc(f) {
		return strconv.AppendInt(dst, int64(f), 10)
	}
	var buf [32]byte
	e := strconv.AppendFloat(buf[:0], f, 'e', -1, 64) // d.ddddde±XX
	// tách chữ số và số mũ
	ePos := bytes.IndexByte(e, 'e')
	exp, _ := strconv.Atoi(string(e[ePos+1:]))
	digits := make([]byte, 0, 20)
	for _, c := range e[:ePos] {
		if c != '.' {
			digits = append(digits, c)
		}
	}
	k := len(digits)
	n := exp + 1 // giá trị = 0.digits * 10^n
	switch {
	case k <= n && n <= 21:
		dst = append(dst, digits...)
		for i := 0; i < n-k; i++ {
			dst = append(dst, '0')
		}
	case 0 < n && n <= 21:
		dst = append(dst, digits[:n]...)
		dst = append(dst, '.')
		dst = append(dst, digits[n:]...)
	case -6 < n && n <= 0:
		dst = append(dst, '0', '.')
		for i := 0; i < -n; i++ {
			dst = append(dst, '0')
		}
		dst = append(dst, digits...)
	default:
		dst = append(dst, digits[0])
		if k > 1 {
			dst = append(dst, '.')
			dst = append(dst, digits[1:]...)
		}
		dst = append(dst, 'e')
		if n-1 >= 0 {
			dst = append(dst, '+')
		}
		dst = strconv.AppendInt(dst, int64(n-1), 10)
	}
	return dst
}

// ───────────── Ghi JSON (ngữ nghĩa JSON.stringify) ─────────────

// Marshal ghi v thành JSON giống JSON.stringify: không escape HTML, số theo kiểu JS,
// NaN / Infinity -> null, Undefined trong object bị bỏ, trong mảng thành null.
// Giá trị gốc là Undefined -> "null". Kiểu Go khác (struct...) đi qua encoding/json rồi chuẩn hoá lại.
func Marshal(v any) ([]byte, error) {
	return AppendJSON(make([]byte, 0, 256), v)
}

// MarshalString như Marshal nhưng trả string (tiện cho tham số SQL).
func MarshalString(v any) (string, error) {
	b, err := Marshal(v)
	return string(b), err
}

const hexDigits = "0123456789abcdef"

func appendString(dst []byte, s string) []byte {
	dst = append(dst, '"')
	start := 0
	for i := 0; i < len(s); {
		c := s[i]
		if c < utf8.RuneSelf {
			if c >= 0x20 && c != '"' && c != '\\' {
				i++
				continue
			}
			dst = append(dst, s[start:i]...)
			switch c {
			case '"':
				dst = append(dst, '\\', '"')
			case '\\':
				dst = append(dst, '\\', '\\')
			case '\n':
				dst = append(dst, '\\', 'n')
			case '\r':
				dst = append(dst, '\\', 'r')
			case '\t':
				dst = append(dst, '\\', 't')
			case '\b':
				dst = append(dst, '\\', 'b')
			case '\f':
				dst = append(dst, '\\', 'f')
			default:
				dst = append(dst, '\\', 'u', '0', '0', hexDigits[c>>4], hexDigits[c&0xf])
			}
			i++
			start = i
			continue
		}
		r, size := utf8.DecodeRuneInString(s[i:])
		if r == utf8.RuneError && size == 1 {
			dst = append(dst, s[start:i]...)
			dst = append(dst, "�"...)
			i += badLen(s[i:])
			start = i
			continue
		}
		i += size
	}
	dst = append(dst, s[start:]...)
	return append(dst, '"')
}

// AppendJSON nối JSON của v vào dst.
func AppendJSON(dst []byte, v any) ([]byte, error) {
	switch x := v.(type) {
	case nil:
		return append(dst, "null"...), nil
	case undefinedT:
		return append(dst, "null"...), nil
	case bool:
		if x {
			return append(dst, "true"...), nil
		}
		return append(dst, "false"...), nil
	case float64:
		if math.IsNaN(x) || math.IsInf(x, 0) {
			return append(dst, "null"...), nil
		}
		if x == 0 {
			return append(dst, '0'), nil
		}
		return appendNumber(dst, x), nil
	case string:
		return appendString(dst, x), nil
	case int:
		return strconv.AppendInt(dst, int64(x), 10), nil
	case int64:
		return strconv.AppendInt(dst, x, 10), nil
	case int32:
		return strconv.AppendInt(dst, int64(x), 10), nil
	case *Map:
		if x == nil {
			return append(dst, "null"...), nil
		}
		return appendMap(dst, x)
	case []any:
		if x == nil {
			return append(dst, "[]"...), nil
		}
		dst = append(dst, '[')
		start := len(dst)
		var err error
		for i, it := range x {
			if i > 0 {
				dst = append(dst, ',')
			}
			if dst, err = AppendJSON(dst, it); err != nil {
				return dst, err
			}
			dst = growRest(dst, start, i+1, len(x))
		}
		return append(dst, ']'), nil
	case []*Map:
		dst = append(dst, '[')
		start := len(dst)
		var err error
		for i, it := range x {
			if i > 0 {
				dst = append(dst, ',')
			}
			if dst, err = AppendJSON(dst, it); err != nil {
				return dst, err
			}
			dst = growRest(dst, start, i+1, len(x))
		}
		return append(dst, ']'), nil
	case []string:
		dst = append(dst, '[')
		for i, it := range x {
			if i > 0 {
				dst = append(dst, ',')
			}
			dst = appendString(dst, it)
		}
		return append(dst, ']'), nil
	case json.RawMessage:
		if len(x) == 0 {
			return append(dst, "null"...), nil
		}
		return append(dst, x...), nil
	case time.Time:
		return appendString(dst, ISOTime(x)), nil
	}
	// Kiểu Go bất kỳ (struct, map, slice có kiểu...): xem reflect.go
	return appendReflect(dst, reflect.ValueOf(v))
}

// growRest: mảng dài (danh mục sản phẩm, dòng bóc tách...) - cứ 8 phần tử xem bộ đệm có sắp hết chỗ không; sắp hết thì
// ước lượng phần còn lại từ cỡ trung bình đã ghi và nới MỘT lần cho đủ. Để append tự nới thì mỗi lần chỉ nới 1,25 lần
// và chép lại cả bộ đệm, tổng cấp phát gấp khoảng 5 lần thân JSON. Không đổi byte nào của kết quả.
func growRest(dst []byte, start, done, total int) []byte {
	if total < 32 || done&7 != 0 || done == total {
		return dst
	}
	avg := (len(dst) - start) / done
	free := cap(dst) - len(dst)
	if free >= 16*avg { // còn đủ cho 8 phần tử tới dù chúng to gấp đôi trung bình
		return dst
	}
	need := avg * (total - done)
	need += need/8 + 64
	if free >= need {
		return dst
	}
	return slices.Grow(dst, need)
}

func appendMap(dst []byte, m *Map) ([]byte, error) {
	dst = append(dst, '{')
	first := true
	var err error
	write := func(k string, v any) {
		if err != nil || IsUndefined(v) {
			return
		}
		if !first {
			dst = append(dst, ',')
		}
		first = false
		dst = appendString(dst, k)
		dst = append(dst, ':')
		dst, err = AppendJSON(dst, v)
	}
	m.Each(write)
	if err != nil {
		return dst, err
	}
	return append(dst, '}'), nil
}

// ───────────── Đọc JSON về JS value model ─────────────

// badLen: số byte của một đoạn UTF-8 hỏng bắt đầu ở s[0] được thay bằng MỘT U+FFFD - theo cách
// bộ giải mã của Node / trình duyệt làm (chuỗi cụt tính là một, không phải mỗi byte một).
func badLen[T string | []byte](s T) int {
	if len(s) == 0 {
		return 0
	}
	lo, hi, need := byte(0x80), byte(0xBF), 0
	switch c := s[0]; {
	case c >= 0xC2 && c <= 0xDF:
		need = 1
	case c == 0xE0:
		lo, need = 0xA0, 2
	case c == 0xED:
		hi, need = 0x9F, 2
	case c >= 0xE1 && c <= 0xEF:
		need = 2
	case c == 0xF0:
		lo, need = 0x90, 3
	case c == 0xF4:
		hi, need = 0x8F, 3
	case c >= 0xF1 && c <= 0xF3:
		need = 3
	}
	n := 1
	for ; n <= need && n < len(s); n++ {
		if s[n] < lo || s[n] > hi {
			break
		}
		lo, hi = 0x80, 0xBF
	}
	return n
}

// ToValidUTF8 thay mỗi đoạn byte không phải UTF-8 bằng U+FFFD như Buffer.toString('utf8') của Node.
// Dữ liệu đã hợp lệ thì trả nguyên (không sao chép).
func ToValidUTF8(b []byte) []byte {
	if utf8.Valid(b) {
		return b
	}
	out := make([]byte, 0, len(b)+16)
	for i := 0; i < len(b); {
		if b[i] < utf8.RuneSelf {
			out = append(out, b[i])
			i++
			continue
		}
		r, size := utf8.DecodeRune(b[i:])
		if r == utf8.RuneError && size == 1 {
			out = append(out, "�"...)
			i += badLen(b[i:])
			continue
		}
		out = append(out, b[i:i+size]...)
		i += size
	}
	return out
}

// Decode đọc JSON bất kỳ: object -> *Map (giữ thứ tự), mảng -> []any, số -> float64.
// Byte không phải UTF-8 được thay bằng U+FFFD trước khi đọc (Node giải mã thân request thành chuỗi rồi mới parse),
// nên chuỗi trả về luôn là UTF-8 hợp lệ - gửi xuống Postgres không bị lỗi 22021.
func Decode(b []byte) (any, error) {
	b = ToValidUTF8(b)
	p := &parser{b: b}
	p.ws()
	v, err := p.value(0, nil)
	if err != nil {
		return nil, err
	}
	p.ws()
	if p.i != len(p.b) {
		return nil, p.fail("thừa dữ liệu sau giá trị")
	}
	return v, nil
}

// DecodeString như Decode cho chuỗi.
func DecodeString(s string) (any, error) { return Decode([]byte(s)) }

// DecodeRows đọc 1 mảng JSON các object (kết quả truy vấn) thành []*Map.
func DecodeRows(b []byte) ([]*Map, error) {
	v, err := Decode(b)
	if err != nil {
		return nil, err
	}
	arr, ok := v.([]any)
	if !ok {
		return nil, &SyntaxError{Msg: "không phải mảng JSON"}
	}
	out := make([]*Map, 0, len(arr))
	for _, it := range arr {
		m, ok := it.(*Map)
		if !ok {
			return nil, &SyntaxError{Msg: "phần tử không phải object"}
		}
		out = append(out, m)
	}
	return out, nil
}

type parser struct {
	b []byte
	i int
}

const maxDepth = 2000

func (p *parser) fail(msg string) error { return &SyntaxError{Msg: msg, Pos: p.i} }

func (p *parser) ws() {
	for p.i < len(p.b) {
		switch p.b[p.i] {
		case ' ', '\t', '\n', '\r':
			p.i++
		default:
			return
		}
	}
}

func (p *parser) lit(s string, v any) (any, error) {
	if len(p.b)-p.i >= len(s) && string(p.b[p.i:p.i+len(s)]) == s {
		p.i += len(s)
		return v, nil
	}
	return nil, p.fail("ký tự lạ")
}

// value đọc 1 giá trị. prev: object đứng ngay trước trong cùng mảng (nil nếu không có) - các dòng của một kết quả truy
// vấn có cùng bộ khoá, nên object mới dùng chung bộ khoá (keys + idx) với prev thay vì lập lại (chỉ là tối ưu
// bộ nhớ: giá trị đọc ra không đổi).
func (p *parser) value(depth int, prev *Map) (any, error) {
	if p.i >= len(p.b) {
		return nil, p.fail("hết dữ liệu")
	}
	if depth > maxDepth {
		return nil, p.fail("lồng quá sâu")
	}
	switch c := p.b[p.i]; {
	case c == '{':
		p.i++
		p.ws()
		if p.i < len(p.b) && p.b[p.i] == '}' {
			p.i++
			return New(), nil
		}
		// Chừng nào các khoá còn trùng từng vị trí với prev thì chỉ gom giá trị vào vals; trùng hết -> dùng chung
		// keys / idx của prev. Lệch ở đâu thì dựng object riêng (m) từ đó.
		var m *Map
		var vals []any
		if prev != nil && len(prev.keys) > 0 {
			vals = make([]any, 0, len(prev.keys))
		} else {
			m = New()
		}
		for {
			p.ws()
			if p.i >= len(p.b) || p.b[p.i] != '"' {
				return nil, p.fail("thiếu tên khoá")
			}
			cand := ""
			if m == nil && len(vals) < len(prev.keys) {
				cand = prev.keys[len(vals)]
			}
			k, err := p.str(cand)
			if err != nil {
				return nil, err
			}
			p.ws()
			if p.i >= len(p.b) || p.b[p.i] != ':' {
				return nil, p.fail("thiếu dấu :")
			}
			p.i++
			p.ws()
			v, err := p.value(depth+1, nil)
			if err != nil {
				return nil, err
			}
			switch {
			case m != nil:
				m.Set(k, v)
			case len(vals) < len(prev.keys) && k == prev.keys[len(vals)]:
				vals = append(vals, v)
			default:
				m = prev.prefix(vals)
				m.Set(k, v)
			}
			p.ws()
			if p.i >= len(p.b) {
				return nil, p.fail("hết dữ liệu")
			}
			if p.b[p.i] == ',' {
				p.i++
				continue
			}
			if p.b[p.i] == '}' {
				p.i++
				switch {
				case m != nil:
				case len(vals) == len(prev.keys):
					prev.shared = true
					m = &Map{keys: prev.keys, vals: vals, idx: prev.idx, nIdx: prev.nIdx, shared: true}
				default:
					m = prev.prefix(vals)
				}
				return m, nil
			}
			return nil, p.fail("thiếu dấu , hoặc }")
		}
	case c == '[':
		p.i++
		arr := []any{}
		p.ws()
		if p.i < len(p.b) && p.b[p.i] == ']' {
			p.i++
			return arr, nil
		}
		var prevObj *Map
		for {
			p.ws()
			v, err := p.value(depth+1, prevObj)
			if err != nil {
				return nil, err
			}
			prevObj, _ = v.(*Map)
			arr = append(arr, v)
			p.ws()
			if p.i >= len(p.b) {
				return nil, p.fail("hết dữ liệu")
			}
			if p.b[p.i] == ',' {
				p.i++
				continue
			}
			if p.b[p.i] == ']' {
				p.i++
				return arr, nil
			}
			return nil, p.fail("thiếu dấu , hoặc ]")
		}
	case c == '"':
		return p.str("")
	case c == 't':
		return p.lit("true", true)
	case c == 'f':
		return p.lit("false", false)
	case c == 'n':
		return p.lit("null", nil)
	case c == '-' || (c >= '0' && c <= '9'):
		return p.num()
	}
	return nil, p.fail("ký tự lạ")
}

func (p *parser) num() (any, error) {
	s := p.i
	if p.b[p.i] == '-' {
		p.i++
	}
	if p.i >= len(p.b) {
		return nil, p.fail("số không hợp lệ")
	}
	if p.b[p.i] == '0' {
		p.i++
	} else if p.b[p.i] >= '1' && p.b[p.i] <= '9' {
		for p.i < len(p.b) && p.b[p.i] >= '0' && p.b[p.i] <= '9' {
			p.i++
		}
	} else {
		return nil, p.fail("số không hợp lệ")
	}
	if p.i < len(p.b) && p.b[p.i] == '.' {
		p.i++
		d := p.i
		for p.i < len(p.b) && p.b[p.i] >= '0' && p.b[p.i] <= '9' {
			p.i++
		}
		if p.i == d {
			return nil, p.fail("số không hợp lệ")
		}
	}
	if p.i < len(p.b) && (p.b[p.i] == 'e' || p.b[p.i] == 'E') {
		p.i++
		if p.i < len(p.b) && (p.b[p.i] == '+' || p.b[p.i] == '-') {
			p.i++
		}
		d := p.i
		for p.i < len(p.b) && p.b[p.i] >= '0' && p.b[p.i] <= '9' {
			p.i++
		}
		if p.i == d {
			return nil, p.fail("số không hợp lệ")
		}
	}
	f, err := strconv.ParseFloat(string(p.b[s:p.i]), 64)
	if err != nil { // tràn số: JS cho Infinity / 0, không báo lỗi
		if ne, ok := err.(*strconv.NumError); !ok || ne.Err != strconv.ErrRange {
			return nil, p.fail("số không hợp lệ")
		}
	}
	return f, nil
}

func hex4(b []byte) (rune, bool) {
	if len(b) < 4 {
		return 0, false
	}
	var r rune
	for _, c := range b[:4] {
		switch {
		case c >= '0' && c <= '9':
			r = r<<4 | rune(c-'0')
		case c >= 'a' && c <= 'f':
			r = r<<4 | rune(c-'a'+10)
		case c >= 'A' && c <= 'F':
			r = r<<4 | rune(c-'A'+10)
		default:
			return 0, false
		}
	}
	return r, true
}

// str đọc 1 chuỗi. cand khác rỗng: nếu chuỗi đọc được đúng bằng cand thì trả chính cand (khỏi cấp phát chuỗi mới).
func (p *parser) str(cand string) (string, error) {
	p.i++ // dấu " mở
	s := p.i
	// đường nhanh: không có escape
	for p.i < len(p.b) {
		c := p.b[p.i]
		if c == '"' {
			out := cand
			if cand == "" || string(p.b[s:p.i]) != cand {
				out = string(p.b[s:p.i])
			}
			p.i++
			return out, nil
		}
		if c == '\\' {
			break
		}
		if c < 0x20 {
			return "", p.fail("ký tự điều khiển trong chuỗi")
		}
		p.i++
	}
	buf := append(make([]byte, 0, p.i-s+32), p.b[s:p.i]...)
	for p.i < len(p.b) {
		c := p.b[p.i]
		switch {
		case c == '"':
			p.i++
			return string(buf), nil
		case c < 0x20:
			return "", p.fail("ký tự điều khiển trong chuỗi")
		case c != '\\':
			buf = append(buf, c)
			p.i++
		default:
			p.i++
			if p.i >= len(p.b) {
				return "", p.fail("hết dữ liệu")
			}
			e := p.b[p.i]
			p.i++
			switch e {
			case '"', '\\', '/':
				buf = append(buf, e)
			case 'b':
				buf = append(buf, '\b')
			case 'f':
				buf = append(buf, '\f')
			case 'n':
				buf = append(buf, '\n')
			case 'r':
				buf = append(buf, '\r')
			case 't':
				buf = append(buf, '\t')
			case 'u':
				r, ok := hex4(p.b[p.i:])
				if !ok {
					return "", p.fail("\\u không hợp lệ")
				}
				p.i += 4
				if utf16.IsSurrogate(r) {
					if p.i+6 <= len(p.b) && p.b[p.i] == '\\' && p.b[p.i+1] == 'u' {
						if r2, ok2 := hex4(p.b[p.i+2:]); ok2 {
							if dec := utf16.DecodeRune(r, r2); dec != utf8.RuneError {
								p.i += 6
								buf = utf8.AppendRune(buf, dec)
								continue
							}
						}
					}
					r = utf8.RuneError // surrogate lẻ: Go không giữ được
				}
				buf = utf8.AppendRune(buf, r)
			default:
				return "", p.fail("escape không hợp lệ")
			}
		}
	}
	return "", p.fail("chuỗi chưa đóng")
}
