package omap

import (
	"encoding"
	"encoding/base64"
	"encoding/json"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"
)

/* Kiểu Go ngoài JS value model (struct, map, slice có kiểu, time.Time...).
   Tự duyệt bằng reflect thay vì nhờ encoding/json, vì encoding/json khác JSON.stringify ở chỗ:
   - time.Time ra RFC3339 (JS Date ra ...sss.SSSZ, luôn UTC, luôn 3 số mili giây)
   - float NaN / Infinity trong struct là LỖI (JS ra null)
   - trường mang Undefined ra null (JS bỏ hẳn khoá)
   Trường struct ghi theo thứ tự khai báo; map Go không có thứ tự nên xếp khoá tăng dần. */

var (
	marshalerType     = reflect.TypeOf((*json.Marshaler)(nil)).Elem()
	textMarshalerType = reflect.TypeOf((*encoding.TextMarshaler)(nil)).Elem()
	timeType          = reflect.TypeOf(time.Time{})
)

// ISOTime: Date.prototype.toISOString - UTC, đúng 3 chữ số mili giây.
func ISOTime(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

func appendReflect(dst []byte, rv reflect.Value) ([]byte, error) {
	if !rv.IsValid() {
		return append(dst, "null"...), nil
	}
	t := rv.Type()
	if t == timeType {
		return appendString(dst, ISOTime(rv.Interface().(time.Time))), nil
	}
	if k := rv.Kind(); (k == reflect.Pointer || k == reflect.Interface) && rv.IsNil() {
		return append(dst, "null"...), nil
	}
	if !t.Implements(marshalerType) && !t.Implements(textMarshalerType) && rv.CanAddr() {
		if pt := reflect.PointerTo(t); pt.Implements(marshalerType) || pt.Implements(textMarshalerType) {
			rv, t = rv.Addr(), pt
		}
	}
	if t.Implements(marshalerType) && rv.CanInterface() {
		b, err := rv.Interface().(json.Marshaler).MarshalJSON()
		if err != nil {
			return dst, err
		}
		// đọc lại về JS value model để chuỗi / số được ghi cùng một cách
		norm, err := Decode(b)
		if err != nil {
			return dst, err
		}
		return AppendJSON(dst, norm)
	}
	if t.Implements(textMarshalerType) && rv.CanInterface() {
		b, err := rv.Interface().(encoding.TextMarshaler).MarshalText()
		if err != nil {
			return dst, err
		}
		return appendString(dst, string(b)), nil
	}
	switch rv.Kind() {
	case reflect.Bool:
		return AppendJSON(dst, rv.Bool())
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.AppendInt(dst, rv.Int(), 10), nil
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return strconv.AppendUint(dst, rv.Uint(), 10), nil
	case reflect.Float32:
		// qua chuỗi ngắn nhất của float32 để 0.1 không thành 0.10000000149011612
		f, _ := strconv.ParseFloat(strconv.FormatFloat(rv.Float(), 'g', -1, 32), 64)
		return AppendJSON(dst, f)
	case reflect.Float64:
		return AppendJSON(dst, rv.Float())
	case reflect.String:
		return appendString(dst, rv.String()), nil
	case reflect.Pointer:
		if e := rv.Elem(); e.Kind() == reflect.Struct || e.Kind() == reflect.Array {
			return appendReflect(dst, e) // giữ địa chỉ để gọi được MarshalJSON nhận con trỏ
		}
		return appendValue(dst, rv.Elem())
	case reflect.Interface:
		return appendValue(dst, rv.Elem())
	case reflect.Slice:
		if rv.IsNil() {
			return append(dst, "null"...), nil
		}
		if t.Elem().Kind() == reflect.Uint8 {
			return appendString(dst, base64.StdEncoding.EncodeToString(rv.Bytes())), nil
		}
		return appendSeq(dst, rv)
	case reflect.Array:
		return appendSeq(dst, rv)
	case reflect.Map:
		if rv.IsNil() {
			return append(dst, "null"...), nil
		}
		return appendGoMap(dst, rv)
	case reflect.Struct:
		dst = append(dst, '{')
		first := true
		dst, err := appendFields(dst, rv, &first)
		if err != nil {
			return dst, err
		}
		return append(dst, '}'), nil
	}
	return dst, &json.UnsupportedTypeError{Type: t}
}

// appendValue: giá trị con - ưu tiên các kiểu của JS value model (đường nhanh trong AppendJSON).
func appendValue(dst []byte, rv reflect.Value) ([]byte, error) {
	if rv.IsValid() && rv.CanInterface() && rv.Kind() != reflect.Struct && rv.Kind() != reflect.Array {
		return AppendJSON(dst, rv.Interface())
	}
	return appendReflect(dst, rv)
}

func appendSeq(dst []byte, rv reflect.Value) ([]byte, error) {
	dst = append(dst, '[')
	var err error
	for i := 0; i < rv.Len(); i++ {
		if i > 0 {
			dst = append(dst, ',')
		}
		if dst, err = appendValue(dst, rv.Index(i)); err != nil {
			return dst, err
		}
	}
	return append(dst, ']'), nil
}

func appendGoMap(dst []byte, rv reflect.Value) ([]byte, error) {
	type kv struct {
		k string
		v reflect.Value
	}
	items := make([]kv, 0, rv.Len())
	it := rv.MapRange()
	for it.Next() {
		k := it.Key()
		var ks string
		switch k.Kind() {
		case reflect.String:
			ks = k.String()
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			ks = strconv.FormatInt(k.Int(), 10)
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
			ks = strconv.FormatUint(k.Uint(), 10)
		default:
			return dst, &json.UnsupportedTypeError{Type: rv.Type()}
		}
		items = append(items, kv{ks, it.Value()})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].k < items[j].k })
	dst = append(dst, '{')
	first := true
	var err error
	for _, e := range items {
		if isUndefinedValue(e.v) {
			continue
		}
		if !first {
			dst = append(dst, ',')
		}
		first = false
		dst = appendString(dst, e.k)
		dst = append(dst, ':')
		if dst, err = appendValue(dst, e.v); err != nil {
			return dst, err
		}
	}
	return append(dst, '}'), nil
}

