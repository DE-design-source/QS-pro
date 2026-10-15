'use strict';
/* Chuẩn đối chiếu cho phần TẢI ẢNH của fetchImage (export.js:328-354), lấy từ MÃ NODE THẬT với fetch THẬT:
     DATABASE_URL=<qspro_nodetest> SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 PURCHASE_WEBHOOK=http://127.0.0.1:9/x \
     REPORT_WEBHOOK=http://127.0.0.1:9/x node gen-fetch.js > fetch.json
   (không chạm database; noderef.js vẫn đòi DATABASE_URL trỏ qspro_nodetest vì nạp store_supa.js).
   Không ra mạng: dns.lookup bị thay để MỌI tên miền trỏ về máy chủ thử trên 127.0.0.1.
     - href:  URL mà fetch gửi đi (new Request(url).url) hoặc null khi fetch từ chối URL;
     - sent:  dòng yêu cầu + header Host máy chủ thử nhận được qua exportBaoGia.fetchImage thật ({P} = cổng máy chủ thử);
     - enc:   thân trả lời nén theo Content-Encoding -> fetchImage có nhận ảnh không. */
const http = require('http');
const zlib = require('zlib');
const dns = require('dns');
const ref = require('./noderef');
const exp = ref.exportBaoGia();

const B = String.fromCharCode(92);
const HREF = [
  'https://h.example.com/img.php?name=my file.png', 'https://h.example.com/a?y=é+ư', 'https://fb.example.com/v0/b/x/o/folder%2Fmy file.png?alt=media',
  'https://cdn.example.com/100%.png', 'https://h.example.com/a%2', 'http://@cdn.example.com/v.png', 'http://:@cdn.example.com/v.png',
  'http://::@cdn.example.com/v.png', 'http://u@cdn.example.com/v.png', 'http://:p@cdn.example.com/v.png', 'http://a@b@cdn.example.com/v.png',
  'https://cdn.example.com/a/../b/./c.png', 'https://cdn.example.com:443/a.png', 'http://cdn.example.com:080/a.png', 'http://cdn.example.com:80/a.png',
  'https://cdn.example.com:80/a.png', 'http://cdn.example.com:443/a.png', 'http://cdn.example.com:/a.png', 'http://cdn.example.com:0/a.png',
  'http://cdn.example.com:00008080/a.png', 'http://cdn.example.com', 'http://cdn.example.com?x=1', 'http://cdn.example.com#f', 'http://cdn.example.com/?',
  'http://cdn.example.com/a' + B + 'b/..' + B + 'c/%2e%2E/d/.', 'http://cdn.example.com/a/%2e', 'http://cdn.example.com/a/..', 'http://cdn.example.com/x/../../..',
  'http://cdn.example.com/.%2E/x', 'http://cdn.example.com//b//', 'http://cdn.example.com/b/./', 'http://cdn.example.com/b/../', 'http://cdn.example.com/..a/.b/a../...',
  'http://cdn.example.com/^`{}|"<>~[]\'!$&()*+,;=:@ é%zz%2f%2F/x y', 'http://cdn.example.com/p?^`{}|"<>~[]\'!$&()*+,;=:@ é%zz/' + B + 'x#f',
  'http://cdn.example.com/\u0001\u007f\u0080?\u0001\u007f\u0080', 'http://cdn.example.com/ảnh sản phẩm/Gạch 60x60.PNG?t=1&tên=ư', 'http://cdn.example.com/a?b?c#d#e',
  'http://cdn.example.com/a#b?c', 'HTTP://CDN.Example.COM:8080/A.PNG?Q=1', 'http://cdn.example.com/😀.png?😀', '  http://cdn.example.com/a\tb\nc.png  ',
  'http://cdn.example.com/%7Ba%7D/%e1%ba%a3.png', 'http://cdn.example.com/a%20b+c', 'http://cdn.example.com/a;b=c/d,e'
];
// phần sau authority, gửi qua fetchImage thật tới máy chủ thử
const SENT = [
  '/a.png', '', '?x=1', '/img.php?name=my file.png', '/a?y=é+ư', '/v0/b/x/o/folder%2Fmy file.png?alt=media', '/100%.png', '/a%2', '/a/../b/./c.png',
  '//b//x.png', '/|a^b.png', '/a' + B + 'b.png?c' + B + 'd', '/^`{}|"<>~[]\'!$&()*+,;=:@ é%zz%2f%2F/x y', '/p?^`{}|"<>~[]\'!$&()*+,;=:@ é%zz/x#f',
  '/ảnh sản phẩm/Gạch 60x60.PNG?t=1&tên=ư', '/a%20b+c', '/redirect-abs', '/dir/redirect-rel'
];

