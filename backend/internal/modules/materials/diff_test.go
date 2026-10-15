package materials

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

// ───────────── đối chiếu với Node trên database thử ─────────────

var (
	rePG      = regexp.MustCompile(`\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d(:\d\d)?)?`)
	reFailRow = regexp.MustCompile(`Failing row contains \(\d+,`)
	reDigits  = regexp.MustCompile(`\d+`)
	reHashID  = regexp.MustCompile(`#\d+`)
	reFill    = regexp.MustCompile(`\{\{(\w+)\}\}`)
	reFillNum = regexp.MustCompile(`^\{\{#(\w+)\}\}$`)
	reDate    = regexp.MustCompile(`\d{4}-\d\d-\d\d`)
	idKeys    = map[string]bool{"id": true, "recordId": true, "comboId": true, "sp_id": true, "sp_kem_id": true}
)

// normDiff thay id sinh tự động và thời điểm bằng dấu giữ chỗ. ids: id (chuỗi) -> tên đã lưu trong kịch bản.
// Dùng CHUNG cho kết quả của Node (diff.json) và của Go nên hai phía được chuẩn hoá y hệt nhau.
func normDiff(v any, key string, ids map[string]string) any {
	name := func(id string) string {
		if n, ok := ids[id]; ok {
			return "<" + n + ">"
		}
		return "<n>"
	}
	switch x := v.(type) {
	case float64:
		if idKeys[key] {
			return name(jsval.ToString(x))
		}
	case string:
		s := reFailRow.ReplaceAllString(rePG.ReplaceAllString(x, "<ts>"), "Failing row contains (<n>,")
		for id, n := range ids { // id dạng uuid (công ty dezon)
			if !isDigits(id) {
				s = strings.ReplaceAll(s, id, "<"+n+">")
			}
		}
		if key == "ref_id" && isDigits(s) {
			return name(s)
		}
		s = reHashID.ReplaceAllStringFunc(s, func(m string) string { return "#" + name(m[1:]) })
		// id sản phẩm nằm trong chuỗi (khoá lỗi, BT-<id>, id=in.(...)): chỉ thay dãy số từ 4 chữ số đúng bằng một id đã lưu
		// Dãy số dính liền chữ cái (vd nằm giữa mã băm h12 "f9e04bb1617f") không phải id: để nguyên, nếu không thì id của
		// database thử tình cờ trùng một đoạn mã băm là bước digest báo khác.
		chu := func(c byte) bool { return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' }
		var sb strings.Builder
		last := 0
		for _, loc := range reDigits.FindAllStringIndex(s, -1) {
			m := s[loc[0]:loc[1]]
			n, ok := ids[m]
			if !ok || len(m) < 4 || loc[0] > 0 && chu(s[loc[0]-1]) || loc[1] < len(s) && chu(s[loc[1]]) {
				continue
			}
			sb.WriteString(s[last:loc[0]] + "<" + n + ">")
			last = loc[1]
		}
		return sb.String() + s[last:]
	case []any:
		out := make([]any, len(x))
		for i, it := range x {
			out[i] = normDiff(it, key, ids)
		}
		return out
	case *omap.Map:
		out := omap.New()
		x.Each(func(k string, it any) { out.Set(k, normDiff(it, k, ids)) })
		return out
	}
	return v
}

type diffRun struct {
	db    *database.DB
	s     *Service
	reg   *rpc.Registry
	spec  *omap.Map
	saved map[string]string // tên -> id của phía Go
	root  context.Context
}

func (d *diffRun) fill(v any) any {
	switch x := v.(type) {
	case string:
		if m := reFillNum.FindStringSubmatch(x); m != nil {
			return jsval.ToNumber(d.saved[m[1]])
		}
		return reFill.ReplaceAllStringFunc(x, func(m string) string {
			if id, ok := d.saved[m[2:len(m)-2]]; ok {
				return id
			}
			return "MISSING"
		})
	case []any:
		out := make([]any, len(x))
		for i, it := range x {
			out[i] = d.fill(it)
		}
		return out
	case *omap.Map:
		out := omap.New()
		x.Each(func(k string, it any) { out.Set(k, d.fill(it)) })
		return out
	}
	return v
}

func at(v any, path string) any {
	for _, k := range strings.Split(path, ".") {
		if a, ok := v.([]any); ok {
			i := int(jsval.ToNumber(k))
			if i < 0 || i >= len(a) {
				return nil
			}
			v = a[i]
			continue
		}
		v = jsval.Get(v, k)
	}
	return v
}

func h12(v any) string {
	sum := sha1.Sum([]byte(js(v)))
	return hex.EncodeToString(sum[:])[:12]
}

func hasPrefixFold(v any, p string) bool {
	s := jsval.ToString(v)
	return len(s) >= len(p) && strings.EqualFold(s[:len(p)], p)
}

// xlsxDump: đọc lại file xuất bằng excelize, cùng dạng với xlsxDump của gen_diff.js (bên đó đọc bằng ExcelJS).
func (d *diffRun) xlsxDump(ctx context.Context, keys any) (*omap.Map, error) {
	var ks []any
	if a, ok := keys.([]any); ok {
		ks = a
	}
	res, err := d.s.ExportProductsXlsx(ctx, ks)
	if err != nil {
		return nil, err
	}
	f, err := excelize.OpenReader(bytes.NewReader(res.Buf))
	if err != nil {
		return nil, err
	}
	defer f.Close()
	sheets := f.GetSheetList()
	sh := sheets[0]
	all, err := f.GetRows(sh)
	if err != nil {
		return nil, err
	}
	nCol := len(all[0])
	widths, cells := []any{}, []any{}
	for c := 1; c <= nCol; c++ {
		col, _ := excelize.ColumnNumberToName(c)
		w, _ := f.GetColWidth(sh, col)
		widths = append(widths, w)
	}
	for r := 1; r <= res.Count+1; r++ {
		row := []any{}
		for c := 1; c <= nCol; c++ {
			cell, _ := excelize.CoordinatesToCellName(c, r)
			val, _ := f.GetCellValue(sh, cell)
			row = append(row, val)
		}
		cells = append(cells, row)
	}
	names := make([]any, len(sheets))
	for i, n := range sheets {
		names[i] = n
	}
	hh, _ := f.GetRowHeight(sh, 1)
	return omap.Of("name", reDate.ReplaceAllString(res.Name, "<date>"), "count", float64(res.Count), "sheets", names, "rowCount", float64(len(all)),
		"widths", widths, "headHeight", hh, "cells", cells), nil
}

func (d *diffRun) step(st *omap.Map) (*omap.Map, error) {
	no := database.Opt{NoScope: true}
	table, filter := jsval.AsString(st.Val("table")), jsval.AsString(st.Val("filter"))
	switch st.Val("op") {
	case "insert":
		rows := []*omap.Map{}
		for _, r := range arr(st.Val("rows")) {
			rows = append(rows, jsval.AsMap(r))
		}
		_, err := d.db.Insert(d.root, table, rows, no)
		return omap.Of("ok", true), err
	case "update":
		_, err := d.db.Update(d.root, table, filter, jsval.AsMap(st.Val("patch")), no)
		return omap.Of("ok", true), err
	case "remove":
		_, err := d.db.Remove(d.root, table, filter, no)
		return omap.Of("ok", true), err
	case "rows":
		rows, err := d.db.Select(d.root, table, database.SelectOpt{Select: jsval.AsString(st.Val("select")), Filter: filter,
			Order: jsval.AsString(st.Val("order")), Limit: int(jsval.Num0(st.Val("limit"))), NoScope: true})
		return omap.Of("rows", rowsAny(rows)), err
	}
	who := jsval.AsString(st.Val("ctx"))
	ctx := ctxOf(jsval.AsMap(d.spec.Val("contexts")).Val(who))
	if st.Val("op") == "xlsx" {
		x, err := d.xlsxDump(ctx, st.Val("keys"))
		return omap.Of("xlsx", x), err
	}
	res, err := callFn(ctx, d.s, d.reg, actorOf(jsval.AsMap(d.spec.Val("actors")).Val(who)), jsval.AsString(st.Val("fn")), arr(st.Val("args")))
	if err != nil {
		return nil, err
	}
	// qua JSON một vòng như kết quả đi tới client (và để không giữ chung slice với cache của service)
	if res, err = omap.DecodeString(js(res)); err != nil {
		return nil, err
	}
	if only, ok := st.Val("only").(string); ok {
		keep := []any{}
		for _, p := range arr(res) {
			if strings.HasPrefix(jsval.ToString(jsval.Get(p, "ten")), only) {
				keep = append(keep, p)
			}
		}
		res = keep
	}
	if st.Val("digest") == true {
		items, zz := []any{}, []any{}
		for _, p := range arr(res) {
			if !hasPrefixFold(jsval.Get(p, "ten"), "zz_") && !hasPrefixFold(jsval.Get(p, "ma"), "zz_") {
				items = append(items, []any{jsval.Get(p, "ten"), h12(p)})
			}
			if strings.HasPrefix(jsval.ToString(jsval.Get(p, "ten")), "ZZ_materials") {
				zz = append(zz, p)
			}
		}
		return omap.Of("n", float64(len(items)), "items", items, "zz", zz), nil
	}
	return omap.Of("result", res), nil
}

func sortJSON(v any) any {
	a, ok := v.([]any)
	if !ok {
		return v
	}
	out := append([]any{}, a...)
	sort.SliceStable(out, func(i, j int) bool { return js(out[i]) < js(out[j]) })
	return out
}

// TestDiffDB chạy kịch bản của testdata/diff.json (sinh bằng gen_diff.js trên qspro_nodetest, hàm Node thật) trên
// qspro_gotest qua cổng rpc của module rồi so từng bước: kết quả, lỗi, và các dòng database sau khi ghi
// (db_san_pham, lịch sử, combo, yêu thích, yêu cầu xoá, thông báo, audit). Bỏ qua khi thiếu TEST_DATABASE_URL.
func TestDiffDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	defer db.Close()
	spec := loadJSON(t, "diff.json")
	steps := arr(spec.Val("steps"))
	deps := stubDeps{repo: db}
	s := New(Deps{DB: db, Auditor: deps, Users: deps, UserFmt: deps, Notifier: deps, Admins: deps, Uploader: &fakeUploader{}})
	reg := rpc.NewRegistry()
	s.RegisterRPC(reg)
	d := &diffRun{db: db, s: s, reg: reg, spec: spec, saved: map[string]string{},
		root: tenant.With(context.Background(), tenant.Ctx{Role: "super"})}
	// kịch bản tự dọn ở đầu và cuối; nếu test dừng giữa chừng thì dọn lại bằng chính các bước remove đầu tiên
	defer func() {
		for _, raw := range steps {
			st := jsval.AsMap(raw)
			if st.Val("op") != "remove" {
				break
			}
			_, _ = d.step(st)
		}
	}()
	goOuts := make([]*omap.Map, len(steps))
	for i, raw := range steps {
		out, err := d.step(jsval.AsMap(d.fill(raw)))
		if err != nil {
			out = omap.Of("error", err.Error())
		}
		goOuts[i] = out
		if sv := jsval.AsMap(jsval.AsMap(raw).Val("save")); sv != nil {
			src := jsval.Or(out.Val("rows"), out.Val("result"))
			sv.Each(func(name string, path any) {
				if v := at(src, jsval.ToString(path)); !jsval.IsNullish(v) {
					d.saved[name] = jsval.ToString(v)
				}
			})
		}
	}
	inv := func(m map[string]string) map[string]string {
		out := map[string]string{}
		for n, id := range m {
			out[id] = n
		}
		return out
	}
	nodeSaved := map[string]string{}
	jsval.AsMap(spec.Val("saved")).Each(func(n string, id any) { nodeSaved[n] = jsval.ToString(id) })
	if len(nodeSaved) < 8 || len(d.saved) != len(nodeSaved) {
		t.Errorf("id đã lưu: go %v, node %v", d.saved, nodeSaved)
	}
	goIDs, nodeIDs := inv(d.saved), inv(nodeSaved)
	bad := 0
	for i, raw := range steps {
		st := jsval.AsMap(raw)
		want, got := normDiff(st.Val("out"), "", nodeIDs), normDiff(goOuts[i], "", goIDs)
		if st.Val("sort") == true {
			want = omap.Of("result", sortJSON(jsval.Get(want, "result")))
			got = omap.Of("result", sortJSON(jsval.Get(got, "result")))
		}
		g, w := js(got), js(want)
		if g == w {
			continue
		}
		if bad++; bad <= 12 {
			k := 0
			for k < len(g) && k < len(w) && g[k] == w[k] {
				k++
			}
			from := max(0, k-150)
			t.Errorf("bước %d (%s %s %s %s) khác tại byte %d\n  go:   …%s\n  node: …%s", i, js(st.Val("op")), js(st.Val("ctx")), js(st.Val("fn")),
				js(st.Val("table")), k, g[from:min(len(g), k+250)], w[from:min(len(w), k+250)])
		}
	}
	if bad > 0 {
		t.Errorf("%d / %d bước khác Node", bad, len(steps))
	}
}
