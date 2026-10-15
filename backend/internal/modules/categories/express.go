package categories

import (
	"crypto/sha1"
	"encoding/base64"
	"errors"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/gin-gonic/gin"

	"qspro-backend/internal/shared/jsval"
)

// File này tái hiện 2 hành vi của Express 4 mà gói dùng chung chưa có: res.send() cho thân KHÔNG phải JSON
// và req.query (thư viện qs). internal/modules/files có bản chép y hệt (module không import lẫn nhau).

// etagYeu: ETag yếu của Express - W/"<độ dài hex>-<27 ký tự đầu của sha1 base64>".
func etagYeu(b []byte) string {
	if len(b) == 0 {
		return `W/"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"`
	}
	sum := sha1.Sum(b)
	return `W/"` + strconv.FormatInt(int64(len(b)), 16) + "-" + base64.StdEncoding.EncodeToString(sum[:])[:27] + `"`
}

var reNoCache = regexp.MustCompile(`(?:^|,)\s*?no-cache\s*?(?:,|$)`)

// headerGop = req.headers[tên] của Node cho header được phép lặp: các dòng trùng tên nối bằng ", ".
func headerGop(r *http.Request, ten string) string {
	return strings.Join(r.Header.Values(ten), ", ")
}

// tokenList = parseTokenList của fresh: tách theo dấu phẩy, bỏ khoảng trắng (0x20) ở đầu mỗi phần và cuối chuỗi con.
func tokenList(s string) []string {
	var list []string
	start, end := 0, 0
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case ' ':
			if start == end {
				start, end = i+1, i+1
			}
		case ',':
			list = append(list, s[start:end])
			start, end = i+1, i+1
		default:
			end = i + 1
		}
	}
	return append(list, s[start:end])
}

// fresh = req.fresh (thư viện fresh 0.5.2): client đã có đúng bản này chưa.
func fresh(r *http.Request, h http.Header) bool {
	// Node chỉ giữ dòng If-Modified-Since đầu tiên, còn If-None-Match / Cache-Control lặp thì nối lại
	since, none := r.Header.Get("If-Modified-Since"), headerGop(r, "If-None-Match")
	if since == "" && none == "" {
		return false
	}
	if cc := headerGop(r, "Cache-Control"); cc != "" && reNoCache.MatchString(cc) {
		return false
	}
	if none != "" && none != "*" {
		tag := h.Get("ETag")
		if tag == "" {
			return false
		}
		khop := false
		for _, m := range tokenList(none) {
			if m == tag || m == "W/"+tag || "W/"+m == tag {
				khop = true
				break
			}
		}
		if !khop {
			return false
		}
	}
	if since != "" {
		last := h.Get("Last-Modified")
		if last == "" {
			return false
		}
		tl, err1 := http.ParseTime(last)
		ts, err2 := http.ParseTime(since)
		if err1 != nil || err2 != nil || tl.After(ts) {
			return false
		}
	}
	return true
}

// send = res.status(status).send(body): header Content-Type đã đặt thì giữ, chưa thì dùng macDinh; thêm ETag yếu,
// Content-Length; GET / HEAD mà client đã có đúng bản này -> 304 không thân.
func send(c *gin.Context, status int, macDinh string, body []byte) {
	h := c.Writer.Header()
	if h.Get("Content-Type") == "" {
		h.Set("Content-Type", macDinh)
	}
	if h.Get("ETag") == "" {
		h.Set("ETag", etagYeu(body))
	}
	if m := c.Request.Method; (m == http.MethodGet || m == http.MethodHead) && ((status >= 200 && status < 300) || status == 304) && fresh(c.Request, h) {
		h.Del("Content-Type")
		h.Del("Content-Length")
		h.Del("Transfer-Encoding")
		c.Status(http.StatusNotModified)
		c.Writer.WriteHeaderNow()
		return
	}
	h.Set("Content-Length", strconv.Itoa(len(body)))
	c.Status(status)
	_, _ = c.Writer.Write(body) // HEAD: net/http tự bỏ thân, vẫn giữ Content-Length như Express
}

// sendText = res.status(status).send("chuỗi"): Express gắn text/html; charset=utf-8 cho chuỗi.
func sendText(c *gin.Context, status int, msg string) {
	send(c, status, "text/html; charset=utf-8", []byte(msg))
}

// queryVal: giá trị req.query[key] thu gọn về thứ nơi gọi cần - !!giá trị và String(giá trị).
// Err khác nil = String(giá trị) ném TypeError bên Node (object có khoá riêng "toString", vd ?hm[toString]=x).
type queryVal struct {
	Str    string
	Truthy bool
	Err    error
}

