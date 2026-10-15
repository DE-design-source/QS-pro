'use strict';
/* Module projects (phần dữ liệu rời): getProjData, setProjData (server/store_supa.js 1082-1153).
   Khoá của dự án nằm ở du_an_data; mã '__cty' -> cài đặt của CÔNG TY (cai_dat_cong_ty), tách theo công ty đang đăng nhập. */
const { fx } = require('./_fx');
const KEYS = ['phanTho', 'area', 'ptInfo', 'ptVat', 'cpCfg', 'bgCfg', 'bgHist', 'bgOrg', 'mhPay', 'btFmt'];

module.exports = {
  name: 'area2/03 project data',
  async run(h) {
    const f = await fx(h), S = f.S;
    for (const [s, ma] of [[S.adminA, 'DY-D1'], [S.adminA, 'DY-D2'], [S.adminB, 'DY-DB'], [S.root, 'DY-DR']]) await h.rpc(s, 'createProject', [{ maDA: ma, ten: 'Dữ liệu rời ' + ma }]);
    const G = (args, s, opts) => h.both(s || S.adminA, 'getProjData', args, opts);
    const P = (args, s, opts) => h.rpc(s || S.adminA, 'setProjData', args, opts);
    const PR = (args, s, opts) => h.rest(s || S.adminA, 'setProjData', args, opts);

    /* ================= trước khi ghi gì ================= */
    await f.matrix('getProjData', ['DY-D1']);
    await G(['__cty'], S.adminA);
    await G(['__cty'], S.root);

    /* ================= setProjData: khoá của dự án ================= */
    await h.both(S.anon, 'setProjData', ['DY-D1', 'ptVat', 8]);
    const VAL = { phanTho: [{ ten: 'Móng', tt: 15000000, items: [{ n: 'Đào đất', dvt: 'm3', kl: 12.5, dgnt: 90000, ttnt: 1125000, dg: 120000, tt: 1500000, gc: 'ghi chú' }] }], area: { rows: [['Tầng 1', 120.5, 1], ['Mái', 60, 0.5]], tong: 150.5 },
      ptInfo: { nhaThau: 'Cty XD', sdt: '0909' }, ptVat: 8, cpCfg: { cols: ['a', 'b'], on: true }, bgCfg: { ck: 5, vat: 10, dieuKhoan: 'Thanh toán 3 đợt\n- Đợt 1: 30%' }, bgHist: [{ ver: 1, at: '2026-10-01', cols: ['ten'], cover: { mau: 1 } }],
      bgOrg: { ten: 'Công ty riêng của dự án', mst: '0312345678' }, mhPay: { 'MH-1': [{ dot: 1, tien: 1e6 }] }, btFmt: { A1: { b: 1, bg: '#fff' } } };
    for (const key of KEYS) await P(['DY-D1', key, VAL[key]], S.adminA, { label: 'setProjData DY-D1 ' + key + ' (tạo)' });
    for (const key of KEYS) await PR(['DY-D2', key, VAL[key]], S.adminA, { label: 'setProjData (REST) DY-D2 ' + key + ' (tạo)' });
    await G(['DY-D1']); await G(['DY-D2']);
    for (const key of KEYS) await P(['DY-D1', key, { sua: key, lan: 2 }], S.adminA, { label: 'setProjData DY-D1 ' + key + ' (ghi đè)' });
    await PR(['DY-D2', 'ptVat', 10], S.adminA, { label: 'setProjData (REST) DY-D2 ptVat (ghi đè)' });
    // giá trị đủ kiểu JSON
    const vals = [null, 0, -0, 1, -1.5, 0.1, 1e21, 1e-7, 12345678901234567890, 9007199254740993, true, false, '', 'chuỗi', ' 12 ', '{"a":1}', [], {}, [null], [1, 'a', null, true, [2, [3]]], { a: null }, { z: 1, a: 2, aa: 3, B: 4, '10': 5, '2': 6, '': 7 },
      { 'khoá có dấu': 'giá trị 😀', "nháy'\"\\": '\u0000 null byte' }, { sau: { sau2: { sau3: { sau4: [{ x: 1 }] } } } }, 'x'.repeat(200000), Array.from({ length: 500 }, (_, i) => ({ i, t: 'dòng ' + i }))];
    for (const v of vals) await P(['DY-D1', 'area', v], S.adminA, { label: 'setProjData DY-D1 area = ' + f.show(v) });
    for (const v of vals.slice(0, 22)) { await PR(['DY-D2', 'area', v], S.adminA, { label: 'setProjData (REST) DY-D2 area = ' + f.show(v) }); }
    await G(['DY-D1'], S.adminA, { label: 'getProjData DY-D1 sau giá trị đủ kiểu' }); await G(['DY-D2'], S.adminA, { label: 'getProjData DY-D2 sau giá trị đủ kiểu' });
    await P(['DY-D1', 'area'], S.adminA, { label: 'setProjData thiếu giaTri (-> null)' });
    await PR(['DY-D2', 'cpCfg'], S.adminA, { label: 'setProjData (REST) thiếu giaTri (-> null)' });
    await P(['DY-D1', 'cpCfg', { a: 1 }, 'thừa']);
    // cách viết số / khoá trùng trong thân JSON thô
    const raw = (ma, key, json) => h.rpc(S.adminA, 'setProjData', undefined, { rawBody: '{"args":["' + ma + '","' + key + '",' + json + ']}', label: 'setProjData ' + ma + ' ' + key + ' thân thô ' + json.slice(0, 80) });
    for (const j of ['{"x":1.0,"y":1e2,"z":12345678901234567890,"w":0.1e-6,"v":-0,"u":1E+2,"t":100000000000000000000000,"s":0.30000000000000004,"r":1.10,"q":123456789012345678901234567890.123456789}', '{"a":1,"a":2,"b":{"c":1,"c":[2]}}', '[1.50,2.0,3e0,-0.0,1e400]', '1.0', '5e-324', '1e309', '"\\ud83d\\ude00 \\u00e9 \\/ \\u0041"', '{"__proto__":{"x":1},"constructor":2,"toString":"3"}'])
      await raw('DY-D1', 'btFmt', j);
    await G(['DY-D1'], S.adminA, { label: 'getProjData DY-D1 sau thân thô' });
    // tham số
    for (const a of [[], [null], ['DY-D1'], ['DY-D1', null], ['DY-D1', ''], ['', 'ptVat', 1], [null, 'ptVat', 1], [0, 'ptVat', 1], [false, 'ptVat', 1], ['   ', 'ptVat', 1], ['DY-D1', '   ', 1], ['DY-D1', 'khoaLa', 1], ['DY-D1', 'PTVAT', 1], ['DY-D1', 'ptVat ', 2], [' DY-D1 ', ' ptVat ', 3], ['DY-D1', 0, 1],
      ['DY-D1', true, 1], ['DY-D1', ['ptVat'], 4], ['DY-D1', ['ptVat', 'area'], 1], ['DY-D1', {}, 1], ['DY-D1', 'constructor', 1], ['DY-D1', 'toString', 1], [['DY-D1'], 'ptVat', 5], [{}, 'ptVat', 1], [true, 'ptVat', 1], ['dy-d1', 'ptVat', 1], ['KHÔNG-CÓ', 'ptVat', 1], ['DY-D1,DY-D2', 'ptVat', 1], ['DY-D1&khoa=eq.area', 'ptVat', 1]])
      await h.both(S.adminA, 'setProjData', a, { label: 'setProjData ' + JSON.stringify(a) + ' @admin A' });
    // phạm vi công ty + ai ghi (nguoi_sua)
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA, S.root, S.adminView]) { await P(['DY-D1', 'mhPay', { boi: s.label }], s); await PR(['DY-D1', 'mhPay', { boi: s.label, rest: 1 }], s); }
    await h.both(S.adminA, 'setProjData', ['DY-DB', 'ptVat', 99], { label: 'setProjData dự án công ty khác @admin A' });
    await h.both(S.adminB, 'setProjData', ['DY-D1', 'ptVat', 99], { label: 'setProjData dự án công ty khác @admin B' });
    await h.both(S.viewB, 'setProjData', ['DY-D1', 'ptVat', 98], { label: 'setProjData dự án A @super xem B' });
    await h.both(S.adminA, 'setProjData', ['DY-DR', 'ptVat', 97], { label: 'setProjData dự án không công ty @admin A' });
    await h.both(S.root, 'setProjData', ['DY-DR', 'ptVat', 7], { label: 'setProjData dự án không công ty @super' });
    await h.both(S.root, 'setProjData', ['DY-DB', 'ptVat', 6], { label: 'setProjData dự án B @super không công ty' });
    await h.both(S.adminB, 'setProjData', ['DY-DB', 'area', { b: 1 }]);
    await h.dbCheck('sau setProjData theo dự án', ['project_data_entries', 'company_settings']);

    /* ================= setProjData: '__cty' -> cài đặt công ty (2 công ty + không công ty) ================= */
    await h.both(S.anon, 'setProjData', ['__cty', 'ptInfo', { x: 1 }]);
    await P(['__cty', 'ptInfo', { cty: 'A', nhaThau: 'Nhà thầu của A' }], S.adminA, { label: 'setProjData __cty ptInfo @admin A (tạo)' });
    await P(['__cty', 'bgOrg', { ten: 'CÔNG TY A', mst: '01' }], S.adminA, { label: 'setProjData __cty bgOrg @admin A (tạo)' });
    await PR(['__cty', 'ptInfo', { cty: 'B', nhaThau: 'Nhà thầu của B' }], S.adminB, { label: 'setProjData (REST) __cty ptInfo @admin B (tạo)' });
    await P(['__cty', 'bgOrg', { ten: 'CÔNG TY B' }], S.adminB, { label: 'setProjData __cty bgOrg @admin B (tạo)' });
    await P(['__cty', 'ptInfo', { cty: null, nhaThau: 'Không công ty' }], S.root, { label: 'setProjData __cty ptInfo @super không công ty (dòng cong_ty_id NULL)' });
    await PR(['__cty', 'bgOrg', 'super'], S.root, { label: 'setProjData (REST) __cty bgOrg @super không công ty' });
    await P(['__cty', 'ptInfo', { cty: 'A', sua: 'lần 2' }], S.adminA, { label: 'setProjData __cty ptInfo @admin A (ghi đè)' });
    await PR(['__cty', 'bgOrg', { ten: 'CÔNG TY A sửa qua REST' }], S.adminA, { label: 'setProjData (REST) __cty bgOrg @admin A (ghi đè)' });
    await P(['__cty', 'ptInfo', { cty: null, sua: 'super lần 2' }], S.root, { label: 'setProjData __cty ptInfo @super không công ty (ghi đè)' });
    await P(['__cty', 'btFmt', { boi: 'super xem A' }], S.viewA, { label: 'setProjData __cty btFmt @super xem A (ghi vào công ty A)' });
    await P(['__cty', 'btFmt', { boi: 'super xem B' }], S.viewB);
    await P(['__cty', 'cpCfg', { boi: 'admin A + x-view-company B' }], S.adminView);
    for (const s of [S.none, S.edit, S.duyet, S.boc]) await P(['__cty', 'mhPay', { boi: s.label }], s);
    for (const key of KEYS) await P(['__cty', key, { k: key }], S.adminA, { label: 'setProjData __cty ' + key + ' @admin A' });
    for (const v of vals.slice(0, 24)) await P(['__cty', 'area', v], S.adminA, { label: 'setProjData __cty area = ' + f.show(v) });
    for (const a of [['__cty'], ['__cty', null], ['__cty', 'khoaLa', 1], ['__cty', 'ptInfo'], [' __cty ', ' ptInfo ', { trim: 1 }], ['__CTY', 'ptInfo', 1], ['__cty:', 'ptInfo', 1], ['__cty:0', 'ptInfo', { ma: '__cty:0' }], ['__cty:abc', 'ptInfo', 1], ['__cty', 'ptInfo', { x: 1 }, 'thừa']])
      await h.both(S.adminA, 'setProjData', a, { label: 'setProjData ' + JSON.stringify(a) + ' @admin A' });
    // gửi thẳng khoá '__cty:<id công ty>': của mình -> cài đặt công ty; của công ty khác -> coi là mã dự án (không có) -> bỏ qua
    await h.both(S.adminA, 'setProjData', [h.pair('__cty:' + (f.ctA.node || f.ctA), '__cty:' + (f.ctA.go || f.ctA)), 'ptInfo', { ma: 'tự gửi __cty:<A>' }], { label: 'setProjData __cty:<id A> @admin A', rest: () => null });
    await h.both(S.adminA, 'setProjData', [h.pair('__cty:' + (f.ctB.node || f.ctB), '__cty:' + (f.ctB.go || f.ctB)), 'ptInfo', { ma: 'tự gửi __cty:<B>' }], { label: 'setProjData __cty:<id B> @admin A (bỏ qua)', rest: () => null });
    await h.both(S.root, 'setProjData', ['__cty:0', 'cpCfg', { ma: '__cty:0 @super' }], { label: 'setProjData __cty:0 @super không công ty' });
    await h.both(S.root, 'setProjData', [h.pair('__cty:' + (f.ctA.node || f.ctA), '__cty:' + (f.ctA.go || f.ctA)), 'cpCfg', 1], { label: 'setProjData __cty:<id A> @super không công ty (bỏ qua)', rest: () => null });
    await h.dbCheck('sau setProjData __cty', ['project_data_entries', 'company_settings']);

    /* [khoảng trống B.low: lỗi database ở nhánh đọc của getProjData, store_supa.js:1109-1112] mã dự án / khoá có byte NUL -> lỗi 22021; chỉ rpc, không ghi gì */
    for (const ma of ['DY\u0000X', '\u0000', 'DY-D1\u0000']) {
      for (const s of [S.adminA, S.root]) await h.rpc(s, 'getProjData', [ma], { label: 'getProjData mã có byte NUL ' + JSON.stringify(ma) + ' @' + s.label });
      await h.rpc(S.adminA, 'setProjData', [ma, 'ghiChu', { a: 1 }], { label: 'setProjData mã có byte NUL ' + JSON.stringify(ma) + ' (không ghi)' });
    }
    await h.rpc(S.adminA, 'setProjData', ['DY-NUL-KHOA', 'khoa\u0000nul', 1], { label: 'setProjData khoá có byte NUL (không ghi)' });
    await h.rpc(S.adminA, 'setProjData', ['__cty', 'khoa\u0000nul', 1], { label: 'setProjData __cty khoá có byte NUL (không ghi)' });

    /* ================= getProjData ================= */
    await f.matrix('getProjData', ['DY-D1'], { label: 'getProjData DY-D1 (cài đặt công ty + của dự án đè lên)' });
    await f.matrix('getProjData', ['__cty'], { label: 'getProjData __cty (chỉ cài đặt công ty)' });
    for (const s of [S.adminA, S.adminB, S.viewB, S.root, S.adminView]) { await G(['DY-DB'], s); await G(['DY-DR'], s); }
    for (const a of [[], [null], [''], ['   '], [0], [1], [true], [false], [{}], [[]], [['DY-D1']], [['DY-D1', 'DY-D2']], ['KHÔNG-CÓ'], ['dy-d1'], [' DY-D1 '], ['DY-D1,DY-D2'], ['DY-D1&khoa=eq.area'], ['*'], ['__cty:0'], ['DY-D1', 'thừa']])
      await G(a, S.adminA, { label: 'getProjData ' + JSON.stringify(a) + ' @admin A' });
    // xoá dự án -> dữ liệu rời mất, cài đặt công ty còn
    await h.rpc(S.adminA, 'deleteProject', ['DY-D2']);
    await G(['DY-D2'], S.adminA, { label: 'getProjData dự án đã xoá (chỉ còn cài đặt công ty)' });
    await h.both(S.adminA, 'setProjData', ['DY-D2', 'ptVat', 5], { label: 'setProjData dự án đã xoá (bỏ qua, không tạo dòng mồ côi)' });
    // nhân bản: chép dữ liệu rời trừ bgHist; pt:false bỏ phanTho + ptVat
    await P(['DY-D1', 'phanTho', VAL.phanTho]); await P(['DY-D1', 'ptVat', 8]); await P(['DY-D1', 'bgHist', VAL.bgHist]);
    for (const o of [undefined, { pt: false }]) {
      const r = await h.rpc(S.adminA, 'duplicateProject', o ? ['DY-D1', o] : ['DY-D1']);
      if (r.node.json && r.node.json.result) await h.rpc(S.adminA, 'getProjData', [r.val('result.maDA')], { label: '  -> getProjData bản sao ' + f.show(o) });
    }
  },
};
