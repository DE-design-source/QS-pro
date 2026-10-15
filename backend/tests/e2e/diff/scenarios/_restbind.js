'use strict';
/* [khoảng trống B.med: tầng nhận tham số của REST /api/v1 chưa từng nhận request sai dạng]
   Route /api/v1 chỉ có ở Go nên các bước này dùng h.goOnly: chỉ gửi tới Go và so với kỳ vọng CỐ ĐỊNH của backend/docs/API.md:
     - thân JSON hỏng / không phải object-mảng  -> 400, trang HTML "Bad Request" (mục 1; body-parser chạy trước xác thực)
     - charset không hỗ trợ                      -> 415, trang HTML "Unsupported Media Type" (mục 4)
     - đường dẫn không có / sai phương thức      -> 404, trang HTML "Cannot <METHOD> <đường dẫn>" (mục 4)
     - chưa đăng nhập                            -> 401 {"error":"Chưa đăng nhập","code":"NOAUTH"} (mục 2)
     - thân hợp lệ nhưng không dùng được (mảng, sai Content-Type, không thân), query lặp khoá, "/" mã hoá trong :id: API.md không quy định
       kết quả từng route, nên chỉ đòi phong bì JSON của mục 2 ({"ok":true,...} hoặc {"error":"..."}), không phải trang 500 của panic.
   KHÔNG bước nào được ghi dữ liệu (database của Go phải tiếp tục giống của Node - bước so database cuối kịch bản sẽ báo nếu Go có ghi):
   route ghi chỉ được gọi với id / mã KHÔNG tồn tại hoặc thân chắc chắn bị từ chối. Vì vậy không đưa vào đây những route mà thân rỗng
   vẫn ghi được: POST /projects, PUT /projects/:id/data/:khoa, POST /projects/:id/lines(/blank), PUT /auth/me/prefs/:key, POST /auth/logout,
   POST /client-errors, POST /notifications/read-all, POST /purchase-orders, POST /proposals, POST /reports/new-products. */
const HTML = /text\/html/, JSON_T = /application\/json/;
const PANIC = /panic|runtime error|goroutine \d|Internal Server Error/;
const ENVELOPE = /^\{("ok":true|"error":")/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* sess: phiên dùng để gọi (token theo từng phía). writes: [{ method, path }] route ghi an toàn như mô tả trên (path tính từ sau /api/v1).
   reads: ['/đường-dẫn?query'] route GET thử với query lạ. wrong: [{ method, path }] phương thức KHÔNG đăng ký trên đường dẫn có thật. */
async function restBind(h, sess, cfg) {
  const tok = (side) => (sess.token && sess.token[side] !== undefined ? sess.token[side] : sess.token);
  const auth = (extra) => Object.assign({ Authorization: h.pair('Bearer ' + tok('node'), 'Bearer ' + tok('go')) }, sess.view != null ? { 'x-view-company': sess.view } : {}, extra || {});
  const jsonCt = { 'Content-Type': 'application/json' };
  for (const rt of cfg.writes || []) {
    const p = '/api/v1' + rt.path, lab = rt.method + ' ' + p;
    for (const b of ['{"a":', '"x"', '5', 'null', 'true', '{"a":1,}', '  \n '])
      await h.goOnly(lab + ' thân hỏng ' + JSON.stringify(b), { method: rt.method, path: p, headers: auth(jsonCt), body: b }, { status: 400, type: HTML, body: /<pre>Bad Request<\/pre>/ });
    await h.goOnly(lab + ' thân hỏng, chưa đăng nhập (400 trước 401)', { method: rt.method, path: p, headers: jsonCt, body: '{"a":' }, { status: 400, type: HTML, body: /<pre>Bad Request<\/pre>/ });
    await h.goOnly(lab + ' charset latin1', { method: rt.method, path: p, headers: auth({ 'Content-Type': 'application/json; charset=latin1' }), body: '{}' }, { status: 415, type: HTML, body: /Unsupported Media Type/ });
    await h.goOnly(lab + ' chưa đăng nhập', { method: rt.method, path: p, headers: jsonCt, body: '{}' }, { status: 401, type: JSON_T, body: /^\{"error":"Chưa đăng nhập","code":"NOAUTH"\}$/ });
    await h.goOnly(lab + ' token rác', { method: rt.method, path: p, headers: Object.assign({ Authorization: 'Bearer rac.rac' }, jsonCt), body: '{}' }, { status: 401, type: JSON_T, body: /^\{"error":"Chưa đăng nhập","code":"NOAUTH"\}$/ });
    for (const [ten, hd, b] of [['thân là mảng rỗng', jsonCt, '[]'], ['thân là mảng chứa object', jsonCt, '[{"a":1}]'], ['thân là object rỗng', jsonCt, '{}'], ['thân có khoá lạ + __proto__', jsonCt, '{"zzz":1,"__proto__":{"x":1},"constructor":"c"}'],
      ['Content-Type text/plain (thân bị bỏ qua)', { 'Content-Type': 'text/plain' }, '{"a":1}'], ['Content-Type form (thân bị bỏ qua)', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'a=1&b=2'], ['không thân', {}, undefined], ['thân rỗng', jsonCt, '']])
      await h.goOnly(lab + ' ' + ten, { method: rt.method, path: p, headers: auth(hd), body: b }, { status: [200, 400, 403, 404, 500], type: JSON_T, body: ENVELOPE, not: PANIC });
  }
  for (const q of cfg.reads || []) {
    const p = '/api/v1' + q;
    await h.goOnly('GET ' + p, { method: 'GET', path: p, headers: auth() }, { status: [200, 400, 403, 404, 500], type: JSON_T, body: ENVELOPE, not: PANIC });
    await h.goOnly('GET ' + p + ' chưa đăng nhập', { method: 'GET', path: p }, { status: 401, type: JSON_T, body: /^\{"error":"Chưa đăng nhập","code":"NOAUTH"\}$/ });
  }
  // "/" mã hoá (%2F) hoặc đoạn rỗng trong tham số đường dẫn: router có thể khớp hoặc không; không được là trang 500
  for (const p of cfg.slashes || [])
    await h.goOnly('GET /api/v1' + p + ' ("/" mã hoá / đoạn lạ trong tham số)', { method: 'GET', path: '/api/v1' + p, headers: auth() }, { status: [200, 400, 403, 404, 500], not: PANIC });
  for (const rt of cfg.wrong || []) {
    const p = '/api/v1' + rt.path;
    await h.goOnly(rt.method + ' ' + p + ' (sai phương thức)', { method: rt.method, path: p, headers: auth(jsonCt), body: rt.method === 'GET' || rt.method === 'HEAD' ? undefined : '{}' }, { status: 404, type: HTML, body: new RegExp('<pre>Cannot ' + rt.method + ' ' + esc(p) + '</pre>') });
  }
}
module.exports = { restBind, HTML, JSON_T, PANIC, ENVELOPE, esc };
