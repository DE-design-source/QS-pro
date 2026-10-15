// Package reports: báo cáo SẢN PHẨM NHẬP MỚI gửi vào group Lark - bản chuyển của server/index.js dòng 322-564.
// Lịch gửi tự động (thứ 4 và thứ 7, 8h00 giờ VN) nằm ở internal/jobs; gói này chỉ dựng và gửi báo cáo.
package reports

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode"

	"qspro-backend/internal/config"
	"qspro-backend/internal/modules/categories"
	"qspro-backend/internal/platform/database"
	"qspro-backend/internal/platform/logger"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/contracts"
	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

const logTag = "báo cáo nhập SP"

// Deps: module chỉ cần database và cấu hình (webhook lấy từ Cfg.ReportWebhook = REPORT_WEBHOOK || PURCHASE_WEBHOOK).
type Deps struct {
	DB  *database.DB
	Cfg *config.Config
}

// Service: nghiệp vụ báo cáo.
type Service struct {
	repo    Repository
	webhook string
	httpc   *http.Client
	bodyGap time.Duration    // hạn chờ giữa hai lần nhận dữ liệu của thân trả lời; 0 = không giới hạn
	now     func() time.Time // thay được trong test
	loc     *time.Location   // múi giờ của tiến trình, chỉ dùng khi đọc opts.tuVN không ghi múi giờ
}

var _ contracts.ReportRunner = (*Service)(nil)

// New tạo service.
func New(d Deps) *Service {
	s := &Service{
		repo:    &pgRepo{db: d.DB},
		httpc:   newHTTPClient(),
		bodyGap: undiciTimeout,
		now:     time.Now,
		loc:     time.Local,
	}
	if d.Cfg != nil {
		s.webhook = d.Cfg.ReportWebhook
	}
	return s
}

// undiciTimeout: fetch của Node (undici) không có hạn chờ cho cả lượt gọi; nó ngắt khi 300 giây chưa nhận xong header,
// và khi thân trả lời đứng im 300 giây (hai hạn tính RIÊNG).
const undiciTimeout = 300 * time.Second

// newHTTPClient: client giống fetch của Node 22 ở các điểm ảnh hưởng tới kết quả gửi: không đi qua proxy của
// HTTP_PROXY / HTTPS_PROXY, nối máy tối đa 10 giây, chờ header 300 giây, chỉ HTTP/1.1, theo tối đa 20 lần chuyển hướng.
func newHTTPClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			Proxy:                 nil,
			DialContext:           (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: undiciTimeout,
			MaxIdleConns:          10,
			IdleConnTimeout:       4 * time.Second,
		},
		CheckRedirect: func(_ *http.Request, via []*http.Request) error {
			if len(via) > 20 {
				return errors.New("redirect count exceeded")
			}
			return nil
		},
	}
}

// docThan đọc hết thân trả lời; đứng im quá gap thì huỷ request (bodyTimeout của undici).
func docThan(body io.Reader, gap time.Duration, cancel context.CancelFunc) ([]byte, error) {
	if gap <= 0 {
		return io.ReadAll(body)
	}
	timer := time.AfterFunc(gap, cancel)
	defer timer.Stop()
	var out []byte
	buf := make([]byte, 32*1024)
	for {
		n, err := body.Read(buf)
		out = append(out, buf[:n]...)
		if err == io.EOF {
			return out, nil
		}
		if err != nil {
			return nil, err
		}
		timer.Reset(gap)
	}
}

// protoMuc: MUC_NGANH[ng] khi ng trùng tên một thuộc tính có sẵn của Object.prototype (I:347). Giá trị lấy được là
// một hàm (hoặc chính Object.prototype) - truthy nên không rơi về "Thiết bị đèn"; khi làm khoá của bagNg nó thành chuỗi.
func protoMuc(ng string) (string, bool) {
	switch {
	case !protoKeys[ng]:
		return "", false
	case ng == "__proto__":
		return "[object Object]", true
	case ng == "constructor":
		return "function Object() { [native code] }", true
	}
	return "function " + ng + "() { [native code] }", true
}

