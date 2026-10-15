'use strict';
/* Sinh testdata/golden.json từ mã Node THẬT: server/lark.js và handler GET /media chép NGUYÊN VĂN từ server/index.js
   (trích theo dòng, gắn vào 1 app Express trống - không nạp index.js). Lark được thay bằng server HTTP giả chạy tại 127.0.0.1;
   không gọi Lark thật, không truy vấn database.
     DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
     PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x \
     node backend/internal/modules/files/testdata/gen.js */
if (!/qspro_nodetest/.test(process.env.DATABASE_URL || '')) { console.error('DATABASE_URL phải trỏ qspro_nodetest'); process.exit(2); }
const fs = require('fs');
const http = require('http');
const path = require('path');
const root = path.join(__dirname, '../../../../..');
const express = require(path.join(root, 'node_modules/express'));

// ---- Lark giả ----
let fake = null;        // hành vi hiện tại: { token: {status, body}, media: {status, ctype, b64} }
let seen = [];          // request Lark giả đã nhận
const larkSrv = http.createServer(function (req, res) {
  const chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    const body = Buffer.concat(chunks).toString('utf8');
    if (req.method === 'POST' && req.url === '/open-apis/auth/v3/tenant_access_token/internal') {
      seen.push(Object.assign({ method: req.method, url: req.url, contentType: req.headers['content-type'] || null, body: body }, fetchHdr(req)));
      res.writeHead(fake.token.status, { 'Content-Type': 'application/json' });
      return res.end(fake.token.body);
    }
    seen.push(Object.assign({ method: req.method, url: req.url, authorization: req.headers.authorization || null }, fetchHdr(req)));
    const h = {};
    if (fake.media.ctype != null) h['Content-Type'] = fake.media.ctype;      // mảng = nhiều dòng header
    if (fake.media.location) h.Location = fake.media.location;
    res.writeHead(fake.media.status, h);
    res.end(Buffer.from(fake.media.b64 || '', 'base64'));
  });
});

// Các header fetch của Node tự gắn
function fetchHdr(req) {
  const h = req.headers;
  return { userAgent: h['user-agent'] || null, accept: h.accept || null, acceptLanguage: h['accept-language'] || null, secFetchMode: h['sec-fetch-mode'] || null };
}

// Nạp lại lark.js + config.js với cấu hình mới (xoá cache module -> _token về null)
function loadLark(domain, appId, secret) {
  process.env.LARK_DOMAIN = domain; process.env.LARK_APP_ID = appId; process.env.LARK_APP_SECRET = secret;
  ['server/lark.js', 'server/config.js'].forEach(function (f) { delete require.cache[require.resolve(path.join(root, f))]; });
  return require(path.join(root, 'server/lark.js'));
}

const TOKEN_OK = { status: 200, body: JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 't-abc123', expire: 7200 }) };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 0, 255]).toString('base64');
const MEDIA_OK = { status: 200, ctype: 'image/png', b64: PNG };

