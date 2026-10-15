package database

import (
	"errors"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

func isNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

// ───────────── Dịch chuỗi lọc PostgREST -> SQL có tham số ─────────────
// Các hàm dưới đây báo lỗi bằng panic(*Error); Select / Insert / Update / Remove bắt lại (catch).

var (
	reCond     = regexp.MustCompile(`(?s)^(not\.)?([a-z]+)\.(.*)$`)
	reParen    = regexp.MustCompile(`(?s)^\((.*)\)$`)
	reGroup    = regexp.MustCompile(`(?s)^(not\.)?(and|or)\((.*)\)$`)
	reNode     = regexp.MustCompile(`(?s)^([A-Za-z_][A-Za-z0-9_]*)\.(.*)$`)
	reKeyGroup = regexp.MustCompile(`^(not\.)?(and|or)$`)
	reUnescape = regexp.MustCompile(`(?s)\\(.)`)
	reHasID    = regexp.MustCompile(`(^|,)[\s\x{000B}\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]*id\.`) // \s của JS
)

var cmpOps = map[string]string{"eq": "=", "neq": "<>", "gt": ">", "gte": ">=", "lt": "<", "lte": "<=", "like": "like", "ilike": "ilike"}

func decodeFilter(s string) string {
	s = strings.ReplaceAll(s, "+", " ")
	if d, err := jsval.DecodeURIComponent(s); err == nil {
		return d
	}
	return s
}

// splitTop tách theo dấu phẩy ở mức ngoài cùng (bỏ qua dấu phẩy trong "..." và trong ngoặc).
func splitTop(s string) []string {
	out := []string{}
	cur := make([]byte, 0, len(s))
	depth, inQ := 0, false
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if inQ {
			cur = append(cur, ch)
			if ch == '\\' && i+1 < len(s) {
				i++
				cur = append(cur, s[i])
			} else if ch == '"' {
				inQ = false
			}
			continue
		}
		if ch == '"' {
			inQ = true
			cur = append(cur, ch)
			continue
		}
		if ch == '(' {
			depth++
		} else if ch == ')' {
			depth--
		}
		if ch == ',' && depth == 0 {
			out = append(out, string(cur))
			cur = cur[:0]
			continue
		}
		cur = append(cur, ch)
	}
	return append(out, string(cur))
}

func unquote(v string) string {
	if len(v) >= 2 && v[0] == '"' && v[len(v)-1] == '"' {
		return reUnescape.ReplaceAllString(v[1:len(v)-1], "$1")
	}
	return v
}

// pgArray dựng hằng mảng của Postgres từ danh sách chuỗi (như thư viện pg của Node gửi mảng JS).
func pgArray(list []string) string {
	var sb strings.Builder
	sb.WriteByte('{')
	for i, s := range list {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteByte('"')
		sb.WriteString(strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `"`, `\"`))
		sb.WriteByte('"')
	}
	sb.WriteByte('}')
	return sb.String()
}

func makeWhere(method string, t *table, filter string, params *[]any) string {
	col := func(name string) string {
		if t.isVirt(name) {
			return t.virt("_t")
		}
		en := t.v2e[name]
		if en == "" {
			panic(dbError(method, t.vi, 400, "42703", "column "+t.vi+"."+name+" does not exist", "", ""))
		}
		return "_t." + q(en)
	}
	bad := func(what string) *Error {
		return dbError(method, t.vi, 400, "PGRST100", "Bộ lọc không hỗ trợ: "+what, "", "")
	}
	// name = tên cột, expr = "[not.]op.value"; quoted = giá trị có thể bọc "..." (bên trong and()/or())
	cond := func(name, expr string, quoted bool) string {
		m := reCond.FindStringSubmatch(expr)
		if m == nil {
			panic(bad(name + "=" + expr))
		}
		neg, op, val := m[1] != "", m[2], m[3]
		var sql string
		switch {
		case op == "is":
			v := strings.ToLower(val)
			switch v {
			case "null":
				sql = col(name) + " is null"
			case "true", "false":
				sql = col(name) + " is " + v
			default:
				panic(bad(name + "=" + expr))
			}
		case op == "in":
			mm := reParen.FindStringSubmatch(val)
			if mm == nil {
				panic(bad(name + "=" + expr))
			}
			if mm[1] == "" {
				sql = "false"
			} else {
				list := splitTop(mm[1])
				for i := range list {
					list[i] = unquote(list[i])
				}
				*params = append(*params, pgArray(list))
				sql = col(name) + " = any($" + strconv.Itoa(len(*params)) + ")"
			}
		case cmpOps[op] != "":
			if quoted {
				val = unquote(val)
			}
			if op == "like" || op == "ilike" {
				val = strings.ReplaceAll(val, "*", "%")
			}
			*params = append(*params, val)
			sql = col(name) + " " + cmpOps[op] + " $" + strconv.Itoa(len(*params))
		default:
			panic(bad(name + "=" + expr))
		}
		if neg {
			return "not (" + sql + ")"
		}
		return sql
	}
	var group func(kind, inner string) string
	// 1 phần tử trong and(...) / or(...):  cot.op.giatri  |  and(...)  |  or(...)  |  not.and(...)
	node := func(item string) string {
		item = jsval.Trim(item)
		if g := reGroup.FindStringSubmatch(item); g != nil {
			pre := ""
			if g[1] != "" {
				pre = "not "
			}
			return pre + group(g[2], g[3])
		}
		m := reNode.FindStringSubmatch(item)
		if m == nil {
			panic(bad(item))
		}
		return cond(m[1], m[2], true)
	}
	group = func(kind, inner string) string {
		parts := []string{}
		for _, x := range splitTop(inner) {
			if jsval.Trim(x) != "" {
				parts = append(parts, node(x))
			}
		}
		if len(parts) == 0 {
			panic(bad(kind + "()"))
		}
		return "(" + strings.Join(parts, " "+kind+" ") + ")"
	}
	out := []string{}
	for _, pr := range strings.Split(filter, "&") {
		if pr == "" {
			continue
		}
		i := strings.IndexByte(pr, '=')
		if i < 0 {
			panic(bad(pr))
		}
		k, v := decodeFilter(pr[:i]), decodeFilter(pr[i+1:])
		if g := reKeyGroup.FindStringSubmatch(k); g != nil {
			mm := reParen.FindStringSubmatch(v)
			if mm == nil {
				panic(bad(pr))
			}
			pre := ""
			if g[1] != "" {
				pre = "not "
			}
			out = append(out, pre+group(g[2], mm[1]))
		} else {
			out = append(out, cond(k, v, false))
		}
	}
	if len(out) == 0 {
		return ""
	}
	return " where " + strings.Join(out, " and ")
}