// jsLower = String.prototype.toLowerCase(). Khác strings.ToLower ở hai quy tắc đặc biệt của Unicode:
// "İ" (U+0130) thành "i" + dấu chấm kết hợp, và "Σ" cuối từ thành "ς".
func jsLower(s string) string {
	rs := []rune(s)
	var b strings.Builder
	for i, r := range rs {
		switch r {
		case 0x130:
			b.WriteRune('i')
			b.WriteRune(0x307)
		case 0x3A3:
			if sigmaCuoi(rs, i) {
				b.WriteRune(0x3C2)
			} else {
				b.WriteRune(0x3C3)
			}
		default:
			b.WriteRune(unicode.ToLower(r))
		}
	}
	return b.String()
}

func boQua(r rune) bool { // Case_Ignorable
	switch r {
	case 0x27, 0x2E, 0x3A, 0xB7, 0x387, 0x55F, 0x5F4, 0x2018, 0x2019, 0x2024, 0x2027, 0xFE13, 0xFE52, 0xFE55, 0xFF07, 0xFF0E, 0xFF1A:
		return true
	}
	return unicode.In(r, unicode.Mn, unicode.Me, unicode.Cf, unicode.Lm, unicode.Sk)
}

func coHoaThuong(r rune) bool { // Cased
	return unicode.IsUpper(r) || unicode.IsLower(r) || unicode.IsTitle(r) || unicode.Is(unicode.Other_Lowercase, r) || unicode.Is(unicode.Other_Uppercase, r)
}

// sigmaCuoi: điều kiện Final_Sigma - trước nó có chữ cái, sau nó không còn chữ cái (bỏ qua dấu và ký tự chen giữa).
func sigmaCuoi(rs []rune, i int) bool {
	j := i - 1
	for j >= 0 && boQua(rs[j]) {
		j--
	}
	if j < 0 || !coHoaThuong(rs[j]) {
		return false
	}
	j = i + 1
	for j < len(rs) && boQua(rs[j]) {
		j++
	}
	return j >= len(rs) || !coHoaThuong(rs[j])
}

// s_ của index.js: String(v == null ? "" : v).trim().
func str(v any) string { return jsval.Trim(jsval.Str(v)) }

// tenNganh = tenNganh_(r): tên ngành hàng của 1 sản phẩm.
func tenNganh(r *omap.Map) string {
	ng := categories.NganhCua(r.Val("nganh"), r.Val("hang_muc"))
	if s, ok := protoMuc(ng); ok {
		return s
	}
	return categories.Muc(ng)
}

// setAdd = obj[k] = 1 trên object thường của JS: gán "__proto__" bằng một số không tạo khoá.
func setAdd(m *omap.Map, k string) {
	if k != "__proto__" {
		m.Set(k, 1.0)
	}
}

type ngayAgg struct {
	soSP float64
	ncc  *omap.Map
}

type nguoiAgg struct {
	ngay *omap.Map // dd/mm -> *ngayAgg
	ncc  *omap.Map
}

