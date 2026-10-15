// Package tenant: NGỮ CẢNH CÔNG TY (multi-tenant) theo từng request, mang trong context.Context
// (thay AsyncLocalStorage của server/tenant.js). Ngữ nghĩa giữ nguyên từng hàm.
package tenant

import (
	"context"

	"qspro-backend/internal/shared/jsval"
)

// Ctx: ngữ cảnh của request. UID / CongTyID / ViewAs theo JS value model (số, chuỗi hoặc nil).
type Ctx struct {
	UID      any    // id người đăng nhập
	Role     string // "user" | "admin" | "super" | "" (không có ngữ cảnh)
	CongTyID any    // công ty của người đăng nhập
	ViewAs   any    // super admin đang "xem như" công ty nào (header x-view-company)
}

type key struct{}

// With gắn ngữ cảnh công ty vào ctx (tenant.run của Node).
func With(ctx context.Context, c Ctx) context.Context {
	return context.WithValue(ctx, key{}, c)
}

// From đọc ngữ cảnh; không có -> Ctx rỗng (như {} của Node).
func From(ctx context.Context) Ctx {
	if ctx == nil {
		return Ctx{}
	}
	c, _ := ctx.Value(key{}).(Ctx)
	return c
}

// TenantID: công ty hiện hành = viewAs || congTyId || null.
func TenantID(ctx context.Context) any {
	c := From(ctx)
	if jsval.Truthy(c.ViewAs) {
		return c.ViewAs
	}
	if jsval.Truthy(c.CongTyID) {
		return c.CongTyID
	}
	return nil
}

// IsSuper: role === "super".
func IsSuper(ctx context.Context) bool { return From(ctx).Role == "super" }

// IsAdmin: role là "admin" hoặc "super".
func IsAdmin(ctx context.Context) bool {
	r := From(ctx).Role
	return r == "admin" || r == "super"
}

// UID: uid || null.
func UID(ctx context.Context) any {
	if u := From(ctx).UID; jsval.Truthy(u) {
		return u
	}
	return nil
}

// Scoped: có áp bộ lọc công ty không.
//   - Không có ngữ cảnh (vd đang login)  -> KHÔNG lọc
//   - Super admin chưa chọn công ty nào  -> KHÔNG lọc (thấy toàn hệ thống)
//   - Còn lại                            -> lọc theo công ty
func Scoped(ctx context.Context) bool { return TenantID(ctx) != nil }
