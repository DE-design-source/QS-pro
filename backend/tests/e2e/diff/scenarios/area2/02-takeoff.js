'use strict';
/* Module takeoff: getLines, addLine, addBlankLine, updateLine, deleteLine, saveLineAsProduct
   (server/store_supa.js 314-405, 955-964; cửa ngõ quyền server/auth.js 547-551). */
const { fx } = require('./_fx');

// Giá trị số đủ kiểu: số, chuỗi kiểu VN ("12.500.000", "12,5", "30%"), sai kiểu, ngoài khoảng ràng buộc của database
const NUMS = [0, 1, 3, '4', '2,5', 2.5, '2.5', -1, -0, 'abc', null, true, false, '', ' 7 ', '1e2', 1e21, 1e15, '12.500.000', '1.234', '1.234,5', '1,234,567', '30%', '-5', [5], [1, 2], [], {}, 0.1 + 0.2, 1e-7, 99.5, 100, 100.4, 101, 150, '0x10', 'Infinity', '５'];
const TEXTS = ['văn bản mới', '', null, 123, 0, false, true, 1.5, { a: 1 }, ['x', 'y'], [], 'x'.repeat(2000), "nháy ' \" \\ \n dòng 😀 <b>&amp;", '  thừa khoảng trắng  '];
const LINE_KEYS = ['nhom', 'loai', 'tang', 'ten', 'thuongHieu', 'ncc', 'moTa', 'kichThuoc', 'hinhAnh', 'dvt', 'khuVuc', 'maBanVe', 'maSP', 'trangThai', 'ghiChu'];
const BASE = { soLuong: 3, donGiaVon: 1000000, chietKhau: 10, lnPct: 30, ckKhach: 5, giamGiaNcc: 0, tuNhap: 0, daLuuDM: 0 };

