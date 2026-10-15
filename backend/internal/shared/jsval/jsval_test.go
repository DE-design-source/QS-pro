package jsval

import (
	"math"
	"testing"
	"time"

	"qspro-backend/internal/shared/omap"
)

// Giá trị mong đợi lấy bằng cách chạy node (v22) thật - xem tests/fixtures/jsref.js.

var nan, inf = math.NaN(), math.Inf(1)

func eq(t *testing.T, name string, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: số phần tử %d != %d", name, len(got), len(want))
	}
	for i := range got {
		if got[i] != want[i] {
			t.Errorf("%s[%d]: got %q, want %q", name, i, got[i], want[i])
		}
	}
}

func TestNumberToString(t *testing.T) {
	nums := []float64{0, math.Copysign(0, -1), 1, -1, 1.5, 123456789, 1e21, 1e-7, 1.5e-7, 123456789012345680000, 1e20, 0.000001, 0.30000000000000004, 5e-324, 1.7976931348623157e308, nan, inf, -inf, 100, 1234.5678, -1234.5, 9007199254740992, 1e300, 0.00001234, 123e-20, 4.35, 1.005}
	want := []string{"0", "0", "1", "-1", "1.5", "123456789", "1e+21", "1e-7", "1.5e-7", "123456789012345680000", "100000000000000000000", "0.000001", "0.30000000000000004", "5e-324", "1.7976931348623157e+308", "NaN", "Infinity", "-Infinity", "100", "1234.5678", "-1234.5", "9007199254740992", "1e+300", "0.00001234", "1.23e-18", "4.35", "1.005"}
	got := make([]string, len(nums))
	arr := make([]any, len(nums))
	for i, n := range nums {
		got[i] = ToString(n)
		arr[i] = n
	}
	eq(t, "String", got, want)
	b, _ := omap.Marshal(arr)
	wantJSON := `[0,0,1,-1,1.5,123456789,1e+21,1e-7,1.5e-7,123456789012345680000,100000000000000000000,0.000001,0.30000000000000004,5e-324,1.7976931348623157e+308,null,null,null,100,1234.5678,-1234.5,9007199254740992,1e+300,0.00001234,1.23e-18,4.35,1.005]`
	if string(b) != wantJSON {
		t.Errorf("JSON số:\n got %s\nwant %s", b, wantJSON)
	}
}

var strIn = []string{"", "  12  ", "0x1F", "1e3", "-1.5e-2", ".5", "5.", "abc", "12px", "Infinity", "-Infinity", "+Infinity", "infinity", "0b101", "0o17", "1_000", "\n\t 7  ", "+.5e1", "-", "+", "0x", "1e", "--1", "\ufeff3", "1,5", "0X10", "-0x10", "00012", "1e1000", "-0"}

func TestToNumberParse(t *testing.T) {
	wantNum := []string{"0", "12", "31", "1000", "-0.015", "0.5", "5", "NaN", "NaN", "Infinity", "-Infinity", "Infinity", "NaN", "5", "15", "NaN", "7", "5", "NaN", "NaN", "NaN", "NaN", "NaN", "3", "NaN", "16", "NaN", "12", "Infinity", "0"}
	wantPF := []string{"NaN", "12", "0", "1000", "-0.015", "0.5", "5", "NaN", "12", "Infinity", "-Infinity", "Infinity", "NaN", "0", "0", "1", "7", "5", "NaN", "NaN", "0", "1", "NaN", "3", "1", "0", "0", "12", "Infinity", "0"}
	wantPI := []string{"NaN", "12", "0", "1", "-1", "NaN", "5", "NaN", "12", "NaN", "NaN", "NaN", "NaN", "0", "0", "1", "7", "NaN", "NaN", "NaN", "0", "1", "NaN", "3", "1", "0", "0", "12", "1", "0"}
	wantPI0 := []string{"NaN", "12", "31", "1", "-1", "NaN", "5", "NaN", "12", "NaN", "NaN", "NaN", "NaN", "0", "0", "1", "7", "NaN", "NaN", "NaN", "NaN", "1", "NaN", "3", "1", "16", "-16", "12", "1", "0"}
	n := len(strIn)
	gn, gpf, gpi, gpi0 := make([]string, n), make([]string, n), make([]string, n), make([]string, n)
	for i, s := range strIn {
		gn[i] = ToString(ToNumber(s))
		gpf[i] = ToString(ParseFloat(s))
		gpi[i] = ToString(ParseInt(s, 10))
		gpi0[i] = ToString(ParseInt(s, 0))
	}
	eq(t, "Number", gn, wantNum)
	eq(t, "parseFloat", gpf, wantPF)
	eq(t, "parseInt10", gpi, wantPI)
	eq(t, "parseInt", gpi0, wantPI0)
}

