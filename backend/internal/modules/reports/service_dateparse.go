package reports

import (
	"math"
	"time"
	"unicode/utf16"
)

// Bản chuyển bộ đọc chuỗi ngày của V8 (src/date/dateparser*.{h,cc}) - thứ `new Date(chuỗi)` của Node dùng (I:455, 480, 560).
// Hai tầng như bản gốc: đọc dạng ISO của ES5 trước; còn thừa ký tự thì đọc tiếp bằng bộ "legacy" (dạng tự do:
// "2026-10-07 08:00:00+07", "Oct 1 2026", "10/01/2026"...). Giữ nguyên cấu trúc của V8 để dễ đối chiếu.

const dpNone = math.MaxInt32 // kNone

const (
	tkInvalid = iota
	tkUnknown
	tkNumber
	tkSymbol
	tkSpace
	tkKeyword
	tkEnd
)

const (
	kwInvalid = iota
	kwMonth
	kwAmPm
	kwZone
	kwTimeSep
)

type dateToken struct {
	tag    int
	length int
	value  int
	kw     int
}

func (t dateToken) isNumber() bool           { return t.tag == tkNumber }
func (t dateToken) isFixed(n int) bool       { return t.tag == tkNumber && t.length == n }
func (t dateToken) isSymbol(c uint16) bool   { return t.tag == tkSymbol && t.value == int(c) }
func (t dateToken) isSign() bool             { return t.tag == tkSymbol && (t.value == '+' || t.value == '-') }
func (t dateToken) sign() int                { return 44 - t.value }
func (t dateToken) isKeywordType(k int) bool { return t.tag == tkKeyword && t.kw == k }
func (t dateToken) isKeywordZ() bool {
	return t.isKeywordType(kwZone) && t.length == 1 && t.value == 0
}

var dateKeywords = [...]struct {
	pre   [3]uint32
	kw    int
	value int
}{
	{[3]uint32{'j', 'a', 'n'}, kwMonth, 1}, {[3]uint32{'f', 'e', 'b'}, kwMonth, 2}, {[3]uint32{'m', 'a', 'r'}, kwMonth, 3},
	{[3]uint32{'a', 'p', 'r'}, kwMonth, 4}, {[3]uint32{'m', 'a', 'y'}, kwMonth, 5}, {[3]uint32{'j', 'u', 'n'}, kwMonth, 6},
	{[3]uint32{'j', 'u', 'l'}, kwMonth, 7}, {[3]uint32{'a', 'u', 'g'}, kwMonth, 8}, {[3]uint32{'s', 'e', 'p'}, kwMonth, 9},
	{[3]uint32{'o', 'c', 't'}, kwMonth, 10}, {[3]uint32{'n', 'o', 'v'}, kwMonth, 11}, {[3]uint32{'d', 'e', 'c'}, kwMonth, 12},
	{[3]uint32{'a', 'm', 0}, kwAmPm, 0}, {[3]uint32{'p', 'm', 0}, kwAmPm, 12},
	{[3]uint32{'u', 't', 0}, kwZone, 0}, {[3]uint32{'u', 't', 'c'}, kwZone, 0}, {[3]uint32{'z', 0, 0}, kwZone, 0},
	{[3]uint32{'g', 'm', 't'}, kwZone, 0},
	{[3]uint32{'c', 'd', 't'}, kwZone, -5}, {[3]uint32{'c', 's', 't'}, kwZone, -6},
	{[3]uint32{'e', 'd', 't'}, kwZone, -4}, {[3]uint32{'e', 's', 't'}, kwZone, -5},
	{[3]uint32{'m', 'd', 't'}, kwZone, -6}, {[3]uint32{'m', 's', 't'}, kwZone, -7},
	{[3]uint32{'p', 'd', 't'}, kwZone, -7}, {[3]uint32{'p', 's', 't'}, kwZone, -8},
	{[3]uint32{'t', 0, 0}, kwTimeSep, 0},
}

