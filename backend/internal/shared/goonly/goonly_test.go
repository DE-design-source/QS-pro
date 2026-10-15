package goonly

import (
	"reflect"
	"testing"

	"qspro-backend/internal/shared/omap"
)

func js(t *testing.T, v any) string {
	t.Helper()
	s, err := omap.MarshalString(v)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestStripNestedKeepsOrder(t *testing.T) {
	in := omap.Of("b", 1.0, "nguoi_duyet", "x", "a", omap.Of("z", 1.0, "hien_trang", "y", "c", []any{
		omap.Of("ngay_duyet", "t", "k", 2.0), "s", 3.0, nil,
	}), "rows", []*omap.Map{omap.Of("q", 1.0, "nguoi_duyet", "x", "p", 2.0)})
	before := js(t, in)
	got := js(t, Strip(in, "nguoi_duyet", "ngay_duyet", "hien_trang"))
	want := `{"b":1,"a":{"z":1,"c":[{"k":2},"s",3,null]},"rows":[{"q":1,"p":2}]}`
	if got != want {
		t.Fatalf("Strip:\n got  %s\n want %s", got, want)
	}
	if js(t, in) != before {
		t.Fatal("Strip sửa giá trị đầu vào")
	}
}

func TestStripGoMapsAndScalars(t *testing.T) {
	in := []map[string]any{{"a": 1, "x": 2}, {"x": 3}}
	got := Strip(in, "x")
	want := []map[string]any{{"a": 1}, {}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v", got)
	}
	if in[0]["x"] != 2 {
		t.Fatal("Strip sửa map đầu vào")
	}
	for _, v := range []any{nil, "s", 1.0, true, omap.Undefined, (*omap.Map)(nil)} {
		if got := Strip(v, "x"); got != v {
			t.Fatalf("Strip(%#v) = %#v", v, got)
		}
	}
	m := omap.Of("x", 1.0)
	if Strip(m) != any(m) {
		t.Fatal("không có khoá thì trả nguyên")
	}
}

func TestStripWrites(t *testing.T) {
	log := []any{
		omap.Of("m", "UpdateDon", "a", []any{"MH-1", omap.Of("trang_thai", "Đã duyệt")}),
		// lệnh ghi riêng của bản Go: payload chỉ có khoá Go -> bỏ cả lệnh
		omap.Of("m", "UpdateDon", "a", []any{"MH-1", omap.Of("nguoi_duyet", "ad", "ngay_duyet", "t")}),
		// payload lẫn khoá Node + Go -> giữ lệnh, bỏ khoá Go
		omap.Of("op", "insert", "table", "du_an", "rows", []any{omap.Of("ma_da", "DA", "hien_trang", "cũ")}),
		// payload vốn rỗng -> giữ
		omap.Of("m", "Touch", "a", []any{omap.New()}),
		// khoá Go ở cấp của lệnh không làm bỏ lệnh
		omap.Of("m", "Read", "nguoi_duyet", "x"),
	}
	got := js(t, StripWrites(log, "nguoi_duyet", "ngay_duyet", "hien_trang"))
	want := `[{"m":"UpdateDon","a":["MH-1",{"trang_thai":"Đã duyệt"}]},` +
		`{"op":"insert","table":"du_an","rows":[{"ma_da":"DA"}]},{"m":"Touch","a":[{}]},{"m":"Read"}]`
	if got != want {
		t.Fatalf("StripWrites:\n got  %s\n want %s", got, want)
	}
	if len(log) != 5 {
		t.Fatal("StripWrites sửa log đầu vào")
	}
}

// Chỉ xét rỗng ở cấp payload: object lồng sâu hơn (giá trị cột JSON) bị bỏ hết khoá không làm bỏ cả lệnh Node.
func TestStripWritesNestedEmptyKeepsCommand(t *testing.T) {
	log := []any{
		// payload lẫn khoá Node + object lồng chỉ có khoá Go -> giữ lệnh, object lồng thành rỗng
		omap.Of("m", "UpdateDuAn", "a", []any{"DA-1", omap.Of("ten", "Nha A", "data", omap.Of("hien_trang", "x"))}),
		// object con trực tiếp của lệnh có object lồng chỉ khoá Go -> giữ
		omap.Of("op", "update", "table", "du_an", "patch", omap.Of("ten", "B", "data", omap.Of("hien_trang", "y"))),
		// mảng lồng 2 cấp (không phải payload) -> giữ
		omap.Of("m", "Bulk", "a", []any{[]any{omap.Of("hien_trang", "z")}}),
		// payload là map[string]any chỉ khoá Go -> bỏ lệnh
		omap.Of("op", "update", "table", "du_an", "patch", map[string]any{"hien_trang": "w"}),
		// mảng []*omap.Map con trực tiếp: một phần tử chỉ khoá Go -> bỏ lệnh
		omap.Of("op", "insert", "table", "du_an", "rows", []*omap.Map{omap.Of("hien_trang", "v")}),
	}
	got := js(t, StripWrites(log, "hien_trang"))
	want := `[{"m":"UpdateDuAn","a":["DA-1",{"ten":"Nha A","data":{}}]},` +
		`{"op":"update","table":"du_an","patch":{"ten":"B","data":{}}},{"m":"Bulk","a":[[{}]]}]`
	if got != want {
		t.Fatalf("StripWrites:\n got  %s\n want %s", got, want)
	}
}

func TestStripNull(t *testing.T) {
	in := []*omap.Map{
		omap.Of("ma_don", "MH-1", "nguoi_duyet", nil, "ngay_duyet", omap.Undefined, "ct", []any{omap.Of("nguoi_duyet", nil, "k", 1.0)}),
		// có giá trị (bản Go ghi) -> giữ để phép so với golden báo khác
		omap.Of("ma_don", "MH-2", "nguoi_duyet", "WRONG", "ngay_duyet", nil),
	}
	got := js(t, StripNull(in, "nguoi_duyet", "ngay_duyet"))
	want := `[{"ma_don":"MH-1","ct":[{"k":1}]},{"ma_don":"MH-2","nguoi_duyet":"WRONG"}]`
	if got != want {
		t.Fatalf("StripNull:\n got  %s\n want %s", got, want)
	}
	gm := map[string]any{"a": 1, "x": nil, "y": 0}
	if g := StripNull(gm, "x", "y"); !reflect.DeepEqual(g, map[string]any{"a": 1, "y": 0}) {
		t.Fatalf("map: %#v", g)
	}
	if StripNull(in) == nil {
		t.Fatal("không có khoá thì trả nguyên")
	}
}

func TestStripWritesTypedSlices(t *testing.T) {
	ol := []*omap.Map{omap.Of("m", "U", "patch", omap.Of("resolution_note", "r")), omap.Of("m", "U", "patch", omap.Of("status", "rejected", "resolution_note", "r"))}
	if got := js(t, StripWrites(ol, "resolution_note")); got != `[{"m":"U","patch":{"status":"rejected"}}]` {
		t.Fatalf("[]*omap.Map: %s", got)
	}
	gl := []map[string]any{{"m": "U", "patch": map[string]any{"hien_trang": "x"}}, {"m": "V", "patch": map[string]any{"a": 1}}}
	want := []map[string]any{{"m": "V", "patch": map[string]any{"a": 1}}}
	if got := StripWrites(gl, "hien_trang"); !reflect.DeepEqual(got, want) {
		t.Fatalf("[]map: %#v", got)
	}
	// không phải mảng: như Strip
	if got := js(t, StripWrites(omap.Of("a", 1.0, "x", 2.0), "x")); got != `{"a":1}` {
		t.Fatalf("object: %s", got)
	}
	if StripWrites(ol) == nil {
		t.Fatal("không có khoá thì trả nguyên")
	}
}

func TestStripFailingRow(t *testing.T) {
	cols := map[string]int{"purchase_orders": 2, "projects": 1}
	cases := [][2]string{
		// lỗi chưa escape
		{`Failing row contains (1, A, null, null). new row for relation "purchase_orders" violates`,
			`Failing row contains (1, A). new row for relation "purchase_orders" violates`},
		// escape JSON 2 lần, 2 lỗi liền nhau của 2 bảng
		{`{\"details\":\"Failing row contains (<id>, X, null, null).\",\"message\":\"new row for relation \\\"projects\\\" violates\"} ` +
			`Failing row contains (2, null, null, null). relation \\\"purchase_orders\\\"`,
			`{\"details\":\"Failing row contains (<id>, X, null).\",\"message\":\"new row for relation \\\"projects\\\" violates\"} ` +
				`Failing row contains (2, null). relation \\\"purchase_orders\\\"`},
		// cột mới có giá trị: giữ để phép so báo khác
		{`Failing row contains (1, A, ad, null). relation "purchase_orders"`, `Failing row contains (1, A, ad). relation "purchase_orders"`},
		{`Failing row contains (1, A, null, ad). relation "purchase_orders"`, `Failing row contains (1, A, null, ad). relation "purchase_orders"`},
		// bảng không khai báo / không có tên bảng / không có lỗi
		{`Failing row contains (1, null). relation "users"`, `Failing row contains (1, null). relation "users"`},
		{`Failing row contains (1, null). Failing row contains (2, null). relation "projects"`,
			`Failing row contains (1, null). Failing row contains (2). relation "projects"`},
		{`không lỗi`, `không lỗi`},
	}
	for _, c := range cases {
		if got := StripFailingRow(c[0], cols); got != c[1] {
			t.Errorf("StripFailingRow(%s)\n got  %s\n want %s", c[0], got, c[1])
		}
	}
	if got := StripFailingRow(cases[0][0], nil); got != cases[0][0] {
		t.Error("cols rỗng thì trả nguyên")
	}
}