// errPrimitive: thông báo của V8 khi String() gặp object có toString không gọi được.
var errPrimitive = errors.New("Cannot convert object to primitive value")

// rawQuery = phần query Express thật sự đọc: client thô gửi kèm "#..." thì parseurl cắt bỏ từ dấu "#",
// còn net/http giữ nguyên trong RawQuery.
func rawQuery(r *http.Request) string {
	q, _, _ := strings.Cut(r.URL.RawQuery, "#")
	return q
}

// expressQuery đọc req.query[key] như Express 4.22 (qs 6.15, qs.parse(str, {allowPrototypes: true, arrayLimit: 1000})).
func expressQuery(raw, key string) queryVal {
	v, ok := qsParse(raw).m[key]
	if !ok {
		return queryVal{}
	}
	s, err := qsString(v)
	if str, isStr := v.(string); isStr {
		return queryVal{Str: str, Truthy: str != ""}
	}
	return queryVal{Str: s, Truthy: true, Err: err}
}

// ---- Bản chuyển từng dòng của qs/lib/parse.js + utils.js (chỉ các nhánh ứng với tuỳ chọn của Express) ----

const qsArrayLimit = 1000 // arrayLimit Express truyền cho qs; parameterLimit mặc định của qs cũng là 1000

// qsHole: ô trống của mảng thưa JS (a[2]=x tạo mảng có 2 ô trống phía trước).
type qsHole struct{}

var hole = qsHole{}

// qsArr: mảng JS. qsObj: object JS; over / max = dấu "overflow" của qs (mảng vượt arrayLimit bị đổi thành object).
type qsArr struct{ a []any }

type qsObj struct {
	keys []string
	m    map[string]any
	over bool
	max  float64
}

func newQsObj() *qsObj { return &qsObj{m: map[string]any{}} }

func (o *qsObj) set(k string, v any) {
	if _, ok := o.m[k]; !ok {
		o.keys = append(o.keys, k)
	}
	o.m[k] = v
}

// jsKeys = Object.keys(o): khoá dạng chỉ số mảng trước (tăng dần), rồi các khoá khác theo thứ tự thêm.
func (o *qsObj) jsKeys() []string {
	var so, chu []string
	for _, k := range o.keys {
		if n, ok := chiSo(k); ok && n < 4294967295 {
			so = append(so, k)
		} else {
			chu = append(chu, k)
		}
	}
	sort.SliceStable(so, func(i, j int) bool {
		a, _ := chiSo(so[i])
		b, _ := chiSo(so[j])
		return a < b
	})
	return append(so, chu...)
}

// chiSo: String(parseInt(s, 10)) === s && số >= 0 - chuỗi số thập phân chính tắc ("01", "-0", "1e3" đều không phải).
func chiSo(s string) (float64, bool) {
	if s == "" || (len(s) > 1 && s[0] == '0') {
		return 0, false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return 0, false
		}
	}
	n, err := strconv.ParseFloat(s, 64)
	if err != nil || jsval.ToString(n) != s {
		return 0, false
	}
	return n, true
}

// parseIntJS = parseInt(s, 10).
func parseIntJS(s string) float64 {
	const bom = rune(0xFEFF) // JS coi BOM là khoảng trắng
	s = strings.TrimLeftFunc(s, func(r rune) bool { return unicode.IsSpace(r) || r == bom })
	am := false
	if s != "" && (s[0] == '+' || s[0] == '-') {
		am = s[0] == '-'
		s = s[1:]
	}
	i := 0
	for i < len(s) && s[i] >= '0' && s[i] <= '9' {
		i++
	}
	if i == 0 {
		return math.NaN()
	}
	n, _ := strconv.ParseFloat(s[:i], 64)
	if am {
		n = -n
	}
	return n
}

func numKey(n float64) string { return jsval.ToString(n) }

// qsDecode = utils.decode: "+" thành khoảng trắng rồi decodeURIComponent; chuỗi hỏng thì giữ nguyên.
func qsDecode(s string) string {
	s = strings.ReplaceAll(s, "+", " ")
	if d, err := jsval.DecodeURIComponent(s); err == nil {
		return d
	}
	return s
}

func isOverflow(v any) bool {
	o, ok := v.(*qsObj)
	return ok && o.over
}

func isObjLike(v any) bool {
	switch v.(type) {
	case *qsArr, *qsObj:
		return true
	}
	return false
}

