'use strict';
/* Sinh upload_route.json: POST /upload/file của Node THẬT (đoạn route cắt nguyên từ server/index.js, sau express.json
 * như I:19) với các request lạ: thân JSON, query không chuẩn, Content-Encoding. Kho file là bản giả ghi lại đúng các byte
 * mà fetch sẽ gửi (new Response(body) đổi body y như fetch). actorOf_ giả: có header Authorization là đã đăng nhập.
 *
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen_upload_route.js > upload_route.json
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const Module = require('module');
const ref = require('./noderef');

console.error = function () {};
const idx = path.join(ref.root, 'server', 'index.js');
const src = fs.readFileSync(idx, 'utf8');
const a = src.indexOf("app.post('/upload/file'"), b = src.indexOf('// Xuất 1 bảng do client dựng sẵn');
if (a < 0 || b < a) throw new Error('không tìm thấy route /upload/file trong index.js');
const express = Module.createRequire(idx)('express');

let up = null;
ref.supa.uploadToStorage = async function (buf, p, ct) {
  up = { hex: Buffer.from(await new Response(buf).arrayBuffer()).toString('hex'), path: p, ct: ct };
  return 'URL:' + p;
};
const app = express();
app.use(express.json({ limit: '30mb' }));
new Function('app', 'express', 'store', 'actorOf_', src.slice(a, b))(app, express, ref.store,
  async function (req) { return req.headers.authorization ? { uid: 'u', u: 'nv', r: 'staff' } : null; });

const PDF = Buffer.from('%PDF-1.4'), BOM = Buffer.from([0xef, 0xbb, 0xbf]), J = 'application/json', P = 'application/pdf';
const j = function (name, body, q) { return [name, q || '?name=a.pdf', { 'Content-Type': J }, Buffer.from(body)]; };
const q = function (query) { return ['query ' + query, query, { 'Content-Type': P }, PDF]; };
const cases = [
  ['json chỉ có BOM', '?name=a.pdf', { 'Content-Type': J }, BOM],
  ['json BOM + object', '?name=a.pdf', { 'Content-Type': J }, Buffer.concat([BOM, Buffer.from('{"length":2}')])],
  ['pdf chỉ có BOM', '?name=a.pdf', { 'Content-Type': P }, BOM],
  j('json mảng', '[1,2]'), j('json mảng rỗng', '[]'), j('json mảng lồng', '[null,{"a":1},[2,3],"x",true]'), j('json object', '{"a":1}'),
  j('json length số', '{"length":3}'), j('json length 0', '{"length":0}'), j('json length chuỗi', '{"length":"abc"}'), j('json length null', '{"length":null}'),
  j('json length quá lớn', '{"length":60000000}'), j('json length chuỗi số lớn', '{"length":"60000000"}'), j('json length true', '{"length":true}'),
  j('json length mảng', '{"length":[1]}'), j('json length object', '{"length":{}}'), j('json length âm', '{"length":-1}'),
  j('json mảng, đuôi lạ', '[1]', '?name=a.exe'), j('json mảng, chưa đăng nhập', '[1]'),
  q('?name=100%.pdf'), q('?name=a;b.pdf'), q('?name[]=a.pdf'), q('?name=a.pdf&name=b.pdf'), q('?name[1]=b.pdf&name[0]=a'), q('?name[x]=a.pdf'),
  q('?name=a+b.pdf'), q('?name=%E0%A4%A.pdf'), q('?name=a%2Bb.pdf'), q('?name'), q('?name[]=a&name=b.pdf'), q('?name=a&name[]=b.pdf'),
  q('?name%5B%5D=c.pdf'), q('?name[21]=a.pdf'), q('?name[0]=a&name[0]=b.pdf'), q('?name[]='), q('?x=1&name=a.zip'), q('?name=&name[]=a.pdf'),
  q('?name[]=a&name='), q('?name[]=a&name=b&name=c.pdf'), q('?name[2]=c.pdf&name[]=a&name[1]=b'), q('?name[=a.pdf'), q('?name[01]=a.pdf'),
  q('?name=a.pdf;x=1'), q('?name=%zz+a.pdf'), q('?Name=a.pdf'), q('?name[]x=a.pdf'), q('?a=1&&name=a.pdf&'), q(''),
  ['gzip', '?name=a.pdf', { 'Content-Type': P, 'Content-Encoding': 'gzip' }, zlib.gzipSync(PDF)],
  ['GZIP viết hoa', '?name=a.pdf', { 'Content-Type': P, 'Content-Encoding': 'GZIP' }, zlib.gzipSync(PDF)],
  ['deflate', '?name=a.pdf', { 'Content-Type': P, 'Content-Encoding': 'deflate' }, zlib.deflateSync(PDF)],
  ['identity', '?name=a.pdf', { 'Content-Type': P, 'Content-Encoding': 'identity' }, PDF],
  ['gzip hỏng', '?name=a.pdf', { 'Content-Type': P, 'Content-Encoding': 'gzip' }, PDF],
  ['gzip hỏng, chưa đăng nhập', '?name=a.pdf', { 'Content-Type': P, 'Content-Encoding': 'gzip' }, PDF],
  ['mã hoá lạ', '?name=a.pdf', { 'Content-Type': P, 'Content-Encoding': 'br' }, PDF],
  ['gzip rỗng', '?name=a.pdf', { 'Content-Type': P, 'Content-Encoding': 'gzip' }, zlib.gzipSync(Buffer.alloc(0))],
  ['gzip + json', '?name=a.pdf', { 'Content-Type': J, 'Content-Encoding': 'gzip' }, zlib.gzipSync(Buffer.from('[7,8]'))],
  ['gzip + json chỉ BOM', '?name=a.pdf', { 'Content-Type': J, 'Content-Encoding': 'gzip' }, zlib.gzipSync(BOM)]
];

function send(port, c) {
  return new Promise(function (resolve, reject) {
    const login = c[0].indexOf('chưa đăng nhập') < 0;
    const headers = Object.assign({ 'Content-Length': c[3].length }, c[2], login ? { Authorization: 'Bearer x' } : {});
    const req = http.request({ host: '127.0.0.1', port: port, method: 'POST', path: '/upload/file' + c[1], headers: headers }, function (res) {
      const parts = [];
      res.on('data', function (d) { parts.push(d); });
      res.on('end', function () {
        const body = Buffer.concat(parts).toString('utf8');
        resolve({ name: c[0], query: c[1], headers: c[2], login: login, bodyHex: c[3].toString('hex'), status: res.statusCode,
          // trang lỗi HTML của Express kèm stack: chỉ so mã trạng thái
          body: body.charAt(0) === '{' ? body.replace(/docs\/\d+-/g, 'docs/<ms>-') : null,
          up: up && { hex: up.hex, path: up.path.replace(/docs\/\d+-/, 'docs/<ms>-'), ct: up.ct } });
      });
    });
    req.on('error', reject);
    req.end(c[3]);
  });
}

const srv = app.listen(0, '127.0.0.1', async function () {
  const out = [];
  for (const c of cases) { up = null; out.push(await send(srv.address().port, c)); }
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  process.exit(0);
});
