'use strict';
/* Lõi của bộ so sánh vi sai Node <-> Go: gửi CÙNG một request tới 2 server, so mã HTTP, header liên quan và thân trả lời
   (chuỗi JSON thô: tính cả thứ tự khoá và cách viết số) sau khi chuẩn hoá giá trị vốn khác nhau (lib/norm.js);
   file .xlsx thì so bằng ExcelJS (lib/xlsx.js); sau mỗi kịch bản so trạng thái 2 database (lib/dbdiff.js). */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { Norm } = require('./norm');
const { dbDiff } = require('./dbdiff');
const xlsx = require('./xlsx');
const restMap = require('./rest-map');

// Giá trị khác nhau theo phía (id uuid mới sinh, token...): đặt ở bất kỳ đâu trong args / body / đường dẫn
class Pair { constructor(node, go) { this.node = node; this.go = go; } }
function resolve(v, side) {
  if (v instanceof Pair) return v[side];
  if (Buffer.isBuffer(v) || ArrayBuffer.isView(v)) return v;   // thân nhị phân: giữ nguyên
  if (Array.isArray(v)) return v.map((x) => resolve(x, side));
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[k] = resolve(v[k], side); }); return o; }
  return v;
}
const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const HEADERS = ['content-type', 'content-disposition', 'x-row-count', 'x-app-ver', 'cache-control', 'etag'];
const SIDES = ['node', 'go'];
/* Hàm trả danh sách xếp theo cột thời gian (đồng hồ máy chủ / Postgres có thể lùi -> thứ tự lệch giữa 2 phía).
   table + order: bảng và ORDER BY (tên trong database) mà hàm dùng; key / col: khoá của phần tử trả về và cột tương ứng (mặc định id);
   path: danh sách nằm ở result.<path> (mặc định chính result); self: không tra database, xếp theo chính trường đó của phần tử (giảm dần). */
const ORDERED = {
  getAuditLog: { table: 'audit_logs', order: 'created_at desc' }, notifList: { table: 'notifications', order: 'created_at desc' }, adminListUsers: { table: 'users', order: 'created_at' },
  listCongTyUsers: { table: 'users', order: 'created_at' }, listCongTy: { table: 'companies', order: 'created_at desc' }, listDeleteRequests: { table: 'delete_requests', order: 'created_at desc' },
  getProjects: { table: 'projects', order: 'created_at desc', key: 'maDA', col: 'project_code' },
  bootstrap: { table: 'projects', order: 'created_at desc', key: 'maDA', col: 'project_code', path: 'projects' },
  ctList: { table: 'work_items', order: 'quotation_type, sort_order, created_at' },
  ctHistory: { self: 'at' }, getProductHistory: { self: 'at' },
  listPurchaseRequests: { table: 'purchase_orders', order: 'sent_at desc', key: 'maDon', col: 'order_code' }, getPurchaseOrders: { table: 'purchase_orders', order: 'sent_at desc', key: 'maDon', col: 'order_code' },
  listDeXuat: { table: 'purchase_proposals', order: 'sent_at desc', key: 'ma', col: 'proposal_code' }, getDeXuatList: { table: 'purchase_proposals', order: 'sent_at desc', key: 'ma', col: 'proposal_code' },
};

class Harness {
  constructor(cfg) {
    this.cfg = cfg;
    this.url = { node: cfg.nodeUrl.replace(/\/+$/, ''), go: cfg.goUrl.replace(/\/+$/, '') };
    this.pools = { node: new Pool({ connectionString: cfg.nodeDb, max: 3 }), go: new Pool({ connectionString: cfg.goDb, max: 3 }) };
    this.norm = new Norm(cfg.tsTolMs);
    this.steps = []; this.scenario = ''; this.state = {}; this.lines = []; this.cover = {};
    this.anon = { label: 'chưa đăng nhập', token: null };
  }
  pair(node, go) { return new Pair(node, go); }
  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  out(s) {
    this.lines.push(s); if (this.cfg.verbose) console.log(s);
    if (this.cfg.progress) fs.appendFileSync(this.cfg.progress, s + '\n');   // ghi dần: lần chạy bị ngắt vẫn biết dừng ở bước nào
  }

