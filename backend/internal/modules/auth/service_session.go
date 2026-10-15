package auth

import (
	"context"

	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// sessEntry: một mục của _sess (A:37). u == nil là kết quả ÂM (tài khoản khoá / công ty khoá, hết hạn) - cũng được giữ 30 giây.
type sessEntry struct {
	at float64
	u  *omap.Map // {r, ct, u} theo database
}

// ForgetSession = forgetSession_ (A:39).
func (s *Service) ForgetSession(uid any) {
	s.mu.Lock()
	delete(s.sess, jsval.ToString(uid))
	s.mu.Unlock()
}

// overlay = Object.assign({}, p, u): payload của token đè r / ct / u đang có trong database.
func overlay(p, u *omap.Map) *actor.Actor {
	return actor.FromMap(omap.Assign(p.Clone(), u))
}

// SessionActor = sessionActor (A:43-56). Token sống 7 ngày nên khoá / đổi vai trò / đổi công ty phải có hiệu lực ngay:
// đối chiếu database, giữ kết quả 30 giây. Không khoá trong lúc truy vấn (Node cũng cho các request đan xen).
func (s *Service) SessionActor(ctx context.Context, token string) (*actor.Actor, error) {
	p := s.VerifyToken(token)
	if p == nil {
		return nil, nil
	}
	key := jsval.ToString(p.Val("uid"))
	s.mu.Lock()
	hit, ok := s.sess[key]
	s.mu.Unlock()
	if ok && s.now()-hit.at < sessionCacheMs {
		if hit.u == nil {
			return nil, nil
		}
		return overlay(p, hit.u), nil
	}
	rows, err := s.repo.SessionUser(ctx, p.Val("uid"))
	if err != nil {
		return nil, err
	}
	var u *omap.Map
	if len(rows) > 0 && !jsval.StrictEquals(rows[0].Val("active"), false) {
		u = omap.Of("r", rows[0].Val("role"), "ct", jsval.Or(rows[0].Val("cong_ty_id"), nil), "u", rows[0].Val("username"))
	}
	if u != nil && !jsval.StrictEquals(u.Val("r"), "super") {
		var ct *omap.Map
		if jsval.Truthy(u.Val("ct")) {
			if ct, err = s.companies.GetCongTy(ctx, u.Val("ct")); err != nil {
				return nil, err
			}
		}
		if ct == nil || !jsval.Truthy(ct.Val("active")) || s.companies.HetHan(ct) {
			u = nil
		}
	}
	s.mu.Lock()
	s.sess[key] = sessEntry{at: s.now(), u: u}
	s.mu.Unlock()
	if u == nil {
		return nil, nil
	}
	return overlay(p, u), nil
}
