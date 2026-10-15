package qscore

import (
	"math"
	"strings"
	"time"

	"golang.org/x/text/encoding/unicode"

	apperr "qspro-backend/internal/shared/errors"
	"qspro-backend/internal/shared/jsval"
)

/* Đọc CSV giống hệt ExcelJS (wb.csv.read): bộ tách dòng của fast-csv (tuỳ chọn mặc định) + hàm đổi kiểu
   từng ô của ExcelJS (số -> number, ngày -> Date, true/false -> boolean, #N/A -> lỗi). */

// csvScanner = Scanner của @fast-csv/parse, chạy trên rune (mọi token đều thuộc BMP).
type csvScanner struct {
	line        []rune
	cursor      int
	hasMoreData bool
}

// token: start < 0 nghĩa là không có.
type csvToken struct {
	start, end int // end: vị trí rune cuối của token
	crlf       bool
	r          rune
}

func (t csvToken) ok() bool         { return t.start >= 0 }
func (t csvToken) isRowDelim() bool { return t.crlf || t.r == '\r' || t.r == '\n' }
func (t csvToken) is(r rune) bool   { return !t.crlf && t.r == r }

var noToken = csvToken{start: -1}

func (s *csvScanner) hasMore() bool { return len(s.line) > s.cursor }

// NEXT_TOKEN_REGEXP = /([^\s]|\r\n|\n|\r|,)/
func (s *csvScanner) nextNonSpace() csvToken {
	for i := s.cursor; i < len(s.line); i++ {
		r := s.line[i]
		if !isJSSpace(r) {
			return csvToken{start: i, end: i, r: r}
		}
		if r == '\r' && i+1 < len(s.line) && s.line[i+1] == '\n' {
			return csvToken{start: i, end: i + 1, crlf: true}
		}
		if r == '\r' || r == '\n' {
			return csvToken{start: i, end: i, r: r}
		}
	}
	return noToken
}

func (s *csvScanner) nextChar() csvToken {
	if s.cursor >= len(s.line) {
		return noToken
	}
	return csvToken{start: s.cursor, end: s.cursor, r: s.line[s.cursor]}
}

func (s *csvScanner) fromCursor() string {
	if s.cursor >= len(s.line) {
		return ""
	}
	return string(s.line[s.cursor:])
}

func (s *csvScanner) truncate() {
	if s.cursor >= len(s.line) {
		s.line = nil
	} else {
		s.line = s.line[s.cursor:]
	}
	s.cursor = 0
}

var csvNL = strings.NewReplacer("\r", "\\n'", "\n", "\\n'")

// csvQuoted = QuotedColumnParser.parse; ok=false nghĩa là chưa đủ dữ liệu (trả null bên JS).
func csvQuoted(s *csvScanner) (col string, ok bool, err error) {
	if !s.hasMore() {
		return "", false, nil
	}
	orig := s.cursor
	var chars []rune
	foundStart, foundClose := false, false
	for next := s.nextChar(); !foundClose && next.ok(); next = s.nextChar() {
		isQuote := next.is('"')
		if !foundStart && isQuote {
			foundStart = true
		} else if foundStart {
			if isQuote { // ký tự thoát cũng là dấu nháy
				s.cursor = next.end + 1
				follow := s.nextChar()
				if follow.ok() && follow.is('"') {
					chars = append(chars, '"')
					next = follow
				} else {
					foundClose = true
				}
			} else {
				chars = append(chars, next.r)
			}
		}
		s.cursor = next.end + 1
	}
	if !foundClose {
		s.cursor = orig
		if !s.hasMoreData {
			return "", false, apperr.New("Parse Error: missing closing: '\"' in line: at '" + csvNL.Replace(s.fromCursor()) + "'")
		}
		return "", false, nil
	}
	// checkForMalformedColumn
	if nt := s.nextNonSpace(); nt.ok() {
		if !(nt.is(',') || nt.isRowDelim()) {
			tok := string(nt.r)
			return "", false, apperr.New("Parse Error: expected: ',' OR new line got: '" + tok + "'. at '" +
				csvNL.Replace(jsval.Slice(s.fromCursor(), 0, 10)))
		}
		s.cursor = nt.start
	} else if !s.hasMoreData {
		s.cursor = len(s.line)
	}
	return string(chars), true, nil
}

