package qscore

import (
	"encoding/base64"
	"math"
	"os"
	"testing"
	"time"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

/* Đối chiếu với server/shared.js: testdata/golden.json do testdata/gen.js sinh ra bằng mã Node thật.
   So sánh CHUỖI JSON (kể cả thứ tự khoá) và thông báo lỗi từng byte. */

// giải mã tham số: {"$u":1} = undefined, {"$n":"NaN"} = số không hữu hạn
func dec(v any) any {
	switch x := v.(type) {
	case []any:
		out := make([]any, len(x))
		for i, e := range x {
			out[i] = dec(e)
		}
		return out
	case *omap.Map:
		if x.Len() == 1 {
			if x.Has("$u") {
				return jsval.Undefined
			}
			if n, ok := x.Val("$n").(string); ok {
				switch n {
				case "NaN":
					return math.NaN()
				case "Infinity":
					return math.Inf(1)
				default:
					return math.Inf(-1)
				}
			}
		}
		out := omap.New()
		x.Each(func(k string, e any) { out.Set(k, dec(e)) })
		return out
	}
	return v
}

func loadGolden(t *testing.T) *omap.Map {
	t.Helper()
	b, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	return jsval.AsMap(v)
}

func js(t *testing.T, v any) string {
	t.Helper()
	s, err := omap.MarshalString(v)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestConsts(t *testing.T) {
	c := jsval.AsMap(loadGolden(t).Val("consts"))
	subs := make([]any, len(S32Subs))
	for i, s := range S32Subs {
		subs[i] = s
	}
	tmpl := make([]any, len(CoverTemplate))
	for i, r := range CoverTemplate {
		tmpl[i] = []any{r[0], r[1], r[2]}
	}
	for name, got := range map[string]any{"S32_SUPPLIERS": S32SuppliersValue(), "S32_SUBS": subs, "COVER_TEMPLATE": tmpl} {
		if g, w := js(t, got), jsval.AsString(c.Val(name)); g != w {
			t.Errorf("%s khác Node:\n go:   %s\n node: %s", name, g, w)
		}
	}
	if got := S32SuppliersOf("3.2.4"); len(got) != 4 || got[3][1] != "Weber" {
		t.Errorf("S32SuppliersOf(3.2.4) = %v", got)
	}
	if S32SuppliersOf("3.2.3") != nil {
		t.Error("S32SuppliersOf(3.2.3) phải là nil")
	}
}

func TestGolden(t *testing.T) {
	// gen.js chạy với TZ=UTC (ô CSV dạng ngày có độ lệch giờ phụ thuộc múi giờ máy)
	old := time.Local
	time.Local = time.UTC
	defer func() { time.Local = old }()

	count := map[string]int{}
	golden := loadGolden(t)
	files := jsval.AsMap(golden.Val("files"))
	for i, cv := range jsval.AsArray(golden.Val("cases")) {
		c := jsval.AsMap(cv)
		fn := jsval.AsString(c.Val("fn"))
		args := dec(c.Val("args")).([]any)
		// {$f: khoá} = file trong golden.files; {$p: đường dẫn} = file có sẵn trong repo
		if m := jsval.AsMap(args[0]); m != nil && (fn == "importParse" || fn == "grid") {
			if m.Has("$f") {
				args[0] = files.Val(jsval.AsString(m.Val("$f")))
			} else if m.Has("$p") {
				p := jsval.AsString(m.Val("$p"))
				if moved, ok := movedRepoFiles[p]; ok {
					p = moved
				}
				b, err := os.ReadFile("../../../../" + p)
				if err != nil {
					count["bỏ qua (thiếu file repo)"]++
					continue
				}
				args[0] = base64.StdEncoding.EncodeToString(b)
			}
		}
		arg := func(i int) any {
			if i < len(args) {
				return args[i]
			}
			return jsval.Undefined
		}
		label := fn + "#" + jsval.ToString(float64(i)) + " " + jsval.Str(c.Val("name"))
		var got any
		var err error
		switch fn {
		case "inCode":
			got = InCode(arg(0), arg(1))
		case "normalize_":
			got = Normalize(arg(0))
		case "toNumber_":
			got = ToNumber(arg(0))
		case "round0_":
			got = Round0Num(arg(0))
		case "coverComputed_":
			got = CoverComputed(jsval.AsArray(arg(0)))
		case "importParse":
			got, err = ImportParse(arg(0), arg(1), arg(2))
		case "grid": // lớp đọc file, trước khi dò tiêu đề
			var sheets []*sheet
			buf := decodeBase64(jsval.StrOr(arg(0), ""))
			if arg(1) == "csv" {
				sheets, err = readCSV(buf)
			} else {
				sheets, err = readXLSX(buf)
			}
			out := make([]any, len(sheets))
			for i, sh := range sheets {
				grid := make([]any, len(sh.grid))
				for r, row := range sh.grid {
					cells := make([]any, len(row))
					for ci, v := range row {
						if f, ok := v.(float64); ok && (f != f || math.IsInf(f, 0)) {
							v = jsval.ToString(f)
						}
						cells[ci] = v
					}
					grid[r] = cells
				}
				out[i] = omap.Of("name", sh.name, "grid", grid)
			}
			got = out
		default:
			t.Fatalf("hàm lạ trong golden: %s", fn)
		}
		count[fn]++
		if c.Has("err") {
			want := jsval.AsString(c.Val("err"))
			if err == nil {
				t.Errorf("%s: Node báo lỗi %q, Go trả %.200s", label, want, js(t, got))
			} else if err.Error() != want {
				t.Errorf("%s: lỗi khác Node\n go:   %s\n node: %s", label, err.Error(), want)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: Go báo lỗi %q, Node không lỗi", label, err.Error())
			continue
		}
		g, w := js(t, got), jsval.AsString(c.Val("out"))
		if g != w {
			at := 0
			for at < len(g) && at < len(w) && g[at] == w[at] {
				at++
			}
			from := max(0, at-120)
			t.Errorf("%s: khác Node tại byte %d (args %.150s)\n go:   %s\n node: %s", label, at, js(t, c.Val("args")),
				g[from:min(len(g), at+160)], w[from:min(len(w), at+160)])
		}
	}
	for _, fn := range []string{"inCode", "normalize_", "toNumber_", "round0_", "coverComputed_", "importParse", "grid"} {
		if count[fn] == 0 {
			t.Errorf("golden thiếu ca cho %s", fn)
		}
	}
	t.Logf("đã đối chiếu: %v", count)
}

func TestCSVDateFollowsLocalZone(t *testing.T) {
	old := time.Local
	defer func() { time.Local = old }()
	time.Local = time.FixedZone("ICT", 7*3600)
	if !csvIsDate("2024-01-05T10:00:00+07:00") || csvIsDate("2024-01-05T10:00:00+00:00") {
		t.Error("máy +07:00: chỉ chuỗi +07:00 là ngày")
	}
	time.Local = time.UTC
	if csvIsDate("2024-01-05T10:00:00+07:00") || !csvIsDate("2024-01-05T10:00:00+00:00") {
		t.Error("máy UTC: chỉ chuỗi +00:00 là ngày")
	}
}

// File repo mà golden.json ghi theo chỗ cũ (public/ của app Node đã bỏ) -> chỗ hiện tại (bản nhúng trong binary).
var movedRepoFiles = map[string]string{
	"public/mau-nhap-hang-loat.xlsx": "backend/internal/modules/categories/assets/mau-nhap-hang-loat.xlsx",
}
