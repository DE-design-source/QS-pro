// Package errors: lỗi ứng dụng có mã HTTP. Import với bí danh để khỏi trùng thư viện chuẩn:
//
//	apperr "qspro-backend/internal/shared/errors"
//
// Lưu ý: cổng /api/:fn (tương thích Node) LUÔN trả 500 + message cho mọi lỗi của handler,
// đúng như server/index.js; mã Status chỉ có tác dụng ở các route REST /api/v1.
package errors

import (
	stderrors "errors"
	"fmt"
)

// AppError: lỗi nghiệp vụ kèm mã HTTP và mã lỗi tuỳ chọn (vd "NOAUTH").
type AppError struct {
	Status int
	Msg    string
	Code   string
}

func (e *AppError) Error() string { return e.Msg }

// E tạo AppError: apperr.E(400, "Thiếu mã dự án") hoặc apperr.E(401, "Chưa đăng nhập", "NOAUTH").
func E(status int, msg string, code ...string) *AppError {
	e := &AppError{Status: status, Msg: msg}
	if len(code) > 0 {
		e.Code = code[0]
	}
	return e
}

// New: lỗi thường (throw new Error(msg)) -> 500 như dispatcher của Node.
func New(msg string) error { return stderrors.New(msg) }

// Errorf: lỗi thường có định dạng.
func Errorf(format string, a ...any) error { return fmt.Errorf(format, a...) }

// BadRequest / Forbidden / NotFound: lối tắt cho REST.
func BadRequest(msg string) *AppError { return E(400, msg) }
func Forbidden(msg string) *AppError  { return E(403, msg) }
func NotFound(msg string) *AppError   { return E(404, msg) }

// Is / As: chuyển tiếp thư viện chuẩn.
func Is(err, target error) bool     { return stderrors.Is(err, target) }
func As(err error, target any) bool { return stderrors.As(err, target) }

// Message: e.message || "Lỗi máy chủ".
func Message(err error) string {
	if err == nil || err.Error() == "" {
		return "Lỗi máy chủ"
	}
	return err.Error()
}

// Status: mã HTTP + mã lỗi của err; lỗi thường -> 500, "".
func Status(err error) (int, string) {
	var ae *AppError
	if stderrors.As(err, &ae) && ae.Status != 0 {
		return ae.Status, ae.Code
	}
	return 500, ""
}