module.exports = {
  name: 'area2/02 takeoff',
  async run(h) {
    const f = await fx(h), S = f.S;
    for (const [s, ma] of [[S.adminA, 'DY-T1'], [S.adminA, 'DY-T2'], [S.adminA, 'DY-T3'], [S.adminB, 'DY-TB'], [S.root, 'DY-TR']]) await h.rpc(s, 'createProject', [{ maDA: ma, ten: 'Bóc tách ' + ma, vat: 8 }]);
    const idOf = (r) => (r && r.node.json && r.node.json.result ? r.val('result.lineId') : null);

    /* ================= sản phẩm thật của từng ngành (danh mục Dezon trong seed) ================= */
    let r = await h.rpc(S.viewDz, 'getProducts', [], { label: 'getProducts @super xem Dezon (lấy sản phẩm mẫu từng ngành)' });
    const cat = (r.node.json && r.node.json.result) || [];
    const byNganh = {};
    cat.forEach((p) => { const k = p.nganh || 'den'; (byNganh[k] = byNganh[k] || []).push(p); });
    h.check('danh mục seed có sản phẩm của các ngành: ' + Object.keys(byNganh).map((k) => k + '=' + byNganh[k].length).join(', '), cat.length > 0, cat.length, 0);
    const SYN = { den: { ma: 'DY-DEN', ten: 'Đèn âm trần 12W', hangMuc: 'Đèn âm trần', nganh: 'den' }, vs: { ma: 'DY-VS', ten: 'Bồn cầu 1 khối', hangMuc: 'Bồn cầu', nganh: 'vs', kichThuocVS: '700x400' },
      son: { ma: 'DY-SON', ten: 'Sơn nội thất 18L', hangMuc: 'Sơn nội thất', nganh: 'son' }, ct: { ma: 'DY-CT', ten: 'Ổ cắm đôi', hangMuc: 'Ổ cắm', nganh: 'ct' } };
    let stt = 0;
    for (const ng of ['den', 'vs', 'son', 'ct']) {
      const list = (byNganh[ng] || []).slice(0, 3);
      if (!list.length) list.push(Object.assign({ donGiaVon: 250000, dvt: 'Cái' }, SYN[ng]));
      for (const p of list) {
        // như giao diện: gửi nguyên object sản phẩm + nhóm / tầng đang chọn. Ảnh đổi sang địa chỉ nội bộ (không bao giờ bị tải khi xuất file)
        const prod = Object.assign({}, p, { nhom: '3.2.' + (ng === 'den' ? 5 : ng === 'son' ? 2 : ng === 'vs' ? '6.1' : '6.2'), tang: 'Tầng ' + (1 + (stt % 3)), khuVuc: 'Phòng ' + (++stt), hinhAnh: p.hinhAnh ? 'https://127.0.0.1/' + ng + '.png' : '', extra: { nganh: ng, muc: p.muc || '' } });
        await h.rpc(S.adminA, 'addLine', ['DY-T1', prod, stt], { label: 'addLine sản phẩm ngành ' + ng + ' (' + String(p.ma).slice(0, 30) + ') x' + stt });
        await h.rest(S.adminA, 'addLine', ['DY-T2', prod, stt + 0.5], { label: 'addLine (REST) sản phẩm ngành ' + ng + ' (' + String(p.ma).slice(0, 30) + ')' });
      }
    }
    await h.both(S.adminA, 'getLines', ['DY-T1']);
    await h.both(S.adminA, 'getLines', ['DY-T2']);

    /* ================= addLine ================= */
    const A = (args, s, opts) => h.rpc(s || S.adminA, 'addLine', args, opts);
    await h.both(S.anon, 'addLine', ['DY-T1', { ten: 'x' }, 1]);
    const full = { ma: 'SP-FULL', ten: 'Dòng đủ trường', nhom: '3.2.5', hangMuc: 'Đèn rọi', loai: 'bị hangMuc che', tang: 'Tầng 2', thuongHieu: 'Philips', ncc: 'NCC "A"', moTa: 'Mô tả\n2 dòng', kichThuoc: 'Ø90×45', hinhAnh: 'http://localhost/a.png\nhttps://127.0.0.1/b.jpg', dvt: 'Bộ',
      khuVuc: 'Phòng khách', maBanVe: 'L-01', donGiaVon: 1250000, chietKhau: 12.5, lnPct: 25, ckKhach: 3, trangThai: 'Đã chốt', ghiChu: 'ghi chú', tuNhap: 1, daLuuDM: 1, extra: { nganh: 'den', z: [1, { y: null }], a: 'b' }, zzz: 'khoá lạ', giamGiaNcc: 9 };
    await A(['DY-T1', full, 2]);
    await h.rest(S.adminA, 'addLine', ['DY-T1', full, 2]);
    await A(['DY-T1', Object.assign({}, full, { hangMuc: '', donGiaBan: 1999000 }), 1], S.adminA, { label: 'addLine loai khi hangMuc rỗng + donGiaBan (tính lại %LN)' });
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA, S.root, S.adminView]) await A(['DY-T1', { ten: 'Thêm bởi ' + s.label, donGiaVon: 1000 }, 1], s);
    await A(['DY-TB', { ten: 'Dòng của B', donGiaVon: 5000, lnPct: 10 }, 2], S.adminB);
    await A(['DY-TR', { ten: 'Dòng dự án không công ty', donGiaVon: 7000 }, 3], S.root);
    // dự án không có / không thuộc công ty đang xem
    for (const [a, s, lab] of [[['KHÔNG-CÓ', { ten: 'x' }, 1], S.adminA, 'dự án không có'], [['DY-TB', { ten: 'x' }, 1], S.adminA, 'dự án công ty khác @admin A'], [['DY-T1', { ten: 'x' }, 1], S.adminB, 'dự án công ty khác @admin B'], [['DY-T1', { ten: 'x' }, 1], S.viewB, 'dự án A @super xem B'],
      [['DY-TR', { ten: 'x' }, 1], S.adminA, 'dự án không công ty @admin A'], [['DY-TB', { ten: 'super không công ty thêm vào dự án B' }, 1], S.root, 'dự án B @super không công ty'], [['KHÔNG-CÓ', { ten: 'x' }, 1], S.root, 'dự án không có @super'], [['dy-t1', { ten: 'x' }], S.adminA, 'mã khác hoa thường'], [[' DY-T1 ', { ten: 'x' }], S.adminA, 'mã thừa khoảng trắng']])
      await h.both(s, 'addLine', a, { label: 'addLine ' + lab });
    for (const a of [[], [null], ['DY-T3'], ['DY-T3', null], ['DY-T3', null, null], ['DY-T3', 'chuỗi'], ['DY-T3', 5, 2], ['DY-T3', [], 2], ['DY-T3', [{ ten: 'trong mảng' }], 2], ['DY-T3', true], ['DY-T3', {}, 0, 'thừa'], [null, { ten: 'x' }], ['', { ten: 'x' }], [0, { ten: 'x' }], [{}, { ten: 'x' }], [['DY-T3'], { ten: 'mã là mảng' }], [true, { ten: 'x' }]])
      await h.both(S.adminA, 'addLine', a, { label: 'addLine ' + JSON.stringify(a) + ' @admin A' });
    for (const v of NUMS) await A(['DY-T3', { ten: 'sl ' + f.show(v), donGiaVon: 1000 }, v], S.adminA, { label: 'addLine soLuong = ' + f.show(v) });
    for (const v of [0, '3', '2,5', -1, 'abc', null, true, 1e21, [5]]) await h.rest(S.adminA, 'addLine', ['DY-T3', { ten: 'sl REST ' + f.show(v), donGiaVon: 1000 }, v], { label: 'addLine (REST) soLuong = ' + f.show(v) });
    for (const key of ['donGiaVon', 'donGiaBan', 'chietKhau', 'ckKhach', 'lnPct', 'tuNhap', 'daLuuDM'])
      for (const v of NUMS) await A(['DY-T3', Object.assign({ ten: key + ' ' + f.show(v), donGiaVon: 200000 }, { [key]: v }), 2], S.adminA, { label: 'addLine ' + key + ' = ' + f.show(v) });
    for (const key of ['nhom', 'hangMuc', 'loai', 'tang', 'ma', 'ten', 'thuongHieu', 'ncc', 'moTa', 'kichThuoc', 'hinhAnh', 'dvt', 'khuVuc', 'maBanVe', 'trangThai', 'ghiChu'])
      for (const v of TEXTS) await A(['DY-T3', { ten: 'chữ ' + key, [key]: v }, 1], S.adminA, { label: 'addLine ' + key + ' = ' + f.show(v) });
    for (const v of [{}, { a: 1, b: { c: [1, 2] } }, null, 0, '', 'chuỗi', [1, 2], [], 5, true, false, { nganh: 'vs', z: 1, a: 2, aa: 3 }, '{"a":1}'])
      await A(['DY-T3', { ten: 'extra ' + f.show(v), extra: v }, 1], S.adminA, { label: 'addLine extra = ' + f.show(v) });
    // làm tròn: Math.round của JS làm tròn nửa về +vô cực (kể cả số âm), -0
    for (const p of [{ donGiaVon: 200, donGiaBan: 199 }, { donGiaVon: 200, donGiaBan: 195 }, { donGiaVon: 200, donGiaBan: 205 }, { donGiaVon: 200, donGiaBan: 201 }, { donGiaVon: 15, chietKhau: 10 }, { donGiaVon: 25, chietKhau: 10 }, { donGiaVon: 35, chietKhau: 10, ckKhach: 10, lnPct: 10 },
      { donGiaVon: 8, donGiaBan: 9 }, { donGiaVon: 8, donGiaBan: 7 }, { donGiaVon: 9, donGiaBan: 8 }, { donGiaVon: 0, donGiaBan: 500 }, { donGiaVon: 0, donGiaBan: 0, lnPct: 40 }, { donGiaVon: '12.500.000', donGiaBan: '15.000.000', ckKhach: '7,5', chietKhau: '12,5' },
      { donGiaVon: 1005, lnPct: 0.05 }, { donGiaVon: 333, lnPct: 33.333, chietKhau: 33.3, ckKhach: 3.33 }, { donGiaVon: 1000, lnPct: -150 }, { donGiaVon: 1000, lnPct: -100 }, { donGiaVon: 1000, lnPct: -50.05 }, { donGiaVon: 1.5, donGiaBan: 2.5 }, { donGiaVon: 0.4, donGiaBan: 0.6 },
      { donGiaVon: 1000, donGiaBan: '' }, { donGiaVon: 1000, donGiaBan: null, lnPct: 15 }, { donGiaVon: 1000, donGiaBan: '0' }, { donGiaVon: 1000, donGiaBan: 0, lnPct: 15 }, { donGiaVon: 1000, donGiaBan: 'abc', lnPct: 15 }, { donGiaVon: 1000, donGiaBan: false }, { donGiaVon: 123456789.5, chietKhau: 33.33, lnPct: 12.5, ckKhach: 2.5 }])
      for (const sl of [1, 0.5, 2.5, 3]) await A(['DY-T3', Object.assign({ ten: 'làm tròn ' + JSON.stringify(p) }, p), sl], S.adminA, { label: 'addLine làm tròn ' + JSON.stringify(p) + ' x' + sl });
    await h.both(S.adminA, 'getLines', ['DY-T3']);

    /* ================= addBlankLine ================= */
    await h.both(S.anon, 'addBlankLine', ['DY-T1']);
    for (const a of [['DY-T1'], ['DY-T1', null], ['DY-T1', {}], ['DY-T1', { tang: 'Tầng 5', nhom: '3.2.7' }], ['DY-T1', { tang: 5, nhom: ['a', 'b'] }], ['DY-T1', { tang: null, nhom: 0 }], ['DY-T1', { tang: { a: 1 }, nhom: true }], ['DY-T1', 'chuỗi'], ['DY-T1', 7], ['DY-T1', []], ['DY-T1', { zzz: 1 }, 'thừa'],
      [], [null], [''], ['KHÔNG-CÓ', { tang: 'x' }], ['DY-TB', { tang: 'công ty khác' }]])
      await h.both(S.adminA, 'addBlankLine', a, { label: 'addBlankLine ' + JSON.stringify(a) + ' @admin A' });
    for (const s of [S.none, S.edit, S.adminB, S.viewA, S.viewB, S.root]) await h.both(s, 'addBlankLine', ['DY-T1', { tang: 'bởi ' + s.label }]);
    await h.both(S.adminB, 'addBlankLine', ['DY-TB', { nhom: '3.2.1' }]);

    /* ================= getLines ================= */
    await f.matrix('getLines', ['DY-T1']);
    for (const s of [S.adminA, S.adminB, S.viewB, S.root, S.adminView]) await h.both(s, 'getLines', ['DY-TB']);
    for (const s of [S.adminA, S.root, S.viewA]) await h.both(s, 'getLines', ['DY-TR']);
    for (const a of [[], [null], [''], [0], [1], [true], [{}], [[]], [['DY-T1']], [['DY-T1', 'DY-T2']], ['KHÔNG-CÓ'], ['dy-t1'], [' DY-T1 '], ['DY-T1,DY-T2'], ['DY-T1&ma_du_an=neq.x'], ['*'], ['DY-T1', 'thừa']])
      await h.both(S.adminA, 'getLines', a, { label: 'getLines ' + JSON.stringify(a) + ' @admin A' });

    /* [khoảng trống B.low: lỗi database ở nhánh đọc của getLines, store_supa.js:331-334] mã dự án có byte NUL -> lỗi 22021; chỉ rpc.
       Thêm 1 thân có byte không phải UTF-8 trong chuỗi (body-parser của Node thay bằng U+FFFD rồi mới tra). */
    for (const ma of ['DY\u0000X', '\u0000', 'DY-T1\u0000']) for (const s of [S.adminA, S.root]) await h.rpc(s, 'getLines', [ma], { label: 'getLines mã có byte NUL ' + JSON.stringify(ma) + ' @' + s.label });
    await h.rpc(S.adminA, 'addLine', ['DY\u0000X', { ten: 'không ghi được', ma: 'SP-NUL' }, 1], { label: 'addLine mã dự án có byte NUL (không ghi)' });
    await h.rpc(S.adminA, 'addBlankLine', ['DY\u0000X', {}], { label: 'addBlankLine mã dự án có byte NUL (không ghi)' });
    await h.rpc(S.adminA, 'getLines', undefined, { rawBody: Buffer.concat([Buffer.from('{"args":["DY-'), Buffer.from([0xff, 0xfe, 0xc3]), Buffer.from('"]}')]), label: 'getLines mã có byte không phải UTF-8 (thân thô)' });

    /* ================= updateLine ================= */
    const mkLine = async (s, ma, ten) => idOf(await h.rpc(s, 'addLine', [ma, Object.assign({ ten: ten || 'Dòng gốc', ma: 'SP-GOC', nhom: '3.2.5', hangMuc: 'Đèn', tang: 'Tầng 1', dvt: 'Bộ', extra: { nganh: 'den' } }, BASE), BASE.soLuong]));
    const L = await mkLine(S.adminA, 'DY-T1'), LB = await mkLine(S.adminB, 'DY-TB', 'Dòng gốc của B'), LR = await mkLine(S.root, 'DY-TR', 'Dòng gốc không công ty');
    const U = (args, s, opts) => h.both(s || S.adminA, 'updateLine', args, opts);
    const reset = () => h.rpc(S.adminA, 'updateLine', [L, Object.assign({ stt: 500, donGiaBan: 1300000 }, BASE)], { label: 'updateLine đưa dòng về giá trị gốc' });
    await U([L, { ghiChu: 'x' }], S.anon);
    for (const key of LINE_KEYS) for (const v of TEXTS) await U([L, { [key]: v }], S.adminA, { label: 'updateLine ' + key + ' = ' + f.show(v) });
    await reset();
    for (const key of ['soLuong', 'donGiaVon', 'chietKhau', 'ckKhach', 'lnPct', 'donGiaBan', 'giamGiaNcc', 'tuNhap', 'daLuuDM', 'stt']) {
      for (const v of NUMS) await U([L, { [key]: v }], S.adminA, { label: 'updateLine ' + key + ' = ' + f.show(v) });
      await reset();
    }
    for (const v of [{}, { a: 1, b: { c: [1, 2] } }, null, 0, '', 'chuỗi', [1, 2], [], 5, true, false, { nganh: 'vs', z: 1, a: 2, aa: 3 }, '{"a":1}']) await U([L, { extra: v }], S.adminA, { label: 'updateLine extra = ' + f.show(v) });
    // quy tắc giá: có donGiaBan -> tính lại %LN; không có lnPct lẫn donGiaVon -> GIỮ giá bán đã lưu; còn lại tính từ %LN
    for (const p of [{ donGiaBan: 1500000 }, { ghiChu: 'chỉ sửa ghi chú: giữ giá bán' }, { lnPct: 33 }, { ghiChu: 'giữ giá bán sau khi đổi %LN' }, { donGiaVon: 900000 }, { chietKhau: 15 }, { ckKhach: 7 }, { soLuong: 7 }, { donGiaVon: 800000, donGiaBan: 1000000 }, { donGiaVon: 800000, lnPct: 12 },
      { donGiaBan: 950000, lnPct: 99 }, { donGiaVon: 0, donGiaBan: 500 }, { donGiaVon: 0 }, { donGiaVon: 0, lnPct: 50 }, { donGiaVon: 200, donGiaBan: 199 }, { donGiaVon: 200, donGiaBan: 195 }, { donGiaVon: 200, donGiaBan: 205 }, { donGiaVon: 15, chietKhau: 10, lnPct: 0 }, { donGiaVon: 25, chietKhau: 10 },
      { donGiaVon: 8, chietKhau: 0, ckKhach: 0, donGiaBan: 9 }, { donGiaBan: 7 }, { donGiaVon: 9, donGiaBan: 8, soLuong: 0.5 }, { soLuong: 2.5, donGiaBan: 333 }, { soLuong: 0.3, donGiaBan: 1.5 }, { lnPct: -150, donGiaVon: 1000 }, { lnPct: -100, donGiaVon: 1000 }, { lnPct: 33.333, donGiaVon: 333 },
      { donGiaVon: '12.500.000', donGiaBan: '15.000.000', ckKhach: '7,5', chietKhau: '12,5', soLuong: '3' }, { donGiaVon: '1.234,5' }, { donGiaBan: '2.000.000 đ' }, { donGiaBan: null }, { donGiaBan: '' }, { donGiaVon: null }, { donGiaVon: '', lnPct: '' }, { lnPct: null }, { soLuong: null, chietKhau: null, ckKhach: null },
      Object.assign({ ten: 'Sửa mọi trường', maSP: 'SP-MOI', nhom: '3.2.6.1', loai: 'Bồn cầu', tang: 'Tầng 9', thuongHieu: 'TOTO', ncc: 'NCC mới', moTa: 'mô tả mới', kichThuoc: '700x400', hinhAnh: 'https://127.0.0.1/c.png', dvt: 'Cái', khuVuc: 'WC', maBanVe: 'W-1', trangThai: 'Chờ', ghiChu: 'gc', stt: 3.5, extra: { nganh: 'vs' }, giamGiaNcc: 12.5, tuNhap: 1, daLuuDM: 1 }, BASE),
      { zzz: 1, lineId: 999, maDA: 'DY-T2', id: 5, ma_du_an: 'DY-T2', thanhTienBan: 1, thanhTienVon: 1, donGia: 1 }, {}])
      await U([L, p], S.adminA, { label: 'updateLine ' + JSON.stringify(p).slice(0, 100) });
    await reset();
    for (const a of [[], [null], [L], [L, null], [L, 'chuỗi'], [L, 5], [L, true], [L, []], [L, [{ ghiChu: 'x' }]], [L, { ghiChu: 'thừa' }, 'thừa']]) await U(a, S.adminA, { label: 'updateLine tham số ' + f.show(a.slice(1)) + ' @admin A' });
    for (const id of [null, '', 0, -1, 999999999, 1.5, '1.5', 'abc', true, false, {}, [], [1, 2], '9223372036854775808', '1e3', ' 5 ', '5 or 1=1', '(5)', 'in.(1,2)', 'null', '*'])
      await U([id, { ghiChu: 'id lạ' }], S.adminA, { label: 'updateLine lineId = ' + f.show(id) + ' @admin A' });
    await h.rpc(S.adminA, 'updateLine', [h.pair([L.node || L], [L.go || L]), { ghiChu: 'lineId là mảng 1 phần tử' }], { label: 'updateLine lineId = [id]' });
    await h.rpc(S.adminA, 'updateLine', [Number(L.node || L), { ghiChu: 'lineId là số' }], { label: 'updateLine lineId kiểu số' });
    // phạm vi công ty
    await U([LB, { ghiChu: 'A sửa dòng của B' }], S.adminA, { label: 'updateLine dòng công ty khác @admin A (null)' });
    await U([L, { ghiChu: 'B sửa dòng của A' }], S.adminB, { label: 'updateLine dòng công ty khác @admin B (null)' });
    await U([L, { ghiChu: 'super xem B sửa dòng A' }], S.viewB, { label: 'updateLine dòng A @super xem B (null)' });
    await U([LB, { ghiChu: 'admin A + x-view-company B' }], S.adminView);
    await U([LR, { ghiChu: 'admin A sửa dòng không công ty' }], S.adminA, { label: 'updateLine dòng dự án không công ty @admin A (null)' });
    await U([LR, { ghiChu: 'super sửa', donGiaBan: 9999 }], S.root);
    await U([LB, { ghiChu: 'super không công ty sửa dòng của B', soLuong: 4 }], S.root);
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA, S.root]) await U([L, { ghiChu: 'sửa bởi ' + s.label, soLuong: 2 }], s);
    await U([LB, { ten: 'B tự sửa', donGiaVon: '2.500.000', lnPct: 20 }], S.adminB);
    await h.both(S.adminA, 'getLines', ['DY-T1'], { label: 'getLines DY-T1 sau updateLine' });

    /* ================= saveLineAsProduct ================= */
    const SP = (args, s, opts) => h.rpc(s || S.adminA, 'saveLineAsProduct', args, opts);
    const sp1 = { ten: 'DY SP lưu từ dòng 1', ma: 'DY-LSP-1', nhom: 'Đèn LED', hangMuc: 'Đèn âm trần', thuongHieu: 'Philips', ncc: 'NCC A', dvt: 'Bộ', gia: 1500000, donGiaBan: 9, moTa: 'ghi chú SP', hinhAnh: 'https://127.0.0.1/sp.png' };
    await h.both(S.anon, 'saveLineAsProduct', [sp1]);
    await SP([sp1], S.adminA, { label: 'saveLineAsProduct tạo mới' });
    await SP([sp1], S.adminA, { label: 'saveLineAsProduct lần 2 cùng mã (cập nhật)' });
    await h.rest(S.adminA, 'saveLineAsProduct', [Object.assign({}, sp1, { ten: 'DY SP sửa qua REST', gia: '1.750.000' })]);
    await h.rest(S.adminA, 'saveLineAsProduct', [Object.assign({}, sp1, { ma: 'DY-LSP-2', ten: 'DY SP tạo qua REST' })]);
    const hmOf = (ng) => (byNganh[ng] && byNganh[ng][0] && byNganh[ng][0].hangMuc) || SYN[ng].hangMuc;
    for (const ng of ['vs', 'son', 'ct']) await SP([{ ten: 'DY SP ngành ' + ng, ma: 'DY-LSP-' + ng, hangMuc: hmOf(ng), gia: 123456, dvt: '' }], S.adminA, { label: 'saveLineAsProduct hạng mục ngành ' + ng + ' (' + hmOf(ng) + ')' });
    let i = 10;
    for (const p of [{ ten: 'DY không mã' }, { ten: 'DY không mã' }, { ten: 'DY mã rỗng', ma: '' }, { ten: 'DY mã khoảng trắng', ma: '   ' }, { ten: 'DY mã số', ma: 12345 }, { ten: 'DY mã số', ma: 12345 }, { ten: 12345, ma: 'DY-LSP-TS' }, { ten: 0, ma: 'DY-LSP-T0' }, { ten: true, ma: 'DY-LSP-TT' },
      { ten: '   ', ma: 'DY-LSP-TR' }, { ten: null, ma: 'DY-LSP-TN' }, { ma: 'DY-LSP-TU' }, {}, { ten: { a: 1 }, ma: 'DY-LSP-TO' }, { ten: ['a', 'b'], ma: 'DY-LSP-TA' }, { ten: '  DY có khoảng trắng  ', ma: '  DY-LSP-SP  ' },
      { ten: 'DY giá chuỗi VN', ma: 'DY-LSP-G1', gia: '2.500.000' }, { ten: 'DY giá thập phân', ma: 'DY-LSP-G2', gia: '12,5' }, { ten: 'DY giá 0', ma: 'DY-LSP-G3', gia: 0, donGiaBan: 777 }, { ten: 'DY giá null lấy donGiaBan', ma: 'DY-LSP-G4', gia: null, donGiaBan: 888000 },
      { ten: 'DY giá rỗng', ma: 'DY-LSP-G5', gia: '', donGiaBan: 5 }, { ten: 'DY giá chữ', ma: 'DY-LSP-G6', gia: 'abc' }, { ten: 'DY giá âm', ma: 'DY-LSP-G7', gia: -5 }, { ten: 'DY giá true', ma: 'DY-LSP-G8', gia: true }, { ten: 'DY giá mảng', ma: 'DY-LSP-G9', gia: [5] }, { ten: 'DY giá object', ma: 'DY-LSP-GA', gia: {} },
      { ten: 'DY chỉ donGiaBan', ma: 'DY-LSP-GB', donGiaBan: '3.300.000' }, { ten: 'DY trường sai kiểu', ma: 'DY-LSP-K1', nhom: 5, hangMuc: { a: 1 }, thuongHieu: ['x'], ncc: false, dvt: 0, moTa: 1.5, hinhAnh: true },
      { ten: 'DY ký tự lạ "nháy" \\ & <b> 😀', ma: "DY-LSP-'\"\\,()", thuongHieu: 'a,b', ncc: '(x)' }, { ten: 'DY mã có dấu phẩy', ma: 'DY,LSP' }, { ten: 'DY mã có dấu phẩy lần 2', ma: 'DY,LSP' }, { ten: 'x'.repeat(600), ma: 'DY-LSP-DAI' }])
      await SP([p], S.adminA, { label: 'saveLineAsProduct #' + (++i) + ' ' + JSON.stringify(p).slice(0, 90) });
    for (const a of [[], [null], ['chuỗi'], [5], [0], [true], [[]], [[sp1]], [sp1, 'thừa']]) await h.both(S.adminA, 'saveLineAsProduct', a, { label: 'saveLineAsProduct ' + JSON.stringify(a).slice(0, 60) + ' @admin A' });
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.adminB, S.root, S.viewA, S.viewB]) {
      await SP([{ ten: 'DY SP của ' + s.label, ma: 'DY-LSP-Q', gia: 1000 }], s, { label: 'saveLineAsProduct mã DY-LSP-Q @' + s.label });
      await h.rest(s, 'saveLineAsProduct', [{ ten: 'DY SP của ' + s.label + ' (REST)', ma: 'DY-LSP-Q', gia: 2000 }], { label: 'saveLineAsProduct (REST) mã DY-LSP-Q @' + s.label });
    }
    for (const s of [S.adminA, S.adminB, S.root]) await h.rpc(s, 'getProductHistory', ['DY-LSP-Q'], { label: 'getProductHistory DY-LSP-Q @' + s.label });
    await h.rpc(S.adminA, 'getAuditLog', [100], { label: 'getAuditLog @admin A sau saveLineAsProduct' });

    /* ================= deleteLine ================= */
    const X = (args, s, opts) => h.both(s || S.adminA, 'deleteLine', args, opts);
    await X([L], S.anon);
    await X([LB], S.adminA, { label: 'deleteLine dòng công ty khác @admin A (ok, không xoá)' });
    await X([L], S.adminB, { label: 'deleteLine dòng công ty khác @admin B (ok, không xoá)' });
    await X([L], S.viewB, { label: 'deleteLine dòng A @super xem B (ok, không xoá)' });
    await X([LR], S.adminA, { label: 'deleteLine dòng dự án không công ty @admin A (ok, không xoá)' });
    await X([LB], S.adminView);
    for (const id of [undefined, null, '', 0, -1, 999999999, 1.5, 'abc', true, {}, [], '9223372036854775808', ' 5 ', '5 or 1=1', 'in.(1,2)', '*'])
      await X(id === undefined ? [] : [id], S.adminA, { label: 'deleteLine id = ' + f.show(id) + ' @admin A' });
    await h.dbCheck('sau các lần deleteLine không được phép / sai tham số', ['quotation_lines']);
    r = await h.rpc(S.adminA, 'getLines', ['DY-T3'], { label: 'getLines DY-T3 (lấy id để xoá)' });
    const ids = ((r.node.json && r.node.json.result) || []).map((x) => x.lineId);
    await h.rpc(S.adminA, 'deleteLine', [ids[0]]);
    await h.rest(S.adminA, 'deleteLine', [ids[1]]);
    await X([ids[1]], S.adminA, { label: 'deleteLine lần 2 (đã xoá)' });
    await h.rpc(S.adminA, 'deleteLine', [Number(ids[2])], { label: 'deleteLine id kiểu số' });
    await h.rpc(S.adminA, 'deleteLine', [[ids[3]]], { label: 'deleteLine id = [id]' });
    await h.rpc(S.adminA, 'deleteLine', [[ids[4], ids[5]]], { label: 'deleteLine id = [id1, id2]' });
    await h.rpc(S.adminA, 'deleteLine', [ids[6], 'thừa']);
    let n = 7;
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA, S.root]) await h.rpc(s, 'deleteLine', [ids[n++]], { label: 'deleteLine @' + s.label });
    await X([LR], S.root);
    await X([LB], S.root, { label: 'deleteLine dòng của B @super không công ty' });
    await X([L]);
    await h.both(S.adminA, 'updateLine', [L, { ghiChu: 'dòng đã xoá' }], { label: 'updateLine dòng đã xoá (null)' });
    // thêm dòng sau khi xoá: STT = sort_no lớn nhất + 1 (không đếm số dòng)
    await h.rpc(S.adminA, 'addLine', ['DY-T1', { ten: 'Sau khi xoá' }, 1]);
    await h.rpc(S.adminA, 'updateLine', [ids[20], { stt: 9000 }]);
    await h.rpc(S.adminA, 'addLine', ['DY-T3', { ten: 'Sau khi đặt stt 9000' }, 1]);
    await h.rpc(S.adminA, 'updateLine', [ids[21], { stt: 'abc' }]);
    await h.rpc(S.adminA, 'updateLine', [ids[22], { stt: -5 }]);
    await h.rpc(S.adminA, 'addLine', ['DY-T3', { ten: 'Sau khi có stt chữ / âm' }, 1]);
    for (const ma of ['DY-T1', 'DY-T2', 'DY-T3']) await h.both(S.adminA, 'getLines', [ma], { label: 'getLines ' + ma + ' cuối kịch bản' });
    await h.both(S.adminB, 'getLines', ['DY-TB'], { label: 'getLines DY-TB cuối kịch bản' });
    await h.both(S.adminA, 'bootstrap', ['DY-T1'], { label: 'bootstrap DY-T1 (dòng của 4 ngành)' });
  },
};
