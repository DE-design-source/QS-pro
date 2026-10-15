'use strict';
/* Kiểm tra nhanh server Go đã nối đủ module, đối chiếu với server Node tham chiếu.
 * Cách chạy (hai server đang chạy trên HAI database thử, cùng AUTH_SECRET, cùng có tài khoản thử):
 *   node backend/tests/integration/smoke.js <url go> <url node> <admin> <staff> <mật khẩu>
 * Chỉ ĐỌC dữ liệu (login có ghi last_login + audit như thường lệ). Thoát mã 1 nếu có ca sai. */
const [GO, NODE, ADMIN, STAFF, PW] = process.argv.slice(2);
let fail = 0;
function ok(ten, dk, them) {
  if (!dk) fail++;
  console.log((dk ? 'OK   ' : 'FAIL ') + ten + (them ? '  ' + them : ''));
}
async function req(base, method, path, opt) {
  opt = opt || {};
  const h = Object.assign({}, opt.headers);
  if (opt.token) h.authorization = 'Bearer ' + opt.token;
  let body;
  if (opt.body !== undefined) { h['content-type'] = 'application/json'; body = JSON.stringify(opt.body); }
  const r = await fetch(base + path, { method: method, headers: h, body: body, redirect: 'manual' });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* không phải JSON */ }
  return { status: r.status, text: text, json: json, headers: r.headers };
}
const rpc = function (base, fn, args, token) { return req(base, 'POST', '/api/' + fn, { body: { args: args || [] }, token: token }); };
// bỏ các trường đổi theo thời điểm đăng nhập trước khi so
function boThoiDiem(s) { return s.replace(/"lastLogin":"[^"]*"/g, '"lastLogin":"*"').replace(/"token":"[^"]*"/g, '"token":"*"'); }

