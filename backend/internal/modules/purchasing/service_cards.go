package purchasing

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

/* Thẻ Lark (I:140-275). JSON phải giống Node từng byte: thứ tự khoá theo object literal, dấu cách U+3000 ("　"),
   "×", "−" (U+2212), "→", gạch dài trong tiêu đề phụ - đều là NỘI DUNG của thẻ, không được thay. */

const sp = "　" // U+3000

// fmtVN = (Math.round(Number(n) || 0)).toLocaleString('vi-VN') (I:140).
func fmtVN(v any) string { return jsval.FormatVN(jsval.Round(jsval.Num0(v))) }

// cat: phép nối chuỗi của JS với một giá trị bất kỳ.
func cat(v any) string { return jsval.ToString(v) }

// orStr: (v || def) nối vào chuỗi.
func orStr(v any, def string) string { return cat(jsval.Or(v, def)) }

func md(content, align string) *omap.Map {
	e := omap.Of("tag", "markdown", "content", content)
	if align != "" {
		e.Set("text_align", align)
	}
	return e
}

func colv(content string, weight float64, align string) *omap.Map {
	return omap.Of("tag", "column", "width", "weighted", "weight", weight, "vertical_align", "center",
		"elements", []any{md(content, align)})
}

func rowset(cols ...any) *omap.Map {
	return omap.Of("tag", "column_set", "flex_mode", "none", "horizontal_spacing", "small", "columns", cols)
}

func info(label string, val any) *omap.Map {
	return omap.Of("is_short", true, "text", omap.Of("tag", "lark_md",
		"content", "<font color='grey'>"+label+"</font>\n**"+orStr(val, "—")+"**"))
}

var hr = func() *omap.Map { return omap.Of("tag", "hr") }

// stamp: dd/mm/yyyy theo múi giờ CỦA TIẾN TRÌNH (getDate / getMonth / getFullYear), không phải giờ VN.
func stamp(now time.Time) string {
	return fmt.Sprintf("%02d/%02d/%d", now.Day(), int(now.Month()), now.Year())
}

func noteEl(now time.Time) *omap.Map {
	return omap.Of("tag", "note", "elements", []any{omap.Of("tag", "plain_text",
		"content", "⚡ Gửi tự động từ Dezon QS Pro · "+stamp(now))})
}

func cardOf(template, title string, o *omap.Map, els []any) *omap.Map {
	sub := orStr(o.Val("project"), "")
	if jsval.Truthy(o.Val("nguoiGui")) {
		sub += " — " + cat(o.Val("nguoiGui"))
	}
	return omap.Of("msg_type", "interactive", "card", omap.Of(
		"config", omap.Of("wide_screen_mode", true),
		"header", omap.Of("template", template,
			"title", omap.Of("tag", "plain_text", "content", title),
			"subtitle", omap.Of("tag", "plain_text", "content", sub)),
		"elements", els))
}