// BaoCaoNhapSP = baoCaoNhapSP(actor, opts) (I:451-552): gom sản phẩm mới trong kỳ, TÁCH THEO CÔNG TY,
// mỗi công ty một thẻ Lark. a không được dùng (như bên Node); opts nil coi như {}.
func (s *Service) BaoCaoNhapSP(ctx context.Context, a *actor.Actor, opts *omap.Map) (*omap.Map, error) {
	vn := s.nowVN()
	// opts.tuVN cho phép chạy tay 1 kỳ tuỳ ý (qua API thì tới dưới dạng chuỗi ISO)
	var tuVN float64
	if v := opts.Val("tuVN"); jsval.Truthy(v) {
		tuVN = newDate(v, s.loc)
	} else {
		tuVN = moBaoCaoTruoc(vn)
	}
	if tuVN != tuVN {
		return omap.Of("sent", false, "count", 0.0, "message", "Mốc thời gian không hợp lệ"), nil
	}
	tuIso, ok := isoString(tuVN - vnOffsetMs)
	if !ok {
		return nil, apperr.New("Invalid time value") // RangeError của toISOString khi mốc nằm sát đáy khoảng Date
	}
	rows, err := s.repo.NewProducts(ctx, tuIso)
	if err != nil {
		return omap.Of("sent", false, "count", 0.0, "message", "Không đọc được danh sách sản phẩm: "+err.Error()), nil
	}
	if len(rows) == 0 {
		return omap.Of("sent", false, "count", 0.0, "message", "Kỳ này chưa có sản phẩm mới"), nil
	}

	// Chỉ tính SP CÓ ghi nhận người nhập - đó mới là thứ báo cáo này nói tới.
	var khuyetAll, coNguoi []*omap.Map
	for _, r := range rows {
		if str(r.Val("nguoi_tao")) == "" {
			khuyetAll = append(khuyetAll, r)
		} else {
			coNguoi = append(coNguoi, r)
		}
	}
	rows = coNguoi
	if len(rows) == 0 {
		return omap.Of("sent", false, "count", 0.0, "khuyet", float64(len(khuyetAll)),
			"message", "Kỳ này chưa có sản phẩm mới có ghi nhận người nhập"), nil
	}

	users, err := s.repo.Users(ctx)
	if err != nil { // Node nuốt lỗi: thiếu thông tin tài khoản thì hiện tên đăng nhập
		users = nil
	}
	uInfo := map[string]userInfo{}
	for _, u := range users {
		uInfo[jsLower(str(u.Val("username")))] = userInfo{
			ten: jsval.Or(u.Val("ho_ten"), u.Val("username")), pb: jsval.Or(u.Val("phong_ban"), ""),
		}
	}
	cty, err := s.repo.Companies(ctx)
	if err != nil { // Node nuốt lỗi: thẻ ghi "Công ty khác"
		cty = nil
	}
	tenCty := map[string]any{}
	for _, c := range cty {
		tenCty[jsval.ToString(c.Val("id"))] = jsval.Or(c.Val("ten"), c.Val("ma"))
	}
	ngayVN := func(iso any) string {
		d := newDate(iso, s.loc)
		if d != d {
			return ddmm(d)
		}
		return ddmm(timeClip(d + vnOffsetMs))
	}
	ctKeyOf := func(r *omap.Map) string { return jsval.ToString(jsval.Or(r.Val("cong_ty_id"), "")) }

	// tách theo công ty (omap giữ thứ tự khoá như object của JS)
	theoCT := omap.New()
	for _, r := range rows {
		k := ctKeyOf(r)
		ds, _ := theoCT.Val(k).([]*omap.Map)
		theoCT.Set(k, append(ds, r))
	}
	ketQua := make([]theCongTy, 0, theoCT.Len())
	for _, ctKey := range theoCT.Keys() {
		ds, _ := theoCT.Val(ctKey).([]*omap.Map)
		var ten any = "Chưa gắn công ty"
		if ctKey != "" {
			ten = jsval.Or(tenCty[ctKey], "Công ty khác")
		}
		bag, nccAll, bagNg := omap.New(), omap.New(), omap.New()
		for _, r := range ds {
			key, ncc, ngay := str(r.Val("nguoi_tao")), str(r.Val("nha_cung_cap")), ngayVN(r.Val("ngay_tao"))
			if ncc != "" {
				setAdd(nccAll, ncc)
			}
			if protoKeys[key] {
				// bag[key] của Node lúc này là thuộc tính có sẵn của Object.prototype nên bag[key].ngay là undefined
				return nil, apperr.New("Cannot read properties of undefined (reading '" + ngay + "')")
			}
			b, _ := bag.Val(key).(*nguoiAgg)
			if b == nil {
				b = &nguoiAgg{ngay: omap.New(), ncc: omap.New()}
				bag.Set(key, b)
			}
			d, _ := b.ngay.Val(ngay).(*ngayAgg)
			if d == nil {
				d = &ngayAgg{ncc: omap.New()}
				b.ngay.Set(ngay, d)
			}
			d.soSP++
			if ncc != "" {
				setAdd(d.ncc, ncc)
				setAdd(b.ncc, ncc)
			}
			// theo NGÀNH HÀNG: đèn / vệ sinh / sơn nước / công tắc - ổ cắm
			ngTen := tenNganh(r)
			g, _ := bagNg.Val(ngTen).(*ngayAgg)
			if g == nil {
				g = &ngayAgg{ncc: omap.New()}
				bagNg.Set(ngTen, g)
			}
			g.soSP++
			if ncc != "" {
				setAdd(g.ncc, ncc)
			}
		}
		theoNganh := make([]nganhRow, 0, bagNg.Len())
		for _, k := range bagNg.Keys() {
			g := bagNg.Val(k).(*ngayAgg)
			theoNganh = append(theoNganh, nganhRow{ten: k, soSP: g.soSP, soNCC: float64(g.ncc.Len())})
		}
		sort.SliceStable(theoNganh, func(i, j int) bool { return theoNganh[i].soSP > theoNganh[j].soSP })
		bang := make([]bangRow, 0, bag.Len())
		for _, k := range bag.Keys() {
			b := bag.Val(k).(*nguoiAgg)
			info := uInfo[jsLower(k)]
			ngay := make([]ngayRow, 0, b.ngay.Len())
			tong := 0.0
			for _, d := range b.ngay.Keys() {
				x := b.ngay.Val(d).(*ngayAgg)
				ngay = append(ngay, ngayRow{ngay: d, soSP: x.soSP, soNCC: float64(x.ncc.Len())})
			}
			// x.ngay < y.ngay ? 1 : -1 trên chuỗi dd/mm (khoá không trùng nhau) = xếp giảm dần theo chuỗi
			sort.SliceStable(ngay, func(i, j int) bool { return ngay[i].ngay > ngay[j].ngay })
			for _, x := range ngay {
				tong += x.soSP
			}
			bang = append(bang, bangRow{ten: jsval.Or(info.ten, k), phongBan: jsval.Or(info.pb, ""),
				tongSP: tong, tongNCC: float64(b.ncc.Len()), ngay: ngay})
		}
		sort.SliceStable(bang, func(i, j int) bool { return bang[i].tongSP > bang[j].tongSP })
		tk := thongKe{tongSP: float64(len(ds)), tongNCC: float64(nccAll.Len()), tongNguoi: float64(len(bang)), chuaGanCT: ctKey == ""}
		// SP cũ không rõ người nhập: chỉ cảnh báo trên thẻ của đúng công ty đó
		khuyet := 0.0
		for _, r := range khuyetAll {
			if ctKeyOf(r) == ctKey {
				khuyet++
			}
		}
		ketQua = append(ketQua, theCongTy{congTy: ten, ctKey: ctKey, bang: bang, tk: tk, khuyet: khuyet, nganh: theoNganh})
	}
	sort.SliceStable(ketQua, func(i, j int) bool { return ketQua[i].tk.tongSP > ketQua[j].tk.tongSP })

	if jsval.Truthy(opts.Val("dryRun")) {
		the := make([]any, len(ketQua))
		for i, q := range ketQua {
			the[i] = q.toMap()
		}
		return omap.Of("sent", false, "count", float64(len(rows)), "soThe", float64(len(ketQua)),
			"khuyet", float64(len(khuyetAll)), "tu", tuIso, "the", the), nil
	}

	daGui := make([]any, 0, len(ketQua))
	anyOk := false
	for _, q := range ketQua {
		sent := s.guiThe(ctx, q, tuVN, vn)
		anyOk = anyOk || sent
		daGui = append(daGui, omap.Of("congTy", q.congTy, "soSP", q.tk.tongSP, "sent", sent))
	}
	if anyOk {
		detail := "Báo cáo Lark: " + jsval.NumberToString(float64(len(rows))) + " sản phẩm nhập mới / " +
			jsval.NumberToString(float64(len(ketQua))) + " công ty, kỳ " + ddmm(tuVN) + " → " + ddmm(vn)
		if err := s.repo.InsertAudit(ctx, detail); err != nil {
			logger.Error(logTag, "không ghi được audit:", err.Error())
		}
	}
	return omap.Of("sent", anyOk, "count", float64(len(rows)), "khuyet", float64(len(khuyetAll)), "the", daGui), nil
}

