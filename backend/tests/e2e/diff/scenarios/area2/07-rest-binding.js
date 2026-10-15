'use strict';
/* [khoảng trống B.med] REST /api/v1 của vùng 2 (projects, takeoff, quotations, estimates) với request SAI DẠNG - tầng nhận tham số chỉ có ở Go.
   Mọi bước là h.goOnly (so với kỳ vọng cố định của docs/API.md, xem scenarios/_restbind.js); không bước nào ghi dữ liệu:
   route ghi chỉ gọi với mã dự án / id KHÔNG tồn tại. Không có ở đây (thân rỗng vẫn ghi được): POST /projects, PUT .../data/:khoa,
   POST .../lines, POST .../lines/blank; GET .../cover (getCoverOrInit có thể khởi tạo tờ bìa). */
const { fx } = require('./_fx');
const { restBind } = require('../_restbind');

module.exports = {
  name: 'area2/07 REST binding (chỉ Go)',
  async run(h) {
    const f = await fx(h), S = f.S;
    const NOID = '00000000-0000-4000-8000-00000000dead', MA = 'KHONG-CO-REST';
    await h.both(S.root, 'me', [], { label: 'me @super - phiên dùng cho các bước chỉ Go bên dưới phải hợp lệ ở cả 2 phía' });

    /* ---------- projects ---------- */
    await restBind(h, S.root, {
      writes: [{ method: 'PATCH', path: '/projects/' + MA }, { method: 'DELETE', path: '/projects/' + MA }, { method: 'POST', path: '/projects/' + MA + '/duplicate' }],
      reads: ['/projects?x=1&x=2', '/bootstrap?maDA=a&maDA=b', '/bootstrap?maDA[]=a', '/bootstrap?maDA[x]=a', '/bootstrap?maDA=', '/bootstrap?MADA=' + MA, '/projects/' + MA + '/data?x=1&x=2'],
      slashes: ['/projects/a%2Fb/data', '/projects/%2F/data', '/projects//data', '/projects/%20/data', '/projects/' + MA + '%2Fdata'],
      wrong: [{ method: 'PUT', path: '/projects' }, { method: 'GET', path: '/projects/' + MA }, { method: 'DELETE', path: '/projects' }, { method: 'POST', path: '/bootstrap' }, { method: 'GET', path: '/projects/' + MA + '/duplicate' }, { method: 'POST', path: '/projects/' + MA + '/data' }],
    });

    /* ---------- takeoff ---------- */
    await restBind(h, S.root, {
      writes: [{ method: 'PATCH', path: '/lines/999999999' }, { method: 'DELETE', path: '/lines/999999999' }, { method: 'POST', path: '/lines/save-as-product' }],
      reads: ['/projects/' + MA + '/lines?x=1&x=2', '/projects/' + MA + '/lines?id[]=1'],
      slashes: ['/projects/a%2Fb/lines', '/projects/%2F/lines'],
      wrong: [{ method: 'GET', path: '/lines/999999999' }, { method: 'POST', path: '/lines/999999999' }, { method: 'PUT', path: '/projects/' + MA + '/lines' }, { method: 'GET', path: '/lines/save-as-product/x' }],
    });

    /* ---------- quotations ---------- */
    await restBind(h, S.root, {
      writes: [{ method: 'PUT', path: '/projects/' + MA + '/cover' }, { method: 'POST', path: '/projects/' + MA + '/quotation/export' }],
      reads: ['/projects/' + MA + '/cover/template?x=1&x=2'],
      slashes: ['/projects/a%2Fb/cover/template'],
      wrong: [{ method: 'POST', path: '/projects/' + MA + '/cover' }, { method: 'GET', path: '/projects/' + MA + '/quotation/export' }, { method: 'PUT', path: '/projects/' + MA + '/cover/template' }, { method: 'GET', path: '/projects/' + MA + '/quotation' }],
    });

    /* ---------- estimates ---------- */
    await restBind(h, S.root, {
      writes: [{ method: 'PATCH', path: '/work-items/' + NOID }, { method: 'POST', path: '/work-items/delete' }, { method: 'POST', path: '/work-items/approval' }, { method: 'POST', path: '/work-items/favorites' }, { method: 'POST', path: '/work-items' }],
      reads: ['/work-items?x=1&x=2', '/work-items/' + NOID + '/history?a=1&a=2', '/work-items/khong-phai-uuid/history'],
      slashes: ['/work-items/a%2Fb/history', '/work-items/%2F/history'],
      wrong: [{ method: 'PUT', path: '/work-items' }, { method: 'DELETE', path: '/work-items/' + NOID }, { method: 'POST', path: '/work-items/' + NOID + '/history' }, { method: 'GET', path: '/work-items/' + NOID }],
    });
    await h.dbCheck('sau các bước chỉ gửi tới Go (không được có thay đổi nào)');
  },
};
