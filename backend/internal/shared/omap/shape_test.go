package omap

import (
	"fmt"
	"math/rand"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
)

// refMap: cách lưu CŨ của Map (map[string]any + danh sách khoá) - làm chuẩn để đối chiếu cách lưu mới
// (keys / vals song song, idx có thể dùng chung giữa nhiều object).
type refMap struct {
	keys []string
	m    map[string]any
	nIdx int
}

func (m *refMap) set(k string, v any) {
	if _, ok := m.m[k]; !ok {
		m.keys = append(m.keys, k)
		if isIndex(k) {
			m.nIdx++
		}
	}
	m.m[k] = v
}

func (m *refMap) del(k string) {
	if _, ok := m.m[k]; !ok {
		return
	}
	delete(m.m, k)
	for i, x := range m.keys {
		if x == k {
			m.keys = append(m.keys[:i], m.keys[i+1:]...)
			break
		}
	}
	if isIndex(k) {
		m.nIdx--
	}
}

func (m *refMap) order() []string {
	out := make([]string, len(m.keys))
	if m.nIdx == 0 {
		copy(out, m.keys)
		return out
	}
	var idx, rest []string
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

func (m *refMap) dump() string {
	var sb strings.Builder
	for _, k := range m.order() {
		fmt.Fprintf(&sb, "%q=%v;", k, m.m[k])
	}
	return sb.String()
}

func dumpMap(m *Map) string {
	var sb strings.Builder
	m.Each(func(k string, v any) { fmt.Fprintf(&sb, "%q=%v;", k, v) })
	return sb.String()
}

// soVoiChuan: mọi phép đọc của m phải cho đúng kết quả của bản chuẩn.
func soVoiChuan(t *testing.T, name string, m *Map, ref *refMap, pool []string) {
	t.Helper()
	if m.Len() != len(ref.keys) {
		t.Fatalf("%s: Len %d, chuẩn %d", name, m.Len(), len(ref.keys))
	}
	if got, want := strings.Join(m.Keys(), "\x00"), strings.Join(ref.order(), "\x00"); got != want {
		t.Fatalf("%s: Keys\n  mới:   %q\n  chuẩn: %q", name, got, want)
	}
	if got, want := dumpMap(m), ref.dump(); got != want {
		t.Fatalf("%s: Each\n  mới:   %s\n  chuẩn: %s", name, got, want)
	}
	vals := m.Values()
	for i, k := range ref.order() {
		if vals[i] != ref.m[k] {
			t.Fatalf("%s: Values[%d] = %v, chuẩn %v", name, i, vals[i], ref.m[k])
		}
	}
	for _, k := range pool {
		rv, rok := ref.m[k]
		v, ok := m.Get(k)
		if ok != rok || v != rv || m.Has(k) != rok {
			t.Fatalf("%s: Get(%q) = %v,%v; chuẩn %v,%v", name, k, v, ok, rv, rok)
		}
		if rok && m.Val(k) != rv || !rok && !IsUndefined(m.Val(k)) {
			t.Fatalf("%s: Val(%q) = %v", name, k, m.Val(k))
		}
	}
	b, err := Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	var sb strings.Builder
	sb.WriteByte('{')
	for i, k := range ref.order() {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(strconv.Quote(k) + ":" + FormatNumber(ref.m[k].(float64)))
	}
	sb.WriteByte('}')
	if string(b) != sb.String() {
		t.Fatalf("%s: JSON\n  mới:   %s\n  chuẩn: %s", name, b, sb.String())
	}
}

// TestMapAgainstReference: chuỗi thao tác ngẫu nhiên (Set / Delete / Clone / Assign) trên object dựng bằng mọi cách
// (New, NewSized, Of, Shape, Decode các dòng anh em dùng chung bộ khoá) - kết quả phải y như cách lưu cũ.
func TestMapAgainstReference(t *testing.T) {
	pool := []string{"0", "1", "2", "10", "01", "-1", "4294967294", "4294967295", "1.5", ""}
	for i := 0; i < 40; i++ {
		pool = append(pool, "k"+strconv.Itoa(i))
	}
	rnd := rand.New(rand.NewSource(20261013))
	type pair struct {
		m   *Map
		ref *refMap
	}
	newRef := func() *refMap { return &refMap{m: map[string]any{}} }
	for round := 0; round < 400; round++ {
		var objs []pair
		switch round % 5 {
		case 0:
			objs = append(objs, pair{New(), newRef()})
		case 1:
			objs = append(objs, pair{NewSized(rnd.Intn(30)), newRef()})
		case 2: // Of / OfCap
			n := rnd.Intn(20)
			var kv []any
			ref := newRef()
			for j := 0; j < n; j++ {
				k, v := pool[rnd.Intn(len(pool))], float64(rnd.Intn(1000))
				kv = append(kv, k, v)
				ref.set(k, v)
			}
			objs = append(objs, pair{OfCap(rnd.Intn(4), kv...), ref})
		case 3: // nhiều object từ một Shape
			n := rnd.Intn(25)
			keys := append([]string(nil), pool...)
			rnd.Shuffle(len(keys), func(a, b int) { keys[a], keys[b] = keys[b], keys[a] })
			sh := NewShape(keys[:n]...)
			for c := 0; c < 3; c++ {
				vals := make([]any, n)
				ref := newRef()
				for j := range vals {
					vals[j] = float64(rnd.Intn(1000))
					ref.set(keys[j], vals[j])
				}
				objs = append(objs, pair{sh.Map(vals), ref})
			}
		case 4: // các dòng của một mảng JSON: cùng bộ khoá, hoặc lệch ở giữa / thừa / thiếu / lặp khoá
			n := 1 + rnd.Intn(25)
			keys := append([]string(nil), pool...)
			rnd.Shuffle(len(keys), func(a, b int) { keys[a], keys[b] = keys[b], keys[a] })
			var sb strings.Builder
			sb.WriteByte('[')
			var refs []*refMap
			for c := 0; c < 5; c++ {
				row := append([]string(nil), keys[:n]...)
				switch rnd.Intn(6) {
				case 0:
					row[rnd.Intn(len(row))] = pool[rnd.Intn(len(pool))] // lệch hoặc lặp khoá
				case 1:
					row = append(row, pool[rnd.Intn(len(pool))]) // thừa (có thể lặp)
				case 2:
					row = row[:rnd.Intn(len(row)+1)] // thiếu (có thể rỗng)
				}
				ref := newRef()
				if c > 0 {
					sb.WriteByte(',')
				}
				sb.WriteByte('{')
				for j, k := range row {
					v := float64(rnd.Intn(1000))
					ref.set(k, v)
					if j > 0 {
						sb.WriteByte(',')
					}
					sb.WriteString(strconv.Quote(k) + ":" + FormatNumber(v))
				}
				sb.WriteByte('}')
				refs = append(refs, ref)
			}
			sb.WriteByte(']')
			rows, err := DecodeRows([]byte(sb.String()))
			if err != nil {
				t.Fatal(err)
			}
			for c, r := range rows {
				objs = append(objs, pair{r, refs[c]})
			}
		}
		for step := 0; step < 60; step++ {
			o := objs[rnd.Intn(len(objs))]
			k := pool[rnd.Intn(len(pool))]
			switch op := rnd.Intn(10); {
			case op < 5:
				v := float64(rnd.Intn(1000))
				o.m.Set(k, v)
				o.ref.set(k, v)
			case op < 8:
				o.m.Delete(k)
				o.ref.del(k)
			case op == 8: // Clone: bản sao độc lập với bản gốc
				ref := newRef()
				for _, x := range o.ref.order() {
					ref.set(x, o.ref.m[x])
				}
				objs = append(objs, pair{o.m.Clone(), ref})
			default: // Assign từ một object khác
				src := objs[rnd.Intn(len(objs))]
				if src.m == o.m {
					continue
				}
				Assign(o.m, src.m, nil)
				for _, x := range src.ref.order() {
					o.ref.set(x, src.ref.m[x])
				}
			}
			// sửa một object không được ảnh hưởng object nào khác (kể cả object đang dùng chung bộ khoá)
			for j, p := range objs {
				soVoiChuan(t, fmt.Sprintf("vòng %d bước %d object %d", round, step, j), p.m, p.ref, pool)
			}
		}
	}
}

// Các dòng cùng bộ khoá phải thật sự dùng chung keys / idx (đây là chỗ tiết kiệm bộ nhớ), dòng lệch thì không.
func TestDecodeSharesKeys(t *testing.T) {
	var sb strings.Builder
	sb.WriteByte('[')
	for r := 0; r < 4; r++ {
		if r > 0 {
			sb.WriteByte(',')
		}
		sb.WriteByte('{')
		for c := 0; c < 20; c++ {
			if c > 0 {
				sb.WriteByte(',')
			}
			fmt.Fprintf(&sb, `"cot_%d":%d`, c, r*100+c)
		}
		if r == 3 {
			sb.WriteString(`,"them":1`)
		}
		sb.WriteByte('}')
	}
	sb.WriteByte(']')
	rows, err := DecodeRows([]byte(sb.String()))
	if err != nil {
		t.Fatal(err)
	}
	if &rows[0].keys[0] != &rows[1].keys[0] || &rows[1].keys[0] != &rows[2].keys[0] || !rows[0].shared || !rows[2].shared {
		t.Error("3 dòng đầu phải dùng chung bộ khoá")
	}
	if rows[3].shared || &rows[3].keys[0] == &rows[0].keys[0] || rows[3].Len() != 21 || rows[3].Val("them") != 1.0 {
		t.Error("dòng thừa khoá phải có bộ khoá riêng")
	}
	rows[1].Set("moi", 5.0)
	rows[2].Delete("cot_3")
	if rows[0].Has("moi") || !rows[0].Has("cot_3") || rows[0].Len() != 20 || rows[1].Len() != 21 || rows[2].Len() != 19 {
		t.Error("sửa một dòng làm đổi dòng khác")
	}
	if got, _ := Marshal(rows[2]); !strings.HasPrefix(string(got), `{"cot_0":200,"cot_1":201,"cot_2":202,"cot_4":204,`) {
		t.Errorf("sau Delete: %s", got)
	}
}

// Đọc cùng lúc từ nhiều goroutine các object dùng chung bộ khoá (danh mục trong cache): không được có ghi ngầm nào.
func TestSharedMapsConcurrentRead(t *testing.T) {
	keys := make([]string, 30)
	for i := range keys {
		keys[i] = "c" + strconv.Itoa(i)
	}
	sh := NewShape(keys...)
	var list []any
	for r := 0; r < 50; r++ {
		vals := make([]any, len(keys))
		for i := range vals {
			vals[i] = float64(r*100 + i)
		}
		list = append(list, sh.Map(vals))
	}
	want, _ := Marshal(list)
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for n := 0; n < 20; n++ {
				got, _ := Marshal(list)
				if string(got) != string(want) {
					t.Error("JSON đổi khi đọc song song")
					return
				}
				m := list[n].(*Map)
				_ = m.Clone().Set("x", 1.0)
				if m.Val("c7") != float64(n*100+7) || m.Has("x") || len(m.Keys()) != 30 {
					t.Error("đọc sai")
					return
				}
			}
		}()
	}
	wg.Wait()
}

