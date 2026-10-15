package jobs

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"qspro-backend/internal/config"
	"qspro-backend/internal/shared/actor"
	"qspro-backend/internal/shared/contracts"
	"qspro-backend/internal/shared/jsval"
	"qspro-backend/internal/shared/omap"
)

// Giá trị mong đợi trong testdata/golden.json sinh từ mã Node thật (server/index.js): xem testdata/gen.js.

func loadGolden(t *testing.T) *omap.Map {
	t.Helper()
	b, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatal(err)
	}
	v, err := omap.Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	return jsval.AsMap(v)
}

func js(t *testing.T, v any) string {
	t.Helper()
	s, err := omap.MarshalString(v)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func ms(v any) int64 { return int64(jsval.ToNumber(v)) }

// dongLog: ghép dòng log như logger.Info ("[tag] a b c").
func dongLog(tag string, args []any) string {
	parts := []string{}
	if tag != "" {
		parts = append(parts, "["+tag+"]")
	}
	for _, a := range args {
		parts = append(parts, fmt.Sprint(a))
	}
	return strings.Join(parts, " ")
}

func TestInstants(t *testing.T) {
	cases := jsval.AsArray(loadGolden(t).Val("instants"))
	if len(cases) < 30 {
		t.Fatalf("cần ít nhất 30 thời điểm, có %d", len(cases))
	}
	for _, c := range cases {
		m := jsval.AsMap(c)
		now := ms(m.Val("now"))
		w := newWorker(Deps{})
		w.now = func() time.Time { return time.UnixMilli(now) }
		wait := w.msToNextBaoCao()
		if wait != jsval.ToNumber(m.Val("wait")) || wait != jsval.ToNumber(m.Val("delay")) {
			t.Errorf("now %d: msToNextBaoCao = %v, Node cho %v", now, wait, m.Val("wait"))
		}
		if got := denHan(w.nowVN()); got != (m.Val("due") == true) {
			t.Errorf("now %d: tới hạn gửi = %v, Node cho %v", now, got, m.Val("due"))
		}
		if got := dongLog(logTag, []any{cauHenGio(wait)}); got != m.Val("log") {
			t.Errorf("now %d: log %q, Node in %q", now, got, m.Val("log"))
		}
	}
}

// runnerGia: module reports giả, cư xử như supa / fetch giả trong gen.js.
type runnerGia struct {
	mu     sync.Mutex
	mode   string
	clock  *int64
	audits []int64 // thời điểm (ms) các lần đã ghi audit
	report []any
}

var _ contracts.ReportRunner = (*runnerGia)(nil)

func (r *runnerGia) ev(kv ...any) {
	r.report = append(r.report, omap.Of(append([]any{"t", float64(*r.clock)}, kv...)...))
}

func ngayVN(msUTC int64) string { return time.UnixMilli(msUTC + vnOffsetMs).UTC().Format("2006-01-02") }

func (r *runnerGia) DaGuiHomNay(context.Context) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.ev("ev", "check")
	if r.mode == "throw" {
		return false
	}
	from := len(r.audits) - 5
	if from < 0 {
		from = 0
	}
	for _, a := range r.audits[from:] {
		if ngayVN(a) == ngayVN(*r.clock) {
			return true
		}
	}
	return false
}

func (r *runnerGia) BaoCaoNhapSP(_ context.Context, a *actor.Actor, opts *omap.Map) (*omap.Map, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if a == nil || a.R != "super" || opts == nil || opts.Len() != 0 {
		return nil, fmt.Errorf("job phải gọi với actor {r: super} và opts {}")
	}
	r.ev("ev", "send")
	switch r.mode {
	case "empty":
		return omap.Of("sent", false, "count", 0.0, "message", "Kỳ này chưa có sản phẩm mới"), nil
	case "fail", "throw":
		return omap.Of("sent", false, "count", 2.0, "khuyet", 0.0, "the", []any{}), nil
	}
	r.audits = append(r.audits, *r.clock)
	return omap.Of("sent", true, "count", 2.0, "khuyet", 0.0, "the", []any{}), nil
}

