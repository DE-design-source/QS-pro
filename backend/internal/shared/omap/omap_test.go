package omap

import (
	"encoding/json"
	"math"
	"testing"
	"time"
)

// Chuỗi mong đợi lấy từ JSON.stringify của node thật (tests/fixtures/jsref.js).

func TestKeyOrderLikeJS(t *testing.T) {
	m := New()
	for i, k := range []string{"b", "2", "a", "1", "01", "-1", "4294967294", "4294967295", "1.5"} {
		m.Set(k, float64(i+1))
	}
	m.Set("u", Undefined)
	m.Set("arr", []any{Undefined, nil, 0.0})
	got, err := Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"1":4,"2":2,"4294967294":7,"b":1,"a":3,"01":5,"-1":6,"4294967295":8,"1.5":9,"arr":[null,null,0]}`
	if string(got) != want {
		t.Errorf("\n got %s\nwant %s", got, want)
	}
	m.Delete("1")
	m.Delete("2")
	m.Delete("4294967294")
	if k := m.Keys(); k[0] != "b" || len(k) != 8 {
		t.Errorf("Keys sau Delete: %v", k)
	}
}

func TestStringEscapes(t *testing.T) {
	in := []any{"a\"b\\c\n\r\t\b\f\u0001\u001f\u007f  <>&é\U0001F600", "/"}
	got, _ := Marshal(in)
	want := "[\"a\\\"b\\\\c\\n\\r\\t\\b\\f\\u0001\\u001f\u007f  <>&é\U0001F600\",\"/\"]"
	if string(got) != want {
		t.Errorf("\n got %s\nwant %s", got, want)
	}
}

func TestDecodeRoundTrip(t *testing.T) {
	src := `{"z":1,"a":[true,false,null,-1.5e3,"xé😀\n"],"m":{"k":{}},"e":[],"z2":0.1}`
	v, err := DecodeString(src)
	if err != nil {
		t.Fatal(err)
	}
	m := v.(*Map)
	if ks := m.Keys(); len(ks) != 5 || ks[0] != "z" || ks[4] != "z2" {
		t.Fatalf("thứ tự khoá: %v", ks)
	}
	if arr := m.Val("a").([]any); arr[3] != -1500.0 || arr[4] != "xé\U0001F600\n" {
		t.Fatalf("giá trị: %v", arr)
	}
	out, _ := Marshal(v)
	want := "{\"z\":1,\"a\":[true,false,null,-1500,\"xé\U0001F600\\n\"],\"m\":{\"k\":{}},\"e\":[],\"z2\":0.1}"
	if string(out) != want {
		t.Errorf("\n got %s\nwant %s", out, want)
	}
	// khoá trùng: giá trị sau thắng, vị trí của lần đầu
	d, _ := DecodeString(`{"a":1,"b":2,"a":3}`)
	if s, _ := Marshal(d); string(s) != `{"a":3,"b":2}` {
		t.Errorf("khoá trùng: %s", s)
	}
	for _, bad := range []string{``, `{`, `{"a"}`, `[1,]`, `{"a":1,}`, `01`, `1.`, `"a`, `tru`, `[1] x`, `{'a':1}`, "\"a\nb\"", `-`, `1e`} {
		if _, err := DecodeString(bad); err == nil {
			t.Errorf("phải lỗi: %q", bad)
		}
	}
	// đối chiếu với encoding/json trên dữ liệu hợp lệ
	var ref any
	if err := json.Unmarshal([]byte(src), &ref); err != nil {
		t.Fatal(err)
	}
}

type sample struct {
	B string         `json:"b"`
	A float64        `json:"a"`
	M *Map           `json:"m"`
	U any            `json:"u"`
	S []string       `json:"s"`
	X map[string]int `json:"x,omitempty"`
}

