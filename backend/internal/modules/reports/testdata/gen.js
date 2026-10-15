'use strict';
/* Sinh giá trị mong đợi cho test của module reports từ MÃ NODE THẬT (server/index.js dòng 322-564).
 * index.js không require được (nó mở cổng và bật job) nên đoạn mã báo cáo được cắt nguyên văn ra rồi chạy
 * với supa / fetch / Date giả (pure) hoặc supa thật (db).
 *
 *   node gen.js pure   -> golden_pure.json  (kỳ báo cáo, đọc mốc thời gian, thẻ Lark, toàn bộ baoCaoNhapSP trên dữ liệu giả)
 *   node gen.js db     -> golden_db.json    (kịch bản trên database thử qspro_nodetest)
 *
 * "pure" không nạp module nào của server (không đụng database). Chạy "db" CHỈ với biến môi trường tường minh:
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen.js db
 * Kịch bản trong service_test.go (TestDiffDB) phải đi đúng từng bước như ở đây.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const root = path.join(__dirname, '..', '..', '..', '..', '..');
const mode = process.argv[2] || 'pure';
const H = 3600e3, VN = 7 * H;

const src = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
function cut(s, from, to) {
  const a = s.indexOf(from), b = s.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error('không cắt được đoạn mã: ' + from);
  return s.slice(a, b);
}
const CODE = cut(src, 'const VN_OFFSET_MS', "setTimeout(function () {\n  autoBaoCaoSP_('gửi bù".replace(/\n/g, src.indexOf('\r\n') >= 0 ? '\r\n' : '\n'));
const NAMES = 'nowVN_, tenNganh_, moBaoCaoTruoc_, vnToUtcIso_, ddmm_, buildSpReportCard, baoCaoNhapSP, daGuiBaoCaoHomNay_, autoBaoCaoSP_, msToNextBaoCao_, scheduleBaoCaoSP_';

// Date có đồng hồ giả: chỉ Date.now() bị thay, mọi thứ khác là Date thật.
function fakeDate(clock) { return class extends Date { static now() { return clock.t; } }; }

function load(d) {
  return new Function('store', 'supa', 'PURCHASE_WEBHOOK', 'fetch', 'Date', 'console', 'setTimeout', 'process',
    CODE + '\nreturn { ' + NAMES + ' };')(d.store, d.supa, d.webhook || 'http://webhook.test/hook', d.fetch, d.Date || Date,
    d.console || { log: function () {}, warn: function () {}, error: function () {} }, d.setTimeout || function () {}, { env: {} });
}

// nganhCua_ + MUC_NGANH cắt từ store_supa.js (không require store_supa.js vì nó nạp supa.js -> dotenv -> .env)
function storeLite() {
  const s = fs.readFileSync(path.join(root, 'server', 'store_supa.js'), 'utf8');
  const code = cut(s, 'function nganhCua_', '/*** ===== HELPERS');
  return new Function('VS', 'SON', 'CT', code + '\nreturn { nganhCua_, MUC_NGANH };')(
    require(path.join(root, 'backend', 'internal', 'shared', 'specs', 'js', 'vs-spec.js')), require(path.join(root, 'backend', 'internal', 'shared', 'specs', 'js', 'son-spec.js')), require(path.join(root, 'backend', 'internal', 'shared', 'specs', 'js', 'ct-spec.js')));
}

const clone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };

// ───────────── đọc mốc thời gian: chạy trong tiến trình con vì múi giờ là của cả tiến trình ─────────────
const PARSE_STR = ['2026-10-01', '2026-10', '2026', '2026-10-01T08:00', '2026-10-01T08:00:00', '2026-10-01T08:00:00.5', '2026-10-01T08:00:00.12',
  '2026-10-01T08:00:00.123', '2026-10-01T08:00:00.123456789Z', '2026-10-01T08:00:00.999999+00:00', '2026-10-01T08:00:00Z', '2026-10-01T08:00:00z',
  '2026-10-01t08:00:00Z', '2026-10-01t08:00:00', '2026-10-01T08:00:00+07:00', '2026-10-01T08:00:00+0700', '2026-10-01T08:00:00-0330', '2026-10-01T08:00:00+07',
  '2026-10-01 08:00:00', '2026-10-01 08:00', '2026-10-01 08:00:00Z', '2026-10-01 08:00:00+07:00', '2026-10-01 08:00:00.5', '2026-10-01 08:00:00.123456+00:00',
  '2026-10-01 08:00:00+0700', '2026-10-01T24:00:00', '2026-10-01T24:00', '2026-10-01T24:00:00.000Z', '2026-10-01T24:00:01', '2026-10-01T24:00:00.001',
  '2026-10-01T23:60:00', '2026-10-01T23:59:60', '2026-10-01T23:59:59.999Z', '2026-10-01T25:00:00Z', '2026-13-01', '2026-02-30', '2026-02-31T10:00:00Z',
  '2026-02-29', '2024-02-29', '2026-04-31', '2026-00-10', '2026-10-00', '2026-10-32', '2026-10-1', '2026-1-01', '2026/10/01', '20261001', '10/01/2026',
  '01/10/2026 08:00', 'Oct 1 2026', '1 Oct 2026 08:00:00 GMT+0700', 'Thu, 01 Oct 2026 01:00:00 GMT', '+002026-10-01T00:00:00Z', '+002026-10-01', '+002026-10-01T08:00',
  '-000001-01-01T00:00:00Z', '-000000-01-01T00:00:00Z', '+000000-01-01T00:00:00Z', '+275760-09-13T00:00:00.000Z', '+275760-09-13T00:00:00.001Z',
  '-271821-04-20T00:00:00.000Z', '-271821-04-19T23:59:59.999Z', '-271821-04-20T06:59:59.999Z', '-271821-04-20T07:00:00.000Z', '0000-01-01', '0001-01-01T00:00:00Z',
  '1969-12-31T23:59:59.999Z', '1970-01-01T00:00:00Z', '1900-01-01T00:00:00', '2040-06-15T12:30:45', ' 2026-10-01', '2026-10-01 ', '2026-10-01T08', '2026-10-01T08:00:00.',
  '2026-10-01T08:00:00,5Z', '2026-10-01T8:00:00Z', '2026-10-01T08:0:00Z', '2026-10-01T08:00:0Z', '2026-10-01T08:00:00 Z', '2026-10-01T08:00:00-00:30',
  '2026-10-01T08:00:00+24:00', '2026-10-01T08:00:00+23:59', '2026-10-01T08:00:00+07:60', '2026-10-01Z', '2026-10-01z', '2026-10Z', '2026Z', '2026-10-01+07:00',
  '2026-10-01-07:00', '2026-10T08:00', '2026-10T08:00Z', '2026T08:00', '2026T08:00:00Z', '2026-10-01T', '2026-10-01T08:00Z', '2026-10-01T08:00+07:00',
  '2026-10-01T08:00z', '2026-10-01T08:00:00.000ZZ', '2026-10-01T08:00:00.000Z ', '2026-10-01T08:00:00.000+07:00', '2026-10-01T08:00:00.1234567+00:00',
  '2026-10-01T08:00:00+7:00', '2026-10-01T08:00:00+07:0', '2026-10-01T08:00:00+070', '2026-10-01T08:00:00Z+07:00', 'abc', '', '0', '1', '12', '2026-W40', '1e3',
  '1759280400000', 'T08:00', '26-10-01', '99999-01-01', '02026-10-01', '2026-10-01T00:00:00.000Z', '2026-10-07T08:00:00.000Z', '2026-10-01TT08:00', '2026--10',
  '2026-10-', '2026-', '-2026-10-01', '+2026-10-01', '２０２６-10-01', '2026-10-01T08:00:00.１Z', 'true', 'null', '[object Object]', '2026,10', '2026-10-01,2026-10-02'];
const PARSE_VAL = [[2026, 10, 7], ["Oct", 7, 2026], ["2026-10-07 08:00"], true, 1, 0.5, 1759280400000, 1759280400000.7, -1.5, -0.5, 8.64e15, 8.64e15 + 1, -8.64e15, 1e300, [2026, 10], ['2026-10-01'], ['2026-10-01T08:00:00'],
  { a: 1 }, [], [5], [[1790841600000]]];
// Chuỗi dạng tự do (bộ đọc "legacy" của V8) và các giờ rơi vào lúc đổi giờ mùa hè
const PARSE_LEGACY = ["2026-10-07 08:00:00+07", "2026-10-07 08:00:00.123456+07", "2026-10-07 8:00", "2026-10-07 8:00:00", "2026-10-07  08:00", "2026-10-07 08:00 Z",
  "2026-1", "10000-01-01", "+10000-01-01", "2026.5", "-000000-01-01", "2026-10-07 08:00:00-0330", "2026-10-07 08:00:00+7", "2026-10-07 08:00:00+123", "2026-10-07 08:00:00+12345",
  "2026-10-07 08:00:00 +07:30", "2026-10-07 08:00:00 GMT+7", "2026-10-07 08:00:00 UTC", "2026-10-07 08:00:00 ut", "2026-10-07 08:00:00 est", "2026-10-07 08:00:00 PDT", "2026-10-07 08:00 pm",
  "2026-10-07 12:00 am", "2026-10-07 13:00 pm", "2026-10-07 08:00:00.5", "2026-10-07 08:00:00.0001234567891", "2026-10-07 08::", "2026-10-07 08:00:00:00", "2026-10-07 08:00:00.5.5",
  "2026-10-07 24:00", "2026-10-07 24:01", "2026-10-07 08:60", "Oct 7 2026", "7 Oct 2026", "October 7, 2026 08:00", "Octopus 7 2026", "Oct", "Oct 7", "7 Oct", "Oct-7-2026", "2026 Oct 7",
  "Wed Oct 07 2026 08:00:00 GMT+0700 (Indochina Time)", "Wed, 07 Oct 2026 01:00:00 GMT", "Wed Oct 07 2026", "10/07/2026", "13/07/2026", "32/07/2026", "7/10/26", "7/10/50", "7/10/99", "7/10/100",
  "1/2", "1/2/3", "1/2/3/4", "32", "32/1", "2026/10/07 08:00", "2026/10/07T08:00", "2026-10-07T8:00", "2026-10-07x", "x2026-10-07", "x 2026-10-07", "(abc) 2026-10-07", "2026-10-07 (abc)",
  "2026-10-07 (a(b)c) 08:00", "2026-10-07 )", "2026-10-07 +", "2026-10-07 -", "- 2026-10-07", "2026-10-07 08:00 +", "2026-10-07 08:00 -", "2026-10-07 08:00 + 7", "2026-10-07, 08:00",
  "2026-10-07 08.00", "2026-10-07 08:00.5", "08:00 2026-10-07", "08:00", "8", "2026-10-07 z", "2026-10-07 GMT", "2026-10-07 GMT+0700", "2026-10-07 UTC-1", "2026 10 07", "2026 10", "20261007 0800",
  "1791334800000", "123456789012", "999999-01-01", "1000000-01-01", "1000001-01-01", "275760-09-13", "275760-09-14", "+275760-09-13", "0-1-1", "00-1-1", "49-1-1", "50-1-1", "1-1-0",
  "2026-10-07" + String.fromCharCode(0xa0) + "08:00", "2026-10-07" + String.fromCharCode(9) + "08:00", "2026-10-07" + String.fromCharCode(10), "2026-10-07 08:00 " + String.fromCharCode(0xe9), String.fromCharCode(0xe9) + " 2026-10-07", "2026-10-07 08:00:00 +500000:00", "2026-10-07 08:00:00 +590000:00",
  "2026-10-07 08:00:00 +600000:00", "2026-10-07 08:00 jan", "jan feb 2026 3", "may 2026", "2026 may", "31 feb 2026", "feb 31 2026", "2026-02-31 00:00", "a.m. 2026-10-07", "2026-10-07 08:00 a.m.",
  "2026-10-07T08:00:00 ", "2026-10-07T08:00:00+07:00 ", "2026-10-07 08:00:00+07:00:00", "2026-10-07 08:00:00+07:60", "2026-10-07 08:00:00+07:5", "2026-10-07 08 00", "12 am", "2026-10-07 1 pm", "2026-10-07 1: pm",
  "2026-03-08T02:30:00", "2026-03-08T01:59:59.999", "2026-03-08T03:00:00", "2026-03-08 02:30", "2026-11-01T01:30:00", "2026-11-01T00:59:59", "2026-11-01T02:00:00", "2026-11-01 01:00",
  "2026-03-29T01:30:00", "2026-03-29T02:00:00", "2026-10-25T01:30:00", "2026-10-25T01:00:00", "2026-10-04T02:15:00", "2026-04-05T01:45:00", "2026-04-05T01:15:00", "1900-01-01 00:00", "1883-11-18T12:00:00"];
// Chuỗi ghép ngẫu nhiên (bộ sinh số cố định) từ các mảnh hay gặp trong chuỗi ngày giờ
function fuzzStrings() {
  let x = 20261013;
  const rnd = function (n) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return Math.floor(((x >>> 8) / 0x1000000) * n); };
  const F = ["2026", "10", "07", "7", "08", "8", "00", "30", "59", "60", "24", "12", "0", "123", "1234", "99", "50", "31", "32", "002026", "20261007", "-", "-", "/", ":", ":", ".", " ", " ", ",",
    "+", "T", "t", "Z", "z", "GMT", "UTC", "am", "pm", "Oct", "october", "feb", "est", "(", ")", "x", "07:00", "+07:00", "+0700", "-03", "T08:00", "08:00:00", "2026-10-07", "10/07/2026"];
  const out = [];
  for (let i = 0; i < 1500; i++) {
    let s = ""; const n = 1 + rnd(7);
    for (let j = 0; j < n; j++) s += F[rnd(F.length)];
    out.push(s);
  }
  return out;
}
function parseChild() {
  const out = { tz: process.env.TZ, off: new Date(1790841600000).getTimezoneOffset(), str: {}, val: [] };
  PARSE_STR.concat(PARSE_LEGACY, fuzzStrings()).forEach(function (s) { const d = new Date(s); out.str[s] = isNaN(d) ? null : d.getTime(); });
  PARSE_VAL.forEach(function (v) { const d = new Date(v); out.val.push({ v: v, ms: isNaN(d) ? null : d.getTime() }); });
  process.stdout.write(JSON.stringify(out));
}

// ───────────── baoCaoNhapSP trên dữ liệu giả ─────────────
let _id = 0;
function p(nguoi, ncc, ngayTao, ct, nganh, hm) {
  return { id: ++_id, ma_sp: 'M' + _id, ten_sp: 'SP ' + _id, nha_cung_cap: ncc, nguoi_tao: nguoi, ngay_tao: ngayTao, cong_ty_id: ct, nganh: nganh === undefined ? null : nganh, hang_muc: hm === undefined ? null : hm };
}
const CT1 = '11111111-1111-1111-1111-111111111111', CT2 = '22222222-2222-2222-2222-222222222222', CT3 = '33333333-3333-3333-3333-333333333333';
const USERS = [
  { id: 'u1', username: 'admin', ho_ten: 'Quản trị', phong_ban: 'Kỹ thuật', cong_ty_id: CT1 },
  { id: 'u2', username: ' Lan ', ho_ten: 'Nguyễn Thị Lan', phong_ban: null, cong_ty_id: CT1 },
  { id: 'u3', username: 'binh', ho_ten: null, phong_ban: '', cong_ty_id: CT2 },
  { id: 'u4', username: 'BINH', ho_ten: 'Bình (trùng tên, công ty khác)', phong_ban: 'Mua hàng', cong_ty_id: CT3 },
  { id: 'u5', username: '10', ho_ten: 'Số Mười', phong_ban: 'Kho', cong_ty_id: CT1 },
  { id: 'u6', username: null, ho_ten: 'Không tên đăng nhập', phong_ban: 'X', cong_ty_id: CT1 },
  { id: 'u7', username: 'ĐẠT', ho_ten: 'Đạt hoa', phong_ban: 'Thiết kế', cong_ty_id: CT2 }
];
const CTY = [{ id: CT1, ten: 'Công ty Một', ma: 'mot' }, { id: CT2, ten: null, ma: 'hai' }, { id: CT3, ten: '', ma: '' }];
function bigRows() {
  _id = 0;
  return [
    p('admin', 'NCC A', '2026-10-13T01:30:00+00:00', CT1, 'vs'),
    p('Admin', 'NCC B', '2026-10-12T16:59:59.999999+00:00', CT1, '', 'Sơn nội thất'),
    p(' admin ', ' NCC A ', '2026-10-12T17:00:00+00:00', CT1, null, 'Bồn cầu'),
    p('lan', '', '2026-10-11T03:00:00.5+00:00', CT1, 'den'),
    p('lan', null, '2026-10-10T03:00:00+00:00', CT1, 'ct'),
    p('LAN', '7', '2026-10-10T04:00:00+00:00', CT1, 'xyz'),
    p('10', 'NCC C', '2026-10-13T00:00:00+00:00', CT1),
    p('2', '12', '2026-10-13T00:10:00+00:00', CT1),
    p('zzz', '3', '2026-10-09T00:10:00+00:00', CT1),
    p('1', 'NCC A', '2026-10-09T00:10:00+00:00', CT1, 'son'),
    p('', 'NCC K', '2026-10-09T00:10:00+00:00', CT1),
    p(null, 'NCC K', '2026-10-09T00:10:00+00:00', CT1),
    p('   ', 'NCC K', '2026-10-09T00:10:00+00:00', CT2),
    p('binh', 'NCC A', '2026-10-13T02:00:00+00:00', CT2, 'son'),
    p('binh', 'NCC D', '2026-10-13T02:10:00+00:00', CT2, 'son'),
    p('đạt', '__proto__', '2026-10-13T02:10:00+00:00', CT2, 'ct'),
    p('Đạt', 'constructor', '2026-10-01T02:10:00+00:00', CT2, 'ct'),
    p('khach', 'NCC E', '2026-10-13T02:00:00+00:00', '99999999-9999-9999-9999-999999999999'),
    p('khach', 'NCC E', '2026-09-30T18:00:00+00:00', CT3),
    p('tudo', 'NCC F', '2026-10-13T02:00:00+00:00', null),
    p('tudo', 'NCC G', '2026-10-12T02:00:00+00:00', ''),
    p(null, 'NCC G', '2026-10-12T02:00:00+00:00', null),
    p('admin', 'NCC F', '2026-12-31T17:00:00+00:00', null, 'vs'),
    p(5, 6, '2026-10-12T02:00:00+00:00', null)
  ];
}
function protoNganh() {
  _id = 0;
  return ["constructor", " toString ", "__proto__", "valueOf", "hasOwnProperty", "constructor", "isPrototypeOf", "__defineGetter__", "toLocaleString", "Constructor", "den"].map(function (ng, i) {
    return p("admin", "NCC " + (i % 3), "2026-10-13T01:30:00+00:00", CT1, ng);
  });
}
function flowScenarios() {
  const NOW = Date.parse('2026-10-14T01:00:05.123Z');      // thứ 4, 08:00:05 giờ VN
  const ok0 = { json: { code: 0, msg: 'success' } };
  const base = function (o) { return Object.assign({ now: NOW, products: bigRows(), users: USERS, cty: CTY }, o); };
  const one = function () { _id = 0; return [p('admin', 'NCC A', '2026-10-13T01:30:00+00:00', CT1, 'vs')]; };
  return [
    base({ name: 'dryRun day du', opts: { dryRun: true } }),
    base({ name: 'dryRun = 1 (truthy)', opts: { dryRun: 1, tuVN: '2026-10-01T00:00:00.000Z' } }),
    base({ name: 'gui that - moi cong ty mot kieu tra loi', opts: {},
      fetch: [ok0, { json: { StatusCode: 0 } }, { json: { msg: 'success' } }, { json: { code: 19001, msg: 'param invalid' } }, { text: '<html>bad gateway</html>', status: 502 }] }),
    base({ name: 'gui that - opts undefined', fetch: [{ json: { code: '0' } }, { json: null }, { json: 'success' }, { json: 5 }, { json: { StatusMessage: 'x' } }] }),
    base({ name: 'gui that - opts null, chi the cuoi thanh cong', opts: null, fetch: [{ throw: 'boom' }, { json: [] }, { json: { code: 1 } }, { json: { code: 0 } }, { text: '', status: 200 }] }),
    base({ name: 'gui that - tat ca loi -> khong audit', opts: {}, fetch: [{ throw: 'x' }, { throw: 'x' }, { throw: 'x' }, { throw: 'x' }, { throw: 'x' }] }),
    base({ name: 'gui that - audit loi', opts: {}, fetch: [ok0, ok0, ok0, ok0, ok0], auditThrow: 'DB POST audit_log -> 500 {"message":"hong"}' }),
    base({ name: 'users + cong_ty loi', opts: { dryRun: true }, users: { throw: 'u' }, cty: { throw: 'c' } }),
    base({ name: 'san pham loi', opts: { dryRun: true }, products: { throw: 'DB GET db_san_pham -> 500 {"code":"XX000","message":"hỏng"}' } }),
    base({ name: 'khong co dong nao', opts: {}, products: [] }),
    base({ name: 'toan khuyet', opts: {}, products: (function () { _id = 0; return [p(null, 'A', '2026-10-13T01:30:00+00:00', CT1), p(' ', 'B', '2026-10-13T01:30:00+00:00', null)]; })() }),
    base({ name: 'mot nguoi mot ngay (khong co dong Tong cong)', opts: {}, products: one(), fetch: [ok0] }),
    base({ name: 'mot nguoi mot ngay dryRun', opts: { dryRun: true }, products: one() }),
    base({ name: 'tuVN khong hop le', opts: { tuVN: 'abc', dryRun: true }, products: one() }),
    base({ name: 'tuVN object', opts: { tuVN: { a: 1 }, dryRun: true }, products: one() }),
    base({ name: 'tuVN so', opts: { tuVN: 1790841600000, dryRun: true }, products: one() }),
    base({ name: 'tuVN true', opts: { tuVN: true, dryRun: true }, products: one() }),
    base({ name: 'tuVN 0 (falsy -> ky mac dinh)', opts: { tuVN: 0, dryRun: true }, products: one() }),
    base({ name: 'tuVN rong (falsy)', opts: { tuVN: '', dryRun: true }, products: one() }),
    base({ name: 'tuVN chi ngay', opts: { tuVN: '2026-10-07', dryRun: true }, products: one() }),
    base({ name: 'tuVN co mui gio', opts: { tuVN: '2026-10-07T08:00:00+07:00', dryRun: true }, products: one() }),
    base({ name: 'tuVN nam 5 chu so', opts: { tuVN: '+010000-01-01T00:00:00Z', dryRun: true }, products: one() }),
    base({ name: 'tuVN nam am', opts: { tuVN: '-000001-12-31T23:00:00Z', dryRun: true }, products: one() }),
    base({ name: 'tuVN sat day -> RangeError', opts: { tuVN: -8.64e15, dryRun: true }, products: one() }),
    base({ name: 'tuVN gui that', opts: { tuVN: '2026-09-30T08:00:00.000Z' }, products: one(), fetch: [ok0] }),
    base({ name: 'nguoi_tao = constructor', opts: { dryRun: true }, products: (function () { _id = 0; return [p('admin', 'A', '2026-10-13T01:30:00+00:00', CT1), p('constructor', 'B', '2026-10-12T20:30:00+00:00', CT1)]; })() }),
    base({ name: 'nguoi_tao = __proto__', opts: { dryRun: true }, products: (function () { _id = 0; return [p('__proto__', 'B', '2026-10-12T20:30:00+00:00', CT1)]; })() }),
    base({ name: 'nguoi_tao = toString', opts: {}, products: (function () { _id = 0; return [p('toString', 'B', '2026-10-12T20:30:00+00:00', null)]; })() }),
    base({ name: 'ngay_tao hong', opts: { dryRun: true }, products: (function () { _id = 0; return [p('admin', 'A', 'xx', CT1), p('admin', 'A', '2026-10-13T01:30:00+00:00', CT1), p('admin', 'B', null, CT1)]; })() }),
    base({ name: 'ngay_tao hong gui that', opts: {}, fetch: [ok0], products: (function () { _id = 0; return [p('admin', 'A', 'xx', CT1), p('lan', 'A', 1790841600000, CT1)]; })() }),
    base({ name: 'hai cong ty bang so SP -> giu thu tu gap', opts: { dryRun: true }, products: (function () { _id = 0; return [p('a', 'A', '2026-10-13T01:30:00+00:00', CT2), p('b', 'A', '2026-10-13T01:30:00+00:00', null), p('c', 'A', '2026-10-13T01:30:00+00:00', CT1), p('c', 'B', '2026-10-13T01:30:00+00:00', CT1), p('d', 'B', '2026-10-13T01:30:00+00:00', CT3)]; })() }),
    base({ name: "nganh trung ten Object.prototype dryRun", opts: { dryRun: true }, products: protoNganh() }),
    base({ name: "nganh trung ten Object.prototype gui that", opts: {}, fetch: [ok0], products: protoNganh() }),
    base({ name: "ten dang nhap co I cham va sigma", opts: { dryRun: true }, users: [{ username: "İbo", ho_ten: "Ibo Hoa", phong_ban: "A" }, { username: "ΌΣΟΣ", ho_ten: "Odysseas", phong_ban: "B" }],
      products: (function () { _id = 0; return ["i̇bo", "İBO", "ibo", "όσος", "ΌΣΟΣ", "όσοσ"].map(function (u, i) { return p(u, "N" + i, "2026-10-13T01:30:00+00:00", CT1); }); })() }),
    base({ name: "tuVN kieu Postgres", opts: { tuVN: "2026-10-07 08:00:00+07", dryRun: true }, products: one() }),
    base({ name: "tuVN kieu RFC 1123", opts: { tuVN: "Wed, 07 Oct 2026 01:00:00 GMT", dryRun: true }, products: one() }),
    base({ name: "tuVN dau cach truoc Z", opts: { tuVN: "2026-10-07 08:00 Z", dryRun: true }, products: one() }),
    base({ name: "tuVN tu la dinh so", opts: { tuVN: "x2026-10-07", dryRun: true }, products: one() }),
    base({ name: 'nam moi (VN da sang nam sau)', now: Date.parse('2026-12-31T18:30:00Z'), opts: {}, fetch: [ok0, ok0, ok0, ok0, ok0] })
  ];
}
async function runFlow(sc) {
  const clock = { t: sc.now };
  const rec = { selects: [], inserts: [], bodies: [], reqs: 0 };
  const tbl = { db_san_pham: sc.products, users: sc.users, cong_ty: sc.cty };
  const supa = {
    eq: function (c, v) { return c + '=eq.' + encodeURIComponent(v); },
    select: async function (t, opt) {
      rec.selects.push({ t: t, opt: opt });
      const v = tbl[t];
      if (v && v.throw) throw new Error(v.throw);
      return clone(v || []);
    },
    insert: async function (t, rows, opt) {
      if (sc.auditThrow) throw new Error(sc.auditThrow);
      rec.inserts.push({ t: t, rows: clone(rows), opt: opt });
      return rows;
    }
  };
  const fetch = async function (url, o) {
    const r = (sc.fetch || [])[rec.reqs++] || { json: { code: 0 } };
    rec.bodies.push(o.body);
    if (o.method !== 'POST' || o.headers['Content-Type'] !== 'application/json') throw new Error('request lạ');
    if (r.throw) throw new Error(r.throw);
    const text = r.text !== undefined ? r.text : JSON.stringify(r.json);
    return { status: r.status || 200, json: async function () { return JSON.parse(text); } };
  };
  const m = load({ store: storeLite(), supa: supa, fetch: fetch, Date: fakeDate(clock) });
  const out = {};
  try {
    const args = [{ r: 'super' }];
    if ('opts' in sc) args.push(sc.opts);
    const r = await m.baoCaoNhapSP.apply(null, args);
    out.result = JSON.stringify(r);
  } catch (e) { out.error = e.message; }
  const sp = rec.selects.filter(function (s) { return s.t === 'db_san_pham'; })[0];
  out.tuIsoArg = sp ? decodeURIComponent(sp.opt.filter.replace('ngay_tao=gte.', '')) : null;
  out.selects = rec.selects.map(function (s) { return s.t; });
  out.bodies = rec.bodies;
  out.audits = rec.inserts.map(function (i) { return JSON.stringify(i.rows); });
  return out;
}

function cardCases() {
  const m = load({ store: storeLite(), supa: {}, fetch: null });
  const T1 = Date.parse('2026-10-10T08:00:00Z'), T2 = Date.parse('2026-10-14T09:15:00Z');
  const ng = function (a, b, c) { return { ngay: a, soSP: b, soNCC: c }; };
  const cases = [
    { ten: 'A', bang: [{ ten: 'Lan', phongBan: '', tongSP: 3, tongNCC: 1, ngay: [ng('13/10', 3, 1)] }], tk: { tongSP: 3, tongNCC: 1, tongNguoi: 1, chuaGanCT: false }, tu: T1, den: T2, khuyet: 0, nganh: [] },
    { ten: 'B', bang: [{ ten: 'Lan', phongBan: 'Kho', tongSP: 3, tongNCC: 1, ngay: [ng('13/10', 2, 1), ng('12/10', 1, 0)] }], tk: { tongSP: 3, tongNCC: 1, tongNguoi: 1, chuaGanCT: true }, tu: T1, den: T2, khuyet: 4, nganh: null },
    { ten: 'C <b>&"x"', bang: [{ ten: 'Lan', phongBan: null, tongSP: 1, tongNCC: 0, ngay: [ng('13/10', 1, 0)] }, { ten: 'Bình', phongBan: 'P', tongSP: 1, tongNCC: 1, ngay: [ng('01/01', 1, 1)] }],
      tk: { tongSP: 2, tongNCC: 1, tongNguoi: 2, chuaGanCT: false }, tu: Date.parse('2026-12-31T23:59:59.999Z'), den: Date.parse('2027-01-01T00:00:00Z'), khuyet: 1,
      nganh: [{ ten: 'Thiết bị đèn', soSP: 1234567, soNCC: 0 }, { ten: 'Sơn nước', soSP: 1, soNCC: 1 }] },
    { ten: 'D', bang: [{ ten: 'Không ngày', phongBan: 'P', tongSP: 0, tongNCC: 0, ngay: [] }, { ten: 'X', phongBan: 'P', tongSP: 1, tongNCC: 1, ngay: [ng('05/02', 1, 1)] }],
      tk: { tongSP: 1, tongNCC: 1, tongNguoi: 2, chuaGanCT: false }, tu: T1, den: T2, khuyet: 0, nganh: [{ ten: 'Công tắc - ổ cắm', soSP: 1, soNCC: 1 }] }
  ];
  return cases.map(function (c) {
    return { in: c, out: JSON.stringify(m.buildSpReportCard(c.ten, c.bang, c.tk, new Date(c.tu), new Date(c.den), c.khuyet, c.nganh)) };
  });
}

function periodCases() {
  const clock = { t: 0 };
  const m = load({ store: storeLite(), supa: {}, fetch: null, Date: fakeDate(clock) });
  const ts = [];
  for (let t = Date.parse('2026-10-01T00:00:00Z'), i = 0; i < 60; i++, t += 9 * H + 37 * 60e3 + 1234) ts.push(t);
  // sát mốc 8h00 giờ VN của thứ 4 (14/10) và thứ 7 (17/10), nửa đêm VN, giao năm, năm nhuận
  ['2026-10-14T00:59:59.999Z', '2026-10-14T01:00:00.000Z', '2026-10-14T01:00:00.001Z', '2026-10-17T00:59:59.999Z', '2026-10-17T01:00:00.000Z', '2026-10-16T17:00:00.000Z',
    '2026-10-16T16:59:59.999Z', '2026-10-13T17:00:00.000Z', '2026-10-18T01:00:00.000Z', '2026-12-31T16:59:59.999Z', '2026-12-31T17:00:00.000Z', '2027-01-02T01:00:00.000Z',
    '2028-02-29T10:00:00.000Z', '2028-03-01T00:30:00.000Z', '1970-01-01T00:00:00.000Z', '2099-12-30T01:00:00.000Z'].forEach(function (s) { ts.push(Date.parse(s)); });
  return ts.map(function (t) {
    clock.t = t;
    const vn = m.nowVN_(), tu = m.moBaoCaoTruoc_(vn);
    return { now: t, vn: vn.getTime(), tu: tu.getTime(), tuIso: m.vnToUtcIso_(tu), ddmmTu: m.ddmm_(tu), ddmmVn: m.ddmm_(vn) };
  });
}

async function daGuiCases() {
  const list = [
    { now: '2026-10-14T01:00:00Z', rows: [{ id: 3, created_at: '2026-10-14T01:00:00.123456+00:00' }] },
    { now: '2026-10-14T01:00:00Z', rows: [{ id: 3, created_at: '2026-10-13T16:59:59.999999+00:00' }] },
    { now: '2026-10-14T01:00:00Z', rows: [{ id: 3, created_at: '2026-10-13T17:00:00+00:00' }] },
    { now: '2026-10-14T16:59:59.999Z', rows: [{ id: 9, created_at: '2026-10-10T01:00:00+00:00' }, { id: 3, created_at: '2026-10-13T17:00:00+00:00' }] },
    { now: '2026-10-14T17:00:00Z', rows: [{ id: 3, created_at: '2026-10-14T16:59:59+00:00' }] },
    { now: '2026-10-14T17:00:00Z', rows: [] },
    { now: '2026-10-14T01:00:00Z', rows: { throw: 'x' } },
    { now: '2026-10-14T01:00:00Z', rows: [{ id: 3, created_at: 'hong' }, { id: 2, created_at: '2026-10-14T01:00:00+00:00' }] },
    { now: '2026-10-14T01:00:00Z', rows: [{ id: 2, created_at: '2026-10-14T01:00:00+00:00' }, { id: 3, created_at: 'hong' }] },
    { now: '2026-10-14T01:00:00Z', rows: [{ id: 2, created_at: null }, { id: 3, created_at: '2026-10-14T01:00:00+00:00' }] },
    { now: '1970-01-01T01:00:00Z', rows: [{ id: 2, created_at: null }] },
    { now: '2026-10-14T01:00:00Z', rows: [{ id: 2 }, { id: 3, created_at: '2026-10-14T01:00:00+00:00' }] },
    { now: '2026-10-14T01:00:00Z', rows: [{ id: 2, created_at: 1790841600000 }, { id: 3, created_at: Date.parse('2026-10-14T00:00:00Z') }] }
  ];
  const out = [];
  for (const c of list) {
    const clock = { t: Date.parse(c.now) };
    const supa = { eq: function (a, b) { return a + '=eq.' + b; }, select: async function () { if (c.rows.throw) throw new Error(c.rows.throw); return clone(c.rows); } };
    const m = load({ store: storeLite(), supa: supa, fetch: null, Date: fakeDate(clock) });
    out.push({ now: clock.t, rows: c.rows, out: await m.daGuiBaoCaoHomNay_() });
  }
  return out;
}

async function pure() {
  const out = { period: periodCases(), parse: [], card: cardCases(), daGui: await daGuiCases(), flow: [] };
  ['UTC', 'Asia/Ho_Chi_Minh', 'America/St_Johns', 'America/New_York', 'Europe/London', 'Australia/Lord_Howe'].forEach(function (tz) {
    out.parse.push(JSON.parse(cp.execFileSync(process.execPath, [__filename, 'parse-child'], { env: Object.assign({}, process.env, { TZ: tz }), encoding: 'utf8' })));
  });
  for (const sc of flowScenarios()) out.flow.push({ in: sc, out: await runFlow(sc) });
  fs.writeFileSync(path.join(__dirname, 'golden_pure.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('golden_pure.json:', out.period.length, 'period,', out.parse.length, 'x', Object.keys(out.parse[0].str).length + PARSE_VAL.length, 'parse,', out.card.length, 'card,', out.daGui.length, 'daGui,', out.flow.length, 'flow');
}

// ───────────── kịch bản trên database thử ─────────────
/* Dữ liệu gieo nằm ở NĂM 2031 (seed.json) nên kỳ báo cáo bắt đầu từ 2031 chỉ thấy đúng các dòng của kịch bản,
   không phụ thuộc dữ liệu có sẵn hay dòng của người khác đang thử song song. */
