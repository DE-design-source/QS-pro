'use strict';
/* Sinh giá trị mong đợi cho test của internal/jobs từ MÃ NODE THẬT (server/index.js dòng 322-593: lịch báo cáo
 * sản phẩm nhập mới). index.js không require được (nó mở cổng và bật job) nên đoạn mã được cắt nguyên văn ra rồi chạy
 * với supa / fetch / Date / setTimeout / console giả. Không nạp module nào của server, không đụng database.
 *
 *   node gen.js   -> golden.json
 *     instants: với từng thời điểm - msToNextBaoCao_(), dòng log của scheduleBaoCaoSP_(), autoBaoCaoSP_ có qua 2 điều kiện ngày / giờ không
 *     sims:     chạy cả vòng đời (timer 70 giây lúc khởi động + lịch tự hẹn lại) trên đồng hồ giả trong nhiều ngày
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..', '..');
const H = 3600e3;

const src = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
const a = src.indexOf('const VN_OFFSET_MS'), END = '}, 70 * 1000);', b = src.indexOf(END, a);
if (a < 0 || b < 0) throw new Error('không cắt được đoạn mã lịch báo cáo');
const CODE = src.slice(a, b + END.length);

function fakeDate(clock) { return class extends Date { static now() { return clock.t; } }; }
function load(d) {
  return new Function('store', 'supa', 'PURCHASE_WEBHOOK', 'fetch', 'Date', 'console', 'setTimeout', 'process',
    CODE + '\nreturn { autoBaoCaoSP_, msToNextBaoCao_, scheduleBaoCaoSP_ };')({}, d.supa, 'http://webhook.test/hook', d.fetch, d.Date, d.console, d.setTimeout, { env: {} });
}
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const quiet = { log: function () {}, warn: function () {}, error: function () {} };

function instants() {
  const ts = [];
  for (let t = Date.parse('2026-10-01T00:00:00Z'), i = 0; i < 60; i++, t += 7 * H + 13 * 60e3 + 4321) ts.push(t);
  ['2026-10-14T00:59:59.999Z', '2026-10-14T01:00:00.000Z', '2026-10-14T01:00:00.001Z', '2026-10-14T00:59:30.000Z', '2026-10-14T00:59:29.999Z',
    '2026-10-17T00:59:59.999Z', '2026-10-17T01:00:00.000Z', '2026-10-16T17:00:00.000Z', '2026-10-16T16:59:59.999Z', '2026-10-13T17:00:00.000Z',
    '2026-10-14T16:59:59.999Z', '2026-10-14T17:00:00.000Z', '2026-10-18T01:00:00.000Z', '2026-12-30T01:00:00.000Z', '2026-12-31T17:00:00.000Z',
    '2027-01-02T01:00:00.000Z', '2028-02-29T10:00:00.000Z', '2028-03-01T00:30:00.000Z', '1970-01-01T00:00:00.000Z'].forEach(function (s) { ts.push(Date.parse(s)); });
  return ts.map(function (t) {
    const clock = { t: t };
    let due = false, log = null, delay = null;
    const supa = { eq: function () { return ''; }, select: async function () { due = true; return [{ id: 1, created_at: new Date(t).toISOString() }]; } };
    const m = load({ supa: supa, fetch: null, Date: fakeDate(clock), setTimeout: function (fn, ms) { delay = ms; },
      console: { log: function () { log = Array.prototype.join.call(arguments, ' '); }, warn: function () {}, error: function () {} } });
    const wait = m.msToNextBaoCao_();
    m.autoBaoCaoSP_('thử');
    m.scheduleBaoCaoSP_();
    return { now: t, wait: wait, due: due, log: log, delay: delay };
  });
}

/* Một kịch bản: server khởi động lúc `start`, chạy tới `end`.
   mode: 'ok' gửi được (ghi audit) | 'empty' kỳ không có sản phẩm | 'fail' webhook lỗi (không ghi audit) | 'throw' đọc audit lỗi + webhook lỗi */