// toMap: phần tử của "the" trong kết quả dryRun (I:524).
func (q theCongTy) toMap() *omap.Map {
	bang := make([]any, len(q.bang))
	for i, b := range q.bang {
		ngay := make([]any, len(b.ngay))
		for j, d := range b.ngay {
			ngay[j] = omap.Of("ngay", d.ngay, "soSP", d.soSP, "soNCC", d.soNCC)
		}
		bang[i] = omap.Of("ten", b.ten, "phongBan", b.phongBan, "tongSP", b.tongSP, "tongNCC", b.tongNCC, "ngay", ngay)
	}
	nganh := make([]any, len(q.nganh))
	for i, n := range q.nganh {
		nganh[i] = omap.Of("ten", n.ten, "soSP", n.soSP, "soNCC", n.soNCC)
	}
	return omap.Of("congTy", q.congTy, "ctKey", q.ctKey, "bang", bang,
		"tk", omap.Of("tongSP", q.tk.tongSP, "tongNCC", q.tk.tongNCC, "tongNguoi", q.tk.tongNguoi, "chuaGanCT", q.tk.chuaGanCT),
		"khuyet", q.khuyet, "nganh", nganh)
}

// guiThe: gửi thẻ của một công ty tới webhook Lark (I:532-541). Mọi lỗi chỉ ghi log, trả false.
func (s *Service) guiThe(ctx context.Context, q theCongTy, tuVN, vn float64) bool {
	prefix := "webhook Lark lỗi (" + jsval.ToString(q.congTy) + "):"
	body, err := omap.Marshal(buildSpReportCard(q.congTy, q.bang, q.tk, tuVN, vn, q.khuyet, q.nganh))
	if err != nil {
		logger.Error(logTag, prefix, err.Error())
		return false
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.webhook, bytes.NewReader(body))
	if err != nil {
		logger.Error(logTag, prefix, err.Error())
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := s.httpc.Do(req)
	if err != nil {
		logger.Error(logTag, prefix, err.Error())
		return false
	}
	defer res.Body.Close()
	var d any // thân không phải JSON -> null
	if raw, err := docThan(res.Body, s.bodyGap, cancel); err == nil {
		// r.json() bỏ dấu BOM đầu thân trước khi đọc JSON
		if v, err := omap.Decode(bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})); err == nil {
			d = v
		}
	}
	ok := jsval.Truthy(d) && (jsval.StrictEquals(jsval.Get(d, "code"), 0.0) ||
		jsval.StrictEquals(jsval.Get(d, "StatusCode"), 0.0) || jsval.StrictEquals(jsval.Get(d, "msg"), "success"))
	if !ok {
		var msg any
		if jsval.Truthy(d) {
			msg = jsval.Or(jsval.Get(d, "msg"), jsval.Get(d, "StatusMessage"))
		}
		logger.Error(logTag, prefix, jsval.ToString(jsval.Or(msg, "HTTP "+jsval.NumberToString(float64(res.StatusCode)))))
	}
	return ok
}

// DaGuiHomNay = daGuiBaoCaoHomNay_() (I:554-564): hôm nay (giờ VN) đã gửi báo cáo chưa. Mọi lỗi -> false.
func (s *Service) DaGuiHomNay(ctx context.Context) bool {
	homNay, _ := isoString(s.nowVN())
	homNay = homNay[:10]
	rows, err := s.repo.RecentAudits(ctx)
	if err != nil {
		return false
	}
	for _, r := range rows {
		iso, ok := isoString(newDate(r.Val("created_at"), s.loc) + vnOffsetMs)
		if !ok {
			return false // toISOString ném RangeError, bị try/catch bên Node nuốt
		}
		if iso[:10] == homNay {
			return true
		}
	}
	return false
}