// Kịch bản cho lark.mediaDownload: mỗi kịch bản 1 lần nạp module (cache token trống), các bước chạy nối tiếp
const SCENARIOS = [
  { name: 'tải được, token giữ lại cho lần sau', appId: 'cli_x', secret: 's3cr"et\\é', steps: [
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: 'boxcnABC' },
    { fake: { token: TOKEN_OK, media: { status: 200, ctype: 'image/jpeg; q=1', b64: 'AAEC' } }, fileToken: 'a/b c?d&é=#+%' },
    { fake: { token: TOKEN_OK, media: { status: 200, ctype: null, b64: '' } }, fileToken: 'khong-ctype' },
    { fake: { token: TOKEN_OK, media: { status: 404, ctype: 'application/json', b64: '' } }, fileToken: 'mat' },
    { fake: { token: TOKEN_OK, media: { status: 500, ctype: null, b64: '' } }, fileToken: '' },
    { fake: { token: TOKEN_OK, media: { status: 204, ctype: 'image/gif', b64: '' } }, fileToken: 'rong' }
  ] },
  { name: 'token sắp hết hạn (expire 30) -> xin lại mỗi lần', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: { status: 200, body: JSON.stringify({ code: 0, tenant_access_token: 't-ngan', expire: 30 }) }, media: MEDIA_OK }, fileToken: 'f1' },
    { fake: { token: { status: 200, body: JSON.stringify({ code: 0, tenant_access_token: 't-ngan2', expire: 61 }) }, media: MEDIA_OK }, fileToken: 'f2' },
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: 'f3' }
  ] },
  { name: 'expire thiếu / không phải số -> 7200', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: { status: 200, body: JSON.stringify({ code: 0, tenant_access_token: 't-macdinh', expire: 'abc' }) }, media: MEDIA_OK }, fileToken: 'f1' },
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: 'f2' }
  ] },
  { name: 'token lỗi rồi thử lại được', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: { status: 200, body: JSON.stringify({ code: 99991663, msg: 'app not found' }) }, media: MEDIA_OK }, fileToken: 'f1' },
    { fake: { token: { status: 400, body: JSON.stringify({ msg: 'thiếu code' }) }, media: MEDIA_OK }, fileToken: 'f1' },
    { fake: { token: { status: 200, body: JSON.stringify({ code: '0', msg: 'code là chuỗi' }) }, media: MEDIA_OK }, fileToken: 'f1' },
    { fake: { token: { status: 200, body: '[1,2]' }, media: MEDIA_OK }, fileToken: 'f1' },
    { fake: { token: { status: 500, body: JSON.stringify({ code: 0, expire: 100 }) }, media: MEDIA_OK }, fileToken: 'f1' },
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: 'f1' }
  ] },
  { name: 'fetch chuẩn hoá đoạn . và .. trong URL', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: '..' },
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: '.' },
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: '%2e%2e' },
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: '...' },
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: '../x' }
  ] },
  { name: 'thân token có BOM', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: { status: 200, body: '\uFEFF' + TOKEN_OK.body }, media: MEDIA_OK }, fileToken: 'f1' }
  ] },
  { name: 'token ngoài Latin-1 -> không gửi request media', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: { status: 200, body: JSON.stringify({ code: 0, tenant_access_token: 't\u1ed9', expire: 7200 }) }, media: MEDIA_OK }, fileToken: 'f1' }
  ] },
  { name: 'token Latin-1 gửi 1 byte mỗi ký tự, bỏ khoảng trắng cuối', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: { status: 200, body: JSON.stringify({ code: 0, tenant_access_token: 't\u00e9 \t', expire: 7200 }) }, media: MEDIA_OK }, fileToken: 'f1' }
  ] },
  { name: 'token có xuống dòng', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: { status: 200, body: JSON.stringify({ code: 0, tenant_access_token: 'a\r\nb', expire: 7200 }) }, media: MEDIA_OK }, fileToken: 'f1' }
  ] },
  { name: 'token không có tenant_access_token', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: { status: 200, body: JSON.stringify({ code: 0 }) }, media: MEDIA_OK }, fileToken: 'f1' }
  ] },
  { name: 'content-type lặp, chuyển hướng', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: TOKEN_OK, media: { status: 200, ctype: ['image/png', 'text/plain'], b64: 'AAEC' } }, fileToken: 'f1' },
    { fake: { token: TOKEN_OK, media: { status: 302, ctype: null, b64: '', location: '/open-apis/drive/v1/medias/vong/download' } }, fileToken: 'vong' }
  ] },
  { name: 'Lark không kết nối được', domain: 'http://127.0.0.1:9', appId: 'cli_x', secret: 'sec', steps: [
    { fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: 'f1' }
  ] },
  { name: 'thiếu LARK_APP_ID', appId: '', secret: 'sec', steps: [{ fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: 'f1' }] },
  { name: 'thiếu LARK_APP_SECRET', appId: 'cli_x', secret: '', steps: [{ fake: { token: TOKEN_OK, media: MEDIA_OK }, fileToken: 'f1' }] }
];

