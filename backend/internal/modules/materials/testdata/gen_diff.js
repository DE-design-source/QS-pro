'use strict';
/* Sinh diff.json: chạy kịch bản dưới đây bằng hàm GỐC của server/store_supa.js + server/auth.js (+ exportProductsXlsx của
 * server/index.js) trên database thử qspro_nodetest và ghi kết quả THÔ từng bước cùng bảng id đã lưu. Test Go (TestDiffDB)
 * chạy lại đúng kịch bản trên qspro_gotest rồi chuẩn hoá cả hai phía bằng CÙNG một hàm (id sinh tự động, thời điểm) để so.
 * Dữ liệu thử: 2 công ty + 6 tài khoản mang id cố định bên dưới, tên có tiền tố ZZ_materials / zz_materials; mọi dòng sinh ra
 * thuộc 2 công ty đó (hoặc do tài khoản zz_materials_sup tạo) và bị xoá ở đầu + cuối kịch bản. Không đụng dòng có sẵn.
 *
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen_diff.js > diff.json
 */
const crypto = require('crypto');
const ref = require('./noderef');
const supa = ref.supa, tenant = ref.tenant;
console.warn = function () {};
console.error = function () {};

const U = function (x) { return '3a7e51a1-0000-4000-8000-0000000000' + x; };
const C1 = U('c1'), C2 = U('c2'), A1 = U('a1'), E1 = U('e1'), D1 = U('d1'), A2 = U('a2'), S1 = U('51'), X1 = U('f1');
const ctxs = {
  root: { role: 'super' },
  c1adm: { uid: A1, role: 'admin', congTyId: C1, viewAs: null }, c1edit: { uid: E1, role: 'staff', congTyId: C1, viewAs: null },
  c1duyet: { uid: D1, role: 'staff', congTyId: C1, viewAs: null }, c2adm: { uid: A2, role: 'admin', congTyId: C2, viewAs: null },
  sup: { uid: S1, role: 'super', congTyId: null, viewAs: null }, supview: { uid: S1, role: 'super', congTyId: null, viewAs: C1 }
};
const actors = {
  root: null,
  c1adm: { uid: A1, u: 'zz_materials_adm', r: 'admin', ct: C1 }, c1edit: { uid: E1, u: 'zz_materials_edit', r: 'staff', ct: C1 },
  c1duyet: { uid: D1, u: 'zz_materials_duyet', r: 'staff', ct: C1 }, c2adm: { uid: A2, u: 'zz_materials_adm2', r: 'admin', ct: C2 },
  sup: { uid: S1, u: 'zz_materials_sup', r: 'super', ct: null }, supview: { uid: S1, u: 'zz_materials_sup', r: 'super', ct: null }
};
const rm = function (table, filter) { return { op: 'remove', table: table, filter: filter }; };
const cleanup = [];
[C1, C2].forEach(function (c) {
  ['sp_yeu_thich', 'db_san_pham', 'db_san_pham_history', 'audit_log', 'notifications', 'delete_requests', 'users'].forEach(function (t) {
    cleanup.push(rm(t, 'cong_ty_id=eq.' + c));
  });
});
cleanup.push(rm('sp_yeu_thich', 'nguoi_tao=eq.zz_materials_sup'), rm('db_san_pham', 'nguoi_tao=eq.zz_materials_sup'),
  rm('db_san_pham_history', 'changed_by_name=eq.zz_materials_sup'), rm('audit_log', 'username=eq.zz_materials_sup'),
  rm('users', 'id=eq.' + S1), rm('cong_ty', 'id=eq.' + C1), rm('cong_ty', 'id=eq.' + C2));
