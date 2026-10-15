package quotations

import (
	"math"

	"qspro-backend/internal/shared/jsval"
)

const (
	bangNavy    = "FF12324C"
	bangMaxCols = 60
	bangMaxRows = 20000
)

// buildBang dựng workbook của buildBangXlsx (X:527-565).
func buildBang(b any) (*xBook, error) {
	cols, rows := jsval.AsArray(prop(b, "cols")), jsval.AsArray(prop(b, "rows"))
	cols, rows = cols[:min(len(cols), bangMaxCols)], rows[:min(len(rows), bangMaxRows)]
	wb := &xBook{}
	name := jsval.Slice(reSheetChars.ReplaceAllString(jsval.StrOr(prop(b, "sheet"), "Bang"), " "), 0, 30)
	if name == "" {
		name = "Bang"
	}
	ws, err := wb.addWorksheet(name)
	if err != nil {
		return nil, err
	}
	n := len(cols)
	r := 1
	if ten := prop(b, "ten"); jsval.Truthy(ten) {
		ws.cell(r, 1).set(jsval.ToString(ten))
		ws.cell(r, 1).font(xFont{Bold: true, Size: 14, Color: bangNavy})
		r += 2
	}
	isNum := make([]bool, n)
	for i, c := range cols {
		if jsval.IsNullish(c) {
			return nil, typeErrRead(c, "label")
		}
		isNum[i] = jsval.Truthy(prop(c, "num"))
		cell := ws.cell(r, i+1)
		cell.set(jsval.StrOr(prop(c, "label"), ""))
		cell.font(xFont{Bold: true, Color: mauWhite})
		cell.fill(bangNavy)
		h := "left"
		if isNum[i] {
			h = "right"
		}
		cell.align(xAlign{V: "middle", Wrap: true, H: h})
		switch {
		case i == 0:
			ws.widths[i+1] = 8
		case isNum[i]:
			ws.widths[i+1] = 16
		default:
			ws.widths[i+1] = 34
		}
	}
	ws.row(r).ht = 30
	ws.ySplit = r
	r++
	for _, row := range rows {
		if jsval.Truthy(row) {
			if g := prop(row, "group"); !jsval.IsNullish(g) {
				c := ws.cell(r, 1)
				c.set(jsval.ToString(g))
				c.font(xFont{Bold: true, Color: bangNavy})
				c.fill("FFEEF2F7")
				if n > 1 {
					ws.merge(r, 1, r, n)
				}
				r++
				continue
			}
		}
		var cells []any
		if jsval.Truthy(row) {
			cells = jsval.AsArray(prop(row, "cells"))
		}
		for i, v := range cells[:min(len(cells), n)] {
			cell := ws.cell(r, i+1)
			f, laSo := v.(float64)
			_, laChu := v.(string)
			if (laSo && !math.IsInf(f, 0) && !math.IsNaN(f)) || laChu {
				cell.set(v)
			} else {
				cell.set("")
			}
			if laSo {
				cell.numFmt("#,##0.##")
			}
			cell.align(xAlign{V: "top", Wrap: !isNum[i]})
		}
		r++
	}
	if tong, ok := prop(b, "tong").([]any); ok && n >= 2 {
		r++
		for _, t := range tong[:min(len(tong), 20)] {
			if jsval.IsNullish(t) {
				return nil, typeErrRead(t, "0")
			}
			ws.cell(r, n-1).set(jsval.StrOr(prop(t, "0"), ""))
			ws.cell(r, n-1).font(xFont{Bold: true})
			c := ws.cell(r, n)
			c.set(jsval.Num0(prop(t, "1")))
			c.numFmt(fmtInt)
			c.font(xFont{Bold: true})
			r++
		}
	}
	return wb, nil
}

// BuildBangXlsx = buildBangXlsx (X:527-567): 1 bảng do client dựng sẵn -> file Excel.
// b = {ten, sheet, cols: [{label, num}], rows: [{cells: []} | {group: ""}], tong: [[nhãn, số]]}. Không đọc database.
func (s *Service) BuildBangXlsx(b any) ([]byte, error) {
	wb, err := buildBang(b)
	if err != nil {
		return nil, err
	}
	return wb.write()
}