func lookupKeyword(pre [3]uint32, length int) (kw, value int) {
	for _, k := range dateKeywords {
		if k.pre == pre && (length <= 3 || k.kw == kwMonth) {
			return k.kw, k.value
		}
	}
	return kwInvalid, 0
}

// jsSpace: WhiteSpace + LineTerminator của ECMAScript.
func jsSpace(c uint16) bool {
	switch c {
	case 9, 10, 11, 12, 13, 32, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
		return true
	}
	return c >= 0x2000 && c <= 0x200A
}

type dateScanner struct {
	buf  []uint16
	idx  int
	next dateToken
}

// ch: ký tự hiện tại; hết chuỗi là 0 (ký tự NUL trong chuỗi cũng kết thúc việc đọc, như V8).
func (s *dateScanner) ch() uint16 {
	if s.idx < len(s.buf) {
		return s.buf[s.idx]
	}
	return 0
}

func (s *dateScanner) skip(c uint16) bool {
	if s.ch() == c {
		s.idx++
		return true
	}
	return false
}

func (s *dateScanner) scan() dateToken {
	pre := s.idx
	c := s.ch()
	if c == 0 {
		return dateToken{tag: tkEnd}
	}
	if c >= '0' && c <= '9' {
		n, i := 0, 0
		for s.ch() == '0' {
			s.idx++
		}
		for c = s.ch(); c >= '0' && c <= '9'; c = s.ch() {
			if i < 9 { // kMaxSignificantDigits
				n = n*10 + int(c-'0')
			}
			i++
			s.idx++
		}
		return dateToken{tag: tkNumber, value: n, length: s.idx - pre}
	}
	for _, sym := range [...]uint16{':', '-', '+', '.', ')'} {
		if s.skip(sym) {
			return dateToken{tag: tkSymbol, value: int(sym), length: 1}
		}
	}
	if c >= 'A' && !jsSpace(c) {
		var p [3]uint32
		n := 0
		for c = s.ch(); c >= 'A' && !jsSpace(c); c = s.ch() {
			if n < 3 {
				p[n] = uint32(c) | 0x20
			}
			n++
			s.idx++
		}
		kw, v := lookupKeyword(p, n)
		return dateToken{tag: tkKeyword, kw: kw, value: v, length: n}
	}
	if jsSpace(c) {
		s.idx++
		return dateToken{tag: tkSpace, length: 1}
	}
	if c == '(' {
		balance := 0
		for {
			if s.ch() == ')' {
				balance--
			} else if s.ch() == '(' {
				balance++
			}
			s.idx++
			if !(balance > 0 && s.ch() != 0) {
				break
			}
		}
		return dateToken{tag: tkUnknown}
	}
	s.idx++
	return dateToken{tag: tkUnknown}
}

func (s *dateScanner) take() dateToken {
	t := s.next
	s.next = s.scan()
	return t
}

func (s *dateScanner) skipSymbol(c uint16) bool {
	if s.next.isSymbol(c) {
		s.next = s.scan()
		return true
	}
	return false
}

func between(x, lo, hi int) bool { return x >= lo && x <= hi }

type dayComposer struct {
	comp  [3]int
	n     int
	named int
	iso   bool
}

func (d *dayComposer) add(n int) bool {
	if d.n < 3 {
		d.comp[d.n] = n
		d.n++
		return true
	}
	return false
}

func (d *dayComposer) write() (year, month, day int, ok bool) {
	if d.n < 1 {
		return 0, 0, 0, false
	}
	for d.n < 3 {
		d.comp[d.n] = 1
		d.n++
	}
	month, day = dpNone, dpNone
	if d.named == dpNone {
		if d.iso || !between(d.comp[0], 1, 31) {
			year, month, day = d.comp[0], d.comp[1], d.comp[2] // YMD
		} else {
			month, day, year = d.comp[0], d.comp[1], d.comp[2] // MD(Y)
		}
	} else {
		month = d.named
		// V8 xét index_ == 1 SAU khi đã điền đủ 3 ô nên nhánh "chỉ có ngày" không bao giờ chạy
		if !between(d.comp[0], 1, 31) {
			year, day = d.comp[0], d.comp[1]
		} else {
			day, year = d.comp[0], d.comp[1]
		}
	}
	if !d.iso {
		if between(year, 0, 49) {
			year += 2000
		} else if between(year, 50, 99) {
			year += 1900
		}
	}
	if !between(month, 1, 12) || !between(day, 1, 31) {
		return 0, 0, 0, false
	}
	return year, month, day, true
}

