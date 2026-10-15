'use strict';
/* Module purchasing: sendPurchaseRequest, getPurchaseOrders, listPurchaseRequests, getPurchaseOrder, resolvePurchaseRequest,
   setPurchaseStatus, sendDeXuat (chiết khấu + thanh toán), getDeXuatList, listDeXuat, getDeXuat, resolveDeXuat
   (server/index.js 137-319, server/store_supa.js 1155-1296, server/auth.js 604-709).
   Webhook Lark trỏ vào server giả: so nguyên văn thẻ JSON mà mỗi server gửi đi, và thử từng kiểu trả lời của webhook. */
const { fx } = require('./_fx');
const TABLES = ['purchase_orders', 'purchase_order_items', 'purchase_proposals', 'proposal_discount_items', 'proposal_payment_installments', 'notifications', 'audit_logs'];

module.exports = {
  name: 'area3/06 purchasing',
  async run(h) {
    const f = await fx(h), S = f.S, fake = h.fake;
    fake.take();
    for (const [s, ma] of [[S.adminA, 'DP-A1'], [S.adminA, 'DP-A2'], [S.adminB, 'DP-B1'], [S.root, 'DP-R1']]) await h.rpc(s, 'createProject', [{ maDA: ma, ten: 'Dự án mua hàng ' + ma, khachHang: 'Anh Khách', sdt: '0909 123 456' }]);
    const item = (i, over) => Object.assign({ ma: 'SP-' + i, ten: 'Đèn âm trần ' + i + 'W', thuongHieu: 'Dezon', khuVuc: 'Phòng khách', dvt: 'Bộ', sl: i + 1, donGia: 450000 + i * 1000, donGiaGoc: 500000 + i * 1000, giamGiaPct: 10, hinhAnh: 'https://img.test/sp' + i + '.jpg' }, over || {});
    const order = (ma, over) => Object.assign({ maDA: ma, project: 'Dự án mua hàng ' + ma, hangMuc: 'Thiết bị đèn', khachHang: 'Anh Khách', sdt: '0909 123 456', nguoiGui: 'Nguyễn Văn Gửi', phongBan: 'Phòng QS', ghiChu: 'Giao trước ngày 20',
      orders: [{ supplier: 'NCC Ánh Sáng', total: 2970000, vat: 270000, vatPct: 10, items: [item(1), item(2)] }] }, over || {});
    const send = (s, o, opts) => h.rpc(s, 'sendPurchaseRequest', o === undefined ? [] : [o], opts);
    const code = (r, i) => r.val('result.saved.' + (i || 0));

    /* ================= trước khi có đơn ================= */
    await f.matrix('getPurchaseOrders', ['DP-A1']); await f.matrix('listPurchaseRequests', []); await f.matrix('getDeXuatList', ['DP-A1']); await f.matrix('listDeXuat', []);

    /* ================= sendPurchaseRequest ================= */
    const sent = {};
    for (const s of f.all) { const r = await send(s, order('DP-A1', { nguoiGui: 'Gửi bởi ' + s.label })); sent[s.label] = code(r); h.fakeCheck('thẻ Lark: sendPurchaseRequest @' + s.label); }
    for (const s of f.all) { await h.rest(s, 'sendPurchaseRequest', [order('DP-A2', { nguoiGui: 'REST ' + s.label })]); h.fakeCheck('thẻ Lark: sendPurchaseRequest (REST) @' + s.label); }
    let r = await send(S.edit, order('DP-A1', { orders: [
      { supplier: 'NCC Một', total: 11000000, vat: 1000000, vatPct: 10, items: [item(1, { sl: 10, donGia: 900000, donGiaGoc: 1000000, giamGiaPct: 10 }), item(2, { sl: 2.5, donGia: 400000.4, donGiaGoc: 400000.4, giamGiaPct: 0, khuVuc: '', thuongHieu: '' })] },
      { supplier: 'NCC Hai', total: 5400000, vat: 400000, vatPct: 8, items: [item(3, { sl: 1, donGia: 5000000, donGiaGoc: 0, giamGiaPct: 0, dvt: '', hinhAnh: '' })] },
      { supplier: '', total: 0, vat: 0, vatPct: 0, items: [] }] }), { label: 'sendPurchaseRequest 3 nhà cung cấp (có giảm giá, có đơn rỗng)' });
    const multi = [code(r, 0), code(r, 1), code(r, 2)]; h.fakeCheck('thẻ Lark: 3 nhà cung cấp');
    // số đủ kiểu: store đọc kiểu VN (n), thẻ Lark dùng Number() và toLocaleString('vi-VN')
    const nums = [0, 1, -1, 0.5, 1.5, 2.5, 999.5, 1000, 1234567.891, -1234567.5, 1e15, 1e21, 123456789012345680000, 0.1 + 0.2, '12.500.000', '12,5', '1.234,56', '1500', ' 2 ', 'abc', '', null, true, false, [], [7], {}, '1e3', '0x10', '30%', -0, 9007199254740993];
    r = await send(S.adminA, order('DP-A1', { nguoiGui: 'Số đủ kiểu', orders: [{ supplier: 'NCC số', total: '33.000.000', vat: '3.000.000', vatPct: '10', items: nums.map((v, i) => item(i, { sl: v, donGia: 1000, donGiaGoc: 1200, giamGiaPct: 5 })) },
      { supplier: 'NCC giá', total: 1e21, vat: -5, vatPct: 'abc', items: nums.map((v, i) => item(i, { sl: 2, donGia: v, donGiaGoc: v, giamGiaPct: v })) },
      { supplier: 'NCC gốc', total: 'abc', vat: null, vatPct: null, items: nums.map((v, i) => item(i, { sl: 1, donGia: 100, donGiaGoc: v, giamGiaPct: 0.5 })) }] }), { label: 'sendPurchaseRequest số đủ kiểu (sl / đơn giá / giá gốc / % giảm)' });
    h.fakeCheck('thẻ Lark: số đủ kiểu');
    for (const [ten, o] of [['không có khách hàng / ghi chú / người gửi', order('DP-A1', { khachHang: '', sdt: '', ghiChu: '', nguoiGui: '', phongBan: '', project: '' })], ['chỉ có sdt', order('DP-A1', { khachHang: null, sdt: '0911' })], ['node thay hangMuc', order('DP-A1', { hangMuc: '', node: '3.2.5 Thiết bị đèn' })],
      ['kenh / ketQua / requesterId do client gửi', order('DP-A1', { kenh: 'Zalo', ketQua: 'ok', requesterId: '00000000-0000-4000-8000-0000000000c1' })], ['maDA lạ / không có', order('KHÔNG-CÓ')], ['maDA số', order(12345)], ['trường là object / mảng', order('DP-A1', { project: { a: 1 }, nguoiGui: ['a', 'b'], ghiChu: 5, phongBan: true })],
      ['ký tự đặc biệt của markdown', order('DP-A1', { project: 'Dự án **đậm** <font color=\'red\'>x</font>', nguoiGui: 'A & B "C" \\ \n dòng 2', ghiChu: '😀 emoji\ttab', orders: [{ supplier: '</font> NCC <b>', total: 100, vat: 0, items: [item(1, { ten: 'Tên có \n xuống dòng và "nháy"', dvt: 'm²' })] }] })],
      ['orders rỗng', order('DP-A1', { orders: [] })], ['orders không phải mảng', order('DP-A1', { orders: 'chuỗi' })], ['orders là object', order('DP-A1', { orders: { 0: { supplier: 'x' }, length: 1 } })], ['thiếu orders', { maDA: 'DP-A1' }], ['object rỗng', {}], ['items không phải mảng', order('DP-A1', { orders: [{ supplier: 'NCC', total: 5, vat: 1, items: 'chuỗi' }] })],
      ['item thiếu trường', order('DP-A1', { orders: [{ supplier: 'NCC', total: 5, items: [{}, { ten: 'chỉ tên' }, { sl: 3 }] }] })], ['orders có phần tử {}', order('DP-A1', { orders: [{}] })], ['total < vat', order('DP-A1', { orders: [{ supplier: 'NCC', total: 100, vat: 500, vatPct: 10, items: [item(1)] }] })],
      ['60 dòng hàng', order('DP-A1', { orders: [{ supplier: 'NCC nhiều', total: 6e7, vat: 0, items: Array.from({ length: 60 }, (_, i) => item(i)) }] })]]) {
      await send(S.edit, o, { label: 'sendPurchaseRequest ' + ten }); h.fakeCheck('thẻ Lark: ' + ten);
    }
    for (const a of [[], [null], ['chuỗi'], [5], [true], [[]], [[order('DP-A1')]], [order('DP-A1', { orders: [null] })], [order('DP-A1', { orders: ['chuỗi'] })], [order('DP-A1', { orders: [5] })], [order('DP-A1', { orders: [[]] })], [order('DP-A1', { orders: [{ supplier: 'NCC', items: [null] }] })], [order('DP-A1', { orders: [{ supplier: 'NCC ok', total: 1, items: [item(1)] }, null] })],
      [order('DP-A1', { orders: [{ supplier: 'NCC', items: ['chuỗi', 5] }] })], [order('DP-A1'), 'thừa']]) {
      await h.both(S.duyet, 'sendPurchaseRequest', a, { label: 'sendPurchaseRequest tham số ' + JSON.stringify(a).slice(0, 90) }); h.fakeCheck('thẻ Lark: tham số ' + JSON.stringify(a).slice(0, 50));
    }
    // webhook trả lời đủ kiểu
    const modes = [['{"code":0}', { status: 200, body: '{"code":0}', type: 'application/json' }], ['{"StatusCode":0}', { status: 200, body: '{"StatusCode":0,"StatusMessage":"success"}', type: 'application/json' }], ['{"msg":"success"}', { status: 200, body: '{"msg":"success","code":19001}', type: 'application/json' }], ['code 19001', { status: 200, body: '{"code":19001,"msg":"param invalid"}', type: 'application/json' }],
      ['code "0" (chuỗi)', { status: 200, body: '{"code":"0"}', type: 'application/json' }], ['HTTP 500 kèm code 0', { status: 500, body: '{"code":0}', type: 'application/json' }], ['HTTP 400 StatusMessage', { status: 400, body: '{"StatusCode":400,"StatusMessage":"bad"}', type: 'application/json' }], ['không phải JSON', { status: 200, body: 'ok', type: 'text/plain' }], ['thân rỗng', { status: 200, body: '', type: null }],
      ['null', { status: 200, body: 'null', type: 'application/json' }], ['mảng', { status: 200, body: '[{"code":0}]', type: 'application/json' }], ['số 0', { status: 200, body: '0', type: 'application/json' }], ['BOM + JSON', { status: 200, body: '﻿{"code":0}', type: 'application/json' }], ['content-type text/html nhưng là JSON', { status: 200, body: '{"code":0}', type: 'text/html' }],
      ['204', { status: 204, body: '', type: null }], ['đứt kết nối', 'drop']];
    for (const [ten, mode] of modes) {
      fake.set('hook', mode);
      await send(S.edit, order('DP-A2', { ghiChu: 'webhook ' + ten }), { label: 'sendPurchaseRequest khi webhook trả ' + ten });
      await h.rpc(S.edit, 'sendDeXuat', [{ loai: 'ck', maDA: 'DP-A2', project: 'Dự án mua hàng DP-A2', supplier: 'NCC webhook', nguoiGui: 'NV sửa', items: [item(1)] }], { label: 'sendDeXuat khi webhook trả ' + ten });
      h.fakeCheck('thẻ Lark khi webhook trả ' + ten);
    }
    fake.reset();
    // phạm vi công ty
    r = await send(S.adminB, order('DP-B1')); const maB = code(r);
    r = await send(S.root, order('DP-R1', { nguoiGui: 'Super' }), { label: 'sendPurchaseRequest @super (báo admin mọi công ty)' }); const maR = code(r);
    await send(S.viewB, order('DP-B1', { nguoiGui: 'Super xem B' })); await send(S.adminView, order('DP-A1', { nguoiGui: 'admin A gửi view B' })); await send(S.boc, order('DP-A1', { nguoiGui: '' }), { label: 'sendPurchaseRequest người gửi không họ tên' }); await send(S.editC, order('DP-C0'));
    h.fakeCheck('thẻ Lark: phạm vi công ty');
    await h.dbCheck('sau sendPurchaseRequest', TABLES);

    /* ================= đọc đơn ================= */
    for (const ma of ['DP-A1', 'DP-A2']) await f.matrix('getPurchaseOrders', [ma]);
    for (const a of [[], [null], [''], ['  '], [0], [12345], ['12345'], [true], [[]], [['DP-A1']], [{}], ['dp-a1'], [' DP-A1 '], ['KHÔNG-CÓ'], ['DP-A1,DP-A2'], ['DP-A1&x=1'], ['DP-B1'], ['DP-R1'], ['DP-A1', 'thừa']]) await h.both(S.adminA, 'getPurchaseOrders', a, { label: 'getPurchaseOrders ' + JSON.stringify(a) + ' @admin A' });
    await h.both(S.root, 'getPurchaseOrders', ['DP-R1']); await h.both(S.viewB, 'getPurchaseOrders', ['DP-B1']); await h.both(S.viewA, 'getPurchaseOrders', ['DP-B1']);
    await f.matrix('listPurchaseRequests', []);
    for (const s of [S.adminC, S.viewB, S.viewC, S.adminView]) await h.both(s, 'listPurchaseRequests', []);
    await h.both(S.adminA, 'listPurchaseRequests', ['thừa']);
    await f.matrix('getPurchaseOrder', [multi[0]]);
    for (const ma of multi.concat([sent['admin A'], maB, maR])) { await h.both(S.adminA, 'getPurchaseOrder', [ma]); await h.both(S.root, 'getPurchaseOrder', [ma]); }
    await h.both(S.adminB, 'getPurchaseOrder', [maB]); await h.both(S.viewB, 'getPurchaseOrder', [multi[0]], { label: 'getPurchaseOrder đơn của A @super xem B' });
    for (const a of [[], [null], [''], [0], [true], [[]], [{}], ['KHÔNG-CÓ'], ['MH-AAAAAAAA-1'], [' x '], ['a&b=c'], ['a,b'], ['MH-1', 'thừa']]) await h.both(S.adminA, 'getPurchaseOrder', a, { label: 'getPurchaseOrder ' + JSON.stringify(a) });

    /* ================= resolvePurchaseRequest + setPurchaseStatus ================= */
    const res = (s, ma, ap, opts) => h.rpc(s, 'resolvePurchaseRequest', ap === undefined ? [ma] : [ma, ap], opts);
    const st = (s, ma, status, opts) => h.rpc(s, 'setPurchaseStatus', status === undefined ? [ma] : [ma, status], opts);
    // đổi trạng thái khi đơn còn "Chờ duyệt"
    await st(S.edit, multi[0], 'Đã đặt hàng', { label: 'setPurchaseStatus khi đơn còn chờ duyệt' });
    await st(S.edit, multi[0], 'Đã nhận hàng');
    const pend = [];
    for (let i = 0; i < 16; i++) { r = await send(S.edit, order('DP-A1', { nguoiGui: 'NV sửa', ghiChu: 'đơn chờ ' + i })); pend.push(code(r)); }
    fake.take();
    let k = 0;
    await f.matrixRpc('resolvePurchaseRequest', () => [pend[k++], true]);
    for (const s of f.all) await h.rest(s, 'resolvePurchaseRequest', [pend[k++], false]);
    await res(S.adminA, multi[0], true, { label: 'resolvePurchaseRequest duyệt' });
    await res(S.adminA, multi[0], false, { label: 'resolvePurchaseRequest đơn đã duyệt (không lật)' });
    await res(S.adminA, multi[1], false, { label: 'resolvePurchaseRequest từ chối' });
    await res(S.adminA, multi[1], true, { label: 'resolvePurchaseRequest đơn đã từ chối' });
    await res(S.adminA, multi[2], undefined, { label: 'resolvePurchaseRequest thiếu approve (-> từ chối), NCC rỗng' });
    // [khoảng trống vùng 3: auth.js:649 qua REST] gọi lại trên đơn đã xử lý -> "Đơn đã được xử lý", không đổi trạng thái (lặp lại được, không ghi gì)
    for (const [ma, ap] of [[multi[0], false], [multi[0], true], [multi[1], true], [multi[2], true]]) await h.rest(S.adminA, 'resolvePurchaseRequest', [ma, ap], { label: 'resolvePurchaseRequest (REST) đơn đã xử lý, approve = ' + ap });
    await h.rest(S.root, 'resolvePurchaseRequest', [multi[0], false], { label: 'resolvePurchaseRequest (REST) đơn đã xử lý @super' });
    for (const ap of [1, 'yes', {}, [], 0, '', null, 'false']) { r = await send(S.duyet, order('DP-A1')); await res(S.adminA, code(r), ap, { label: 'resolvePurchaseRequest approve = ' + f.show(ap) }); }
    await res(S.adminA, maB, true, { label: 'resolvePurchaseRequest đơn của B @admin A' });
    await res(S.adminB, sent['admin A'], true, { label: 'resolvePurchaseRequest đơn của A @admin B' });
    await res(S.viewB, sent['admin A'], true, { label: 'resolvePurchaseRequest đơn của A @super xem B' });
    await res(S.root, sent['admin A'], true, { label: 'resolvePurchaseRequest đơn của A @super' });
    await res(S.root, maR, false, { label: 'resolvePurchaseRequest đơn không công ty @super' });
    await res(S.adminA, sent['super xem công ty A'], true, { label: 'resolvePurchaseRequest đơn do super gửi (báo lại cho super)' });
    for (const a of [[], [null], [''], [0], [true], [[]], [{}], ['KHÔNG-CÓ', true], [' ' + 'x' + ' ', true], ['a&trang_thai=eq.x', true], ['MH-1', true, 'thừa']]) await h.both(S.adminA, 'resolvePurchaseRequest', a, { label: 'resolvePurchaseRequest tham số ' + JSON.stringify(a) });
    // theo dõi sau duyệt: Đã duyệt -> Đã đặt hàng -> Đã nhận hàng, mỗi lần đúng 1 bước
    const ok1 = multi[0];
    await f.matrixRpc('setPurchaseStatus', [ok1, 'Trạng thái lạ']);
    // [khoảng trống vùng 3: auth.js:660-666 qua REST] ma trận quyền của setPurchaseStatus trên route REST (401 khi chưa đăng nhập; trạng thái lạ bị từ chối trước khi ghi)
    for (const s of f.all) await h.rest(s, 'setPurchaseStatus', [ok1, 'Trạng thái lạ'], { label: 'setPurchaseStatus (REST) trạng thái lạ @' + s.label });
    // đúng tên trạng thái nhưng sai bước (đơn đang "Đã duyệt"): mọi phiên đã đăng nhập đều bị từ chối như nhau, chưa đăng nhập 401
    for (const s of f.all.concat([S.adminView, S.viewB])) await h.rest(s, 'setPurchaseStatus', [ok1, 'Đã nhận hàng'], { label: 'setPurchaseStatus (REST) nhảy cóc @' + s.label });
    await st(S.edit, ok1, 'Đã nhận hàng', { label: 'setPurchaseStatus nhảy cóc (Đã duyệt -> Đã nhận hàng)' });
    await st(S.edit, ok1, 'Đã đặt hàng', { label: 'setPurchaseStatus Đã duyệt -> Đã đặt hàng' });
    await st(S.none, ok1, 'Đã đặt hàng', { label: 'setPurchaseStatus bấm trùng' });
    await h.rest(S.duyet, 'setPurchaseStatus', [ok1, 'Đã nhận hàng'], { label: 'setPurchaseStatus (REST) Đã đặt hàng -> Đã nhận hàng' });
    await h.rest(S.duyet, 'setPurchaseStatus', [ok1, 'Đã nhận hàng'], { label: 'setPurchaseStatus (REST) lần 2' });
    await st(S.adminA, ok1, 'Đã duyệt'); await st(S.adminA, ok1, 'Chờ duyệt'); await st(S.adminA, multi[1], 'Đã đặt hàng', { label: 'setPurchaseStatus đơn bị từ chối' });
    for (const a of [[], [null], [ok1], [ok1, null], [ok1, ''], [ok1, 0], [ok1, true], [ok1, []], [ok1, ['Đã đặt hàng']], [ok1, {}], [ok1, 'đã đặt hàng'], [ok1, ' Đã đặt hàng '], [ok1, 'constructor'], [ok1, 'toString'], [ok1, '__proto__'], [null, 'Đã đặt hàng'], ['', 'Đã đặt hàng'], ['KHÔNG-CÓ', 'Đã đặt hàng'], [0, 'Đã đặt hàng'], [[], 'Đã đặt hàng'], [ok1, 'Đã đặt hàng', 'thừa']])
      await h.both(S.edit, 'setPurchaseStatus', a, { label: 'setPurchaseStatus tham số ' + JSON.stringify(resolveShow(a)), accept: f.protoLeak });
    await st(S.adminB, pend[3], 'Đã đặt hàng', { label: 'setPurchaseStatus đơn của A @admin B' });
    await st(S.root, pend[4], 'Đã đặt hàng', { label: 'setPurchaseStatus đơn của A @super' }); await st(S.viewA, pend[4], 'Đã nhận hàng'); await st(S.viewB, pend[6], 'Đã đặt hàng');
    await f.matrix('listPurchaseRequests', []); await h.both(S.adminA, 'getPurchaseOrders', ['DP-A1']); await h.both(S.adminA, 'getPurchaseOrder', [ok1]);
    h.fakeCheck('webhook trong lúc duyệt / đổi trạng thái (chỉ các lần gửi đơn mới)', { count: 8 });
    await h.dbCheck('sau duyệt đơn mua hàng', TABLES);

    /* ================= sendDeXuat (chiết khấu / thanh toán) ================= */
    const ck = (ma, over) => Object.assign({ loai: 'ck', maDA: ma, project: 'Dự án mua hàng ' + ma, hangMuc: 'Thiết bị đèn', supplier: 'NCC Ánh Sáng', vatPct: 10, nguoiGui: 'Nguyễn Văn Gửi', phongBan: 'Phòng QS', ghiChu: 'Xin thêm 5%', items: [item(1, { sl: 10, donGiaGoc: 1000000, donGia: 900000, giamGiaPct: 10 }), item(2, { sl: 3, donGiaGoc: 250000, donGia: 250000, giamGiaPct: 0 })] }, over || {});
    const tt = (ma, over) => Object.assign({ loai: 'tt', maDA: ma, project: 'Dự án mua hàng ' + ma, hangMuc: 'Thiết bị đèn', supplier: 'NCC Ánh Sáng', nguoiGui: 'Nguyễn Văn Gửi', phongBan: 'Phòng QS', ghiChu: 'Thanh toán 3 đợt', tongDon: 30000000,
      dots: [{ dot: 1, pct: 30, tien: 9000000, ngay: '2026-10-20', gc: 'Tạm ứng' }, { dot: 2, pct: 40, tien: 12000000, ngay: '2026-11-15', gc: '' }, { pct: 30, tien: 9000000 }] }, over || {});
    const dx = (s, o, opts) => h.rpc(s, 'sendDeXuat', o === undefined ? [] : [o], opts);
    const dxCode = (r2) => r2.val('result.ma');
    const dxSent = { ck: {}, tt: {} };
    for (const s of f.all) { r = await dx(s, ck('DP-A1', { nguoiGui: 'CK bởi ' + s.label })); dxSent.ck[s.label] = dxCode(r); r = await dx(s, tt('DP-A1', { nguoiGui: 'TT bởi ' + s.label })); dxSent.tt[s.label] = dxCode(r); h.fakeCheck('thẻ Lark: sendDeXuat ck + tt @' + s.label); }
    for (const s of f.all) { await h.rest(s, 'sendDeXuat', [ck('DP-A2', { nguoiGui: 'REST ' + s.label })]); await h.rest(s, 'sendDeXuat', [tt('DP-A2', { nguoiGui: 'REST ' + s.label })]); h.fakeCheck('thẻ Lark: sendDeXuat (REST) @' + s.label); }
    for (const [ten, o] of [['loai lạ (-> ck trong DB, thẻ theo loai gốc)', ck('DP-A1', { loai: 'xyz' })], ['thiếu loai', ck('DP-A1', { loai: undefined })], ['loai TT viết hoa', tt('DP-A1', { loai: 'TT' })], ['ck không có items', ck('DP-A1', { items: [] })], ['ck items không phải mảng', ck('DP-A1', { items: 'x' })], ['ck có cả dots', ck('DP-A1', { dots: [{ dot: 1, tien: 5 }] })],
      ['tt không có dots', tt('DP-A1', { dots: [] })], ['tt không tongDon', tt('DP-A1', { tongDon: undefined })], ['tt tongDon chuỗi VN', tt('DP-A1', { tongDon: '30.000.000' })], ['tt có cả items', tt('DP-A1', { items: [item(1)] })], ['ck vatPct chuỗi', ck('DP-A1', { vatPct: '8' })], ['ck vatPct 0 / thiếu', ck('DP-A1', { vatPct: undefined })], ['ck vatPct lẻ', ck('DP-A1', { vatPct: 7.5 })],
      ['ck số đủ kiểu', ck('DP-A1', { items: nums.map((v, i) => item(i, { sl: v, donGia: 1000.4, donGiaGoc: 1200.6, giamGiaPct: v })).concat(nums.map((v, i) => item(i, { sl: 2, donGia: v, donGiaGoc: v, giamGiaPct: 1 }))) })],
      ['tt số đủ kiểu', tt('DP-A1', { tongDon: 0, dots: nums.map((v, i) => ({ dot: v, pct: v, tien: v, ngay: i % 2 ? '2026-12-0' + (i % 9 + 1) : '', gc: i % 3 ? 'gc ' + i : '' })) })],
      ['tt ngày đủ dạng', tt('DP-A1', { dots: [{ dot: 1, tien: 1, ngay: '2026-10-20T10:00:00Z' }, { dot: 2, tien: 2, ngay: '2026/10/21' }, { dot: 3, tien: 3, ngay: '20261022' }, { dot: 4, tien: 4, ngay: null }, { dot: 5, tien: 5, ngay: 0 }, { dot: 6, tien: 6, ngay: false }] })],
      ['tt ngày sai (lỗi database -> gỡ phiếu)', tt('DP-A1', { dots: [{ dot: 1, tien: 1, ngay: '31/12/2026x' }] })], ['tt ngày kiểu VN', tt('DP-A1', { dots: [{ dot: 1, tien: 1, ngay: '20/10/2026' }] })], ['tt ngày là số', tt('DP-A1', { dots: [{ dot: 1, tien: 1, ngay: 20261020 }] })], ['tt ngày là object', tt('DP-A1', { dots: [{ dot: 1, tien: 1, ngay: { a: 1 } }] })],
      ['không supplier / project / người gửi', ck('DP-A1', { supplier: '', project: '', nguoiGui: '', phongBan: '', ghiChu: '', hangMuc: '' })], ['trường là object / mảng / số', ck('DP-A1', { supplier: ['A', 'B'], project: { a: 1 }, nguoiGui: 5, phongBan: true, ghiChu: 0, hangMuc: null })], ['maDA số', ck(777)], ['requesterId do client gửi', ck('DP-A1', { requesterId: '00000000-0000-4000-8000-0000000000c1' })],
      ['requesterId sai dạng (lỗi database)', ck('DP-A1', { requesterId: 'không-phải-uuid' })], ['object rỗng', {}], ['item thiếu trường', ck('DP-A1', { items: [{}, { ten: 'chỉ tên' }] })], ['dot thiếu trường', tt('DP-A1', { dots: [{}, { tien: 5 }] })], ['60 dòng', ck('DP-A1', { items: Array.from({ length: 60 }, (_, i) => item(i)) })]]) {
      await dx(S.edit, o, { label: 'sendDeXuat ' + ten }); h.fakeCheck('thẻ Lark: đề xuất ' + ten);
    }
    for (const a of [[], [null], ['chuỗi'], [5], [true], [[]], [[ck('DP-A1')]], [ck('DP-A1', { items: [null] })], [ck('DP-A1', { items: ['x', 5] })], [tt('DP-A1', { dots: [null] })], [tt('DP-A1', { dots: ['x', 5] })], [tt('DP-A1', { dots: 'x' })], [ck('DP-A1'), 'thừa']]) {
      await h.both(S.duyet, 'sendDeXuat', a, { label: 'sendDeXuat tham số ' + JSON.stringify(a).slice(0, 90) }); h.fakeCheck('thẻ Lark: đề xuất tham số ' + JSON.stringify(a).slice(0, 40));
    }
    r = await dx(S.adminB, ck('DP-B1')); const dxB = dxCode(r);
    r = await dx(S.root, tt('DP-R1'), { label: 'sendDeXuat @super (không công ty)' }); const dxR = dxCode(r);
    await dx(S.viewB, ck('DP-B1')); await dx(S.adminView, tt('DP-A1')); await dx(S.boc, ck('DP-A1', { nguoiGui: '' })); await dx(S.editC, tt('DP-C0'));
    h.fakeCheck('thẻ Lark: đề xuất theo phạm vi công ty');
    await h.dbCheck('sau sendDeXuat', TABLES);

    /* ================= đọc đề xuất ================= */
    for (const ma of ['DP-A1', 'DP-A2']) await f.matrix('getDeXuatList', [ma]);
    for (const a of [[], [null], [''], [0], [777], ['777'], [true], [[]], [{}], ['dp-a1'], [' DP-A1 '], ['KHÔNG-CÓ'], ['DP-B1'], ['DP-R1'], ['DP-A1', 'thừa']]) await h.both(S.adminA, 'getDeXuatList', a, { label: 'getDeXuatList ' + JSON.stringify(a) + ' @admin A' });
    await h.both(S.root, 'getDeXuatList', ['DP-R1']); await h.both(S.viewB, 'getDeXuatList', ['DP-B1']);
    for (const loai of [undefined, null, '', 'ck', 'tt', 'CK', ' tt ', 'xyz', 0, 1, true, false, [], ['ck'], ['ck', 'tt'], {}, 'ck&loai=eq.tt', 'ck,tt']) await f.matrix('listDeXuat', loai === undefined ? [] : [loai], { label: 'listDeXuat ' + f.show(loai) });
    for (const s of [S.adminC, S.viewB, S.viewC]) await h.both(s, 'listDeXuat', []);
    await h.both(S.adminA, 'listDeXuat', ['ck', 'thừa']);
    await f.matrix('getDeXuat', [dxSent.ck['admin A']]); await f.matrix('getDeXuat', [dxSent.tt['admin A']]);
    for (const ma of [dxB, dxR, dxSent.ck['staff A sp_edit'], dxSent.tt['super']]) { await h.both(S.adminA, 'getDeXuat', [ma]); await h.both(S.root, 'getDeXuat', [ma]); }
    for (const a of [[], [null], [''], [0], [true], [[]], [{}], ['KHÔNG-CÓ'], ['CK-AAAAAAAA-1'], [' x '], ['a&b=c'], ['CK-1', 'thừa']]) await h.both(S.adminA, 'getDeXuat', a, { label: 'getDeXuat ' + JSON.stringify(a) });

    /* ================= resolveDeXuat ================= */
    const rdx = (s, ma, ap, opts) => h.rpc(s, 'resolveDeXuat', ap === undefined ? [ma] : [ma, ap], opts);
    const dpend = [];
    for (let i = 0; i < 16; i++) { r = await dx(S.edit, i % 2 ? tt('DP-A1', { ghiChu: 'chờ ' + i }) : ck('DP-A1', { ghiChu: 'chờ ' + i })); dpend.push(dxCode(r)); }
    fake.take();
    k = 0;
    await f.matrixRpc('resolveDeXuat', () => [dpend[k++], true]);
    for (const s of f.all) await h.rest(s, 'resolveDeXuat', [dpend[k++], false]);
    await rdx(S.adminA, dxSent.ck['admin A'], true, { label: 'resolveDeXuat duyệt chiết khấu' });
    await rdx(S.adminA, dxSent.ck['admin A'], false, { label: 'resolveDeXuat phiếu đã duyệt' });
    await rdx(S.adminA, dxSent.tt['admin A'], false, { label: 'resolveDeXuat từ chối thanh toán' });
    await rdx(S.adminA, dxSent.tt['admin A'], true, { label: 'resolveDeXuat phiếu đã từ chối' });
    await rdx(S.adminA, dxSent.ck['staff A sp_edit'], undefined, { label: 'resolveDeXuat thiếu approve (-> từ chối)' });
    // [khoảng trống vùng 3: auth.js:702 qua REST] gọi lại trên phiếu đã xử lý -> "Đề xuất đã được xử lý", không ghi gì
    for (const [ma, ap] of [[dxSent.ck['admin A'], false], [dxSent.ck['admin A'], true], [dxSent.tt['admin A'], true], [dxSent.ck['staff A sp_edit'], true]]) await h.rest(S.adminA, 'resolveDeXuat', [ma, ap], { label: 'resolveDeXuat (REST) phiếu đã xử lý, approve = ' + ap });
    await h.rest(S.root, 'resolveDeXuat', [dxSent.tt['admin A'], false], { label: 'resolveDeXuat (REST) phiếu đã xử lý @super' });
    for (const ap of [1, 'yes', {}, [], 0, '', null, 'false']) { r = await dx(S.duyet, ck('DP-A1')); await rdx(S.adminA, dxCode(r), ap, { label: 'resolveDeXuat approve = ' + f.show(ap) }); }
    await rdx(S.adminA, dxB, true, { label: 'resolveDeXuat phiếu của B @admin A' });
    await rdx(S.adminB, dxSent.ck['staff A không perms'], true, { label: 'resolveDeXuat phiếu của A @admin B' });
    await rdx(S.viewB, dxSent.ck['staff A không perms'], true, { label: 'resolveDeXuat phiếu của A @super xem B' });
    await rdx(S.root, dxSent.ck['staff A không perms'], true, { label: 'resolveDeXuat phiếu của A @super' });
    await rdx(S.root, dxR, true, { label: 'resolveDeXuat phiếu không công ty @super' });
    await rdx(S.adminA, dxSent.tt['super xem công ty A'], true, { label: 'resolveDeXuat phiếu do super gửi' });
    for (const a of [[], [null], [''], [0], [true], [[]], [{}], ['KHÔNG-CÓ', true], ['a&trang_thai=eq.x', true], ['CK-1', true, 'thừa']]) await h.both(S.adminA, 'resolveDeXuat', a, { label: 'resolveDeXuat tham số ' + JSON.stringify(a) });
    h.fakeCheck('webhook trong lúc duyệt đề xuất (chỉ các lần gửi phiếu mới)', { count: 8 });

    /* ================= kết quả ================= */
    await f.matrix('listDeXuat', []); await h.both(S.adminA, 'getDeXuatList', ['DP-A1']); await h.both(S.adminA, 'getDeXuat', [dxSent.ck['admin A']]); await h.both(S.adminA, 'getDeXuat', [dxSent.tt['admin A']]);
    for (const s of [S.adminA, S.adminB, S.adminC, S.edit, S.duyet, S.boc, S.none, S.root]) { await h.both(s, 'notifCount', []); await h.both(s, 'notifList', [100]); }
    await h.both(S.adminA, 'getAuditLog', [300]);
    await h.dbCheck('sau kịch bản mua hàng', TABLES);
  },
};
// nhãn: Pair (mã theo từng phía) in theo phía Node
function resolveShow(a) { return a.map((x) => (x && x.node !== undefined && x.go !== undefined ? x.node : x)); }
