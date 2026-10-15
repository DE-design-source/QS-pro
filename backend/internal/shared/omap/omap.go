// Package omap: object JSON CÓ THỨ TỰ khoá, mô phỏng object của JavaScript.
//
// "JS value model" dùng trong toàn backend: nil (null), bool, float64, string, []any,
// *omap.Map và omap.Undefined. Thứ tự khoá giống JS: khoá dạng chỉ số mảng ("0", "12"...)
// đứng trước theo thứ tự tăng dần, các khoá còn lại theo thứ tự chèn.
package omap

import (
	"sort"
	"strconv"
)

type undefinedT struct{}

// Undefined: giá trị undefined của JS. Trong object thì bị bỏ khi ghi JSON, trong mảng thành null.
var Undefined any = undefinedT{}

func (undefinedT) MarshalJSON() ([]byte, error) { return []byte("null"), nil }

// IsUndefined cho biết v có phải omap.Undefined không.
func IsUndefined(v any) bool { _, ok := v.(undefinedT); return ok }

// Map là object có thứ tự. Con trỏ nil đọc được (coi như object rỗng), ghi thì panic.
//
// Cách lưu: keys và vals song song theo thứ tự chèn; idx (khoá -> vị trí) chỉ có khi object nhiều hơn linearMax khoá,
// object nhỏ thì dò tuần tự. keys + idx có thể DÙNG CHUNG giữa nhiều object cùng bộ khoá (các dòng của một kết quả
// truy vấn, object dựng từ một Shape): khi đó shared = true và phải sao ra bản riêng trước khi thêm / xoá khoá.
// vals luôn là của riêng từng object. Nhờ vậy 1 dòng 200 cột tốn khoảng 3 KB thay vì 14 KB.
type Map struct {
	keys   []string
	vals   []any
	idx    map[string]int32
	nIdx   int  // số khoá dạng chỉ số mảng (để biết có phải sắp lại không)
	shared bool // keys / idx đang dùng chung: chỉ đọc
}

// linearMax: object tới ngần này khoá thì không lập idx.
const linearMax = 8

// New tạo object rỗng.
func New() *Map { return &Map{} }

// NewSized tạo object rỗng đã chừa chỗ cho n khoá: không phải cấp phát lại khi Set dần (chỉ là tối ưu bộ nhớ,
// hành vi y như New).
func NewSized(n int) *Map {
	if n <= 0 {
		return New()
	}
	m := &Map{keys: make([]string, 0, n), vals: make([]any, 0, n)}
	if n > linearMax {
		m.idx = make(map[string]int32, n)
	}
	return m
}

// Of tạo object từ các cặp khoá, giá trị: omap.Of("a", 1.0, "b", "x").
func Of(kv ...any) *Map { return OfCap(0, kv...) }

// OfCap như Of, chừa sẵn chỗ cho extra khoá sẽ Set thêm sau.
func OfCap(extra int, kv ...any) *Map {
	if len(kv)%2 != 0 {
		panic("omap.Of: số tham số phải chẵn")
	}
	m := NewSized(len(kv)/2 + extra)
	for i := 0; i < len(kv); i += 2 {
		m.Set(kv[i].(string), kv[i+1])
	}
	return m
}

// Shape: bộ khoá cố định dùng chung cho nhiều object (vd các cột của khối raw trong mỗi sản phẩm). Chỉ đọc sau khi tạo.
type Shape struct {
	keys []string
	idx  map[string]int32
	nIdx int
}

// NewShape tạo bộ khoá theo đúng thứ tự đưa vào; khoá trùng thì panic.
func NewShape(keys ...string) *Shape {
	s := &Shape{keys: append([]string(nil), keys...)}
	seen := make(map[string]int32, len(keys))
	for i, k := range s.keys {
		if _, dup := seen[k]; dup {
			panic("omap.NewShape: khoá trùng " + k)
		}
		seen[k] = int32(i)
		if isIndex(k) {
			s.nIdx++
		}
	}
	if len(keys) > linearMax {
		s.idx = seen
	}
	return s
}

