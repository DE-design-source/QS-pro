package estimates

import (
	"bufio"
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/server/rpc"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/tenant"
)

/* Đối chiếu với Node trên database thật: chạy các bước của testdata/dbdiff-cases.json qua cổng rpc (RegisterRPC)
   trên qspro_gotest và so từng dòng với testdata/dbdiff-golden.txt - kết quả của testdata/dbdiff-node.js chạy
   CÙNG các bước qua mã Node trên qspro_nodetest. Id và mốc thời gian được che theo cùng một quy tắc ở hai bên. */

var (
	reUUID  = regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	reTS    = regexp.MustCompile(`\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d(:\d\d)?)?`)
	reIDArg = regexp.MustCompile(`^\$id:\d+$`)
)

type masker struct {
	ids map[string]string
}

func (m *masker) mask(s string) string {
	s = reUUID.ReplaceAllStringFunc(s, func(u string) string {
		if _, ok := m.ids[u]; !ok {
			m.ids[u] = "<id" + strconv.Itoa(len(m.ids)+1) + ">"
		}
		return m.ids[u]
	})
	return reTS.ReplaceAllString(s, "<ts>")
}

func TestDBDiff(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !strings.Contains(url, "/qspro_gotest") {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	b, err := os.ReadFile(filepath.Join("testdata", "dbdiff-cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	specV, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	spec := jsval.AsMap(specV)
	actorName, prefix := jsval.AsString(spec.Val("actorName")), jsval.AsString(spec.Val("prefix"))

	db := database.New(database.Config{URL: url})
	defer db.Close()
	bg := context.Background()
	no := database.Opt{NoScope: true}

	// Tài khoản + công ty có sẵn trong seed. KHÔNG lấy "tài khoản đầu tiên theo id": gói test khác tạo tài khoản tạm
	// có uuid nhỏ rồi xoá giữa chừng -> dòng lịch sử vướng khoá ngoại, công tác mất theo công ty tạm.
	us, err := db.Select(bg, "users", database.SelectOpt{Filter: database.Eq("username", "admin") + "&cong_ty_id=not.is.null", Limit: 1, NoScope: true})
	if err != nil || len(us) == 0 {
		t.Fatalf("database thử không có tài khoản admin thuộc công ty: %v", err)
	}
	a := &actor.Actor{UID: us[0].Val("id"), U: actorName, R: "admin", CT: us[0].Val("cong_ty_id")}
	ctx := tenant.With(bg, tenant.Ctx{UID: a.UID, Role: a.R, CongTyID: a.CT})
	like := "ten=like.*" + prefix + "*"

	ids := []string{}
	cleanup := func() {
		if _, err := db.Remove(bg, "cong_tac", like, no); err != nil {
			t.Errorf("dọn cong_tac: %v", err)
		}
		if _, err := db.Remove(bg, "cong_tac_history", database.Eq("changed_by_name", actorName), no); err != nil {
			t.Errorf("dọn cong_tac_history: %v", err)
		}
		if len(ids) > 0 {
			if _, err := db.Remove(bg, "cong_tac_history", "cong_tac_id=in.("+strings.Join(ids, ",")+")", no); err != nil {
				t.Errorf("dọn cong_tac_history theo id: %v", err)
			}
		}
	}
	cleanup()
	defer cleanup()

	au := &fakeAudit{}
	svc := New(Deps{DB: db, Perms: fakePerms{edit: true, duyet: true}, Auditor: au})
	reg := rpc.NewRegistry()
	svc.RegisterRPC(reg)

	var fill func(v any) any
	fill = func(v any) any {
		switch x := v.(type) {
		case string:
			if reIDArg.MatchString(x) {
				if i, _ := strconv.Atoi(x[4:]); i < len(ids) {
					return ids[i]
				}
				return "MISSING"
			}
		case []any:
			out := make([]any, len(x))
			for i, it := range x {
				out[i] = fill(it)
			}
			return out
		case *omap.Map:
			out := omap.New()
			x.Each(func(k string, it any) { out.Set(k, fill(it)) })
			return out
		}
		return v
	}

	mk := &masker{ids: map[string]string{}}
	var got []string
	emit := func(name string, v any) {
		s, err := omap.MarshalString(v)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if os.Getenv("ESTIMATES_RAW") != "" && strings.HasPrefix(name, "hist") {
			t.Logf("RAW %s %s", name, s)
		}
		got = append(got, name+"\t"+mk.mask(s))
	}

	for _, stV := range jsval.AsArray(spec.Val("steps")) {
		st := jsval.AsMap(stV)
		name := jsval.AsString(st.Val("n"))
		switch st.Val("dump") {
		case "rows":
			rows, err := db.Select(ctx, "cong_tac", database.SelectOpt{Filter: like, Order: "ten.asc"})
			if err != nil {
				t.Fatalf("%s: %v", name, err)
			}
			emit(name, jsval.Rows(rows))
			continue
		case "history":
			out := []any{}
			if len(ids) > 0 {
				rows, err := db.Select(ctx, "cong_tac_history", database.SelectOpt{Filter: "cong_tac_id=in.(" + strings.Join(ids, ",") + ")", Order: "id.asc"})
				if err != nil {
					t.Fatalf("%s: %v", name, err)
				}
				for _, r := range rows {
					c := r.Clone()
					c.Delete("id")
					out = append(out, c)
				}
			}
			emit(name, out)
			continue
		}
		fn := jsval.AsString(st.Val("fn"))
		args := jsval.AsArray(fill(st.Val("args")))
		au.recs = nil
		res, err := reg.Call(ctx, fn, a, args...)
		if err != nil {
			emit(name, omap.Of("err", err.Error()))
		} else {
			if fn == "ctSave" {
				for _, r := range jsval.AsArray(jsval.Get(res, "rows")) {
					ids = append(ids, jsval.S(jsval.Get(r, "id")))
				}
			}
			if jsval.Truthy(st.Val("onlyPrefix")) {
				keep := []any{}
				for _, r := range res.([]any) {
					if strings.Contains(jsval.ToString(jsval.Get(r, "ten")), prefix) {
						keep = append(keep, r)
					}
				}
				res = keep
			}
			if jsval.IsUndefined(res) {
				res = nil
			}
			emit(name, omap.Of("ok", res))
		}
		recs := []any{}
		for _, r := range au.recs {
			recs = append(recs, omap.Of("user_id", r.uid, "username", r.user, "action", r.action, "detail", r.detail))
		}
		emit(name+"#audit", recs)
	}

	if out := os.Getenv("ESTIMATES_DIFF_OUT"); out != "" {
		_ = os.MkdirAll(filepath.Dir(out), 0o755)
		_ = os.WriteFile(out, []byte(strings.Join(got, "\n")+"\n"), 0o644)
	}

	gf, err := os.Open(filepath.Join("testdata", "dbdiff-golden.txt"))
	if err != nil {
		t.Fatal(err)
	}
	defer gf.Close()
	var want []string
	sc := bufio.NewScanner(gf)
	sc.Buffer(make([]byte, 1<<20), 64<<20)
	for sc.Scan() {
		if ln := strings.TrimRight(sc.Text(), "\r"); ln != "" {
			want = append(want, ln)
		}
	}
	if len(got) != len(want) {
		t.Errorf("số dòng: go %d, node %d", len(got), len(want))
	}
	bad := 0
	for i := 0; i < len(got) && i < len(want); i++ {
		if got[i] != want[i] {
			bad++
			if bad <= 8 {
				t.Errorf("khác ở dòng %d:\n go:   %s\n node: %s", i+1, clip(got[i]), clip(want[i]))
			}
		}
	}
	if bad == 0 && len(got) == len(want) {
		t.Logf("khớp Node: %d dòng (%d bước)", len(got), len(jsval.AsArray(spec.Val("steps"))))
	}
}

// clip rút gọn hai dòng dài để thấy được chỗ khác nhau.
func clip(s string) string {
	if len(s) > 1600 {
		return s[:1600] + "…"
	}
	return s
}
