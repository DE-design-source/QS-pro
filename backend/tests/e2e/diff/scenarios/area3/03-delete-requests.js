'use strict';
/* Module materials (yêu cầu xoá sản phẩm): requestDeleteProducts, listDeleteRequests, resolveDeleteRequest
   (server/auth.js 466-507) - từ lúc nhân viên gửi tới lúc admin duyệt / từ chối, kèm thông báo và nhật ký. */
const { fx } = require('./_fx');
const TABLES = ['delete_requests', 'notifications', 'audit_logs', 'products', 'product_histories', 'product_combos', 'favorite_products'];

module.exports = {
  name: 'area3/03 delete requests',
  async run(h) {
    const f = await fx(h), S = f.S;
    const mk = async (s, n, over) => f.idOf(await h.rpc(s, 'saveDbProduct', [Object.assign({ 'TÊN SẢN PHẨM': 'DR sản phẩm ' + n, 'MÃ SẢN PHẨM': 'DR-' + n, 'GIÁ BÁN LẺ': 50000 }, over || {})], { label: 'tạo SP DR-' + n + ' @' + s.label }));
    const P = []; for (let i = 1; i <= 24; i++) P.push(await mk(S.adminA, 'A' + i));
    const V1 = await mk(S.adminA, 'V', { 'MÀU SẮC': 'Trắng' }), V2 = await mk(S.adminA, 'V', { 'MÀU SẮC': 'Đen' });   // 2 biến thể cùng mã DR-V
    const B1 = await mk(S.adminB, 'B1'), C1 = await mk(S.adminC, 'C1'), R1 = await mk(S.root, 'R1');
    const it = (id, n) => ({ maSP: 'DR-' + n, id, ten: 'DR sản phẩm ' + n });
    const req = (s, items, opts) => h.rpc(s, 'requestDeleteProducts', items === undefined ? [] : [items], opts);
    const list = (s, opts) => h.both(s, 'listDeleteRequests', [], opts);
    const res = (s, id, approve, opts) => h.rpc(s, 'resolveDeleteRequest', approve === undefined ? [id] : [id, approve], opts);
    // id của yêu cầu mới nhất của 1 công ty (2 database cùng seed nên id số trùng nhau)
    const lastId = async (ct) => { const r = await h.sql('select max(id)::int id from delete_requests where company_id is not distinct from $1', [ct]); return r.node[0].id === r.go[0].id ? r.node[0].id : h.pair(r.node[0].id, r.go[0].id); };

    /* ================= trước khi có yêu cầu ================= */
    await f.matrix('listDeleteRequests', []);
    await h.both(S.adminA, 'resolveDeleteRequest', [1, true], { label: 'resolveDeleteRequest khi chưa có yêu cầu nào' });

    /* ================= requestDeleteProducts ================= */
    let n = 0;
    await f.matrixRpc('requestDeleteProducts', () => { n++; return [[it(P[n], 'A' + (n + 1))]]; });
    for (const s of f.all) { n++; await h.rest(s, 'requestDeleteProducts', [[it(P[n], 'A' + (n + 1))]]); }
    for (const a of [[], [null], ['chuỗi'], [5], [{}], [[]], [[{}]], [[{ id: P[0] }]], [[{ ten: 'chỉ có tên' }]], [[{ maSP: '' }]], [[{ maSP: 0, ma: '' }]], [[null]], [[undefined]], [['chuỗi']], [[5]], [[[]]], [[true]]])
      await h.both(S.edit, 'requestDeleteProducts', a, { label: 'requestDeleteProducts tham số ' + JSON.stringify(a) });
    await req(S.edit, [{ ma: 'DR-A20', id: P[19] }, { maSP: 123, id: 0, ten: null }, { maSP: 'DR-KHÔNG-CÓ', id: '', ten: 456 }, { maSP: 'DR-V', id: V2, ten: 'biến thể Đen', thua: 'bỏ' }, { maSP: '', id: P[20] }, {}], { label: 'requestDeleteProducts nhiều dạng phần tử' });
    const rMix = await lastId(f.ctA);
    await req(S.duyet, [{ maSP: 'DR-V' }], { label: 'requestDeleteProducts chỉ có mã (biến thể id nhỏ nhất)' }); const rCode = await lastId(f.ctA);
    await req(S.boc, [it(P[21], 'A22'), it(P[21], 'A22')], { label: 'requestDeleteProducts trùng SP, người gửi không họ tên' }); const rDup = await lastId(f.ctA);
    await req(S.none, [it(P[22], 'A23')]); const rRej = await lastId(f.ctA);
    await req(S.adminA, [it(P[23], 'A24')], { label: 'requestDeleteProducts do chính admin gửi' }); const rAdm = await lastId(f.ctA);
    await h.rpc(S.edit, 'requestDeleteProducts', [[it(B1, 'B1'), it(1, 'DEZON'), it(R1, 'R1')], 'thừa'], { label: 'requestDeleteProducts SP ngoài công ty' }); const rOut = await lastId(f.ctA);
    await req(S.editC, [{ maSP: 'x', id: 1, ten: 'SP kho chung' }, it(C1, 'C1')], { label: 'requestDeleteProducts @staff C (SP kho chung + SP riêng)' }); const rC = await lastId(f.ctC);
    await req(S.adminB, [it(B1, 'B1')]); const rB = await lastId(f.ctB);
    await req(S.root, [it(R1, 'R1')], { label: 'requestDeleteProducts @super (báo mọi admin, company null)' }); const rRoot = await lastId(null);
    await req(S.viewA, [it(P[18], 'A19')], { label: 'requestDeleteProducts @super xem A' }); const rView = await lastId(f.ctA);
    await req(S.edit, Array.from({ length: 60 }, (_, i) => ({ maSP: 'DR-NHIEU-' + i, id: 900000000 + i, ten: 'Nhiều ' + i })), { label: 'requestDeleteProducts 60 SP không tồn tại' }); const rMany = await lastId(f.ctA);

    /* ================= listDeleteRequests ================= */
    await f.matrix('listDeleteRequests', []);
    for (const s of [S.adminC, S.viewB, S.viewC, S.adminView]) await list(s);
    await h.both(S.adminA, 'listDeleteRequests', ['thừa']);
    for (const s of [S.adminA, S.adminB, S.adminC]) { await h.both(s, 'notifCount', []); await h.both(s, 'notifList', [100]); }
    await h.dbCheck('sau requestDeleteProducts', TABLES);

    /* ================= resolveDeleteRequest ================= */
    // quyền: mỗi phiên xử lý 1 yêu cầu còn chờ của công ty A (chỉ admin / super qua được cổng)
    const aIds = (await h.sql('select id::int id from delete_requests where company_id = $1 order by id', [f.ctA])).node.map((x) => x.id);
    let rid = 0;
    await f.matrixRpc('resolveDeleteRequest', () => [aIds[rid++], true]);
    for (const s of f.all) await h.rest(s, 'resolveDeleteRequest', [aIds[rid++], false]);
    await h.both(S.adminA, 'resolveDeleteRequest', [aIds[0], true], { label: 'resolveDeleteRequest yêu cầu đã xử lý' });
    await res(S.adminA, rMix, true, { label: 'resolveDeleteRequest duyệt: nhiều dạng phần tử (đếm deleted, lỗi đầu tiên)' });
    await res(S.adminA, rCode, true, { label: 'resolveDeleteRequest duyệt theo mã (biến thể còn lại)' });
    await res(S.adminA, rDup, true, { label: 'resolveDeleteRequest duyệt SP trùng (lần 2 không còn)' });
    await res(S.adminA, rRej, false, { label: 'resolveDeleteRequest từ chối' });
    await res(S.adminA, rRej, true, { label: 'resolveDeleteRequest duyệt yêu cầu đã từ chối' });
    await res(S.adminA, rAdm, 1, { label: 'resolveDeleteRequest approve = 1' });
    await res(S.adminA, rOut, 'yes', { label: 'resolveDeleteRequest duyệt SP ngoài công ty (kho chung / không tìm thấy)' });
    await res(S.adminA, rMany, true, { label: 'resolveDeleteRequest duyệt 60 SP không tồn tại' });
    await res(S.adminB, rView, true, { label: 'resolveDeleteRequest yêu cầu của A @admin B' });
    await res(S.viewB, rView, true, { label: 'resolveDeleteRequest yêu cầu của A @super xem B' });
    await res(S.viewA, rView, undefined, { label: 'resolveDeleteRequest thiếu approve @super xem A (-> từ chối)' });
    await res(S.adminC, rC, true, { label: 'resolveDeleteRequest @admin C: SP kho chung bị chặn, SP riêng xoá' });
    await res(S.root, rB, true, { label: 'resolveDeleteRequest yêu cầu của B @super' });
    await res(S.root, rRoot, 0, { label: 'resolveDeleteRequest approve = 0 @super' });
    /* [khoảng trống vùng 3: auth.js:493] lần kiểm "đã xử lý" thứ hai (sau lệnh UPDATE có điều kiện) chỉ tới được khi 2 admin bấm cùng lúc:
       5 lời gọi giống hệt gửi đồng thời -> đúng 1 lời gọi thành công, 4 lời gọi còn lại báo "Yêu cầu đã được xử lý"; chỉ 1 thông báo + 1 dòng audit. */
    await req(S.edit, [it(P[17], 'A18')], { label: 'requestDeleteProducts cho bước xử lý đồng thời' }); const rRace = await lastId(f.ctA);
    await h.race(S.adminA, 'resolveDeleteRequest', [rRace, false], 5, { label: 'resolveDeleteRequest: 5 lời gọi đồng thời cùng 1 yêu cầu (từ chối)' });
    await h.both(S.adminA, 'resolveDeleteRequest', [rRace, true], { label: 'resolveDeleteRequest sau các lời gọi đồng thời (đã xử lý)' });
    for (const a of [[], [null], [''], [0], ['abc'], [1.5], ['1.5'], [-1], [true], [[]], [[1]], [{}], [999999999], ['99999999999999999999'], [' 1 '], ['1&status=eq.approved'], [1, null], [1, ''], [1, {}], [1, true, 'thừa']])
      await h.both(S.adminA, 'resolveDeleteRequest', a, { label: 'resolveDeleteRequest tham số ' + JSON.stringify(a) });

    /* ================= kết quả ================= */
    await f.matrix('listDeleteRequests', []);
    await list(S.adminC);
    for (const s of [S.adminA, S.adminB, S.adminC, S.edit, S.duyet, S.boc, S.none, S.editC, S.root]) { await h.both(s, 'notifCount', []); await h.both(s, 'notifList', [100]); }
    await h.both(S.adminA, 'getAuditLog', [200]);
    await h.both(S.adminA, 'getProducts', []);
    await h.both(S.adminA, 'getProductHistory', ['DR-V']);
    await h.dbCheck('sau kịch bản yêu cầu xoá', TABLES);
  },
};
