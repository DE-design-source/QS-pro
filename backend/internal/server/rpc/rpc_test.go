package rpc

import (
	"context"
	"strings"
	"testing"

	"qspro-backend/internal/shared/actor"
)

func noop(context.Context, *actor.Actor, Args) (any, error) { return nil, nil }

func mustPanic(t *testing.T, want string, f func()) {
	t.Helper()
	defer func() {
		p := recover()
		if p == nil {
			t.Fatalf("không panic, muốn panic chứa %q", want)
		}
		if s, _ := p.(string); !strings.Contains(s, want) {
			t.Fatalf("panic %v, muốn chứa %q", p, want)
		}
	}()
	f()
}

func TestRegisterGoRoute(t *testing.T) {
	r := NewRegistry()
	r.Register("ctList", Login, noop)
	a := GoRoute{Name: "thuA", Method: "POST", Path: "/thu/:id", Perm: Admin, Tag: "Thử", Summary: "A",
		Fields: []GoField{{Name: "id", In: "path", Type: "string", Required: true}, {Name: "ghiChu", In: "body", Type: "string"}}}
	b := GoRoute{Name: "thuB", Method: "GET", Path: "/thu/:id", Perm: Login}
	r.RegisterGoRoute(a)
	r.RegisterGoRoute(b)

	got := r.GoRoutes()
	if len(got) != 2 || got[0].Name != "thuA" || got[1].Name != "thuB" || len(got[0].Fields) != 2 {
		t.Fatalf("GoRoutes sai thứ tự / nội dung: %+v", got)
	}
	got[0].Fields[0].Name = "doi"
	if r.GoRoutes()[0].Fields[0].Name != "id" {
		t.Error("GoRoutes phải trả bản sao")
	}
	a.Fields[1].Name = "doi"
	if r.GoRoutes()[0].Fields[1].Name != "ghiChu" {
		t.Error("RegisterGoRoute phải giữ bản sao Fields")
	}
	// route chỉ bản Go không phải hàm rpc: Names / PermOf / Has không đổi
	if n := r.Names(); len(n) != 1 || n[0] != "ctList" {
		t.Errorf("Names: %v", n)
	}
	if _, ok := r.PermOf("thuA"); ok || r.Has("thuA") {
		t.Error("route chỉ bản Go không được thành hàm rpc")
	}

	mustPanic(t, "trùng tên route chỉ bản Go", func() { r.RegisterGoRoute(GoRoute{Name: "thuA", Method: "PUT", Path: "/khac"}) })
	mustPanic(t, "trùng route chỉ bản Go", func() { r.RegisterGoRoute(GoRoute{Name: "thuC", Method: "POST", Path: "/thu/:id"}) })
	mustPanic(t, "trùng tên hàm API", func() { r.RegisterGoRoute(GoRoute{Name: "ctList", Method: "GET", Path: "/ct"}) })
	mustPanic(t, "trùng tên route chỉ bản Go", func() { r.Register("thuB", Login, noop) })
	for _, g := range []GoRoute{
		{Method: "GET", Path: "/x"},
		{Name: "x", Method: "get", Path: "/x"},
		{Name: "x", Method: "HEAD", Path: "/x"},
		{Name: "x", Method: "GET", Path: "x"},
		{Name: "x", Method: "GET"},
	} {
		mustPanic(t, "không hợp lệ", func() { r.RegisterGoRoute(g) })
	}
	mustPanic(t, "In không phải", func() {
		r.RegisterGoRoute(GoRoute{Name: "x", Method: "GET", Path: "/x", Fields: []GoField{{Name: "a", In: "header"}}})
	})
	mustPanic(t, "In không phải", func() {
		r.RegisterGoRoute(GoRoute{Name: "x", Method: "GET", Path: "/x", Fields: []GoField{{In: "query"}}})
	})
	for _, p := range []string{"/x/*rest", "/x/:", "/x/:id/y/:id"} {
		mustPanic(t, "path không hợp lệ", func() { r.RegisterGoRoute(GoRoute{Name: "x", Method: "GET", Path: p}) })
	}
	mustPanic(t, "không có trong Path", func() {
		r.RegisterGoRoute(GoRoute{Name: "x", Method: "GET", Path: "/x/:id", Fields: []GoField{{Name: "ma", In: "path"}}})
	})
	mustPanic(t, "không có trong Path", func() {
		r.RegisterGoRoute(GoRoute{Name: "x", Method: "GET", Path: "/x", Fields: []GoField{{Name: "id", In: "path"}}})
	})
	mustPanic(t, "trùng tham số body ghiChu", func() {
		r.RegisterGoRoute(GoRoute{Name: "x", Method: "POST", Path: "/x", Fields: []GoField{{Name: "ghiChu", In: "body"}, {Name: "ghiChu", In: "body", Type: "string"}}})
	})
	mustPanic(t, "trùng tham số path id", func() {
		r.RegisterGoRoute(GoRoute{Name: "x", Method: "GET", Path: "/x/:id", Fields: []GoField{{Name: "id", In: "path"}, {Name: "id", In: "path"}}})
	})
	// cùng tên ở hai chỗ khác nhau (query + body) là hợp lệ
	r.RegisterGoRoute(GoRoute{Name: "thuD", Method: "POST", Path: "/thu/:id/d", Fields: []GoField{{Name: "id", In: "path"}, {Name: "q", In: "query"}, {Name: "q", In: "body"}}})
	if len(r.GoRoutes()) != 3 {
		t.Errorf("đăng ký lỗi không được để lại route: %d", len(r.GoRoutes()))
	}
}