func isUndefinedValue(rv reflect.Value) bool {
	for rv.IsValid() && rv.Kind() == reflect.Interface && !rv.IsNil() {
		rv = rv.Elem()
	}
	return rv.IsValid() && rv.Type() == reflect.TypeOf(undefinedT{})
}

func isEmptyValue(rv reflect.Value) bool {
	switch rv.Kind() {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return rv.Len() == 0
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64, reflect.Interface, reflect.Pointer:
		return rv.IsZero()
	}
	return false
}

// appendFields ghi các trường của struct theo thứ tự khai báo (tag json: tên, "-", omitempty, omitzero;
// struct nhúng không đặt tên thì trải phẳng).
func appendFields(dst []byte, rv reflect.Value, first *bool) ([]byte, error) {
	t := rv.Type()
	var err error
	for i := 0; i < t.NumField(); i++ {
		sf := t.Field(i)
		tag := sf.Tag.Get("json")
		if tag == "-" {
			continue
		}
		name, opts, _ := strings.Cut(tag, ",")
		fv := rv.Field(i)
		if sf.Anonymous && name == "" {
			ev := fv
			if ev.Kind() == reflect.Pointer {
				if ev.IsNil() {
					continue
				}
				ev = ev.Elem()
			}
			if ev.Kind() == reflect.Struct && ev.Type() != timeType && !ev.Type().Implements(marshalerType) {
				if dst, err = appendFields(dst, ev, first); err != nil {
					return dst, err
				}
				continue
			}
		}
		if !sf.IsExported() {
			continue
		}
		if name == "" {
			name = sf.Name
		}
		if isUndefinedValue(fv) {
			continue
		}
		if strings.Contains(opts, "omitempty") && isEmptyValue(fv) {
			continue
		}
		if strings.Contains(opts, "omitzero") && fv.IsZero() {
			continue
		}
		if !*first {
			dst = append(dst, ',')
		}
		*first = false
		dst = appendString(dst, name)
		dst = append(dst, ':')
		if dst, err = appendValue(dst, fv); err != nil {
			return dst, err
		}
	}
	return dst, nil
}