func TestSchedule(t *testing.T) {
	for _, c := range jsval.AsArray(loadGolden(t).Val("sims")) {
		in, want := jsval.AsMap(jsval.AsMap(c).Val("in")), jsval.AsMap(jsval.AsMap(c).Val("out"))
		t.Run(jsval.AsString(in.Val("name")), func(t *testing.T) {
			parse := func(v any) int64 {
				tm, err := time.Parse(time.RFC3339Nano, jsval.AsString(v))
				if err != nil {
					t.Fatal(err)
				}
				return tm.UnixMilli()
			}
			clock, end := parse(in.Val("start")), parse(in.Val("end"))
			r := &runnerGia{mode: jsval.AsString(in.Val("mode")), clock: &clock}
			for _, a := range jsval.AsArray(in.Val("audits")) {
				r.audits = append(r.audits, parse(a))
			}
			w := newWorker(Deps{Reports: r})
			var timers, sched []any
			w.now = func() time.Time { return time.UnixMilli(clock) }
			w.logf = func(tag string, args ...any) {
				r.mu.Lock()
				defer r.mu.Unlock()
				line := dongLog(tag, args)
				if strings.Contains(line, "lần gửi kế tiếp") {
					sched = append(sched, omap.Of("t", float64(clock), "log", line))
				} else {
					r.ev("ev", "log", "log", line)
				}
			}
			w.sleep = func(_ context.Context, d time.Duration) bool {
				w.wg.Wait() // lượt gửi nền của mốc này xong rồi mới cho đồng hồ chạy tiếp
				timers = append(timers, omap.Of("t", float64(clock), "delay", float64(d.Milliseconds())))
				if clock+d.Milliseconds() > end {
					return false
				}
				clock += d.Milliseconds()
				return true
			}
			w.run(context.Background())
			w.wg.Wait()
			if got, w := js(t, timers), js(t, want.Val("timers")); got != w {
				t.Errorf("timer:\n Go   %s\n Node %s", got, w)
			}
			if got, w := js(t, sched), js(t, want.Val("sched")); got != w {
				t.Errorf("log hẹn giờ:\n Go   %s\n Node %s", got, w)
			}
			if got, w := js(t, r.report), js(t, want.Val("report")); got != w {
				t.Errorf("lượt gửi:\n Go   %s\n Node %s", got, w)
			}
		})
	}
}

type runnerDem struct {
	mu sync.Mutex
	n  int
}

func (r *runnerDem) DaGuiHomNay(context.Context) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.n++
	return true
}
func (r *runnerDem) BaoCaoNhapSP(context.Context, *actor.Actor, *omap.Map) (*omap.Map, error) {
	return nil, nil
}

func TestStartSwitch(t *testing.T) {
	t.Setenv("REPORT_JOB", "0")
	if Enabled() {
		t.Fatal("REPORT_JOB=0 phải tắt job")
	}
	w := Start(context.Background(), Deps{Reports: &runnerDem{}})
	if w.cancel != nil {
		t.Error("REPORT_JOB=0 mà vẫn bật bộ hẹn giờ")
	}
	w.Stop(context.Background())

	for _, v := range []string{"", "1", "true", "off", "00", " 0"} {
		t.Setenv("REPORT_JOB", v)
		if !Enabled() {
			t.Errorf("REPORT_JOB=%q phải để job bật (chỉ \"0\" mới tắt)", v)
		}
	}
	// có Cfg thì công tắc lấy từ Cfg, không đọc lại môi trường
	t.Setenv("REPORT_JOB", "1")
	if w := Start(context.Background(), Deps{Reports: &runnerDem{}, Cfg: &config.Config{ReportJob: false}}); w.cancel != nil {
		t.Error("Cfg.ReportJob = false mà vẫn bật bộ hẹn giờ")
	}
	t.Setenv("REPORT_JOB", "0")
	w = Start(context.Background(), Deps{Reports: &runnerDem{}, Cfg: &config.Config{ReportJob: true}})
	if w.cancel == nil {
		t.Error("Cfg.ReportJob = true mà không bật bộ hẹn giờ")
	}
	w.Stop(context.Background())
	t.Setenv("REPORT_JOB", "")
	if w := Start(context.Background(), Deps{}); w.cancel != nil {
		t.Error("thiếu Reports mà vẫn bật bộ hẹn giờ")
	}
	var nilW *Worker
	nilW.Stop(context.Background())

	// bật thật: Stop phải dừng được bộ hẹn giờ đang chờ 70 giây
	w = Start(context.Background(), Deps{Reports: &runnerDem{}})
	if w.cancel == nil {
		t.Fatal("job không bật")
	}
	done := make(chan struct{})
	go func() { w.Stop(context.Background()); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Stop không dừng được job")
	}
}

func TestSleepCtx(t *testing.T) {
	if !sleepCtx(context.Background(), time.Millisecond) {
		t.Error("hết giờ phải trả true")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if sleepCtx(ctx, time.Hour) {
		t.Error("ctx đã huỷ phải trả false")
	}
}
