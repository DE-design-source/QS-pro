'use strict';
/* Module reports: baoCaoNhapSP (server/index.js 327-552) - dryRun, tuVN tự chọn, gửi thật tới webhook báo cáo (server giả):
   so thẻ Lark của từng công ty, kết quả trả về và dòng audit_log chống gửi trùng. */
const { fx, SPEC } = require('./_fx');

module.exports = {
  name: 'area3/07 reports',
  async run(h) {
    const f = await fx(h), S = f.S, fake = h.fake;
    fake.take();
    const bc = (s, opts2, o) => h.rpc(s, 'baoCaoNhapSP', opts2 === undefined ? [] : [opts2], o);
    const both = (s, opts2, o) => h.both(s, 'baoCaoNhapSP', opts2 === undefined ? [] : [opts2], o);

    /* ================= dữ liệu: người nhập tên số (thứ tự khoá object của JS), nhiều ngành, nhiều NCC, nhiều ngày ================= */
    for (const u of ['2024', '777', 'dz_ten_dai']) await h.rpc(S.root, 'createCongTyUser', [f.ctA, { username: u, password: f.PW.staff, hoTen: u === '777' ? '' : 'Người ' + u, phongBan: u === '2024' ? 'Kho' : '' }], { label: 'tạo tài khoản ' + u });
    const U = {}; for (const u of ['2024', '777']) U[u] = await h.login('staff ' + u, u, f.PW.staff);
    const mk = (s, n, over) => h.rpc(s, 'saveDbProduct', [Object.assign({ 'TÊN SẢN PHẨM': 'DB báo cáo ' + n, 'MÃ SẢN PHẨM': 'DB-' + n, 'NHÀ CUNG CẤP': 'NCC ' + (n.length % 3) }, over || {})], { label: 'tạo SP DB-' + n + ' @' + s.label });
    let i = 0;
    for (const s of [S.adminA, S.edit, S.edit, S.duyet, U['2024'], U['2024'], U['2024'], U['777'], S.adminB, S.adminB, S.adminC, S.root, S.root, S.viewA]) {
      i++;
      await mk(s, 'D' + i, { 'HẠNG MỤC': 'Đèn âm trần', 'NHÀ CUNG CẤP': i % 4 ? 'NCC ' + (i % 3) : '' });
      const ng = ['vs', 'son', 'ct'][i % 3];
      await mk(s, ng + i, f.specData(ng, SPEC[ng].HANG_MUC[i % 5], 900 + i, { 'MÃ SẢN PHẨM': 'DB-' + ng + i, 'NHÀ CUNG CẤP': i % 2 ? '  NCC có khoảng trắng  ' : '123' }));
    }
    await mk(S.adminA, 'NG-LA', { 'NGÀNH HÀNG': 'nganh-la', 'HẠNG MỤC': 'Hạng mục lạ' });
    // lùi ngày nhập của vài SP (nhiều ngày trong 1 kỳ), bỏ người nhập của vài SP (đếm "khuyet"), 1 SP của công ty đã xoá tên
    await h.sql("update products set created_at = created_at - interval '1 day' where product_code in ('DB-D2', 'DB-D5', 'DB-D9')");
    await h.sql("update products set created_at = created_at - interval '2 day' where product_code in ('DB-D3', 'DB-D6', 'DB-D12')");
    await h.sql("update products set created_by = null where product_code in ('DB-D4', 'DB-D10')");
    await h.sql("update products set created_by = '   ' where product_code in ('DB-D13')");
    await h.sql("update products set created_by = 'Người Không Có Tài Khoản' where product_code in ('DB-D14')");
    await h.sql("update products set created_by = 'DZ_A_EDIT' where product_code in ('DB-vs2')");

    /* ================= quyền ================= */
    await f.matrix('baoCaoNhapSP', [{ dryRun: true }]);
    for (const s of [S.adminC, S.viewB, S.viewC, S.viewDz]) await both(s, { dryRun: true });
    h.fakeCheck('dryRun không gọi webhook', { count: 0 });

    /* ================= dryRun + tuVN ================= */
    const day = 86400000, now = Date.now();
    const vnIso = (ms) => new Date(ms + 7 * 3600000).toISOString();   // "giờ VN viết như UTC", đúng dạng client gửi
    for (const tu of [vnIso(now - 1.5 * day), vnIso(now - 3 * day), vnIso(now - 30 * day), vnIso(now - 60000), vnIso(now + day), '2020-01-01T00:00:00.000Z', '2020-01-01', '2026-10-01', '2026-10-01T08:00:00', '2026-10-01T08:00:00+07:00', '2026-10-01 08:00', '10/01/2026', 'Oct 1, 2026', '1 October 2026 08:00 GMT+7', '2026-13-45', 'abc', '', ' ', '0', '1760000000000',
      1760000000000, now - day, 0, 1, -1, 1e20, NaN, true, false, null, [], [2026, 9, 1], ['2026-10-01'], {}, { a: 1 }])
      await both(S.root, { dryRun: true, tuVN: tu }, { label: 'baoCaoNhapSP dryRun tuVN = ' + f.show(tu) });
    for (const o of [undefined, null, {}, { dryRun: false }, { dryRun: 0 }, { dryRun: '' }, { dryRun: 1 }, { dryRun: 'x' }, { dryRun: 'false' }, { dryRun: [] }, { dryRun: {} }, 'chuỗi', 5, true, [], [{ dryRun: true }], { dryRun: true, thua: 1 }, { DRYRUN: true, dryRun: true }])
      await both(S.viewA, typeof o === 'object' && o && !Array.isArray(o) && !o.dryRun ? Object.assign({ tuVN: vnIso(now + 365 * day) }, o) : o, { label: 'baoCaoNhapSP opts = ' + f.show(o) + ' (kỳ rỗng nếu không dryRun)' });
    await h.both(S.root, 'baoCaoNhapSP', [{ dryRun: true }, 'thừa']);
    h.fakeCheck('webhook báo cáo sau các lời gọi opts lạ');

    /* ================= gửi thật: mỗi công ty 1 thẻ ================= */
    await bc(S.root, { tuVN: vnIso(now - 5 * day) }, { label: 'baoCaoNhapSP gửi thật (kỳ 5 ngày)' });
    h.fakeCheck('thẻ Lark báo cáo: kỳ 5 ngày');
    await h.rest(S.root, 'baoCaoNhapSP', [{ tuVN: vnIso(now - 5 * day) }], { label: 'baoCaoNhapSP (REST) gửi thật lần 2 (hàm không tự chống trùng)' });
    h.fakeCheck('thẻ Lark báo cáo: lần 2 qua REST');
    await bc(S.root, { tuVN: '2020-01-01' }, { label: 'baoCaoNhapSP gửi thật toàn bộ danh mục (SP cũ không người nhập)' });
    h.fakeCheck('thẻ Lark báo cáo: toàn bộ danh mục');
    await bc(S.root, undefined, { label: 'baoCaoNhapSP không tham số (kỳ mặc định theo lịch thứ 4 / thứ 7)' });
    h.fakeCheck('thẻ Lark báo cáo: kỳ mặc định');
    await bc(S.viewA, {}, { label: 'baoCaoNhapSP @super xem A (vẫn đọc mọi công ty)' });
    h.fakeCheck('thẻ Lark báo cáo: super xem A');
    // webhook trả lời đủ kiểu: chỉ ghi audit khi có ít nhất 1 thẻ gửi được
    const modes = [['{"code":0}', { status: 200, body: '{"code":0}', type: 'application/json' }], ['{"msg":"success"}', { status: 200, body: '{"msg":"success"}', type: 'application/json' }], ['code 19001', { status: 200, body: '{"code":19001,"msg":"param invalid"}', type: 'application/json' }], ['StatusMessage', { status: 400, body: '{"StatusCode":9,"StatusMessage":"bad"}', type: 'application/json' }],
      ['không phải JSON', { status: 200, body: 'ok', type: 'text/plain' }], ['HTTP 500 rỗng', { status: 500, body: '', type: null }], ['BOM + JSON', { status: 200, body: '﻿{"StatusCode":0}', type: 'application/json' }], ['null', { status: 200, body: 'null', type: 'application/json' }], ['đứt kết nối', 'drop']];
    for (const [ten, mode] of modes) {
      fake.set('report', mode);
      await bc(S.root, { tuVN: vnIso(now - 5 * day) }, { label: 'baoCaoNhapSP khi webhook trả ' + ten });
      h.fakeCheck('thẻ Lark báo cáo khi webhook trả ' + ten);
    }
    // thẻ đầu gửi được, các thẻ sau lỗi -> sent = true
    const dem = {};   // đếm riêng từng phía (mỗi phía một cổng của server giả)
    fake.set('report', (req) => ((dem[req.socket.localPort] = (dem[req.socket.localPort] || 0) + 1) % 2 === 1 ? { status: 200, body: '{"code":0}', type: 'application/json' } : { status: 200, body: '{"code":1,"msg":"lỗi"}', type: 'application/json' }));
    await bc(S.root, { tuVN: vnIso(now - 5 * day) }, { label: 'baoCaoNhapSP khi webhook lúc được lúc không' });
    fake.reset(); h.fakeCheck('thẻ Lark báo cáo: lúc được lúc không');

    /* [khoảng trống vùng 3: index.js:468-469] kỳ mà MỌI sản phẩm mới đều thiếu người nhập (null / toàn khoảng trắng): không gửi, trả khuyet + thông báo riêng.
       Đẩy ngày nhập của 3 SP không người nhập ra tương lai rồi hỏi kỳ bắt đầu ngay trước đó; xong thì trả ngày nhập về hiện tại. */
    const KHUYET = "('DB-D4', 'DB-D10', 'DB-D13')";
    await h.sql("update products set created_at = now() + interval '400 days' where product_code in " + KHUYET);
    for (const o of [{ dryRun: true, tuVN: vnIso(now + 399 * day) }, { tuVN: vnIso(now + 399 * day) }]) await both(S.root, o, { label: 'baoCaoNhapSP kỳ chỉ có SP thiếu người nhập, opts = ' + f.show(o) });
    await both(S.viewA, { tuVN: vnIso(now + 399 * day) }, { label: 'baoCaoNhapSP kỳ chỉ có SP thiếu người nhập @super xem A' });
    h.fakeCheck('kỳ chỉ có SP thiếu người nhập: không gọi webhook', { count: 0 });
    await h.sql('update products set created_at = now() where product_code in ' + KHUYET);

    /* [khoảng trống vùng 3: index.js:491] nhãn "Công ty khác": sản phẩm thuộc công ty mà cả tên lẫn mã đều rỗng (products.company_id có khoá ngoại
       nên không thể trỏ tới công ty đã xoá; đây là đường duy nhất tới nhánh này). Công ty tạm chèn bằng SQL với id cố định, xong thì gỡ. */
    const CT_X = '00000000-0000-4000-8000-0000000000c9';
    await h.sql("insert into companies (id, name, code, created_at) values ($1, '', null, now())", [CT_X]);
    await h.sql("update products set company_id = $1 where product_code in ('DB-D1', 'DB-D7')", [CT_X]);
    try {
      await both(S.root, { dryRun: true, tuVN: vnIso(now - 5 * day) }, { label: 'baoCaoNhapSP dryRun có thẻ "Công ty khác"' });
      await bc(S.root, { tuVN: vnIso(now - 5 * day) }, { label: 'baoCaoNhapSP gửi thật có thẻ "Công ty khác"' });
      h.fakeCheck('thẻ Lark báo cáo: có thẻ "Công ty khác"');
    } finally {
      await h.sql("update products set company_id = $1 where product_code in ('DB-D1', 'DB-D7')", [f.ctA]);
      await h.sql('delete from companies where id = $1', [CT_X]);
    }
    await h.both(S.root, 'getAuditLog', [50]);
    await h.dbCheck('sau kịch bản báo cáo', ['audit_logs', 'products']);
  },
};