func TestRound(t *testing.T) {
	in := []float64{0.5, -0.5, 1.5, 2.5, -1.5, -2.5, 0.49999999999999994, -0.49999999999999994, 1e20 + 0.5, 2.4999, -2.5001, 4503599627370497.5, -0.2}
	want := []string{"1", "0N", "2", "3", "-1", "-2", "0", "0N", "100000000000000000000", "2", "-3", "4503599627370498", "0N"}
	got := make([]string, len(in))
	for i, x := range in {
		r := Round(x)
		got[i] = ToString(r)
		if r == 0 && math.Signbit(r) {
			got[i] += "N"
		}
	}
	eq(t, "Math.round", got, want)
}

func TestToFixed(t *testing.T) {
	in := []struct {
		x float64
		d int
	}{{0.5, 0}, {1.5, 0}, {2.5, 0}, {1.005, 2}, {1.045, 2}, {-1.5, 0}, {-0.0001, 2}, {1e21, 2}, {123.456, 1}, {0, 2}, {math.Copysign(0, -1), 2}, {0.000001, 7}, {1234.5678, 2}, {8.345, 2}, {10.235, 2}, {nan, 2}, {1.45, 1}, {-2.5, 0}, {0.5, 1}, {999.995, 2}, {5e-7, 6}}
	want := []string{"1", "2", "3", "1.00", "1.04", "-2", "-0.00", "1e+21", "123.5", "0.00", "0.00", "0.0000010", "1234.57", "8.35", "10.23", "NaN", "1.4", "-3", "0.5", "1000.00", "0.000000"}
	got := make([]string, len(in))
	for i, c := range in {
		got[i] = ToFixed(c.x, c.d)
	}
	eq(t, "toFixed", got, want)
}