func makeOrder(method string, t *table, order, collate string) string {
	if order == "" {
		return ""
	}
	parts := strings.Split(order, ",")
	for i, pt := range parts {
		p := strings.Split(jsval.Trim(pt), ".")
		en := t.v2e[p[0]]
		if en == "" && !t.isVirt(p[0]) {
			panic(dbError(method, t.vi, 400, "42703", "column "+t.vi+"."+p[0]+" does not exist", "", ""))
		}
		var s string
		if en != "" {
			s = "_t." + q(en)
			if t.text[p[0]] {
				s += collate
			}
		} else {
			s = t.virt("_t")
		}
		for _, w := range p[1:] {
			switch w {
			case "asc", "desc":
				s += " " + w
			case "nullsfirst":
				s += " nulls first"
			case "nullslast":
				s += " nulls last"
			}
		}
		parts[i] = s
	}
	return " order by " + strings.Join(parts, ", ")
}

// outList: danh sách cột trả về, đặt bí danh về tên tiếng Việt: src."name" as "ten".
func outList(method string, t *table, sel, src string) string {
	var names []string
	if sel == "" || sel == "*" {
		names = t.cols
		if t.vt != nil {
			names = append(append([]string{}, t.cols...), "cong_ty_id")
		}
	} else {
		names = splitNames(sel)
	}
	out := make([]string, len(names))
	for i, n := range names {
		if t.isVirt(n) {
			out[i] = t.virt(src) + " as " + q(n)
			continue
		}
		if t.v2e[n] == "" {
			panic(dbError(method, t.vi, 400, "42703", "column "+t.vi+"."+n+" does not exist", "", ""))
		}
		out[i] = src + "." + q(t.v2e[n]) + " as " + q(n)
	}
	return strings.Join(out, ", ")
}

// toEn đổi khoá của dòng dữ liệu sang tên cột tiếng Anh; cột lạ -> báo như PostgREST
// (code phía trên tự bỏ cột rồi ghi lại).
func toEn(method string, t *table, row *omap.Map) *omap.Map {
	o := omap.New()
	row.Each(func(k string, v any) {
		if t.isVirt(k) { // công ty do dòng cha quyết định, không ghi
			return
		}
		if t.v2e[k] == "" {
			panic(dbError(method, t.vi, 400, "PGRST204", "Could not find the '"+k+"' column of '"+t.vi+"' in the schema cache", "", ""))
		}
		o.Set(t.v2e[k], v)
	})
	return o
}

// ───────────── Ghi vào bảng lõi + bảng vệ tinh (vd products + product_*_specs) ─────────────
// Mỗi thao tác là MỘT câu lệnh (CTE ghi nhiều bảng) nên tự nó nguyên tử: lỗi ở bảng nào cũng huỷ hết.
// Quy ước: khoá chính bảng lõi là "id" (identity); bảng vệ tinh có 1 cột khoá trỏ về id đó.
// Dòng vệ tinh chỉ được tạo khi có ít nhất 1 giá trị khác NULL thuộc bảng đó.

func anyNotNull(src string, cols []string) string {
	p := make([]string, len(cols))
	for i, c := range cols {
		p[i] = src + "." + q(c) + " is not null"
	}
	return "(" + strings.Join(p, " or ") + ")"
}

func setOf(keys []string) map[string]bool {
	m := map[string]bool{}
	for _, k := range keys {
		m[k] = true
	}
	return m
}