  /* ---------- phiên ---------- */
  // token: chuỗi dùng chung, Pair, hoặc null. via: 'header' (mặc định) | 'body' | 'both'. view: x-view-company
  session(label, token, extra) { return Object.assign({ label, token: token == null ? null : token, via: 'header' }, extra || {}); }
  with(sess, extra) { return Object.assign({}, sess, extra); }
  // Tự ký token như auth.makeToken (để thử token hết hạn / sai chữ ký / payload lạ)
  makeToken(payload, secret) {
    const b64 = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const mk = (p) => { const body = b64(typeof p === 'string' ? p : JSON.stringify(p)); return body + '.' + b64(crypto.createHmac('sha256', secret || this.cfg.secret).update(body).digest()); };
    return new Pair(mk(resolve(payload, 'node')), mk(resolve(payload, 'go')));
  }

  /* ---------- gửi ---------- */
  async send(side, req) {
    const t0 = Date.now();
    let res;
    let buf;
    // Quá hạn (server treo) được ghi nhận là một kết quả, không làm treo cả lần chạy
    try {
      res = await fetch(this.url[side] + req.path, { method: req.method, headers: req.headers, body: req.body, redirect: 'manual', signal: AbortSignal.timeout(this.cfg.timeoutMs || 60000) });
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      /* Chỉ phía Node (tham chiếu): socket keep-alive bị server đóng đúng lúc fetch dùng lại -> ECONNRESET ngay, request chưa được xử lý.
         Gửi lại đúng 1 lần và ghi vào báo cáo; nếu Node đã xử lý rồi thì lần gửi lại làm lệch database và bước so database sẽ báo. */
      const code = e.cause && e.cause.code;
      if (side === 'node' && !req._retried && (code === 'ECONNRESET' || code === 'EPIPE' || code === 'UND_ERR_SOCKET') && Date.now() - t0 < 1000) {
        this.retries = (this.retries || 0) + 1;
        this.out('  lại  [node] ' + req.method + ' ' + req.path + ' (' + code + ' sau ' + (Date.now() - t0) + ' ms: gửi lại 1 lần)');
        const again = await this.send(side, Object.assign({}, req, { _retried: true }));
        again.retried = true;   // bước này được đánh dấu trong report.json: lần chạy có gửi lại không được coi là sạch hoàn toàn
        return again;
      }
      return { status: 0, headers: {}, buf: Buffer.alloc(0), text: 'LỖI KẾT NỐI: ' + (e.cause && e.cause.code || e.name + ' ' + e.message), json: undefined, ms: Date.now() - t0 };
    }
    const headers = {}; HEADERS.forEach((h) => { const v = res.headers.get(h); if (v !== null) headers[h] = v; });
    const text = buf.toString('utf8'); let json;
    try { json = JSON.parse(text); } catch (e) { json = undefined; }
    return { status: res.status, headers, buf, text, json, ms: Date.now() - t0 };
  }
  // Dựng request rpc POST /api/<fn> cho 1 phía
  rpcReq(side, sess, fn, args, opts) {
    opts = opts || {};
    const headers = Object.assign({}, resolve(opts.headers || {}, side));
    const tok = resolve(sess.token, side);
    let body;
    if (opts.rawBody !== undefined) body = resolve(opts.rawBody, side);
    else {
      const o = opts.body !== undefined ? resolve(opts.body, side) : (args === undefined ? {} : { args: resolve(args, side) });
      if (tok != null && (sess.via === 'body' || sess.via === 'both') && o && typeof o === 'object' && !Array.isArray(o)) o.token = sess.via === 'both' && sess.bodyToken !== undefined ? resolve(sess.bodyToken, side) : tok;
      body = JSON.stringify(o);
    }
    if (body !== undefined && body !== null && !('Content-Type' in headers)) headers['Content-Type'] = opts.ctype || 'application/json';
    if (headers['Content-Type'] === null) delete headers['Content-Type'];
    if (tok != null && sess.via !== 'body') headers.Authorization = (sess.scheme === undefined ? 'Bearer ' : sess.scheme) + tok;
    if (sess.view != null) headers['x-view-company'] = String(resolve(sess.view, side));
    return { method: opts.method || 'POST', path: opts.path || '/api/' + (opts.rawFn ? fn : encodeURIComponent(fn)), headers, body: body === null ? undefined : body };
  }
  restReq(side, sess, spec) {
    const headers = {};
    const tok = resolve(sess.token, side);
    if (tok != null) headers.Authorization = (sess.scheme === undefined ? 'Bearer ' : sess.scheme) + tok;   // scheme: thử các dạng viết tiền tố như cổng rpc
    if (sess.view != null) headers['x-view-company'] = String(resolve(sess.view, side));
    let p = '/api/v1' + spec.path;
    if (spec.query) p += '?' + Object.keys(spec.query).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(spec.query[k])).join('&');
    let body;
    if (spec.body !== undefined && spec.method !== 'GET') { body = JSON.stringify(spec.body); headers['Content-Type'] = 'application/json'; }
    return { method: spec.method, path: p, headers, body };
  }

  /* ---------- so ---------- */
  async compare(kind, node, go, opts) {
    const d = [];
    /* Mã HTTP phải bằng nhau ở MỌI loại bước, kể cả REST: lần chạy đầy đủ cho thấy REST của Go trả đúng mã của cổng rpc (500 cho lỗi
       nghiệp vụ) ở mọi hàm. Route REST nào cố ý trả mã khác thì bước đó phải khai báo opts.accept kèm lý do (hiện trong danh sách chấp nhận). */
    if (node.status !== go.status) d.push({ what: 'status', node: String(node.status), go: String(go.status) });
    /* Header được so: HEADERS (6 header mà client / trình duyệt dùng tới). x-app-ver: chỉ cổng /api/:fn gắn (API.md mục 2) nên bỏ qua ở bước REST. */
    HEADERS.forEach((h) => {
      if (kind === 'rest' && h === 'x-app-ver') return;   // header của riêng cổng /api/:fn
      const a = node.headers[h], b = go.headers[h];
      if (h === 'etag') {
        if (opts && opts.noEtag) return;   // HEAD của file .xlsx: thân không gửi về nên không biết có giống không
        if (!node.buf.equals(go.buf)) {
          // ETag tính từ thân: thân khác từng byte (id, token, mốc thời gian) thì giá trị tất nhiên khác, nhưng vẫn so CÓ / KHÔNG có header và DẠNG của nó
          const shape = (v) => (v === undefined ? '(không có)' : /^W\/"[0-9a-f]+-[A-Za-z0-9+\/]{27}"$/.test(v) ? 'W/"<độ dài>-<băm>"' : /^"[0-9a-f]+-[A-Za-z0-9+\/]{27}"$/.test(v) ? '"<độ dài>-<băm>"' : /^W\/"[0-9a-f]+-[0-9a-f]+"$/.test(v) ? 'W/"<cỡ>-<mtime>"' : v);
          if (shape(a) !== shape(b)) d.push({ what: 'header etag (có / không, dạng)', node: String(a), go: String(b) });
          return;
        }
      }
      if (a === b) return;
      if (a !== undefined && b !== undefined && !this.norm.diff(a, b)) return;
      d.push({ what: 'header ' + h, node: String(a), go: String(b) });
    });
    if ((node.buf.length || go.buf.length) && (xlsx.isXlsx(node.buf, node.headers['content-type']) || xlsx.isXlsx(go.buf, go.headers['content-type']))) {
      (await xlsx.diffXlsx(node.buf, go.buf)).forEach((m) => d.push({ what: 'xlsx', node: m, go: '' }));
    } else {
      const bd = this.norm.diff(node.text, go.text);
      if (bd) d.push({ what: 'body (từ ký tự ' + bd.at + ', dài ' + bd.len.join(' / ') + ')', node: bd.node, go: bd.go });
    }
    // opts.xlsxAt: đường dẫn tới chuỗi base64 của file xlsx nằm trong JSON (vd 'result.base64')
    if (opts && opts.xlsxAt && node.json && go.json) {
      const a = get(node.json, opts.xlsxAt), b = get(go.json, opts.xlsxAt);
      if (typeof a === 'string' && typeof b === 'string') {
        for (let i = d.length - 1; i >= 0; i--) if (/^body/.test(d[i].what)) d.splice(i, 1);
        // Phần còn lại của JSON (tên file, mimeType, thứ tự khoá) vẫn phải giống: thay chuỗi base64 bằng nhãn rồi so như mọi thân khác
        const strip = (r, v) => r.text.split(JSON.stringify(v)).join('"<XLSX base64>"');
        const bd2 = this.norm.diff(strip(node, a), strip(go, b));
        if (bd2) d.push({ what: 'body ngoài file xlsx (từ ký tự ' + bd2.at + ')', node: bd2.node.slice(0, 600), go: bd2.go.slice(0, 600) });
        (await xlsx.diffXlsx(Buffer.from(a, 'base64'), Buffer.from(b, 'base64'))).forEach((m) => d.push({ what: 'xlsx', node: m, go: '' }));
      }
    }
    return d;
  }
  record(kind, label, node, go, diffs, opts) {
    let state = diffs.length ? 'DIFF' : 'OK';
    // Luật chấp nhận chỉ che những loại chỗ khác mà nó nêu (accept.only): chỗ khác loại khác (vd header) vẫn làm bước thành KHÁC
    if (diffs.length && opts && opts.accept && (!opts.accept.only || diffs.every((x) => opts.accept.only.test(x.what))) && opts.accept.test(node, go)) state = 'ACCEPT';
    const st = { n: this.steps.length + 1, scenario: this.scenario, kind, label, status: [node.status, go.status], state, diffs, reason: state === 'ACCEPT' ? opts.accept.reason : '' };
    if (node.retried) st.retried = true;
    this.steps.push(st);
    this.out((state === 'OK' ? '  ok   ' : state === 'ACCEPT' ? '  chấp ' : '  KHÁC ') + '#' + st.n + ' [' + kind + '] ' + label + ' -> ' + node.status + (go.status !== node.status ? ' / ' + go.status : '') + (state === 'ACCEPT' ? '  (khác biệt có chủ ý: ' + st.reason + ')' : ''));
    if (state !== 'OK') diffs.forEach((x) => { this.out('         ' + x.what); this.out('           Node: ' + String(x.node).replace(/\n/g, '\\n')); this.out('           Go  : ' + String(x.go).replace(/\n/g, '\\n')); });
    if (state === 'DIFF' && !this.cfg.verbose) { console.log('  KHÁC #' + st.n + ' [' + this.scenario + '] [' + kind + '] ' + label + ' -> ' + node.status + ' / ' + go.status); diffs.forEach((x) => { console.log('      ' + x.what); console.log('        Node: ' + String(x.node).replace(/\n/g, '\\n').slice(0, 420)); console.log('        Go  : ' + String(x.go).replace(/\n/g, '\\n').slice(0, 420)); }); }
    return st;
  }
  result(node, go, st) {
    const r = { node, go, ok: st.state !== 'DIFF', status: node.status };
    // val('result.id') -> giá trị bên Node nếu 2 phía bằng nhau, ngược lại Pair (id uuid mới sinh)
    r.val = (p) => { const a = get(node.json, p), b = get(go.json, p); return JSON.stringify(a) === JSON.stringify(b) ? a : new Pair(a, b); };
    return r;
  }
  lab(sess, fn, args, opts) {
    if (opts && opts.label) return opts.label;
    let a = args === undefined ? '(không args)' : JSON.stringify(resolve(args, 'node'));
    if (a.length > 110) a = a.slice(0, 110) + '…';
    return fn + ' ' + a + ' @' + sess.label + (sess.view != null ? '+view' : '') + (sess.via && sess.via !== 'header' ? '+token-' + sess.via : '');
  }

  /* Danh sách xếp theo created_at: đồng hồ của Postgres (Docker Desktop) thỉnh thoảng LÙI gần 1 giây, khi đó thứ tự theo
     created_at lệch thứ tự chèn và lệch khác nhau ở 2 database (Node tự nó cũng không xác định). Chỉ khi thân khác nhau mới xét:
     chấp nhận nếu 2 phía trả CÙNG tập phần tử (sau chuẩn hoá) và mỗi phía xếp đúng theo created_at của database phía đó. */
  async orderOnly(fn, node, go) {
    const spec = ORDERED[fn];
    if (!spec || node.status !== go.status || !node.json || !go.json) return false;
    const list = (j) => (spec.path ? get(j.result, spec.path) : j.result);
    const a = list(node.json), b = list(go.json);
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    // phần còn lại của thân phải giống hệt; danh sách thì so như TẬP phần tử
    const canon = (side, j, arr) => {
      const items = arr.map((x) => this.norm.text(side, JSON.stringify(x))).sort().join('\n');
      if (!spec.path) return items;
      const c = JSON.parse(JSON.stringify(j)); let o = c.result; const ks = spec.path.split('.');
      for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
      o[ks[ks.length - 1]] = null;
      return this.norm.text(side, JSON.stringify(c)) + '\n' + items;
    };
    if (canon('node', node.json, a) !== canon('go', go.json, b)) return false;
    for (const [side, arr] of [['node', a], ['go', b]]) {
      let rk;
      if (spec.self) rk = arr.map((x) => -Date.parse(String(x && x[spec.self]).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')));
      else {
        const ids = arr.map((x) => String(x && x[spec.key || 'id'])), col = spec.col || 'id';
        const rows = (await this.pools[side].query('select ' + col + '::text id, dense_rank() over (order by ' + spec.order + ') rk from public."' + spec.table + '" where ' + col + '::text = any($1)', [ids])).rows;
        const at = new Map(rows.map((r) => [r.id, Number(r.rk)]));
        rk = ids.map((id) => at.get(id));
      }
      for (let i = 0; i < rk.length; i++) if (rk[i] === undefined || rk[i] !== rk[i] || (i && rk[i] < rk[i - 1])) return false;
    }
    return true;
  }
  /* getProjData đọc 2 bảng KHÔNG có ORDER BY rồi gộp thành object: thứ tự khoá theo thứ tự dòng mà Postgres trả về, bản Node tự nó
     cũng không xác định. Chỉ khi thân khác nhau mới xét: chấp nhận nếu cùng tập khoá và từng giá trị giống nhau (sau chuẩn hoá). */
  unorderedKeys(fn, node, go, diffs) {
    if (fn !== 'getProjData' || node.status !== go.status || !node.json || !go.json || diffs.length !== 1 || !/^body/.test(diffs[0].what)) return false;
    const a = node.json.result, b = go.json.result;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return false;
    const canon = (side, o) => Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + this.norm.text(side, JSON.stringify(o[k]))).join(',');
    return canon('node', a) === canon('go', b);
  }
  async finish(kind, fn, label, node, go, opts) {
    const diffs = await this.compare(kind, node, go, opts);
    if (diffs.length && !(opts && opts.accept) && this.unorderedKeys(fn, node, go, diffs))
      opts = Object.assign({}, opts, { accept: { only: /^body/, reason: 'Node không xác định: getProjData đọc không ORDER BY nên thứ tự khoá theo thứ tự dòng của Postgres (cùng tập khoá, cùng giá trị)', test: () => true } });
    // Độ phủ: mỗi hàm đã đi qua những kết cục nào (mã HTTP + thông báo lỗi của Node), và REST trả mã gì cho lỗi 500 của rpc
    const sig = node.status + ' ' + (node.json && typeof node.json.error === 'string' ? this.norm.text('node', node.json.error).replace(/\s+/g, ' ').slice(0, 110) : node.status === 200 ? 'ok' : '');
    const cv = this.cover[fn] = this.cover[fn] || {};
    const c = cv[sig] = cv[sig] || { rpc: 0, rest: 0, restStatus: {} };
    c[kind]++; if (kind === 'rest') c.restStatus[go.status] = (c.restStatus[go.status] || 0) + 1;
    if (diffs.length && !(opts && opts.accept) && diffs.every((x) => /^body/.test(x.what)) && await this.orderOnly(fn, node, go))
      opts = Object.assign({}, opts, { accept: { only: /^body/, reason: 'môi trường: đồng hồ lùi / mốc thời gian trùng -> thứ tự theo cột thời gian lệch thứ tự chèn (cùng tập dòng, mỗi phía đúng thứ tự database của mình)', test: () => true } });
    return this.result(node, go, this.record(kind, label, node, go, diffs, opts));
  }

  /* ---------- bước ---------- */
  // Cùng lời gọi POST /api/<fn> trên cả 2 server
  async rpc(sess, fn, args, opts) {
    const [node, go] = await Promise.all(SIDES.map((s) => this.send(s, this.rpcReq(s, sess, fn, args, opts))));
    return this.finish('rpc', fn, this.lab(sess, fn, args, opts), node, go, opts);
  }
  // Node: POST /api/<fn>; Go: route REST tương ứng. Không biểu diễn được bằng REST -> bỏ qua (trả null)
  async rest(sess, fn, args, opts) {
    const mk = (opts && opts.rest) || restMap[fn];
    if (!mk) throw new Error('Chưa khai báo REST cho ' + fn + ' (lib/rest-map.js)');
    const spec = typeof mk === 'function' ? mk(resolve(args || [], 'go')) : mk;
    if (!spec) { this.skipped = (this.skipped || 0) + 1; this.skippedBy = this.skippedBy || {}; this.skippedBy[fn] = (this.skippedBy[fn] || 0) + 1; this.out('  bỏ   [rest] ' + this.lab(sess, fn, args, opts) + ' (không biểu diễn được bằng REST)'); return null; }
    const [node, go] = await Promise.all([this.send('node', this.rpcReq('node', sess, fn, args, {})), this.send('go', this.restReq('go', sess, spec))]);
    return this.finish('rest', fn, this.lab(sess, fn, args, opts) + '  ~ ' + spec.method + ' ' + spec.path, node, go, opts);
  }
  // rpc rồi REST với cùng tham số (dùng cho lời gọi không đổi dữ liệu, hoặc gọi lại lần 2 vẫn cùng nhánh ở cả 2 phía)
  async both(sess, fn, args, opts) { const r = await this.rpc(sess, fn, args, opts); await this.rest(sess, fn, args, opts); return r; }
  // Request tuỳ ý (route lẻ, thân hỏng...) giống nhau trên 2 server
  async raw(label, req, opts) {
    const [node, go] = await Promise.all(SIDES.map((s) => this.send(s, resolve(req, s))));
    const st = this.record('raw', label, node, go, await this.compare('raw', node, go, opts), opts);
    return this.result(node, go, st);
  }
  // Đăng nhập trên cả 2 server -> phiên (token theo từng phía). So luôn payload của token.
  async login(label, username, password, opts) {
    const r = await this.rpc(this.anon, 'login', [username, password], Object.assign({ label: 'login ' + username + ' (' + label + ')' }, opts || {}));
    return this.tokenSession(label, username, r);
  }
  // Phiên từ kết quả đăng nhập + so payload của 2 token (giải mã phần đầu, exp lệch trong ngưỡng)
  tokenSession(label, username, r) {
    const tn = get(r.node.json, 'result.token'), tg = get(r.go.json, 'result.token');
    const sess = this.session(label, new Pair(tn, tg));
    sess.user = r.val('result.user'); sess.uid = r.val('result.user.id'); sess.ct = r.val('result.user.congTyId');
    if (tn && tg) {
      const dec = (t) => Buffer.from(String(t).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      const strip = (s) => s.replace(/"exp":\d{13}/, '"exp":<EXP>');
      const a = dec(tn), b = dec(tg), exp = (s) => Number((s.match(/"exp":(\d+)/) || [])[1]);
      const d = [];
      if (this.norm.diff(strip(a), strip(b))) d.push({ what: 'payload token', node: a, go: b });
      else if (Math.abs(exp(a) - exp(b)) > this.norm.tsTol) d.push({ what: 'exp của token', node: String(exp(a)), go: String(exp(b)) });
      this.record('token', 'payload token của ' + username + ' (' + label + ')', { status: 200 }, { status: 200 }, d);
    }
    return sess;
  }
  /* Đăng nhập: Node qua rpc, Go qua REST (POST /api/v1/auth/login). Token do REST của Go cấp được giải mã, so payload với token của Node,
     và phiên trả về dùng chính token đó cho các bước sau (token REST sai chữ ký / sai payload sẽ lộ ra ở các bước đó). */
  async loginRest(label, username, password) {
    const spec = restMap.login([username, password]);
    const [node, go] = await Promise.all([this.send('node', this.rpcReq('node', this.anon, 'login', [username, password], {})), this.send('go', this.restReq('go', this.anon, spec))]);
    const r = await this.finish('rest', 'login', 'login ' + username + ' (' + label + ')  ~ ' + spec.method + ' ' + spec.path, node, go);
    return this.tokenSession(label, username, r);
  }
  /* Chỉ gửi tới Go: route /api/v1 không có ở Node nên không có gì để so; kết quả được so với kỳ vọng CỐ ĐỊNH lấy từ backend/docs/API.md.
     expect: { status: số | mảng số, type?: RegExp cho Content-Type, body?: RegExp phải khớp, not?: RegExp không được khớp }.
     Bước này không được ghi dữ liệu (database 2 phía phải tiếp tục giống nhau): chỉ dùng request chắc chắn bị từ chối hoặc chỉ đọc. */
  async goOnly(label, req, expect) {
    const go = await this.send('go', resolve(req, 'go'));
    const d = [], want = [].concat(expect.status), ct = go.headers['content-type'] || '';
    const bad = (what, exp) => d.push({ what, node: 'kỳ vọng (API.md): ' + exp, go: go.status + ' ' + ct + ' ' + go.text.slice(0, 300) });
    if (want.indexOf(go.status) < 0) bad('status', want.join(' / '));
    if (expect.type && !expect.type.test(ct)) bad('header content-type', String(expect.type));
    if (expect.body && !expect.body.test(go.text)) bad('body', String(expect.body));
    if (expect.not && expect.not.test(go.text)) bad('body (không được khớp)', String(expect.not));
    const st = this.record('goonly', label, { status: go.status }, go, d);
    return { go, ok: st.state !== 'DIFF', status: go.status };
  }
  /* n lời gọi rpc GIỐNG HỆT NHAU gửi cùng lúc tới mỗi server (nhánh chỉ tới được khi 2 request chen nhau). Request nào thắng là ngẫu nhiên
     nên so TẬP kết quả: xếp các trả lời của từng phía theo (mã HTTP, thân đã chuẩn hoá) rồi so từng cặp. */
  async race(sess, fn, args, n, opts) {
    const one = (side) => Promise.all(Array.from({ length: n }, () => this.send(side, this.rpcReq(side, sess, fn, args, {}))));
    const [a, b] = await Promise.all(SIDES.map(one));
    const key = (side) => (r) => r.status + ' ' + this.norm.text(side, r.text);
    const sa = a.map((r) => ({ r, k: key('node')(r) })).sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : 0)), sb = b.map((r) => ({ r, k: key('go')(r) })).sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : 0));
    const d = [];
    for (let i = 0; i < n; i++) {
      if (sa[i].r.status !== sb[i].r.status) d.push({ what: 'status của trả lời #' + i + ' (sau khi xếp)', node: sa.map((x) => x.r.status).join(','), go: sb.map((x) => x.r.status).join(',') });
      else { const bd = this.norm.diff(sa[i].r.text, sb[i].r.text); if (bd) d.push({ what: 'body của trả lời #' + i + ' (sau khi xếp)', node: bd.node, go: bd.go }); }
    }
    const st = this.record('race', (opts && opts.label) || (n + ' lời gọi đồng thời ' + this.lab(sess, fn, args)), { status: sa[0].r.status }, { status: sb[0].r.status }, d, opts);
    return { node: a, go: b, ok: st.state !== 'DIFF' };
  }
  // Chạy cùng câu SQL trên 2 database (chỉ để dựng dữ liệu không tạo được qua API)
  async sql(text, params) {
    const [a, b] = await Promise.all(SIDES.map((s) => this.pools[s].query(text, resolve(params || [], s))));
    return new Pair(a.rows, b.rows);
  }
  // Ghi nhận một phép kiểm tự viết (vd so 2 giá trị đọc từ database)
  check(label, okFlag, node, go) {
    return this.record('check', label, { status: 200 }, { status: 200 }, okFlag ? [] : [{ what: 'giá trị', node: JSON.stringify(node), go: JSON.stringify(go) }]);
  }
  /* So những request mà 2 server đã gửi tới server giả (kho file / webhook Lark / Lark Open API) kể từ lần so trước:
     số request, thứ tự, method, đường dẫn, header do server tự đặt và thân (JSON: nguyên văn; nhị phân: sha256 + độ dài). */
  fakeCheck(label, opts) {
    const t = this.fake.take();
    const show = (list) => list.map((r) => r.method + ' ' + r.url + ' ' + JSON.stringify(r.headers) + ' ' + (/^sha256:/.test(r.body) ? 'len=' + r.len + ' ' : '') + r.body).join('\n');
    const a = show(t.node), b = show(t.go);
    const d = [];
    if (t.node.length !== t.go.length) d.push({ what: 'số request tới server giả', node: String(t.node.length), go: String(t.go.length) });
    const bd = this.norm.diff(a, b);
    if (bd) d.push({ what: 'request tới server giả (từ ký tự ' + bd.at + ')', node: bd.node, go: bd.go });
    if (opts && opts.count !== undefined && t.node.length !== opts.count) d.push({ what: 'số request phía Node khác dự kiến ' + opts.count, node: String(t.node.length), go: String(t.go.length) });
    this.record('fake', (label || 'request tới server giả') + ' (' + t.node.length + ' request)', { status: 200 }, { status: 200 }, d, opts);
    return t;
  }
  async dbCheck(label, tables) {
    const r = await dbDiff(this.pools, this.norm, tables);
    const diffs = r.diffs.map((x) => ({ what: 'bảng ' + x.table + ': ' + x.msg, node: x.node || '', go: x.go || '' }));
    // Chỉ có ghi chú "Node không xác định" (lib/dbdiff.js) mà không có chỗ khác thật: ghi là khác có chủ ý để hiện trong tổng kết
    if (!diffs.length && r.notes && r.notes.length)
      return this.record('db', (label || 'trạng thái database') + ' (' + r.tables + ' bảng)', { status: 200 }, { status: 200 }, r.notes.map((x) => ({ what: 'bảng ' + x.table + ': ' + x.msg, node: '', go: '' })),
        { accept: { reason: 'Node không xác định: getAdmins_ đọc không ORDER BY nên thứ tự admin nhận thông báo của một sự kiện tuỳ thứ tự dòng của Postgres (cùng tập người nhận)', test: () => true } });
    return this.record('db', (label || 'trạng thái database') + ' (' + r.tables + ' bảng)', { status: 200 }, { status: 200 }, diffs);
  }
  summary() {
    const by = {};
    this.steps.forEach((s) => { const b = by[s.scenario] = by[s.scenario] || { n: 0, diff: 0, accept: 0 }; b.n++; if (s.state === 'DIFF') b.diff++; if (s.state === 'ACCEPT') b.accept++; });
    const kinds = {}; this.steps.forEach((s) => { kinds[s.kind] = (kinds[s.kind] || 0) + 1; });
    return { by, kinds, total: this.steps.length, diff: this.steps.filter((s) => s.state === 'DIFF').length, accept: this.steps.filter((s) => s.state === 'ACCEPT').length, skipped: this.skipped || 0, skippedBy: this.skippedBy || {}, retries: this.retries || 0, retriedSteps: this.steps.filter((s) => s.retried).map((s) => s.n) };
  }
  writeReport(dir) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'report.txt'), this.lines.join('\n') + '\n');
    const cov = [];
    Object.keys(this.cover).sort().forEach((fn) => { cov.push(fn); Object.keys(this.cover[fn]).sort().forEach((sig) => { const c = this.cover[fn][sig]; cov.push('   ' + sig + '   [rpc ' + c.rpc + ', rest ' + c.rest + (c.rest ? ' -> ' + JSON.stringify(c.restStatus) : '') + ']'); }); });
    fs.writeFileSync(path.join(dir, 'coverage.txt'), cov.join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ summary: this.summary(), steps: this.steps.filter((s) => s.state !== 'OK' || s.retried) }, null, 1));
  }
  async close() { await Promise.all(SIDES.map((s) => this.pools[s].end())); }
}
module.exports = { Harness, Pair, resolve, get };