const user = function (id, username, role, ct, perms, hoTen, active) {
  return { id: id, username: username, ho_ten: hoTen, password_hash: 'x', role: role, active: active !== false, perms: perms, cong_ty_id: ct };
};
const setup = [
  { op: 'insert', table: 'cong_ty', rows: [{ id: C1, ten: 'ZZ_materials_co1', ma: 'zz-materials-1', dung_sp_dezon: false }, { id: C2, ten: 'ZZ_materials_co2', ma: 'zz-materials-2', dung_sp_dezon: false }] },
  { op: 'insert', table: 'users', rows: [
    user(A1, 'zz_materials_adm', 'admin', C1, '', 'ZZ_materials Quản Trị'), user(E1, 'zz_materials_edit', 'staff', C1, 'boc, sp_edit', ''),
    user(D1, 'zz_materials_duyet', 'staff', C1, 'sp_duyet', 'ZZ_materials Duyệt'), user(X1, 'zz_materials_off', 'admin', C1, '', 'ZZ_materials Nghỉ', false),
    user(A2, 'zz_materials_adm2', 'admin', C2, '', 'ZZ_materials Quản Trị 2'), user(S1, 'zz_materials_sup', 'super', null, '', 'ZZ_materials Super')] }
];
const call = function (ctx, fn, args, extra) { return Object.assign({ op: 'call', ctx: ctx, fn: fn, args: args || [] }, extra || {}); };
const rowsOf = function (table, filter, order, extra) { return Object.assign({ op: 'rows', table: table, filter: filter, order: order || 'id.asc' }, extra || {}); };
const D1DATA = { 'MÃ SẢN PHẨM': 'ZZ_MAT_D1', 'TÊN SẢN PHẨM': ' ZZ_materials_Đèn 1 ', 'DÒNG SẢN PHẨM': 'ZZ dòng đèn', 'HẠNG MỤC': 'Đèn âm trần', 'THƯƠNG HIỆU': 'ZZ', 'NHÀ CUNG CẤP': 'ZZ NCC',
  'CÔNG SUẤT (W)': '12', 'NHIỆT ĐỘ MÀU (K)': '3000, 4000', 'QUANG THÔNG (lm)': '1.200', 'GÓC CHIẾU (°)': '24/38', 'GÓC NGHIÊNG (°)': '', 'MÀU SẮC': 'Trắng "mờ" \\ a,b(c)',
  'CHẤT LIỆU': 'Nhôm', 'CHIỀU CAO (mm)': '85,5', 'ĐƯỜNG KÍNH (mm)': 90, 'LỖ KHOÉT TRẦN (mm)': '75', 'CHỈ SỐ IP': 'IP44', 'CRI': 90, 'HIỆU SUẤT PHÁT QUANG (lm/W)': '100',
  'TÊN CHIP LED': 'Bridgelux', 'LOẠI CHIP LED': 'COB', 'LẮP NGUỒN RỜI': 'Có', 'GIÁ BÁN BỘ NGUỒN': '150.000', 'DÒNG RA TỐI ĐA (mA)': '350', 'BẢO HÀNH (năm)': '2',
  'ĐƠN VỊ TÍNH': 'Bộ', 'GIÁ BÁN LẺ': '1.250.000', 'CHIẾT KHẤU ĐẠI LÝ (%)': '30%', 'ẢNH SẢN PHẨM': 'http://zz/1.jpg\nhttp://zz/2.jpg', 'GHI CHÚ': 'ghi chú', 'CỘT LẠ': 'bỏ', 'TRẠNG THÁI': null };
const VSDATA = { 'TÊN SẢN PHẨM': 'ZZ_materials_Bồn cầu', 'MÃ SẢN PHẨM': 'ZZ_MAT_VS1', 'HẠNG MỤC': 'bồn cầu', 'MÀU SẮC': 'Trắng', 'KIỂU LẮP ĐẶT': 'Một khối', 'KÍCH THƯỚC': 'L710 x W400',
  'LƯỢNG NƯỚC XẢ': '4.8/3L', 'HỆ THỐNG XẢ': 'Tornado', 'LƯU Ý': 'Lưu ý', 'BẢO HÀNH (năm)': 5, 'GIÁ BÁN LẺ': 12500000 };
const SONDATA = { 'TÊN SẢN PHẨM': 'ZZ_materials_Sơn', 'MÃ SẢN PHẨM': 'ZZ_MAT_SON1', 'HẠNG MỤC': 'Sơn nội thất', 'NGÀNH HÀNG': 'son', 'MÀU SẮC': 'Trắng sứ', 'KÍCH THƯỚC': '18L', 'ĐỘ PHỦ': '14 m²/lít',
  'TÍNH NĂNG': '• Che phủ\n- Dễ lau', 'BỀ MẶT HOÀN THIỆN': 'Mờ' };