// Len: số khoá của bộ khoá.
func (s *Shape) Len() int { return len(s.keys) }

// Keys: các khoá theo thứ tự đã tạo (chỉ đọc, không sửa slice trả về).
func (s *Shape) Keys() []string { return s.keys }

// Map tạo object có đúng các khoá của s với giá trị vals (vals[i] ứng với khoá thứ i; Map giữ luôn slice này).
// Kết quả y như Set lần lượt từng khoá vào object rỗng.
func (s *Shape) Map(vals []any) *Map {
	if len(vals) != len(s.keys) {
		panic("omap.Shape.Map: số giá trị khác số khoá")
	}
	return &Map{keys: s.keys, vals: vals, idx: s.idx, nIdx: s.nIdx, shared: true}
}

// isIndex: khoá là chỉ số mảng theo chuẩn JS (số nguyên chuẩn tắc 0..2^32-2).
func isIndex(k string) bool {
	n := len(k)
	if n == 0 || n > 10 {
		return false
	}
	if k[0] == '0' {
		return n == 1
	}
	for i := 0; i < n; i++ {
		if k[i] < '0' || k[i] > '9' {
			return false
		}
	}
	if n < 10 {
		return true
	}
	u, err := strconv.ParseUint(k, 10, 64)
	return err == nil && u <= 4294967294
}

// find: vị trí của khoá, -1 nếu không có. m khác nil.
func (m *Map) find(k string) int {
	if m.idx != nil {
		if i, ok := m.idx[k]; ok {
			return int(i)
		}
		return -1
	}
	for i, x := range m.keys {
		if x == k {
			return i
		}
	}
	return -1
}

// own: tách keys / idx dùng chung thành bản riêng (chừa chỗ thêm extra khoá) trước khi đổi bộ khoá.
func (m *Map) own(extra int) {
	if !m.shared {
		return
	}
	n := len(m.keys)
	m.keys = append(make([]string, 0, n+extra), m.keys...)
	if m.idx != nil {
		idx := make(map[string]int32, n+extra)
		for i, k := range m.keys {
			idx[k] = int32(i)
		}
		m.idx = idx
	}
	m.shared = false
}

// prefix: object riêng gồm len(vals) khoá đầu của m với các giá trị vals (chừa chỗ bằng cỡ của m).
func (m *Map) prefix(vals []any) *Map {
	out := NewSized(len(m.keys))
	for i, v := range vals {
		out.Set(m.keys[i], v)
	}
	return out
}

// Get trả giá trị và cờ có khoá hay không.
func (m *Map) Get(k string) (any, bool) {
	if m == nil {
		return nil, false
	}
	if i := m.find(k); i >= 0 {
		return m.vals[i], true
	}
	return nil, false
}

// Val trả giá trị của khoá; không có khoá -> Undefined (như obj.k trong JS).
func (m *Map) Val(k string) any {
	if m == nil {
		return Undefined
	}
	if i := m.find(k); i >= 0 {
		return m.vals[i]
	}
	return Undefined
}

// Has: khoá có trong object không (hasOwnProperty).
func (m *Map) Has(k string) bool {
	return m != nil && m.find(k) >= 0
}

// Set gán giá trị; khoá đã có thì giữ nguyên vị trí. Trả lại chính m để gọi nối.
func (m *Map) Set(k string, v any) *Map {
	if i := m.find(k); i >= 0 {
		m.vals[i] = v
		return m
	}
	m.own(1)
	m.keys = append(m.keys, k)
	m.vals = append(m.vals, v)
	if m.idx != nil {
		m.idx[k] = int32(len(m.keys) - 1)
	} else if len(m.keys) > linearMax {
		m.idx = make(map[string]int32, max(len(m.keys), cap(m.keys)))
		for i, x := range m.keys {
			m.idx[x] = int32(i)
		}
	}
	if isIndex(k) {
		m.nIdx++
	}
	return m
}