async function db() {
  if (!/\/qspro_nodetest(\?|$)/.test(process.env.DATABASE_URL || '')) {
    console.error('Từ chối chạy: DATABASE_URL phải trỏ tới database thử qspro_nodetest');
    process.exit(2);
  }
  if (process.env.TZ !== 'UTC') { console.error('Từ chối chạy: đặt TZ=UTC để kết quả không phụ thuộc máy'); process.exit(2); }
  const supa = require(path.join(root, 'server', 'supa.js'));
  const store = require(path.join(root, 'server', 'store_supa.js'));
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
  const clock = { t: Date.parse(seed.now) };
  const rec = { bodies: [], n: 0 };
  const fetch = async function (url, o) {
    rec.bodies.push(o.body);
    const r = seed.fetch[rec.n++] || { json: { code: 0 } };
    return { status: 200, json: async function () { return r.json; } };
  };
  /* Bước "dữ liệu có sẵn": chỉ giữ sản phẩm của bản sao gốc (tạo trước 2026-10-09, không mang tiền tố ZZ) để dòng của
     người khác đang thử song song không làm lệch kết quả. Bên Go lọc y hệt (filterRepo trong service_test.go). */
  const flt = { on: false };
  const keep = function (r) { return String(r.ngay_tao) < '2026-10-09' && !/^zz/i.test(String(r.ma_sp)) && !/^zz/i.test(String(r.ten_sp)); };
  const supaF = Object.assign({}, supa, { select: async function (t, o) {
    const r = await supa.select(t, o);
    return flt.on && t === 'db_san_pham' ? r.filter(keep) : r;
  } });
  const m = load({ store: store, supa: supaF, fetch: fetch, Date: fakeDate(clock) });
  const out = { steps: [] };
  const step = async function (name, fn) {
    let o;
    try { o = { name: name, result: JSON.stringify(await fn()) }; } catch (e) { o = { name: name, error: e.message }; }
    out.steps.push(o);
  };
  const { Pool } = require(path.join(root, 'node_modules', 'pg'));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sweep = async function () {
    for (const q of seed.sweep) await pool.query(q);
  };
  await sweep();
  try {
    const ct = (await pool.query(seed.pickCompany)).rows[0];
    const us = (await pool.query(seed.pickUsers)).rows;
    out.fixture = { ct: ct, users: us };
    const rows = seed.products.map(function (r) {
      const o = Object.assign({}, r);
      o.cong_ty_id = r.cong_ty_id === '$CT' ? ct.id : null;
      o.nguoi_tao = r.nguoi_tao === '$U0' ? us[0].username : (r.nguoi_tao === '$U1' ? us[1].username.toUpperCase() : r.nguoi_tao);
      return o;
    });
    await supa.insert('db_san_pham', rows, { noScope: true });

    await step('ky 2031 dryRun', function () { return m.baoCaoNhapSP({ r: 'super' }, { tuVN: seed.tuVN, dryRun: true }); });
    await step('ky sau moi dong', function () { return m.baoCaoNhapSP({ r: 'super' }, { tuVN: '2032-01-01T00:00:00.000Z' }); });
    await step('daGui truoc khi gui', function () { return m.daGuiBaoCaoHomNay_(); });
    await step('ky 2031 gui that', function () { return m.baoCaoNhapSP({ r: 'super' }, { tuVN: seed.tuVN }); });
    out.bodies = rec.bodies.slice();
    const au = await supa.select('audit_log', { filter: 'action=eq.bao_cao_nhap_sp', order: 'id.desc', limit: 1, noScope: true });
    out.audit = au.map(function (r) { return { username: r.username, action: r.action, detail: r.detail, cong_ty_id: r.cong_ty_id, user_id: r.user_id }; });
    await step('daGui sau khi gui', function () { return m.daGuiBaoCaoHomNay_(); });
    // dòng audit do bước trên ghi mang giờ thật của database: thay bằng dòng có giờ cố định để thử ranh giới ngày
    await sweep();
    await supa.insert('db_san_pham', rows, { noScope: true });
    for (const a of seed.audits) {
      await supa.insert('audit_log', [{ username: 'hệ thống', action: 'bao_cao_nhap_sp', detail: 'ZZ_reports_ ' + a.note, created_at: a.at }], { noScope: true });
      for (const t of a.checks) {
        clock.t = Date.parse(t);
        await step('daGui ' + a.note + ' @' + t, function () { return m.daGuiBaoCaoHomNay_(); });
      }
      await pool.query(seed.sweep[1]);
    }
    clock.t = Date.parse(seed.now);
    await step('ky mac dinh (theo dong ho) dryRun', function () { return m.baoCaoNhapSP({ r: 'super' }, { dryRun: true }); });
    flt.on = true;
    await step('du lieu co san dryRun', function () { return m.baoCaoNhapSP({ r: 'super' }, { tuVN: '2026-01-01T00:00:00.000Z', dryRun: true }); });
    await step('du lieu co san tu 2026-10-01 dryRun', function () { return m.baoCaoNhapSP({ r: 'super' }, { tuVN: '2026-10-01T08:00:00.000Z', dryRun: true }); });
    flt.on = false;
  } finally {
    await sweep();
    await pool.end();
    await supa.close();
  }
  fs.writeFileSync(path.join(__dirname, 'golden_db.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('golden_db.json:', out.steps.length, 'bước');
}

if (mode === 'parse-child') parseChild();
else (mode === 'db' ? db() : pure()).catch(function (e) { console.error(e); process.exit(1); });