func csvNonQuoted(s *csvScanner) (string, bool) {
	if !s.hasMore() {
		return "", false
	}
	start := s.cursor
	for s.cursor < len(s.line) {
		r := s.line[s.cursor]
		if r == ',' || r == '\r' || r == '\n' {
			break
		}
		s.cursor++
	}
	return string(s.line[start:s.cursor]), true
}

// csvRow = RowParser.parse; ok=false: dòng chưa trọn (chờ thêm dữ liệu).
func csvRow(s *csvScanner) (cols []string, ok bool, err error) {
	cols = []string{}
	cur := s.nextNonSpace()
	if cur.ok() && cur.is(',') {
		cols = append(cols, "")
		cur = s.nextNonSpace()
	}
	for cur.ok() {
		if cur.isRowDelim() {
			s.cursor = cur.end + 1
			// kết thúc bằng CR mà còn dữ liệu: giữ lại vì có thể là CRLF
			if !s.hasMore() && cur.is('\r') && s.hasMoreData {
				return nil, false, nil
			}
			s.truncate()
			return cols, true, nil
		}
		skip := false
		if cur.is(',') {
			s.cursor = cur.end + 1
			nt := s.nextChar()
			if !s.hasMore() || (nt.ok() && nt.isRowDelim()) || (nt.ok() && nt.is(',')) {
				cols = append(cols, "")
				skip = true
			}
		}
		if !skip {
			var item string
			var got bool
			if nt := s.nextNonSpace(); nt.ok() && nt.is('"') {
				s.cursor = nt.start
				if item, got, err = csvQuoted(s); err != nil {
					return nil, false, err
				}
			} else {
				item, got = csvNonQuoted(s)
			}
			if !got {
				return nil, false, nil
			}
			cols = append(cols, item)
		}
		cur = s.nextNonSpace()
	}
	if !s.hasMoreData {
		s.truncate()
		return cols, true, nil
	}
	return nil, false, nil
}

// csvParse = Parser.parse: trả các dòng đã trọn + phần còn lại.
func csvParse(line []rune, hasMoreData bool) (rest []rune, rows [][]string, err error) {
	if len(line) > 0 && line[0] == 0xFEFF {
		line = line[1:]
	}
	s := &csvScanner{line: line, hasMoreData: hasMoreData}
	for {
		if !s.nextNonSpace().ok() {
			break
		}
		row, ok, err := csvRow(s)
		if err != nil {
			return nil, nil, err
		}
		if !ok {
			break
		}
		rows = append(rows, row)
	}
	return s.line, rows, nil
}

// csvRows: toàn bộ luồng của CsvParserStream - 1 lần _transform (cả chuỗi) rồi _flush.
func csvRows(text string) ([][]string, error) {
	var rows [][]string
	var rest []rune
	if text != "" {
		r, got, err := csvParse([]rune(text), true)
		if err != nil {
			return nil, err
		}
		rest, rows = r, got
	}
	if len(rest) > 0 {
		_, got, err := csvParse(rest, false)
		if err != nil {
			return nil, err
		}
		rows = append(rows, got...)
	}
	return rows, nil
}

