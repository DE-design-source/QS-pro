'use strict';
/* Module quotations (xuất file): exportBaoGia (server/export.js 466-522) và POST /export/bang (server/index.js 780-794,
   export.js 527-567). File .xlsx của 2 phía được đọc lại bằng ExcelJS và so từng sheet / ô / style / vùng gộp / độ rộng / ảnh.
   Ảnh của dòng: địa chỉ http chỉ dùng loại bị từ chối ngay (localhost, 127.x, 10.x); ảnh thật đi qua /media?token=... tới Lark GIẢ
   (lib/fake.js) - không lần nào đi ra mạng thật. */
const { fx } = require('./_fx');

module.exports = {
  name: 'area2/06 export',
  async run(h) {
    const f = await fx(h), S = f.S;
    /* Token Lark của kịch bản này hết hạn ngay (expire 30 giây <= biên 60 giây của lark.js): mỗi lần tải ảnh server đều lấy token mới, nên số
       request tới Lark giả không phụ thuộc thời điểm, và KHÔNG để lại token còn hạn 2 giờ trong bộ nhớ của 2 server - nếu để lại, các bước
       "lấy token lỗi" của area3/05 sẽ không còn tới được endpoint token. */
    h.fake.set('larkToken', { status: 200, body: JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 't-area2', expire: 30 }), type: 'application/json' });
    const X = { xlsxAt: 'result.base64' };
    const E = (args, s, label) => h.rpc(s || S.adminA, 'exportBaoGia', args, Object.assign({ label: 'exportBaoGia ' + label }, X));
    const ER = (args, s, label) => h.rest(s || S.adminA, 'exportBaoGia', args, Object.assign({ label: 'exportBaoGia (REST) ' + label }, X));
    const EB = async (args, s, label) => { await E(args, s, label); await ER(args, s, label); };

    /* ================= dữ liệu: dự án có dòng + tờ bìa ================= */
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY-X1', ten: 'Biệt thự Đông Đô – Thảo Điền (đợt 1)', khachHang: 'Anh Đức & chị Hoa', quyMo: '1 trệt 2 lầu', tongDT: '350,5', dtBaoGia: '412,75', nhuCau: 'Để ở', phanKhuc: 'Cao cấp', maBaoGia: 'BG-2026/010', vat: 8 }]);
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY-X2', ten: '', khachHang: 'Dự án không tên, không tờ bìa' }]);
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY-X3', ten: 'Dự án không có dòng', tongDT: 200, dtBaoGia: 0 }]);
    await h.rpc(S.adminB, 'createProject', [{ maDA: 'DY-XB', ten: 'Báo giá của B' }]);
    await h.rpc(S.root, 'createProject', [{ maDA: 'DY-XR', ten: 'Báo giá không công ty' }]);
    const line = (i, o) => Object.assign({ ma: 'X-' + i, ten: 'Sản phẩm ' + i, nhom: '3.2.5', hangMuc: 'Đèn âm trần', tang: 'Tầng 1', thuongHieu: 'Philips', ncc: 'NCC A', moTa: 'Mô tả ' + i + '\ndòng 2', kichThuoc: 'Ø90', dvt: 'Bộ', khuVuc: 'Phòng ' + i, maBanVe: 'L-' + i,
      donGiaVon: 100000 * i + 0.5, chietKhau: 10, lnPct: 25 + i, ckKhach: i % 4, trangThai: 'Đã chốt', ghiChu: 'gc ' + i, extra: { nganh: 'den' } }, o || {});
    const lines = [line(1), line(2, { tang: 'Tầng 2', hinhAnh: 'http://localhost/a.png' }), line(3, { tang: '', thuongHieu: 'Panasonic', ncc: 'panasonic' }), line(4, { tang: '  Tầng 1  ', thuongHieu: '', ncc: 'NCC B', hinhAnh: 'https://127.0.0.1/b.jpg\nhttps://10.0.0.1/c.png' }),
      line(5, { nhom: '3.2.5.1', thuongHieu: 'PHILIPS', ncc: 'ncc a', hinhAnh: 'không phải url' }), line(6, { nhom: '3.2.6.1', hangMuc: 'Bồn cầu', thuongHieu: 'TOTO', ncc: '', extra: { nganh: 'vs' }, ckKhach: 0, hinhAnh: '/media?token=khong-co' }), line(7, { nhom: '3.2.6.1', tang: 'Tầng 2', thuongHieu: '', ncc: '' }),
      line(8, { nhom: '3.2.2', hangMuc: 'Sơn nội thất', thuongHieu: 'Dulux', ncc: 'Dulux', extra: { nganh: 'son' }, donGiaVon: 0, donGiaBan: 0 }), line(9, { nhom: '3.2.6.2', thuongHieu: 'Schneider', ncc: 'Điện Quang', extra: {} }), line(10, { nhom: 'Khác' }), line(11, { nhom: '' }), line(12, { nhom: '   ' }),
      line(13, { nhom: 'A/B:C*?[x]\\y' }), line(14, { nhom: 'Nhóm có tên rất dài vượt quá ba mươi mốt ký tự của Excel' }), line(15, { nhom: 'Nhóm có tên rất dài vượt quá ba mươi ký tự KHÁC' }), line(16, { nhom: 'nhóm x' }), line(17, { nhom: 'NHÓM X' }), line(18, { nhom: 'Nhóm X' }),
      line(20, { nhom: '3.2.1', soLuong: 0, tang: 'Tầng 3' }), line(21, { nhom: '3.2.1', tang: 'Tầng 3', donGiaVon: '12.500.000', donGiaBan: '15.000.000' })];
    for (let i = 0; i < 8; i++) lines.push(line(30 + i, { nhom: '3.2.7', thuongHieu: 'TH' + i, ncc: 'NCC' + i }));   // > 8 nhà cung cấp trong 1 mục: chỉ lấy 8
    lines.push(line(40, { nhom: '3.2.7', thuongHieu: 'TH thứ 10', ncc: 'bị bỏ' }));
    let k = 0;
    for (const l of lines) { k++; await h.rpc(S.adminA, 'addLine', ['DY-X1', l, k % 5 === 0 ? 2.5 : k % 3 + 1], { label: 'addLine DY-X1 #' + k + ' nhom = ' + JSON.stringify(l.nhom) }); }
    for (const l of lines.slice(0, 6)) await h.rpc(S.adminA, 'addLine', ['DY-X2', l, 2], { label: 'addLine DY-X2' });
    // tên nhóm / tầng trùng thuộc tính của Object.prototype: bản Node ném TypeError (cmap / gmap là object thường)
    for (const [ma, o] of [['DY-X4', { nhom: 'constructor' }], ['DY-X5', { tang: 'toString' }], ['DY-X6', { nhom: '__proto__', tang: '__proto__' }], ['DY-X7', { nhom: 'hasOwnProperty', tang: 'valueOf' }]]) {
      await h.rpc(S.adminA, 'createProject', [{ maDA: ma, ten: 'Tên trùng prototype ' + ma }]);
      await h.rpc(S.adminA, 'addLine', [ma, line(1), 1]); await h.rpc(S.adminA, 'addLine', [ma, line(2, o), 2]);
    }
    await h.rpc(S.adminB, 'addLine', ['DY-XB', line(1), 3]);
    await h.rpc(S.root, 'addLine', ['DY-XR', line(2), 4]);
    const cover = [{ stt: '1', hangMuc: 'TƯ VẤN DỰ ÁN', moTa: '', chiPhi: 0 }, { stt: '1.1', hangMuc: 'Tư vấn QLDA', moTa: 'Tư vấn tài chính, pháp lý', chiPhi: 25000000 }, { stt: '10', hangMuc: 'Mục 10 (xếp sau mục 3)', moTa: '', chiPhi: 1000000 }, { stt: '3', hangMuc: 'XÂY DỰNG', moTa: '', chiPhi: 999 },
      { stt: '3.2', hangMuc: 'Phần hoàn thiện cơ bản', moTa: 'Thi công hoàn thiện', chiPhi: 5 }, { stt: '3.1', hangMuc: 'Phần thô', moTa: 'Móng, cột, dầm, sàn', chiPhi: 850000000.4 }, { stt: '3.2.5', hangMuc: 'Thiết bị đèn', moTa: 'Vật tư', chiPhi: 120500000 }, { stt: '3.2.1', hangMuc: 'Trần thạch cao', moTa: '', chiPhi: 45000000 },
      { stt: '3.2.6', hangMuc: '', moTa: 'Không có tên hạng mục', chiPhi: '30.000.000' }, { stt: '3.2.5.1', hangMuc: 'Đèn rọi (cấp 4)', moTa: 'in nghiêng', chiPhi: 500000 }, { stt: '2', hangMuc: 'TƯ VẤN THIẾT KẾ', moTa: 'Mục cấp 1 không có con', chiPhi: 60000000 }, { stt: 'x', hangMuc: 'STT không phải số', moTa: '', chiPhi: 7 }, { stt: '', hangMuc: 'STT rỗng', moTa: '', chiPhi: 3 }];
    await h.rpc(S.adminA, 'saveCover', ['DY-X1', cover]);
    await h.rpc(S.adminB, 'saveCover', ['DY-XB', cover.slice(0, 5)]);

    const ALL = ['stt', 'khuVuc', 'maBanVe', 'nhom', 'loai', 'maSP', 'ten', 'thuongHieu', 'ncc', 'moTa', 'kichThuoc', 'hinhAnh', 'dvt', 'soLuong', 'donGiaBan', 'thanhTienBan', 'tang', 'nganh', 'giaNCC', 'chietKhau', 'giaDaiLy', 'lnPct', 'donGia', 'ckKhach', 'donGiaCK', 'markup', 'margin', 'lnVnd', 'thanhTien', 'trangThai', 'ghiChu'];
    const C = (...keys) => keys.map((x) => (typeof x === 'string' ? { key: x } : x));
    const basic = C('stt', 'khuVuc', 'ten', 'dvt', 'soLuong', 'donGiaBan', 'thanhTienBan');
    const phanTho = [{ ten: 'Phần móng', tt: 150000000, items: [{ n: 'Đào đất hố móng', dvt: 'm3', kl: 120.5, dgnt: 90000, ttnt: 10845000, dg: 120000, tt: 14460000, gc: 'ghi chú' }, { n: 'Bê tông lót', dvt: 'm3', kl: '12,5', dgnt: '1.100.000', ttnt: 13750000, dg: 1350000, tt: 16875000 }, { n: 'Dòng thiếu số' }] },
      { ten: 'Phần thân', tt: '250000000', items: [] }, { ten: '', tt: null }, { tt: 5, items: [{ n: null, dvt: 0, kl: 'abc', dg: true, tt: [5], gc: { a: 1 } }] }];
    const phanThoKH = [{ ten: 'Phần móng (bản gửi khách: không có giá nhà thầu)', tt: 150000000, items: [{ n: 'Đào đất', dvt: 'm3', kl: 120.5, dg: 120000, tt: 14460000, gc: '' }, { n: 'Bê tông', dvt: 'm3', kl: 12, dg: 1350000, tt: 16200000 }] }];
    const tong = [['Cộng chưa VAT', 1234567890], ['Chiết khấu 5%', -61728394.5], ['Sau chiết khấu', '1172839495'], ['VAT 8%', 93827160], ['TỔNG THANH TOÁN', 1266666655]];

    /* ================= exportBaoGia: quyền + dự án ================= */
    await h.both(S.anon, 'exportBaoGia', ['DY-X1', basic]);
    for (const s of [S.none, S.edit, S.duyet, S.adminA, S.viewA, S.root, S.adminB, S.viewB, S.adminView]) await EB(['DY-X1', basic, 'xlsx'], s, 'DY-X1 cột cơ bản @' + s.label);
    for (const [ma, s] of [['DY-XB', S.adminB], ['DY-XB', S.adminA], ['DY-XB', S.root], ['DY-XR', S.root], ['DY-XR', S.adminA], ['DY-X2', S.adminA], ['DY-X3', S.adminA], ['KHÔNG-CÓ', S.adminA]]) await EB([ma, basic], s, ma + ' @' + s.label);
    for (const a of [[], [null], [''], [0], [123], [true], [{}], [[]], [['DY-X1']], ['dy-x1'], [' DY-X1 '], ['Mã có dấu Đ đ / \\ : * ? " < > | và khoảng trắng'], ['DY-X1', basic, 'xlsx', null, null, null, null, null, 'thừa']])
      await h.both(S.adminA, 'exportBaoGia', a, Object.assign({ label: 'exportBaoGia mã ' + JSON.stringify(a).slice(0, 80) + ' @admin A' }, X));

    for (const ma of ['DY-X4', 'DY-X5', 'DY-X6', 'DY-X7']) await EB([ma, basic], S.adminA, ma + ' (tên nhóm / tầng trùng thuộc tính của Object.prototype)');

    /* ================= cols ================= */
    const colSets = [['mọi cột (không gửi cols)', undefined], ['cols null', null], ['cols []', []], ['mọi khoá của EXPORT_STY', C(...ALL)], ['mọi khoá, đảo thứ tự', C(...ALL.slice().reverse())], ['không có cột thành tiền', C('stt', 'ten', 'moTa')], ['1 cột', C('ten')], ['1 cột thành tiền', C('thanhTienBan')],
      ['thành tiền ở cột đầu', C('thanhTienBan', 'ten', 'stt')], ['khoá thanhTien của client', C('stt', 'ten', 'soLuong', 'donGiaCK', 'thanhTien')], ['cả thanhTienBan lẫn thanhTien', C('ten', 'thanhTien', 'thanhTienBan')], ['không có khuVuc (tên tầng ở cột 2)', C('stt', 'ten', 'thanhTienBan')],
      ['khuVuc ở cột cuối', C('stt', 'ten', 'thanhTienBan', 'khuVuc')], ['có cột ảnh', C('stt', 'hinhAnh', 'ten', 'thanhTienBan')], ['chỉ cột ảnh', C('hinhAnh')], ['nhãn do client gửi', C({ key: 'stt', label: '#' }, { key: 'moTa', label: 'Thông tin chính' }, { key: 'kichThuoc', label: 'Thông số thiết kế' }, { key: 'thanhTienBan', label: '' })],
      ['khoá lạ có / không nhãn', C({ key: 'zzz', label: 'Cột lạ' }, { key: 'yyy' }, { key: 'lineId' }, { key: 'extra' }, { key: 'tuNhap' }, { key: 'thanhTienVon', label: 'TT vốn' }, { key: 'giamGiaNcc' }, { key: 'maDA' })], ['cột trùng nhau', C('ten', 'ten', 'stt', 'stt', 'thanhTienBan')],
      ['các cột dẫn xuất', C('nganh', 'giaNCC', 'giaDaiLy', 'donGia', 'donGiaCK', 'markup', 'margin', 'lnVnd', 'thanhTien')], ['phần tử thiếu key', [{}, { label: 'Chỉ có nhãn' }, { key: null, label: 'key null' }, { key: '' }, { key: 0 }, { key: 5, label: 'key số' }]], ['phần tử là chuỗi / số', ['ten', 5, true]],
      ['phần tử null', [null]], ['phần tử null ở giữa', [{ key: 'ten' }, null]], ['cols là chuỗi', 'ten,stt'], ['cols là số', 5], ['cols là object', { key: 'ten' }], ['cols là true', true], ['cols object có length', { length: 2, 0: { key: 'ten' } }], ['nhãn không phải chuỗi', C({ key: 'ten', label: 5 }, { key: 'stt', label: { a: 1 } }, { key: 'dvt', label: ['a', 'b'] }, { key: 'soLuong', label: true })],
      ['62 cột', Array.from({ length: 62 }, (_, i) => ({ key: i % 2 ? 'ten' : 'c' + i, label: 'Cột ' + i }))]];
    for (const [lab, cols] of colSets) { const a = cols === undefined ? ['DY-X1'] : ['DY-X1', cols]; await E(a, S.adminA, 'cols: ' + lab); if (cols === undefined || Array.isArray(cols)) await ER(a, S.adminA, 'cols: ' + lab); }
    await E(['DY-X3', C(...ALL)], S.adminA, 'dự án không có dòng, mọi cột');
    await E(['DY-X2', C('stt', 'hinhAnh', 'ten')], S.adminA, 'dự án không tên + cột ảnh');

    /* [khoảng trống B.med: nhúng ảnh chưa từng tới được] export.js 312-322, 331-334, 348-352: tải ảnh qua lark.mediaDownload (Lark GIẢ), nhận ảnh theo
       chữ ký file png / jpeg (không theo Content-Type), bỏ file không phải ảnh / lỗi tải, wb.addImage + vị trí + chiều cao dòng 52.
       So file: vùng ảnh + sha1 nội dung (lib/xlsx.js); so request mà 2 server gửi tới Lark giả (h.fakeCheck). */
    h.fakeCheck('Lark: các lần tải ảnh từ đầu kịch bản tới đây');
    await h.rpc(S.adminA, 'createProject', [{ maDA: 'DY-X8', ten: 'Dự án có ảnh Lark', khachHang: 'Khách ảnh' }]);
    const anh = ['/media?token=img-png', '/media?token=img-jpg', '/media?token=png-sai-type', '/media?token=jpg-khong-type', '/media?token=txt-utf8', '/media?token=err500', '/media?token=err403', '/media?token=big', '/media?token=no-type', '/media?token=empty',
      '/media?token=img-png\n/media?token=img-jpg', '/media?token=khong-co\n/media?token=img-png', '  /media?token=img-png  ', '/media?x=1&token=img-jpg&y=2', '/media?token=img%2Dpng', '/media?token=a%2Fb', '/media?token=', '/media', '/media/?token=img-png', '/mediax?token=img-png', 'media?token=img-png', '/MEDIA?token=img-png', ''];
    let ia = 0;
    for (const hinhAnh of anh) { ia++; await h.rpc(S.adminA, 'addLine', ['DY-X8', line(50 + ia, { nhom: ia % 2 ? '3.2.5' : '3.2.6.1', hinhAnh }), 1], { label: 'addLine DY-X8 hinhAnh = ' + JSON.stringify(hinhAnh) }); }
    await EB(['DY-X8', C('stt', 'hinhAnh', 'ten', 'thanhTienBan')], S.adminA, 'ảnh Lark: có cột ảnh');
    h.fakeCheck('Lark: tải ảnh cho exportBaoGia (rpc + REST), có cột ảnh');
    await E(['DY-X8', C('hinhAnh')], S.adminA, 'ảnh Lark: chỉ cột ảnh');
    await E(['DY-X8', C(...ALL)], S.adminA, 'ảnh Lark: mọi cột');
    await E(['DY-X8', C('ten', 'stt', 'hinhAnh'), 'xlsx', ['3.2.5']], S.adminA, 'ảnh Lark: lọc 1 đề mục, cột ảnh ở cuối');
    h.fakeCheck('Lark: tải ảnh cho exportBaoGia, các bộ cột khác');
    await E(['DY-X8', C('stt', 'ten', 'thanhTienBan')], S.adminA, 'ảnh Lark: không xuất cột ảnh');
    h.fakeCheck('Lark: không xuất cột ảnh thì không tải gì', { count: 0 });
    // Lark lỗi: không lấy được token / đứt kết nối -> bỏ ảnh, file vẫn xuất
    for (const [ten, mode] of [['token lỗi (code khác 0)', { status: 200, body: '{"code":99991663,"msg":"app not found"}', type: 'application/json' }], ['endpoint token trả 500 không JSON', { status: 500, body: 'hỏng', type: 'text/plain' }], ['endpoint token đứt kết nối', 'drop']]) {
      h.fake.set('larkToken', mode);
      await E(['DY-X8', C('stt', 'hinhAnh', 'ten')], S.adminA, 'ảnh Lark khi ' + ten);
      h.fakeCheck('Lark: ' + ten);
    }
    h.fake.set('larkToken', { status: 200, body: JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 't-area2', expire: 30 }), type: 'application/json' });
    h.fake.set('larkMedia', 'drop');
    await E(['DY-X8', C('stt', 'hinhAnh', 'ten')], S.adminA, 'ảnh Lark khi tải media đứt kết nối');
    h.fake.reset();
    h.fake.set('larkToken', { status: 200, body: JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 't-area2', expire: 30 }), type: 'application/json' });
    h.fakeCheck('Lark: media đứt kết nối');

    /* ================= format (không dùng) ================= */
    for (const fm of ['xlsx', 'pdf', '', null, 5, {}, []]) await E(['DY-X1', basic, fm], S.adminA, 'format = ' + f.show(fm));

    /* ================= nodes: lọc dòng theo đề mục ================= */
    for (const nd of [['3.2.5'], ['3.2'], ['3'], ['3.2.5', 'Khác'], ['3.2.5.1', '3.2.6'], ['3.2.6.1', '3.2.6.2'], ['không có'], [], null, [''], ['nhóm x'], ['NHÓM X'], ['constructor'], [3.2], [5], [null], [true], [{}], [['3.2.5']], '3.2.5', 'chuỗi', 5, true, {}, { length: 1, 0: '3.2.5' }, ['3.2.5', '3.2.5']])
      { const a = ['DY-X1', basic, 'xlsx', nd]; await E(a, S.adminA, 'nodes = ' + f.show(nd)); if (nd === null || Array.isArray(nd)) await ER(a, S.adminA, 'nodes = ' + f.show(nd)); }

    /* ================= phanTho: sheet "3.1 Phần thô" ================= */
    const pts = [['có giá nhà thầu', phanTho], ['bản gửi khách (không gửi dgnt)', phanThoKH], ['[]', []], ['null', null], ['dgnt = 0 (vẫn in cột nội bộ)', [{ ten: 'A', tt: 1, items: [{ n: 'x', dgnt: 0 }] }]], ['dgnt = null', [{ ten: 'A', tt: 1, items: [{ n: 'x', dgnt: null }] }]], ['mục không có items', [{ ten: 'A', tt: 10 }, { ten: 'B', tt: '20' }]],
      ['items không phải mảng (chuỗi)', [{ ten: 'A', items: 'abc' }]], ['items không phải mảng (object)', [{ ten: 'A', items: { a: 1 } }]], ['items = 5 sau mục có dgnt', [{ ten: 'A', items: [{ n: 'x', dgnt: 1 }] }, { ten: 'B', items: 5 }]], ['items có null', [{ ten: 'A', items: [null, { n: 'x' }] }]], ['mục null', [null]], ['mục là chuỗi', ['abc', 5]],
      ['phanTho là chuỗi', 'abc'], ['phanTho là object', { a: 1 }], ['phanTho là số', 7], ['30 mục x 20 dòng', Array.from({ length: 30 }, (_, i) => ({ ten: 'Mục ' + i, tt: i * 1e6, items: Array.from({ length: 20 }, (_, j) => ({ n: 'Việc ' + i + '.' + j, dvt: 'm2', kl: j + 0.25, dgnt: 1000 * j, ttnt: 1, dg: 2000 * j, tt: 3, gc: j % 2 ? 'gc' : '' })) }))]];
    for (const [lab, pt] of pts) { const a = ['DY-X1', basic, 'xlsx', null, pt]; await E(a, S.adminA, 'phanTho: ' + lab); if (pt === null || Array.isArray(pt)) await ER(a, S.adminA, 'phanTho: ' + lab); }

    /* ================= anMuc: ẩn mục lớn của tờ bìa ================= */
    for (const an of [['1'], ['3'], ['2', '10'], [1], [3, '1'], ['1', '2', '3', '10', 'x', ''], ['3.2'], [], null, 'chuỗi', '3', 5, {}, [null], [['3']], ['constructor'], ['toString', 'x']])
      { const a = ['DY-X1', basic, 'xlsx', null, null, an]; await E(a, S.adminA, 'anMuc = ' + f.show(an)); if (an === null || Array.isArray(an)) await ER(a, S.adminA, 'anMuc = ' + f.show(an)); }
    await E(['DY-X2', basic, 'xlsx', null, null, ['3']], S.adminA, 'anMuc = ["3"] trên tờ bìa dựng từ mẫu');

    /* ================= tong: sheet "Tổng cộng" ================= */
    for (const [lab, tg] of [['5 dòng', tong], ['1 dòng', [['TỔNG', 5]]], ['[]', []], ['null', null], ['25 dòng (chỉ in 20, dòng cuối tính theo 25)', Array.from({ length: 25 }, (_, i) => ['Dòng ' + i, i * 1000])], ['đúng 20 dòng', Array.from({ length: 20 }, (_, i) => ['Dòng ' + i, i])],
      ['giá trị lạ', [[null, null], [5, '7'], ['a', 'abc'], ['b', '1.500.000'], ['c', true], ['d', [3]], ['e', {}], [{ x: 1 }, 1e21], [], ['chỉ nhãn']]], ['phần tử không phải mảng', ['abc', 5, { 0: 'k', 1: 9 }, true]], ['phần tử null', [['a', 1], null]], ['tong là chuỗi', 'abc'], ['tong là object', { a: 1 }], ['tong là số', 3]])
      { const a = ['DY-X1', basic, 'xlsx', null, null, null, tg]; await E(a, S.adminA, 'tong: ' + lab); if (tg === null || Array.isArray(tg)) await ER(a, S.adminA, 'tong: ' + lab); }

    /* ================= org: tên công ty in trên sheet chi tiết ================= */
    for (const og of ['Công ty TNHH Đông Đô', '   ', '', '  có khoảng trắng 2 đầu  ', 'đ'.repeat(130), '😀'.repeat(61), 5, 0, true, false, null, { ten: 'x' }, ['a', 'b'], 'ß straße ǆ ﬁ i̇'])
      { const a = ['DY-X1', basic, 'xlsx', null, null, null, null, og]; await E(a, S.adminA, 'org = ' + f.show(og)); await ER(a, S.adminA, 'org = ' + f.show(og)); }

    /* ================= tất cả tuỳ chọn cùng lúc (như nút Xuất Excel của giao diện) ================= */
    const fullArgs = ['DY-X1', C(...ALL.filter((x) => x !== 'hinhAnh')), 'xlsx', ['3.2', 'Khác', 'nhóm x'], phanTho, ['10'], tong, 'CÔNG TY CỔ PHẦN ĐÔNG ĐÔ'];
    await EB(fullArgs, S.adminA, 'đủ 8 tham số @admin A');
    await EB(fullArgs, S.viewA, 'đủ 8 tham số @super xem A');
    await EB(['DY-X1', C(...ALL), 'xlsx', [], phanThoKH, [], tong, ''], S.adminA, 'mọi cột + phần thô bản khách + tổng');
    // tên dự án -> tên file: bỏ dấu, ký tự ngoài [A-Za-z0-9_-] thành "_" (đ / Đ cũng thành "_")
    for (const ten of ['Nhà phố Quận 7', 'ĐƯỜNG đi', 'a/b\\c:d*e?f', '  ', 'tên-có_gạch 123', '😀 emoji', 'x'.repeat(250), 'ǅ ﬁ ß İ ı', 'Ấ ấ ễ ụ ở']) {
      await h.rpc(S.adminA, 'updateProject', ['DY-X3', { ten }], { label: 'updateProject DY-X3 ten = ' + f.show(ten) });
      await EB(['DY-X3', basic], S.adminA, 'tên file từ tên dự án ' + f.show(ten));
    }
    for (const [key, v] of [['tongDT', '1.250,5'], ['tongDT', 'abc'], ['dtBaoGia', '300'], ['dtBaoGia', '1,234,567'], ['tongDT', '12-5'], ['maBaoGia', ''], ['khachHang', ''], ['quyMo', '0']]) {
      await h.rpc(S.adminA, 'updateProject', ['DY-X1', { [key]: v }], { label: 'updateProject DY-X1 ' + key + ' = ' + f.show(v) });
      await E(['DY-X1', basic], S.adminA, 'sau khi ' + key + ' = ' + f.show(v) + ' (khối lượng 3.2 = dtBaoGia || tongDT)');
    }

    /* ================= dự án thật trong seed (Dezon + không công ty), KHÔNG xuất cột ảnh ================= */
    const seed = (await h.sql("select p.project_code ma, (p.company_id is null) nul from projects p join quotation_lines l on l.project_code = p.project_code where p.project_code not like 'DY%' group by 1, 2 order by count(*) desc, 1 limit 6")).node;
    const noImg = C(...ALL.filter((x) => x !== 'hinhAnh'));
    for (const p of seed) { const s = p.nul ? S.root : S.viewDz; await EB([p.ma, noImg, 'xlsx', null, phanThoKH, null, tong], s, 'dự án seed ' + p.ma + ' @' + s.label); await h.both(s, 'getCoverOrInit', [p.ma], { label: 'getCoverOrInit dự án seed ' + p.ma }); }
    h.check('seed có dự án để xuất', seed.length > 0, seed.length, 0);

    /* ================= POST /export/bang ================= */
    const post = (label, sess, body, opts) => {
      const hd = { 'Content-Type': 'application/json' };
      if (sess && sess.token && !(opts && opts.viaBody)) hd.Authorization = h.pair('Bearer ' + sess.token.node, 'Bearer ' + sess.token.go);
      const b = (side) => (typeof body === 'string' ? body : JSON.stringify(Object.assign({}, body, opts && opts.viaBody ? { token: sess.token[side] } : {})));
      return h.raw('POST /export/bang ' + label, { method: 'POST', path: '/export/bang', headers: hd, body: h.pair(b('node'), b('go')) }, opts);
    };
    const cols = [{ label: 'STT' }, { label: 'Nội dung' }, { label: 'ĐVT', num: false }, { label: 'Khối lượng', num: true }, { label: 'Thành tiền', num: 1 }];
    const rows = [{ group: 'I. PHẦN MÓNG' }, { cells: [1, 'Đào đất\nhố móng', 'm3', 120.5, 14460000] }, { cells: [2, 'Bê tông lót', 'm3', 12, 16200000.75] }, { group: 'II. PHẦN THÂN' }, { cells: ['3', 'Cột', '', 0, -5] }];
    const bang = { ten: 'Bảng chi phí phần thô', sheet: 'Phần thô', cols, rows, tong: [['Cộng', 30660000.75], ['VAT 8%', '2452860'], ['TỔNG', 33112860]] };
    await post('chưa đăng nhập', null, bang);
    await post('token sai', { token: h.pair('a.b', 'a.b') }, bang);
    for (const s of [S.none, S.edit, S.adminA, S.adminB, S.root, S.viewA]) await post('bảng đầy đủ @' + s.label, s, bang);
    await post('token trong thân (body.token)', S.adminA, bang, { viaBody: true });
    for (const b of [{}, { cols: [] }, { cols: null }, { cols: 'abc' }, { cols: 5 }, { cols: {} }, { cols: { length: 1, 0: { label: 'x' } } }, { rows, ten: 'không có cols' }, { Cols: cols }]) await post('thân ' + JSON.stringify(b).slice(0, 50) + ' (không có cột)', S.adminA, b);
    for (const b of ['[]', '[{"cols":[{"label":"a"}]}]', 'null', '"x"', '5', '']) await post('thân thô ' + JSON.stringify(b), S.adminA, b, b[0] === '[' || b[0] === '{' || b === '' ? undefined : { accept: f.badJson });
    const V = (lab, o) => post(lab, S.adminA, Object.assign({}, bang, o));
    for (const ten of [undefined, null, '', 0, 5, true, { a: 1 }, ['a'], 'x'.repeat(400), "nháy ' \" & < > 😀"]) await V('ten = ' + f.show(ten), { ten });
    for (const sheet of [undefined, null, '', 0, 5, true, 'A/B:C*?[x]\\y', '   ', ' có khoảng trắng 2 đầu ', 'x'.repeat(40), 'Tên dài hơn ba mươi ký tự của Excel đấy nhé', "'nháy đơn'", 'History', { a: 1 }, ['a', 'b'], '/', '😀'.repeat(20)]) await V('sheet = ' + f.show(sheet), { sheet });
    for (const [lab, cs] of [['1 cột', [{ label: 'Chỉ 1 cột' }]], ['1 cột số', [{ label: 'Số', num: true }]], ['2 cột', cols.slice(0, 2)], ['61 cột (cắt còn 60)', Array.from({ length: 61 }, (_, i) => ({ label: 'C' + i, num: i % 3 === 0 }))], ['nhãn lạ', [{ label: null }, { label: 0 }, { label: 5 }, { label: true }, { label: { a: 1 } }, { label: ['a', 'b'] }, {}, { num: 'x' }]],
      ['phần tử là chuỗi / số', ['abc', 5, true, []]], ['phần tử null', [null, { label: 'x' }]], ['phần tử null ở sau', [{ label: 'x' }, null]]])
      await V('cols: ' + lab, { cols: cs });
    for (const [lab, rs] of [['không gửi rows', undefined], ['null', null], ['[]', []], ['chuỗi', 'abc'], ['object', { a: 1 }], ['dòng null / chuỗi / số', [null, 'abc', 5, true, [], {}]], ['cells không phải mảng', [{ cells: 'abc' }, { cells: 5 }, { cells: { 0: 1 } }, { cells: null }]],
      ['cells dài hơn số cột', [{ cells: [1, 2, 3, 4, 5, 6, 7, 8] }]], ['cells ngắn hơn / rỗng', [{ cells: [1] }, { cells: [] }, { cells: [null, null, 'c'] }]], ['ô đủ kiểu', [{ cells: [true, false, null, { a: 1 }, [1, 2]] }, { cells: ['', ' ', 0, -0, 1e21] }, { cells: [1e-7, 0.1 + 0.2, 123456789012345680000, '12.500.000', '=SUM(A1)'] }, { cells: ['dòng 1\r\ndòng 2', '\u0001 điều khiển', 'x'.repeat(40000), '2026-10-13', '😀'] }]],
      ['group đủ kiểu', [{ group: '' }, { group: 0 }, { group: false }, { group: 5 }, { group: { a: 1 } }, { group: ['a', 'b'] }, { group: null, cells: [1, 'group null -> dòng thường'] }, { group: 'có cả cells', cells: [9, 9] }]], ['2000 dòng', Array.from({ length: 2000 }, (_, i) => (i % 50 ? { cells: [i, 'Dòng ' + i, 'm', i / 8, i * 1000] } : { group: 'Nhóm ' + i }))]])
      await V('rows: ' + lab, { rows: rs });
    for (const [lab, tg] of [['không gửi tong', undefined], ['null', null], ['[]', []], ['chuỗi', 'abc'], ['object', { a: 1 }], ['25 dòng (in 20)', Array.from({ length: 25 }, (_, i) => ['T' + i, i])], ['giá trị lạ', [[null, null], [0, '7'], ['a', 'abc'], ['b', '1.500.000'], ['c', true], [{ x: 1 }, [3]], [], ['chỉ nhãn']]], ['phần tử không phải mảng', ['abc', 5, { 0: 'k', 1: 9 }]], ['phần tử null', [['a', 1], null]]])
      await V('tong: ' + lab, { tong: tg });
    await post('tong khi chỉ có 1 cột (bị bỏ)', S.adminA, { cols: [{ label: 'A' }], rows: [{ cells: ['x'] }, { group: 'nhóm (1 cột: không gộp ô)' }], tong: [['T', 1]] });
    await post('không có ten (tiêu đề cột ở dòng 1)', S.adminA, { cols, rows });
    await post('ô số vô hạn (1e999 trong JSON)', S.adminA, '{"cols":[{"label":"a"},{"label":"b","num":true}],"rows":[{"cells":[1e999,-1e999]}],"tong":[["T",1e999]]}');
    await post('khoá thừa trong thân', S.adminA, Object.assign({ zzz: 1, maDA: 'DY-X1' }, bang));
    // [khoảng trống B.low: export.js:528] trần 20000 dòng của /export/bang: 20001 dòng -> dòng cuối bị cắt (trước chỉ thử tới 2000 dòng)
    await post('20001 dòng (cắt còn 20000)', S.adminA, { cols: [{ label: 'STT', num: true }, { label: 'Nội dung' }], rows: Array.from({ length: 20001 }, (_, i) => ({ cells: [i + 1, i === 20000 ? 'DÒNG BỊ CẮT' : 'd' + i] })), tong: [['Số dòng', 20001]] });
    // [khoảng trống B.low] xác thực của route lẻ: token hết hạn, header thắng thân, Content-Type không phải JSON, thân quá lớn, tài khoản / công ty bị khoá
    await f.routeAuth('/export/bang', bang, 'bang');
    await h.raw('GET /export/bang (sai phương thức)', { method: 'GET', path: '/export/bang', headers: { Authorization: h.pair('Bearer ' + S.adminA.token.node, 'Bearer ' + S.adminA.token.go) } });
  },
};
