package database

import (
	"context"
	"net"
	"os"
	"strings"
	"syscall"
	"testing"
	"time"
)

// Các ca lấy từ đợt đối chiếu với server/supa.js thật.

func TestNulByteInFilter(t *testing.T) {
	d := testDB(t)
	// Node (tham số gửi riêng): Postgres báo 22021; bản Go phải ra đúng lỗi đó chứ không phải 08P01
	want := `DB GET cong_ty -> 400 {"code":"22021","details":null,"hint":null,"message":"invalid byte sequence for encoding \"UTF8\": 0x00"}`
	for _, f := range []string{"ten=eq.a%00b", "ten=in.(x,a%00b)"} {
		_, err := d.Select(context.Background(), "cong_ty", SelectOpt{Select: "ma", Filter: f})
		if err == nil || err.Error() != want || CodeOf(err) != "22021" || StatusOf(err) != 400 {
			t.Errorf("%s:\n got %v\nwant %s", f, err, want)
		}
	}
}

func TestUnknownColumnWhenDBDown(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	if _, err := d.Select(ctx, "cong_ty", SelectOpt{Select: "ma", Limit: 1}); err != nil {
		t.Fatal(err)
	}
	// danh mục đã cũ + database mất: lỗi nạp lại danh mục phải được trả ra (Node không nuốt), không phải 42703
	d.catMu.Lock()
	d.catAt = d.catAt.Add(-10 * time.Second)
	d.catMu.Unlock()
	d.Close()
	d.cfg.URL = "postgresql://u:p@127.0.0.1:9/x?connect_timeout=2"
	_, err := d.Select(ctx, "cong_ty", SelectOpt{Select: "cot_khong_co"})
	if err == nil || CodeOf(err) == "42703" || CodeOf(err) == "PGRST204" {
		t.Errorf("phải là lỗi kết nối, nhận: %v", err)
	}
}

func TestWrapNetworkError(t *testing.T) {
	// Node bọc mọi lỗi có .code (ECONNREFUSED...) thành lỗi 400
	raw := &net.OpError{Op: "dial", Net: "tcp", Err: os.NewSyscallError("connect", syscall.ECONNREFUSED)}
	err := wrapPg("GET", "du_an", raw)
	if CodeOf(err) != "ECONNREFUSED" || StatusOf(err) != 400 || !strings.HasPrefix(err.Error(), `DB GET du_an -> 400 {"code":"ECONNREFUSED","details":null,"hint":null,"message":"`) {
		t.Errorf("got %v", err)
	}
	if plain := wrapPg("GET", "du_an", context.Canceled); plain != context.Canceled {
		t.Errorf("lỗi không có mã phải giữ nguyên: %v", plain)
	}
}

func TestIDTieBreakJSWhitespace(t *testing.T) {
	// /(^|,)\s*id\./ của JS: \s gồm cả U+00A0
	for s, want := range map[string]bool{"ma.asc,\u00a0id.desc": true, "ma.asc, \tid.desc": true, "id.asc": true, "ma.asc": false, "ma_id.asc": false} {
		if reHasID.MatchString(s) != want {
			t.Errorf("%q: muốn %v", s, want)
		}
	}
}