async function sim(sc) {
  const clock = { t: Date.parse(sc.start) }, end = Date.parse(sc.end);
  const timers = [], out = { timers: [], sched: [], report: [] };
  const audits = (sc.audits || []).map(function (s, i) { return { id: i + 1, created_at: s }; });
  const supa = {
    eq: function (c, v) { return c + '=eq.' + v; },
    select: async function (t) {
      if (t === 'audit_log') {
        out.report.push({ t: clock.t, ev: 'check' });
        if (sc.mode === 'throw') throw new Error('mất kết nối');
        return audits.slice(-5).reverse();
      }
      if (t === 'db_san_pham') {
        out.report.push({ t: clock.t, ev: 'send' });
        return sc.mode === 'empty' ? [] : [{ id: 1, ma_sp: 'A', ten_sp: 'A', nha_cung_cap: 'N', nguoi_tao: 'u', ngay_tao: new Date(clock.t - H).toISOString(), cong_ty_id: null }, { id: 2, nguoi_tao: 'u', ngay_tao: new Date(clock.t - H).toISOString(), cong_ty_id: null }];
      }
      return [];
    },
    insert: async function () { audits.push({ id: audits.length + 1, created_at: new Date(clock.t).toISOString() }); }
  };
  const fetch = async function () {
    if (sc.mode === 'fail' || sc.mode === 'throw') throw new Error('fetch failed');
    return { status: 200, json: async function () { return { code: 0 }; } };
  };
  const cons = { warn: function () {}, error: function () {}, log: function () {
    const line = Array.prototype.join.call(arguments, ' ');
    if (/lần gửi kế tiếp/.test(line)) out.sched.push({ t: clock.t, log: line }); else out.report.push({ t: clock.t, ev: 'log', log: line });
  } };
  load({ supa: supa, fetch: fetch, Date: fakeDate(clock), console: cons,
    setTimeout: function (fn, ms) { out.timers.push({ t: clock.t, delay: ms }); timers.push({ at: clock.t + ms, fn: fn }); } });
  for (;;) {
    timers.sort(function (x, y) { return x.at - y.at; });
    const next = timers.shift();
    if (!next || next.at > end) break;
    clock.t = next.at;
    next.fn();
    for (let i = 0; i < 20; i++) await tick();
  }
  return out;
}

(async function () {
  const scs = [
    { name: 'khoi dong thu 4 sau 8h -> gui bu, roi thu 7, thu 4...', start: '2026-10-14T02:00:00.000Z', end: '2026-10-29T00:00:00.000Z', mode: 'ok' },
    { name: 'khoi dong thu 4 luc 07:59:30 -> 70 giay sau da qua 8h', start: '2026-10-14T00:59:30.000Z', end: '2026-10-22T00:00:00.000Z', mode: 'ok' },
    { name: 'khoi dong thu 4 luc 07:58:49.999 -> gui bu roi vao 07:59:59.999, chua toi gio', start: '2026-10-14T00:58:49.999Z', end: '2026-10-18T00:00:00.000Z', mode: 'ok' },
    { name: 'khoi dong thu 4, hom nay da gui', start: '2026-10-14T05:00:00.000Z', end: '2026-10-22T00:00:00.000Z', mode: 'ok', audits: ['2026-10-10T01:00:40.000Z', '2026-10-14T01:00:41.123456+00:00'] },
    { name: 'khoi dong thu 5 -> khong gui bu', start: '2026-10-15T03:00:00.000Z', end: '2026-10-22T00:00:00.000Z', mode: 'ok', audits: ['2026-10-14T01:00:41.123456+00:00'] },
    { name: 'khoi dong thu 7 23:59 gio VN', start: '2026-10-17T16:58:00.000Z', end: '2026-10-22T00:00:00.000Z', mode: 'ok' },
    { name: 'ky khong co san pham', start: '2026-10-13T20:00:00.000Z', end: '2026-10-22T00:00:00.000Z', mode: 'empty' },
    { name: 'webhook loi -> khong audit', start: '2026-10-14T02:00:00.000Z', end: '2026-10-22T00:00:00.000Z', mode: 'fail' },
    { name: 'doc audit loi + webhook loi', start: '2026-10-17T02:00:00.000Z', end: '2026-10-22T00:00:00.000Z', mode: 'throw' },
    { name: 'giao nam', start: '2026-12-29T10:00:00.000Z', end: '2027-01-08T00:00:00.000Z', mode: 'ok' }
  ];
  const out = { instants: instants(), sims: [] };
  for (const sc of scs) out.sims.push({ in: sc, out: await sim(sc) });
  fs.writeFileSync(path.join(__dirname, 'golden.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('golden.json:', out.instants.length, 'thời điểm,', out.sims.length, 'kịch bản');
  out.sims.forEach(function (s) { console.log(' -', s.in.name, '| timers', s.out.timers.length, 'report', s.out.report.map(function (e) { return e.ev === 'log' ? e.log : e.ev; }).join(' / ')); });
})().catch(function (e) { console.error(e); process.exit(1); });