// Delete xoá khoá (delete obj.k).
func (m *Map) Delete(k string) {
	if m == nil {
		return
	}
	i := m.find(k)
	if i < 0 {
		return
	}
	m.own(0)
	last := len(m.keys) - 1
	copy(m.keys[i:], m.keys[i+1:])
	copy(m.vals[i:], m.vals[i+1:])
	m.keys[last], m.vals[last] = "", nil
	m.keys, m.vals = m.keys[:last], m.vals[:last]
	if m.idx != nil {
		delete(m.idx, k)
		for j := i; j < last; j++ {
			m.idx[m.keys[j]] = int32(j)
		}
	}
	if isIndex(k) {
		m.nIdx--
	}
}

// Len: số khoá.
func (m *Map) Len() int {
	if m == nil {
		return 0
	}
	return len(m.keys)
}

// Keys trả bản sao danh sách khoá theo thứ tự của Object.keys().
func (m *Map) Keys() []string {
	if m == nil {
		return nil
	}
	out := make([]string, len(m.keys))
	if m.nIdx == 0 {
		copy(out, m.keys)
		return out
	}
	idx := make([]string, 0, m.nIdx)
	rest := make([]string, 0, len(m.keys)-m.nIdx)
	for _, k := range m.keys {
		if isIndex(k) {
			idx = append(idx, k)
		} else {
			rest = append(rest, k)
		}
	}
	sort.Slice(idx, func(a, b int) bool {
		if len(idx[a]) != len(idx[b]) {
			return len(idx[a]) < len(idx[b])
		}
		return idx[a] < idx[b]
	})
	copy(out, idx)
	copy(out[len(idx):], rest)
	return out
}

// Each duyệt theo thứ tự của Object.keys(). Không sửa m trong lúc duyệt (gán lại giá trị của khoá đang có thì được).
func (m *Map) Each(fn func(k string, v any)) {
	if m == nil {
		return
	}
	if m.nIdx == 0 {
		keys := m.keys
		for i, k := range keys {
			// đường nhanh: bộ khoá chưa bị đổi trong lúc duyệt
			if i < len(m.keys) && m.keys[i] == k {
				fn(k, m.vals[i])
			} else {
				v, _ := m.Get(k)
				fn(k, v)
			}
		}
		return
	}
	for _, k := range m.Keys() {
		v, _ := m.Get(k)
		fn(k, v)
	}
}

// Values trả các giá trị theo thứ tự khoá (Object.values).
func (m *Map) Values() []any {
	if m == nil {
		return nil
	}
	out := make([]any, 0, len(m.keys))
	m.Each(func(_ string, v any) { out = append(out, v) })
	return out
}

// Clone sao chép NÔNG, như Object.assign({}, m). m nil -> object rỗng.
func (m *Map) Clone() *Map {
	out := NewSized(m.Len())
	m.Each(func(k string, v any) { out.Set(k, v) })
	return out
}

// Assign chép lần lượt khoá của từng nguồn vào dst (Object.assign). Nguồn nil bị bỏ qua.
func Assign(dst *Map, srcs ...*Map) *Map {
	for _, s := range srcs {
		s.Each(func(k string, v any) { dst.Set(k, v) })
	}
	return dst
}

// DeepClone sao chép SÂU theo ngữ nghĩa JSON.parse(JSON.stringify(v)).
func DeepClone(v any) any {
	b, err := Marshal(v)
	if err != nil {
		return nil
	}
	out, err := Decode(b)
	if err != nil {
		return nil
	}
	return out
}

// MarshalJSON ghi theo thứ tự khoá, cùng định dạng với JSON.stringify.
func (m *Map) MarshalJSON() ([]byte, error) { return Marshal(m) }

// UnmarshalJSON đọc 1 object JSON, giữ thứ tự khoá.
func (m *Map) UnmarshalJSON(b []byte) error {
	v, err := Decode(b)
	if err != nil {
		return err
	}
	o, ok := v.(*Map)
	if !ok {
		return &SyntaxError{Msg: "không phải object JSON"}
	}
	*m = *o
	return nil
}