// splitOut: cột trả về - coreSrc cho cột bảng lõi; cột vệ tinh lấy từ newSrc nếu vừa được ghi, ngược lại từ oldSrc.
func splitOut(t *table, coreSrc string, written map[string]bool, newSrc, oldSrc string) string {
	out := make([]string, len(t.cols))
	for i, n := range t.cols {
		en := t.v2e[n]
		src := oldSrc
		if t.ownerOf(en) == -1 {
			src = coreSrc
		} else if written[en] {
			src = newSrc
		}
		if src != "" {
			out[i] = src + "." + q(en) + " as " + q(n)
		} else {
			out[i] = "null as " + q(n)
		}
	}
	return strings.Join(out, ", ")
}

func colList(ks []string) string {
	var sb strings.Builder
	for _, k := range ks {
		sb.WriteString(", " + q(k))
	}
	return sb.String()
}

func keysOwnedBy(t *table, keysEn []string, owner int) []string {
	out := []string{}
	for _, k := range keysEn {
		if t.ownerOf(k) == owner {
			out = append(out, k)
		}
	}
	return out
}

func insertSplitSQL(t *table, keysEn []string) string {
	coreKeys := []string{}
	for _, k := range keysEn {
		if t.ownerOf(k) == -1 && k != "id" {
			coreKeys = append(coreKeys, k)
		}
	}
	written := setOf(keysEn)
	view, core := q(t.en), q(t.core)
	// id: lấy từ dữ liệu gửi lên nếu có, không thì xin số mới -> biết trước id để ghi luôn bảng vệ tinh
	sql := `with src as (select e.ord as _ord, coalesce(r."id", nextval(pg_get_serial_sequence('` + strings.ReplaceAll(t.core, "'", "''") + `', 'id'))) as _id, r.*` +
		" from json_array_elements($1::json) with ordinality e(v, ord), lateral json_populate_record(null::" + view + ", e.v) r), " +
		"ins as (insert into " + core + ` ("id"` + colList(coreKeys) + ") select _id" + colList(coreKeys) + " from src order by _ord returning *)"
	for i, p := range t.parts {
		pk := keysOwnedBy(t, keysEn, i)
		if len(pk) == 0 {
			continue
		}
		sql += ", p" + strconv.Itoa(i) + " as (insert into " + q(p.table) + " (" + q(p.key) + colList(pk) + ") select _id" + colList(pk) +
			" from src where " + anyNotNull("src", pk) + " returning 1)"
	}
	sql += " " + jagg + "(select " + splitOut(t, "ins", written, "src", "") + ` from ins join src on src._id = ins."id" order by src._ord) x`
	return sql
}

func updateSplitSQL(t *table, keysEn []string, where string) string {
	coreKeys := keysOwnedBy(t, keysEn, -1)
	written := setOf(keysEn)
	view := q(t.en)
	sql := "with _p as (select * from json_populate_record(null::" + view + ", $1::json)), " +
		"tgt as (select _t.* from " + view + " _t" + where + ")"
	if len(coreKeys) > 0 {
		sets := make([]string, len(coreKeys))
		for i, k := range coreKeys {
			sets[i] = q(k) + " = _p." + q(k)
		}
		sql += ", upd as (update " + q(t.core) + " c set " + strings.Join(sets, ", ") + ` from _p where c."id" in (select "id" from tgt) returning c.*)`
	}
	for i, p := range t.parts {
		pk := keysOwnedBy(t, keysEn, i)
		if len(pk) == 0 {
			continue
		}
		pt, key := q(p.table), q(p.key)
		var vals strings.Builder
		excl := make([]string, len(pk))
		for j, k := range pk {
			vals.WriteString(", _p." + q(k))
			excl[j] = q(k) + " = excluded." + q(k)
		}
		// đã có dòng vệ tinh -> sửa; chưa có -> chỉ tạo khi có giá trị khác NULL
		sql += ", i" + strconv.Itoa(i) + " as (insert into " + pt + " (" + key + colList(pk) + `) select tgt."id"` +
			vals.String() + " from tgt, _p where (" + anyNotNull("_p", pk) +
			" or exists (select 1 from " + pt + " s where s." + key + ` = tgt."id")) on conflict (` + key + ") do update set " +
			strings.Join(excl, ", ") + " returning 1)"
	}
	coreSrc, join := "tgt", ""
	if len(coreKeys) > 0 {
		coreSrc, join = "upd", ` join upd on upd."id" = tgt."id"`
	}
	sql += " " + jagg + "(select " + splitOut(t, coreSrc, written, "_p", "tgt") + " from tgt" + join + ", _p) x"
	return sql
}

func removeSplitSQL(t *table, where string) string {
	view := q(t.en)
	return "with tgt as (select _t.* from " + view + " _t" + where + "), " +
		"del as (delete from " + q(t.core) + ` c where c."id" in (select "id" from tgt) returning c."id") ` + // bảng vệ tinh tự xoá theo (ON DELETE CASCADE)
		jagg + "(select " + splitOut(t, "tgt", map[string]bool{}, "", "tgt") + ` from tgt where tgt."id" in (select "id" from del)) x`
}
