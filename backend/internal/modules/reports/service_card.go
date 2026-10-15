package reports

import (
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// buildSpReportCard (I:367-449): thẻ Lark báo cáo cho MỘT công ty. Thứ tự khoá theo đúng object literal của Node.
func buildSpReportCard(tenCongTy any, bang []bangRow, tk thongKe, tuVN, denVN float64, khuyet float64, nganh []nganhRow) *omap.Map {
	el := []any{}
	num := jsval.NumberToString
	md := func(t any, align string) *omap.Map {
		e := omap.Of("tag", "markdown", "content", t)
		if align != "" {
			e.Set("text_align", align)
		}
		return e
	}
	col := func(t any, w float64, align string) *omap.Map {
		return omap.Of("tag", "column", "width", "weighted", "weight", w, "vertical_align", "center", "elements", []any{md(t, align)})
	}
	rowset := func(bg string, cols ...any) *omap.Map {
		cs := omap.Of("tag", "column_set", "flex_mode", "none", "horizontal_spacing", "small", "columns", cols)
		if bg != "" {
			cs.Set("background_style", bg)
		}
		return cs
	}
	fld := func(label, val string) *omap.Map {
		return omap.Of("is_short", true, "text", omap.Of("tag", "lark_md", "content", "<font color='grey'>"+label+"</font>\n**"+val+"**"))
	}
	ky := ddmm(tuVN) + " → " + ddmm(denVN)

	// Khối số liệu
	el = append(el, omap.Of("tag", "div", "fields", []any{
		fld("Sản phẩm nhập mới", num(tk.tongSP)),
		fld("Nhà cung cấp", num(tk.tongNCC)),
		fld("Người nhập", num(tk.tongNguoi)),
		fld("Kỳ báo cáo", ky),
	}))
	el = append(el, omap.Of("tag", "hr"))
	// Bảng: NGÀNH HÀNG - SP - NCC
	if len(nganh) > 0 {
		el = append(el, rowset("grey", col("**NGÀNH HÀNG**", 6, ""), col("**SP**", 2, "right"), col("**NCC**", 2, "right")))
		for _, n := range nganh {
			el = append(el, rowset("", col(n.ten, 6, ""), col("**"+num(n.soSP)+"**", 2, "right"), col(num(n.soNCC), 2, "right")))
		}
		el = append(el, omap.Of("tag", "hr"))
	}
	// Bảng: người nhập - phòng ban - ngày - SP - NCC
	el = append(el, rowset("grey", col("**NGƯỜI NHẬP**", 5, ""), col("**NGÀY**", 3, "center"), col("**SP**", 2, "right"), col("**NCC**", 2, "right")))
	for _, p := range bang {
		for i, d := range p.ngay {
			dau := ""
			if i == 0 {
				dau = "**" + jsval.ToString(p.ten) + "**\n<font color='grey'>" + jsval.ToString(jsval.Or(p.phongBan, "Chưa có phòng ban")) + "</font>"
			}
			el = append(el, rowset("", col(dau, 5, ""), col(d.ngay, 3, "center"), col("**"+num(d.soSP)+"**", 2, "right"), col(num(d.soNCC), 2, "right")))
		}
	}
	if len(bang) > 1 || len(bang[0].ngay) > 1 {
		el = append(el, rowset("grey", col("**Tổng cộng**", 5, ""), col("", 3, ""), col("**"+num(tk.tongSP)+"**", 2, "right"), col("**"+num(tk.tongNCC)+"**", 2, "right")))
	}
	if khuyet != 0 && khuyet == khuyet {
		el = append(el, omap.Of("tag", "note", "elements", []any{omap.Of("tag", "plain_text",
			"content", "⚠️ "+num(khuyet)+" sản phẩm cũ trong kỳ chưa ghi nhận người nhập — không tính vào báo cáo.")}))
	}
	el = append(el, omap.Of("tag", "note", "elements", []any{omap.Of("tag", "plain_text",
		"content", "Dezon Pro · Báo cáo tự động thứ 4 & thứ 7 lúc 8h00")}))

	template := "blue"
	if tk.chuaGanCT {
		template = "orange"
	}
	return omap.Of(
		"msg_type", "interactive",
		"card", omap.Of(
			"config", omap.Of("wide_screen_mode", true),
			"header", omap.Of(
				"template", template,
				"title", omap.Of("tag", "plain_text", "content", "📦 Sản phẩm nhập mới · "+jsval.ToString(tenCongTy)),
				"subtitle", omap.Of("tag", "plain_text",
					"content", num(tk.tongSP)+" sản phẩm · "+num(tk.tongNCC)+" nhà cung cấp · "+ky),
			),
			"elements", el,
		),
	)
}