(async function () {
  // ---- sống + giao diện ----
  let g = await req(GO, 'GET', '/healthz');
  ok('GET /healthz', g.status === 200 && g.text === '{"ok":true}', g.status + ' ' + g.text);
  g = await req(GO, 'GET', '/');
  let n = await req(NODE, 'GET', '/');
  ok('GET / trả giao diện giống Node', g.status === 200 && /<script/i.test(g.text) && g.text === n.text,
    g.status + ' ' + g.text.length + ' byte (Node ' + n.text.length + ')');
  g = await req(GO, 'GET', '/app.js'); n = await req(NODE, 'GET', '/app.js');
  ok('GET /app.js giống Node', g.status === 200 && g.text === n.text && g.headers.get('cache-control') === n.headers.get('cache-control'),
    g.text.length + ' byte, cache-control ' + g.headers.get('cache-control'));

  // ---- đăng nhập ----
  const lg = await rpc(GO, 'login', [ADMIN, PW]);
  const ln = await rpc(NODE, 'login', [ADMIN, PW]);
  ok('POST /api/login (Go)', lg.status === 200 && lg.json && lg.json.ok && !!lg.json.result.token, String(lg.status));
  ok('POST /api/login (Node)', ln.status === 200 && ln.json && ln.json.ok && !!ln.json.result.token, String(ln.status));
  if (!lg.json || !lg.json.result || !ln.json || !ln.json.result) { console.log(lg.text.slice(0, 300)); process.exit(1); }
  ok('login: JSON giống Node (trừ token, lastLogin)', boThoiDiem(lg.text) === boThoiDiem(ln.text),
    Object.keys(lg.json.result).join(','));
  const tg = lg.json.result.token, tn = ln.json.result.token;
  const sg = (await rpc(GO, 'login', [STAFF, PW])).json.result.token;
  const sn = (await rpc(NODE, 'login', [STAFF, PW])).json.result.token;
  const bad = await rpc(GO, 'login', [ADMIN, 'sai-mat-khau']);
  const badN = await rpc(NODE, 'login', [ADMIN, 'sai-mat-khau']);
  ok('login sai mật khẩu giống Node', bad.status === badN.status && bad.text === badN.text, bad.status + ' ' + bad.text);

  // ---- 4 hàm qua RPC và qua REST, so với Node ----
  const ca = [['me', [], 'GET', '/api/v1/auth/me'], ['getProducts', [], 'GET', '/api/v1/products'],
    ['getProjects', [], 'GET', '/api/v1/projects'], ['bootstrap', [], 'GET', '/api/v1/bootstrap']];
  let maDA = null;
  for (const c of ca) {
    const a = await rpc(GO, c[0], c[1], tg);
    const b = await rpc(NODE, c[0], c[1], tn);
    const same = boThoiDiem(a.text) === boThoiDiem(b.text);
    ok('POST /api/' + c[0], a.status === 200 && a.json && a.json.ok === true && same,
      a.status + ', ' + a.text.length + ' byte, ' + (same ? 'giống Node từng byte' : 'KHÁC Node (' + b.text.length + ' byte)'));
    const r = await req(GO, c[2], c[3], { token: tg });
    ok(c[2] + ' ' + c[3], r.status === 200 && boThoiDiem(r.text) === boThoiDiem(a.text), r.status + ', ' + r.text.length + ' byte, ' +
      (boThoiDiem(r.text) === boThoiDiem(a.text) ? 'giống RPC' : 'KHÁC RPC'));
    if (c[0] === 'getProjects' && a.json && a.json.result && a.json.result[0]) maDA = a.json.result[0].maDA;
    if (c[0] === 'getProducts') ok('  getProducts có dữ liệu', Array.isArray(a.json.result) && a.json.result.length > 0, a.json.result.length + ' sản phẩm');
    if (c[0] === 'getProjects') ok('  getProjects có dữ liệu', Array.isArray(a.json.result), a.json.result.length + ' dự án');
    if (c[0] === 'bootstrap') ok('  bootstrap có khoá', !!a.json.result && typeof a.json.result === 'object', Object.keys(a.json.result).join(','));
    if (c[0] === 'me') ok('  me đúng tài khoản', a.json.result && JSON.stringify(a.json.result).indexOf(ADMIN) >= 0, '');
  }
  if (maDA) {
    for (const fn of ['bootstrap', 'getLines', 'getProjData', 'getCoverOrInit', 'getPurchaseOrders', 'getDeXuatList']) {
      const a = await rpc(GO, fn, [maDA], tg), b = await rpc(NODE, fn, [maDA], tn);
      ok('POST /api/' + fn + '(' + maDA + ')', a.status === b.status && a.text === b.text, a.status + ', ' + a.text.length + ' byte');
    }
    const r = await req(GO, 'GET', '/api/v1/projects/' + encodeURIComponent(maDA) + '/lines', { token: tg });
    const a = await rpc(GO, 'getLines', [maDA], tg);
    ok('GET /api/v1/projects/:id/lines', r.status === 200 && r.text === a.text, r.status + ', ' + r.text.length + ' byte');
  }
  for (const c of [['ctList', []], ['spMyPerms', []], ['notifCount', []], ['notifList', [5]], ['adminListUsers', []], ['getAuditLog', [3]],
    ['listPurchaseRequests', []], ['listDeXuat', []], ['listDeleteRequests', []]]) {
    const a = await rpc(GO, c[0], c[1], tg), b = await rpc(NODE, c[0], c[1], tn);
    // getAuditLog / adminListUsers mang thời điểm đăng nhập của chính lượt chạy này
    const chuan = function (s) { return boThoiDiem(s).replace(/"at":"[^"]*"/g, '"at":"*"').replace(/"id":\d+/g, '"id":0'); };
    ok('POST /api/' + c[0], a.status === b.status && chuan(a.text) === chuan(b.text), a.status + ', ' + a.text.length + ' byte');
  }

  // ---- token chéo ----
  const x1 = await rpc(GO, 'me', [], tn);
  ok('token của Node dùng được trên Go', x1.status === 200 && x1.json.result && boThoiDiem(x1.text) === boThoiDiem((await rpc(GO, 'me', [], tg)).text), String(x1.status));
  const x2 = await rpc(NODE, 'me', [], tg);
  ok('token của Go dùng được trên Node', x2.status === 200 && !!x2.json.result, String(x2.status));

  // ---- 401 / 403 / 404: cùng mã và cùng thân với dispatcher của Node ----
  const loi = [
    ['không token', 'getProjects', [], undefined, 401],
    ['token rác', 'getProjects', [], 'abc.def', 401],
    ['token sửa chữ ký', 'me', [], tg.slice(0, -2) + 'xx', 401],
    ['nhân viên gọi hàm admin', 'adminListUsers', [], 'STAFF', 403],
    ['nhân viên gọi hàm admin (không actor)', 'getAuditLog', [], 'STAFF', 403],
    ['admin gọi hàm super', 'listCongTy', [], 'ADMIN', 403],
    ['nhân viên gọi hàm super', 'baoCaoNhapSP', [{ dryRun: true }], 'STAFF', 403],
    ['hàm lạ', 'khongCoHamNay', [], 'ADMIN', 404],
    ['hàm lạ, không token', 'khongCoHamNay', [], undefined, 404],
    ['hàm lỗi nghiệp vụ', 'getDbProduct', ['zz-khong-co'], 'ADMIN', null],
    ['hàm lỗi nghiệp vụ 2', 'changePassword', ['sai', 'x'], 'ADMIN', 500]
  ];
  for (const c of loi) {
    const a = await rpc(GO, c[1], c[2], c[3] === 'STAFF' ? sg : c[3] === 'ADMIN' ? tg : c[3]);
    const b = await rpc(NODE, c[1], c[2], c[3] === 'STAFF' ? sn : c[3] === 'ADMIN' ? tn : c[3]);
    ok(c[0] + ' (' + c[1] + ')', a.status === b.status && a.text === b.text && (c[4] === null || a.status === c[4]),
      'Go ' + a.status + ' ' + a.text.slice(0, 90) + (a.text === b.text ? '' : '  | Node ' + b.status + ' ' + b.text.slice(0, 90)));
  }
  // token trong thân (index.js đọc req.body.token)
  const viaBody = await req(GO, 'POST', '/api/me', { body: { args: [], token: tg } });
  const viaBodyN = await req(NODE, 'POST', '/api/me', { body: { args: [], token: tn } });
  ok('token gửi trong thân', viaBody.status === viaBodyN.status && boThoiDiem(viaBody.text) === boThoiDiem(viaBodyN.text), String(viaBody.status));
  // route lẻ + đường dẫn lạ
  for (const c of [['POST', '/export/san-pham'], ['POST', '/export/cong-tac'], ['POST', '/export/bang'], ['POST', '/upload/file?name=a.pdf'],
    ['GET', '/media'], ['GET', '/khong-co'], ['POST', '/api'], ['GET', '/api/me'], ['GET', '/api/v1/khong-co']]) {
    const a = await req(GO, c[0], c[1], c[0] === 'POST' ? { body: {} } : {});
    const b = await req(NODE, c[0], c[1], c[0] === 'POST' ? { body: {} } : {});
    if (c[1] === '/api/v1/khong-co') { ok(c[0] + ' ' + c[1] + ' (chỉ Go)', a.status === 404, String(a.status)); continue; }
    ok(c[0] + ' ' + c[1] + ' không đăng nhập', a.status === b.status && a.text === b.text, 'Go ' + a.status + ' ' + a.text.slice(0, 70).replace(/\n/g, ' ') +
      (a.text === b.text ? '' : '  | Node ' + b.status + ' ' + b.text.slice(0, 70).replace(/\n/g, ' ')));
  }
  for (const p of ['/mau-nhap-thiet-bi-ve-sinh.xlsx', '/mau-nhap-son-nuoc.xlsx', '/mau-nhap-cong-tac-o-cam.xlsx']) {
    const a = await req(GO, 'GET', p), b = await req(NODE, 'GET', p);
    ok('GET ' + p, a.status === 200 && b.status === 200 && a.headers.get('content-disposition') === b.headers.get('content-disposition'),
      a.status + ' ' + a.headers.get('content-disposition'));
  }
  // REST: quyền
  let r = await req(GO, 'GET', '/api/v1/projects');
  ok('REST không token -> 401', r.status === 401 && r.text === '{"error":"Chưa đăng nhập","code":"NOAUTH"}', r.status + ' ' + r.text);
  r = await req(GO, 'GET', '/api/v1/users', { token: sg });
  ok('REST nhân viên gọi route admin -> 403', r.status === 403 && r.text === '{"error":"Không có quyền (chỉ Admin)"}', r.status + ' ' + r.text);
  r = await req(GO, 'GET', '/api/v1/companies', { token: tg });
  ok('REST admin gọi route super -> 403', r.status === 403 && r.text === '{"error":"Chỉ quản trị hệ thống"}', r.status + ' ' + r.text);
  r = await req(GO, 'POST', '/api/v1/auth/login', { body: { username: ADMIN, password: PW } });
  ok('REST POST /api/v1/auth/login', r.status === 200 && r.json && r.json.ok && !!r.json.result.token, String(r.status));

  // ---- swagger ----
  r = await req(GO, 'GET', '/api-docs.json');
  if (r.status === 200 && r.json) {
    const paths = Object.keys(r.json.paths);
    const nRpc = paths.filter(function (p) { return /^\/api\/[^/]+$/.test(p); }).length;
    let nRest = 0;
    paths.filter(function (p) { return p.indexOf('/api/v1/') === 0; }).forEach(function (p) { nRest += Object.keys(r.json.paths[p]).length; });
    ok('GET /api-docs.json', nRpc === 80 && nRest === 80 && paths.length - nRpc - paths.filter(function (p) { return p.indexOf('/api/v1/') === 0; }).length === 9,
      nRpc + ' path RPC, ' + nRest + ' thao tác REST, ' + paths.length + ' path');
    const ui = await req(GO, 'GET', '/api-docs/');
    const js = await req(GO, 'GET', '/api-docs/swagger-ui-bundle.js');
    ok('GET /api-docs/ (Swagger UI nhúng sẵn)', ui.status === 200 && /SwaggerUIBundle/.test(ui.text) && js.status === 200 && js.text.length > 1e5,
      ui.status + ', bundle ' + js.text.length + ' byte');
  } else ok('GET /api-docs.json', false, 'trả ' + r.status + ' (SWAGGER_DOCS / NODE_ENV đang tắt?)');

  console.log(fail ? '\n' + fail + ' ca SAI' : '\nTất cả đều đạt');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
