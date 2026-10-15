'use strict';
/* Module materials (liên kết giữa sản phẩm): setYeuThich, getCombo / setCombo (2 chiều), getBienThe / setBienThe,
   kho SP chung của Dezon nhìn từ công ty được bật (server/store_supa.js 169-208, 723-949; server/auth.js 553-563, 600-602). */
const { fx } = require('./_fx');
const TABLES = ['products', 'product_combos', 'favorite_products', 'product_histories', 'audit_logs'];

module.exports = {
  name: 'area3/02 favourites, combos, variants, shared catalogue',
  async run(h) {
    const f = await fx(h), S = f.S;
    const mk = async (s, n, over) => f.idOf(await h.rpc(s, 'saveDbProduct', [Object.assign({ 'TÊN SẢN PHẨM': 'DL sản phẩm ' + n, 'MÃ SẢN PHẨM': 'DL-' + n, 'GIÁ BÁN LẺ': 100000 * (n.length + 1), 'CHIẾT KHẤU ĐẠI LÝ (%)': 10, 'THƯƠNG HIỆU': 'DL' }, over || {})], { label: 'tạo SP DL-' + n + ' @' + s.label }));
    const P = []; for (let i = 1; i <= 12; i++) P.push(await mk(S.adminA, 'A' + i, i === 12 ? { 'MÃ SẢN PHẨM': 'DL-A11', 'MÀU SẮC': 'Đen' } : {}));   // P[10], P[11] cùng mã DL-A11
    const B1 = await mk(S.adminB, 'B1'), B2 = await mk(S.adminB, 'B2');
    const C1 = await mk(S.adminC, 'C1'), C2 = await mk(S.adminC, 'C2');
    const R1 = await mk(S.root, 'R1'), R2 = await mk(S.root, 'R2');
    // SP riêng của C trùng khoá với 1 SP kho chung -> SP riêng đè kho chung trong danh mục
    const dz = (await h.sql("select id, product_code ma, product_name ten, power_w, color_temperature_k, beam_angle_deg, color from products where company_id = $1 and product_code is not null and product_code <> '' order by id limit 3", [f.dezon])).node;
    await h.rpc(S.adminC, 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'DL bản riêng của C đè kho chung', 'MÃ SẢN PHẨM': dz[0].ma, 'CÔNG SUẤT (W)': dz[0].power_w, 'NHIỆT ĐỘ MÀU (K)': dz[0].color_temperature_k, 'GÓC CHIẾU (°)': dz[0].beam_angle_deg, 'MÀU SẮC': dz[0].color }], { label: 'tạo SP riêng của C trùng khoá SP kho chung' });
    const D1 = dz[1].id, D2 = dz[2].id;

    /* ================= kho SP chung ================= */
    await h.both(S.adminC, 'getProducts', [], { label: 'getProducts @admin C (kèm kho chung Dezon, xếp theo tên kiểu vi)' });
    await h.both(S.editC, 'getProducts', []);
    await h.both(S.viewC, 'getProducts', [], { label: 'getProducts @super xem C' });
    await h.both(S.adminC, 'bootstrap', []);
    await h.both(S.adminC, 'getDbProduct', [D1], { label: 'getDbProduct SP kho chung @admin C (ngoài phạm vi -> null)' });
    await h.both(S.adminC, 'getCombo', [D1]); await h.both(S.adminC, 'getBienThe', [D1]);
    // tắt / bật lại quyền kho chung
    await h.rpc(S.root, 'updateCongTy', [f.ctC, { dungSpDezon: false }]);
    await h.both(S.adminC, 'getProducts', [], { label: 'getProducts @admin C sau khi tắt kho chung' });
    await h.rpc(S.root, 'updateCongTy', [f.ctC, { dungSpDezon: true }]);
    await h.both(S.adminC, 'getProducts', [], { label: 'getProducts @admin C sau khi bật lại kho chung' });

    /* ================= setYeuThich ================= */
    const yt = (s, keys, on, opts) => h.rpc(s, 'setYeuThich', on === undefined ? [keys] : [keys, on], opts);
    await f.matrixRpc('setYeuThich', [[P[0], P[1]], true]);
    for (const s of f.all) await h.rest(s, 'setYeuThich', [[P[2]], true]);
    await f.matrixRpc('setYeuThich', [[P[0]], false]);
    for (const s of f.all) await h.rest(s, 'setYeuThich', [[P[2]], false]);
    await yt(S.adminA, P[3]); await yt(S.adminA, 'DL-A5', true, { label: 'setYeuThich theo mã' });
    /* [khoảng trống: bộ chạy không xác định] KHÔNG gọi setYeuThich theo mã DL-A11 (2 dòng cùng mã): findSpAny_ (store_supa.js:757) lấy limit 1
       không ORDER BY nên dòng được đánh dấu tuỳ thứ tự vật lý của Postgres - bản Node tự nó không xác định, 2 database lệch nhau từ đó.
       Tra theo mã chỉ thử với mã có đúng 1 dòng (DL-A5, DL-A8). */
    await yt(S.adminA, [P[3], P[3], 'DL-A5'], true, { label: 'setYeuThich đã có sẵn (không chèn trùng)' });
    for (const on of [null, 0, '', 'false', 1, 'x', {}, []]) await yt(S.edit, [P[5]], on, { label: 'setYeuThich on = ' + f.show(on) });
    await yt(S.edit, [P[5]], false); await yt(S.edit, [P[5]], false, { label: 'setYeuThich tắt khi chưa bật' });
    for (const a of [[], [null], [undefined, true], [[]], [[], false], [''], ['   ', true], [0], [[0, '', null, 'KHÔNG-CÓ', 999999999, 'x1', 'x2', 'x3']], [[true]], [[{}]], [[[P[6]]]], [[1.5]], [['99999999999999999999']], [{ id: P[6] }], [[P[6], P[7]], true, 'thừa'], [' DL-A8 ', true], [String(P[8]), true]])
      await h.both(S.adminA, 'setYeuThich', a, { label: 'setYeuThich tham số ' + JSON.stringify(a) });
    // khác công ty / kho chung / không công ty
    await yt(S.adminA, [B1], true, { label: 'setYeuThich SP của B @admin A (tìm không theo công ty)' });
    await yt(S.adminB, [P[0], B1], true); await yt(S.adminA, [D1], true, { label: 'setYeuThich SP Dezon @admin A (không dùng kho chung)' });
    await yt(S.adminC, [D1, D2, C1], true, { label: 'setYeuThich SP kho chung @admin C' }); await yt(S.editC, [D1], true); await yt(S.adminC, [D2], false);
    await yt(S.root, [P[0], R1, D1], true, { label: 'setYeuThich @super (company null)' }); await yt(S.root, [P[0], R1], true, { label: 'setYeuThich @super lần 2 (không chèn trùng)' }); await yt(S.root, [R1], false);
    await yt(S.viewA, [P[9]], true); await yt(S.viewB, [P[9]], true); await yt(S.viewA, [P[9]], false); await yt(S.adminView, [P[9]], true);
    await h.both(S.adminA, 'getProducts', [], { label: 'getProducts @admin A (dấu yêu thích)' });
    await h.both(S.adminC, 'getProducts', [], { label: 'getProducts @admin C (dấu yêu thích trên kho chung)' });
    /* [khoảng trống vùng 3: store_supa.js:780] nhánh nuốt lỗi trùng khoá của setYeuThich chỉ tới được khi 2 request chen nhau: 6 lời gọi giống hệt
       gửi cùng lúc, mỗi lời gọi phải trả {ok:1} và database chỉ có 1 dòng. Lần chèn thua vẫn tiêu 1 số của sequence (số lần thua khác nhau
       giữa 2 server) nên sau đó đặt lại sequence về max(id) ở cả 2 database để id các dòng sau vẫn trùng nhau. */
    await h.race(S.duyet, 'setYeuThich', [[P[10]], true], 6, { label: 'setYeuThich: 6 lời gọi đồng thời cùng 1 sản phẩm chưa được đánh dấu (nhánh trùng khoá)' });
    const ytRows = await h.sql('select count(*)::int n from favorite_products where product_id = $1 and company_id = $2', [P[10], f.ctA]);
    h.check('setYeuThich đồng thời: đúng 1 dòng ở mỗi database', ytRows.node[0].n === 1 && ytRows.go[0].n === 1, ytRows.node, ytRows.go);
    await h.sql("select setval(pg_get_serial_sequence('public.favorite_products', 'id'), (select max(id) from favorite_products))");
    await yt(S.duyet, [P[10]], false, { label: 'setYeuThich tắt sau các lời gọi đồng thời' });
    await h.dbCheck('sau setYeuThich', TABLES);

    /* ================= setCombo / getCombo ================= */
    const sc = (s, key, items, opts) => h.rpc(s, 'setCombo', items === undefined ? [key] : [key, items], opts);
    const scR = (s, key, items, opts) => h.rest(s, 'setCombo', [key, items], opts);
    const gc = (key, s, opts) => h.both(s || S.adminA, 'getCombo', [key], opts);
    await f.matrix('getCombo', [P[0]]);
    await f.matrixRpc('setCombo', (s) => [P[0], [{ id: P[1], soLuong: 2, ghiChu: 'bởi ' + s.label }, { id: P[2] }]]);
    for (const s of f.all) await scR(s, P[3], [{ id: P[4], soLuong: 3, ghiChu: 'REST ' + s.label }]);
    await f.matrix('getCombo', [P[0]]);
    await gc(P[1], null, { label: 'getCombo chiều ngược (comboNguoc, comboBoSL)' }); await gc(P[2]); await gc(P[4]); await gc('DL-A1', null, { label: 'getCombo theo mã' });
    // lưu lại: sửa tại chỗ, đổi thứ tự, thêm, bỏ
    await sc(S.adminA, P[0], [{ id: P[2], soLuong: 5, ghiChu: 'đổi thứ tự' }, { id: P[1], soLuong: '2,5' }, { id: P[5], soLuong: 0 }]); await gc(P[0]);
    await sc(S.adminA, P[0], [{ id: P[5], soLuong: -1, ghiChu: 123 }, { id: String(P[1]), soLuong: 'abc' }]); await gc(P[0]); await gc(P[2], null, { label: 'getCombo sau khi bị bỏ khỏi combo' });
    // phía kia (P[1]) lưu: giữ liên kết ngược nguyên trạng / đặt số lượng riêng / bỏ
    await sc(S.adminA, P[1], [{ id: P[0], soLuong: 1 }], { label: 'setCombo phía kia giữ liên kết ngược (số lượng 1 -> không ghi)' }); await gc(P[1]); await gc(P[0]);
    await sc(S.adminA, P[1], [{ id: P[0], soLuong: 4 }, { id: P[6] }], { label: 'setCombo phía kia đặt số lượng riêng (thêm dòng chiều xuôi)' }); await gc(P[1]); await gc(P[0]);
    await sc(S.adminA, P[1], [{ id: P[6] }], { label: 'setCombo phía kia bỏ liên kết ngược (xoá cả 2 dòng)' }); await gc(P[1]); await gc(P[0]); await gc(P[6]);
    await sc(S.adminA, P[5], [], { label: 'setCombo [] ở phía chỉ có liên kết ngược -> xoá' }); await gc(P[0]);
    // tham số
    for (const items of [undefined, null, 'chuỗi', 5, {}, [], [null], [{}], [{ id: 0 }], [{ id: '' }], [{ ten: 'thiếu id' }], [P[7]], [[P[7]]], [{ id: P[0] }], [{ id: P[0] }, { id: P[7] }], [{ id: P[7] }, { id: P[7], soLuong: 9 }, { id: String(P[7]) }], [{ id: 'abc' }], [{ id: 999999999 }], [{ id: 1.5 }], [{ id: true }], [{ id: [P[8]] }],
      [{ id: P[8], soLuong: null, ghiChu: null }], [{ id: P[8], soLuong: '1.000', ghiChu: { a: 1 } }], [{ id: P[8], soLuong: 1e21 }], [{ id: B1 }], [{ id: D1, soLuong: 2 }], [{ id: R1 }], [{ id: P[8] }, null, { id: P[9] }, 'x', { id: P[10] }]]) {
      await sc(S.adminA, P[11], items, { label: 'setCombo items = ' + f.show(items) });
      await gc(P[11], null, { label: 'getCombo sau items = ' + f.show(items) });
    }
    // [khoảng trống vùng 3: store_supa.js:863 qua REST] danh sách có phần tử nhưng không phần tử nào hợp lệ -> lỗi "thiếu id", combo giữ nguyên
    for (const items of [[null], [{}], [{ id: 0 }], [{ id: '' }], [{ ten: 'thiếu id' }], [{ id: P[11] }]]) await scR(S.adminA, P[11], items, { label: 'setCombo (REST) items không hợp lệ = ' + f.show(items) });
    await gc(P[11], null, { label: 'getCombo sau các lần REST bị từ chối (không đổi)' });
    await h.rpc(S.adminA, 'setCombo', [P[11], [{ id: P[8] }], 'thừa']);
    for (const key of [undefined, null, '', '  ', 0, 'KHÔNG-CÓ', 999999999, 'DL-A11', ' DL-A1 ', true, [], [P[0]], {}, 1.5, -1, '99999999999999999999']) {
      await h.both(S.adminA, 'getCombo', key === undefined ? [] : [key], { label: 'getCombo khoá ' + f.show(key) });
      await h.both(S.adminA, 'setCombo', key === undefined ? [] : [key, [{ id: P[9] }]], { label: 'setCombo khoá ' + f.show(key) });
    }
    // phạm vi công ty
    await h.both(S.adminB, 'setCombo', [P[0], [{ id: B1 }]], { label: 'setCombo SP của A @admin B' });
    await h.both(S.adminB, 'getCombo', [P[0]], { label: 'getCombo SP của A @admin B' });
    await h.both(S.adminA, 'setCombo', [D1, [{ id: P[0] }]], { label: 'setCombo SP Dezon @admin A' });
    await h.both(S.adminC, 'setCombo', [D1, [{ id: C1 }]], { label: 'setCombo SP kho chung @admin C (chặn)' });
    await sc(S.adminC, C1, [{ id: D1, soLuong: 2 }, { id: C2 }, { id: D2 }], { label: 'setCombo SP riêng của C kèm SP kho chung' }); await gc(C1, S.adminC); await gc(C2, S.adminC); await gc(D1, S.adminC);
    await sc(S.editC, C2, [{ id: C1, soLuong: 3 }]); await gc(C1, S.editC); await gc(C2, S.editC);
    await sc(S.root, R1, [{ id: R2 }, { id: P[0] }, { id: B1 }, { id: D1 }], { label: 'setCombo @super (không công ty)' }); await gc(R1, S.root); await gc(P[0], S.root); await gc(P[0], S.adminA, { label: 'getCombo P0 @admin A (liên kết ngược từ SP không công ty)' }); await gc(B1, S.adminB);
    await sc(S.viewA, P[9], [{ id: P[10] }]); await gc(P[9], S.viewA); await sc(S.viewB, P[9], [{ id: B1 }], { label: 'setCombo SP của A @super xem B' });
    await h.both(S.adminA, 'getProducts', [], { label: 'getProducts @admin A (comboN)' });
    await h.both(S.adminC, 'getProducts', [], { label: 'getProducts @admin C (comboN trên kho chung)' });
    await h.dbCheck('sau setCombo', TABLES);

    /* ================= setBienThe / getBienThe ================= */
    const sb = (s, key, ids2, opts) => h.rpc(s, 'setBienThe', ids2 === undefined ? [key] : [key, ids2], opts);
    const gb = (key, s, opts) => h.both(s || S.adminA, 'getBienThe', [key], opts);
    await f.matrix('getBienThe', [P[0]]);
    await f.matrixRpc('setBienThe', [P[0], [P[1], P[2]]]);
    for (const s of f.all) await h.rest(s, 'setBienThe', [P[3], [P[4]]]);
    await f.matrix('getBienThe', [P[0]]);
    await gb(P[1]); await gb(P[2]); await gb(P[4]); await gb('DL-A1');
    await sb(S.adminA, P[1], [P[0], P[5]], { label: 'setBienThe từ thành viên: bỏ P2, thêm P5 (giữ tên nhóm cũ)' }); await gb(P[0]); await gb(P[2]); await gb(P[5]);
    await sb(S.adminA, P[5], [{ id: P[0] }, String(P[1]), ' ' + P[6] + ' ', { id: null }, { x: 1 }, P[5], P[0]], { label: 'setBienThe id dạng object / chuỗi / trùng / chính nó' }); await gb(P[5]); await gb(P[6]);
    await sb(S.adminA, P[3], [P[0]], { label: 'setBienThe kéo SP đang ở nhóm khác sang nhóm mình' }); await gb(P[3]); await gb(P[0]); await gb(P[1]);
    await sb(S.adminA, P[1], [], { label: 'setBienThe [] -> giải tán nhóm' }); await gb(P[1]); await gb(P[5]); await gb(P[6]);
    await sb(S.adminA, P[1], [], { label: 'setBienThe [] khi không có nhóm' });
    for (const ids2 of [undefined, null, 'chuỗi', 5, {}, [null], [''], ['abc'], [{}], [{ id: 'x' }], [1.5], [-1], [true], [[P[8]]], [P[7]], [P[7], 'abc', null], [P[7], P[7]], [999999999], [B1], [D1], [R1], [P[8], B1, 999999999]]) {
      await sb(S.adminA, P[7], ids2, { label: 'setBienThe ids = ' + f.show(ids2) });
      await gb(P[7], null, { label: 'getBienThe sau ids = ' + f.show(ids2) });
    }
    // [khoảng trống vùng 3: store_supa.js:925 qua REST] ids có phần tử nhưng không phần tử nào hợp lệ -> lỗi "thiếu id", nhóm giữ nguyên
    for (const ids2 of [[null], [''], ['abc'], [{}], [{ id: 'x' }], [1.5], [-1], [true], [P[7]]]) await h.rest(S.adminA, 'setBienThe', [P[7], ids2], { label: 'setBienThe (REST) ids không hợp lệ = ' + f.show(ids2) });
    await gb(P[7], null, { label: 'getBienThe sau các lần REST bị từ chối (không đổi)' });
    await h.rpc(S.adminA, 'setBienThe', [P[7], [P[8]], 'thừa']);
    for (const key of [undefined, null, '', '  ', 0, 'KHÔNG-CÓ', 999999999, 'DL-A11', ' DL-A1 ', true, [], {}, 1.5]) {
      await h.both(S.adminA, 'getBienThe', key === undefined ? [] : [key], { label: 'getBienThe khoá ' + f.show(key) });
      await h.both(S.adminA, 'setBienThe', key === undefined ? [] : [key, [P[9]]], { label: 'setBienThe khoá ' + f.show(key) });
    }
    await h.both(S.adminB, 'setBienThe', [P[0], [B1]], { label: 'setBienThe SP của A @admin B' });
    await h.both(S.adminB, 'getBienThe', [P[0]]);
    await h.both(S.adminC, 'setBienThe', [D1, [C1]], { label: 'setBienThe SP kho chung @admin C (chặn)' });
    await sb(S.adminC, C1, [C2, D1], { label: 'setBienThe SP riêng của C kèm id kho chung (ngoài phạm vi -> không đổi dòng đó)' }); await gb(C1, S.adminC); await gb(C2, S.adminC);
    await sb(S.root, R1, [R2, P[9], B1], { label: 'setBienThe @super (đổi được dòng mọi công ty)' }); await gb(R1, S.root); await gb(P[9], S.adminA); await gb(B1, S.adminB);
    await sb(S.viewA, P[10], [P[11]]); await gb(P[10], S.viewA);
    await h.both(S.adminA, 'getProducts', [], { label: 'getProducts @admin A (nhomBT)' });
    await h.dbCheck('sau setBienThe', TABLES);

    /* ================= xoá SP đang có combo / yêu thích / nhóm biến thể ================= */
    await yt(S.adminA, [P[8], P[9]], true); await sc(S.adminA, P[8], [{ id: P[9] }, { id: P[10] }]); await sc(S.adminA, P[4], [{ id: P[8] }]);
    await h.rpc(S.adminA, 'deleteDbProduct', [P[8]], { label: 'deleteDbProduct SP có combo 2 chiều + yêu thích' });
    await gc(P[9]); await gc(P[4]); await gc(P[8], null, { label: 'getCombo SP đã xoá' }); await gb(P[8]);
    await h.rpc(S.adminC, 'deleteDbProduct', [C1], { label: 'deleteDbProduct SP của C đang kèm SP kho chung' }); await gc(C2, S.adminC);
    await h.rpc(S.root, 'deleteDbProduct', [R1]); await gc(P[0], S.adminA);
    await h.both(S.adminA, 'getProducts', []); await h.both(S.adminC, 'getProducts', []); await h.both(S.adminB, 'getProducts', []);
    await h.both(S.adminA, 'getProductHistory', ['DL-A1']); await h.both(S.adminA, 'getProductHistory', ['DL-A9']); await h.both(S.adminC, 'getProductHistory', ['DL-C1']);
    await h.dbCheck('sau kịch bản liên kết', TABLES);
  },
};
