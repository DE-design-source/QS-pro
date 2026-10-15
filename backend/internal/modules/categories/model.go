package categories

// LabelCol: 1 cặp của DB_LABEL2COL / COL2LABEL (nhãn tiếng Việt trên form <-> cột database).
type LabelCol struct {
	Label string
	Col   string
}

// cot: 1 cột của sheet "San pham" trong file mẫu = [nhãn, bắt buộc 1 / 0, độ rộng] của cotMau().
type cot struct {
	Label string
	Req   bool
	Width float64
}
