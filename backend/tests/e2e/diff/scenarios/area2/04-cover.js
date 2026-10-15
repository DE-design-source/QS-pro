'use strict';
/* Module quotations (tờ bìa): getCoverOrInit, buildCoverFromTemplate, saveCover (server/store_supa.js 407-440). */
const { fx } = require('./_fx');

module.exports = {
  name: 'area2/04 cover',
  async run(h) {
    const f = await fx(h), S = f.S;
    for (const [s, ma] of [[S.adminA, 'DY-C1'], [S.adminA, 'DY-C2'], [S.adminA, 'DY-C3'], [S.adminB, 'DY-CB'], [S.root, 'DY-CR']]) await h.rpc(s, 'createProject', [{ maDA: ma, ten: 'Tờ bìa ' + ma }]);
    // dòng bóc tách ở nhiều đề mục: mục LÁ của mẫu cộng thành tiền mọi dòng có nhom thuộc mục đó (inCode)
    const nhoms = ['3.2.1', '3.2.2', '3.2.5', '3.2.5.1', '3.2.5.10', '3.2.50', '3.2.6.1', '3.2.6.2', '3.2', '3', '3.1', '1.1', '2.4', ' 3.2.7 ', '3.2.8.', 'Khác', '', '4', '3.2.5x'];
    let i = 0;
    for (const nh of nhoms) { i++; await h.rpc(S.adminA, 'addLine', ['DY-C1', { ten: 'Dòng nhóm ' + nh, nhom: nh, donGiaVon: 1000000 * i + 0.4, lnPct: 10 + i, ckKhach: i % 7, chietKhau: 5 }, i % 3 + 0.5], { label: 'addLine DY-C1 nhom = ' + JSON.stringify(nh) }); }
    await h.rpc(S.adminB, 'addLine', ['DY-CB', { ten: 'Dòng của B', nhom: '3.2.1', donGiaVon: 5e6 }, 2]);
    await h.rpc(S.root, 'addLine', ['DY-CR', { ten: 'Dòng không công ty', nhom: '3.2.2', donGiaVon: 3e6 }, 1]);

    /* ================= chưa có tờ bìa: dựng từ mẫu ================= */
    for (const fn of ['getCoverOrInit', 'buildCoverFromTemplate']) {
      await f.matrix(fn, ['DY-C1'], { label: fn + ' DY-C1 (chưa lưu tờ bìa)' });
      for (const s of [S.adminA, S.adminB, S.viewB, S.root, S.adminView]) { await h.both(s, fn, ['DY-CB']); await h.both(s, fn, ['DY-CR']); }
      for (const a of [[], [null], [''], [0], [1], [true], [false], [{}], [[]], [['DY-C1']], [['DY-C1', 'DY-C2']], ['KHÔNG-CÓ'], ['DY-C2'], ['dy-c1'], [' DY-C1 '], ['DY-C1,DY-C2'], ['DY-C1&ma_da=neq.x'], ['*'], ['DY-C1', 'thừa']])
        await h.both(S.adminA, fn, a, { label: fn + ' ' + JSON.stringify(a) + ' @admin A' });
    }

    /* [khoảng trống B.low: lỗi database ở nhánh đọc của tờ bìa, store_supa.js:408-410] mã dự án có byte NUL -> lỗi 22021; chỉ rpc, không ghi gì */
    for (const ma of ['DY\u0000X', '\u0000', 'DY-C1\u0000']) {
      for (const fn of ['getCoverOrInit', 'buildCoverFromTemplate']) for (const s of [S.adminA, S.root]) await h.rpc(s, fn, [ma], { label: fn + ' mã có byte NUL ' + JSON.stringify(ma) + ' @' + s.label });
      await h.rpc(S.adminA, 'saveCover', [ma, [{ stt: '1', hangMuc: 'không ghi được', moTa: '', chiPhi: 1 }]], { label: 'saveCover mã có byte NUL ' + JSON.stringify(ma) + ' (không ghi)' });
    }

    /* ================= saveCover ================= */
    const SV = (args, s, opts) => h.rpc(s || S.adminA, 'saveCover', args, opts);
    const SR = (args, s, opts) => h.rest(s || S.adminA, 'saveCover', args, opts);
    const rows1 = [{ stt: '1', hangMuc: 'TƯ VẤN DỰ ÁN', moTa: '', chiPhi: 0 }, { stt: '1.1', hangMuc: 'Tư vấn QLDA', moTa: 'Mô tả\n2 dòng', chiPhi: 25000000 }, { stt: '3', hangMuc: 'XÂY DỰNG', moTa: '', chiPhi: 0 }, { stt: '3.2', hangMuc: 'Phần hoàn thiện', moTa: 'x', chiPhi: 0 },
      { stt: '3.2.1', hangMuc: 'Trần thạch cao', moTa: 'Nhân công và vật tư', chiPhi: 12345678.9 }, { stt: '3.2.5', hangMuc: 'Thiết bị đèn', moTa: '', chiPhi: '98.765.432' }, { stt: '10', hangMuc: 'Mục 10', moTa: 'xếp sau 9', chiPhi: 1 }, { stt: '2', hangMuc: 'THIẾT KẾ', moTa: '', chiPhi: 5e6 }];
    await h.both(S.anon, 'saveCover', ['DY-C1', rows1]);
    await SV(['DY-C1', rows1], S.adminA, { label: 'saveCover DY-C1 (lần đầu)' });
    await SR(['DY-C2', rows1], S.adminA, { label: 'saveCover (REST) DY-C2 (lần đầu)' });
    await f.matrix('getCoverOrInit', ['DY-C1'], { label: 'getCoverOrInit DY-C1 (đã lưu tờ bìa)' });
    await f.matrix('buildCoverFromTemplate', ['DY-C1'], { label: 'buildCoverFromTemplate DY-C1 (đã lưu tờ bìa: vẫn dựng lại từ mẫu)' });
    await SV(['DY-C1', rows1.slice().reverse()], S.adminA, { label: 'saveCover DY-C1 lần 2 (đảo thứ tự: ghi mới rồi xoá cũ)' });
    await SR(['DY-C2', rows1.slice(0, 3)], S.adminA, { label: 'saveCover (REST) DY-C2 lần 2 (ít dòng hơn)' });
    // từng trường, đủ kiểu
    const cells = [['stt', 5], ['stt', 3.2], ['stt', null], ['stt', ''], ['stt', true], ['stt', { a: 1 }], ['stt', ['3', '2']], ['stt', ' 3.2 '], ['stt', 'constructor'], ['hangMuc', null], ['hangMuc', 123], ['hangMuc', false], ['hangMuc', { a: 1 }], ['hangMuc', ['a']], ['hangMuc', 'x'.repeat(3000)],
      ['moTa', null], ['moTa', 0], ['moTa', "nháy ' \" \\ 😀 <b>"], ['chiPhi', 0], ['chiPhi', -0], ['chiPhi', 1.5], ['chiPhi', '1.500.000'], ['chiPhi', '12,5'], ['chiPhi', '1.234'], ['chiPhi', '1.234,5'], ['chiPhi', '1,234,567'], ['chiPhi', '30%'], ['chiPhi', '5 triệu'], ['chiPhi', 'abc'], ['chiPhi', null], ['chiPhi', ''],
      ['chiPhi', true], ['chiPhi', false], ['chiPhi', [5]], ['chiPhi', {}], ['chiPhi', -1], ['chiPhi', '-5'], ['chiPhi', 1e21], ['chiPhi', 1e-7], ['chiPhi', 0.1 + 0.2], ['chiPhi', '1e3'], ['chiPhi', 'Infinity'], ['chiPhi', 12345678901234567890]];
    for (const [key, v] of cells) await SV(['DY-C3', [{ stt: '1', hangMuc: 'Dòng giữ nguyên', moTa: 'm', chiPhi: 10 }, Object.assign({ stt: '2', hangMuc: 'Dòng thử', moTa: 'm', chiPhi: 20 }, { [key]: v })]], S.adminA, { label: 'saveCover ' + key + ' = ' + f.show(v) });
    for (const [key, v] of [['stt', 5], ['hangMuc', null], ['chiPhi', '1.500.000'], ['chiPhi', -1], ['chiPhi', 'abc'], ['chiPhi', [5]]]) await SR(['DY-C3', [Object.assign({ stt: '2', hangMuc: 'Dòng thử REST', moTa: 'm', chiPhi: 20 }, { [key]: v })]], S.adminA, { label: 'saveCover (REST) ' + key + ' = ' + f.show(v) });
    // rows thiếu / rỗng / sai kiểu
    for (const a of [['DY-C3', [{ stt: 'a' }]], ['DY-C3'], ['DY-C3', [{ stt: 'b' }]], ['DY-C3', null], ['DY-C3', [{ stt: 'c' }]], ['DY-C3', []], ['DY-C3', [{}]], ['DY-C3', [{ zzz: 1 }, {}, { stt: '1' }]], ['DY-C3', ['chuỗi', 5, true, [], [1, 2]]], ['DY-C3', [null]], ['DY-C3', [{ stt: '1' }, null]], ['DY-C3', 'chuỗi'], ['DY-C3', 5],
      ['DY-C3', true], ['DY-C3', {}], ['DY-C3', { length: 1, 0: { stt: 'x' } }], ['DY-C3', 0], ['DY-C3', false], ['DY-C3', ''], ['DY-C3', [{ stt: 'cuối', hangMuc: 'còn lại sau các lần lỗi', chiPhi: 7 }], 'thừa']])
      await h.both(S.adminA, 'saveCover', a, { label: 'saveCover ' + JSON.stringify(a).slice(0, 90) + ' @admin A' });
    // mã dự án
    for (const a of [[], [null, rows1], ['', rows1], [0, rows1], [true, rows1], [{}, rows1], [['DY-C3'], [{ stt: 'mã là mảng' }]], ['KHÔNG-CÓ', rows1], ['KHÔNG-CÓ', []], ['KHÔNG-CÓ'], ['dy-c3', rows1], [' DY-C3 ', rows1], ['DY-C1,DY-C2', rows1]])
      await h.both(S.adminA, 'saveCover', a, { label: 'saveCover mã ' + JSON.stringify(a[0]) + (a.length > 1 ? (a[1].length ? ' + rows' : ' + []') : '') + ' @admin A' });
    // phạm vi công ty
    await h.both(S.adminA, 'saveCover', ['DY-CB', rows1], { label: 'saveCover dự án công ty khác @admin A' });
    await h.both(S.adminB, 'saveCover', ['DY-C1', rows1], { label: 'saveCover dự án công ty khác @admin B' });
    await h.both(S.adminB, 'saveCover', ['DY-C1', []], { label: 'saveCover [] dự án công ty khác @admin B (không xoá gì)' });
    await h.both(S.viewB, 'saveCover', ['DY-C1', rows1.slice(0, 2)], { label: 'saveCover dự án A @super xem B' });
    await h.both(S.adminA, 'saveCover', ['DY-CR', rows1], { label: 'saveCover dự án không công ty @admin A' });
    await h.both(S.adminView, 'saveCover', ['DY-CB', rows1]);
    await h.both(S.root, 'saveCover', ['DY-CR', rows1.slice(0, 4)], { label: 'saveCover dự án không công ty @super' });
    await h.both(S.root, 'saveCover', ['DY-CB', rows1.slice(0, 5)], { label: 'saveCover dự án B @super không công ty' });
    await h.both(S.adminB, 'saveCover', ['DY-CB', [{ stt: '1', hangMuc: 'B tự lưu', chiPhi: '2.000.000' }]]);
    for (const s of [S.none, S.edit, S.duyet, S.boc, S.viewA]) await h.both(s, 'saveCover', ['DY-C2', [{ stt: '1', hangMuc: 'Lưu bởi ' + s.label, moTa: '', chiPhi: 100 }]]);
    await h.dbCheck('sau saveCover', ['cost_estimate_lines']);
    // nhiều dòng: lần đọc dòng cũ chỉ lấy 2000 dòng
    const big = Array.from({ length: 2105 }, (_, k) => ({ stt: String(k + 1), hangMuc: 'Mục ' + (k + 1), moTa: k % 50 ? '' : 'mô tả ' + k, chiPhi: k * 1000 }));
    await SV(['DY-C2', big], S.adminA, { label: 'saveCover 2105 dòng' });
    await SV(['DY-C2', big.slice(0, 3)], S.adminA, { label: 'saveCover 3 dòng sau 2105 dòng (chỉ xoá được 2000 dòng cũ)' });
    await h.both(S.adminA, 'getCoverOrInit', ['DY-C2'], { label: 'getCoverOrInit DY-C2 sau 2105 dòng' });
    await SV(['DY-C2', []], S.adminA, { label: 'saveCover [] (xoá hết phần còn lại)' });
    await h.both(S.adminA, 'getCoverOrInit', ['DY-C2'], { label: 'getCoverOrInit DY-C2 sau khi xoá hết tờ bìa (dựng lại từ mẫu)' });

    /* ================= đọc lại + dựng lại từ mẫu sau khi dòng bóc tách đổi ================= */
    for (const ma of ['DY-C1', 'DY-C3', 'DY-CB', 'DY-CR']) { await h.both(S.root, 'getCoverOrInit', [ma], { label: 'getCoverOrInit ' + ma + ' @super' }); await h.both(S.root, 'buildCoverFromTemplate', [ma], { label: 'buildCoverFromTemplate ' + ma + ' @super' }); }
    await h.rpc(S.adminA, 'addLine', ['DY-C1', { ten: 'Thêm vào 3.2.1', nhom: '3.2.1', donGiaVon: 777777.5, lnPct: 12 }, 3]);
    await h.both(S.adminA, 'buildCoverFromTemplate', ['DY-C1'], { label: 'buildCoverFromTemplate DY-C1 sau khi thêm dòng' });
    await h.both(S.adminA, 'getCoverOrInit', ['DY-C1'], { label: 'getCoverOrInit DY-C1 (giữ bản đã lưu)' });
    // dùng luôn kết quả dựng từ mẫu để lưu (như nút "Nạp lại mẫu" của giao diện)
    const r = await h.rpc(S.adminA, 'buildCoverFromTemplate', ['DY-C1']);
    if (r.node.json && Array.isArray(r.node.json.result)) await SV(['DY-C1', r.node.json.result], S.adminA, { label: 'saveCover DY-C1 bằng kết quả dựng từ mẫu' });
    await h.both(S.adminA, 'getCoverOrInit', ['DY-C1'], { label: 'getCoverOrInit DY-C1 sau khi nạp lại mẫu' });
    // dự án bị xoá -> tờ bìa mất theo
    await h.rpc(S.adminA, 'deleteProject', ['DY-C3']);
    await h.both(S.adminA, 'getCoverOrInit', ['DY-C3'], { label: 'getCoverOrInit dự án đã xoá' });
    await h.both(S.adminA, 'saveCover', ['DY-C3', rows1], { label: 'saveCover dự án đã xoá' });
  },
};
