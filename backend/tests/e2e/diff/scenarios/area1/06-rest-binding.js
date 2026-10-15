'use strict';
/* [khoảng trống B.med] REST /api/v1 của vùng 1 (auth, users, companies, notifications) với request SAI DẠNG - tầng nhận tham số chỉ có ở Go.
   Mọi bước là h.goOnly (so với kỳ vọng cố định của docs/API.md, xem scenarios/_restbind.js); không bước nào ghi dữ liệu.
   Dùng token tự ký của super mồi (luôn còn hiệu lực, qua mọi tầng quyền) để không phụ thuộc những gì các kịch bản trước đã đổi. */
const { fx, ID } = require('./_fx');
const { restBind, HTML, esc } = require('../_restbind');

module.exports = {
  name: 'area1/06 REST binding (chỉ Go)',
  async run(h) {
    await fx(h);
    const NOID = '00000000-0000-4000-8000-00000000dead';
    const root = h.session('super (token tự ký)', h.makeToken({ uid: ID.root, u: 'dx_root', r: 'super', ct: null, exp: Date.now() + 3600e3 }));
    await h.both(root, 'me', [], { label: 'me @super (token tự ký) - phiên dùng cho các bước chỉ Go bên dưới phải hợp lệ ở cả 2 phía' });

    /* ---------- cổng REST nói chung: đường dẫn không có, sai phương thức ---------- */
    const auth = { Authorization: h.pair('Bearer ' + root.token.node, 'Bearer ' + root.token.go) };
    for (const [m, p] of [['GET', '/api/v1'], ['GET', '/api/v1/khong-co'], ['POST', '/api/v1/khong-co'], ['GET', '/api/v1/users/' + NOID + '/khong-co'], ['GET', '/api/v2/users'], ['POST', '/api/v1/login'], ['POST', '/api/v1/me'], ['DELETE', '/api/v1/auth'], ['PATCH', '/api/v1/notifications']]) {
      for (const hd of [auth, {}])
        await h.goOnly(m + ' ' + p + (hd === auth ? '' : ' (chưa đăng nhập)') + ' -> 404', { method: m, path: p, headers: hd }, { status: 404, type: HTML, body: new RegExp('<pre>Cannot ' + m + ' ' + esc(p) + '</pre>') });
    }
    await h.goOnly('HEAD /api/v1/khong-co -> 404 không thân', { method: 'HEAD', path: '/api/v1/khong-co', headers: auth }, { status: 404 });
    // route của cổng rpc không nhận phương thức khác; REST không nhận tên hàm rpc
    await h.goOnly('POST /api/v1/adminListUsers (tên hàm rpc không phải route REST)', { method: 'POST', path: '/api/v1/adminListUsers', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: '{"args":[]}' }, { status: 404, type: HTML, body: /<pre>Cannot POST \/api\/v1\/adminListUsers<\/pre>/ });

    /* ---------- auth ---------- */
    await restBind(h, root, {
      writes: [{ method: 'POST', path: '/auth/change-password' }],
      reads: ['/auth/me?x=1&x=2', '/auth/me?token=abc', '/auth/me?%ZZ'],
      wrong: [{ method: 'DELETE', path: '/auth/me' }, { method: 'PUT', path: '/auth/login' }, { method: 'GET', path: '/auth/logout' }, { method: 'GET', path: '/auth/change-password' }],
    });
    // đăng nhập qua REST với thân hỏng: 400 trước khi vào hàm (không thử thân sai kiểu nhưng hợp lệ: lần đăng nhập hỏng có thể ghi nhật ký -> lệch database)
    for (const b of ['{"username":', '"dx_root"', 'null'])
      await h.goOnly('POST /api/v1/auth/login thân hỏng ' + JSON.stringify(b), { method: 'POST', path: '/api/v1/auth/login', headers: { 'Content-Type': 'application/json' }, body: b }, { status: 400, type: HTML, body: /<pre>Bad Request<\/pre>/ });

    /* ---------- users ---------- */
    await restBind(h, root, {
      writes: [{ method: 'PATCH', path: '/users/' + NOID }, { method: 'PUT', path: '/users/' + NOID + '/password' }, { method: 'PUT', path: '/users/' + NOID + '/active' }, { method: 'DELETE', path: '/users/' + NOID }, { method: 'POST', path: '/users' }],
      reads: ['/users?x=1&x=2', '/audit-log?limit=1&limit=2', '/audit-log?limit[]=3', '/audit-log?limit=%ZZ', '/audit-log?LIMIT=2', '/audit-log?limit='],
      slashes: ['/users/a%2Fb', '/users/%2F', '/users/' + NOID + '%2Fpassword', '/users//password'],
      wrong: [{ method: 'PUT', path: '/users' }, { method: 'POST', path: '/users/' + NOID }, { method: 'GET', path: '/users/' + NOID + '/password' }, { method: 'POST', path: '/audit-log' }],
    });

    /* ---------- companies ---------- */
    await restBind(h, root, {
      writes: [{ method: 'PATCH', path: '/companies/' + NOID }, { method: 'DELETE', path: '/companies/' + NOID }, { method: 'POST', path: '/companies/' + NOID + '/users' }, { method: 'POST', path: '/companies' }],
      reads: ['/companies?x=1&x=2', '/companies/' + NOID + '/users?a=1&a=2', '/companies/khong-phai-uuid/users'],
      slashes: ['/companies/a%2Fb/users', '/companies/%20/users'],
      wrong: [{ method: 'PUT', path: '/companies' }, { method: 'GET', path: '/companies/' + NOID }, { method: 'DELETE', path: '/companies' }, { method: 'PATCH', path: '/companies/' + NOID + '/users' }],
    });

    /* ---------- notifications ---------- */
    await restBind(h, root, {
      writes: [{ method: 'POST', path: '/notifications/999999999/read' }],
      reads: ['/notifications?limit=1&limit=2', '/notifications?limit[]=3', '/notifications?limit[a]=3', '/notifications/unread-count?x=1'],
      slashes: ['/notifications/a%2Fb/read'],
      wrong: [{ method: 'GET', path: '/notifications/999999999/read' }, { method: 'DELETE', path: '/notifications' }, { method: 'POST', path: '/notifications/unread-count' }, { method: 'GET', path: '/notifications/read-all' }],
    });
  },
};
