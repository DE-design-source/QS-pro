'use strict';
/* Tự kiểm bộ so sánh (không cần server): phép chuẩn hoá phải BẮT được khác biệt thật và bỏ qua đúng thứ vốn khác;
   phép so database phải báo khi 1 dòng bị sửa / thiếu. Chạy SAU một lần run.ps1 (2 database đang giống nhau):
     NODE_DB=... GO_DB=... node backend/tests/e2e/diff/selftest.js     (làm bẩn qspro_gotest; run.ps1 lần sau sẽ reset) */
const { Pool } = require('pg');
const { Norm } = require('./lib/norm');
const { dbDiff } = require('./lib/dbdiff');
const { deepDiff } = require('./lib/xlsx');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  LỖI  ') + m); if (!c) fail++; };
const dbName = (u) => new URL(u).pathname.replace(/^\//, '');

(async () => {
  const n = new Norm(15000);
  const u1 = '11111111-1111-4111-8111-111111111111', u2 = '22222222-2222-4222-8222-222222222222', u3 = '33333333-3333-4333-8333-333333333333';
  const tok = (c) => c.repeat(60) + '.' + c.repeat(43);
  ok(n.diff('{"id":"' + u1 + '","at":"2026-10-13T08:00:00.123+00:00","token":"' + tok('a') + '"}', '{"id":"' + u2 + '","at":"2026-10-13T08:00:03.9+00:00","token":"' + tok('b') + '"}') === null, 'bỏ qua uuid mới, mốc thời gian lệch 3 giây, token');
  ok(n.diff('{"a":"' + u1 + '"}', '{"a":"' + u2 + '"}') === null, 'cặp uuid đã ghép vẫn khớp');
  ok(n.diff('{"a":"' + u1 + '"}', '{"a":"' + u3 + '"}') !== null, 'trả uuid của dòng KHÁC bị phát hiện');
  ok(n.diff('{"a":1,"b":2}', '{"b":2,"a":1}') !== null, 'thứ tự khoá khác bị phát hiện');
  ok(n.diff('{"a":1.0}', '{"a":1}') !== null, 'cách viết số khác bị phát hiện');
  ok(n.diff('{"at":"2026-10-13T08:00:00+00:00"}', '{"at":"2026-10-13T08:01:00+00:00"}') !== null, 'mốc thời gian lệch 60 giây bị phát hiện');
  ok(n.diff('{"at":"2026-10-13T08:00:00+00:00"}', '{"at":"2026-10-13T08:00:00Z"}') !== null, 'dạng viết múi giờ khác bị phát hiện');
  ok(n.diff('{"at":"2026-10-13T08:00:00+00:00"}', '{"at":null}') !== null, 'null thay cho mốc thời gian bị phát hiện');
  ok(n.diff('{"d":"2026-10-13"}', '{"d":"2026-10-14"}') !== null, 'ngày (không giờ) khác bị phát hiện');
  ok(n.diff('$2a$10$' + 'a'.repeat(53), '$2a$10$' + 'b'.repeat(53)) === null && n.diff('$2a$10$' + 'a'.repeat(53), '$2b$10$' + 'b'.repeat(53)) !== null && n.diff('$2a$10$' + 'a'.repeat(53), '$2a$12$' + 'b'.repeat(53)) !== null, 'bcrypt: bỏ qua phần băm, vẫn so phiên bản + cost');
  // UUID: giữ dạng chữ hoa / thường (server echo id nguyên văn client gửi)
  const ua = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', ub = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
  ok(n.diff('{"a":"' + ua + '"}', '{"a":"' + ub + '"}') === null && n.diff('{"a":"' + ua.toUpperCase() + '"}', '{"a":"' + ub.toUpperCase() + '"}') === null, 'cặp uuid đã ghép, cùng viết HOA vẫn khớp');
  ok(n.diff('{"a":"' + ua.toUpperCase() + '"}', '{"a":"' + ub + '"}') !== null, 'uuid viết HOA ở một phía, thường ở phía kia bị phát hiện');
  ok(n.diff('{"a":"AAAAAAAA-0000-4000-8000-000000000001"}', '{"a":"aaaaaaaa-0000-4000-8000-000000000001"}') !== null, 'cùng 1 uuid nhưng khác dạng chữ bị phát hiện');
  // Mã tự sinh: ghép cặp như uuid, mốc thời gian trong mã phải gần nhau
  const t36 = (ms) => ms.toString(36).toUpperCase(), now = Date.UTC(2026, 9, 13, 8, 0, 0);
  const mh1 = 'MH-' + t36(now) + '-12', mh2 = 'MH-' + t36(now + 900) + '-9871', mh3 = 'MH-' + t36(now + 1800) + '-5', mh4 = 'MH-' + t36(now + 2000) + '-77', mhXa = 'MH-' + t36(now + 3600e3) + '-1';
  ok(n.diff('{"ma":"' + mh1 + '"}', '{"ma":"' + mh2 + '"}') === null, 'mã MH- tự sinh (lệch 0,9 giây) được ghép cặp');
  ok(n.diff('{"a":"' + mh1 + '","b":"' + mh3 + '"}', '{"a":"' + mh2 + '","b":"' + mh4 + '"}') === null, 'cặp mã đã ghép + cặp mới vẫn khớp');
  ok(n.diff('{"ma":"' + mh1 + '"}', '{"ma":"' + mh4 + '"}') !== null, 'trả mã của ĐƠN KHÁC bị phát hiện');
  ok(new (n.constructor)(15000).diff('{"ma":"' + mh1 + '"}', '{"ma":"' + mhXa + '"}') !== null, 'mã có mốc thời gian lệch 1 giờ không được ghép');
  ok(new (n.constructor)(15000).diff('{"ma":"MH-AAAAAAAA-1"}', '{"ma":"MH-BBBBBBBB-1"}') !== null, 'chuỗi giống mã nhưng không phải mã tự sinh, khác nhau -> bị phát hiện');
  ok(n.diff('{"ma":"MH-AAAAAAAA-1"}', '{"ma":"MH-AAAAAAAA-1"}') === null, 'mã do kịch bản đặt, giống nhau 2 phía: giữ nguyên văn');
  ok(new (n.constructor)(15000).diff('{"ma":"DA-20261013-150001AB"}', '{"ma":"DA-20261013-150002X9"}') === null && new (n.constructor)(15000).diff('{"ma":"DA-20261013-150001AB"}', '{"ma":"DA-20261014-150001AB"}') !== null, 'mã DA-: ghép khi cùng giây lân cận, không ghép khi lệch 1 ngày');
  ok(new (n.constructor)(15000).diff('{"ma":"CK-' + t36(now) + '-1"}', '{"ma":"TT-' + t36(now) + '-1"}') !== null, 'mã khác tiền tố (CK / TT) không được ghép');
  // Mốc thời gian dạng toISOString: số chữ số phần giây lẻ phải giống
  ok(n.diff('{"at":"2026-10-13T08:00:00.123Z"}', '{"at":"2026-10-13T08:00:01.456Z"}') === null, 'dạng ...Z cùng 3 chữ số giây lẻ: khớp');
  ok(n.diff('{"at":"2026-10-13T08:00:00.123Z"}', '{"at":"2026-10-13T08:00:00.123456Z"}') !== null && n.diff('{"at":"2026-10-13T08:00:00.123Z"}', '{"at":"2026-10-13T08:00:00Z"}') !== null, 'dạng ...Z khác số chữ số giây lẻ bị phát hiện');
  ok(n.diff('{"at":"2026-10-13T08:00:00.12+00:00"}', '{"at":"2026-10-13T08:00:00.123456+00:00"}') === null, 'chuỗi của Postgres (cắt số 0 cuối): không so số chữ số');
  const t0 = Date.now(); n.diff('a'.repeat(3e6), 'a'.repeat(3e6)); ok(Date.now() - t0 < 3000, 'chuỗi 3 MB không làm treo biểu thức chính quy (' + (Date.now() - t0) + ' ms)');
  const d = []; deepDiff({ s: [{ cells: { A1: { value: 1, numFmt: '0.0' } } }] }, { s: [{ cells: { A1: { value: 1, numFmt: '0.00' } } }] }, 'wb', d, 9); ok(d.length === 1 && /numFmt/.test(d[0]), 'so xlsx: định dạng số khác bị phát hiện');

  if (process.env.NODE_DB && process.env.GO_DB) {
    if (dbName(process.env.NODE_DB) !== 'qspro_nodetest' || dbName(process.env.GO_DB) !== 'qspro_gotest') { console.error('Chỉ chạy trên qspro_nodetest / qspro_gotest'); process.exit(2); }
    const pools = { node: new Pool({ connectionString: process.env.NODE_DB }), go: new Pool({ connectionString: process.env.GO_DB }) };
    let r = await dbDiff(pools, new Norm(15000));
    ok(r.diffs.length === 0, 'database: 2 bên đang giống nhau (' + r.tables + ' bảng)');
    await pools.go.query("update audit_logs set detail = detail || ' ' where id = (select max(id) from audit_logs)");
    r = await dbDiff(pools, new Norm(15000));
    ok(r.diffs.length >= 1 && r.diffs[0].table === 'audit_logs', 'database: sửa 1 ký tự ở audit_logs bị phát hiện');
    await pools.go.query("update audit_logs set detail = rtrim(detail) where id = (select max(id) from audit_logs)");
    await pools.go.query("update users set permissions = 'x' where username = 'mai'");
    r = await dbDiff(pools, new Norm(15000));
    ok(r.diffs.length >= 1 && r.diffs.every((x) => x.table === 'users'), 'database: sửa 1 cột ở bảng khoá uuid (users) bị phát hiện');
    await pools.go.query('delete from notifications where id = (select max(id) from notifications)');
    r = await dbDiff(pools, new Norm(15000));
    ok(r.diffs.some((x) => x.table === 'notifications'), 'database: thiếu 1 dòng notifications bị phát hiện');
    await pools.node.end(); await pools.go.end();
  } else console.log('  (bỏ qua phần database: chưa đặt NODE_DB / GO_DB)');
  console.log(fail ? 'TỰ KIỂM: ' + fail + ' lỗi' : 'TỰ KIỂM: đạt');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
