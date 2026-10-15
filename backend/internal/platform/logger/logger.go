// Package logger: ghi log ra console theo kiểu của server Node - "[tag] nội dung".
// Lỗi ra stderr (console.error), thông tin ra stdout (console.log). Dựng trên log/slog.
package logger

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"sync"
)

// handler in đúng 1 dòng: message + các thuộc tính k=v (không thời gian, không mức - như console.*).
type handler struct {
	mu    *sync.Mutex
	out   io.Writer
	errw  io.Writer
	attrs []slog.Attr
}

func (h *handler) Enabled(context.Context, slog.Level) bool { return true }

func (h *handler) Handle(_ context.Context, r slog.Record) error {
	var sb strings.Builder
	sb.WriteString(r.Message)
	add := func(a slog.Attr) bool {
		sb.WriteByte(' ')
		sb.WriteString(a.Key)
		sb.WriteByte('=')
		sb.WriteString(a.Value.String())
		return true
	}
	for _, a := range h.attrs {
		add(a)
	}
	r.Attrs(add)
	sb.WriteByte('\n')
	w := h.out
	if r.Level >= slog.LevelWarn {
		w = h.errw
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	_, err := io.WriteString(w, sb.String())
	return err
}

func (h *handler) WithAttrs(as []slog.Attr) slog.Handler {
	n := *h
	n.attrs = append(append([]slog.Attr{}, h.attrs...), as...)
	return &n
}

func (h *handler) WithGroup(string) slog.Handler { return h }

var std = New(os.Stdout, os.Stderr)

// New tạo logger ghi thông tin vào out, cảnh báo / lỗi vào errw.
func New(out, errw io.Writer) *slog.Logger {
	return slog.New(&handler{mu: &sync.Mutex{}, out: out, errw: errw})
}

// L trả logger dùng chung.
func L() *slog.Logger { return std }

// SetDefault thay logger dùng chung (test).
func SetDefault(l *slog.Logger) { std = l }

func line(tag string, args []any) string {
	parts := make([]string, 0, len(args)+1)
	if tag != "" {
		parts = append(parts, "["+tag+"]")
	}
	for _, a := range args {
		parts = append(parts, fmt.Sprint(a))
	}
	return strings.Join(parts, " ")
}

// Info: console.log("[tag] a", b...) - các tham số cách nhau 1 dấu cách.
func Info(tag string, args ...any) { std.Info(line(tag, args)) }

// Error: console.error("[tag] a", b...).
func Error(tag string, args ...any) { std.Error(line(tag, args)) }

// Infof / Errorf: như trên với chuỗi định dạng.
func Infof(tag, format string, a ...any)  { std.Info(line(tag, []any{fmt.Sprintf(format, a...)})) }
func Errorf(tag, format string, a ...any) { std.Error(line(tag, []any{fmt.Sprintf(format, a...)})) }
