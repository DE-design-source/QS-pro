'use strict';
/* Module materials (phần lõi): spMyPerms, getProducts, saveDbProduct, getDbProduct, updateDbProductTracked, setSpDuyet,
   getProductHistory, deleteDbProduct (server/store_supa.js 177-213, 503-718, 950-954; server/auth.js 517-569).
   Đủ 4 ngành (đèn / vệ sinh / sơn nước / công tắc - ổ cắm) với thông số của TỪNG hạng mục. */
const { fx, SPEC } = require('./_fx');

module.exports = {
  name: 'area3/01 products',
  async run(h) {
    const f = await fx(h), S = f.S;
    const save = (s, data, opts) => h.rpc(s, 'saveDbProduct', [data], opts);
    const saveR = (s, data, opts) => h.rest(s, 'saveDbProduct', [data], opts);
    const lb = (t, d) => ({ label: t + ' ' + f.show(d) });

    /* ================= spMyPerms ================= */
    await f.matrix('spMyPerms', []);
    for (const s of [S.boc, S.adminC, S.editC, S.viewB, S.adminView]) await h.both(s, 'spMyPerms', []);
    await h.both(S.adminA, 'spMyPerms', ['thừa', 1]);

    /* ================= getProducts trước khi ghi ================= */
    await f.matrix('getProducts', []);
    await h.both(S.viewDz, 'getProducts', []);
    await h.both(S.adminA, 'getProducts', ['thừa']);

    /* ================= saveDbProduct: tạo mới đủ 4 ngành ================= */
    const ids = { den: [], vs: [], son: [], ct: [] };
    let r = await save(S.adminA, f.denData(1)); ids.den.push(f.idOf(r));
    r = await saveR(S.edit, f.denData(2, { 'LẮP NGUỒN RỜI': 'không', 'NHIỆT ĐỘ MÀU (K)': '6500' })); ids.den.push(f.idOf(r));
    r = await save(S.duyet, f.denData(3, { 'NHÓM SẢN PHẨM': '', 'DÒNG SẢN PHẨM': '', 'CRI': '', 'TÊN CHIP LED': '', 'LOẠI CHIP LED': '', 'GHI CHÚ': '', 'ĐƯỜNG KÍNH (mm)': '', 'CHIỀU CAO (mm)': '' })); ids.den.push(f.idOf(r));
    r = await save(S.none, f.denData(4, { 'CRI': '95', 'TÊN CHIP LED': '', 'LOẠI CHIP LED': '', 'CHIỀU CAO (mm)': '', 'LỖ KHOÉT TRẦN (mm)': 'Ø40×78', 'CÔNG SUẤT (W)': '2×5W', 'GÓC CHIẾU (°)': '24°/38°' })); ids.den.push(f.idOf(r));
    r = await save(S.boc, f.denData(5, { 'LỖ KHOÉT TRẦN (mm)': '60x60mm', 'NHIỆT ĐỘ MÀU (K)': '3000K,4000k, 6500', 'ĐƠN VỊ TÍNH': '', 'ẢNH SẢN PHẨM': '\n  \n https://img.test/sau-dong-trong.jpg \n' })); ids.den.push(f.idOf(r));
    let i = 0;
    for (const ng of ['vs', 'son', 'ct']) {
      for (const hm of SPEC[ng].HANG_MUC) {
        i++;
        const d = f.specData(ng, hm, i);
        r = i % 2 ? await save(i % 3 ? S.adminA : S.edit, d, { label: 'saveDbProduct ' + ng + ' / ' + hm }) : await saveR(i % 3 ? S.adminA : S.duyet, d, { label: 'saveDbProduct (REST) ' + ng + ' / ' + hm });
        ids[ng].push(f.idOf(r));
      }
    }
    // không ghi NGÀNH HÀNG -> tự nhận theo hạng mục; ngành ghi tay; hạng mục lạ; viết khác dấu / hoa thường
    for (const d of [f.specData('vs', 'Lavabo', 60, { 'NGÀNH HÀNG': '' }), f.specData('son', 'Sơn lót', 61, { 'NGÀNH HÀNG': null }), f.specData('ct', 'Công tắc cơ', 62, { 'NGÀNH HÀNG': undefined }),
      f.specData('vs', 'Bồn cầu', 63, { 'HẠNG MỤC': 'bon cau' }), f.specData('son', 'Sơn dầu', 64, { 'HẠNG MỤC': '  SƠN DẦU ', 'NGÀNH HÀNG': '' }), f.specData('vs', 'Bồn cầu', 65, { 'HẠNG MỤC': 'Hạng mục lạ' }),
      f.specData('son', 'Sơn lót', 66, { 'HẠNG MỤC': '' }), f.specData('ct', 'Ổ cắm điện', 67, { 'HẠNG MỤC': 'Không có trong danh sách', 'NGÀNH HÀNG': 'ct' }), f.denData(68, { 'NGÀNH HÀNG': 'xyz' }), f.denData(69, { 'NGÀNH HÀNG': 'vs' }), f.denData(70, { 'HẠNG MỤC': 'Sen tắm' }),
      f.specData('son', 'Sơn nội thất', 71, { 'TÍNH NĂNG': '• Chống bám bẩn\n- Dễ lau chùi\r\n* Kháng khuẩn\n\n   \nMàng sơn bền', 'DÒNG SẢN PHẨM': 'Dòng cao cấp', 'MÀU SẮC': '  Trắng sứ ' }),
      f.specData('ct', 'Công tắc thông minh', 72, { 'BẢO HÀNH (năm)': 0 }), f.specData('ct', 'Ổ cắm điện', 73, { 'CHIỀU RỘNG MẶT (mm)': '', 'CHIỀU CAO MẶT (mm)': '120', 'ĐỘ DÀY / ĐỘ NHÔ MẶT (mm)': '' })])
      await save(S.adminA, d, { label: 'saveDbProduct ngành / hạng mục: ' + f.show([d['NGÀNH HÀNG'], d['HẠNG MỤC']]) });

    /* ================= saveDbProduct: quyền ================= */
    let k = 100;
    for (const s of f.all.concat([S.adminView, S.viewB, S.adminC, S.editC])) { k++; await save(s, f.denData(k, { 'MÃ SẢN PHẨM': 'DZ-Q-' + k }), { label: 'saveDbProduct quyền @' + s.label }); k++; await saveR(s, f.denData(k, { 'MÃ SẢN PHẨM': 'DZ-Q-' + k }), { label: 'saveDbProduct (REST) quyền @' + s.label }); }

    /* ================= saveDbProduct: tham số và từng nhánh ================= */
    for (const a of [[], [null], [{}], ['chuỗi'], [123], [true], [[]], [[{ 'TÊN SẢN PHẨM': 'trong mảng' }]], [{ 'TÊN SẢN PHẨM': '   ' }], [{ 'TÊN SẢN PHẨM': null }], [{ 'TÊN SẢN PHẨM': '' }], [{ 'tên sản phẩm': 'nhãn viết thường' }], [{ 'MÃ SẢN PHẨM': 'DZ-KHONG-TEN' }]])
      await h.both(S.adminA, 'saveDbProduct', a, { label: 'saveDbProduct tham số ' + JSON.stringify(a) });
    // tên không phải chuỗi; không mã (2 lần -> 2 dòng); nhãn lạ bị bỏ; tham số thừa (opts không tới được từ client)
    for (const d of [{ 'TÊN SẢN PHẨM': 12345 }, { 'TÊN SẢN PHẨM': true }, { 'TÊN SẢN PHẨM': ['a', 'b'] }, { 'TÊN SẢN PHẨM': { a: 1 } }, { 'TÊN SẢN PHẨM': 'DZ không mã' }, { 'TÊN SẢN PHẨM': 'DZ không mã' }, { 'TÊN SẢN PHẨM': 'DZ không mã 2', 'MÃ SẢN PHẨM': '   ' }, { 'TÊN SẢN PHẨM': 'DZ mã số', 'MÃ SẢN PHẨM': 778899 },
      { 'TÊN SẢN PHẨM': '  DZ tên có khoảng trắng  ', 'MÃ SẢN PHẨM': '  DZ-TRIM  ' }, { 'TÊN SẢN PHẨM': 'DZ nhãn lạ', 'MÃ SẢN PHẨM': 'DZ-LA', 'CỘT KHÔNG CÓ': 'x', id: 5, cong_ty_id: 'abc', ma_sp: 'chen' },   // nhãn 'constructor' / 'toString': rò prototype của Node (ARCH 10), Node lỗi còn Go tạo dòng -> lệch id, không đưa vào
      { 'TÊN SẢN PHẨM': 'DZ emoji 😀 "nháy" \'đơn\' \\ gạch', 'MÃ SẢN PHẨM': 'DZ-EMOJI-😀', 'GHI CHÚ': 'dòng 1\ndòng 2\ttab\u0001', 'MÀU SẮC': 'Đỏ' }, { 'TÊN SẢN PHẨM': 'x'.repeat(5000), 'MÃ SẢN PHẨM': 'DZ-DAI', 'GHI CHÚ': 'y'.repeat(100000) }])
      await save(S.adminA, d, lb('saveDbProduct', d));
    await h.rpc(S.adminA, 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'DZ opts', 'MÃ SẢN PHẨM': 'DZ-OPTS' }, { noAudit: true, macDinh: { dvt: 'Thùng', trang_thai: 'Ngừng' } }, 'thừa'], { label: 'saveDbProduct tham số thừa (opts không tới được)' });
    // LẮP NGUỒN RỜI và các cột số
    k = 200;
    for (const v of ['có', 'CÓ', 'yes', 'True', '1', 'x', 'X', 1, true, 'không', 'no', 0, false, ' có ', 'co', '2'])
      await save(S.adminA, { 'TÊN SẢN PHẨM': 'DZ nguồn rời ' + f.show(v), 'MÃ SẢN PHẨM': 'DZ-NR-' + (++k), 'LẮP NGUỒN RỜI': v }, { label: 'saveDbProduct LẮP NGUỒN RỜI = ' + f.show(v) });
    for (const v of ['12.500.000', '12,5', '1.234,56', '1,234.56', '30%', 'abc', '  1 500 ', '1e3', '0x10', '-5', -5, 0, '0', 0.1, 1e21, 99999999999999999999, 1.005, '12.5', '12.50', '1.250', '1.25', '.5', '5.', '1,5,6', '1.2.3', '₫ 1.200.000', '1 200 000 đ', true, false, [], [5], ['a'], {}, { a: 1 }, 'Infinity', 'NaN'])
      await save(S.adminA, { 'TÊN SẢN PHẨM': 'DZ giá ' + f.show(v), 'MÃ SẢN PHẨM': 'DZ-GIA-' + (++k), 'GIÁ BÁN LẺ': v, 'QUANG THÔNG (lm)': v, 'GIÁ BÁN BỘ NGUỒN': v }, { label: 'saveDbProduct số = ' + f.show(v) });
    for (const v of [0, 100, 100.5, 150, -1, '50%', '12,125', 12.125, '99,999'])
      await save(S.adminA, { 'TÊN SẢN PHẨM': 'DZ ck ' + f.show(v), 'MÃ SẢN PHẨM': 'DZ-CK-' + (++k), 'GIÁ BÁN LẺ': 1000000, 'CHIẾT KHẤU ĐẠI LÝ (%)': v, 'BẢO HÀNH (năm)': v }, { label: 'saveDbProduct chiết khấu / bảo hành = ' + f.show(v) });
    // giá trị không phải chuỗi cho cột chữ
    for (const v of [123, 0, -0, 1.5, true, false, ['a', 'b'], [], { a: 1 }, {}, [[1]], 1e21, 'chuỗi\u0000null'])
      await save(S.adminA, { 'TÊN SẢN PHẨM': 'DZ kiểu ' + f.show(v), 'MÃ SẢN PHẨM': 'DZ-KIEU-' + (++k), 'GHI CHÚ': v, 'MÀU SẮC': v, 'CÔNG SUẤT (W)': v, 'TRẠNG THÁI': v }, { label: 'saveDbProduct cột chữ = ' + f.show(v) });

    /* ================= saveDbProduct: trùng mã -> cập nhật / biến thể ================= */
    const V = (over) => Object.assign({ 'TÊN SẢN PHẨM': 'DZ biến thể', 'MÃ SẢN PHẨM': 'DZ-BT', 'CÔNG SUẤT (W)': '10', 'NHIỆT ĐỘ MÀU (K)': '3000', 'GÓC CHIẾU (°)': '24', 'MÀU SẮC': 'Trắng', 'GIÁ BÁN LẺ': 500000 }, over || {});
    r = await save(S.adminA, V()); const bt1 = f.idOf(r);
    await save(S.adminA, V({ 'TÊN SẢN PHẨM': 'DZ biến thể (sửa tên)', 'GIÁ BÁN LẺ': 550000 }), { label: 'saveDbProduct trùng mã + trục -> cập nhật' });
    await saveR(S.edit, V({ 'GHI CHÚ': 'cập nhật qua REST' }), { label: 'saveDbProduct (REST) trùng mã + trục -> cập nhật' });
    r = await save(S.adminA, V({ 'NHIỆT ĐỘ MÀU (K)': '4000' }), { label: 'saveDbProduct khác nhiệt độ màu -> biến thể mới' }); const bt2 = f.idOf(r);
    r = await save(S.adminA, V({ 'CÔNG SUẤT (W)': '12' }), { label: 'saveDbProduct khác công suất -> biến thể mới' }); const bt3 = f.idOf(r);
    await save(S.adminA, V({ 'GÓC CHIẾU (°)': '38' })); await save(S.adminA, V({ 'MÀU SẮC': 'Đen' }));
    await save(S.adminA, V({ 'CÔNG SUẤT (W)': 10 }), { label: 'saveDbProduct công suất là số 10 (khớp chuỗi "10")' });
    await save(S.adminA, V({ 'CÔNG SUẤT (W)': '', 'NHIỆT ĐỘ MÀU (K)': null, 'GÓC CHIẾU (°)': undefined, 'MÀU SẮC': '' }), { label: 'saveDbProduct trục rỗng -> dòng mới' });
    await save(S.adminA, V({ 'CÔNG SUẤT (W)': '', 'NHIỆT ĐỘ MÀU (K)': '', 'GÓC CHIẾU (°)': '', 'MÀU SẮC': '', 'GHI CHÚ': 'lần 2' }), { label: 'saveDbProduct trục rỗng lần 2 -> cập nhật' });
    await save(S.adminA, V({ 'KÍCH THƯỚC': '600x400' }), { label: 'saveDbProduct đèn có KÍCH THƯỚC -> thêm vào khoá' });
    await save(S.adminA, V({ 'KÍCH THƯỚC': '600x400', 'GHI CHÚ': 'kt lần 2' }));
    // trục có ký tự đặc biệt của bộ lọc
    for (const v of ['a"b', 'a\\b', 'a,b', 'a(b)', 'a.b', '50%', 'a&b=c', 'null', 'a b', 'ấ', 'A', 'a', "a'b", 'a*b', '{x}', 'a:b', '']) { await save(S.adminA, V({ 'MÃ SẢN PHẨM': 'DZ-KT', 'MÀU SẮC': v }), { label: 'saveDbProduct trục MÀU SẮC = ' + f.show(v) }); await save(S.adminA, V({ 'MÃ SẢN PHẨM': 'DZ-KT', 'MÀU SẮC': v, 'GHI CHÚ': 'lần 2' }), { label: 'saveDbProduct trục MÀU SẮC = ' + f.show(v) + ' lần 2' }); }
    for (const ma of ['DZ "nháy"', 'DZ\\gạch', 'DZ,phẩy', 'DZ(ngoặc)', 'DZ 50%', 'DZ&x=1', 'DZ/chéo', 'DZ?hỏi#thăng', 'DZ+cộng', 'dz-bt', 'DZ-BT ', '  DZ-BT', 'DZ.chấm', '123456', '007', '1e3', '.', '..', 'null', 'undefined', "DZ'đơn", 'DZ*sao', 'ĐZ-ấ']) {
      await save(S.adminA, { 'TÊN SẢN PHẨM': 'DZ mã lạ', 'MÃ SẢN PHẨM': ma }, { label: 'saveDbProduct mã ' + f.show(ma) + ' (tạo)' });
      await save(S.adminA, { 'TÊN SẢN PHẨM': 'DZ mã lạ lần 2', 'MÃ SẢN PHẨM': ma, 'GHI CHÚ': 'cập nhật' }, { label: 'saveDbProduct mã ' + f.show(ma) + ' (lần 2)' });
    }
    // vệ sinh / sơn: KÍCH THƯỚC nằm trong khoá
    const vsV = (over) => f.specData('vs', 'Bồn tắm', 80, Object.assign({ 'MÃ SẢN PHẨM': 'DZ-VS-KT' }, over || {}));
    await save(S.adminA, vsV({ 'KÍCH THƯỚC': '1500x700' })); await save(S.adminA, vsV({ 'KÍCH THƯỚC': '1700x800' })); await save(S.adminA, vsV({ 'KÍCH THƯỚC': '1700x800', 'GHI CHÚ': 'cập nhật' })); await save(S.adminA, vsV({ 'KÍCH THƯỚC': '' }));
    const sonV = (over) => f.specData('son', 'Sơn ngoại thất', 81, Object.assign({ 'MÃ SẢN PHẨM': 'DZ-SON-KT' }, over || {}));
    await save(S.adminA, sonV({ 'KÍCH THƯỚC': '5L', 'MÀU SẮC': 'Trắng' })); await save(S.adminA, sonV({ 'KÍCH THƯỚC': '18L', 'MÀU SẮC': 'Trắng' })); await save(S.adminA, sonV({ 'KÍCH THƯỚC': '18L', 'MÀU SẮC': 'Xanh' })); await save(S.adminA, sonV({ 'KÍCH THƯỚC': '18L', 'MÀU SẮC': 'Xanh', 'GIÁ BÁN LẺ': 1 }));
    // phạm vi công ty: cùng mã ở công ty khác / không công ty / super xem như A
    /* [khoảng trống: bộ chạy không xác định] Super không công ty tìm dòng trùng khoá KHÔNG lọc công ty và không ORDER BY (store_supa.js:535,
       limit 1). Khi mã đã có ở nhiều công ty, dòng được chọn tuỳ thứ tự vật lý của Postgres - chính bản Node cũng không xác định, và 2 database
       chọn 2 dòng khác nhau làm lệch mọi bước sau. Vì vậy super ghi TRƯỚC khi công ty khác có cùng mã: lúc đó chỉ 1 dòng (của A) khớp.
       Ngay trong công ty A cũng có 2 dòng trùng 4 trục (dòng không KÍCH THƯỚC và dòng 600x400 tạo ở trên; KÍCH THƯỚC chỉ vào khoá khi được gửi),
       nên 3 lần ghi dưới đây gửi kèm KÍCH THƯỚC = 600x400: khoá có 5 trục và đúng 1 dòng khớp. Bước kiểm ngay sau đó khẳng định điều này. */
    const kt = (await h.sql("select count(*)::int n from products where product_code = 'DZ-BT' and size = '600x400'"));
    h.check('đúng 1 dòng DZ-BT 600x400 ở mỗi database (đầu vào của limit 1 không ORDER BY là duy nhất)', kt.node[0].n === 1 && kt.go[0].n === 1, kt.node, kt.go);
    await save(S.root, V({ 'KÍCH THƯỚC': '600x400', 'GHI CHÚ': 'không công ty' }), { label: 'saveDbProduct cùng mã DZ-BT @super (không công ty; chỉ dòng của A khớp -> cập nhật dòng đó)' });
    await save(S.root, V({ 'KÍCH THƯỚC': '600x400', 'GHI CHÚ': 'super lần 2' }), { label: 'saveDbProduct cùng mã DZ-BT @super lần 2' });
    await save(S.viewA, V({ 'KÍCH THƯỚC': '600x400', 'GHI CHÚ': 'super xem A' }), { label: 'saveDbProduct cùng mã DZ-BT @super xem A (cập nhật dòng của A)' });
    await save(S.adminB, V({ 'GHI CHÚ': 'của B' }), { label: 'saveDbProduct cùng mã DZ-BT @admin B (dòng riêng)' });
    await save(S.adminC, V({ 'GHI CHÚ': 'của C' }));
    await save(S.viewB, V({ 'GHI CHÚ': 'super xem B' }), { label: 'saveDbProduct cùng mã DZ-BT @super xem B (cập nhật dòng của B, không đụng dòng của A / C)' });
    await h.dbCheck('sau saveDbProduct', ['products', 'product_lighting_specs', 'product_sanitary_specs', 'product_paint_specs', 'product_switch_socket_specs', 'product_histories', 'audit_logs']);

    /* ================= getDbProduct ================= */
    await f.matrix('getDbProduct', [bt1]);
    await f.matrix('getDbProduct', ['DZ-BT']);
    for (const ng of ['den', 'vs', 'son', 'ct']) for (const id of ids[ng].slice(0, 3)) await h.both(S.adminA, 'getDbProduct', [id]);
    for (const key of [undefined, null, '', '   ', 0, 1, '1', ' 1 ', '0001', 999999999, '99999999999999999999999', -1, 1.5, '1.5', '1e3', true, false, [], [1], ['DZ-BT'], {}, 'KHÔNG-CÓ', 'dz-bt', ' DZ-BT ', 'DZ "nháy"', 'DZ\\gạch', 'DZ,phẩy', 'DZ(ngoặc)', 'DZ 50%', 'DZ&x=1', 'DZ/chéo', 'DZ?hỏi#thăng', 'DZ+cộng', '123456', '007', "DZ'đơn", 'ĐZ-ấ', 'DZ-BT&id=eq.1', '.', '..'])
      await h.both(S.adminA, 'getDbProduct', key === undefined ? [] : [key], { label: 'getDbProduct ' + f.show(key) });
    await h.both(S.adminA, 'getDbProduct', [bt1, 'thừa']);
    await h.both(S.adminB, 'getDbProduct', [bt2], { label: 'getDbProduct id của công ty A @admin B' });
    await h.both(S.adminC, 'getDbProduct', [1], { label: 'getDbProduct id kho chung @admin C' });
    await h.both(S.viewDz, 'getDbProduct', [1]);

    /* ================= updateDbProductTracked ================= */
    const upd = (s, key, data, opts) => h.rpc(s, 'updateDbProductTracked', [key, data], opts);
    const updR = (s, key, data, opts) => h.rest(s, 'updateDbProductTracked', [key, data], opts);
    await f.matrixRpc('updateDbProductTracked', (s) => [ids.den[0], { 'GHI CHÚ': 'sửa bởi ' + s.label }]);
    for (const s of f.all) await updR(s, ids.den[1], { 'GHI CHÚ': 'REST sửa bởi ' + s.label });
    await upd(S.adminA, ids.den[0], { 'GHI CHÚ': 'sửa bởi super xem công ty A' }, { label: 'updateDbProductTracked không đổi gì' });
    await upd(S.adminA, ids.den[0], f.denData(1, { 'GHI CHÚ': 'sửa bởi super xem công ty A' }), { label: 'updateDbProductTracked gửi lại nguyên dữ liệu (số / boolean so theo chuỗi)' });
    await upd(S.adminA, ids.den[0], { 'GIÁ BÁN LẺ': 1250000, 'CHIẾT KHẤU ĐẠI LÝ (%)': 12.5, 'QUANG THÔNG (lm)': '610', 'CHIỀU CAO (mm)': '55,5', 'LẮP NGUỒN RỜI': 'x' }, { label: 'updateDbProductTracked cùng giá trị viết khác' });
    await upd(S.adminA, ids.den[0], { 'GIÁ BÁN LẺ': '1.300.000', 'CHIẾT KHẤU ĐẠI LÝ (%)': '15', 'QUANG THÔNG (lm)': '', 'CHIỀU CAO (mm)': null, 'LẮP NGUỒN RỜI': '', 'MÀU SẮC': null, 'CHẤT LIỆU': 123, 'TÊN SẢN PHẨM': 'DZ Đèn âm trần #1 (đổi tên)', 'CỘT LẠ': 1 });
    await updR(S.adminA, ids.den[0], { 'GIÁ BÁN LẺ': 0, 'BẢO HÀNH (năm)': '', 'DÒNG RA TỐI ĐA (mA)': 'abc', 'HIỆU SUẤT PHÁT QUANG (lm/W)': '90,25', 'ĐƯỜNG KÍNH (mm)': 0, 'LẮP NGUỒN RỜI': true, 'GHI CHÚ': '' });
    for (const d of [{ 'GIÁ BÁN LẺ': -1 }, { 'CHIẾT KHẤU ĐẠI LÝ (%)': 101 }, { 'TÊN SẢN PHẨM': '' }, { 'TÊN SẢN PHẨM': '  ' }, { 'TÊN SẢN PHẨM': null }, { 'MÃ SẢN PHẨM': '' }, { 'MÃ SẢN PHẨM': 'DZ-DEN-2' }, { 'NGÀNH HÀNG': 'vs' }, { 'NGÀNH HÀNG': '' }, { 'HẠNG MỤC': 'Lavabo' }, { 'ẢNH SẢN PHẨM': 'https://img.test/moi.jpg' }, { 'GHI CHÚ': ['a', 'b'] }, { 'GHI CHÚ': { a: 1 } }, { 'GHI CHÚ': 5 }, { 'GHI CHÚ': true },
      { 'LOẠI NẮP': 'Nắp đóng êm', 'KIỂU LẮP ĐẶT': 'Treo tường' }, { 'ĐỘ PHỦ': '12 m²/lít' }, { 'SỐ Ổ CẮM (ổ)': '3' }, { 'KÍCH THƯỚC': '1x1' }])
      await upd(S.adminA, ids.den[2], d, lb('updateDbProductTracked', d));
    // trùng khoá duy nhất khi đổi trục của biến thể
    await upd(S.adminA, bt2, { 'NHIỆT ĐỘ MÀU (K)': '3000' }, { label: 'updateDbProductTracked đổi trục trùng biến thể khác (lỗi trùng khoá)' });
    await upd(S.adminA, 'DZ-BT', { 'GHI CHÚ': 'sửa theo mã (dòng id nhỏ nhất)' });
    await updR(S.adminA, 'DZ-BT', { 'GHI CHÚ': 'sửa theo mã qua REST' });
    for (const ng of ['vs', 'son', 'ct']) {
      const hm = SPEC[ng].HANG_MUC[0], labels = SPEC[ng].labelsOf(hm);
      const d = {}; labels.forEach((l, j) => { d[l] = j % 3 === 0 ? '' : 'sửa ' + j; }); d['GIÁ BÁN LẺ'] = '2.345.678'; d['TÍNH NĂNG'] = 'Tính năng mới\n- dòng 2';
      await upd(S.adminA, ids[ng][0], d, { label: 'updateDbProductTracked thông số ngành ' + ng });
      await updR(S.edit, ids[ng][1], d, { label: 'updateDbProductTracked (REST) thông số ngành ' + ng });
      await upd(S.adminA, ids[ng][0], d, { label: 'updateDbProductTracked thông số ngành ' + ng + ' lần 2 (không đổi)' });
    }
    for (const a of [[], [null], [''], ['  '], [0], [ids.den[0]], [ids.den[0], null], [ids.den[0], {}], [ids.den[0], 'chuỗi'], [ids.den[0], 5], [ids.den[0], []], [ids.den[0], ['GHI CHÚ']], [ids.den[0], true], [999999999, { 'GHI CHÚ': 'x' }], ['KHÔNG-CÓ', { 'GHI CHÚ': 'x' }], [' ' + 'DZ-DEN-3' + ' ', { 'GHI CHÚ': 'khoá có khoảng trắng' }],
      [true, { 'GHI CHÚ': 'x' }], [[ids.den[0]], { 'GHI CHÚ': 'khoá là mảng' }], [{}, { 'GHI CHÚ': 'x' }], [1.5, { 'GHI CHÚ': 'x' }], [-1, { 'GHI CHÚ': 'x' }], [ids.den[0], { 'GHI CHÚ': 'opts thừa' }, { giuDuyet: true, noAudit: true, auditAction: 'x' }]])
      await h.both(S.adminA, 'updateDbProductTracked', a, { label: 'updateDbProductTracked tham số ' + JSON.stringify(a) });
    // phạm vi công ty: sản phẩm của công ty khác -> chặn "kho chung"
    await h.both(S.adminB, 'updateDbProductTracked', [ids.den[0], { 'GHI CHÚ': 'B sửa của A' }], { label: 'updateDbProductTracked SP của A @admin B' });
    await h.both(S.adminA, 'updateDbProductTracked', [1, { 'GHI CHÚ': 'A sửa của Dezon' }], { label: 'updateDbProductTracked SP của Dezon @admin A' });
    await h.both(S.adminC, 'updateDbProductTracked', [1, { 'GHI CHÚ': 'C sửa kho chung' }], { label: 'updateDbProductTracked SP kho chung @admin C' });
    await h.both(S.editC, 'updateDbProductTracked', [1, { 'GHI CHÚ': 'C sửa kho chung' }]);
    await upd(S.root, ids.den[3], { 'GHI CHÚ': 'super sửa của A' }, { label: 'updateDbProductTracked SP của A @super' });
    await upd(S.viewB, ids.den[3], { 'GHI CHÚ': 'super xem B sửa của A' }, { label: 'updateDbProductTracked SP của A @super xem B' });
    await upd(S.adminView, ids.den[3], { 'GHI CHÚ': 'admin A gửi view B' });

    /* ================= setSpDuyet ================= */
    const duyet = (s, keys, approve, opts) => h.rpc(s, 'setSpDuyet', approve === undefined ? [keys] : [keys, approve], opts);
    await f.matrixRpc('setSpDuyet', (s) => [[ids.vs[0], ids.vs[1]], true]);
    for (const s of f.all) await h.rest(s, 'setSpDuyet', [[ids.son[0], ids.son[1]], true]);
    await duyet(S.adminA, [ids.vs[0], ids.vs[1]], false); await duyet(S.duyet, ids.vs[0]); await duyet(S.none, String(ids.vs[1] instanceof Object ? '' : ids.vs[1]), true);
    await duyet(S.boc, 'DZ-BT', true, { label: 'setSpDuyet theo mã -> cả nhóm biến thể' });
    await duyet(S.adminA, 'DZ-BT', true, { label: 'setSpDuyet theo mã lần 2 (đã đúng)' });
    await duyet(S.adminA, ['DZ-BT', bt1, 'KHÔNG-CÓ', 999999999, '', null, ' DZ-KT '], false);
    for (const ap of [null, 0, '', 'false', 'no', 1, 'x', {}, []]) { await duyet(S.adminA, [ids.ct[0]], ap, { label: 'setSpDuyet approve = ' + f.show(ap) }); await h.rest(S.adminA, 'setSpDuyet', [[ids.ct[1]], ap], { label: 'setSpDuyet (REST) approve = ' + f.show(ap) }); }
    for (const a of [[], [null], [undefined, true], [[]], [[], false], [''], ['', true], [0], [123456789012], [{}], [[{}]], [[[ids.ct[2]]]], [[true, false]], [[1.5, -1, '1e3']], ['x1', true], [['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'], true], [[ids.ct[2], ids.ct[2], ids.ct[2]], true], [[ids.ct[3], ids.ct[4]], true, 'thừa']])
      await h.both(S.adminA, 'setSpDuyet', a, { label: 'setSpDuyet tham số ' + JSON.stringify(a) });
    await duyet(S.adminA, ids.den.concat(ids.vs, ids.son), true, { label: 'setSpDuyet nhiều SP (audit cắt 8 mã)' });
    await duyet(S.adminA, ids.den.concat(ids.vs, ids.son), false, { label: 'bỏ duyệt nhiều SP' });
    // phạm vi công ty
    await duyet(S.adminB, [ids.den[0]], true, { label: 'setSpDuyet SP của A @admin B' });
    await duyet(S.adminA, [1, 2], true, { label: 'setSpDuyet SP của Dezon @admin A' });
    await duyet(S.adminC, [1, 2], true, { label: 'setSpDuyet SP kho chung @admin C' });
    await duyet(S.root, [ids.den[0]], true, { label: 'setSpDuyet SP của A @super' });
    await duyet(S.viewB, [ids.den[1]], true, { label: 'setSpDuyet SP của A @super xem B' });
    // sửa SP đã duyệt -> quay về chưa duyệt (cả 2 đường: updateDbProductTracked và saveDbProduct trùng mã)
    await duyet(S.adminA, [ids.den[0], ids.den[1], bt1], true);
    await upd(S.edit, ids.den[0], { 'GHI CHÚ': 'sửa sau khi duyệt' }, { label: 'updateDbProductTracked SP đã duyệt -> bỏ duyệt' });
    await updR(S.edit, ids.den[1], { 'GHI CHÚ': 'sửa sau khi duyệt (REST)' }, { label: 'updateDbProductTracked (REST) SP đã duyệt -> bỏ duyệt' });
    await upd(S.edit, ids.den[0], { 'GHI CHÚ': 'sửa sau khi duyệt' }, { label: 'updateDbProductTracked không đổi (giữ chưa duyệt)' });
    await duyet(S.adminA, 'DZ-BT', true);
    await save(S.edit, V({ 'GHI CHÚ': 'nhập lại sau khi duyệt' }), { label: 'saveDbProduct trùng mã SP đã duyệt -> bỏ duyệt' });
    await h.both(S.adminA, 'getDbProduct', [bt1]);

    /* ================= getProductHistory ================= */
    await f.matrix('getProductHistory', ['DZ-BT']);
    for (const ma of [undefined, null, '', '  ', 'DZ-DEN-1', ' DZ-DEN-1 ', 'dz-den-1', 'DZ-VS-1', 'DZ-SON-11', 'DZ-CT-20', 'KHÔNG-CÓ', 0, 123456, '123456', true, ['DZ-DEN-1'], {}, 'DZ "nháy"', 'DZ/chéo', 'DZ 50%', 'DZ&x=1', 'DZ không mã', 'DZ-EMOJI-😀', String(1)])
      await h.both(S.adminA, 'getProductHistory', ma === undefined ? [] : [ma], { label: 'getProductHistory ' + f.show(ma) });
    await h.both(S.adminB, 'getProductHistory', ['DZ-DEN-1'], { label: 'getProductHistory mã của A @admin B' });
    await h.both(S.root, 'getProductHistory', ['DZ-DEN-1']);
    await h.both(S.adminA, 'getProductHistory', ['DZ-DEN-1', 'thừa']);

    /* ================= deleteDbProduct (chỉ admin) ================= */
    await f.matrixRpc('deleteDbProduct', (s) => [s === S.adminA ? ids.ct[5] : s === S.root ? ids.ct[6] : s === S.viewA ? ids.ct[7] : ids.ct[8]]);
    for (const s of f.all) await h.rest(s, 'deleteDbProduct', [s === S.adminA ? ids.ct[9] : s === S.root ? ids.ct[10] : s === S.viewA ? ids.ct[11] : ids.ct[8]]);
    await h.both(S.adminA, 'deleteDbProduct', [ids.ct[5]], { label: 'deleteDbProduct lần 2 (không còn)' });
    await h.rpc(S.adminA, 'deleteDbProduct', ['DZ-BT'], { label: 'deleteDbProduct theo mã -> chỉ dòng id nhỏ nhất' });
    await h.rest(S.adminA, 'deleteDbProduct', ['DZ-BT'], { label: 'deleteDbProduct (REST) theo mã -> dòng kế' });
    for (const a of [[], [null], [''], ['   '], [0], [true], [false], [[]], [[ids.ct[12]]], [{}], ['KHÔNG-CÓ'], [999999999], [1.5], ['1.5'], [-1], [' DZ-KT '], ['DZ "nháy"'], ['DZ/chéo'], ['DZ 50%'], ['DZ&x=1'], ['007'], [ids.ct[13], 'thừa']])
      await h.both(S.adminA, 'deleteDbProduct', a, { label: 'deleteDbProduct tham số ' + JSON.stringify(a) });
    await h.both(S.adminB, 'deleteDbProduct', [ids.den[4]], { label: 'deleteDbProduct SP của A @admin B' });
    await h.both(S.adminA, 'deleteDbProduct', [3], { label: 'deleteDbProduct SP của Dezon @admin A' });
    await h.both(S.adminC, 'deleteDbProduct', [3], { label: 'deleteDbProduct SP kho chung @admin C' });
    await h.both(S.adminView, 'deleteDbProduct', [3]);
    await h.rpc(S.viewB, 'deleteDbProduct', [ids.den[4]], { label: 'deleteDbProduct SP của A @super xem B' });

    /* ================= kết quả cuối ================= */
    await h.both(S.adminA, 'getProducts', [], { label: 'getProducts @admin A sau mọi thay đổi' });
    await h.both(S.adminB, 'getProducts', [], { label: 'getProducts @admin B sau mọi thay đổi' });
    await h.both(S.viewA, 'getProducts', [], { label: 'getProducts @super xem A sau mọi thay đổi' });
    await h.both(S.root, 'bootstrap', [], { label: 'bootstrap @super (danh mục từ bộ nhớ đệm)' });
    await h.both(S.adminA, 'bootstrap', []);
    await h.dbCheck('sau kịch bản sản phẩm', ['products', 'product_lighting_specs', 'product_sanitary_specs', 'product_paint_specs', 'product_switch_socket_specs', 'product_histories', 'audit_logs', 'product_combos', 'favorite_products']);
  },
};