const PNG = Buffer.from(require('./cases.json').png, 'base64');
const BIG = Buffer.alloc(6 * 1024 * 1024, 65);
PNG.copy(BIG);
const RAND = Buffer.alloc(5 * 1024 * 1024 - 10, 66);
PNG.copy(RAND);
const gz = zlib.gzipSync(PNG);
const ENC = [
  { n: 'gzip', enc: 'gzip', body: gz }, { n: 'x-gzip', enc: 'X-GZip', body: gz }, { n: 'deflate', enc: 'deflate', body: zlib.deflateSync(PNG) },
  { n: 'deflate-raw', enc: 'deflate', body: zlib.deflateRawSync(PNG) }, { n: 'gzip-gzip', enc: 'gzip, gzip', body: zlib.gzipSync(gz) },
  { n: 'deflate-gzip', enc: 'deflate,gzip', body: zlib.gzipSync(zlib.deflateSync(PNG)) }, { n: 'unknown', enc: 'gzip, foo', body: gz },
  { n: 'identity-gzip', enc: 'identity, gzip', body: gz }, { n: 'identity', enc: 'identity', body: PNG }, { n: 'br', enc: 'br', body: zlib.brotliCompressSync(PNG) },
  { n: 'gzip-truncated', enc: 'gzip', body: gz.subarray(0, gz.length - 6), noLen: true }, { n: 'gzip-bad', enc: 'gzip', body: PNG, noLen: true },
  // gzip-big: thân nén nhỏ, giải ra 6 MB. gzip-len-over: ảnh dưới 5 MB nhưng thân NÉN (content-length) vượt 5 MB.
  { n: 'gzip-big', enc: 'gzip', body: zlib.gzipSync(BIG), make: 'big' }, { n: 'gzip-len-over', enc: 'gzip', body: zlib.gzipSync(RAND, { level: 0 }), make: 'rand' },
  { n: 'plain', enc: '', body: PNG }, { n: 'plain-big', enc: '', body: BIG, noLen: true, make: 'big' }
];

let last = null, headers = null;
const srv = http.createServer(function (q, s) {
  last = { line: q.url, host: q.headers.host };
  if (!headers) headers = q.rawHeaders;
  const m = /^\/enc\/([\w-]+)$/.exec(q.url);
  if (m) {
    const c = ENC.find(function (x) { return x.n === m[1]; });
    const h = {};
    if (c.enc) h['content-encoding'] = c.enc;
    if (!c.noLen) h['content-length'] = c.body.length;
    s.writeHead(200, h); s.end(c.body); return;
  }
  if (q.url === '/redirect-abs') { s.writeHead(302, { location: '/moved/a.png?x=1' }); s.end(); return; }
  if (q.url === '/dir/redirect-rel') { s.writeHead(302, { location: 'b.png' }); s.end(); return; }
  s.writeHead(200, { 'content-length': PNG.length }); s.end(PNG);
});

const realLookup = dns.lookup;
dns.lookup = function (host, opts, cb) { return realLookup.call(dns, '127.0.0.1', opts, cb); };

srv.listen(0, '127.0.0.1', async function () {
  const P = srv.address().port, base = 'http://img.zz-quotations.example:' + P;
  const mask = function (s) { return String(s).split(':' + P).join(':{P}'); };
  const out = { href: [], sent: [], enc: [], headers: null };
  for (const u of HREF) {
    let href = null;
    try { href = new Request(u).url; } catch (e) { href = null; }
    out.href.push([u, href]);
  }
  for (const t of SENT) {
    last = null;
    const r = await exp.fetchImage(base + t);
    out.sent.push([t, last ? last.line : null, last ? mask(last.host) : null, !!r]);
  }
  for (const c of ENC) {
    const r = await exp.fetchImage(base + '/enc/' + c.n);
    // thân lớn không ghi vào file: bên Go dựng lại theo make (big = PNG + 'A' đủ 6 MB; rand = PNG + 'B' đủ 5 MB - 10, gzip mức 0)
    out.enc.push({ n: c.n, enc: c.enc, noLen: !!c.noLen, make: c.make || null, body: c.make ? null : c.body.toString('base64'), ok: !!r, ext: r ? r.ext : null });
  }
  out.headers = [];
  for (let i = 0; i < headers.length; i += 2) if (!/^(host|connection)$/i.test(headers[i])) out.headers.push([headers[i].toLowerCase(), headers[i + 1]]);
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  srv.close();
  process.exit(0);
});