// arrayToObject = utils.arrayToObject: bỏ ô trống.
func arrayToObject(a []any) *qsObj {
	o := newQsObj()
	for i, v := range a {
		if v != hole && v != nil {
			o.set(strconv.Itoa(i), v)
		}
	}
	return o
}

func overflowTu(a []any, max int) *qsObj {
	o := arrayToObject(a)
	o.over, o.max = true, float64(max)
	return o
}

// concat = [].concat(...vs): mảng được trải 1 tầng (giữ ô trống), thứ khác thành 1 phần tử.
func concat(vs ...any) []any {
	out := []any{}
	for _, v := range vs {
		if a, ok := v.(*qsArr); ok {
			out = append(out, a.a...)
		} else {
			out = append(out, v)
		}
	}
	return out
}

// combine = utils.combine(a, b, arrayLimit).
func combine(a, b any) any {
	if o, ok := a.(*qsObj); ok && o.over {
		o.max++
		o.set(numKey(o.max), b)
		return o
	}
	res := concat(a, b)
	if len(res) > qsArrayLimit {
		return overflowTu(res, len(res)-1)
	}
	return &qsArr{res}
}

// merge = utils.merge(target, source, options) với strictMerge = true, allowPrototypes = true.
func merge(target, source any) any {
	if source == nil || source == "" {
		return target
	}
	if s, ok := source.(string); ok {
		switch t := target.(type) {
		case *qsArr:
			n := len(t.a)
			if n >= qsArrayLimit {
				return overflowTu(concat(t, s), n)
			}
			t.a = append(t.a, s)
			return t
		case *qsObj:
			if t.over {
				t.max++
				t.set(numKey(t.max), s)
				return t
			}
			return &qsArr{[]any{t, s}}
		}
		return &qsArr{[]any{target, s}}
	}

	tArr, tLaMang := target.(*qsArr)
	tObj, tLaObj := target.(*qsObj)
	sArr, sLaMang := source.(*qsArr)
	sObj, _ := source.(*qsObj)
	if !tLaMang && !tLaObj {
		if sObj != nil && sObj.over {
			res := newQsObj()
			res.set("0", target)
			for _, k := range sObj.jsKeys() {
				res.set(numKey(parseIntJS(k)+1), sObj.m[k])
			}
			res.over, res.max = true, sObj.max+1
			return res
		}
		com := concat(&qsArr{[]any{target}}, source)
		if len(com) > qsArrayLimit {
			return overflowTu(com, len(com)-1)
		}
		return &qsArr{com}
	}

	acc := tObj
	if tLaMang {
		if sLaMang {
			for i, item := range sArr.a {
				if item == hole {
					continue
				}
				if i < len(tArr.a) && tArr.a[i] != hole {
					if ti := tArr.a[i]; isObjLike(ti) && isObjLike(item) {
						tArr.a[i] = merge(ti, item)
					} else {
						tArr.a = append(tArr.a, item)
					}
				} else {
					for len(tArr.a) <= i {
						tArr.a = append(tArr.a, hole)
					}
					tArr.a[i] = item
				}
			}
			if len(tArr.a) > qsArrayLimit {
				return overflowTu(tArr.a, len(tArr.a)-1)
			}
			return tArr
		}
		acc = arrayToObject(tArr.a)
	}

	var keys []string
	val := func(k string) any { return sObj.m[k] }
	if sLaMang {
		for i, item := range sArr.a {
			if item != hole {
				keys = append(keys, strconv.Itoa(i))
			}
		}
		val = func(k string) any { i, _ := strconv.Atoi(k); return sArr.a[i] }
	} else {
		keys = sObj.jsKeys()
	}
	for _, k := range keys {
		v := val(k)
		if cu, ok := acc.m[k]; ok {
			acc.set(k, merge(cu, v))
		} else {
			acc.set(k, v)
		}
		if sObj != nil && sObj.over && !acc.over {
			acc.over, acc.max = true, sObj.max
		}
		if acc.over {
			if n, ok := chiSo(k); ok && n > acc.max {
				acc.max = n
			}
		}
	}
	return acc
}

