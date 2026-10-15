'use strict';
/* Module estimates: ctList, ctSave, ctUpdate, ctDelete, ctDuyet, ctFav, ctHistory + POST /export/cong-tac
   (server/store_supa.js 1297-1508; cửa ngõ quyền server/auth.js 571-596; server/index.js 688-743).
   Quyền dùng chung với sản phẩm: sp_edit -> thêm / sửa / xoá, sp_duyet -> duyệt; không cấu hình sp_* -> cả hai. */
const { fx } = require('./_fx');
const LOAI = ['kt_chitiet', 'kt_sobo', 'dt_nhancong', 'dt_vattu'], MODE = ['item', 'area', 'area0', 'none'];
const NUMS = [0, 1, 2.5, '4', '2,5', '2.5', -1, -0, 'abc', null, '', true, false, ' 7 ', '1e2', 1e21, '12.500.000', '1.234', '1.234,5', '30%', [5], [], {}, 0.1 + 0.2, 1e-7, '5abc', 'Infinity'];
const TEXTS = ['văn bản mới', '', null, 123, 0, false, true, { a: 1 }, ['x', 'y'], "nháy ' \" \\ \n dòng 😀 <b>", '  thừa khoảng trắng  '];

module.exports = {
  name: 'area2/05 estimates',
  async run(h) {
    const f = await fx(h), S = f.S;
    const idsOf = (r) => { const a = (r.node.json && r.node.json.result && r.node.json.result.rows) || [], b = (r.go.json && r.go.json.result && r.go.json.result.rows) || []; return a.map((x, i) => (b[i] ? h.pair(x.id, b[i].id) : x.id)); };
    let seq = 0;
    const row = (extra) => Object.assign({ ten: 'Công tác ' + (++seq), thuTu: seq }, extra || {});
    const SAVE = (data, s, opts) => h.rpc(s || S.adminA, 'ctSave', data === undefined ? [] : [data], opts);

    /* ================= ctList trước khi thêm ================= */
    await f.matrix('ctList', []);
    for (const s of [S.viewDz, S.viewB, S.adminView]) await h.both(s, 'ctList', []);
    await h.both(S.adminA, 'ctList', ['thừa', 1]);

    /* ================= ctSave ================= */
    await h.both(S.anon, 'ctSave', [row()]);
    const fullRow = (lo, mo) => row({ loai: lo, mode: mo, maNhom: 'N' + seq, hangMuc: 'Phần móng', deMuc: '3.1.' + seq, ten: 'Đào đất hố móng ' + lo + '/' + mo, dvt: 'm3', ncc: 'Nhà thầu ' + seq, kl: 12.5 * seq, dt: 100 + seq, hs: 1.05, dgnt: 90000 * seq, dg: 120000 * seq,
      gc: 'Ghi chú ' + seq, hinhAnh: 'https://127.0.0.1/ct' + seq + '.png', thongSo: 'Mác 250', phamVi: 'Toàn nhà', linkTaiLieu: 'https://example.invalid/tl' + seq });
    const base = [];
    for (const lo of LOAI) for (const mo of MODE) base.push(...idsOf(await SAVE(fullRow(lo, mo), S.adminA, { label: 'ctSave loai = ' + lo + ', mode = ' + mo })));
    let r = await h.rest(S.adminA, 'ctSave', [fullRow('kt_sobo', 'area')]);
    if (r) base.push(...idsOf(r));
    // theo lô (1 lần gọi), > 6 dòng -> nhật ký hệ thống có dấu "…", dòng thiếu tên bị bỏ
    r = await SAVE([row(), row({ loai: 'dt_vattu', dg: '1.500.000' }), { ten: '   ' }, { ten: '' }, {}, null, row({ mode: 'none' }), row(), row(), row(), row(), row({ kl: '', dt: null })], S.adminA, { label: 'ctSave lô 12 phần tử (4 phần tử thiếu tên bị bỏ)' });
    const lot = idsOf(r);
    r = await h.rest(S.adminA, 'ctSave', [[row({ ten: 'Lô REST 1' }), row({ ten: 'Lô REST 2' })]], { label: 'ctSave (REST) lô 2 dòng' });
    await SAVE([row({ ten: 'đúng 6 dòng 1' }), row(), row(), row(), row(), row()], S.adminA, { label: 'ctSave lô đúng 6 dòng (không có "…")' });
    // mỗi cấp quyền (sp_edit đủ để thêm; chỉ sp_duyet / không cấu hình cũng thêm được)
    const own = {};
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.adminB, S.root, S.viewA, S.viewB, S.adminView]) own[s.label] = idsOf(await SAVE(row({ ten: 'Thêm bởi ' + s.label, loai: 'kt_sobo' }), s))[0];
    const idB = own[S.adminB.label], idRoot = own[S.root.label];
    // không có gì để lưu
    for (const a of [[], [null], ['chuỗi'], [5], [0], [true], [[]], [[null, 'x', 5]], [{}], [{ ten: '' }], [{ ten: '   ' }], [{ ten: null }], [[{ ten: '' }, { hangMuc: 'không tên' }]], [{ Ten: 'sai hoa thường' }]])
      await h.both(S.adminA, 'ctSave', a, { label: 'ctSave ' + JSON.stringify(a) + ' @admin A (thiếu tên)' });
    // tên đủ kiểu
    for (const v of [123, 0, true, false, { a: 1 }, ['a', 'b'], [], '  có khoảng trắng  ', 'x'.repeat(3000), "nháy ' \" \\ 😀"]) await SAVE(row({ ten: v }), S.adminA, { label: 'ctSave ten = ' + f.show(v) });
    // loai / mode ngoài danh sách -> ràng buộc của database
    for (const [key, v] of [['loai', 'khac'], ['loai', 'KT_CHITIET'], ['loai', ''], ['loai', null], ['loai', 0], ['loai', 5], ['loai', true], ['loai', ['kt_sobo']], ['loai', {}], ['mode', 'khac'], ['mode', 'ITEM'], ['mode', ''], ['mode', null], ['mode', 0], ['mode', 1], ['mode', ['area']], ['mode', false]])
      await SAVE(row({ [key]: v }), S.adminA, { label: 'ctSave ' + key + ' = ' + f.show(v) });
    for (const key of ['kl', 'dt', 'hs', 'dgnt', 'dg', 'thuTu']) for (const v of NUMS) await SAVE(Object.assign(row(), { [key]: v }), S.adminA, { label: 'ctSave ' + key + ' = ' + f.show(v) });
    for (const key of ['maNhom', 'hangMuc', 'deMuc', 'dvt', 'ncc', 'gc', 'hinhAnh', 'thongSo', 'phamVi', 'linkTaiLieu']) for (const v of TEXTS) await SAVE(row({ [key]: v }), S.adminA, { label: 'ctSave ' + key + ' = ' + f.show(v) });
    for (const [key, v] of [['kl', '2,5'], ['kl', -1], ['dg', 'abc'], ['thuTu', 2.5], ['thuTu', -1], ['loai', 'khac'], ['hangMuc', null], ['mode', 'area0']]) await h.rest(S.adminA, 'ctSave', [row({ [key]: v })], { label: 'ctSave (REST) ' + key + ' = ' + f.show(v) });
    // khoá lạ / cột hệ thống không lọt; lô có 1 dòng sai -> cả lô không được ghi
    await SAVE(row({ id: '00000000-0000-4000-8000-00000000dead', daDuyet: true, nguoiDuyet: 'x', yeuThich: true, nguoiTao: 'giả', ngayTao: '2020-01-01', cong_ty_id: 'x', da_duyet: true, zzz: 1 }), S.adminA, { label: 'ctSave khoá lạ / cột hệ thống bị bỏ qua' });
    await SAVE([row(), row({ kl: -5 }), row()], S.adminA, { label: 'ctSave lô có 1 dòng vi phạm ràng buộc (không ghi dòng nào)' });
    await SAVE(row({ ten: 'thừa tham số' }), S.adminA, { label: 'ctSave thừa tham số' });
    await h.rpc(S.adminA, 'ctSave', [row(), 'thừa']);
    await f.matrix('ctList', [], { label: 'ctList sau ctSave' });
    await h.both(S.viewB, 'ctList', []);
    await h.dbCheck('sau ctSave', ['work_items', 'work_item_histories', 'audit_logs']);

    /* ================= ctUpdate ================= */
    const U = (args, s, opts) => h.rpc(s || S.adminA, 'ctUpdate', args, opts);
    const UR = (args, s, opts) => h.rest(s || S.adminA, 'ctUpdate', args, opts);
    const T = base[0], T2 = base[5], T3 = base[10];
    await h.both(S.anon, 'ctUpdate', [T, { gc: 'x' }]);
    await U([T, { ten: 'Sửa tên', dg: 150000 }]);
    await UR([T, { ten: 'Sửa tên qua REST', dgnt: '95.000' }]);
    await U([T, { ten: 'Sửa tên qua REST', dgnt: 95000 }], S.adminA, { label: 'ctUpdate không đổi gì (vẫn bỏ duyệt, không có dòng lịch sử)' });
    for (const lo of LOAI) await U([T, { loai: lo }], S.adminA, { label: 'ctUpdate loai = ' + lo });
    for (const mo of MODE) await UR([T, { mode: mo }], S.adminA, { label: 'ctUpdate (REST) mode = ' + mo });
    for (const [key, v] of [['loai', 'khac'], ['loai', ''], ['loai', null], ['mode', 'khac'], ['mode', ''], ['mode', null], ['ten', ''], ['ten', null], ['ten', '   '], ['ten', 0], ['ten', 123], ['ten', { a: 1 }]]) await U([T, { [key]: v }], S.adminA, { label: 'ctUpdate ' + key + ' = ' + f.show(v) });
    for (const key of ['kl', 'dt', 'hs', 'dgnt', 'dg', 'thuTu']) for (const v of NUMS) { await U([T2, { [key]: v }], S.adminA, { label: 'ctUpdate ' + key + ' = ' + f.show(v) }); }
    for (const key of ['kl', 'dg', 'thuTu']) for (const v of [3, '3', '3,5', '5abc', 5, '', null, -1, 'abc']) await UR([T2, { [key]: v }], S.adminA, { label: 'ctUpdate (REST) ' + key + ' = ' + f.show(v) });
    for (const key of ['maNhom', 'hangMuc', 'deMuc', 'dvt', 'ncc', 'gc', 'hinhAnh', 'thongSo', 'phamVi', 'linkTaiLieu']) for (const v of TEXTS) await U([T3, { [key]: v }], S.adminA, { label: 'ctUpdate ' + key + ' = ' + f.show(v) });
    // lịch sử: 2 giá trị coi là bằng nhau khi parseFloat bằng nhau ("5abc" = 5; "12 m" = "12")
    for (const p of [{ gc: '5abc' }, { gc: '5' }, { gc: '5.0' }, { gc: '05' }, { gc: '5 m2' }, { gc: 'x5' }, { dvt: '12 m' }, { dvt: '12' }, { dvt: '1e1' }, { dvt: '10' }, { dvt: 'NaN' }, { dvt: 'Infinity' }, { dvt: '-Infinity' }, { dvt: '.5' }, { dvt: '0.50' }, { hangMuc: '1,5' }, { hangMuc: '1.5' }, { hangMuc: '1' }, { kl: 5 }, { kl: '5,0' }, { kl: 5.0000001 }, { kl: 5 }])
      await U([T3, p], S.adminA, { label: 'ctUpdate (so lịch sử) ' + JSON.stringify(p) });
    await U([T3, fullRow('dt_nhancong', 'area0')], S.adminA, { label: 'ctUpdate mọi trường cùng lúc' });
    await U([T3, { id: 'x', daDuyet: true, nguoiDuyet: 'x', yeuThich: true, nguoiTao: 'x', zzz: 1, da_duyet: true, ten_cu: 1 }], S.adminA, { label: 'ctUpdate chỉ khoá lạ (vẫn bỏ duyệt + ghi người sửa)' });
    for (const a of [[], [null], [''], [0], [false], [T], [T, null], [T, 'chuỗi'], [T, 5], [T, true], [T, []], [T, [{ gc: 'x' }]], [T, {}], [T, { gc: 'thừa' }, 'thừa'], [null, { gc: 'x' }], ['', { gc: 'x' }], [0, { gc: 'x' }]])
      await h.both(S.adminA, 'ctUpdate', a, { label: 'ctUpdate tham số ' + f.show(a.length ? a.map((x, i) => (i === 0 && x === T ? '<id>' : x)) : a) + ' @admin A' });
    for (const id of ['abc', 123, 1.5, true, {}, [], ['a', 'b'], '00000000-0000-4000-8000-00000000dead', '00000000-0000-4000-8000-00000000DEAD', ' 00000000-0000-4000-8000-00000000dead ', '{00000000-0000-4000-8000-00000000dead}', '00000000000040008000000000000000', 'null', '*'])
      await h.both(S.adminA, 'ctUpdate', [id, { gc: 'id lạ' }], { label: 'ctUpdate id = ' + f.show(id) + ' @admin A' });
    await U([[T], { gc: 'id là mảng 1 phần tử' }], S.adminA, { label: 'ctUpdate id = [id]' });
    // phạm vi công ty + mỗi cấp quyền
    await h.both(S.adminA, 'ctUpdate', [idB, { gc: 'A sửa công tác của B' }], { label: 'ctUpdate công tác công ty khác @admin A' });
    await h.both(S.adminB, 'ctUpdate', [T, { gc: 'B sửa công tác của A' }], { label: 'ctUpdate công tác công ty khác @admin B' });
    await h.both(S.viewB, 'ctUpdate', [T, { gc: 'super xem B sửa công tác A' }], { label: 'ctUpdate công tác A @super xem B' });
    await h.both(S.adminView, 'ctUpdate', [idB, { gc: 'admin A + x-view-company B' }]);
    await h.both(S.adminA, 'ctUpdate', [idRoot, { gc: 'admin A sửa công tác không công ty' }], { label: 'ctUpdate công tác không công ty @admin A' });
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA, S.root]) { await U([T, { gc: 'sửa bởi ' + s.label }], s); await UR([T, { gc: 'sửa bởi ' + s.label + ' (REST)' }], s); }
    await U([idB, { ten: 'B tự sửa', dg: '2.000.000' }], S.adminB);
    await U([idRoot, { ten: 'super sửa công tác không công ty' }], S.root);
    await U([idB, { gc: 'super không công ty sửa công tác của B' }], S.root);

    /* ================= ctDuyet ================= */
    const DU = (args, s, opts) => h.rpc(s || S.adminA, 'ctDuyet', args, opts);
    await h.both(S.anon, 'ctDuyet', [[T], true]);
    await h.both(S.edit, 'ctDuyet', [[T], true], { label: 'ctDuyet @staff chỉ sp_edit (không có quyền duyệt)' });
    await h.both(S.edit, 'ctDuyet', [[T], false], { label: 'ctDuyet bỏ duyệt @staff chỉ sp_edit (không có quyền duyệt)' });
    await DU([[T, T2], true], S.adminA, { label: 'ctDuyet 2 công tác' });
    await h.rest(S.adminA, 'ctDuyet', [[T3], true], { label: 'ctDuyet (REST) 1 công tác' });
    await DU([[T, T2], true], S.adminA, { label: 'ctDuyet lần 2 (đã duyệt, vẫn ghi lịch sử)' });
    await DU([[T], false], S.adminA, { label: 'ctDuyet bỏ duyệt' });
    await h.rest(S.adminA, 'ctDuyet', [[T2], false], { label: 'ctDuyet (REST) bỏ duyệt' });
    for (const ap of [undefined, null, 0, '', 'false', 1, 'x', [], {}]) await DU(ap === undefined ? [[base[1]]] : [[base[1]], ap], S.adminA, { label: 'ctDuyet approve = ' + f.show(ap) + ' (chỉ false mới là bỏ duyệt)' });
    for (const ap of [undefined, null, 0, 'false', false]) await h.rest(S.adminA, 'ctDuyet', ap === undefined ? [[base[2]]] : [[base[2]], ap], { label: 'ctDuyet (REST) approve = ' + f.show(ap) });
    await DU([T, true], S.adminA, { label: 'ctDuyet ids là 1 id (không phải mảng)' });
    await h.rest(S.adminA, 'ctDuyet', [T2, true], { label: 'ctDuyet (REST) ids là 1 id' });
    for (const s of [S.none, S.duyet, S.boc, S.viewA, S.root]) { await DU([[base[3]], true], s, { label: 'ctDuyet @' + s.label }); await h.rest(s, 'ctDuyet', [[base[3]], false], { label: 'ctDuyet (REST) bỏ duyệt @' + s.label }); }
    /* [khoảng trống B.low: auth.js:517-526, 589-593] đổi perms có hiệu lực NGAY với token cũ: spPerms_ đọc perms từ database ở mỗi lời gọi.
       Cùng một phiên dy_a_edit, admin đổi perms giữa các lần ctDuyet (không đăng nhập lại). Cuối cùng trả perms về như _fx. */
    const eRow = await h.sql("select id::text id from users where username = 'dy_a_edit'"), editId = h.pair(eRow.node[0].id, eRow.go[0].id);
    for (const perms of [['sp_duyet'], ['sp_edit'], ['sp_edit', 'sp_duyet'], [' sp_duyet '], ['SP_DUYET'], ['sp_duyet', 'boc'], ['boc'], [], 'sp_duyet', null, ['sp_edit ', 'x'], ['boc', 'sanpham', 'sp_edit']]) {
      await h.rpc(S.adminA, 'adminUpdateUser', [editId, { perms }], { label: 'đổi perms của dy_a_edit thành ' + JSON.stringify(perms) });
      await h.both(S.edit, 'spMyPerms', [], { label: 'spMyPerms @dy_a_edit (token cũ) khi perms = ' + JSON.stringify(perms) });
      await h.both(S.edit, 'ctDuyet', [[base[5]], true], { label: 'ctDuyet @dy_a_edit (token cũ) khi perms = ' + JSON.stringify(perms) });
      await h.both(S.edit, 'ctDuyet', [[base[5]], false], { label: 'ctDuyet bỏ duyệt @dy_a_edit (token cũ) khi perms = ' + JSON.stringify(perms) });
    }
    await h.both(S.adminB, 'ctDuyet', [[T, T2], true], { label: 'ctDuyet công tác công ty khác @admin B (ok = 0, không ghi nhật ký)' });
    await h.both(S.viewB, 'ctDuyet', [[T], true], { label: 'ctDuyet công tác A @super xem B (ok = 0)' });
    await h.both(S.adminA, 'ctDuyet', [[idB, idRoot], true], { label: 'ctDuyet công tác công ty khác / không công ty @admin A (ok = 0)' });
    await DU([[idB, idRoot, T], true], S.root, { label: 'ctDuyet công tác của nhiều công ty @super không công ty' });
    const bad = ['abc', 123, null, '', '00000000-0000-4000-8000-00000000dead', {}, [], true, 1.5, 'x y'];
    for (const a of [[], [null], [null, true], [[]], [[], false], [''], [0], ['abc'], [bad, true], [bad.slice(0, 4), false], [[T, 'abc', T2, '00000000-0000-4000-8000-00000000dead', T], true], [[T], true, 'thừa'], [{}], [{ id: 1 }, true], [true]])
      await h.both(S.adminA, 'ctDuyet', a, { label: 'ctDuyet ' + JSON.stringify(h.pair ? a : a).replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>').slice(0, 100) + ' @admin A' });
    await U([T, { gc: 'sửa sau khi duyệt -> quay về chưa duyệt' }]);
    await h.both(S.adminA, 'ctList', [], { label: 'ctList sau ctDuyet' });

    /* ================= ctFav ================= */
    const FV = (args, s, opts) => h.rpc(s || S.adminA, 'ctFav', args, opts);
    await h.both(S.anon, 'ctFav', [[T], true]);
    await FV([[T, T2], true]);
    await h.rest(S.adminA, 'ctFav', [[T3], true]);
    await FV([[T, T2], true], S.adminA, { label: 'ctFav lần 2 (đã bật)' });
    await FV([[T], false]);
    await h.rest(S.adminA, 'ctFav', [[T2], false]);
    for (const on of [undefined, null, 0, '', 'false', 1, 'x']) await FV(on === undefined ? [[base[1]]] : [[base[1]], on], S.adminA, { label: 'ctFav on = ' + f.show(on) + ' (chỉ false mới là tắt)' });
    for (const on of [undefined, null, 0, false]) await h.rest(S.adminA, 'ctFav', on === undefined ? [[base[2]]] : [[base[2]], on], { label: 'ctFav (REST) on = ' + f.show(on) });
    await FV([T, true], S.adminA, { label: 'ctFav ids là 1 id' });
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA, S.root]) { await FV([[base[4]], true], s, { label: 'ctFav @' + s.label }); await h.rest(s, 'ctFav', [[base[4]], false], { label: 'ctFav (REST) tắt @' + s.label }); }
    await h.both(S.adminB, 'ctFav', [[T, T2], true], { label: 'ctFav công tác công ty khác @admin B (ok = 0)' });
    await h.both(S.viewB, 'ctFav', [[T], true], { label: 'ctFav công tác A @super xem B (ok = 0)' });
    await FV([[idB, idRoot, T], true], S.root, { label: 'ctFav công tác của nhiều công ty @super không công ty' });
    for (const a of [[], [null], [[]], [''], [0], ['abc'], [bad, true], [bad.slice(0, 4), false], [[T, 'abc', T2], true], [[T], true, 'thừa'], [{}], [true]])
      await h.both(S.adminA, 'ctFav', a, { label: 'ctFav ' + JSON.stringify(a).replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>').slice(0, 100) + ' @admin A' });
    await h.both(S.adminA, 'ctList', [], { label: 'ctList sau ctFav' });

    /* ================= ctHistory ================= */
    await f.matrix('ctHistory', [T], { label: 'ctHistory công tác của A' });
    for (const id of [T2, T3, base[1], base[3], lot[0], idB, idRoot]) for (const s of [S.adminA, S.adminB, S.root]) await h.both(s, 'ctHistory', [id], { label: 'ctHistory @' + s.label });
    for (const a of [[], [null], [''], [0], [false], ['abc'], [123], [true], [{}], [[]], ['00000000-0000-4000-8000-00000000dead'], ['*']]) await h.both(S.adminA, 'ctHistory', a, { label: 'ctHistory ' + JSON.stringify(a) + ' @admin A' });
    await h.rpc(S.adminA, 'ctHistory', [[T]], { label: 'ctHistory id = [id]' });
    await h.rpc(S.adminA, 'ctHistory', [T, 'thừa']);

    /* ================= ctDelete ================= */
    const DL = (args, s, opts) => h.rpc(s || S.adminA, 'ctDelete', args, opts);
    await h.both(S.anon, 'ctDelete', [[T]]);
    await h.both(S.adminB, 'ctDelete', [[T, T2]], { label: 'ctDelete công tác công ty khác @admin B (không xoá)' });
    await h.both(S.viewB, 'ctDelete', [[T]], { label: 'ctDelete công tác A @super xem B (không xoá)' });
    await h.both(S.adminA, 'ctDelete', [[idB, idRoot]], { label: 'ctDelete công tác công ty khác / không công ty @admin A (không xoá)' });
    await h.both(S.adminView, 'ctDelete', [[idB]]);
    for (const a of [[], [null], [[]], [''], [0], ['abc'], [bad], [bad.concat(bad)], [{}], [true], [['00000000-0000-4000-8000-00000000dead']]])
      await h.both(S.adminA, 'ctDelete', a, { label: 'ctDelete ' + JSON.stringify(a).slice(0, 100) + ' @admin A' });
    await h.dbCheck('sau các lần ctDelete không được phép / sai tham số', ['work_items', 'work_item_histories', 'audit_logs']);
    await DL([[lot[0], lot[1]]], S.adminA, { label: 'ctDelete 2 công tác' });
    await h.rest(S.adminA, 'ctDelete', [[lot[2]]], { label: 'ctDelete (REST) 1 công tác' });
    await DL([[lot[2], lot[3], 'abc', lot[0]]], S.adminA, { label: 'ctDelete lẫn id đã xoá / id sai / id còn' });
    await DL([lot[4]], S.adminA, { label: 'ctDelete ids là 1 id' });
    await h.rest(S.adminA, 'ctDelete', [lot[5]], { label: 'ctDelete (REST) ids là 1 id' });
    await DL([[lot[6]], 'thừa']);
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA]) await DL([[own[s.label]]], s, { label: 'ctDelete công tác tự thêm @' + s.label });
    await DL([[T2]], S.root, { label: 'ctDelete công tác của A @super không công ty' });
    await DL([[idB]], S.adminB);
    await DL([[idRoot, own[S.viewB.label]]], S.root);
    await h.both(S.adminA, 'ctHistory', [lot[0]], { label: 'ctHistory công tác đã xoá (còn lịch sử)' });
    await h.both(S.adminA, 'ctUpdate', [lot[0], { gc: 'đã xoá' }], { label: 'ctUpdate công tác đã xoá' });
    await h.both(S.adminA, 'ctDuyet', [[lot[0]], true], { label: 'ctDuyet công tác đã xoá (ok = 0)' });
    await h.both(S.adminA, 'ctFav', [[lot[0]], true], { label: 'ctFav công tác đã xoá (ok = 0)' });
    await f.matrix('ctList', [], { label: 'ctList cuối kịch bản' });
    for (const s of [S.adminA, S.adminB, S.root]) await h.rpc(s, 'getAuditLog', [200], { label: 'getAuditLog @' + s.label + ' sau các thao tác công tác' });

    /* ================= POST /export/cong-tac ================= */
    const post = (label, sess, body, opts) => {
      const hd = { 'Content-Type': 'application/json' };
      if (sess && sess.token && !(opts && opts.viaBody)) hd.Authorization = h.pair('Bearer ' + sess.token.node, 'Bearer ' + sess.token.go);
      if (sess && sess.view) hd['x-view-company'] = sess.view;
      const b = (side) => { const o = typeof body === 'string' ? body : JSON.stringify(Object.assign({}, body, opts && opts.viaBody && sess && sess.token ? { token: sess.token[side] } : {})); return o; };
      return h.raw('POST /export/cong-tac ' + label, { method: 'POST', path: '/export/cong-tac', headers: hd, body: h.pair(b('node'), b('go')) }, opts);
    };
    const xr = (i, extra) => Object.assign({ stt: i, loai: 'Khái toán chi tiết', hangMuc: 'Phần móng', noiDung: 'Công việc ' + i + '\nxuống dòng', dvt: 'm3', khoiLuong: 12.5 * i, dienTich: 100.25, heSo: 1.05, dgnt: 90000 * i, dg: 120000 * i, ghiChu: 'Ghi chú ' + i }, extra || {});
    await post('chưa đăng nhập', null, { rows: [xr(1)] });
    await post('token sai', { token: h.pair('a.b', 'a.b') }, { rows: [xr(1)] });
    for (const s of [S.none, S.edit, S.adminA, S.adminB, S.root, S.viewA]) await post('3 dòng @' + s.label, s, { rows: [xr(1), xr(2), xr(3)] });
    await post('token trong thân (body.token)', S.adminA, { rows: [xr(1)] }, { viaBody: true });
    for (const b of [{}, { rows: [] }, { rows: null }, { rows: 'chuỗi' }, { rows: 5 }, { rows: {} }, { rows: { length: 1, 0: xr(1) } }, { Rows: [xr(1)] }, { rows: true }]) await post('thân ' + JSON.stringify(b).slice(0, 60) + ' (không có dòng)', S.adminA, b);
    for (const b of ['[]', '[{"rows":[1]}]', 'null', '"x"', '5', '']) await post('thân thô ' + JSON.stringify(b), S.adminA, b, b[0] === '[' || b[0] === '{' || b === '' ? undefined : { accept: f.badJson });
    // [khoảng trống B.low] xác thực của route lẻ: token hết hạn, header thắng thân, Content-Type không phải JSON, thân quá lớn, tài khoản / công ty bị khoá
    await f.routeAuth('/export/cong-tac', { rows: [xr(1), xr(2)] }, 'ct');
    // từng ô, đủ kiểu
    const cells = [];
    for (const key of ['khoiLuong', 'dienTich', 'heSo', 'dgnt', 'dg']) for (const v of [0, 1, 2.5, '4', '2,5', '2.5', -1, -0, 'abc', null, '', true, false, ' 7 ', '1e2', 1e21, 1e-7, '12.500.000', [5], [], {}, 0.1 + 0.2, '0x10', 123456789012345680000]) cells.push([key, v]);
    for (const key of ['stt', 'loai', 'hangMuc', 'noiDung', 'dvt', 'ghiChu']) for (const v of ['chữ', '', null, 0, 5, 1.5, -3, true, false, '  thừa  ', "nháy ' \" \\ & < > 😀", 'dòng 1\r\ndòng 2\rdòng 3', 'x'.repeat(5000), '=SUM(A1:A2)', '\u0001\u0008 ký tự điều khiển \u007f', 1e21, '2026-10-13']) cells.push([key, v]);
    let k = 0;
    while (k < cells.length) {
      const part = cells.slice(k, k + 24);
      await post('ô ' + part[0][0] + ' = ' + f.show(part[0][1]) + ' … (' + part.length + ' dòng, mỗi dòng 1 giá trị lạ)', S.adminA, { rows: part.map(([key, v], i) => xr(k + i + 1, { [key]: v })) });
      k += 24;
    }
    await post('dòng thiếu mọi trường / khoá lạ', S.adminA, { rows: [{}, { zzz: 1 }, { stt: 1 }, { noiDung: 'chỉ nội dung' }, xr(5)] });
    for (const rws of [[null], [xr(1), null], ['chuỗi'], [5], [true], [[]], [[1, 2]], [xr(1), 'chuỗi', 7, [], {}]]) await post('rows = ' + JSON.stringify(rws).slice(0, 50) + ' (phần tử không phải object)', S.adminA, { rows: rws });
    await post('1 dòng', S.adminA, { rows: [xr(1)] });
    await post('5000 dòng', S.adminA, { rows: Array.from({ length: 5000 }, (_, i) => ({ stt: i + 1, noiDung: 'Dòng ' + i, dg: i })) });
    await post('5003 dòng (cắt còn 5000)', S.adminA, { rows: Array.from({ length: 5003 }, (_, i) => ({ stt: i + 1, noiDung: 'Dòng ' + i, khoiLuong: i / 4 })) });
    await post('khoá thừa trong thân', S.adminA, { rows: [xr(1)], ten: 'x', cols: [1], token: null });
    await h.raw('GET /export/cong-tac (sai phương thức)', { method: 'GET', path: '/export/cong-tac', headers: { Authorization: h.pair('Bearer ' + S.adminA.token.node, 'Bearer ' + S.adminA.token.go) } });
    // ô số vô hạn và ô là object đặc biệt của ExcelJS (công thức, rich text, liên kết, lỗi)
    await post('ô số vô hạn "1e999"', S.adminA, { rows: [xr(1, { khoiLuong: '1e999' }), xr(2, { dg: '-1e999' })] });
    for (const v of [{ formula: 'A1+1' }, { formula: 'A1+1', result: 7 }, { richText: [{ text: 'đậm', font: { bold: true } }, { text: ' thường' }] }, { text: 'liên kết', hyperlink: 'https://example.invalid/x' }, { error: '#N/A' }, { sharedFormula: 'A1' }, { a: 1 }, [1, 2], []])
      await post('ô noiDung là object ' + JSON.stringify(v), S.adminA, { rows: [xr(1, { noiDung: v, stt: v })] });
  },
};
