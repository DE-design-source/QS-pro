'use strict';
/* Module notifications: notifCount, notifList, notifRead, notifReadAll (server/auth.js 449-464).
   Thông báo được sinh bằng chính API: nhân viên gửi yêu cầu xoá sản phẩm (báo cho admin công ty), admin từ chối (báo lại nhân viên). */
const { fx } = require('./_fx');

module.exports = {
  name: 'area1/05 notifications',
  async run(h) {
    const f = await fx(h), S = f.S;
    const viewB = h.with(S.root, { view: f.ctB, label: 'super xem công ty B' });
    const all = f.all.concat([viewB]);
    const count = (label) => Promise.all([]).then(async () => { for (const s of all) await h.both(s, 'notifCount', [], label ? { label: 'notifCount @' + s.label + ' ' + label } : undefined); });

    await count('(chưa có thông báo)');
    for (const s of all) await h.both(s, 'notifList', []);
    // sinh thông báo
    for (let i = 1; i <= 4; i++) await h.rpc(S.staff, 'requestDeleteProducts', [[{ maSP: 'DX-SP-' + i, ten: 'Sản phẩm ' + i, id: i === 2 ? 0 : '' }, { ma: 'DX-SP-' + i + 'b' }].slice(0, i % 2 ? 1 : 2)]);
    await h.rpc(S.staff0, 'requestDeleteProducts', [[{ maSP: 'DX-SP-9', ten: '"nháy" & <b>' }]]);
    await h.rpc(S.adminB, 'requestDeleteProducts', [[{ maSP: 'DX-SP-B' }]]);
    await h.rpc(S.rootView, 'requestDeleteProducts', [[{ maSP: 'DX-SP-R' }]], { label: 'requestDeleteProducts @super xem A (báo admin của A)' });
    await h.rpc(S.root, 'requestDeleteProducts', [[{ maSP: 'DX-SP-R2' }]], { label: 'requestDeleteProducts @super không công ty (báo admin MỌI công ty)' });
    let r = await h.rpc(S.adminA, 'listDeleteRequests', []);
    const reqs = (r.node.json && r.node.json.result) || [];
    for (const q of reqs.filter((x) => x.requester === 'NV A').slice(0, 2)) await h.rpc(S.adminA, 'resolveDeleteRequest', [q.id, false], { label: 'resolveDeleteRequest ' + q.id + ' từ chối (báo lại người gửi)' });
    await count('(sau khi sinh thông báo)');

    /* ================= notifList ================= */
    for (const s of all) await h.both(s, 'notifList', []);
    for (const l of [null, 0, 1, 2, '3', ' 2 ', 2.9, 0.3, -1, -2.5, '-1', 100, 101, 500, 1e21, 'abc', '', true, false, [2], [1, 2], {}, '0x2', '1e0', 'Infinity', '-Infinity', NaN, -2147483649, -1e19])
      await h.both(S.adminA, 'notifList', [l], { label: 'notifList limit = ' + (typeof l === 'number' ? String(l) : JSON.stringify(l)) + ' @admin A' });
    await h.both(S.adminA, 'notifList', [2, 'thừa']);
    r = await h.rpc(S.adminA, 'notifList', [50]);
    const mine = ((r.node.json && r.node.json.result) || []).map((n) => n.id);
    r = await h.rpc(S.staff, 'notifList', [50]);
    const staffN = ((r.node.json && r.node.json.result) || []).map((n) => n.id);
    h.check('có thông báo để thử (admin A >= 5, staff >= 1)', mine.length >= 5 && staffN.length >= 1, mine.length, staffN.length);

    /* ================= notifRead ================= */
    const R = (args, s, opts) => h.both(s || S.adminA, 'notifRead', args, opts);
    await R([mine[0]], S.anon);
    await R([mine[0]]);
    await R([mine[0]], S.adminA, { label: 'notifRead lần 2 cùng thông báo' });
    await R([String(mine[1])], S.adminA, { label: 'notifRead id dạng chuỗi' });
    await R([mine[2]], S.staff, { label: 'notifRead thông báo của người khác @staff (không đổi gì)' });
    await R([mine[2]], S.adminB, { label: 'notifRead thông báo công ty khác @admin B' });
    await R([mine[2]], S.root, { label: 'notifRead thông báo của người khác @super' });
    await R([mine[2]], S.rootView);
    await R([staffN[0]], S.adminA, { label: 'notifRead thông báo của staff @admin A' });
    for (const id of [undefined, null, '', 0, -1, 999999999, 1.5, '1.5', 'abc', 'read-all', true, false, {}, [], [mine[2]], [mine[2], mine[3]], 1e30, '9223372036854775808', ' ' + mine[2] + ' ', mine[2] + ' or 1=1', '(' + mine[2] + ')', 'null'])
      await R(id === undefined ? [] : [id], S.adminA, { label: 'notifRead id = ' + (typeof id === 'number' ? String(id) : JSON.stringify(id)) + ' @admin A' });
    await R([mine[3], 'thừa']);
    await h.both(S.adminA, 'notifList', [50], { label: 'notifList 50 @admin A sau notifRead' });
    await count('(sau notifRead)');

    /* ================= notifReadAll ================= */
    for (const s of [S.anon, S.staff0, S.adminB, viewB]) await h.both(s, 'notifReadAll', []);
    await h.rpc(S.staff, 'notifReadAll', ['thừa']);
    await h.rest(S.adminA, 'notifReadAll', []);
    await h.both(S.adminA, 'notifReadAll', [], { label: 'notifReadAll lần 2 @admin A' });
    await h.both(S.root, 'notifReadAll', []);
    await h.both(S.rootView, 'notifReadAll', []);
    for (const s of all) await h.both(s, 'notifList', [5]);
    await count('(sau notifReadAll)');
    // thông báo mới sau khi đã đọc hết
    await h.rpc(S.staff, 'requestDeleteProducts', [[{ maSP: 'DX-SP-CUOI' }]]);
    await h.both(S.adminA, 'notifCount', [], { label: 'notifCount @admin A có 1 thông báo mới' });
    await h.both(S.adminA, 'notifList', [1]);

    /* [khoảng trống B.low: trần kết quả, auth.js:456] notifCount đếm tối đa 500 thông báo chưa đọc; notifList cắt theo limit.
       505 thông báo chưa đọc của 1 tài khoản chèn bằng SQL (không có đường API nào sinh nhanh được chừng đó), mỗi dòng cách nhau 1 giây
       để thứ tự theo created_at xác định; thử xong thì xoá. */
    await h.sql("insert into notifications (user_id, company_id, kind, title, body, ref_id, is_read, created_at) select $1::uuid, $2::uuid, 'dx_tran', 'Thông báo trần ' || g, 'nội dung ' || g, g::text, false, now() - make_interval(secs => g) from generate_series(1, 505) g", [f.staff0Id, f.ctA]);
    await h.both(S.staff0, 'notifCount', [], { label: 'notifCount khi có 505 thông báo chưa đọc (trần 500)' });
    for (const l of [undefined, 100, 101, 499, 500, 501, 600, 1e9]) await h.both(S.staff0, 'notifList', l === undefined ? [] : [l], { label: 'notifList limit = ' + (l === undefined ? '(thiếu)' : l) + ' khi có 505 thông báo' });
    await h.rpc(S.staff0, 'notifReadAll', [], { label: 'notifReadAll khi có 505 thông báo chưa đọc' });
    await h.both(S.staff0, 'notifCount', [], { label: 'notifCount sau notifReadAll (505 thông báo)' });
    const conLai = await h.sql("select count(*)::int n from notifications where kind = 'dx_tran' and not is_read");
    h.check('notifReadAll: số thông báo trần còn chưa đọc giống nhau ở 2 database', conLai.node[0].n === conLai.go[0].n, conLai.node, conLai.go);
    await h.sql("delete from notifications where kind = 'dx_tran'");
  },
};
