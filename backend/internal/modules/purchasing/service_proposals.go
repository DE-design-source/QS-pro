package purchasing

import (
	"context"
	"math"
	"regexp"
	"strings"

	"qspro-backend/internal/shared/actor"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
	"qspro-backend/internal/shared/qscore"
)

var reThieuBang = regexp.MustCompile(`(?i)(does not exist|not find the table|42P01|PGRST205|404)`)

// dxThieuBang: lỗi "chưa có bảng de_xuat" (dxThieuBang_, S:1212-1215) - so trên CHUỖI lỗi của tầng dữ liệu.
func dxThieuBang(err error) bool {
	m := err.Error()
	return strings.Contains(m, "de_xuat") && reThieuBang.MatchString(m)
}

// dxBang: bảng dòng chi tiết theo loại (dxBang_, S:1217).
func dxBang(loai any) string {
	if jsval.StrictEquals(loai, "tt") {
		return tblDxTT
	}
	return tblDxCK
}

// genMaDeXuat: mã phiếu đề xuất (genMaDeXuat_, S:1218-1220).
func (s *Service) genMaDeXuat(loai string) string {
	if loai == "tt" {
		return "TT-" + s.maSuffix()
	}
	return "CK-" + s.maSuffix()
}

// SaveDeXuat: lưu phiếu đề xuất và các dòng của nó (S:1223-1270). Trả {ma, loai, total}.
func (s *Service) SaveDeXuat(ctx context.Context, dxV any) (*omap.Map, error) {
	dx := objOr(dxV)
	loai := "ck"
	if jsval.StrictEquals(dx.Val("loai"), "tt") {
		loai = "tt"
	}
	ma := s.genMaDeXuat(loai)
	items, dots := arrOf(dx.Val("items")), arrOf(dx.Val("dots"))
	vatPct := qscore.N(dx.Val("vatPct"))
	var tongGoc, tongDx, soDong float64
	if loai == "ck" {
		for _, it := range items {
			if err := typeErr(it, "sl"); err != nil {
				return nil, err
			}
			sl := qscore.N(jsval.Get(it, "sl"))
			tongGoc += sl * qscore.N(jsval.Get(it, "donGiaGoc"))
			tongDx += sl * qscore.N(jsval.Get(it, "donGia"))
		}
		soDong = float64(len(items))
	} else {
		for _, d := range dots {
			if err := typeErr(d, "tien"); err != nil {
				return nil, err
			}
			tongDx += qscore.N(jsval.Get(d, "tien"))
		}
		tongGoc = qscore.N(dx.Val("tongDon"))
		if tongGoc == 0 {
			tongGoc = tongDx
		}
		soDong = float64(len(dots))
	}
	vat := 0.0
	if loai == "ck" {
		vat = qscore.Round0(tongDx * vatPct / 100)
	}
	// D-13: phiếu + các dòng của nó trong 1 transaction. Dòng hỏng -> rollback cả phiếu (thay cho bước bù trừ
	// "xoá phiếu, nuốt lỗi xoá" của Node: S:1262-1266). loiPhieu giữ lỗi của lệnh chèn phiếu để chỉ lỗi ĐÓ được đổi
	// thành thông báo thiếu bảng như trước (Tx trả nguyên lỗi, không bọc).
	var loiPhieu error
	err := s.tx(ctx, func(ctx context.Context) error {
		if err := s.repo.InsertProposal(ctx, omap.Of(
			"ma_de_xuat", ma, "loai", loai, "ma_du_an", jsval.S(dx.Val("maDA")), "ten_du_an", jsval.S(dx.Val("project")),
			"hang_muc", jsval.S(dx.Val("hangMuc")), "nha_cung_cap", jsval.S(dx.Val("supplier")), "so_dong", soDong,
			"tong_goc", qscore.Round0(tongGoc), "tong_de_xuat", qscore.Round0(tongDx),
			"tien_giam", qscore.Round0(math.Max(0, tongGoc-tongDx)),
			"vat_pct", vatPct, "vat", vat, "tong_cong", qscore.Round0(tongDx+vat),
			"trang_thai", ttChoDuyet, "nguoi_gui", jsval.S(dx.Val("nguoiGui")), "phong_ban", jsval.S(dx.Val("phongBan")),
			"ghi_chu", jsval.S(dx.Val("ghiChu")), "requester_id", jsval.Or(dx.Val("requesterId"), nil),
		)); err != nil {
			loiPhieu = err
			return err
		}
		if loai == "ck" && len(items) > 0 {
			rows := make([]*omap.Map, len(items))
			for i, it := range items {
				sl, dg := qscore.N(jsval.Get(it, "sl")), qscore.N(jsval.Get(it, "donGia"))
				rows[i] = omap.Of("ma_de_xuat", ma, "sort_no", float64(i), "ma_sp", jsval.S(jsval.Get(it, "ma")),
					"ten_sp", jsval.S(jsval.Get(it, "ten")), "thuong_hieu", jsval.S(jsval.Get(it, "thuongHieu")),
					"phong", jsval.S(jsval.Get(it, "khuVuc")), "dvt", strOr(jsval.Get(it, "dvt"), "Cái"), "so_luong", sl,
					"don_gia_goc", qscore.N(jsval.Get(it, "donGiaGoc")), "ty_le_pct", qscore.N(jsval.Get(it, "giamGiaPct")),
					"don_gia", dg, "thanh_tien", qscore.Round0(sl*dg), "hinh_anh", jsval.S(jsval.Get(it, "hinhAnh")))
			}
			if err := s.repo.InsertProposalItems(ctx, dxBang("ck"), rows); err != nil {
				return err
			}
		}
		if loai == "tt" && len(dots) > 0 {
			rows := make([]*omap.Map, len(dots))
			for i, d := range dots {
				dot := qscore.N(jsval.Get(d, "dot"))
				if dot == 0 {
					dot = float64(i + 1)
				}
				rows[i] = omap.Of("ma_de_xuat", ma, "sort_no", float64(i), "ten_sp", "Đợt "+jsval.NumberToString(dot),
					"ty_le_pct", qscore.N(jsval.Get(d, "pct")), "thanh_tien", qscore.Round0(qscore.N(jsval.Get(d, "tien"))),
					"ngay_du_kien", jsval.Or(jsval.Get(d, "ngay"), nil), "ghi_chu", jsval.S(jsval.Get(d, "gc")))
			}
			if err := s.repo.InsertProposalItems(ctx, dxBang("tt"), rows); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		if loiPhieu != nil && dxThieuBang(loiPhieu) {
			return nil, apperr.New(errThieuBangDX + apperr.HDMig)
		}
		return nil, err
	}
	return omap.Of("ma", ma, "loai", loai, "total", qscore.Round0(tongDx+vat)), nil
}

// dxHead: dòng de_xuat -> object cho client (dxHead_, S:1271-1278).
func dxHead(h *omap.Map) *omap.Map {
	st, n := jsval.S, qscore.N
	return omap.Of("ma", st(h.Val("ma_de_xuat")), "loai", strOr(h.Val("loai"), "ck"), "maDA", st(h.Val("ma_du_an")),
		"project", st(h.Val("ten_du_an")), "hangMuc", st(h.Val("hang_muc")), "supplier", st(h.Val("nha_cung_cap")),
		"soDong", n(h.Val("so_dong")), "tongGoc", n(h.Val("tong_goc")), "tongDeXuat", n(h.Val("tong_de_xuat")),
		"tienGiam", n(h.Val("tien_giam")), "vatPct", n(h.Val("vat_pct")), "vat", n(h.Val("vat")), "total", n(h.Val("tong_cong")),
		"status", st(h.Val("trang_thai")), "requester", st(h.Val("nguoi_gui")), "phongBan", st(h.Val("phong_ban")),
		"ghiChu", st(h.Val("ghi_chu")), "nguoiDuyet", st(h.Val("nguoi_duyet")), "ngayDuyet", st(h.Val("ngay_duyet")),
		"at", st(h.Val("ngay_gui")))
}

// dxItem: dòng chi tiết (cả 2 bảng) -> object cho client (dxItem_, S:1279-1283). Cột bảng kia không có -> "" / 0.
func dxItem(r *omap.Map) *omap.Map {
	st, n := jsval.S, qscore.N
	return omap.Of("ma", st(r.Val("ma_sp")), "ten", st(r.Val("ten_sp")), "thuongHieu", st(r.Val("thuong_hieu")),
		"phong", st(r.Val("phong")), "dvt", st(r.Val("dvt")), "sl", n(r.Val("so_luong")), "donGiaGoc", n(r.Val("don_gia_goc")),
		"pct", n(r.Val("ty_le_pct")), "donGia", n(r.Val("don_gia")), "thanhTien", n(r.Val("thanh_tien")),
		"ngay", st(r.Val("ngay_du_kien")), "ghiChu", st(r.Val("ghi_chu")), "hinhAnh", st(r.Val("hinh_anh")))
}

// dxFull: Object.assign(dxHead_(h), {items: dt.map(dxItem_)}).
func (s *Service) dxFull(ctx context.Context, h *omap.Map, ma any) (*omap.Map, error) {
	dt, err := s.repo.ProposalItems(ctx, dxBang(h.Val("loai")), ma)
	if err != nil {
		return nil, err
	}
	items := make([]any, len(dt))
	for i, r := range dt {
		items[i] = dxItem(r)
	}
	return dxHead(h).Set("items", items), nil
}

// GetDeXuatList: đề xuất của 1 dự án kèm chi tiết (S:1285-1296). Chưa có bảng -> [].
func (s *Service) GetDeXuatList(ctx context.Context, maDA any) ([]any, error) {
	heads, err := s.repo.ProposalsOfProject(ctx, maDA)
	if err != nil {
		if dxThieuBang(err) {
			return []any{}, nil
		}
		return nil, err
	}
	out := []any{}
	for _, h := range heads {
		o, err := s.dxFull(ctx, h, h.Val("ma_de_xuat"))
		if err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, nil
}

// ListDeXuat: mọi đề xuất cho Admin duyệt (A:681-687). Node nuốt MỌI lỗi có chữ "de_xuat" trong thông báo.
func (s *Service) ListDeXuat(ctx context.Context, _ *actor.Actor, loai any) ([]any, error) {
	rows, err := s.repo.ListProposals(ctx, loai)
	if err != nil {
		if strings.Contains(err.Error(), "de_xuat") {
			return []any{}, nil
		}
		return nil, err
	}
	out := make([]any, len(rows))
	for i, r := range rows {
		out[i] = dxHead(r)
	}
	return out, nil
}

// GetDeXuat: 1 phiếu đề xuất kèm các dòng (A:688-693).
func (s *Service) GetDeXuat(ctx context.Context, _ *actor.Actor, ma any) (*omap.Map, error) {
	h, err := s.repo.ProposalByCode(ctx, ma)
	if err != nil {
		return nil, err
	}
	if h == nil {
		return nil, apperr.New(errKhongThayDX)
	}
	return s.dxFull(ctx, h, ma)
}

// GetMyDeXuat: route chỉ bản Go GET /my-proposals/:code (M13.1) - mở chi tiết phiếu từ thông báo de_xuat*.
// Admin / super: như GetDeXuat (mọi phiếu của công ty, getDeXuat giữ quyền Admin như Node). Người khác: chỉ phiếu có
// requester_id là mình; phiếu không có hoặc của người khác đều báo errKhongThayPhieu.
func (s *Service) GetMyDeXuat(ctx context.Context, a *actor.Actor, ma any) (*omap.Map, error) {
	if a.IsAdmin() {
		return s.GetDeXuat(ctx, a, ma)
	}
	h, err := s.repo.ProposalByCode(ctx, ma)
	if err != nil {
		return nil, err
	}
	if h == nil || a == nil || !jsval.Truthy(h.Val("requester_id")) || jsval.ToString(h.Val("requester_id")) != jsval.ToString(a.UID) {
		return nil, apperr.New(errKhongThayPhieu)
	}
	return s.dxFull(ctx, h, ma)
}

// ResolveDeXuat: duyệt / từ chối đề xuất, chỉ khi còn "Chờ duyệt" (A:694-709).
func (s *Service) ResolveDeXuat(ctx context.Context, a *actor.Actor, ma, approve any) (*omap.Map, error) {
	r, err := s.repo.ProposalByCode(ctx, ma)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, apperr.New(errKhongThayDX)
	}
	if a == nil {
		return nil, apperr.New("Cannot read properties of null (reading 'uid')")
	}
	me, err := s.users.GetByID(ctx, a.UID)
	if err != nil {
		return nil, err
	}
	var resolver any = a.U
	if me != nil {
		resolver = jsval.Or(me.Val("ho_ten"), me.Val("username"))
	}
	ok := jsval.Truthy(approve)
	status, kind, title, action := ttTuChoi, "de_xuat_rejected", "Đề xuất bị từ chối", "reject_de_xuat"
	if ok {
		status, kind, title, action = ttDaDuyet, "de_xuat_approved", "Đề xuất đã được duyệt", "approve_de_xuat"
	}
	n, err := s.repo.ResolveProposal(ctx, ma, omap.Of("trang_thai", status, "nguoi_duyet", resolver,
		"ngay_duyet", jsval.ToISOString(s.now())))
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, apperr.New(errDXDaXuLy)
	}
	ten := s.pn.DeXuatTen(jsval.ToString(r.Val("loai")))
	maS := jsval.ToString(ma)
	if jsval.Truthy(r.Val("requester_id")) {
		s.notify.Notify(ctx, r.Val("requester_id"), kind, title, "Phiếu "+maS+ngoac(r.Val("nha_cung_cap")), maS)
	}
	s.auditor.Audit(ctx, a, action, status+" "+ten+" "+maS+" của "+jsval.ToString(jsval.Or(r.Val("nguoi_gui"), "")), nil)
	return omap.Of("ok", true), nil
}