type timeComposer struct {
	comp   [4]int
	n      int
	offset int
}

func (t *timeComposer) expecting(n int) bool {
	return (t.n == 1 && between(n, 0, 59)) || (t.n == 2 && between(n, 0, 59)) || (t.n == 3 && between(n, 0, 999))
}

func (t *timeComposer) add(n int) bool {
	if t.n < 4 {
		t.comp[t.n] = n
		t.n++
		return true
	}
	return false
}

func (t *timeComposer) addFinal(n int) bool {
	if !t.add(n) {
		return false
	}
	for t.n < 4 {
		t.add(0)
	}
	return true
}

func (t *timeComposer) write() (h, mi, sec, ms int, ok bool) {
	for t.n < 4 {
		t.add(0)
	}
	h, mi, sec, ms = t.comp[0], t.comp[1], t.comp[2], t.comp[3]
	if t.offset != dpNone {
		if !between(h, 0, 12) {
			return 0, 0, 0, 0, false
		}
		h = h%12 + t.offset
	}
	if !between(h, 0, 23) || !between(mi, 0, 59) || !between(sec, 0, 59) || !between(ms, 0, 999) {
		// giờ 24 chỉ hợp lệ khi phút, giây, mili giây đều bằng 0
		if h != 24 || mi != 0 || sec != 0 || ms != 0 {
			return 0, 0, 0, 0, false
		}
	}
	return h, mi, sec, ms, true
}

type zoneComposer struct{ sign, hour, minute int }

func (z *zoneComposer) set(hours int) {
	z.sign = 1
	if hours < 0 {
		z.sign = -1
	}
	z.hour, z.minute = hours*z.sign, 0
}

func (z *zoneComposer) setSign(s int) {
	z.sign = 1
	if s < 0 {
		z.sign = -1
	}
}

func (z *zoneComposer) expecting(n int) bool {
	return z.hour != dpNone && z.minute == dpNone && between(n, 0, 59)
}

// write: độ lệch tính bằng giây; has = false khi chuỗi không ghi múi giờ (-> giờ của tiến trình).
func (z *zoneComposer) write() (sec float64, has, ok bool) {
	if z.sign == dpNone {
		return 0, false, true
	}
	if z.hour == dpNone {
		z.hour = 0
	}
	if z.minute == dpNone {
		z.minute = 0
	}
	total := uint32(z.hour)*3600 + uint32(z.minute)*60 // phép cộng không dấu 32 bit như bản C++
	if total > 1<<31-1 {                               // Smi::kMaxValue (Node 64 bit không nén con trỏ: Smi 32 bit)
		return 0, false, false
	}
	return float64(z.sign) * float64(total), true, true
}

func readMilliseconds(t dateToken) int {
	number, length := t.value, t.length
	if length < 3 {
		if length == 1 {
			number *= 100
		} else if length == 2 {
			number *= 10
		}
	} else if length > 3 {
		if length > 9 {
			length = 9
		}
		factor := 1
		for {
			factor *= 10
			length--
			if length <= 3 {
				break
			}
		}
		number /= factor
	}
	return number
}