// Ca cho route GET /media (1 app Express, lark nạp 1 lần -> token giữ từ ca đầu)
const HTTP_CASES = [
  { url: '/media' },
  { url: '/media?token=' },
  { url: '/media?x=1&token' },
  { url: '/media?token=boxcnABC' },
  { url: '/media?token=boxcnABC', headers: { 'If-None-Match': '$ETAG' } },
  { url: '/media?token=boxcnABC', headers: { 'If-None-Match': '"khac", $ETAG' } },
  { url: '/media?token=boxcnABC', headers: { 'If-None-Match': '$ETAG_MANH' } },
  { url: '/media?token=boxcnABC', headers: { 'If-None-Match': '*' } },
  { url: '/media?token=boxcnABC', headers: { 'If-None-Match': '"khac"' } },
  { url: '/media?token=boxcnABC', headers: { 'If-None-Match': '$ETAG', 'Cache-Control': 'max-age=0, no-cache' } },
  { url: '/media?token=boxcnABC', headers: { 'If-None-Match': '$ETAG', 'If-Modified-Since': 'Wed, 21 Oct 2015 07:28:00 GMT' } },
  { url: '/media?token=boxcnABC', headers: { 'If-Modified-Since': 'Wed, 21 Oct 2015 07:28:00 GMT' } },
  { url: '/media?token=a%2Fb+c%20d&khac=1' },
  { url: '/media?token=%E0%A4%A' },
  { url: '/media?token=abc&token=def' },
  { url: '/media?token[]=x1' },
  { url: '/media?token%5B%5D=x1&token[]=x2' },
  { url: '/media?token[]=' },
  { url: '/media?token[0]=i0&token[1]=i1' },
  { url: '/media?token[k]=v' },
  { url: '/media?token[1001]=v' },
  { url: '/media?token=abc', media: { status: 200, ctype: 'text/plain', b64: 'eGluIGNow6Bv' } },
  { url: '/media?token=abc', media: { status: 200, ctype: 'application/json', b64: 'e30=' } },
  { url: '/media?token=abc', media: { status: 200, ctype: 'application/javascript; x=1', b64: 'MQ==' } },
  { url: '/media?token=abc', media: { status: 200, ctype: 'text/html; charset=gbk', b64: 'PGI+' } },
  { url: '/media?token=abc', media: { status: 200, ctype: 'application/pdf', b64: 'JVBERg==' } },
  { url: '/media?token=abc', media: { status: 200, ctype: null, b64: 'AAEC' } },
  { url: '/media?token=abc', media: { status: 200, ctype: 'image/png', b64: '' } },
  { url: '/media?token=abc', media: { status: 404, ctype: 'application/json', b64: 'e30=' } },
  { url: '/media?token=abc', media: { status: 500, ctype: null, b64: '' } },
  { url: '/media?token=abc', method: 'HEAD' },
  { url: '/media?token=..' },
  { url: '/media?token=%2e%2E' },
  { url: '/media?token=.' },
  { url: '/media?token=a#b' },
  { url: '/media?token=a%23b' },
  { url: '/media?x=1#&token=a' },
  { url: '/media?token[toString]=x' },
  { url: '/media?token=abc', media: { status: 200, ctype: ['image/png', 'text/plain'], b64: 'AAEC' } },
  { url: '/media?token=abc', media: { status: 200, ctype: ['text/plain', 'image/png'], b64: 'AAEC' } }
];

// Trích nguyên văn 1 handler `app.get('<route>', ...)` của server/index.js (tới dòng "});" đầu tiên ở cột 0)
function handlerSrc(route) {
  const lines = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8').split(/\r?\n/);
  const a = lines.findIndex(function (l) { return l.indexOf("app.get('" + route + "'") === 0; });
  if (a < 0) throw new Error('không thấy route ' + route);
  let b = a; while (lines[b] !== '});') b++;
  return lines.slice(a, b + 1).join('\n');
}

