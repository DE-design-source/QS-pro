'use strict';
/* Test ĐẦU-CUỐI cho server ĐANG CHẠY SẴN (Go hoặc Node tham chiếu): cùng kịch bản và phép kiểm với scripts/test-api.js,
   chỉ khác là KHÔNG tự bật server và KHÔNG đọc .env.
   Chạy:  BASE_URL=http://localhost:3998 TEST_DATABASE_URL=postgresql://.../qspro_gotest node backend/tests/e2e/test-api-go.js
          BASE_URL=http://localhost:3997 TEST_DATABASE_URL=postgresql://.../qspro_nodetest node backend/tests/e2e/test-api-go.js
   SERVER_LOG=<file log;file log> hoặc SERVER_LOG_CMD=<lệnh in log, vd "docker exec qspro-go cat /tmp/qsapi.log"> (tuỳ chọn)
   -> soi lỗi không mong đợi như bản gốc (chỉ in ra); thêm: log có panic thì tính là 1 lỗi. E2E_OUT=<file> -> ghi danh sách phép kiểm (so 2 server).
   E2E_DUMP=<file> -> ghi thân trả lời nguyên văn của mọi lần gọi.
   LƯU Ý: test ĐỂ LẠI dữ liệu trong database tạm — chỉ chạy trên bản sao dùng xong bỏ. Thoát mã 1 nếu có lỗi. */
const TEST_URL = process.env.TEST_DATABASE_URL || '';
if (!TEST_URL) { console.error('Thiếu TEST_DATABASE_URL (database tạm mà server đang dùng).'); process.exit(2); }
// Chốt an toàn: so host + cổng + tên database (không so chuỗi), và tên database tạm phải chứa 'test' / 'tmp' hoặc kết thúc bằng '_t'
function dbKey_(u) { try { const x = new URL(u); return x.hostname + ':' + (x.port || '5432') + x.pathname; } catch (e) { return u; } }
if (dbKey_(TEST_URL) === dbKey_(process.env.DATABASE_URL || '')) { console.error('TEST_DATABASE_URL trỏ cùng database với DATABASE_URL — từ chối chạy test trên database đang dùng.'); process.exit(2); }
if (!/(test|tmp|_t)$/i.test(dbKey_(TEST_URL)) && !/(test|tmp)/i.test(dbKey_(TEST_URL).split('/').pop())) { console.error("Tên database tạm phải chứa 'test' / 'tmp' hoặc kết thúc bằng '_t' (vd qspro_test) — từ chối: " + dbKey_(TEST_URL)); process.exit(2); }
// Chốt thêm của bản này: chỉ 2 bản sao dùng xong bỏ
if (!/^(qspro_gotest|qspro_nodetest)$/.test(dbKey_(TEST_URL).split('/').pop())) { console.error('Chỉ chạy trên qspro_gotest / qspro_nodetest — từ chối: ' + dbKey_(TEST_URL)); process.exit(2); }
const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const BASE = (process.env.BASE_URL || 'http://localhost:3998').replace(/\/+$/, '');
const raw = new Pool({ connectionString: TEST_URL });
const sql = async (t, p) => (await raw.query(t, p)).rows;
let pass = 0, fail = 0; const trace = [];
const dump = process.env.E2E_DUMP ? [] : null;
const ok = (c, m) => { trace.push((c ? 'PASS ' : 'FAIL ') + m); if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } };

