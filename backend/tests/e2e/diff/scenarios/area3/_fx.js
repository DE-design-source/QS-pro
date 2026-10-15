'use strict';
/* Dữ liệu dùng chung của vùng 3 (materials, purchasing, reports, files, categories). Dựng MỘT lần cho cả lần chạy,
   không dựa vào tài khoản của vùng 1 / 2. Chỉ super mồi chèn bằng SQL.
   Công ty A: nơi làm việc chính (không dùng kho chung). Công ty B: công ty khác. Công ty C: được bật kho SP chung của Dezon. */
const path = require('path');
const bcrypt = require('bcryptjs');
const PW = { root: 'Root@3456', admin: 'Admin@345', staff: 'Staff@345' };
const ROOT_ID = '00000000-0000-4000-8000-0000000000c1';
const PUB = path.join(__dirname, '..', '..', '..', '..', '..', 'internal', 'shared', 'specs', 'js'); // spec ngành nhúng trong binary (public/ đã bỏ)
const SPEC = { vs: require(path.join(PUB, 'vs-spec.js')), son: require(path.join(PUB, 'son-spec.js')), ct: require(path.join(PUB, 'ct-spec.js')) };

async function fx(h) {
  if (h.state.area3) return h.state.area3;
  const dezon = (await h.sql("select id::text id from companies where code = 'dezon'")).node[0].id;
  await h.sql("insert into users (id, username, full_name, password_hash, role, is_active, company_id, created_at) values ($1, 'dz_root', 'DZ Root', $2, 'super', true, null, now())", [ROOT_ID, bcrypt.hashSync(PW.root, 10)]);
  const f = { PW, dezon, S: {}, SPEC };
  const S = f.S;
  S.anon = h.anon;
  S.root = await h.login('super', 'dz_root', PW.root);
  let r = await h.rpc(S.root, 'createCongTy', [{ ten: 'DZ Công ty A', ma: 'dz-a', gioiHanUser: 12, adminUser: 'dz_a_admin', adminPass: PW.admin, adminHoTen: 'Chủ A3' }]);
  f.ctA = r.val('result.id');
  r = await h.rpc(S.root, 'createCongTy', [{ ten: 'DZ Công ty B', ma: 'dz-b', gioiHanUser: 5, adminUser: 'dz_b_admin', adminPass: PW.admin }]);
  f.ctB = r.val('result.id');
  r = await h.rpc(S.root, 'createCongTy', [{ ten: 'DZ Công ty C (kho chung)', ma: 'dz-c', gioiHanUser: 5, dungSpDezon: true, adminUser: 'dz_c_admin', adminPass: PW.admin, adminHoTen: 'Chủ C3' }]);
  f.ctC = r.val('result.id');
  const mk = async (ct, u, hoTen, extra) => (await h.rpc(S.root, 'createCongTyUser', [ct, Object.assign({ username: u, password: PW.staff, hoTen }, extra || {})])).val('result.id');
  await mk(f.ctA, 'dz_a_edit', 'NV sửa', { perms: ['boc', 'sanpham', 'sp_edit'], phongBan: 'Phòng QS' });   // sửa được, KHÔNG duyệt được
  await mk(f.ctA, 'dz_a_duyet', 'NV duyệt', { perms: ['sp_duyet'], phongBan: 'Phòng mua hàng' });            // sửa + duyệt
  await mk(f.ctA, 'dz_a_boc', '', { perms: ['boc', 'muahang'] });                                              // không cấu hình sp_* -> sửa + duyệt; không họ tên
  await mk(f.ctA, 'dz_a_none', 'NV không quyền');                                                              // không perms -> sửa + duyệt (mặc định)
  await mk(f.ctC, 'dz_c_edit', 'NV C sửa', { perms: ['sp_edit'] });
  S.adminA = await h.login('admin A', 'dz_a_admin', PW.admin);
  S.adminB = await h.login('admin B', 'dz_b_admin', PW.admin);
  S.adminC = await h.login('admin C (kho chung)', 'dz_c_admin', PW.admin);
  S.edit = await h.login('staff A sp_edit', 'dz_a_edit', PW.staff);
  S.duyet = await h.login('staff A sp_duyet', 'dz_a_duyet', PW.staff);
  S.boc = await h.login('staff A boc', 'dz_a_boc', PW.staff);
  S.none = await h.login('staff A không perms', 'dz_a_none', PW.staff);
  S.editC = await h.login('staff C sp_edit', 'dz_c_edit', PW.staff);
  S.viewA = h.with(S.root, { label: 'super xem công ty A', view: f.ctA });
  S.viewB = h.with(S.root, { label: 'super xem công ty B', view: f.ctB });
  S.viewC = h.with(S.root, { label: 'super xem công ty C', view: f.ctC });
  S.viewDz = h.with(S.root, { label: 'super xem Dezon', view: dezon });
  S.adminView = h.with(S.adminA, { label: 'admin A gửi x-view-company B (bị bỏ qua)', view: f.ctB });
  // ma trận quyền: chưa đăng nhập, staff không / có quyền, admin, admin công ty khác, super không / có x-view-company
  f.all = [S.anon, S.none, S.edit, S.duyet, S.adminA, S.adminB, S.root, S.viewA];
  f.matrix = async (fn, args, opts) => { for (const s of f.all) await h.both(s, fn, args, opts && opts.label ? Object.assign({}, opts, { label: opts.label + ' @' + s.label }) : opts); };
  // chỉ rpc (hàm có ghi dữ liệu: gọi 1 lần mỗi phiên)
  f.matrixRpc = async (fn, args, opts) => { for (const s of f.all) await h.rpc(s, fn, typeof args === 'function' ? args(s) : args, opts && opts.label ? Object.assign({}, opts, { label: opts.label + ' @' + s.label }) : opts); };
  f.show = (v) => (v === undefined ? '(thiếu)' : typeof v === 'number' ? String(v) : (JSON.stringify(v) || String(v)).slice(0, 70));
  f.badJson = require('../../lib/accept').badJson;   // ARCH 10.1: trang 400 của thân JSON hỏng (luật và lý do: lib/accept.js)

  // ARCH 10.2: tên trùng thuộc tính của Object.prototype (constructor, toString, __proto__...) - Node rò prototype, Go coi là giá trị lạ.
  // Chỉ che phần thân (câu lỗi); mã HTTP và header phải giống.
  f.protoLeak = { reason: 'ARCH 10: rò prototype của Node (tên trùng thuộc tính Object.prototype), Go coi là giá trị lạ bình thường', only: /^body/, test: (n, g) => n.status === 500 && g.status === 500 && /native code|\[object Object\]/.test(n.text) && !/native code|\[object Object\]/.test(g.text) };
  // ARCH 10.3: file .xlsx là zip hợp lệ nhưng XML bên trong hỏng - Go từ chối với câu lỗi riêng (Node: câu lỗi của saxes). Cả 2 phía phải lỗi 500.
  f.xlsxHong = { reason: 'ARCH 10.3: XML trong file .xlsx hỏng -> Go báo lỗi bằng câu riêng (không phải của saxes)', only: /^body/, test: (n, g) => n.status === 500 && g.status === 500 && !!n.json && typeof n.json.error === 'string' && !!g.json && typeof g.json.error === 'string' };

  /* Dữ liệu sản phẩm mẫu theo ngành. Giá trị thông số lấy từ chính spec (lựa chọn đầu tiên, hoặc chuỗi theo nhãn). */
  f.specData = (ng, hm, i, over) => {
    const SP = SPEC[ng]; const d = { 'NGÀNH HÀNG': ng, 'HẠNG MỤC': hm };
    SP.labelsOf(hm).forEach((lb, k) => { const o = SP.optsOf ? SP.optsOf(hm, lb) : null; d[lb] = Array.isArray(o) && o.length ? o[(i + k) % o.length] : 'gt ' + (k + 1) + ' ' + lb.toLowerCase().slice(0, 12); });
    return Object.assign(d, { 'TÊN SẢN PHẨM': 'DZ ' + ng + ' ' + hm + ' #' + i, 'MÃ SẢN PHẨM': 'DZ-' + ng.toUpperCase() + '-' + i, 'THƯƠNG HIỆU': 'Hãng ' + ng, 'NHÀ CUNG CẤP': 'NCC ' + ng + ' ' + (i % 3), 'GIÁ BÁN LẺ': 1000000 + i * 12500, 'CHIẾT KHẤU ĐẠI LÝ (%)': 10 + (i % 4) * 2.5, 'BẢO HÀNH (năm)': 1 + (i % 5), 'ĐƠN VỊ TÍNH': ng === 'son' ? 'Thùng' : 'Bộ' }, over || {});
  };
  f.denData = (i, over) => Object.assign({ 'TÊN SẢN PHẨM': 'DZ Đèn âm trần #' + i, 'MÃ SẢN PHẨM': 'DZ-DEN-' + i, 'DÒNG SẢN PHẨM': 'Downlight', 'HẠNG MỤC': 'Đèn âm trần', 'NHÓM SẢN PHẨM': 'Nhóm đèn ' + (i % 2), 'THƯƠNG HIỆU': 'Dezon', 'NHÀ CUNG CẤP': 'NCC đèn ' + (i % 3),
    'CÔNG SUẤT (W)': String(7 + i), 'NHIỆT ĐỘ MÀU (K)': '3000, 4000', 'QUANG THÔNG (lm)': 600 + i * 10, 'GÓC CHIẾU (°)': '24', 'GÓC NGHIÊNG (°)': '30', 'MÀU SẮC': 'Trắng', 'CHẤT LIỆU': 'Nhôm đúc', 'CHIỀU CAO (mm)': 55.5, 'ĐƯỜNG KÍNH (mm)': 90, 'LỖ KHOÉT TRẦN (mm)': '75',
    'CHỈ SỐ IP': 'IP44', 'CRI': '>90', 'HIỆU SUẤT PHÁT QUANG (lm/W)': 85.5, 'UGR': '<19', 'SDCM': '<3', 'COI': '77', 'TUỔI THỌ': '50.000h', 'TÊN CHIP LED': 'Bridgelux', 'LOẠI CHIP LED': 'COB', 'CẤP BẢO VỆ ĐIỆN': 'Class II', 'LẮP NGUỒN RỜI': 'Có',
    'TÊN BỘ NGUỒN': 'Driver 12W', 'MÃ BỘ NGUỒN': 'DR-12', 'HÃNG BỘ NGUỒN': 'Philips', 'GIÁ BÁN BỘ NGUỒN': '150.000', 'VỊ TRÍ LẮP NGUỒN': 'Rời', 'TƯƠNG THÍCH ĐIỀU KHIỂN': 'DALI', 'DÒNG RA TỐI ĐA (mA)': 350, 'BẢO HÀNH (năm)': 3, 'ĐƠN VỊ TÍNH': 'Bộ',
    'GIÁ BÁN LẺ': '1.250.000', 'CHIẾT KHẤU ĐẠI LÝ (%)': '12,5', 'ẢNH SẢN PHẨM': 'https://img.test/a' + i + '.jpg\nhttps://img.test/b' + i + '.jpg', 'LINK DATASHEET': 'https://ds.test/' + i + '.pdf', 'TRẠNG THÁI': 'Đang kinh doanh', 'GHI CHÚ': 'Ghi chú đèn ' + i,
    'THÔNG SỐ KỸ THUẬT': 'https://f.test/ts' + i + '.pdf', 'HƯỚNG DẪN CÀI ĐẶT': 'https://f.test/hd' + i + '.pdf', 'FILE BẢN VẼ': 'https://f.test/bv' + i + '.dwg' }, over || {});
  // id (recordId) của sản phẩm vừa tạo: 2 database cùng seed + cùng thứ tự chèn nên trùng nhau; vẫn lấy theo từng phía cho chắc
  f.idOf = (r) => r.val('result.id');
  h.state.area3 = f;
  return f;
}
module.exports = { fx, PW, SPEC, PUB };
