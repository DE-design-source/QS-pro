package materials

import (
	"context"
	"strconv"
	"strings"
	"unicode/utf8"

	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// parseItems = parseItems_ (A:467): JSON.parse khoan dung của cột delete_requests.items (chuỗi JSON).
func parseItems(v any) any {
	parsed, err := omap.DecodeString(jsval.ToString(jsval.Or(v, "[]")))
	if err != nil || !jsval.Truthy(parsed) {
		return []any{}
	}
	return parsed
}

// tenNguoi: me ? (me.ho_ten || me.username) : actor.u.
func (s *Service) tenNguoi(ctx context.Context, a *actor.Actor) (string, error) {
	me, err := s.users.GetByID(ctx, a.UID)
	if err != nil {
		return "", err
	}
	if me == nil {
		return a.U, nil
	}
	return jsval.ToString(jsval.Or(me.Val("ho_ten"), me.Val("username"))), nil
}

// lyDoMax: độ dài tối đa (ký tự) của lý do xoá / lý do từ chối (M15.2).
const lyDoMax = 500

// lyDoOf (M15.2, chỉ bản Go): lý do tuỳ chọn - chuỗi đã trim; thiếu / null / không phải chuỗi / rỗng -> "" (không ghi gì,
// giữ nguyên lệnh ghi như Node). Dài quá lyDoMax ký tự -> lỗi.
func lyDoOf(v any) (string, error) {
	t, _ := v.(string)
	t = strings.TrimSpace(t)
	if utf8.RuneCountInString(t) > lyDoMax {
		return "", apperr.New("Lý do tối đa " + strconv.Itoa(lyDoMax) + " ký tự")
	}
	return t, nil
}

// noiLyDo: thân thông báo + ": " + lý do (khi có).
func noiLyDo(body, lyDo string) string {
	if lyDo == "" {
		return body
	}
	return body + ": " + lyDo
}

// RequestDeleteProducts = requestDeleteProducts (A:468-478): nhân viên gửi yêu cầu xoá, báo cho admin của công ty.
// lyDoV (tham số cuối, chỉ bản Go, M15.2): lý do xoá tuỳ chọn -> cột note (đã có sẵn) của cùng lệnh chèn, chỉ khi khác rỗng,
// và nối vào thông báo gửi admin.
func (s *Service) RequestDeleteProducts(ctx context.Context, a *actor.Actor, items any, lyDoV any) (*omap.Map, error) {
	list := []any{}
	for _, raw := range jsval.AsArray(items) {
		if raw == nil {
			return nil, apperr.New("Cannot read properties of null (reading 'maSP')")
		}
		it := jsval.AsMap(raw) // phần tử không phải object: mọi khoá là undefined -> maSP rỗng -> bị lọc
		maSP := jsval.ToString(jsval.Or(it.Val("maSP"), it.Val("ma"), ""))
		if maSP == "" {
			continue
		}
		id := ""
		if jsval.Truthy(it.Val("id")) {
			id = jsval.ToString(it.Val("id"))
		}
		list = append(list, omap.Of("maSP", maSP, "id", id, "ten", jsval.ToString(jsval.Or(it.Val("ten"), ""))))
	}
	if len(list) == 0 {
		return nil, apperr.New("Chưa chọn sản phẩm hợp lệ")
	}
	lyDo, err := lyDoOf(lyDoV)
	if err != nil {
		return nil, err
	}
	who, err := s.tenNguoi(ctx, a)
	if err != nil {
		return nil, err
	}
	js, err := omap.MarshalString(list)
	if err != nil {
		return nil, err
	}
	row := omap.Of("requester_id", a.UID, "requester_name", who, "items", js, "status", "pending")
	if lyDo != "" {
		row.Set("note", lyDo)
	}
	res, err := s.repo.InsertOne(ctx, "delete_requests", row)
	if err != nil {
		return nil, err
	}
	admins, err := s.admins.ActiveAdmins(ctx)
	if err != nil {
		return nil, err
	}
	n := jsval.ToString(float64(len(list)))
	for _, ad := range admins {
		if len(res) == 0 { // Node chỉ đọc req.id trong vòng lặp: không có admin thì không lỗi
			return nil, apperr.New("Cannot read properties of undefined (reading 'id')")
		}
		s.notifier.Notify(ctx, jsval.Get(ad, "id"), "delete_request", "Yêu cầu xóa sản phẩm", noiLyDo(who+" yêu cầu xóa "+n+" sản phẩm", lyDo), res[0].Val("id"))
	}
	s.logAudit(ctx, a, "request_delete", who+" yêu cầu xóa "+n+" SP")
	return omap.Of("ok", true, "count", float64(len(list))), nil
}

// ListDeleteRequests = listDeleteRequests (A:479-482): 200 yêu cầu mới nhất của công ty.
// Khoá chỉ bản Go nối cuối (M15.2): lyDo = note (lý do người gửi), lyDoTuChoi = resolution_note; giá trị cột giữ nguyên.
func (s *Service) ListDeleteRequests(ctx context.Context, _ *actor.Actor) ([]any, error) {
	rows, err := s.repo.Select(ctx, "delete_requests", database.SelectOpt{Order: "created_at.desc", Limit: 200})
	if err != nil {
		return nil, err
	}
	out := make([]any, len(rows))
	for i, r := range rows {
		out[i] = omap.Of("id", r.Val("id"), "requester", r.Val("requester_name"), "items", parseItems(r.Val("items")), "status", r.Val("status"),
			"at", r.Val("created_at"), "resolvedAt", r.Val("resolved_at"), "resolver", r.Val("resolver_name"),
			"lyDo", r.Val("note"), "lyDoTuChoi", r.Val("resolution_note"))
	}
	return out, nil
}

// ResolveDeleteRequest = resolveDeleteRequest (A:483-507): duyệt (xoá sản phẩm) hoặc từ chối.
// Giành quyền xử lý bằng update có điều kiện status = pending nên hai admin bấm cùng lúc chỉ một người thắng.
// lyDoV (tham số cuối, chỉ bản Go, M15.2): lý do từ chối tuỳ chọn. Chỉ khi từ chối và có giá trị: lệnh RIÊNG ghi
// resolution_note sau lệnh giành quyền (cột của migration 0010; lỗi - kể cả 42703 / PGRST204 - chỉ ghi log), và nối vào
// thông báo cho người gửi. Duyệt thì bỏ qua lý do.
func (s *Service) ResolveDeleteRequest(ctx context.Context, a *actor.Actor, id any, approve any, lyDoV any) (*omap.Map, error) {
	rows, err := s.repo.Select(ctx, "delete_requests", database.SelectOpt{Filter: database.Eq("id", id), Limit: 1})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, apperr.New("Không tìm thấy yêu cầu")
	}
	r := rows[0]
	if r.Val("status") != "pending" {
		return nil, apperr.New("Yêu cầu đã được xử lý")
	}
	lyDo, err := lyDoOf(lyDoV)
	if err != nil {
		return nil, err
	}
	// items.length và items[i] đúng theo kiểu JSON của cột items: mảng, chuỗi (từng ký tự), object có khoá "length"
	var doDai any = jsval.Undefined
	phanTu := func(int) any { return jsval.Undefined }
	switch v := parseItems(r.Val("items")).(type) {
	case []any:
		doDai, phanTu = float64(len(v)), func(i int) any { return v[i] }
	case string:
		doDai, phanTu = float64(jsval.Len16(v)), func(int) any { return "" } // ký tự: .id / .maSP đều undefined
	case *omap.Map:
		doDai, phanTu = v.Val("length"), func(i int) any { return v.Val(strconv.Itoa(i)) }
	}
	soSP := jsval.ToString(doDai)
	resolver, err := s.tenNguoi(ctx, a)
	if err != nil {
		return nil, err
	}
	ok := jsval.Truthy(approve)
	status := "rejected"
	if ok {
		status = "approved"
	}
	claim, err := s.repo.Update(ctx, "delete_requests", database.Eq("id", id)+"&status=eq.pending",
		omap.Of("status", status, "resolver_name", resolver, "resolved_at", jsval.NowISO()))
	if err != nil {
		return nil, err
	}
	if len(claim) == 0 {
		return nil, apperr.New("Yêu cầu đã được xử lý")
	}
	if !ok {
		if lyDo != "" {
			if _, err := s.repo.Update(ctx, "delete_requests", database.Eq("id", id), omap.Of("resolution_note", lyDo)); err != nil {
				logger.Error("sản phẩm", "ghi lý do từ chối lỗi:", err.Error())
			}
		}
		s.notifier.Notify(ctx, r.Val("requester_id"), "delete_rejected", "Yêu cầu xóa bị từ chối",
			noiLyDo("Yêu cầu xóa "+soSP+" sản phẩm không được duyệt", lyDo), r.Val("id"))
		s.logAudit(ctx, a, "reject_delete", "Từ chối yêu cầu xóa #"+jsval.ToString(id))
		return omap.Of("ok", true), nil
	}
	deleted := 0
	loiXoa := ""
	// xoá theo id dòng = đúng biến thể người gửi chọn; lỗi từng sản phẩm bị nuốt, chỉ giữ thông báo đầu tiên
	for i, soLan := 0, jsval.ToNumber(doDai); float64(i) < soLan; i++ {
		var err error
		switch raw := phanTu(i); {
		case raw == nil:
			err = apperr.New("Cannot read properties of null (reading 'id')")
		case jsval.IsUndefined(raw):
			err = apperr.New("Cannot read properties of undefined (reading 'id')")
		default:
			it := jsval.AsMap(raw)
			_, err = s.DeleteDbProduct(ctx, a, jsval.Or(it.Val("id"), it.Val("maSP")))
		}
		if err == nil {
			deleted++
		} else if loiXoa == "" {
			loiXoa = err.Error()
		}
	}
	n := jsval.ToString(float64(deleted))
	s.notifier.Notify(ctx, r.Val("requester_id"), "delete_approved", "Yêu cầu xóa đã được duyệt",
		"Đã xóa "+n+"/"+soSP+" sản phẩm bạn yêu cầu", r.Val("id"))
	s.logAudit(ctx, a, "approve_delete", "Duyệt xóa "+n+" SP (yêu cầu #"+jsval.ToString(id)+" của "+jsval.ToString(r.Val("requester_name"))+")")
	return omap.Of("ok", true, "deleted", float64(deleted), "loi", loiXoa), nil
}