(async () => {
  const cty = (await sql("select id from companies where code = 'dezon'"))[0].id;
  const other = (await sql("select id from companies where code <> 'dezon' order by created_at limit 1"))[0].id;
  await sql("update companies set is_active = true, expiry_date = null where id = any($1)", [[cty, other]]);   // database tạm: bỏ hạn dùng để đăng nhập được
  const hash = bcrypt.hashSync('Thu@12345', 10);
  await sql("delete from users where username in ('e2e_admin', 'e2e_other')");
  await sql("insert into users (username, full_name, password_hash, role, is_active, company_id) values ('e2e_admin', 'E2E', $1, 'admin', true, $2), ('e2e_other', 'E2E khác', $1, 'admin', true, $3)", [hash, cty, other]);

  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/healthz')).ok) { up = true; break; } } catch (e) { /* chưa lên */ } await new Promise((r) => setTimeout(r, 250)); }
    if (!up) throw new Error('Server chưa chạy ở ' + BASE);
    const mk = () => { let token = ''; const api = async (fn, ...args) => {
      const r = await fetch(BASE + '/api/' + fn, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: JSON.stringify({ args }) });
      const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch (e) { j = {}; }
      if (dump) dump.push(fn + '\t' + r.status + '\t' + txt);   // E2E_DUMP: thân trả lời nguyên văn, để so Go với Node
      return { status: r.status, result: j.result, error: j.error };
    }; api.login = async (u) => { const r = await api('login', u, 'Thu@12345'); token = (r.result || {}).token || ''; return r; }; return api; };
    const api = mk(), apiB = mk();
    const good = async (fn, ...args) => { const r = await api(fn, ...args); ok(r.status === 200, fn + ' -> ' + r.status + ' ' + (r.error || '')); return r.result; };

    console.log('1. Đăng nhập');
    ok((await api('getProducts')).status === 401, 'chưa đăng nhập phải 401');
    ok((await api('login', 'e2e_admin', 'sai')).status !== 200, 'sai mật khẩu bị từ chối');
    let r = await api.login('e2e_admin'); ok(r.status === 200 && r.result && r.result.token, 'login'); await apiB.login('e2e_other');
    await good('me');

    console.log('2. Các hàm đọc');
    const prods = await good('getProducts'); ok(Array.isArray(prods) && prods.length > 500, 'getProducts ' + (prods && prods.length));
    const coDL = prods.filter((p) => p.giaBanLe > 0 && p.donGiaVon > 0).length; ok(coDL > 100, 'sản phẩm có giá đại lý: ' + coDL);
    const projs = await good('getProjects'); ok(Array.isArray(projs) && projs.length > 5, 'getProjects');
    for (const fn of ['bootstrap', 'ctList', 'notifCount', 'adminListUsers', 'spMyPerms', 'listDeleteRequests', 'listPurchaseRequests', 'listDeXuat']) await good(fn);
    await good('notifList', 20); await good('getAuditLog', 50);

    console.log('3. Dự án: dòng bóc tách, tờ bìa, dữ liệu dự án, cấu hình công ty');
    const p = await good('createProject', { ten: 'E2E dự án thử', khachHang: 'KH thử' });
    const ma = p && p.maDA; ok(!!ma, 'createProject trả mã');
    const sp0 = prods.find((x) => x.ma && x.giaBanLe > 0);
    let ln = await good('addLine', ma, Object.assign({}, sp0, { donGiaVon: sp0.giaBanLe, chietKhau: sp0.ckDaiLy }), { soLuong: 3 });
    let lines = await good('getLines', ma); ok(lines && lines.length === 1 && lines[0].maSP === sp0.ma, 'dòng là bản chụp sản phẩm: ' + JSON.stringify(lines && lines[0]).slice(0, 120));
    const lid = lines[0].lineId;
    await good('updateLine', lid, { soLuong: 1.15, donGiaBan: 150 });
    lines = await good('getLines', ma); ok(lines[0].soLuong === 1.15 && lines[0].donGiaBan === 150 && lines[0].thanhTienBan === Math.round(1.15 * lines[0].donGia), 'sửa số lượng lẻ + giá: ' + JSON.stringify([lines[0].soLuong, lines[0].donGia, lines[0].thanhTienBan]));
    await good('setProjData', ma, 'ptVat', 8);
    await good('setProjData', ma, 'bgCfg', { ck: 5, tay: { '3.2': 1 } });
    await good('setProjData', '__cty', 'bgOrg', { ten: 'Công ty E2E', sdt: '0900' });
    await good('setProjData', '__cty', 'bgOrg', { ten: 'Công ty E2E (sửa)', sdt: '0900' });
    let pd = await good('getProjData', ma); ok(pd && pd.ptVat === 8 && pd.bgCfg.tay['3.2'] === 1 && pd.bgOrg.ten === 'Công ty E2E (sửa)', 'getProjData gộp dữ liệu dự án + công ty: ' + JSON.stringify(pd).slice(0, 160));
    ok((await sql("select count(*)::int n from company_settings where company_id = $1 and setting_key = 'bgOrg'", [cty]))[0].n === 1, 'bgOrg nằm ở company_settings');
    ok((await sql("select count(*)::int n from project_data_entries where project_code like '\_\_cty%'"))[0].n === 0, 'không còn mã giả __cty trong project_data_entries');
    const pB = (await apiB('createProject', { ten: 'E2E B' })).result; const pdB = (await apiB('getProjData', pB.maDA)).result;
    ok(pdB && pdB.bgOrg === undefined, 'công ty khác không thấy bgOrg của Dezon');
    const cover = await good('getCoverOrInit', ma); ok(Array.isArray(cover) && cover.length > 5, 'tờ bìa mẫu');
    await good('saveCover', ma, cover); await good('saveCover', ma, cover);
    ok((await sql('select count(*)::int n from cost_estimate_lines where project_code = $1', [ma]))[0].n === cover.length, 'lưu tờ bìa 2 lần không nhân đôi');
    await good('bootstrap', ma);
    const dup = await good('duplicateProject', ma, {}); const ma2 = dup && dup.maDA;
    ok(ma2 && (await sql('select count(*)::int n from quotation_lines where project_code = $1', [ma2]))[0].n === 1, 'nhân bản dự án chép dòng');

    console.log('4. Mua hàng + đề xuất (webhook Lark giả)');
    r = await api('sendPurchaseRequest', { maDA: ma, project: 'E2E dự án thử', hangMuc: 'Thiết bị đèn', nguoiGui: 'E2E', phongBan: 'QS', ghiChu: '',
      orders: [{ supplier: 'NCC A', total: 2160, vat: 160, vatPct: 8, items: [{ ma: 'A1', ten: 'SP A1', thuongHieu: 'X', khuVuc: 'P1, P2', dvt: 'Cái', sl: 2, donGia: 1000, hinhAnh: '' }] },
               { supplier: 'NCC B', total: 108, vat: 8, vatPct: 8, items: [{ ma: '', ten: 'SP B1', sl: 1.1, donGia: 90.91 }] }] });
    ok(r.status === 200 && r.result && r.result.saved.length === 2, 'gửi 2 đơn mua: ' + r.status + ' ' + (r.error || ''));
    const maDon = r.result && r.result.saved[0];
    let pos = await good('getPurchaseOrders', ma); ok(pos && pos.length === 2 && pos.every((o) => o.items.length === 1) && pos.every((o) => o.trangThai === 'Chờ duyệt'), 'đọc đơn theo dự án');
    const det = await good('getPurchaseOrder', maDon); ok(det && det.items.length === 1 && det.status === 'Chờ duyệt' && det.tongTruocVat === 2000, 'chi tiết đơn (admin)');
    await good('resolvePurchaseRequest', maDon, true);
    r = await api('resolvePurchaseRequest', maDon, true); ok(r.status !== 200 && /đã được xử lý/.test(r.error || ''), 'duyệt lần 2 bị chặn');
    r = await api('setPurchaseStatus', maDon, 'Đã nhận hàng'); ok(r.status !== 200, 'nhảy cóc trạng thái bị chặn');
    await good('setPurchaseStatus', maDon, 'Đã đặt hàng'); await good('setPurchaseStatus', maDon, 'Đã nhận hàng');
    ok((await apiB('getPurchaseOrder', maDon)).status !== 200, 'công ty khác không đọc được đơn');
    r = await api('sendDeXuat', { loai: 'ck', maDA: ma, project: 'E2E', supplier: 'NCC A', vatPct: 8, nguoiGui: 'E2E', items: [{ ma: 'A1', ten: 'SP A1', thuongHieu: 'X', khuVuc: 'P1', dvt: 'Cái', sl: 2, donGiaGoc: 1000, giamGiaPct: 10, donGia: 900, hinhAnh: 'h' }] });
    ok(r.status === 200 && /^CK-/.test(r.result.ma), 'gửi đề xuất chiết khấu'); const maCk = r.result && r.result.ma;
    r = await api('sendDeXuat', { loai: 'tt', maDA: ma, project: 'E2E', supplier: 'NCC A', vatPct: 8, tongDon: 2160, dots: [{ dot: 1, pct: 30, tien: 648, ngay: '2026-12-01', gc: 'cọc' }, { dot: 2, pct: 70, tien: 1512, ngay: null, gc: '' }] });
    ok(r.status === 200 && /^TT-/.test(r.result.ma), 'gửi đề xuất thanh toán'); const maTt = r.result && r.result.ma;
    const dxs = await good('getDeXuatList', ma);
    const ck = dxs.find((d) => d.ma === maCk), tt = dxs.find((d) => d.ma === maTt);
    ok(ck && ck.items.length === 1 && JSON.stringify(ck.items[0]) === JSON.stringify({ ma: 'A1', ten: 'SP A1', thuongHieu: 'X', phong: 'P1', dvt: 'Cái', sl: 2, donGiaGoc: 1000, pct: 10, donGia: 900, thanhTien: 1800, ngay: '', ghiChu: '', hinhAnh: 'h' }), 'dòng chiết khấu đúng hình dạng cũ: ' + JSON.stringify(ck && ck.items[0]));
    ok(tt && tt.items.length === 2 && JSON.stringify(tt.items[0]) === JSON.stringify({ ma: '', ten: 'Đợt 1', thuongHieu: '', phong: '', dvt: '', sl: 0, donGiaGoc: 0, pct: 30, donGia: 0, thanhTien: 648, ngay: '2026-12-01', ghiChu: 'cọc', hinhAnh: '' }), 'đợt thanh toán đúng hình dạng cũ: ' + JSON.stringify(tt && tt.items[0]));
    const one = await good('getDeXuat', maTt); ok(one && one.items.length === 2 && one.items[1].ten === 'Đợt 2', 'getDeXuat (admin)');
    await good('resolveDeXuat', maCk, true);

    console.log('5. Sản phẩm: 4 ngành, giá đại lý, lịch sử, duyệt, combo, xoá');
    const mkSp = async (data) => { await good('saveDbProduct', data); return (await sql('select * from product_catalog where product_code = $1 and company_id = $2', [data['MÃ SẢN PHẨM'], cty]))[0]; };
    const den = await mkSp({ 'TÊN SẢN PHẨM': 'E2E Đèn', 'MÃ SẢN PHẨM': 'E2E-DEN', 'HẠNG MỤC': 'Đèn nội thất', 'GIÁ BÁN LẺ': 100000, 'CHIẾT KHẤU ĐẠI LÝ (%)': 25, 'CÔNG SUẤT (W)': '12', 'CRI': '90', 'QUANG THÔNG (lm)': 900 });
    ok(den && Number(den.dealer_price) === 75000 && den.cri === '90' && Number(den.luminous_flux_lm) === 900, 'đèn: giá đại lý tự tính + thông số ở bảng đèn: ' + JSON.stringify(den && [den.dealer_price, den.cri, den.sector]));
    const oc = await mkSp({ 'TÊN SẢN PHẨM': 'E2E Ổ cắm', 'MÃ SẢN PHẨM': 'E2E-OC', 'HẠNG MỤC': 'Ổ cắm điện', 'GIÁ BÁN LẺ': 99000, 'MÀU SẮC': 'Trắng', 'SỐ Ổ CẮM (ổ)': '3' });
    ok(oc && oc.sector === 'ct' && oc.socket_count === '3' && Number(oc.dealer_price) === 99000, 'ổ cắm: ngành ct + thông số ở bảng công tắc: ' + JSON.stringify(oc && [oc.sector, oc.socket_count]));
    ok((await sql('select (select count(*) from product_switch_socket_specs where product_id = $1)::int a, (select count(*) from product_lighting_specs where product_id = $1)::int b', [oc.id]))[0].a === 1, 'dòng thông số nằm đúng bảng');
    const one2 = await good('getDbProduct', Number(den.id)); ok(one2 && one2.ma_sp === 'E2E-DEN' && one2.cri === '90' && one2.gia_dai_ly === 75000, 'getDbProduct trả dòng thô tên tiếng Việt đủ cột');
    r = await api('updateDbProductTracked', Number(den.id), { 'TÊN SẢN PHẨM': 'E2E Đèn (sửa)', 'MÃ SẢN PHẨM': 'E2E-DEN', 'HẠNG MỤC': 'Đèn nội thất', 'GIÁ BÁN LẺ': 200000, 'CHIẾT KHẤU ĐẠI LÝ (%)': 25, 'CRI': '95' });
    ok(r.status === 200, 'updateDbProductTracked ' + r.status + ' ' + (r.error || ''));
    const den2 = (await sql('select * from product_catalog where id = $1', [den.id]))[0];
    ok(Number(den2.dealer_price) === 150000 && den2.cri === '95' && den2.product_name === 'E2E Đèn (sửa)', 'sửa giá -> giá đại lý tính lại; sửa thông số: ' + JSON.stringify([den2.dealer_price, den2.cri]));
    const h = await good('getProductHistory', 'E2E-DEN'); ok(Array.isArray(h) && h.length >= 3, 'lịch sử sửa: ' + (h && h.length));
    r = await api('setSpDuyet', [Number(den.id)], true); ok(r.status === 200, 'duyệt SP ' + r.status + ' ' + (r.error || ''));
    r = await api('setCombo', Number(den.id), [{ id: Number(oc.id), soLuong: 2 }]); ok(r.status === 200, 'setCombo ' + r.status + ' ' + (r.error || ''));
    const cb = await good('getCombo', Number(den.id)); ok(Array.isArray(cb) && cb.length === 1 && cb[0].ma === 'E2E-OC' && cb[0].comboSL === 2, 'getCombo');
    r = await api('setYeuThich', [Number(den.id)], true); ok(r.status === 200, 'setYeuThich');
    const after = (await good('getProducts')).find((x) => x.recordId == den.id);
    ok(after && after.yeuThich && after.comboN >= 1 && after.daDuyet === true && after.donGiaVon === 150000 && after.raw && after.raw.cri === '95', 'getProducts phản ánh đủ: ' + JSON.stringify(after && [after.yeuThich, after.comboN, after.daDuyet, after.donGiaVon]));
    const chiaSe = (await sql('select has_dezon_catalog_access v from companies where id = $1', [other]))[0].v === true;
    const thay = (await apiB('getProducts')).result.find((x) => x.ma === 'E2E-DEN');
    ok(chiaSe ? (thay && thay.spChung === true) : !thay, 'công ty khác: ' + (chiaSe ? 'thấy SP Dezon ở dạng dùng chung (chỉ đọc)' : 'không thấy SP'));
    if (chiaSe) ok((await apiB('updateDbProductTracked', Number(den.id), { 'TÊN SẢN PHẨM': 'HACK' })).status !== 200, 'công ty khác không sửa được SP dùng chung');
    r = await api('deleteDbProduct', Number(den.id)); ok(r.status === 200, 'xoá SP'); await api('deleteDbProduct', Number(oc.id));
    ok((await sql('select (select count(*) from product_lighting_specs where product_id = $1) + (select count(*) from product_combos where product_id = $1) + (select count(*) from favorite_products where product_id = $1) as n', [den.id]))[0].n === '0', 'xoá SP dọn thông số, combo, yêu thích');

    console.log('6. Công tác, quản trị, dọn dẹp');
    r = await api('ctSave', [{ loai: 'kt_chitiet', mode: 'item', hangMuc: 'E2E mục', ten: 'E2E công tác', dvt: 'm2', kl: 1, dg: 1000 }]); ok(r.status === 200, 'ctSave ' + r.status + ' ' + (r.error || ''));
    const ct = (await sql("select id from work_items where name = 'E2E công tác' and company_id = $1", [cty]))[0];
    if (ct) { r = await api('ctUpdate', ct.id, { dg: 1200 }); ok(r.status === 200, 'ctUpdate ' + (r.error || '')); r = await api('ctDelete', ct.id); ok(r.status === 200, 'ctDelete ' + (r.error || '')); }
    r = await api('adminCreateUser', { username: 'E2E_ADMIN', password: 'Thu@12345', hoTen: 'trùng' }); ok(r.status !== 200, 'tạo user trùng username (khác hoa thường) bị chặn');
    r = await api('adminCreateUser', { username: 'e2e_staff', password: 'Thu@12345', hoTen: 'NV thử', perms: ['boc'] }); ok(r.status === 200, 'tạo user ' + (r.error || ''));
    const uid = r.result && r.result.id; if (uid) { r = await api('adminDeleteUser', uid); ok(r.status === 200, 'xoá user ' + (r.error || '')); }
    if (ma2) await good('deleteProject', ma2);
    await good('deleteProject', ma);
    ok((await sql('select (select count(*) from quotation_lines where project_code = $1) + (select count(*) from cost_estimate_lines where project_code = $1) + (select count(*) from project_data_entries where project_code = $1) + (select count(*) from projects where project_code = $1) as n', [ma]))[0].n === '0', 'xoá dự án dọn sạch');
    ok((await sql('select count(*)::int n from purchase_orders where project_code = $1', [ma]))[0].n === 2 && (await sql('select count(*)::int n from purchase_proposals where project_code = $1', [ma]))[0].n === 2, 'đơn mua và đề xuất CÒN sau khi xoá dự án (hành vi cũ)');
    await good('logout');
  } catch (e) { fail++; console.log("  ✗ FAIL (dừng giữa chừng): " + (e && e.stack || e)); }
  finally {
    // Log server: bản gốc tự hứng stdout của Node; ở đây đọc file do người chạy chỉ ra (Go: /tmp/qsapi.log chép ra ngoài)
    let log = null;
    try {
      if (process.env.SERVER_LOG) log = process.env.SERVER_LOG.split(';').map((f) => fs.readFileSync(f, 'utf8')).join('\n');
      else if (process.env.SERVER_LOG_CMD) log = require('child_process').execSync(process.env.SERVER_LOG_CMD, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e) { fail++; console.log('  ✗ FAIL: không đọc được log server: ' + e.message); }
    if (log !== null) {
      const errs = log.split('\n').filter((l) => /\[api\].*lỗi|Unhandled|Mất kết nối|TypeError|ReferenceError|panic|runtime error|goroutine \d+ \[/i.test(l) && !/Sai tài khoản|Đơn phải ở trạng thái|Không tìm thấy đơn|dùng chung|đã được xử lý|Chưa thể|không hợp lệ|đã tồn tại|Tên đăng nhập/i.test(l));
      console.log('--- lỗi không mong đợi trong log server (' + log.split('\n').filter(Boolean).length + ' dòng): ' + errs.length);
      // Như bản gốc: chỉ in ra, không tính lỗi (bản gốc trên Node vốn in 1 dòng "kho chung"). Riêng panic của Go thì tính lỗi.
      if (errs.some((l) => /panic|runtime error|goroutine \d+ \[/i.test(l))) { fail++; console.log('  ✗ FAIL: server có panic'); }
      errs.slice(0, 20).forEach((l) => console.log('   ' + l.slice(0, 260)));
    } else console.log('--- không soi log server (chưa đặt SERVER_LOG)');
    if (dump) fs.writeFileSync(process.env.E2E_DUMP, dump.join('\n') + '\n');
    if (process.env.E2E_OUT) fs.writeFileSync(process.env.E2E_OUT, trace.join('\n') + '\n');
    console.log('\nKẾT QUẢ test-api (' + BASE + '): ' + pass + ' đạt, ' + fail + ' lỗi');
    await raw.end(); process.exit(fail ? 1 : 0);
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