func TestFormatVN(t *testing.T) {
	in := []float64{0, 1, -1, 1234, 1234567, 1234.5, 1234.5678, 0.1235, 0.0005, 0.00049, -1234567.891, 1e21, 1.0005, 2.0015, 1.0015, 1.0025, 999.9995, nan, inf, -inf, math.Copysign(0, -1), 0.5, 1e15, 123456789012345680, 1.2345, 1.2355, 1e-7, 12345.6789, 0.125, 0.375, 2.5, 3.5, -0.0004, 1.005, 8.345}
	vn := []string{"0", "1", "-1", "1.234", "1.234.567", "1.234,5", "1.234,568", "0,124", "0,001", "0", "-1.234.567,891", "1.000.000.000.000.000.000.000", "1,001", "2,002", "1,002", "1,003", "1.000", "NaN", "∞", "-∞", "-0", "0,5", "1.000.000.000.000.000", "123.456.789.012.345.680", "1,235", "1,236", "0", "12.345,679", "0,125", "0,375", "2,5", "3,5", "-0", "1,005", "8,345"}
	vn2 := []string{"0,00", "1,00", "-1,00", "1.234,00", "1.234.567,00", "1.234,50", "1.234,57", "0,12", "0,00", "0,00", "-1.234.567,89", "1.000.000.000.000.000.000.000,00", "1,00", "2,00", "1,00", "1,00", "1.000,00", "NaN", "∞", "-∞", "-0,00", "0,50", "1.000.000.000.000.000,00", "123.456.789.012.345.680,00", "1,23", "1,24", "0,00", "12.345,68", "0,13", "0,38", "2,50", "3,50", "-0,00", "1,01", "8,35"}
	vn0 := []string{"0", "1", "-1", "1.234", "1.234.567", "1.235", "1.235", "0", "0", "0", "-1.234.568", "1.000.000.000.000.000.000.000", "1", "2", "1", "1", "1.000", "NaN", "∞", "-∞", "-0", "1", "1.000.000.000.000.000", "123.456.789.012.345.680", "1", "1", "0", "12.346", "0", "0", "3", "4", "-0", "1", "8"}
	vn12 := []string{"0,0", "1,0", "-1,0", "1.234,0", "1.234.567,0", "1.234,5", "1.234,57", "0,12", "0,0", "0,0", "-1.234.567,89", "1.000.000.000.000.000.000.000,0", "1,0", "2,0", "1,0", "1,0", "1.000,0", "NaN", "∞", "-∞", "-0,0", "0,5", "1.000.000.000.000.000,0", "123.456.789.012.345.680,0", "1,23", "1,24", "0,0", "12.345,68", "0,13", "0,38", "2,5", "3,5", "-0,0", "1,01", "8,35"}
	n := len(in)
	g, g2, g0, g12 := make([]string, n), make([]string, n), make([]string, n), make([]string, n)
	for i, x := range in {
		g[i] = FormatVN(x)
		g2[i] = FormatVNFrac(x, 2, 2)
		g0[i] = FormatVNFrac(x, 0, 0)
		g12[i] = FormatVNFrac(x, 1, 2)
	}
	eq(t, "vi-VN", g, vn)
	eq(t, "vi-VN 2-2", g2, vn2)
	eq(t, "vi-VN 0-0", g0, vn0)
	eq(t, "vi-VN 1-2", g12, vn12)
}

func TestURI(t *testing.T) {
	in := []any{"a b&c=d/é?#", "-_.!~*'()", "Tiếng Việt 100%", "\U0001F600+", nil, Undefined, 12.5, true}
	want := []string{"a%20b%26c%3Dd%2F%C3%A9%3F%23", "-_.!~*'()", "Ti%E1%BA%BFng%20Vi%E1%BB%87t%20100%25", "%F0%9F%98%80%2B", "null", "undefined", "12.5", "true"}
	got := make([]string, len(in))
	for i, v := range in {
		got[i] = EncodeURIComponent(v)
		back, err := DecodeURIComponent(got[i])
		if err != nil || back != ToString(v) {
			t.Errorf("decode(%q) = %q, %v", got[i], back, err)
		}
	}
	eq(t, "encodeURIComponent", got, want)
	for _, bad := range []string{"%", "%4", "%zz", "%E0%A4%A", "%C3", "%ff"} {
		if _, err := DecodeURIComponent(bad); err == nil {
			t.Errorf("decode(%q) phải lỗi", bad)
		}
	}
}

func TestStringCoercion(t *testing.T) {
	got := []string{
		ToString([]any{1.0, []any{2.0, 3.0}, nil, Undefined, "a"}), ToString(omap.New()), ToString(nil), ToString(Undefined), ToString(true), ToString([]any{}),
		ToString(ToNumber([]any{})), ToString(ToNumber([]any{5.0})), ToString(ToNumber([]any{"7"})), ToString(ToNumber([]any{1.0, 2.0})), ToString(ToNumber(omap.New())),
		ToString(ToNumber(nil)), ToString(ToNumber(Undefined)), ToString(ToNumber(true)), ToString(ToNumber(false)),
	}
	want := []string{"1,2,3,,,a", "[object Object]", "null", "undefined", "true", "", "0", "5", "7", "NaN", "NaN", "0", "NaN", "1", "0"}
	eq(t, "String/Number", got, want)
}

