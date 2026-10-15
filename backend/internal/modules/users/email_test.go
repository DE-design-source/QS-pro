package users

import (
	"context"
	"testing"

	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// emailRepo: repository giả cho đường sửa email (M14.1, chỉ bản Go).
type emailRepo struct {
	fakeRepo
	user    *omap.Map
	others  []*omap.Map // tài khoản khác: {id, cong_ty_id, email}
	lookups []string    // "email|công ty|trừ id" của mỗi lần kiểm trùng
	patches []*omap.Map
}

func (r *emailRepo) UserByID(_ context.Context, id any) (*omap.Map, error) {
	if jsval.ToString(id) == jsval.ToString(r.user.Val("id")) {
		return r.user, nil
	}
	return nil, nil
}

func (r *emailRepo) UserByEmailInCompanyExcept(_ context.Context, email string, ct, except any) (*omap.Map, error) {
	r.lookups = append(r.lookups, email+"|"+jsval.StrOr(ct, "")+"|"+jsval.ToString(except))
	for _, o := range r.others {
		if jsval.StrOr(o.Val("cong_ty_id"), "") == jsval.StrOr(ct, "") && toLowerCase(jsval.AsString(o.Val("email"))) == email &&
			jsval.ToString(o.Val("id")) != jsval.ToString(except) {
			return o, nil
		}
	}
	return nil, nil
}

func (r *emailRepo) UpdateUser(_ context.Context, _ any, patch *omap.Map) ([]*omap.Map, error) {
	r.patches = append(r.patches, patch)
	row := r.user.Clone()
	for _, k := range patch.Keys() {
		row.Set(k, patch.Val(k))
	}
	return []*omap.Map{row}, nil
}

func TestAdminUpdateUserEmail(t *testing.T) {
	sa := &actor.Actor{UID: "s", U: "sa", R: "super"}
	ctx := context.Background()
	newRepo := func(oldEmail string) *emailRepo {
		return &emailRepo{
			user: omap.Of("id", "u1", "username", "nv", "role", "staff", "cong_ty_id", "c1", "email", oldEmail),
			others: []*omap.Map{
				omap.Of("id", "u2", "cong_ty_id", "c1", "email", "Trung@Cty.vn"),
				omap.Of("id", "u3", "cong_ty_id", "c2", "email", "khac@cty.vn"),
			},
		}
	}
	cases := []struct {
		name, old string
		fields    *omap.Map
		err       string
		email     any // giá trị ghi vào patch; nil = không ghi
		lookups   int
	}{
		{"chuẩn hoá", "", omap.Of("email", "  Moi@Cty.VN "), "", "moi@cty.vn", 1},
		{"rỗng = xoá", "cu@cty.vn", omap.Of("email", "   "), "", "", 0},
		{"null = xoá", "cu@cty.vn", omap.Of("email", nil), "", "", 0},
		{"sai dạng", "", omap.Of("email", "khong-co-a-cong"), msgEmailBad, nil, 0},
		{"hai @", "", omap.Of("email", "a@b@c"), msgEmailBad, nil, 0},
		{"khoảng trắng giữa", "", omap.Of("email", "a b@c"), msgEmailBad, nil, 0},
		{"khoảng trắng Unicode", "", omap.Of("email", "a b@c"), msgEmailBad, nil, 0},
		{"trùng cùng công ty (hoa thường)", "", omap.Of("email", "trung@cty.VN"), msgEmailDup, nil, 1},
		{"trùng công ty khác được phép", "", omap.Of("email", "khac@cty.vn"), "", "khac@cty.vn", 1},
		{"không đổi -> không kiểm, không ghi", "Cu@Cty.vn", omap.Of("email", "cu@cty.vn", "hoTen", "A"), "", nil, 0},
		{"email cũ sai dạng, không đổi -> vẫn sửa được", "Nguyen Van A@cty", omap.Of("email", " nguyen van a@CTY ", "hoTen", "A"), "", nil, 0},
		{"email cũ sai dạng, chỉ gửi email", "Nguyen Van A@cty", omap.Of("email", "Nguyen Van A@cty"), "", nil, 0},
		{"email cũ sai dạng, đổi sang sai dạng khác", "Nguyen Van A@cty", omap.Of("email", "nguyen van b@cty"), msgEmailBad, nil, 0},
		{"email cũ sai dạng, sửa cho đúng", "Nguyen Van A@cty", omap.Of("email", "NguyenVanA@cty.vn"), "", "nguyenvana@cty.vn", 1},
		{"rỗng, vẫn rỗng -> không ghi", "", omap.Of("email", "", "hoTen", "A"), "", nil, 0},
		{"chuyển công ty -> kiểm ở công ty mới", "khac@cty.vn", omap.Of("congTyId", "c2", "email", "khac@cty.vn"), msgEmailDup, nil, 1},
		{"chuyển công ty, email cũ sai dạng -> chỉ kiểm trùng", "a b@c", omap.Of("congTyId", "c2", "email", "a b@c"), "", nil, 1},
		{"không gửi email -> không đụng", "cu@cty.vn", omap.Of("hoTen", "B"), "", nil, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := newRepo(c.old)
			s := &Service{repo: r}
			res, err := s.AdminUpdateUser(ctx, sa, "u1", c.fields)
			if c.err != "" {
				if err == nil || err.Error() != c.err {
					t.Fatalf("lỗi = %v, muốn %q", err, c.err)
				}
				if len(r.patches) != 0 {
					t.Errorf("lỗi mà vẫn ghi: %s", js(r.patches))
				}
			} else if err != nil {
				t.Fatalf("lỗi bất ngờ: %v", err)
			}
			if len(r.lookups) != c.lookups {
				t.Errorf("kiểm trùng %d lần (%v), muốn %d", len(r.lookups), r.lookups, c.lookups)
			}
			if c.err != "" {
				return
			}
			if c.email == nil && len(r.patches) == 0 {
				return
			}
			p := r.patches[0]
			if c.email == nil {
				if p.Has("email") {
					t.Errorf("patch có email: %s", js(p))
				}
				return
			}
			if p.Val("email") != c.email {
				t.Errorf("patch email = %v, muốn %v", p.Val("email"), c.email)
			}
			if out := jsval.AsMap(res); out == nil || out.Val("email") != c.email {
				t.Errorf("kết quả = %s", js(res))
			}
		})
	}
	// Kiểm trùng phải loại chính tài khoản đang sửa và dùng công ty sau khi sửa
	r := newRepo("")
	_, _ = (&Service{repo: r}).AdminUpdateUser(ctx, sa, "u1", omap.Of("congTyId", "c9", "email", "x@y"))
	if len(r.lookups) != 1 || r.lookups[0] != "x@y|c9|u1" {
		t.Errorf("lookups = %v", r.lookups)
	}
}

// reEmail khớp regex của JS; đường TẠO không dùng nó (golden pure.json tạo tài khoản email "e@x", Node lưu nguyên văn).
func TestReEmail(t *testing.T) {
	if !reEmail.MatchString("e@x") || reEmail.MatchString("@x") || reEmail.MatchString("e@") {
		t.Fatal("reEmail khác /^[^\\s@]+@[^\\s@]+$/")
	}
}
