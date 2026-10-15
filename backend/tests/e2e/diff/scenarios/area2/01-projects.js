'use strict';
/* Module projects: getProjects, createProject, updateProject, deleteProject, duplicateProject, bootstrap
   (server/store_supa.js 222-312, 1014-1023). Mã dự án tự đặt (DY...) để 2 phía trùng nhau; mã tự sinh DA-... chỉ thử ở vài bước. */
const { fx } = require('./_fx');

module.exports = {
  name: 'area2/01 projects',
  async run(h) {
    const f = await fx(h), S = f.S;
    const FULL = { ten: 'Biệt thự Thảo Điền', khachHang: 'Anh Nguyễn Văn "Tèo" & chị <Hoa>', diaChi: '12 Nguyễn Văn Hưởng, Q.2', sdt: '0901 234 567', trangThai: 'Đang thực hiện',
      vat: 8, tienDo: 35.5, ghiChu: 'Dòng 1\nDòng 2\ttab', quyMo: '1 trệt 2 lầu', tongDT: '350,5', dtBaoGia: '412.75', nhuCau: 'Ở', phanKhuc: 'Cao cấp', maBaoGia: 'BG-2026/010',
      nhomTuTao: '["Nhóm A","Nhóm B"]', tangTuTao: 'Tầng 1|Tầng 2', tenBanNhap: 'Bản nháp số 1', linkDezon: 'https://dezon.vn/du-an/thao-dien?x=1&y=2' };

    /* ================= getProjects (trước khi tạo gì) ================= */
    await f.matrix('getProjects', []);
    await h.both(S.viewDz, 'getProjects', []);
    await h.both(S.viewB, 'getProjects', []);
    await h.both(S.adminView, 'getProjects', []);
    await h.both(S.adminA, 'getProjects', ['thừa', 1]);

    /* ================= createProject ================= */
    await h.both(S.anon, 'createProject', [{ maDA: 'DY-ANON', ten: 'x' }]);
    await h.rpc(S.adminA, 'createProject', [Object.assign({ maDA: 'DY-A1' }, FULL)]);
    await h.rest(S.adminA, 'createProject', [Object.assign({ maDA: 'DY-A2' }, FULL, { ten: 'Nhà phố Q7', trangThai: 'Hoàn thành', vat: 10, tienDo: 100 })]);
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY-A3', ten: 'Chỉ có tên' }]);
    await h.rpc(S.none, 'createProject', [{ maDA: 'DY-A4', ten: 'NV không perms tạo' }]);
    await h.rpc(S.edit, 'createProject', [{ maDA: 'DY-A5', ten: 'NV sp_edit tạo', trangThai: 'Bản nháp' }]);
    await h.rpc(S.adminB, 'createProject', [{ maDA: 'DY-B1', ten: 'Dự án của B', khachHang: 'Khách B', vat: 5 }]);
    await h.rest(S.adminB, 'createProject', [{ maDA: 'DY-B2', ten: 'Dự án 2 của B' }]);
    await h.rpc(S.root, 'createProject', [{ maDA: 'DY-R1', ten: 'Super không công ty tạo' }]);
    await h.rpc(S.viewA, 'createProject', [{ maDA: 'DY-VA1', ten: 'Super xem A tạo' }]);
    await h.rest(S.viewB, 'createProject', [{ maDA: 'DY-VB1', ten: 'Super xem B tạo' }]);
    await h.rpc(S.adminView, 'createProject', [{ maDA: 'DY-A6', ten: 'admin A gửi x-view-company (vẫn là A)' }]);
    // mã tự sinh
    let r = await h.rpc(S.adminA, 'createProject', [{ ten: 'Mã tự sinh' }]);
    const gen1 = r.val('result.maDA');
    r = await h.rest(S.adminA, 'createProject', [{ ten: 'Mã tự sinh qua REST', maDA: '' }]);
    const gen2 = r && r.val('result.maDA');
    // trùng mã: cùng công ty, khác công ty (mã duy nhất toàn hệ thống), super
    await h.both(S.adminA, 'createProject', [{ maDA: 'DY-A1', ten: 'trùng' }]);
    await h.both(S.adminB, 'createProject', [{ maDA: 'DY-A1', ten: 'trùng khác công ty' }]);
    await h.both(S.root, 'createProject', [{ maDA: 'DY-B1', ten: 'trùng @super' }]);
    // tham số thiếu / null / sai kiểu
    let k = 0;
    for (const a of [[], [null], ['chuỗi'], [5], [0], [true], [[]], [[{ maDA: 'DY-ARR' }]], [{}], [{ maDA: null }], [{ ten: null, khachHang: '' }]])
      await h.rpc(S.adminA, 'createProject', a, { label: 'createProject ' + JSON.stringify(a) + ' (mã tự sinh) @admin A' });
    for (const a of [[], [null], ['chuỗi'], [5], [[]], [{}]]) await h.rest(S.adminA, 'createProject', a, { label: 'createProject ' + JSON.stringify(a) + ' qua REST @admin A' });
    // kiểu của mã
    for (const ma of [123, 12.5, true, ' DY khoảng trắng ', 'DY/gạch chéo', 'DY%25&?#=x', "DY'nháy\"kép", 'DY-ĐẶC-BIỆT-ấ', 'DY-😀', 'dy-a1', 'DY-A1 ', 'x'.repeat(300), ['DY-M1'], ['DY-M2', 'DY-M3'], { a: 1 }, -0, 1e21])
      await h.rpc(S.adminA, 'createProject', [{ maDA: ma, ten: 'kiểu mã ' + (++k) }], { label: 'createProject maDA = ' + f.show(ma) + ' @admin A' });
    // giá trị từng trường: đưa THẲNG xuống database (không ép kiểu) -> lỗi của Postgres phải giống hệt
    const bad = [['trangThai', 'Đã huỷ'], ['trangThai', 'bản nháp'], ['trangThai', 0], ['trangThai', false], ['vat', '10'], ['vat', '8.5'], ['vat', '8,5'], ['vat', 'abc'], ['vat', 100], ['vat', 100.01], ['vat', -1], ['vat', 0],
      ['vat', true], ['vat', [5]], ['vat', {}], ['vat', 1e-7], ['vat', 12.345678901234567], ['vat', ' 7 '], ['vat', '1e1'], ['vat', 'NaN'], ['vat', 'Infinity'], ['tienDo', 50], ['tienDo', '99.9'], ['tienDo', 101], ['tienDo', -0.5], ['tienDo', 'x'],
      ['ten', 123], ['ten', 0], ['ten', false], ['ten', true], ['ten', { a: 1, b: [2] }], ['ten', ['a', 'b']], ['ten', []], ['ten', 1.5e300], ['ten', '  có khoảng trắng  '], ['ten', 'Đ'.repeat(5000)], ['ten', 'null byte \u0000 giữa'],
      ['sdt', 84901234567], ['tongDT', 350.5], ['dtBaoGia', 0], ['nhomTuTao', ['A', 'B']], ['tangTuTao', { t: 1 }], ['linkDezon', 'javascript:alert(1)'], ['ghiChu', '😀 emoji \\ gạch " nháy   dòng']];
    for (const [key, v] of bad) await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY-F' + (++k), [key]: v }], { label: 'createProject ' + key + ' = ' + f.show(v) + ' @admin A' });
    for (const [key, v] of [['trangThai', 'Đã huỷ'], ['vat', '8,5'], ['vat', 101], ['ten', { a: 1 }], ['tienDo', 'x'], ['vat', '12']]) await h.rest(S.adminA, 'createProject', [{ maDA: 'DY-FR' + (++k), [key]: v }], { label: 'createProject ' + key + ' = ' + f.show(v) + ' qua REST' });
    // khoá lạ bị bỏ qua, khoá của cột khác không lọt, thứ tự khoá bất kỳ
    await h.rpc(S.adminA, 'createProject', [{ zzz: 1, id: 999999, cong_ty_id: 'x', ngayTao: '2020-01-01', capNhat: 'x', ma_da: 'DY-HACK', ten_du_an: 'x', vat: 3, maDA: 'DY-A7', ten: 'khoá lạ' }, 'thừa']);
    await f.matrix('getProjects', [], { label: 'getProjects sau khi tạo' });
    await h.both(S.viewB, 'getProjects', []);

    /* ================= updateProject ================= */
    const U = (args, s, opts) => h.both(s || S.adminA, 'updateProject', args, opts);
    await U(['DY-A1', { ten: 'x' }], S.anon);
    for (const key of Object.keys(FULL)) await U(['DY-A3', { [key]: FULL[key] }], S.adminA, { label: 'updateProject DY-A3 ' + key });
    await U(['DY-A3', Object.assign({}, FULL, { ten: 'Sửa nhiều trường', vat: 0, tienDo: 0 })]);
    for (const [key, v] of bad.concat([['ten', null], ['vat', null], ['vat', ''], ['tienDo', null], ['trangThai', null], ['trangThai', ''], ['khachHang', ''], ['ghiChu', null], ['trangThai', 'Hoàn thành'], ['trangThai', 'Bản nháp']]))
      await U(['DY-A4', { [key]: v }], S.adminA, { label: 'updateProject DY-A4 ' + key + ' = ' + f.show(v) });
    for (const a of [[], [null], ['DY-A4'], ['DY-A4', null], ['DY-A4', 'chuỗi'], ['DY-A4', 5], ['DY-A4', []], ['DY-A4', [{ ten: 'x' }]], ['DY-A4', {}], ['DY-A4', { zzz: 1, maDA: 'DY-DOI-MA', id: 1, ma_da: 'x' }], ['DY-A4', { ten: 'thừa tham số' }, 'thừa'],
      [null, { ten: 'x' }], ['', { ten: 'x' }], [0, { ten: 'x' }], [true, { ten: 'x' }], [{}, { ten: 'x' }], [['DY-A4'], { ten: 'mã là mảng 1 phần tử' }], [['DY-A4', 'DY-A5'], { ten: 'x' }], ['KHÔNG-CÓ', { ten: 'x' }], ['dy-a4', { ten: 'khác hoa thường' }],
      [' DY-A4 ', { ten: 'x' }], ['DY-A4,DY-A5', { ten: 'x' }], ['(DY-A4)', { ten: 'x' }], ['DY-A4&ma_da=neq.x', { ten: 'tiêm filter' }], ['*', { ten: 'x' }], ['%', { ten: 'x' }], [123, { ten: 'mã số 123' }], ['123', { ten: 'mã chuỗi 123' }], [12.5, { ghiChu: 'mã 12.5' }]])
      await U(a, S.adminA, { label: 'updateProject ' + JSON.stringify(a).slice(0, 90) + ' @admin A' });
    for (const ma of [' DY khoảng trắng ', 'DY/gạch chéo', 'DY%25&?#=x', "DY'nháy\"kép", 'DY-ĐẶC-BIỆT-ấ', 'DY-😀', 'x'.repeat(300)]) await h.rpc(S.adminA, 'updateProject', [ma, { ghiChu: 'sửa qua mã đặc biệt' }], { label: 'updateProject mã ' + f.show(ma) });
    for (const ma of [' DY khoảng trắng ', 'DY%25&?#=x', "DY'nháy\"kép", 'DY-ĐẶC-BIỆT-ấ', 'DY-😀']) await h.rest(S.adminA, 'updateProject', [ma, { ghiChu: 'sửa qua REST' }], { label: 'updateProject (REST) mã ' + f.show(ma) });
    // phạm vi công ty
    await U(['DY-A1', { ghiChu: 'B sửa dự án của A' }], S.adminB, { label: 'updateProject dự án công ty khác @admin B (null)' });
    await U(['DY-B1', { ghiChu: 'A sửa dự án của B' }], S.adminA, { label: 'updateProject dự án công ty khác @admin A (null)' });
    await U(['DY-B1', { ghiChu: 'A + x-view-company B' }], S.adminView);
    await U(['DY-A1', { ghiChu: 'super xem B sửa dự án A' }], S.viewB, { label: 'updateProject dự án A @super xem B (null)' });
    await U(['DY-A1', { ghiChu: 'super xem A sửa' }], S.viewA);
    await U(['DY-A1', { ghiChu: 'super không công ty sửa' }], S.root);
    await U(['DY-R1', { ghiChu: 'admin A sửa dự án không công ty' }], S.adminA, { label: 'updateProject dự án không công ty @admin A (null)' });
    await U(['DY-R1', { ten: 'super sửa dự án không công ty', vat: 7 }], S.root);
    for (const s of [S.none, S.edit, S.duyet, S.boc]) await U(['DY-A5', { ghiChu: 'sửa bởi ' + s.label }], s);
    await U([gen1, { ten: 'Sửa dự án mã tự sinh' }]);
    if (gen2) await U([gen2, { trangThai: 'Hoàn thành' }]);
    await f.matrix('getProjects', [], { label: 'getProjects sau khi sửa' });

    /* ================= dữ liệu con để thử nhân bản / xoá dây chuyền ================= */
    const prod = (i, extra) => Object.assign({ ma: 'DY-SP-' + i, ten: 'Sản phẩm ' + i, nhom: '3.2.' + (1 + (i % 4)), hangMuc: 'Đèn âm trần', tang: 'Tầng ' + (1 + (i % 2)), thuongHieu: 'TH' + i, ncc: 'NCC ' + i, dvt: 'Bộ', donGiaVon: 100000 * i, chietKhau: 10 + i, lnPct: 20 + i, ckKhach: i, extra: { nganh: 'den', i } }, extra || {});
    for (let i = 1; i <= 4; i++) await h.rpc(S.adminA, 'addLine', ['DY-A1', prod(i), i]);
    await h.rpc(S.adminA, 'addBlankLine', ['DY-A1', { tang: 'Tầng 3', nhom: '3.2.5' }]);
    await h.rpc(S.adminA, 'saveCover', ['DY-A1', [{ stt: '1', hangMuc: 'TƯ VẤN', moTa: 'mô tả', chiPhi: 1000000 }, { stt: '3', hangMuc: 'XÂY DỰNG', moTa: '', chiPhi: 0 }, { stt: '3.2', hangMuc: 'Hoàn thiện', moTa: 'x', chiPhi: 2500000.5 }]]);
    for (const [key, v] of [['phanTho', [{ ten: 'Móng', tt: 1e6, items: [{ n: 'Đào đất', dvt: 'm3', kl: 10, dg: 1e5, tt: 1e6 }] }]], ['ptVat', 8], ['area', { rows: [[1, 'Sàn', 120.5]] }], ['bgHist', [{ ver: 1, at: 'x' }]], ['bgCfg', { ck: 5, dk: 'Điều khoản' }], ['cpCfg', { a: 1 }]])
      await h.rpc(S.adminA, 'setProjData', ['DY-A1', key, v]);
    await h.rpc(S.adminB, 'addLine', ['DY-B1', prod(9), 2]);
    await h.rpc(S.adminB, 'saveCover', ['DY-B1', [{ stt: '1', hangMuc: 'B', chiPhi: 5 }]]);
    await h.rpc(S.adminB, 'setProjData', ['DY-B1', 'ptVat', 10]);
    await h.rpc(S.root, 'addLine', ['DY-R1', prod(7), 1]);

    /* ================= duplicateProject ================= */
    const dups = [];
    const D = async (args, s, opts, viaRest) => {
      const rr = await (viaRest ? h.rest : h.rpc).call(h, s || S.adminA, 'duplicateProject', args, opts);
      const ma = rr && rr.node.json && rr.node.json.result && rr.go.json && rr.go.json.result ? rr.val('result.maDA') : null;
      if (ma) {
        dups.push(ma);
        // bản sao phải có đúng dòng / tờ bìa / dữ liệu rời theo tuỳ chọn
        const who = s || S.adminA;
        await h.rpc(who, 'getLines', [ma], { label: '  -> getLines bản sao' });
        await h.rpc(who, 'getCoverOrInit', [ma], { label: '  -> getCoverOrInit bản sao' });
        await h.rpc(who, 'getProjData', [ma], { label: '  -> getProjData bản sao' });
      }
      return ma;
    };
    await h.both(S.anon, 'duplicateProject', ['DY-A1']);
    await D(['DY-A1']);
    await D(['DY-A1'], S.adminA, undefined, true);
    for (const o of [{}, null, { boc: false }, { cover: false }, { pt: false }, { boc: false, cover: false, pt: false }, { boc: true, cover: true, pt: true }, { boc: 0, cover: 0, pt: 0 }, { boc: null, cover: null, pt: null }, { boc: 'false', cover: '', pt: 'false' }, 'chuỗi', 5, [], true, false, 0, { zzz: 1 }])
      await D(['DY-A1', o], S.adminA, { label: 'duplicateProject DY-A1 opts = ' + f.show(o) });
    for (const o of [{}, { boc: false }, { cover: false }, { pt: false }, { boc: false, cover: false, pt: false }]) await D(['DY-A1', o], S.adminA, { label: 'duplicateProject (REST) DY-A1 opts = ' + f.show(o) }, true);
    await D(['DY-A3'], S.adminA, { label: 'duplicateProject dự án không có dòng / tờ bìa / dữ liệu' });
    await D(['DY-A1', { pt: false }, 'thừa']);
    const dd = await D(['DY-A1']);
    if (dd) await D([dd], S.adminA, { label: 'duplicateProject bản sao của bản sao' });
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA, S.root]) await D(['DY-A1', { cover: false }], s, { label: 'duplicateProject DY-A1 @' + s.label });
    await D(['DY-R1'], S.root, { label: 'duplicateProject dự án không công ty @super' });
    await D(['DY-B1'], S.root, { label: 'duplicateProject dự án của B @super không công ty (bản sao giữ công ty B)' });
    await D(['DY-B1'], S.adminB);
    // không tìm thấy nguồn
    for (const [a, s, lab] of [[['DY-B1'], S.adminA, 'dự án công ty khác @admin A'], [['DY-A1'], S.adminB, 'dự án công ty khác @admin B'], [['DY-A1'], S.viewB, 'dự án A @super xem B'], [['DY-R1'], S.adminA, 'dự án không công ty @admin A'],
      [['KHÔNG-CÓ'], S.adminA, 'mã không có'], [[], S.adminA, 'thiếu mã'], [[null], S.adminA, 'mã null'], [[''], S.adminA, 'mã rỗng'], [[0], S.adminA, 'mã 0'], [[{}], S.adminA, 'mã object'], [[['DY-A1']], S.adminA, 'mã là mảng 1 phần tử'], [[true], S.adminA, 'mã true'], [['dy-a1'], S.adminA, 'khác hoa thường'], [[123, { boc: false }], S.adminA, 'mã số 123 (có dự án mã "123")']])
      await h.both(s, 'duplicateProject', a, { label: 'duplicateProject ' + lab });
    await f.matrix('getProjects', [], { label: 'getProjects sau khi nhân bản' });

    /* ================= bootstrap ================= */
    await f.matrix('bootstrap', []);
    await f.matrix('bootstrap', ['DY-A1'], { label: 'bootstrap DY-A1 (dự án của A, có dòng)' });
    for (const s of [S.adminB, S.viewB, S.root]) await h.both(s, 'bootstrap', ['DY-B1']);
    await h.both(S.viewDz, 'bootstrap', []);
    await h.both(S.adminView, 'bootstrap', ['DY-B1']);
    for (const a of [[null], [''], [0], [1], [123], ['123'], [true], [false], [{}], [[]], [['DY-A1']], ['KHÔNG-CÓ'], ['DY-A3'], ['DY-A1', 'thừa'], [' DY-A1 '], ['dy-a1'], ['DY-A1&x=1'], ['DY/gạch chéo'], ['DY%25&?#=x']])
      await h.both(S.adminA, 'bootstrap', a, { label: 'bootstrap ' + JSON.stringify(a) + ' @admin A' });
    if (dd) await h.both(S.adminA, 'bootstrap', [dd], { label: 'bootstrap bản sao (mã tự sinh)' });

    /* [khoảng trống B.low: lỗi database ở nhánh ĐỌC theo mã dự án] mã có byte NUL -> Postgres từ chối tham số (22021). bootstrap nuốt lỗi của getLines
       và trả lines = [] (store_supa.js:1020); các hàm khác trả lỗi 500. Chỉ rpc: byte NUL không đi qua đường dẫn REST được. Không lời gọi nào ghi dữ liệu. */
    for (const ma of ['DY\u0000X', '\u0000', 'DY-A1\u0000', '\u0000DY-A1']) {
      for (const s of [S.adminA, S.root, S.viewA]) await h.rpc(s, 'bootstrap', [ma], { label: 'bootstrap mã có byte NUL ' + JSON.stringify(ma) + ' @' + s.label });
      await h.rpc(S.adminA, 'updateProject', [ma, { ten: 'không ghi được' }], { label: 'updateProject mã có byte NUL ' + JSON.stringify(ma) });
      await h.rpc(S.adminA, 'duplicateProject', [ma], { label: 'duplicateProject mã có byte NUL ' + JSON.stringify(ma) });
      await h.rpc(S.adminA, 'deleteProject', [ma], { label: 'deleteProject mã có byte NUL ' + JSON.stringify(ma) });
    }
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY\u0000NUL', ten: 'mã có byte NUL' }], { label: 'createProject mã có byte NUL (lỗi database, không tạo)' });
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY-NUL-TEN', ten: 'tên có byte \u0000 NUL' }], { label: 'createProject tên có byte NUL (lỗi database, không tạo)' });
    await h.both(S.adminA, 'getProjects', [], { label: 'getProjects sau các lời gọi có byte NUL (không đổi)' });

    /* ================= deleteProject ================= */
    const X = (args, s, opts) => h.both(s || S.adminA, 'deleteProject', args, opts);
    await X(['DY-A2'], S.anon);
    // không thuộc công ty đang xem: trả ok nhưng KHÔNG xoá gì
    await X(['DY-B1'], S.adminA, { label: 'deleteProject dự án công ty khác @admin A (ok, không xoá)' });
    await X(['DY-A1'], S.adminB, { label: 'deleteProject dự án công ty khác @admin B (ok, không xoá)' });
    await X(['DY-A1'], S.viewB, { label: 'deleteProject dự án A @super xem B (ok, không xoá)' });
    await X(['DY-R1'], S.adminA, { label: 'deleteProject dự án không công ty @admin A (ok, không xoá)' });
    await X(['DY-B1'], S.adminView);
    for (const a of [[], [null], [''], [0], [true], [{}], [[]], [['DY-A6']], [['DY-A1', 'DY-A2']], ['KHÔNG-CÓ'], ['dy-a1'], [' DY-A1 '], ['DY-A1,DY-A2'], ['*'], ['%'], ['DY-A1&ma_da=neq.x'], ['in.(DY-A1)'], ['DY-A7', 'thừa']])
      await X(a, S.adminA, { label: 'deleteProject ' + JSON.stringify(a) + ' @admin A' });
    await h.dbCheck('sau các lần xoá không được phép / sai tham số', ['projects', 'quotation_lines', 'cost_estimate_lines', 'project_data_entries']);
    // xoá thật: dây chuyền dòng + tờ bìa + dữ liệu rời
    for (const ma of dups.slice(0, 6)) await h.rpc(S.adminA, 'deleteProject', [ma], { label: 'deleteProject bản sao (mã tự sinh)' });
    for (const ma of dups.slice(6, 10)) await h.rest(S.adminA, 'deleteProject', [ma], { label: 'deleteProject bản sao (mã tự sinh) qua REST' });
    for (const s of [S.none, S.edit, S.duyet, S.boc]) { const ma = dups.pop(); if (ma) await h.rpc(s, 'deleteProject', [ma], { label: 'deleteProject bản sao @' + s.label }); }
    await X(['DY-A2']);
    await X(['DY-A2'], S.adminA, { label: 'deleteProject DY-A2 lần 2 (đã xoá)' });
    for (const ma of [' DY khoảng trắng ', 'DY/gạch chéo', 'DY%25&?#=x', "DY'nháy\"kép", 'DY-😀', 123, 12.5]) await h.rpc(S.adminA, 'deleteProject', [ma], { label: 'deleteProject mã ' + f.show(ma) });
    await h.rest(S.adminA, 'deleteProject', ['DY-ĐẶC-BIỆT-ấ']);
    await h.rpc(S.viewA, 'deleteProject', ['DY-VA1']);
    await h.rest(S.viewB, 'deleteProject', ['DY-VB1']);
    await h.rpc(S.root, 'deleteProject', ['DY-B2'], { label: 'deleteProject dự án của B @super không công ty' });
    await h.rpc(S.adminB, 'deleteProject', ['DY-B1'], { label: 'deleteProject DY-B1 (có dòng + tờ bìa + dữ liệu) @admin B' });
    await h.rpc(S.root, 'deleteProject', ['DY-R1']);
    for (const ma of ['DY-B1', 'DY-A2', 'DY-R1']) { await h.rpc(S.root, 'getLines', [ma], { label: 'getLines ' + ma + ' sau khi xoá' }); await h.rpc(S.root, 'getProjData', [ma], { label: 'getProjData ' + ma + ' sau khi xoá' }); }
    // thao tác trên dự án đã xoá
    await h.both(S.adminA, 'updateProject', ['DY-A2', { ten: 'đã xoá' }], { label: 'updateProject dự án đã xoá (null)' });
    await h.both(S.adminA, 'duplicateProject', ['DY-A2'], { label: 'duplicateProject dự án đã xoá' });
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY-A2', ten: 'Tạo lại mã đã xoá' }]);
    await f.matrix('getProjects', [], { label: 'getProjects cuối kịch bản' });
    await f.matrix('bootstrap', ['DY-A1'], { label: 'bootstrap DY-A1 cuối kịch bản' });
  },
};