function request(port, c, etag) {
  return new Promise(function (resolve, reject) {
    const headers = {};
    Object.keys(c.headers || {}).forEach(function (k) {
      headers[k] = c.headers[k].replace('$ETAG_MANH', (etag || '').replace(/^W\//, '')).replace('$ETAG', etag || '');
    });
    const req = http.request({ host: '127.0.0.1', port: port, path: c.url, method: c.method || 'GET', headers: headers }, function (res) {
      const chunks = [];
      res.on('data', function (d) { chunks.push(d); });
      res.on('end', function () {
        const h = res.headers;
        resolve({ status: res.statusCode, contentType: h['content-type'] || null, cacheControl: h['cache-control'] || null,
          etag: h.etag || null, contentLength: h['content-length'] || null, b64: Buffer.concat(chunks).toString('base64') });
      });
    });
    req.on('error', reject); req.end();
  });
}

(async function () {
  await new Promise(function (r) { larkSrv.listen(0, '127.0.0.1', r); });
  const domain = 'http://127.0.0.1:' + larkSrv.address().port;
  const out = { lark: [], http: [], fresh: null };

  for (const sc of SCENARIOS) {
    const lark = loadLark(sc.domain || domain + '//', sc.appId, sc.secret);     // config.js cắt "/" cuối
    const steps = [];
    for (const st of sc.steps) {
      fake = st.fake; seen = [];
      let result;
      try { const m = await lark.mediaDownload(st.fileToken); result = { contentType: m.contentType, b64: m.buffer.toString('base64') }; }
      catch (e) { result = { error: e.message }; }
      steps.push({ fake: st.fake, fileToken: st.fileToken, result: result, requests: seen });
    }
    out.lark.push({ name: sc.name, domain: sc.domain || null, appId: sc.appId, secret: sc.secret, steps: steps });
  }

  const lark = loadLark(domain, 'cli_x', 'sec');
  const app = express();
  new Function('app', 'lark', handlerSrc('/media'))(app, lark);
  const srv = await new Promise(function (r) { const s = app.listen(0, '127.0.0.1', function () { r(s); }); });
  let etag = null;
  for (const c of HTTP_CASES) {
    fake = { token: TOKEN_OK, media: c.media || MEDIA_OK }; seen = [];
    const res = await request(srv.address().port, c, etag);
    if (c.url === '/media?token=boxcnABC' && !c.headers) etag = res.etag;
    const headers = {};
    Object.keys(c.headers || {}).forEach(function (k) {
      headers[k] = c.headers[k].replace('$ETAG_MANH', (etag || '').replace(/^W\//, '')).replace('$ETAG', etag || '');
    });
    out.http.push({ url: c.url, method: c.method || 'GET', headers: headers, media: fake.media, res: res,
      larkUrls: seen.filter(function (x) { return x.method === 'GET'; }).map(function (x) { return x.url; }) });
  }
  // Token chưa có trong cache: ?token[toString]=x vẫn xin tenant token trước khi encodeURIComponent ném lỗi
  srv.close();
  const app2 = express();
  new Function('app', 'lark', handlerSrc('/media'))(app2, loadLark(domain, 'cli_x', 'sec'));
  const srv2 = await new Promise(function (r) { const s = app2.listen(0, '127.0.0.1', function () { r(s); }); });
  fake = { token: TOKEN_OK, media: MEDIA_OK }; seen = [];
  const r2 = await request(srv2.address().port, { url: '/media?token[toString]=x' }, null);
  out.fresh = { url: '/media?token[toString]=x', res: r2, requests: seen };
  fs.writeFileSync(path.join(__dirname, 'golden.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('golden.json: ' + out.lark.length + ' kịch bản lark, ' + out.http.length + ' ca /media');
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
