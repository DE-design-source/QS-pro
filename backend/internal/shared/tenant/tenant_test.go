package tenant

import (
	"context"
	"testing"
)

func TestSemantics(t *testing.T) {
	bg := context.Background()
	if Scoped(bg) || TenantID(bg) != nil || IsAdmin(bg) || IsSuper(bg) || UID(bg) != nil {
		t.Fatal("không có ngữ cảnh thì không lọc")
	}
	u := With(bg, Ctx{UID: 5.0, Role: "admin", CongTyID: 3.0})
	if !Scoped(u) || TenantID(u) != 3.0 || !IsAdmin(u) || IsSuper(u) || UID(u) != 5.0 {
		t.Fatal("admin công ty 3")
	}
	s := With(bg, Ctx{UID: 1.0, Role: "super"})
	if Scoped(s) || !IsSuper(s) || !IsAdmin(s) {
		t.Fatal("super chưa chọn công ty: không lọc")
	}
	v := With(bg, Ctx{UID: 1.0, Role: "super", CongTyID: 9.0, ViewAs: "4"})
	if TenantID(v) != "4" {
		t.Fatal("viewAs thắng congTyId")
	}
	z := With(bg, Ctx{UID: 0.0, Role: "user", CongTyID: 0.0, ViewAs: ""})
	if Scoped(z) || UID(z) != nil {
		t.Fatal("0 và chuỗi rỗng là falsy như JS")
	}
}