// naiveJSON: ghi mảng bằng cách nối từng phần tử - không qua bước nới bộ đệm theo ước lượng (growRest).
func naiveJSON(t *testing.T, arr []any) string {
	t.Helper()
	parts := make([]string, len(arr))
	for i, it := range arr {
		b, err := AppendJSON(nil, it)
		if err != nil {
			t.Fatal(err)
		}
		parts[i] = string(b)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

// Mảng dài với phần tử to nhỏ rất lệch nhau, bộ đệm ban đầu đủ mọi cỡ: kết quả phải đúng từng byte.
func TestLongArrayBytesUnchanged(t *testing.T) {
	rnd := rand.New(rand.NewSource(7))
	for _, n := range []int{0, 1, 7, 8, 31, 32, 33, 64, 500, 3000} {
		arr := make([]any, n)
		maps := make([]*Map, n)
		for i := range arr {
			m := Of("id", float64(i), "ten", strings.Repeat("ắ\"\\\n", rnd.Intn(1+i%97)), "u", Undefined, "con", []any{float64(i), nil, "x"})
			if i%3 == 0 {
				m.Set("to", strings.Repeat("y", rnd.Intn(4000)))
			}
			arr[i], maps[i] = m, m
		}
		want := naiveJSON(t, arr)
		for _, c := range []int{0, 1, 512, 4096, len(want) / 2, len(want), len(want) * 2} {
			got, err := AppendJSON(make([]byte, 0, c), arr)
			if err != nil || string(got) != want {
				t.Fatalf("n=%d cap=%d: []any ghi khác bản nối từng phần tử (%v)", n, c, err)
			}
			got, err = AppendJSON(append(make([]byte, 0, c), "xy"...), maps)
			if err != nil || string(got) != "xy"+want {
				t.Fatalf("n=%d cap=%d: []*Map ghi khác bản nối từng phần tử (%v)", n, c, err)
			}
		}
		if n == 3000 {
			allocs := testing.AllocsPerRun(5, func() { _, _ = Marshal(arr) })
			if allocs > 12 {
				t.Errorf("Marshal mảng %d phần tử cấp phát %v lần (bộ đệm bị nới quá nhiều lần)", n, allocs)
			}
		}
	}
}