// parseES5: DateParser::ParseES5DateTime. Trả token chưa xử lý đầu tiên (tkEnd = đọc xong, tkInvalid = chuỗi hỏng).
func parseES5(sc *dateScanner, day *dayComposer, tm *timeComposer, tz *zoneComposer) dateToken {
	invalid := dateToken{tag: tkInvalid}
	if sc.next.isSign() {
		signTok := sc.take()
		if !sc.next.isFixed(6) {
			return signTok
		}
		sign := signTok.sign()
		year := sc.take().value
		if sign < 0 && year == 0 {
			return signTok
		}
		day.add(sign * year)
	} else if sc.next.isFixed(4) {
		day.add(sc.take().value)
	} else {
		return sc.take()
	}
	if sc.skipSymbol('-') {
		if !sc.next.isFixed(2) || !between(sc.next.value, 1, 12) {
			return sc.take()
		}
		day.add(sc.take().value)
		if sc.skipSymbol('-') {
			if !sc.next.isFixed(2) || !between(sc.next.value, 1, 31) {
				return sc.take()
			}
			day.add(sc.take().value)
		}
	}
	if !sc.next.isKeywordType(kwTimeSep) {
		if sc.next.tag != tkEnd {
			return sc.take()
		}
	} else {
		sc.take()
		if !sc.next.isFixed(2) || !between(sc.next.value, 0, 24) {
			return invalid
		}
		h24 := sc.next.value == 24
		tm.add(sc.take().value)
		if !sc.skipSymbol(':') {
			return invalid
		}
		if !sc.next.isFixed(2) || !between(sc.next.value, 0, 59) || (h24 && sc.next.value > 0) {
			return invalid
		}
		tm.add(sc.take().value)
		if sc.skipSymbol(':') {
			if !sc.next.isFixed(2) || !between(sc.next.value, 0, 59) || (h24 && sc.next.value > 0) {
				return invalid
			}
			tm.add(sc.take().value)
			if sc.skipSymbol('.') {
				if !sc.next.isNumber() || (h24 && sc.next.value > 0) {
					return invalid
				}
				tm.add(readMilliseconds(sc.take()))
			}
		}
		if sc.next.isKeywordZ() {
			sc.take()
			tz.set(0)
		} else if sc.next.isSymbol('+') || sc.next.isSymbol('-') {
			tz.setSign(sc.take().sign())
			if sc.next.isFixed(4) {
				hm := sc.take().value
				if !between(hm/100, 0, 23) || !between(hm%100, 0, 59) {
					return invalid
				}
				tz.hour, tz.minute = hm/100, hm%100
			} else {
				if !sc.next.isFixed(2) || !between(sc.next.value, 0, 23) {
					return invalid
				}
				tz.hour = sc.take().value
				if !sc.skipSymbol(':') {
					return invalid
				}
				if !sc.next.isFixed(2) || !between(sc.next.value, 0, 59) {
					return invalid
				}
				tz.minute = sc.take().value
			}
		}
		if sc.next.tag != tkEnd {
			return invalid
		}
	}
	// chỉ có ngày -> UTC; có giờ mà không ghi múi giờ -> giờ của tiến trình
	if tz.hour == dpNone && tm.n == 0 {
		tz.set(0)
	}
	day.iso = true
	return dateToken{tag: tkEnd}
}

