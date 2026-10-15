package purchasing

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strconv"

	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// postCard: POST thẻ lên webhook Lark (I:285-291, 311-316).
// ok = data && (data.code === 0 || data.StatusCode === 0 || data.msg === 'success'); warn = nội dung cảnh báo khi !ok.
// err = lỗi mạng (Node: fetch ném) - nơi gọi chỉ ghi log.
func (s *Service) postCard(ctx context.Context, card *omap.Map) (ok bool, warn string, err error) {
	url := ""
	if s.cfg != nil {
		url = s.cfg.PurchaseWebhook
	}
	if url == "" {
		return false, "", apperr.New("Failed to parse URL from ")
	}
	body, err := omap.Marshal(card)
	if err != nil {
		return false, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return false, "", apperr.New("Failed to parse URL from " + url)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := s.http.Do(req)
	if err != nil {
		// e.message của fetch luôn là "fetch failed"; lỗi của net/http kèm cả URL webhook (có token) nên không ghi ra log
		return false, "", apperr.New("fetch failed")
	}
	defer res.Body.Close()
	var data any
	if raw, rerr := io.ReadAll(res.Body); rerr == nil {
		// r.json() của Node 22 bỏ tối đa 2 BOM đầu thân (undici bỏ 1, bộ giải mã UTF-8 bỏ thêm 1)
		for i := 0; i < 2; i++ {
			raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
		}
		if v, derr := omap.Decode(raw); derr == nil {
			data = v // thân không phải JSON -> data = null
		}
	}
	m := jsval.AsMap(data)
	ok = m != nil && (jsval.StrictEquals(m.Val("code"), 0.0) || jsval.StrictEquals(m.Val("StatusCode"), 0.0) ||
		jsval.StrictEquals(m.Val("msg"), "success"))
	if !ok {
		if w := jsval.Or(m.Val("msg"), m.Val("StatusMessage")); m != nil && jsval.Truthy(w) {
			warn = jsval.ToString(w)
		} else {
			warn = "HTTP " + strconv.Itoa(res.StatusCode)
		}
	}
	return ok, warn, nil
}

// assignPayload: Object.assign(dst, src) với src là payload JSON của client. Khoá riêng "__proto__" của src đi qua
// setter của Object.prototype: giá trị là object thì thành prototype của dst (các khoá dst chưa có được đọc xuyên qua nó),
// giá trị khác (mảng, null, chuỗi, số) không tạo ra khoá nghiệp vụ nào. "__proto__" lồng trong prototype chỉ là khoá thường.
func assignPayload(dst, src *omap.Map) *omap.Map {
	var proto *omap.Map
	src.Each(func(k string, v any) {
		if k == "__proto__" {
			proto = jsval.AsMap(v)
			return
		}
		dst.Set(k, v)
	})
	proto.Each(func(k string, v any) {
		if k != "__proto__" && !dst.Has(k) {
			dst.Set(k, v)
		}
	})
	return dst
}

// SendDeXuat: lưu đề xuất (KHÔNG tạo đơn mua hàng), báo Admin, rồi bắn thẻ Lark (I:277-294).
// Lỗi thông báo và lỗi webhook chỉ ghi log; đã lưu được thì luôn trả {ok: true, ...}.
func (s *Service) SendDeXuat(ctx context.Context, a *actor.Actor, dxV any) (*omap.Map, error) {
	dx := objOr(dxV)
	// payload của client đè được requesterId (Object.assign)
	saved, err := s.SaveDeXuat(ctx, assignPayload(omap.Of("requesterId", uidOf(a)), dx))
	if err != nil {
		return nil, err
	}
	if err := s.pn.NotifyDeXuatAdmins(ctx, a, omap.Of("ma", saved.Val("ma"), "loai", saved.Val("loai"),
		"supplier", dx.Val("supplier"))); err != nil {
		logger.Error("đề xuất", "notify lỗi:", err.Error())
	}
	larkOk := false
	card, err := buildDeXuatCard(dx, saved.Val("ma"), s.now())
	if err == nil {
		var warn string
		larkOk, warn, err = s.postCard(ctx, card)
		if err == nil && !larkOk {
			logger.Error("đề xuất", "webhook Lark trả lỗi:", warn)
		}
	}
	if err != nil {
		logger.Error("đề xuất", "webhook lỗi:", err.Error())
	}
	return omap.Of("ok", true, "ma", saved.Val("ma"), "loai", saved.Val("loai"), "total", saved.Val("total"), "lark", larkOk), nil
}

// SendPurchaseRequest: lưu đơn + báo Admin duyệt (luôn chạy), rồi gửi thẻ Lark kiểu được thì tốt (I:295-319).
func (s *Service) SendPurchaseRequest(ctx context.Context, a *actor.Actor, orderV any) (*omap.Map, error) {
	order := objOr(orderV)
	// payload của client đè được kenh / ketQua / requesterId (Object.assign)
	rs, err := s.SavePurchaseOrder(ctx, assignPayload(omap.Of("kenh", "Lark", "ketQua", "pending", "requesterId", uidOf(a)), order))
	if err != nil {
		return nil, err
	}
	savedMa := arrOf(rs.Val("saved"))
	if savedMa == nil {
		savedMa = []any{}
	}
	if len(savedMa) > 0 {
		ords := arrOf(order.Val("orders"))
		list := make([]any, len(savedMa))
		for i, ma := range savedMa {
			var od any = jsval.Undefined
			if i < len(ords) {
				od = ords[i]
			}
			list[i] = omap.Of("maDon", ma, "supplier", jsval.And(od, jsval.Get(od, "supplier")))
		}
		if err := s.pn.NotifyPurchaseAdmins(ctx, a, list); err != nil {
			logger.Error("mua hàng", "notify lỗi:", err.Error())
		}
	}
	larkOk := false
	card, err := buildPurchaseCard(order, s.now())
	if err == nil {
		var warn string
		larkOk, warn, err = s.postCard(ctx, card)
		if err == nil && !larkOk {
			logger.Error("mua hàng", "webhook Lark trả lỗi:", warn)
		}
	}
	if err != nil {
		logger.Error("mua hàng", "webhook Lark lỗi:", err.Error())
	}
	s.ghiKetQuaGui(ctx, savedMa, larkOk)
	return omap.Of("ok", true, "saved", savedMa, "lark", larkOk), nil
}

// ghiKetQuaGui (M9.1): lệnh RIÊNG sau khi gửi thẻ Lark, ghi ket_qua_gui "ok" / "loi" cho các đơn vừa lưu (đè giá trị lúc lưu:
// "pending" mặc định hoặc ketQua client gửi). Lỗi chỉ ghi log - đơn đã lưu, không báo hỏng.
func (s *Service) ghiKetQuaGui(ctx context.Context, savedMa []any, larkOk bool) {
	kq := kqGuiLoi
	if larkOk {
		kq = kqGuiOk
	}
	for _, ma := range savedMa {
		if err := s.repo.PatchOrder(ctx, ma, omap.Of("ket_qua_gui", kq)); err != nil {
			logger.Error("mua hàng", "ghi kết quả gửi Lark lỗi:", err.Error())
			return
		}
	}
}