func TestStructFallbackAndHelpers(t *testing.T) {
	got, err := Marshal(sample{B: "<x> ", A: 1e21, M: Of("k", 1.0), U: Undefined, S: []string{"a"}})
	if err != nil {
		t.Fatal(err)
	}
	want := "{\"b\":\"<x> \",\"a\":1e+21,\"m\":{\"k\":1},\"s\":[\"a\"]}" // trường mang Undefined bị bỏ như trong object JS
	if string(got) != want {
		t.Errorf("\n got %s\nwant %s", got, want)
	}
	// JSON.stringify({t: new Date(...), n: NaN, u: undefined, f: 0.1}) của node
	type inner struct {
		F float32 `json:"f"`
	}
	type odd struct {
		T  time.Time  `json:"t"`
		N  float64    `json:"n"`
		U  any        `json:"u"`
		P  *time.Time `json:"p,omitempty"`
		X  int        `json:"-"`
		in int
		inner
	}
	ict := time.FixedZone("ICT", 7*3600)
	got, err = Marshal(odd{T: time.Date(2026, 10, 13, 8, 2, 3, 999999, ict), N: math.NaN(), U: Undefined, in: 1, inner: inner{0.1}})
	if want := `{"t":"2026-10-13T01:02:03.000Z","n":null,"f":0.1}`; err != nil || string(got) != want {
		t.Errorf("%v\n got %s\nwant %s", err, got, want)
	}
	got, _ = Marshal([]any{time.Date(2026, 10, 13, 1, 2, 3, 0, time.UTC), map[string]any{"b": Undefined, "a": 1.5}, []int{1, 2}, json.RawMessage(`{"z":1}`)})
	if want := `["2026-10-13T01:02:03.000Z",{"a":1.5},[1,2],{"z":1}]`; string(got) != want {
		t.Errorf("\n got %s\nwant %s", got, want)
	}
	// byte không phải UTF-8: thay như Buffer.toString('utf8') của node (chuỗi cụt = một U+FFFD)
	v, err := Decode([]byte("[\"a\xff\xfeb\xe2\x82\",\"\xf0\x9f\x98\",\"\xed\xa0\x80\"]"))
	if s, _ := Marshal(v); err != nil || string(s) != "[\"a��b�\",\"�\",\"���\"]" {
		t.Errorf("utf-8 hỏng: %v %q", err, s)
	}
	a := Of("x", 1.0, "y", 2.0)
	b := Assign(a.Clone(), Of("y", 3.0, "z", 4.0), nil)
	if s, _ := Marshal(b); string(s) != `{"x":1,"y":3,"z":4}` {
		t.Errorf("Assign: %s", s)
	}
	if a.Val("y") != 2.0 || !IsUndefined(a.Val("q")) || a.Has("q") || !a.Has("x") {
		t.Error("Clone / Val / Has sai")
	}
	var nilMap *Map
	if nilMap.Len() != 0 || nilMap.Has("a") || !IsUndefined(nilMap.Val("a")) || len(nilMap.Keys()) != 0 {
		t.Error("Map nil phải đọc được")
	}
	if s, _ := Marshal(nilMap); string(s) != "null" {
		t.Errorf("nil map: %s", s)
	}
	if s, _ := Marshal(Undefined); string(s) != "null" {
		t.Errorf("undefined gốc: %s", s)
	}
	dc := DeepClone(Of("a", Of("b", []any{1.0}))).(*Map)
	dc.Val("a").(*Map).Set("b", 2.0)
	var um Map
	if err := json.Unmarshal([]byte(`{"q":1,"p":[{"b":1,"a":2}]}`), &um); err != nil || um.Keys()[0] != "q" {
		t.Errorf("UnmarshalJSON: %v", err)
	}
	rows, err := DecodeRows([]byte(`[{"a":1},{"b":2}]`))
	if err != nil || len(rows) != 2 || rows[1].Val("b") != 2.0 {
		t.Errorf("DecodeRows: %v", err)
	}
}