// parseDate = Date.parse(s) của V8. loc là múi giờ của tiến trình (nil = UTC). Chuỗi không đọc được -> NaN.
func parseDate(s string, loc *time.Location) float64 {
	nan := math.NaN()
	sc := &dateScanner{buf: utf16.Encode([]rune(s))}
	sc.next = sc.scan()
	day := &dayComposer{named: dpNone}
	tm := &timeComposer{offset: dpNone}
	tz := &zoneComposer{sign: dpNone, hour: dpNone, minute: dpNone}

	tok := parseES5(sc, day, tm, tz)
	if tok.tag == tkInvalid {
		return nan
	}
	hasNum := day.n > 0
	for ; tok.tag != tkEnd; tok = sc.take() {
		switch {
		case tok.isNumber():
			hasNum = true
			n := tok.value
			if sc.skipSymbol(':') {
				if sc.skipSymbol(':') { // n + "::"
					if tm.n != 0 {
						return nan
					}
					tm.add(n)
					tm.add(0)
				} else { // n + ":"
					if !tm.add(n) {
						return nan
					}
					if sc.next.isSymbol('.') {
						sc.take()
					}
				}
			} else if sc.skipSymbol('.') && tm.expecting(n) {
				tm.add(n)
				if !sc.next.isNumber() {
					return nan
				}
				ms := readMilliseconds(sc.take())
				if ms < 0 {
					return nan
				}
				tm.addFinal(ms)
			} else if tz.expecting(n) {
				tz.minute = n
			} else if tm.expecting(n) {
				tm.addFinal(n)
				// ngay sau phần giờ chỉ được là hết chuỗi, khoảng trắng, "Z", "+" hoặc "-"
				if p := sc.next; p.tag != tkEnd && p.tag != tkSpace && !p.isKeywordZ() && !p.isSign() {
					return nan
				}
			} else {
				if !day.add(n) {
					return nan
				}
				sc.skipSymbol('-')
			}
		case tok.tag == tkKeyword:
			switch {
			case tok.kw == kwAmPm && tm.n != 0:
				tm.offset = tok.value
			case tok.kw == kwMonth:
				day.named = tok.value
				sc.skipSymbol('-')
			case tok.kw == kwZone && hasNum:
				tz.set(tok.value)
			default:
				// từ lạ: không được đứng sau một con số, cũng không được dính liền con số đầu tiên
				if hasNum || sc.next.isNumber() {
					return nan
				}
			}
		case tok.isSign() && ((tz.hour == 0 && tz.minute == 0) || tm.n != 0):
			// độ lệch múi giờ: chỉ nhận sau UTC / GMT hoặc sau phần giờ
			tz.setSign(tok.sign())
			n, length := 0, 0
			if sc.next.isNumber() {
				t := sc.take()
				n, length = t.value, t.length
			}
			hasNum = true
			switch {
			case sc.next.isSymbol(':'):
				tz.hour, tz.minute = n, dpNone
			case length == 2 || length == 1:
				tz.hour, tz.minute = n, 0
			case length == 4 || length == 3:
				tz.hour, tz.minute = n/100, n%100
			default:
				return nan
			}
		case (tok.isSign() || tok.isSymbol(')')) && hasNum:
			return nan
		}
	}

	year, month, d, ok := day.write()
	if !ok {
		return nan
	}
	h, mi, sec, ms, ok := tm.write()
	if !ok {
		return nan
	}
	off, hasZone, ok := tz.write()
	if !ok {
		return nan
	}
	if year < -1000000 || year > 1000000 { // MakeDay của V8 chỉ nhận năm trong khoảng này
		return nan
	}
	date := float64(time.Date(year, time.Month(month), d, h, mi, sec, 0, time.UTC).UnixMilli()) + float64(ms)
	if hasZone {
		return timeClip(date - off*1000)
	}
	if math.Abs(date) > maxTimeMs+30*msNgay { // kMaxTimeBeforeUTCInMs
		return nan
	}
	return timeClip(localToUTC(date, loc))
}

// localToUTC: đổi giờ địa phương (viết như một time value UTC) sang UTC theo quy tắc của ECMAScript: giờ bị lặp
// (lùi đồng hồ) lấy lần xuất hiện ĐẦU, giờ bị nhảy qua (vặn đồng hồ lên) tính bằng độ lệch TRƯỚC lúc đổi giờ.
// time.Date của Go không cam kết chọn bên nào nên phải tự tính.
func localToUTC(local float64, loc *time.Location) float64 {
	if loc == nil || loc == time.UTC {
		return local
	}
	off := func(utc float64) float64 {
		_, o := time.UnixMilli(int64(utc)).In(loc).Zone()
		return float64(o) * 1000
	}
	o1, o2 := off(local-msNgay), off(local+msNgay)
	c1 := local - o1
	if o1 == o2 || off(c1) == o1 {
		return c1
	}
	if c2 := local - o2; off(c2) == o2 {
		return c2
	}
	return c1
}