// buildPurchaseCard: thẻ Lark cho yêu cầu mua hàng (I:141-215). Lỗi trả về là TypeError của Node với dữ liệu hỏng.
func buildPurchaseCard(oV any, now time.Time) (*omap.Map, error) {
	o := objOr(oV)
	orders := arrOf(o.Val("orders"))
	els := []any{}

	// Khối thông tin dự án / người gửi
	fields := []any{info("🏗 Dự án", o.Val("project")), info("🔖 Mã dự án", o.Val("maDA"))}
	if jsval.Truthy(jsval.Or(o.Val("khachHang"), o.Val("sdt"))) {
		fields = append(fields, info("👤 Khách hàng", o.Val("khachHang")), info("📞 Điện thoại", o.Val("sdt")))
	}
	fields = append(fields, info("🙋 Người gửi", o.Val("nguoiGui")), info("🏢 Phòng ban", o.Val("phongBan")))
	els = append(els, omap.Of("tag", "div", "fields", fields))
	if jsval.Truthy(o.Val("ghiChu")) {
		els = append(els, omap.Of("tag", "div", "text", omap.Of("tag", "lark_md",
			"content", "<font color='grey'>📝 Ghi chú</font>\n"+cat(o.Val("ghiChu")))))
	}

	var grand float64
	nSup, nItems := 0, 0
	for _, od := range orders {
		if err := typeErr(od, "total"); err != nil {
			return nil, err
		}
		g := func(k string) any { return jsval.Get(od, k) }
		grand += jsval.Num0(g("total"))
		nSup++
		var items []any
		nLen := "0"
		if iv := g("items"); jsval.Truthy(iv) {
			arr, ok := iv.([]any)
			if !ok {
				return nil, apperr.New("items.forEach is not a function")
			}
			items, nLen = arr, strconv.Itoa(len(arr))
		}
		els = append(els, hr())
		els = append(els, md("🏭 <font color='blue'>**"+orStr(g("supplier"), "—")+"**</font>"+sp+"·"+sp+nLen+" sản phẩm", ""))
		var sumGoc float64
		for i, it := range items {
			if err := typeErr(it, "sl"); err != nil {
				return nil, err
			}
			ig := func(k string) any { return jsval.Get(it, k) }
			nItems++
			sl := jsval.Num0(ig("sl"))
			disc := jsval.Num0(ig("giamGiaPct"))
			goc := jsval.Num0(ig("donGiaGoc"))
			if goc == 0 {
				goc = jsval.Num0(ig("donGia"))
			}
			tt := sl * jsval.Num0(ig("donGia"))
			sumGoc += sl * goc
			subs := []string{}
			for _, v := range []any{ig("khuVuc"), ig("thuongHieu")} {
				if jsval.Truthy(v) {
					subs = append(subs, cat(v))
				}
			}
			sub := strings.Join(subs, " · ")
			left := "**" + strconv.Itoa(i+1) + ". " + orStr(ig("ten"), "") + "**"
			left += "\n<font color='grey'>" + cat(sl) + " " + orStr(ig("dvt"), "") + " × " + fmtVN(ig("donGia")) + " đ"
			if sub != "" {
				left += sp + "·" + sp + sub
			}
			left += "</font>"
			if disc > 0 {
				left += "\n<font color='green'>▼ giảm " + cat(disc) + "% (gốc " + fmtVN(goc) + " đ)</font>"
			}
			els = append(els, rowset(colv(left, 3, ""), colv("**"+fmtVN(tt)+" đ**", 1, "right")))
		}
		// Khối tổng của NCC - căn phải
		tamTinh := jsval.ToNumber(g("total")) - jsval.ToNumber(g("vat"))
		tienGiam := math.Max(0, sumGoc-tamTinh)
		els = append(els, hr())
		tot := "<font color='grey'>Tạm tính</font>" + sp + sp + fmtVN(sumGoc) + " đ"
		if tienGiam > 0 {
			tot += "\n<font color='green'>Giảm giá NCC</font>" + sp + sp + "<font color='green'>−" + fmtVN(tienGiam) + " đ</font>"
		}
		if jsval.ToNumber(g("vat")) > 0 {
			tot += "\n<font color='grey'>VAT " + cat(jsval.Or(g("vatPct"), 0.0)) + "%</font>" + sp + sp + fmtVN(g("vat")) + " đ"
		}
		tot += "\n**💰 TỔNG THANH TOÁN**" + sp + sp + "<font color='red'>**" + fmtVN(g("total")) + " đ**</font>"
		els = append(els, md(tot, "right"))
	}

	// Tổng tất cả (nếu nhiều NCC)
	els = append(els, hr())
	if len(orders) > 1 {
		els = append(els, md("💵 <font color='red'>**TỔNG CỘNG: "+fmtVN(grand)+" đ**</font>", "right"))
	}
	els = append(els, md("📦 "+strconv.Itoa(nSup)+" nhà cung cấp"+sp+"·"+sp+strconv.Itoa(nItems)+" sản phẩm"+sp+"·"+sp+
		"⏳ <font color='orange'>**Chờ duyệt**</font>", ""))
	els = append(els, noteEl(now))
	return cardOf("blue", "🛒 YÊU CẦU MUA HÀNG", o, els), nil
}

