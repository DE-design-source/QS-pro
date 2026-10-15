package companies

import (
	"context"
	"testing"
	"time"

	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// mauRepo: ghi lại patch của updateCongTy (M17.2).
type mauRepo struct {
	fakeRepo
	patches []*omap.Map
}

func (r *mauRepo) UpdateCongTy(_ context.Context, id any, patch *omap.Map) ([]*omap.Map, error) {
	r.patches = append(r.patches, patch)
	return []*omap.Map{omap.Assign(omap.Of("id", id), patch)}, nil
}

func TestCheckMauChinh(t *testing.T) {
	ok := []any{nil, jsval.Undefined, "", "#fff", "#123", "#1F6FEB", "#abcdef", "#ABC"}
	bad := []any{"red", "#12", "#1234", "#12345", "#1234567", "1F6FEB", "#GGGGGG", " #fff", "#fff ", 5.0, true, "rgb(0,0,0)"}
	for _, v := range ok {
		if err := checkMauChinh(v); err != nil {
			t.Errorf("checkMauChinh(%v) = %v, muốn nhận", v, err)
		}
	}
	for _, v := range bad {
		if err := checkMauChinh(v); err == nil || err.Error() != msgMauChinh {
			t.Errorf("checkMauChinh(%v) = %v, muốn %q", v, err, msgMauChinh)
		}
	}
}

func TestUpdateCongTyMauChinh(t *testing.T) {
	ctx := context.Background()
	admin := &actor.Actor{UID: "a1", U: "ad", R: "admin", CT: "C1"}
	for _, c := range []struct {
		who   *actor.Actor
		id    string
		data  *omap.Map
		err   string
		write string
	}{
		{admin, "C1", omap.Of("mauChinh", "red"), msgMauChinh, ""},
		{super, "C1", omap.Of("ten", "X", "mauChinh", "#12345"), msgMauChinh, ""},
		{admin, "C1", omap.Of("mauChinh", "#1F6FEB", "sdt", "0909"), "", `{"mau_chinh":"#1F6FEB","sdt":"0909"}`},
		{admin, "C1", omap.Of("mauChinh", ""), "", `{"mau_chinh":""}`},
		{admin, "C1", omap.Of("mauChinh", "#fff"), "", `{"mau_chinh":"#fff"}`},
		{admin, "C1", omap.Of("mauChinh", nil, "email", "a@b"), "", `{"email":"a@b"}`},
		// sai công ty: lỗi quyền đi TRƯỚC lỗi màu (giữ thông báo của Node)
		{admin, "C2", omap.Of("mauChinh", "red"), msgOwnOnly, ""},
	} {
		r := &mauRepo{}
		s := &Service{repo: r, now: time.Now, auditor: &auditStub{}}
		_, err := s.UpdateCongTy(ctx, c.who, c.id, c.data)
		if c.err != "" {
			if err == nil || err.Error() != c.err {
				t.Errorf("%s: lỗi = %v, muốn %q", js(t, c.data), err, c.err)
			}
			if len(r.patches) != 0 {
				t.Errorf("%s: lỗi mà vẫn ghi", js(t, c.data))
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: lỗi bất ngờ %v", js(t, c.data), err)
			continue
		}
		if len(r.patches) != 1 || js(t, r.patches[0]) != c.write {
			t.Errorf("%s: ghi %d lần, patch = %v, muốn %s", js(t, c.data), len(r.patches), r.patches, c.write)
		}
	}
}

func TestCreateCongTyMauChinh(t *testing.T) {
	r := &fakeRepo{}
	s := &Service{repo: r, now: time.Now, auditor: &auditStub{}, creator: &creatorStub{}}
	if _, err := s.CreateCongTy(context.Background(), super, omap.Of("ten", "Cty", "mauChinh", "blue")); err == nil || err.Error() != msgMauChinh {
		t.Fatalf("lỗi = %v, muốn %q", err, msgMauChinh)
	}
	if r.inserted != nil {
		t.Fatal("màu sai mà vẫn chèn công ty")
	}
	// màu hợp lệ: như Node, không lưu khi tạo (golden s04 trả mauChinh "")
	if _, err := s.CreateCongTy(context.Background(), super, omap.Of("ten", "Cty", "mauChinh", "#fff")); err != nil {
		t.Fatal(err)
	}
	if r.inserted == nil || r.inserted.Has("mau_chinh") {
		t.Errorf("dòng chèn = %v", r.inserted)
	}
}
