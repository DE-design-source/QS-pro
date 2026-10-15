'use strict';
/* Server GIẢ chạy ngay trong tiến trình của bộ so sánh, thay cho 3 dịch vụ ngoài: kho file (Supabase Storage),
   webhook Lark (yêu cầu mua hàng / báo cáo) và Lark Open API (/media). Mỗi phía một CỔNG riêng (Node 4101, Go 4102)
   nên biết chắc request nào do server nào gửi; mọi request được ghi lại để so 2 phía với nhau.
   Cách trả lời đổi được giữa chừng bằng set(): { status, body, type } | 'drop' (cắt kết nối) | hàm (req) => như trên. */
const http = require('http');
const crypto = require('crypto');

const PORTS = { node: 4101, go: 4102 };
// header mà server CHỦ ĐỘNG đặt (header của tầng vận chuyển như user-agent, accept-encoding không so)
const KEEP = ['content-type', 'authorization', 'apikey', 'x-upsert'];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
// Đủ chữ ký JPEG (FF D8 FF) để server coi là ảnh; không cần giải mã được
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]), Buffer.alloc(64, 0x11), Buffer.from([0xff, 0xd9])]);

function defaults() {
  return {
    storage: { status: 200, body: '{"Key":"products/x"}', type: 'application/json' },
    hook: { status: 200, body: '{"code":0,"msg":"success"}', type: 'application/json' },
    report: { status: 200, body: '{"StatusCode":0,"StatusMessage":"success"}', type: 'application/json' },
    larkToken: { status: 200, body: JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 't-fake-1', expire: 7200 }), type: 'application/json' },
    larkMedia: (req) => {
      const tok = decodeURIComponent((/\/medias\/([^/]*)\/download/.exec(req.url) || [])[1] || '');
      if (tok === 'img-png') return { status: 200, body: PNG, type: 'image/png' };
      if (tok === 'img-jpg') return { status: 200, body: JPG, type: 'image/jpeg' };
      if (tok === 'png-sai-type') return { status: 200, body: PNG, type: 'text/html; charset=utf-8' };   // nhận ảnh theo chữ ký file, không theo Content-Type
      if (tok === 'jpg-khong-type') return { status: 200, body: JPG, type: null };
      if (tok === 'txt-utf8') return { status: 200, body: 'xin chào Lark', type: 'text/plain; charset=utf-8' };
      if (tok === 'no-type') return { status: 200, body: Buffer.from([1, 2, 3, 0, 255]), type: null };
      if (tok === 'empty') return { status: 200, body: '', type: 'application/pdf' };
      if (tok === 'big') return { status: 200, body: Buffer.alloc(300000, 7), type: 'application/octet-stream' };
      if (tok === 'err500') return { status: 500, body: 'lỗi', type: 'text/plain' };
      if (tok === 'err403') return { status: 403, body: '{"code":99991663}', type: 'application/json' };
      return { status: 404, body: '{"code":1061004,"msg":"not found"}', type: 'application/json' };
    },
  };
}

class Fake {
  constructor() { this.log = { node: [], go: [] }; this.mode = defaults(); this.servers = []; }
  set(key, val) { this.mode[key] = val; }
  reset() { this.mode = defaults(); }
  // lấy (và xoá) nhật ký request của 2 phía kể từ lần lấy trước
  take() { const out = { node: this.log.node, go: this.log.go }; this.log = { node: [], go: [] }; return out; }
  route(url) {
    if (url.indexOf('/storage/v1/object/') === 0) return 'storage';
    if (url.indexOf('/hook/report') === 0) return 'report';
    if (url.indexOf('/hook/') === 0) return 'hook';
    if (url.indexOf('/open-apis/auth/v3/tenant_access_token/internal') === 0) return 'larkToken';
    if (url.indexOf('/open-apis/drive/v1/medias/') === 0) return 'larkMedia';
    return null;
  }
  handle(side, req, res) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const headers = {}; KEEP.forEach((k) => { if (req.headers[k] !== undefined) headers[k] = req.headers[k]; });
      const isText = /json|text/.test(String(req.headers['content-type'] || '')) && buf.length < 200000;
      this.log[side].push({ method: req.method, url: req.url, headers, len: buf.length, body: isText ? buf.toString('utf8') : 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex') });
      const key = this.route(req.url);
      let m = key ? this.mode[key] : { status: 404, body: 'không có route giả', type: 'text/plain' };
      if (typeof m === 'function') m = m(req, buf);
      if (m === 'drop') { req.socket.destroy(); return; }
      const h = {}; if (m.type) h['Content-Type'] = m.type;
      Object.assign(h, m.headers || {});
      res.writeHead(m.status, h);
      res.end(m.body);
    });
  }
  async start() {
    for (const side of Object.keys(PORTS)) {
      const srv = http.createServer((req, res) => this.handle(side, req, res));
      await new Promise((ok, fail) => { srv.once('error', fail); srv.listen(PORTS[side], '0.0.0.0', ok); });
      this.servers.push(srv);
    }
  }
  async stop() { await Promise.all(this.servers.map((s) => new Promise((ok) => { s.closeAllConnections && s.closeAllConnections(); s.close(ok); }))); this.servers = []; }
}
module.exports = { Fake, PORTS, PNG, JPG };