func digits(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

func atoi(s string) int {
	n := 0
	for i := 0; i < len(s); i++ {
		n = n*10 + int(s[i]-'0')
	}
	return n
}

func validYMD(y, m, d string) bool {
	if !digits(y) || !digits(m) || !digits(d) {
		return false
	}
	yy, mm, dd := atoi(y), atoi(m), atoi(d)
	if yy < 100 || mm < 1 || mm > 12 || dd < 1 { // new Date(y, ...) với y < 100 thành 19xx
		return false
	}
	return dd <= time.Date(yy, time.Month(mm)+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

func validHMS(s string) bool { // HH:mm:ss
	if len(s) != 8 || s[2] != ':' || s[5] != ':' || !digits(s[0:2]) || !digits(s[3:5]) || !digits(s[6:8]) {
		return false
	}
	return atoi(s[0:2]) < 24 && atoi(s[3:5]) < 60 && atoi(s[6:8]) < 60
}

/*
dayjs(datum, fmt, true).isValid() với 4 mẫu mặc định của ExcelJS. Chế độ strict = chuỗi phải bằng đúng

	kết quả format lại, nên mẫu có Z chỉ khớp khi độ lệch giờ ghi trong chuỗi trùng múi giờ của máy chủ.
*/
func csvIsDate(s string) bool {
	if !isASCII(s) {
		return false
	}
	switch len(s) {
	case 25: // YYYY-MM-DD[T]HH:mm:ssZ
		if s[4] != '-' || s[7] != '-' || s[10] != 'T' || !validYMD(s[0:4], s[5:7], s[8:10]) || !validHMS(s[11:19]) {
			return false
		}
		z := s[19:]
		if (z[0] != '+' && z[0] != '-') || z[3] != ':' || !digits(z[1:3]) || !digits(z[4:6]) {
			return false
		}
		off := atoi(z[1:3])*3600 + atoi(z[4:6])*60
		if z[0] == '-' {
			off = -off
		}
		t, err := time.Parse("2006-01-02T15:04:05", s[:19])
		if err != nil {
			return false
		}
		_, local := t.Add(-time.Duration(off) * time.Second).In(time.Local).Zone()
		return local == off && !(z[0] == '-' && off == 0)
	case 19: // YYYY-MM-DD[T]HH:mm:ss
		return s[4] == '-' && s[7] == '-' && s[10] == 'T' && validYMD(s[0:4], s[5:7], s[8:10]) && validHMS(s[11:19])
	case 10:
		if s[2] == '-' && s[5] == '-' { // MM-DD-YYYY
			return validYMD(s[6:10], s[0:2], s[3:5])
		}
		return s[4] == '-' && s[7] == '-' && validYMD(s[0:4], s[5:7], s[8:10]) // YYYY-MM-DD
	}
	return false
}

// csvDatum = hàm map mặc định của ExcelJS, rồi qua importCell_: kết quả là "" | float64 | bool | string.
func csvDatum(d string) any {
	if d == "" {
		return ""
	}
	if n := jsval.ToNumber(d); n == n && !math.IsInf(n, 1) {
		return n
	}
	if csvIsDate(d) {
		return "" // Date -> importCell_ trả ''
	}
	switch d {
	case "true":
		return true
	case "false":
		return false
	case "#N/A", "#REF!", "#NAME?", "#DIV/0!", "#NULL!", "#VALUE!", "#NUM!":
		return "" // {error} -> ''
	}
	return d
}

// readCSV: 1 sheet tên "sheet1" (addWorksheet không truyền tên).
func readCSV(buf []byte) ([]*sheet, error) {
	text, err := unicode.UTF8.NewDecoder().String(string(buf)) // byte hỏng -> U+FFFD như buf.toString('utf8')
	if err != nil {
		text = strings.ToValidUTF8(string(buf), "�")
	}
	rows, err := csvRows(text)
	if err != nil {
		return nil, err
	}
	sh := &sheet{name: "sheet1"}
	for _, r := range rows {
		arr := make([]any, len(r))
		has := false
		for i, d := range r {
			arr[i] = csvDatum(d)
			if d != "" {
				has = true
			}
		}
		if has {
			sh.grid = append(sh.grid, arr)
		}
	}
	return []*sheet{sh}, nil
}
