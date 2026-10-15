package users

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/shared/jsval"
)

// TestUserByEmailInCompanyExceptDB: câu truy vấn thật của kiểm trùng email (M14.1, chỉ bản Go) trên qspro_gotest -
// ilike không phân biệt hoa thường, thoát \ % _, "*" -> "_", nhánh không công ty, loại chính tài khoản đang sửa.
// Dữ liệu riêng mỗi lần chạy (mã công ty / tên đăng nhập có hậu tố thời gian) để không đụng bộ thử khác.
func TestUserByEmailInCompanyExceptDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("chưa đặt TEST_DATABASE_URL")
	}
	if !regexp.MustCompile(`/qspro_gotest(\?|$)`).MatchString(url) {
		t.Fatal("TEST_DATABASE_URL phải trỏ tới database thử qspro_gotest")
	}
	db := database.New(database.Config{URL: url})
	defer db.Close()
	pool, err := db.Pool()
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	tag := fmt.Sprintf("zz_u3db_%d", time.Now().UnixNano())
	sweep := func() {
		for _, q := range []string{
			"delete from users where username like $1 || '%'",
			"delete from companies where code like replace($1, '_', '-') || '%'",
		} {
			if _, err := pool.Exec(ctx, q, tag); err != nil {
				t.Errorf("dọn dữ liệu thử: %v", err)
			}
		}
	}
	defer sweep()

	ctID := func(k string) string {
		var id string
		code := fmt.Sprintf("%s-%s", strings.ReplaceAll(tag, "_", "-"), k)
		if err := pool.QueryRow(ctx, "insert into companies(name, code) values ($1, $2) returning id::text", "ZZ_U3DB "+k, code).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	A, B := ctID("a"), ctID("b")
	ids := map[string]string{}
	user := func(k string, ct any, email string) {
		var id string
		if err := pool.QueryRow(ctx, "insert into users(username, password_hash, company_id, email) values ($1, 'x', $2, $3) returning id::text",
			tag+"_"+k, ct, email).Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids[k] = id
	}
	user("self", A, "self@x")
	user("trung", A, "Trung@Cty.vn")
	user("under", A, "a_b@x")
	user("pct", A, "a%b@x")
	user("plain", A, "axb@x")
	user("bs", A, `back\slash@x`)
	user("star", A, "star*x@y")
	user("star1", A, "star1x@y")
	user("punct", A, `p,q(r)&s+t"u@x`)
	user("khac", B, "khac@x")
	user("none", nil, "none@x")

	r := &pgRepo{db: db}
	cases := []struct {
		name, email string
		ct          any
		except      string
		want        string // khoá trong ids, "" = không trùng
	}{
		{"hoa thường", "trung@cty.vn", A, "self", "trung"},
		{"công ty khác", "trung@cty.vn", B, "self", ""},
		{"loại chính mình", "trung@cty.vn", A, "trung", ""},
		{"_ không là ký tự đại diện", "a_b@x", A, "under", ""},
		{"_ khớp đúng chữ", "a_b@x", A, "self", "under"},
		{"% không là ký tự đại diện", "a%b@x", A, "pct", ""},
		{"% khớp đúng chữ", "a%b@x", A, "self", "pct"},
		{`\ khớp đúng chữ`, `back\slash@x`, A, "self", "bs"},
		{"* khớp đúng chữ", "star*x@y", A, "self", "star"},
		{"* không khớp ký tự khác", "star*x@y", A, "star", ""},
		{"dấu câu", `p,q(r)&s+t"u@x`, A, "self", "punct"},
		{"không công ty", "none@x", nil, "self", "none"},
		{"không công ty, tìm trong A", "none@x", A, "self", ""},
		{"công ty B", "khac@x", B, "self", "khac"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			row, err := r.UserByEmailInCompanyExcept(ctx, c.email, c.ct, ids[c.except])
			if err != nil {
				t.Fatalf("lỗi: %v", err)
			}
			got := ""
			if row != nil {
				for k, id := range ids {
					if jsval.ToString(row.Val("id")) == id {
						got = k
					}
				}
				if got == "" {
					t.Fatalf("khớp tài khoản ngoài bộ thử: %v", row.Val("id"))
				}
			}
			if got != c.want {
				t.Errorf("khớp %q, muốn %q", got, c.want)
			}
		})
	}
}