func TestLooseEquals(t *testing.T) {
	cases := []struct {
		a, b any
		want bool
	}{{nil, Undefined, true}, {nil, 0.0, false}, {"", 0.0, true}, {"1", 1.0, true}, {"a", nan, false}, {true, 1.0, true}, {"true", true, false}, {"0", false, true}, {Undefined, 0.0, false}, {nil, false, false}, {"1.0", 1.0, true}, {" 1 ", 1.0, true}}
	for i, c := range cases {
		if got := LooseEquals(c.a, c.b); got != c.want {
			t.Errorf("LooseEquals #%d (%v == %v) = %v", i, c.a, c.b, got)
		}
	}
	if StrictEquals("1", 1.0) || !StrictEquals(1, 1.0) || StrictEquals(nan, nan) || StrictEquals(nil, Undefined) {
		t.Error("StrictEquals sai")
	}
}

func TestTruthyOr(t *testing.T) {
	for _, v := range []any{nil, Undefined, false, 0.0, nan, "", (*omap.Map)(nil)} {
		if Truthy(v) {
			t.Errorf("%v phải falsy", v)
		}
	}
	for _, v := range []any{true, 1.0, -1.0, "0", " ", []any{}, omap.New()} {
		if !Truthy(v) {
			t.Errorf("%v phải truthy", v)
		}
	}
	if Or(nil, "", "x", "y") != "x" || Or(nil, 0.0) != 0.0 || Coalesce(nil, 0.0, 5.0) != 0.0 || And(1.0, "", 2.0) != "" {
		t.Error("Or / And / Coalesce sai")
	}
	// Number(-0) || 0 và parseFloat(-0) đều là +0 (fmtVN(-0) phải ra "0")
	negZero := math.Copysign(0, -1)
	if math.Signbit(Num0(negZero)) || math.Signbit(Num0("-0")) || math.Signbit(ParseFloat(negZero)) || !math.Signbit(ParseFloat("-0")) {
		t.Error("-0: Num0 / ParseFloat sai")
	}
	if Num0("abc") != 0 || Num0("3.5") != 3.5 || NumOr("0", 7) != 7 || Str(nil) != "" || StrOr(0.0, "d") != "d" {
		t.Error("Num0 / NumOr / Str / StrOr sai")
	}
}

func TestStrings(t *testing.T) {
	if got := Trim(" \ufeff 　  x ​ "); got != "x ​" {
		t.Errorf("trim: %q", got)
	}
	s := "a\U0001F600b"
	if Len16(s) != 4 || Slice("abcdef", -3) != "def" || Slice("abcdef", 2, -1) != "cde" || Slice("abcdef", 4, 2) != "" || Substring("abcdef", 4, 2) != "cd" || Slice(s, 3) != "b" || Slice(s, 0, 3) != "a\U0001F600" {
		t.Error("Len16 / Slice / Substring sai")
	}
	if ToISOString(time.UnixMilli(1760000000123)) != "2025-10-09T08:53:20.123Z" || ToISOString(time.UnixMilli(0)) != "1970-01-01T00:00:00.000Z" {
		t.Error("ToISOString sai")
	}
}

func TestPath(t *testing.T) {
	v, _ := omap.DecodeString(`{"a":{"b":[10,{"c":"x"}]},"n":null}`)
	if GetPath(v, "a", "b", "1", "c") != "x" || GetPath(v, "a", "b", "0") != 10.0 || !IsUndefined(GetPath(v, "a", "z", "q")) || !IsUndefined(GetPath(v, "n", "q")) || GetPath(v, "a", "b", "length") != 2.0 {
		t.Error("GetPath sai")
	}
	if AsMap(v).Val("n") != nil || AsMap("x").Len() != 0 || AsArray(1.0) != nil || TypeOf(Undefined) != "undefined" || TypeOf(nil) != "object" || TypeOf(1) != "number" {
		t.Error("AsMap / TypeOf sai")
	}
}