// buildDeXuatCard: thẻ Lark cho đề xuất chiết khấu / thanh toán (I:217-275).
func buildDeXuatCard(oV any, ma any, now time.Time) (*omap.Map, error) {
	o := objOr(oV)
	els := []any{}
	isCK := !jsval.StrictEquals(o.Val("loai"), "tt")
	head := "🏢 **" + orStr(o.Val("supplier"), "—") + "**" +
		"\n<font color='grey'>Dự án: " + orStr(o.Val("project"), "—") + sp + "·" + sp + orStr(o.Val("hangMuc"), "") + "</font>" +
		"\n<font color='grey'>Phiếu: " + cat(ma) + sp + "·" + sp + "Người gửi: " + orStr(o.Val("nguoiGui"), "—")
	if jsval.Truthy(o.Val("phongBan")) {
		head += sp + "·" + sp + cat(o.Val("phongBan"))
	}
	els = append(els, md(head+"</font>", ""), hr())
	if isCK {
		var goc, sau float64
		for i, it := range arrOf(o.Val("items")) {
			if err := typeErr(it, "sl"); err != nil {
				return nil, err
			}
			ig := func(k string) any { return jsval.Get(it, k) }
			sl, dg, dgGoc := jsval.Num0(ig("sl")), jsval.Num0(ig("donGia")), jsval.Num0(ig("donGiaGoc"))
			goc += sl * dgGoc
			sau += sl * dg
			left := "**" + strconv.Itoa(i+1) + ". " + orStr(ig("ten"), "") + "**"
			left += "\n<font color='grey'>" + cat(sl) + " " + orStr(ig("dvt"), "") + " × " + fmtVN(dgGoc) + " đ</font>"
			if jsval.ToNumber(ig("giamGiaPct")) > 0 {
				left += "\n<font color='orange'>đề xuất giảm " + cat(ig("giamGiaPct")) + "% → " + fmtVN(dg) + " đ</font>"
			}
			els = append(els, rowset(colv(left, 3, ""), colv("**"+fmtVN(sl*dg)+" đ**", 1, "right")))
		}
		els = append(els, hr())
		els = append(els, md("<font color='grey'>Giá hiện tại</font>"+sp+sp+fmtVN(goc)+" đ"+
			"\n<font color='orange'>Nếu chấp nhận đề xuất</font>"+sp+sp+"**"+fmtVN(sau)+" đ**"+
			"\n**💰 TIẾT KIỆM**"+sp+sp+"<font color='green'>**"+fmtVN(math.Max(0, goc-sau))+" đ**</font>", "right"))
	} else {
		var sum float64
		for i, d := range arrOf(o.Val("dots")) {
			if err := typeErr(d, "tien"); err != nil {
				return nil, err
			}
			dg := func(k string) any { return jsval.Get(d, k) }
			sum += jsval.Num0(dg("tien"))
			left := "**Đợt " + cat(jsval.Or(dg("dot"), float64(i+1))) + "**" + sp + "<font color='grey'>" + cat(jsval.Num0(dg("pct"))) + "%"
			if jsval.Truthy(dg("ngay")) {
				left += sp + "·" + sp + cat(dg("ngay"))
			}
			left += "</font>"
			if jsval.Truthy(dg("gc")) {
				left += "\n<font color='grey'>" + cat(dg("gc")) + "</font>"
			}
			els = append(els, rowset(colv(left, 3, ""), colv("**"+fmtVN(dg("tien"))+" đ**", 1, "right")))
		}
		els = append(els, hr())
		els = append(els, md("<font color='grey'>Giá trị đơn hàng</font>"+sp+sp+fmtVN(jsval.Or(o.Val("tongDon"), sum))+" đ"+
			"\n**💳 TỔNG ĐỀ XUẤT**"+sp+sp+"<font color='red'>**"+fmtVN(sum)+" đ**</font>", "right"))
	}
	if jsval.Truthy(o.Val("ghiChu")) {
		els = append(els, md("<font color='grey'>Ghi chú: "+cat(o.Val("ghiChu"))+"</font>", ""))
	}
	els = append(els, md("⏳ <font color='orange'>**Chờ duyệt**</font>", ""), noteEl(now))
	if isCK {
		return cardOf("orange", "💬 ĐỀ XUẤT CHIẾT KHẤU", o, els), nil
	}
	return cardOf("turquoise", "💳 ĐỀ XUẤT THANH TOÁN", o, els), nil
}