// splitKey = splitKeyIntoSegments với depth = 5: "a[b][c]" -> ["a", "[b]", "[c]"].
func splitKey(key string) []string {
	var segs []string
	first := strings.IndexByte(key, '[')
	parent := key
	if first >= 0 {
		parent = key[:first]
	}
	if parent != "" {
		segs = append(segs, parent)
	}
	open, collected := first, 0
	for open >= 0 && collected < 5 {
		level, dong := 1, -1
		for i := open + 1; i < len(key) && dong < 0; i++ {
			switch key[i] {
			case '[':
				level++
			case ']':
				level--
				if level == 0 {
					dong = i
				}
			}
		}
		if dong < 0 { // ngoặc không đóng: phần còn lại thành 1 khoá nguyên văn
			return append(segs, "["+key[open:]+"]")
		}
		segs = append(segs, key[open:dong+1])
		collected++
		if j := strings.IndexByte(key[dong+1:], '['); j >= 0 {
			open = dong + 1 + j
		} else {
			open = -1
		}
	}
	if open >= 0 {
		segs = append(segs, "["+key[open:]+"]")
	}
	return segs
}

// parseObject = parseObject(chain, val, options, true): dựng giá trị lồng từ trong ra ngoài.
func parseObject(chain []string, leaf any) any {
	for i := len(chain) - 1; i >= 0; i-- {
		root := chain[i]
		if root == "[]" {
			if !isOverflow(leaf) {
				leaf = combine(&qsArr{}, leaf)
			}
			continue
		}
		clean := root
		if len(root) >= 2 && root[0] == '[' && root[len(root)-1] == ']' {
			clean = root[1 : len(root)-1]
		}
		n, hopLe := chiSo(clean)
		hopLe = hopLe && root != clean
		switch {
		case hopLe && n < qsArrayLimit:
			a := make([]any, int(n)+1)
			for j := range a {
				a[j] = hole
			}
			a[int(n)] = leaf
			leaf = &qsArr{a}
		case hopLe:
			o := newQsObj()
			o.set(clean, leaf)
			o.over, o.max = true, n
			leaf = o
		default:
			o := newQsObj()
			if clean != "__proto__" {
				o.set(clean, leaf)
			}
			leaf = o
		}
	}
	return leaf
}

var (
	reMoNgoac   = regexp.MustCompile(`(?i)%5B`)
	reDongNgoac = regexp.MustCompile(`(?i)%5D`)
)

// qsParse = qs.parse(raw, {allowPrototypes: true, arrayLimit: 1000}).
func qsParse(raw string) *qsObj {
	obj := newQsObj()
	if raw == "" {
		return obj
	}
	// parseValues: cặp khoá = giá trị, khoá trùng thì gom thành mảng
	clean := reDongNgoac.ReplaceAllString(reMoNgoac.ReplaceAllString(raw, "["), "]")
	parts := strings.Split(clean, "&")
	if len(parts) > 1000 {
		parts = parts[:1000]
	}
	temp := newQsObj()
	for _, part := range parts {
		pos := strings.Index(part, "]=")
		if pos >= 0 {
			pos++
		} else {
			pos = strings.Index(part, "=")
		}
		key, val := "", ""
		if pos < 0 {
			key = qsDecode(part)
		} else {
			key, val = qsDecode(part[:pos]), qsDecode(part[pos+1:])
		}
		if cu, ok := temp.m[key]; ok {
			temp.set(key, combine(cu, val))
		} else {
			temp.set(key, val)
		}
	}
	for _, key := range temp.jsKeys() {
		if key == "" {
			continue
		}
		obj = merge(obj, parseObject(splitKey(key), temp.m[key])).(*qsObj)
	}
	qsCompact(obj)
	return obj
}

// qsCompact = utils.compact: bỏ ô trống của mọi mảng lồng bên trong.
func qsCompact(v any) {
	switch x := v.(type) {
	case *qsArr:
		gon := x.a[:0]
		for _, e := range x.a {
			if e != hole && e != nil {
				qsCompact(e)
				gon = append(gon, e)
			}
		}
		x.a = gon
	case *qsObj:
		for _, k := range x.keys {
			qsCompact(x.m[k])
		}
	}
}

// qsString = String(v) của JS cho giá trị qs trả về.
func qsString(v any) (string, error) {
	switch x := v.(type) {
	case string:
		return x, nil
	case *qsArr:
		parts := make([]string, len(x.a))
		for i, e := range x.a {
			s, err := qsString(e)
			if err != nil {
				return "", err
			}
			parts[i] = s
		}
		return strings.Join(parts, ","), nil
	case *qsObj:
		// toString riêng của object luôn là chuỗi / mảng / object (không gọi được); valueOf trả về chính object -> TypeError
		if _, ok := x.m["toString"]; ok {
			return "", errPrimitive
		}
		return "[object Object]", nil
	}
	return "", nil
}
