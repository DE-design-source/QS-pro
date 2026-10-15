package qscore

import (
	"strings"

	apperr "qspro-backend/internal/shared/errors"
)

// SheetRows: đọc SHEET ĐẦU của file nhập bằng đúng bộ đọc của ImportParse (readCSV khi ext chứa "csv", còn lại readXLSX).
// Trả lưới ô của các dòng có dữ liệu theo thứ tự (dòng trống bị bỏ như eachRow({includeEmpty:false}));
// mỗi ô là "" | string | float64 | bool. Không có sheet nào -> lỗi "File không có sheet dữ liệu" như ImportParse.
func SheetRows(buf []byte, ext string) ([][]any, error) {
	var all []*sheet
	var err error
	if strings.Contains(strings.ToLower(ext), "csv") {
		all, err = readCSV(buf)
	} else {
		all, err = readXLSX(buf)
	}
	if err != nil {
		return nil, err
	}
	if len(all) == 0 {
		return nil, apperr.New("File không có sheet dữ liệu")
	}
	return all[0].grid, nil
}

// DecodeBase64 = Buffer.from(s, 'base64') của Node (cùng cách giải mã với ImportParse): bỏ ký tự lạ,
// nhận cả bảng url-safe, dừng ở dấu '=' đầu tiên.
func DecodeBase64(s string) []byte { return decodeBase64(s) }