const CTDATA = { 'TÊN SẢN PHẨM': 'ZZ_materials_Ổ cắm', 'MÃ SẢN PHẨM': 'ZZ_MAT_CT1', 'HẠNG MỤC': 'Ổ cắm điện', 'LOẠI CẤU KIỆN': 'Đế âm', 'MÀU SẮC': 'Trắng', 'SỐ Ổ CẮM (ổ)': '2',
  'DÒNG ĐIỆN ĐỊNH MỨC (A)': '16', 'CHIỀU RỘNG MẶT (mm)': '86', 'BẢO HÀNH (năm)': 1 };
const csv = Buffer.from('MÃ SẢN PHẨM,TÊN SẢN PHẨM,GIÁ BÁN LẺ,ĐƠN VỊ TÍNH\nZZ_MAT_CSV,ZZ_materials_csv,"1.500.000",Cái\n,,,\n', 'utf8').toString('base64');
const audit = function () { return rowsOf('audit_log', 'cong_ty_id=eq.' + C1, 'id.asc', { select: 'user_id,username,action,detail,cong_ty_id' }); };

const steps = cleanup.concat(setup, [
  call('c1adm', 'spMyPerms'), call('c1edit', 'spMyPerms'), call('c1duyet', 'spMyPerms'), call('sup', 'spMyPerms'),
  call('c1adm', 'getProducts'),
  call('c1adm', 'saveDbProduct', [D1DATA], { save: { p1: 'id' } }),
  call('c1adm', 'saveDbProduct', [Object.assign({}, D1DATA, { 'NHIỆT ĐỘ MÀU (K)': '5700', 'TÊN SẢN PHẨM': 'ZZ_materials_Đèn 1 (5700K)' })], { save: { p2: 'id' } }),
  call('c1edit', 'saveDbProduct', [Object.assign({}, D1DATA, { 'GHI CHÚ': 'ghi lại', 'TÊN SẢN PHẨM': 'ZZ_materials_Đèn 1 sửa' })]),
  call('c1edit', 'saveDbProduct', [VSDATA], { save: { p3: 'id' } }), call('c1adm', 'saveDbProduct', [SONDATA], { save: { p4: 'id' } }),
  call('c1adm', 'saveDbProduct', [CTDATA], { save: { p5: 'id' } }),
  call('c1adm', 'saveDbProduct', [{ 'MÃ SẢN PHẨM': 'ZZ_MAT_X' }]), call('c1adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'ZZ_materials_giá âm', 'GIÁ BÁN LẺ': -5 }]),
  call('c1adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'ZZ_materials_ck', 'CHIẾT KHẤU ĐẠI LÝ (%)': '150' }]),
  call('c1adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'ZZ_materials_không mã', 'ĐƠN VỊ TÍNH': 'm', 'LẮP NGUỒN RỜI': 'không' }], { save: { p7: 'id' } }),
  // mã lưu nguyên khoảng trắng: lần lưu sau tra theo mã đã cắt nên không thấy -> trùng khoá duy nhất (hành vi của Node)
  call('c1adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'ZZ_materials_mã có khoảng trắng', 'MÃ SẢN PHẨM': ' ZZ_MAT_SP ' }], { save: { p8: 'id' } }),
  call('c1adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'ZZ_materials_mã có khoảng trắng', 'MÃ SẢN PHẨM': ' ZZ_MAT_SP ' }]), call('c1adm', 'getDbProduct', [' ZZ_MAT_SP ']),
  call('c1adm', 'getDbProduct', ['{{p1}}']), call('c1adm', 'getDbProduct', ['ZZ_MAT_D1']), call('c1adm', 'getDbProduct', ['ZZ_MAT_KHONG']), call('c1adm', 'getDbProduct', ['{{#p3}}']),
  call('c2adm', 'getDbProduct', ['{{p1}}']),
  rowsOf('db_san_pham', 'cong_ty_id=eq.' + C1),
  // sửa + duyệt
  call('c1edit', 'updateDbProductTracked', ['{{p1}}', { 'TÊN SẢN PHẨM': 'ZZ_materials_Đèn 1 sửa', 'GIÁ BÁN LẺ': '1.300.000', 'LẮP NGUỒN RỜI': '', 'CHIỀU CAO (mm)': '', 'CÔNG SUẤT (W)': 15, 'KÍCH THƯỚC': '', 'GHI CHÚ': null, 'CỘT LẠ': 1 }]),
  call('c1edit', 'updateDbProductTracked', ['{{p1}}', { 'GIÁ BÁN LẺ': 1300000, 'CÔNG SUẤT (W)': '15' }]),
  call('c1edit', 'setSpDuyet', [['ZZ_MAT_D1']]), call('c1duyet', 'setSpDuyet', [['ZZ_MAT_D1', 'ZZ_MAT_KHONG', '{{p3}}']]), call('c1duyet', 'setSpDuyet', [['ZZ_MAT_D1'], true]),
  call('c1adm', 'updateDbProductTracked', ['ZZ_MAT_D1', { 'GHI CHÚ': 'đổi sau duyệt', 'GIÁ BÁN LẺ': '-1' }]),
  call('c1adm', 'updateDbProductTracked', ['ZZ_MAT_D1', { 'GHI CHÚ': 'đổi sau duyệt' }]),
  call('c1adm', 'saveDbProduct', [Object.assign({}, D1DATA, { 'NHIỆT ĐỘ MÀU (K)': '5700', 'GHI CHÚ': 'nhập lại biến thể đã duyệt' })]),
  call('c1duyet', 'setSpDuyet', ['{{p3}}', false]), call('c1duyet', 'setSpDuyet', [['{{p3}}'], null]), call('c2adm', 'setSpDuyet', [['{{p1}}', 'ZZ_MAT_D1']]),
  call('c2adm', 'updateDbProductTracked', ['{{p1}}', { 'GHI CHÚ': 'x' }]), call('c2adm', 'deleteDbProduct', ['{{p1}}']), call('c2adm', 'setCombo', ['{{p1}}', []]),
  call('c1adm', 'getProductHistory', ['ZZ_MAT_D1'], { sort: true }), call('c1adm', 'getProductHistory', ['ZZ_MAT_VS1'], { sort: true }),
  // yêu thích
  call('c1edit', 'setYeuThich', [['{{p1}}', 'ZZ_MAT_VS1', 'ZZ_MAT_KHONG', '']]), call('c1edit', 'setYeuThich', [['{{p1}}'], true]), call('c1adm', 'setYeuThich', ['{{#p1}}', false]),
  call('c2adm', 'setYeuThich', [['{{p1}}', '{{p4}}']]), call('sup', 'setYeuThich', [['{{p1}}']]), call('sup', 'setYeuThich', [['{{p1}}']]),
  rowsOf('sp_yeu_thich', 'nguoi_tao=like.zz_materials*', 'id.asc', { select: 'cong_ty_id,sp_id,ma_sp,nguoi_tao' }),
  call('sup', 'setYeuThich', [['{{p1}}'], false]),
  // combo
  call('c1adm', 'setCombo', ['{{p1}}', [{ id: '{{#p3}}', soLuong: 2, ghiChu: 'kèm' }, { id: '{{p4}}' }, { id: '{{#p1}}' }, { id: '{{#p3}}', soLuong: 9 }]]),
  call('c1adm', 'getCombo', ['{{p1}}']), call('c1adm', 'getCombo', ['{{p3}}']),
  call('c1edit', 'setCombo', ['{{p3}}', [{ id: '{{#p1}}', soLuong: 1 }, { id: '{{#p5}}', soLuong: '3' }]]), call('c1adm', 'getCombo', ['{{p3}}']),
  call('c1edit', 'setCombo', ['{{p3}}', [{ id: '{{#p1}}', soLuong: 4, ghiChu: 'ngược có SL' }, { id: '{{#p5}}', soLuong: 1 }]]), call('c1adm', 'getCombo', ['{{p3}}']), call('c1adm', 'getCombo', ['{{p1}}']),
  rowsOf('sp_combo', 'sp_id=in.({{p1}},{{p3}})', 'sp_id.asc,sort_no.asc,sp_kem_id.asc', { select: 'sp_id,sp_kem_id,so_luong,ghi_chu,sort_no' }),
  call('c1adm', 'setCombo', ['{{p1}}', [{ id: 999999999 }]]), call('c1adm', 'setCombo', ['{{p1}}', [{ ma: 'x' }]]), call('c1adm', 'setCombo', ['ZZ_MAT_KHONG', []]),
  call('c1adm', 'setCombo', ['{{p4}}', []]), call('c1adm', 'getCombo', ['{{p1}}']), call('c1adm', 'getCombo', ['ZZ_MAT_KHONG']),
  rowsOf('sp_combo', 'sp_id=in.({{p1}},{{p3}},{{p4}})', 'sp_id.asc,sort_no.asc,sp_kem_id.asc', { select: 'sp_id,sp_kem_id,so_luong,ghi_chu,sort_no' }),
  // biến thể
  call('c1adm', 'setBienThe', ['{{p1}}', ['{{p3}}', { id: '{{#p4}}' }, '{{p1}}', 'x']]), call('c1adm', 'getBienThe', ['{{p1}}']), call('c1adm', 'getBienThe', ['{{p3}}']),
  call('c1edit', 'setBienThe', ['{{p3}}', ['{{#p1}}']]), call('c1adm', 'getBienThe', ['{{p4}}']), call('c1adm', 'getBienThe', ['{{p1}}']),
  rowsOf('db_san_pham', 'cong_ty_id=eq.' + C1, 'id.asc', { select: 'id,ma_sp,nhom_bt,da_duyet,nguoi_duyet,nguoi_tao,nguoi_sua' }),
  call('c1adm', 'setBienThe', ['{{p1}}', ['x']]), call('c1adm', 'setBienThe', ['{{p1}}', []]), call('c1adm', 'setBienThe', ['{{p1}}']), call('c1adm', 'getBienThe', ['{{p3}}']),
  // danh mục + cache
  call('c1adm', 'getProducts'), call('c1adm', '$getProductsCached'), call('c1adm', '$getCatalogSheets'), call('c2adm', 'getProducts'),
  call('supview', 'getProducts'), call('sup', 'getProducts', [], { only: 'ZZ_materials' }),
  { op: 'xlsx', ctx: 'c1adm', keys: null }, { op: 'xlsx', ctx: 'c1adm', keys: ['{{#p1}}', 'ZZ_MAT_VS1', 'không có'] }, { op: 'xlsx', ctx: 'c2adm', keys: [] },
  // super không gán công ty
  call('sup', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'ZZ_materials_super', 'MÃ SẢN PHẨM': 'ZZ_MAT_SUP' }], { save: { p6: 'id' } }), call('sup', 'getDbProduct', ['{{p6}}']),
  call('sup', 'updateDbProductTracked', ['{{p6}}', { 'ĐƠN VỊ TÍNH': 'Hộp' }]), call('c1adm', 'getDbProduct', ['{{p6}}']), call('sup', 'deleteDbProduct', ['{{p6}}']),
  call('supview', 'updateDbProductTracked', ['{{p2}}', { 'GHI CHÚ': 'super xem như công ty' }]),
  // kho chung của Dezon
  { op: 'rows', table: 'cong_ty', filter: 'ma=eq.dezon', select: 'id', save: { dz: '0.id' } },
  { op: 'rows', table: 'db_san_pham', filter: 'cong_ty_id=eq.{{dz}}&ma_sp=not.like.ZZ*', select: 'id,ma_sp', order: 'id.asc', limit: 1, save: { dzsp: '0.id' } },
  { op: 'update', table: 'cong_ty', filter: 'id=eq.' + C1, patch: { dung_sp_dezon: true } },
  call('c1adm', 'getProducts', [], { digest: true }),
  call('c1adm', 'updateDbProductTracked', ['{{dzsp}}', { 'GHI CHÚ': 'không được sửa' }]), call('c1adm', 'deleteDbProduct', ['{{dzsp}}']),
  call('c1adm', 'setSpDuyet', [['{{dzsp}}']]), call('c1adm', 'setBienThe', ['{{dzsp}}', ['{{p1}}']]), call('c1adm', 'getDbProduct', ['{{dzsp}}']),
  call('c1adm', 'setYeuThich', [['{{dzsp}}']]), call('c1adm', '$getProductsCached', [], { digest: true }),
  { op: 'update', table: 'cong_ty', filter: 'id=eq.' + C1, patch: { dung_sp_dezon: false } },
  // nhập hàng loạt
  call('c1adm', 'importParse', [csv, 'csv']),
  call('c1edit', 'importCommit', [[
    { ten: 'ZZ_materials_nhập 1', ma: 'ZZ_MAT_I1', nhom: 'ZZ dòng', hangMuc: 'Đèn rọi', gia: '1.200.000', moTa: 'mô tả', hinhAnh: 'http://zz/i.jpg', dvt: 'Bộ',
      _raw: { 'TÊN SẢN PHẨM': '', 'GIÁ ĐẠI LÝ': 9, 'CÔNG SUẤT (W)': '7', 'ẢNH SẢN PHẨM': 'trong file', 'GIÁ BÁN LẺ': '' } },
    { ten: 'ZZ_materials_Bồn cầu', ma: 'ZZ_MAT_VS1', _nganh: 'vs', _raw: Object.assign({}, VSDATA, { 'ĐƠN VỊ TÍNH': 'Bộ', 'ĐỘ PHỦ': 'bỏ', 'LƯỢNG NƯỚC XẢ': '6L' }) },
    { ten: 'ZZ_materials_vs lỗi', _nganh: 'vs', _raw: { 'HẠNG MỤC': 'ghế' } }, { ten: 'ZZ_materials_vs thiếu', _nganh: 'vs', _raw: { 'HẠNG MỤC': 'Lavabo', 'MÀU SẮC': 'Trắng' } },
    { ten: '[VÍ DỤ] ZZ_materials', ma: 'ZZ_MAT_VD' }, {}, 'x', { ten: 'ZZ_materials_giá âm', gia: 5, _raw: { 'CHIẾT KHẤU ĐẠI LÝ (%)': '-3' } },
    { ten: 'ZZ_materials_sơn tự nhận', hangMuc: 'sơn lót', _raw: { 'MÀU SẮC': 'Xám', 'ĐỘ PHỦ': '10', 'KÍCH THƯỚC': '5L', 'CÔNG SUẤT (W)': '1' } }
  ]]),
  rowsOf('db_san_pham', 'cong_ty_id=eq.' + C1 + '&ma_sp=in.(ZZ_MAT_I1,ZZ_MAT_VS1)'), call('c1adm', 'importCommit', [null]),
  // yêu cầu xoá
  call('c1edit', 'requestDeleteProducts', [[{ maSP: 'ZZ_MAT_CT1', id: '{{#p5}}', ten: 'ZZ_materials_Ổ cắm' }, { ma: 'ZZ_MAT_KHONG', ten: null }, { ten: 'bỏ' }]]),
  call('c1edit', 'requestDeleteProducts', [[]]), call('c1duyet', 'requestDeleteProducts', [[{ maSP: 'ZZ_MAT_SON1' }]]),
  call('c1adm', 'listDeleteRequests', [], { save: { dr2: '0.id', dr1: '1.id' } }),
  rowsOf('notifications', 'cong_ty_id=eq.' + C1, 'id.asc', { select: 'user_id,kind,title,body,ref_id,is_read,cong_ty_id' }),
  call('c1adm', 'resolveDeleteRequest', ['{{#dr1}}', true]), call('c1adm', 'resolveDeleteRequest', ['{{#dr1}}', true]), call('c1adm', 'resolveDeleteRequest', ['{{dr2}}']),
  call('c1adm', 'resolveDeleteRequest', [0, true]), call('c2adm', 'resolveDeleteRequest', ['{{dr1}}', true]), call('c1adm', 'listDeleteRequests'), call('c2adm', 'listDeleteRequests'),
  call('c1adm', 'getDbProduct', ['{{p5}}']),
  rowsOf('notifications', 'cong_ty_id=eq.' + C1, 'id.asc', { select: 'user_id,kind,title,body,ref_id,is_read,cong_ty_id' }),
  // xoá
  call('c1adm', 'deleteDbProduct', ['ZZ_MAT_D1']), call('c1adm', 'deleteDbProduct', ['{{#p3}}']), call('c1adm', 'deleteDbProduct', ['{{p3}}']), call('c1adm', 'deleteDbProduct', [' ']),
  rowsOf('sp_combo', 'sp_id=in.({{p1}},{{p3}},{{p4}})', 'id.asc', { select: 'sp_id,sp_kem_id' }),
  rowsOf('sp_yeu_thich', 'nguoi_tao=like.zz_materials*', 'id.asc', { select: 'cong_ty_id,sp_id,ma_sp,nguoi_tao' }),
  rowsOf('db_san_pham', 'cong_ty_id=eq.' + C1),
  rowsOf('db_san_pham_history', 'cong_ty_id=eq.' + C1, 'id.asc', { select: 'ma_sp,field,old_value,new_value,changed_by,changed_by_name,cong_ty_id' }),
  rowsOf('db_san_pham_history', 'changed_by_name=eq.zz_materials_sup', 'id.asc', { select: 'ma_sp,field,old_value,new_value,changed_by,changed_by_name,cong_ty_id' }),
  audit(), rowsOf('audit_log', 'username=eq.zz_materials_sup', 'id.asc', { select: 'user_id,username,action,detail,cong_ty_id' }),
  rowsOf('audit_log', 'cong_ty_id=eq.' + C2, 'id.asc', { select: 'user_id,username,action,detail,cong_ty_id' })
], cleanup);

const saved = {};   // tên -> id (chuỗi)
function fill(v) {
  if (typeof v === 'string') {
    const m = /^\{\{#(\w+)\}\}$/.exec(v);
    if (m) return Number(saved[m[1]]);
    return v.replace(/\{\{(\w+)\}\}/g, function (_, n) { return saved[n] === undefined ? 'MISSING' : saved[n]; });
  }
  if (Array.isArray(v)) return v.map(fill);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(function (k) { o[k] = fill(v[k]); }); return o; }
  return v;
}
function at(v, path) { return String(path).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, v); }
function h12(v) { return crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12); }
const isZZ = function (p) { return /^zz_/i.test(String(p.ten)) || /^zz_/i.test(String(p.ma)); };
let exportXlsx = null;
async function xlsxDump(keys) {
  exportXlsx = exportXlsx || ref.loadExport();
  const out = await exportXlsx(keys);
  const wb = new (ref.ExcelJS().Workbook)();
  await wb.xlsx.load(out.buf);
  const ws = wb.worksheets[0];
  const nCol = ws.columnCount, cells = [], widths = [];
  for (let c = 1; c <= nCol; c++) widths.push(ws.getColumn(c).width);
  for (let r = 1; r <= out.count + 1; r++) {
    const row = [];
    for (let c = 1; c <= nCol; c++) { const v = ws.getRow(r).getCell(c).value; row.push(v == null ? '' : String(v)); }
    cells.push(row);
  }
  return { name: out.name.replace(/\d{4}-\d\d-\d\d/, '<date>'), count: out.count, sheets: wb.worksheets.map(function (s) { return s.name; }), rowCount: ws.rowCount,
    widths: widths, headHeight: ws.getRow(1).height, cells: cells };
}
async function runStep(st) {
  const o = { noScope: true };
  if (st.op === 'insert') { await supa.insert(st.table, st.rows, o); return { ok: true }; }
  if (st.op === 'update') { await supa.update(st.table, st.filter, st.patch, o); return { ok: true }; }
  if (st.op === 'remove') { await supa.remove(st.table, st.filter, o); return { ok: true }; }
  if (st.op === 'rows') {
    const q = { filter: st.filter, noScope: true, order: st.order };
    if (st.select) q.select = st.select;
    if (st.limit) q.limit = st.limit;
    return { rows: await supa.select(st.table, q) };
  }
  if (st.op === 'xlsx') return { xlsx: await xlsxDump(st.keys) };
  let r = await ref.call(st.fn, actors[st.ctx], st.args);
  if (r === undefined) r = null;
  if (st.only) r = r.filter(function (p) { return String(p.ten).indexOf(st.only) === 0; });
  if (st.sort) r = r.slice().sort(function (a, b) { const x = JSON.stringify(a), y = JSON.stringify(b); return x < y ? -1 : (x > y ? 1 : 0); });
  if (st.digest) {
    const cu = r.filter(function (p) { return !isZZ(p); });
    return { n: cu.length, items: cu.map(function (p) { return [p.ten, h12(p)]; }), zz: r.filter(function (p) { return String(p.ten).indexOf('ZZ_materials') === 0; }) };
  }
  return { result: r };
}
(async function () {
  const out = [];
  for (const raw of steps) {
    const st = fill(raw);
    let res;
    try { res = await tenant.run(ctxs[st.ctx || 'root'], function () { return runStep(st); }); }
    catch (e) { res = { error: e.message }; }
    const src = res.rows || res.result;
    Object.keys(raw.save || {}).forEach(function (n) { const v = at(src, raw.save[n]); if (v != null) saved[n] = String(v); });
    out.push(Object.assign({}, raw, { out: res === undefined ? null : res }));
  }
  process.stdout.write(JSON.stringify({ contexts: ctxs, actors: actors, saved: saved, steps: out }) + '\n');
  process.exit(0);
})().catch(function (e) { process.stderr.write(String(e && e.stack) + '\n'); process.exit(1); });
