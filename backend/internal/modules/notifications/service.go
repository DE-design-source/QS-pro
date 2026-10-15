// Package notifications: thông báo trong ứng dụng - bản chuyển 1:1 của server/auth.js dòng 450-464, 605-616, 669-680.
package notifications

import (
	"context"
	"strconv"

	"qspro-backend/internal/config"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/contracts"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Deps: do internal/server/routes.go truyền vào. Users và Auditor do module users cài.
type Deps struct {
	DB      *database.DB
	Cfg     *config.Config
	Users   contracts.UserReader
	Auditor contracts.Auditor
}

// Service: nghiệp vụ thông báo.
type Service struct {
	repo    Repository
	cfg     *config.Config
	users   contracts.UserReader
	auditor contracts.Auditor
}

var (
	_ contracts.Notifier         = (*Service)(nil)
	_ contracts.AdminLister      = (*Service)(nil)
	_ contracts.PurchaseNotifier = (*Service)(nil)
)

// New tạo service.
func New(d Deps) *Service {
	return &Service{repo: newPgRepo(d.DB), cfg: d.Cfg, users: d.Users, auditor: d.Auditor}
}

func uidOf(a *actor.Actor) any {
	if a == nil {
		return jsval.Undefined
	}
	return a.UID
}

// needActor: actor.uid khi actor là null -> TypeError như V8 (cổng rpc luôn truyền actor nên không tới được từ ngoài).
func needActor(a *actor.Actor) error {
	if a == nil {
		return apperr.New("Cannot read properties of null (reading 'uid')")
	}
	return nil
}

// ActiveAdmins: admin đang hoạt động trong phạm vi công ty của ctx (getAdmins_, A:450).
func (s *Service) ActiveAdmins(ctx context.Context) ([]any, error) {
	rows, err := s.repo.AdminUsers(ctx)
	if err != nil {
		return nil, err
	}
	out := []any{}
	for _, u := range rows {
		if !jsval.StrictEquals(u.Val("active"), false) {
			out = append(out, u)
		}
	}
	return out, nil
}

// Notify: chèn 1 thông báo; lỗi chèn chỉ ghi log (notify_, A:451-454).
func (s *Service) Notify(ctx context.Context, userID any, kind, title, body string, refID any) {
	if !jsval.Truthy(userID) {
		return
	}
	err := s.repo.Insert(ctx, omap.Of("user_id", userID, "kind", kind, "title", title, "body", body,
		"ref_id", jsval.Or(refID, nil), "is_read", false))
	if err != nil {
		logger.Error("notify", "insert lỗi:", err.Error())
	}
}

// NotifCount: số thông báo chưa đọc (A:455-458).
func (s *Service) NotifCount(ctx context.Context, a *actor.Actor) (*omap.Map, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	rows, err := s.repo.UnreadIDs(ctx, uidOf(a))
	if err != nil {
		return nil, err
	}
	return omap.Of("unread", float64(len(rows))), nil
}

// NotifList: danh sách thông báo mới nhất trước (A:459-462).
func (s *Service) NotifList(ctx context.Context, a *actor.Actor, limit any) ([]any, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	n, zero, _, err := listLimit(limit)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.ListByUser(ctx, uidOf(a), n)
	if err != nil {
		return nil, err
	}
	if zero {
		rows = nil
	}
	out := make([]any, len(rows))
	for i, r := range rows {
		out[i] = notifOut(r)
	}
	return out, nil
}

// notifOut: dòng notifications -> object cho client (A:461). read chỉ true khi is_read === true.
func notifOut(r *omap.Map) *omap.Map {
	return omap.Of("id", r.Val("id"), "kind", r.Val("kind"), "title", r.Val("title"), "body", r.Val("body"),
		"refId", r.Val("ref_id"), "read", r.Val("is_read") == true, "at", r.Val("created_at"))
}

// NotifRead: đánh dấu 1 thông báo của mình là đã đọc (A:463).
func (s *Service) NotifRead(ctx context.Context, a *actor.Actor, id any) (*omap.Map, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	if err := s.repo.MarkRead(ctx, id, uidOf(a)); err != nil {
		return nil, err
	}
	return omap.Of("ok", true), nil
}

// NotifReadAll: đánh dấu mọi thông báo của mình là đã đọc (A:464).
func (s *Service) NotifReadAll(ctx context.Context, a *actor.Actor) (*omap.Map, error) {
	if err := needActor(a); err != nil {
		return nil, err
	}
	if err := s.repo.MarkAllRead(ctx, uidOf(a)); err != nil {
		return nil, err
	}
	return omap.Of("ok", true), nil
}

// whoOf: tên người gửi = me ? (me.ho_ten || me.username) : (actor.u || "") đã đổi sang chuỗi như phép nối chuỗi của JS.
func (s *Service) whoOf(ctx context.Context, a *actor.Actor) (string, error) {
	if err := needActor(a); err != nil {
		return "", err
	}
	me, err := s.users.GetByID(ctx, a.UID)
	if err != nil {
		return "", err
	}
	if me != nil {
		return jsval.ToString(jsval.Or(me.Val("ho_ten"), me.Val("username"))), nil
	}
	return a.U, nil
}

// propOf: o[key] của JS; o là null / undefined -> TypeError như V8.
func propOf(o any, key string) (any, error) {
	if jsval.IsNullish(o) {
		kind := "null"
		if jsval.IsUndefined(o) {
			kind = "undefined"
		}
		return nil, apperr.New("Cannot read properties of " + kind + " (reading '" + key + "')")
	}
	return jsval.Get(o, key), nil
}

func ngoac(supplier any) string {
	if jsval.Truthy(supplier) {
		return " (" + jsval.ToString(supplier) + ")"
	}
	return ""
}

// NotifyPurchaseAdmins: báo admin về các đơn mua hàng mới rồi ghi audit (A:605-616).
func (s *Service) NotifyPurchaseAdmins(ctx context.Context, a *actor.Actor, orders []any) error {
	who, err := s.whoOf(ctx, a)
	if err != nil {
		return err
	}
	admins, err := s.ActiveAdmins(ctx)
	if err != nil {
		return err
	}
	for _, o := range orders {
		for _, ad := range admins {
			maDon, err := propOf(o, "maDon")
			if err != nil {
				return err
			}
			supplier := jsval.Get(o, "supplier")
			s.Notify(ctx, jsval.Get(ad, "id"), kindPurchase, titlePurchase,
				who+" gửi đơn "+jsval.ToString(maDon)+ngoac(supplier), jsval.ToString(maDon))
		}
	}
	s.auditor.Audit(ctx, a, "request_purchase", who+" gửi "+strconv.Itoa(len(orders))+" đơn mua hàng", nil)
	return nil
}

// DeXuatTen: DX_TEN[loai] || "đề xuất" (A:669, 674).
func (s *Service) DeXuatTen(loai string) string {
	if t, ok := dxTen[loai]; ok {
		return t
	}
	if t, ok := dxTenProto[loai]; ok {
		if t == "" {
			return "function " + loai + "() { [native code] }"
		}
		return t
	}
	return dxTenMacDinh
}

// NotifyDeXuatAdmins: báo admin về 1 đề xuất mới rồi ghi audit (A:670-680).
func (s *Service) NotifyDeXuatAdmins(ctx context.Context, a *actor.Actor, dx *omap.Map) error {
	who, err := s.whoOf(ctx, a)
	if err != nil {
		return err
	}
	admins, err := s.ActiveAdmins(ctx)
	if err != nil {
		return err
	}
	if dx == nil {
		return apperr.New("Cannot read properties of null (reading 'loai')")
	}
	ten := s.DeXuatTen(jsval.ToString(dx.Val("loai")))
	ma := jsval.ToString(dx.Val("ma"))
	for _, ad := range admins {
		s.Notify(ctx, jsval.Get(ad, "id"), kindDeXuat, titleDeXuat, who+" gửi "+ten+" "+ma+ngoac(dx.Val("supplier")), ma)
	}
	s.auditor.Audit(ctx, a, "request_de_xuat", who+" gửi "+ten+" "+ma, nil)
	return nil
}
