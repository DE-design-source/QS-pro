'use strict';
/* Sinh unit.json: giá trị mong đợi của test đơn vị, lấy bằng cách CHẠY mã Node thật (không chạm database, không tải file thật).
 *   pure   - hàm thuần: prodToObj, dataToRow_, fmt*, các bộ nhận biết lỗi, parseItems_
 *   upload - uploadImage / uploadFile / uploadFileBuf với supa.uploadToStorage giả
 *   flows  - từng hàm của module chạy trên tầng supa GIẢ: ghi lại TỪNG lệnh supa.* (bảng, bộ lọc, dòng ghi) cùng
 *            kết quả trả về; test Go (TestFlowsReplay) phát lại đúng chuỗi lệnh đó và so kết quả cuối.
 *
 *   DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
 *   PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen_unit.js > unit.json
 */
const ref = require('./noderef');
const supa = ref.supa, store = ref.store, auth = ref.auth, M = ref.store.__m;
const VS = require(ref.root + '/backend/internal/shared/specs/js/vs-spec.js'), SON = require(ref.root + '/backend/internal/shared/specs/js/son-spec.js'), CT = require(ref.root + '/backend/internal/shared/specs/js/ct-spec.js');

console.warn = function () {};
console.error = function () {};
function rt(v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
function ts(v) { return JSON.parse(JSON.stringify(v === undefined ? null : v).replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, '<ts>')); }

/* ───────────── pure ───────────── */
const rows = [
  {}, { id: 1 },
  { id: 2, ma_sp: 'DL-01', ten_sp: 'Đèn âm trần', dong_sp: 'Downlight', hang_muc: 'Đèn âm trần', nhom_sp: '', thuong_hieu: 'Dezon', nha_cung_cap: 'NCC A',
    cong_suat_w: '12', nhiet_do_mau_k: '3000, 4000K ,5700k', quang_thong_lm: 1200, goc_chieu_deg: '24°/38', goc_nghieng_deg: '30, 45°', mau_sac: 'Trắng',
    chat_lieu: 'Nhôm', chieu_cao_mm: 85, duong_kinh_mm: 90, cutout_mm: '75', chi_so_ip: 'IP44', cri: '90', hieu_suat_lm_w: 100, ugr: '<19', sdcm: '3', coi: 'x',
    tuoi_tho: '50000h', ten_chip_led: 'Bridgelux', loai_chip_led: 'COB', class_rating: 'II', lap_nguon_roi: true, ten_bo_nguon: 'Driver', ma_bo_nguon: 'D1',
    hang_bo_nguon: 'Philips', gia_ban_bo_nguon: 150000, vi_tri_lap_nguon: 'Ngoài', dieu_khien: 'DALI', dong_ra_max_ma: 350, bao_hanh_nam: 2, dvt: 'Bộ',
    gia_ban_le: 1250000, ck_dai_ly_pct: 30, gia_dai_ly: 875000, anh_sp: '\n  http://a/1.jpg \nhttp://a/2.jpg', link_datasheet: 'http://d', trang_thai: 'Đang kinh doanh',
    ghi_chu: 'Ghi chú', ngay_cap_nhat: '2026-01-02T03:04:05.123456+00:00', da_duyet: true, nguoi_duyet: 'sếp', ngay_duyet: '2026-01-03T00:00:00+00:00',
    nguoi_tao: 'a', ngay_tao: '2026-01-01T00:00:00+00:00', nguoi_sua: 'b', nhom_bt: 'BT-2', thong_so_file: 'f1', huong_dan_lap_dat: 'f2', file_ban_ve: 'f3', cong_ty_id: 'C1' },
  { id: 3, ten_sp: 'Chỉ CRI', cri: 95, ghi_chu: 'gc', cong_suat_w: '2×5w', cutout_mm: 'Ø40×78', duong_kinh_mm: 0, chieu_cao_mm: 120, quang_thong_lm: 0, lap_nguon_roi: false, da_duyet: 'true' },
  { id: 4, ten_sp: 'Lỗ khoét', cutout_mm: ' 60x60MM ', duong_kinh_mm: '90', chieu_cao_mm: '', cong_suat_w: 7.5, nhiet_do_mau_k: 3000, bao_hanh_nam: 0, gia_ban_le: '1.250.000', ck_dai_ly_pct: '12,5', gia_dai_ly: null },
  { id: 5, ten_sp: 'Chip không tên', loai_chip_led: 'SMD', cri: '80', cutout_mm: '75,5', dvt: '', nhom_sp: 'Nhóm riêng', dong_sp: 'Dòng', nganh: 'den', hang_muc: 'Bồn cầu' },
  { id: 6, ten_sp: 'Đoán ngành', hang_muc: '  lavabo ', mau_sac: 'Trắng', kich_thuoc: 'L500', ghi_chu: 'gc vs', bao_hanh_nam: 5, dong_sp: 'Dòng L' },
  { id: 7, ten_sp: 'VS hạng mục lạ', nganh: 'vs', hang_muc: 'Không có', mau_sac: 'Đen', kich_thuoc: 'K', luu_y: 'LY' },
  { id: 8, ten_sp: 'Sơn', hang_muc: 'sơn nội thất', mau_sac: '  Trắng sứ ', kich_thuoc: '18L', tinh_nang: '• Che phủ tốt\r\n- Dễ lau chùi\n\n * \n  Mùi nhẹ  \n\u00a0\u2022 x', dong_sp: '' },
  { id: 9, ten_sp: 'Sơn lạ', nganh: 'son', hang_muc: 'Sơn gì đó', dong_sp: 'Dòng sơn', tinh_nang: 'một dòng' },
  { id: 10, ten_sp: 'CT lạ', nganh: 'ct', hang_muc: 'lạ', mau_sac: 'Trắng', bao_hanh_nam: 3, rong_mm: '86' },
  { id: 11, ten_sp: 'Ngành lạ', nganh: ' khac ', hang_muc: 'Bồn cầu' }
];
// mọi hạng mục của 3 ngành, điền đủ mọi cột thông số
[['vs', VS], ['son', SON], ['ct', CT]].forEach(function (p, k) {
  p[1].HANG_MUC.forEach(function (hm, i) {
    const r = { id: 1000 + k * 100 + i, ma_sp: p[0] + i, ten_sp: 'SP ' + hm, hang_muc: hm, dong_sp: i % 2 ? 'Dòng ' + i : '', bao_hanh_nam: i % 3, ghi_chu: i % 2 ? '' : 'ghi chú ' + i,
      rong_mm: i % 2 ? '86' : '', cao_mm: '86', sau_mm: i % 3 ? '' : '35' };
    Object.keys(p[1].METRIC).forEach(function (lb, j) { r[p[1].METRIC[lb][0]] = (j + i) % 4 === 0 ? '' : 'v' + j + ' ' + lb.toLowerCase(); });
    if (i % 2) r.nganh = p[0];
    rows.push(r);
  });
});
const datas = [
  {}, { 'TÊN SẢN PHẨM': 'A', 'MÃ SẢN PHẨM': null, 'KHÔNG CÓ': 1, 'LẮP NGUỒN RỜI': 'Có', 'GIÁ BÁN LẺ': '1.250.000', 'CHIẾT KHẤU ĐẠI LÝ (%)': '', 'BẢO HÀNH (năm)': null,
    'CÔNG SUẤT (W)': 12, 'QUANG THÔNG (lm)': '1,5', 'CHIỀU CAO (mm)': 0, 'GHI CHÚ': true, 'MÀU SẮC': ['a', 'b'], 'CRI': { a: 1 }, 'KÍCH THƯỚC': 1e21 },
  { 'LẮP NGUỒN RỜI': null, 'ĐƯỜNG KÍNH (mm)': 'abc', 'DÒNG RA TỐI ĐA (mA)': '30%', 'HIỆU SUẤT PHÁT QUANG (lm/W)': true, 'GIÁ BÁN BỘ NGUỒN': '12.5' }
];
const laCo = ['có', 'Có', 'CÓ', 'cÓ', 'co', 'yes', 'YES', 'Yes ', 'true', 'TRUE', true, false, 1, '1', 'x', 'X', 'xx', '', null, 'yeſ', 'có\n', 'không', 0, '10', ['x'], ' x'];
const msgs = [
  '', 'DB PATCH db_san_pham -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the \'nguoi_sua\' column of \'db_san_pham\' in the schema cache"}',
  'DB POST db_san_pham -> 400 {"code":"42703","message":"column \\"ngay_tao\\" of relation \\"products\\" does not exist"}',
  'nguoi_tao bị lỗi', 'COLUMN nguoi_tao', 'pgrst204 nguoi_sua', 'DB GET sp_combo -> 404 {"code":"42P01","message":"relation \\"sp_combo\\" does not exist"}',
  'sp_combo: Schema Cache', 'sp_combo lỗi mạng', 'DB POST sp_yeu_thich -> 403 {"code":"42501","message":"new row violates row-level security policy"}',
  'DB POST sp_yeu_thich -> 409 {"code":"23505","message":"duplicate key value violates unique constraint"}', 'sp_yeu_thich PGRST205', 'sp_yeu_thich 404',
  'DB PATCH db_san_pham -> 400 {"code":"42703","message":"column \\"nhom_bt\\" does not exist"}', 'db_san_pham ROW-LEVEL SECURITY', 'bảng khác 42501',
  'DB PATCH db_san_pham -> 400 {"message":"column \\"kich_thuoc\\" does not exist"}'
];
const items = [null, '', '[]', '[{"maSP":"A","id":"1","ten":"x"}]', '{"a":1}', 'null', '0', '"abc"', 'hỏng', 'false', '[1,null]', 12, '  [ ] '];
function errText(e) { return e && e.message; }
const pure = {
  prodToObj: rows.map(function (r) { return [r, rt(M.prodToObj(rt(r)))]; }),
  dataToRow: datas.map(function (d) { return [d, rt(store.dataToRow_(rt(d)))]; }),
  laCo: laCo.map(function (v) { return [v, store.dataToRow_({ 'LẮP NGUỒN RỜI': v }).lap_nguon_roi]; }),
  fmtUnit: [[null, 'W'], ['', 'W'], ['12', 'W'], ['12w', 'W'], ['12 W', 'W'], [12, 'W'], [0, 'mm'], ['5MM', 'mm'], ['5m', 'mm'], ['w', 'W'], ['12K', 'K'], ['12\u212a', 'K'], [false, 'W']]
    .map(function (c) { return [c[0], c[1], M.fmtUnit(c[0], c[1])]; }),
  fmtList: [[null, 'K'], ['3000,4000', 'K'], [' 3000k , ,4000K,', 'K'], [3000, 'K'], ['24, 38°', '°'], ['a,b', 'mm']].map(function (c) { return [c[0], c[1], M.fmtList(c[0], c[1])]; }),
  fmtCutout: [null, '', ' ', '75', '75.5', '75,5', 'Ø75', '60x60', '60×60mm', '60*60 MM', 75, ' 7 5 ', '٧٥'].map(function (v) { return [v, M.fmtCutout_(v)]; }),
  firstImg: [null, '', 'a', ' \n \n b \nc', 'a\r\nb', 12].map(function (v) { return [v, M.firstImg(v)]; }),
  errs: msgs.map(function (m) {
    const e = new Error(m);
    return [m, M.whoColMissing_(e), M.comboMissing_(e), M.btMissing_(e), errText(M.tblErr_(e, 'sp_yeu_thich')), errText(M.tblErr_(e, 'sp_combo')), errText(M.tblErr_(e, 'db_san_pham'))];
  }),
  parseItems: items.map(function (v) { return [v, rt(auth.__m.parseItems_(v))]; })
};

/* ───────────── upload ───────────── */
let upRec = null, upFail = null;
supa.uploadToStorage = async function (buf, path, ct) {
  upRec = { len: buf.length, path: path, ct: ct === undefined ? null : ct };
  if (upFail) throw new Error(upFail);
  return 'URL:' + path;
};
function upNorm(v) {
  return JSON.parse(JSON.stringify(v).replace(/(sp|docs)\/\d+-/g, '$1/<ms>-').replace(/sp\/<ms>-\d+\./g, 'sp/<ms>-<rnd>.'));
}
const MB = 1024 * 1024;
const upCases = [
  ['uploadImage', ['data:image/png;base64,iVBORw0KGgo=', 'a.png']], ['uploadImage', ['data:image/jpeg;base64,/9j/4A==']], ['uploadImage', ['aGVsbG8=']],
  ['uploadImage', ['']], ['uploadImage', [null]], ['uploadImage', []], ['uploadImage', ['data:image/svg+xml;base64,PHN2Zz4=']], ['uploadImage', ['data:;base64,AAAA']],
  ['uploadImage', ['data:application/jpegjpeg;base64,AAAA']], ['uploadImage', [12345678]], ['uploadImage', ['!!aGVs bG8\n=tail']], ['uploadImage', ['data:image;base64,AAAA']],
  ['uploadImage', ['data:image/;base64,AAAA']], ['uploadImage', ['data:a/b/c;base64,_-8=']], ['uploadImage', ['data:image/png;base64,====']],
  ['uploadImage', ['aGVsbG8=', 'x'], 'Storage upload -> 500 lỗi'],
  ['uploadFile', ['data:application/pdf;base64,JVBERi0=', 'Bản vẽ số 1.PDF']], ['uploadFile', ['JVBERi0=', 'a.pdf']], ['uploadFile', ['data:;base64,JVBERi0=', 'x.dwg']],
  ['uploadFile', ['', 'a.pdf']], ['uploadFile', [null, 'a.pdf']], ['uploadFile', ['JVBERi0=']], ['uploadFile', ['JVBERi0=', null]], ['uploadFile', ['JVBERi0=', 12.5]],
  ['$uploadFileBuf', [10, 'C:\\tmp\\Hồ sơ Đỗ đạc.final.docx', null]], ['$uploadFileBuf', [10, 'noext', 'x/y']], ['$uploadFileBuf', [10, '', null]],
  ['$uploadFileBuf', [10, 'a.exe', null]], ['$uploadFileBuf', [10, '.pdf', null]], ['$uploadFileBuf', [10, '---.pdf', '']], ['$uploadFileBuf', [10, 'x'.repeat(100) + '.zip', null]],
  ['$uploadFileBuf', [0, 'a.pdf', null]], ['$uploadFileBuf', [null, 'a.pdf', null]], ['$uploadFileBuf', [50 * MB + 1, 'a.pdf', null]], ['$uploadFileBuf', [50 * MB, 'a.pdf', null]],
  ['$uploadFileBuf', [3, 'a.JPG', 'image/jpeg']], ['$uploadFileBuf', [3, 'thư mục/đường dẫn/tệp ĐẶC BIỆT (1).Xlsx', null]], ['$uploadFileBuf', [3, 'a.b.c.7z', null]],
  ['$uploadFileBuf', [5, 'KELVIN.S\u212aP', null]], ['$uploadFileBuf', [5, 'a/b\\', null]], ['$uploadFileBuf', [5, 'tên.', null]], ['$uploadFileBuf', [5, 'a.pdf ', null]],
  ['$uploadFileBuf', [5, 'đĐ_-ok.RAR', null]], ['$uploadFileBuf', [5, '-' + 'ab-'.repeat(30) + '.gif', null]], ['$uploadFileBuf', [1572864, 'a.dxf', null], 'Storage upload -> 413 {"error":"Payload too large"}'],
  ['$uploadFileBuf', [10, 'a.pdf', null], 'Storage upload -> 400 The object exceeded the maximum allowed size'], ['$uploadFileBuf', [10, 'a.pdf', null], 'fetch failed'],
  ['$uploadFileBuf', [10, 'a.pdf', null], 'lỗi 4130'], ['$uploadFileBuf', [10, 'a.pdf', null], 'TOO LARGE']
];

/* ───────────── flows ───────────── */
const C1 = 'c1c1c1c1-0000-4000-8000-000000000001', C2 = 'c2c2c2c2-0000-4000-8000-000000000002';
const ctxs = { c1: { uid: 'U1', role: 'admin', congTyId: C1, viewAs: null }, sup: { uid: 'U0', role: 'super', congTyId: null, viewAs: null },
  view: { uid: 'U0', role: 'super', congTyId: null, viewAs: C1 }, none: null };
const actors = { adm: { uid: 'U1', u: 'adm', r: 'admin', ct: C1 }, nv: { uid: 'U2', u: 'nv', r: 'staff', ct: C1 }, sup: { uid: 'U0', u: 'root', r: 'super', ct: null }, none: null };
let script = [], log = [], seq = 0;
function fake(m, table, a, dflt) {
  const rec = { m: m, table: table, a: ts(a) };
  log.push(rec);
  const key = JSON.stringify(a);
  let rule = null;
  for (let i = 0; i < script.length; i++) {
    const r = script[i];
    if (r.m !== m || r.table !== table || (r.has && key.indexOf(r.has) < 0) || (r.once && r.used)) continue;
    rule = r; r.used = true; break;
  }
  if (rule && rule.err) { rec.err = rule.err; throw new Error(rule.err); }
  rec.ret = rt(rule ? rule.ret : dflt());
  return rt(rec.ret);
}
function nul(v) { return v === undefined || v === '' || v === 0 ? null : v; }
function fakeOn() {
  supa.select = async function (table, o) {
    o = o || {};
    return fake('select', table, { select: nul(o.select), filter: nul(o.filter), order: nul(o.order), limit: nul(o.limit), noScope: !!o.noScope }, function () { return []; });
  };
  supa.insert = async function (table, rows, o) {
    return fake('insert', table, { rows: rows, noScope: !!(o && o.noScope) }, function () {
      return (Array.isArray(rows) ? rows : [rows]).map(function (r) { return Object.assign({ id: 9000 + (++seq) }, r); });
    });
  };
  supa.update = async function (table, filter, patch, o) {
    return fake('update', table, { filter: filter, patch: patch, noScope: !!(o && o.noScope) }, function () { return []; });
  };
  supa.remove = async function (table, filter, o) {
    return fake('remove', table, { filter: filter, noScope: !!(o && o.noScope) }, function () { return []; });
  };
}
// các kết quả giả dùng lại
const sel = function (table, has, ret, once) { return { m: 'select', table: table, has: has, ret: ret, once: !!once }; };
const err = function (m, table, msg, has, once) { return { m: m, table: table, err: msg, has: has, once: !!once }; };
const P = function (id, o) { return Object.assign({ id: id, ma_sp: 'M' + id, ten_sp: 'SP ' + id, cong_ty_id: C1, da_duyet: false, nhom_bt: null }, o || {}); };
const uNV = function (perms) { return sel('users', 'id=eq.U2', [{ id: 'U2', username: 'nv', ho_ten: 'Nhân Viên', perms: perms, active: true }]); };
const WHO = 'DB PATCH db_san_pham -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the \'nguoi_sua\' column of \'db_san_pham\' in the schema cache"}';
const WHO2 = 'DB POST db_san_pham -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the \'nguoi_tao\' column of \'db_san_pham\' in the schema cache"}';
const COL = 'DB PATCH db_san_pham -> 400 {"code":"42703","details":null,"hint":null,"message":"column \\"nhom_bt\\" of relation \\"products\\" does not exist"}';
const NOTBL = function (t) { return 'DB GET ' + t + ' -> 404 {"code":"42P01","details":null,"hint":null,"message":"relation \\"public.' + t + '\\" does not exist"}'; };
const full = { 'TÊN SẢN PHẨM': '  Bồn cầu A  ', 'MÃ SẢN PHẨM': ' BC-01 ', 'HẠNG MỤC': 'bồn cầu', 'KÍCH THƯỚC': 'L700', 'MÀU SẮC': 'Trắng "bóng" \\ x', 'CÔNG SUẤT (W)': 12,
  'GIÁ BÁN LẺ': '12.500.000', 'CHIẾT KHẤU ĐẠI LÝ (%)': '30%', 'LẮP NGUỒN RỜI': 'YES', 'BẢO HÀNH (năm)': '', 'GHI CHÚ': null, 'CỘT LẠ': 'x', 'NHIỆT ĐỘ MÀU (K)': '3000, 4000',
  'ẢNH SẢN PHẨM': 'http://a', 'QUANG THÔNG (lm)': 'abc', 'GÓC CHIẾU (°)': 0, 'CRI': false };
const spRows = [P(1, { ten_sp: 'Ă', nhom_sp: 'N1', cong_suat_w: '5' }), P(2, { ten_sp: 'B', dong_sp: 'D2' }), P(3, { ten_sp: 'A', nhom_sp: 'N1' })];
const dzRows = [P(50, { ten_sp: 'Ắ kho chung', cong_ty_id: C2 }), P(51, { ma_sp: 'M1', ten_sp: 'Trùng khoá', cong_suat_w: '5', cong_ty_id: C2 }), P(52, { ten_sp: 'a kho chung', cong_ty_id: C2, nhom_sp: 'N9' })];
const dzOn = [sel('cong_ty', 'id=eq.', [{ id: C1, dung_sp_dezon: true }]), sel('cong_ty', 'ma=eq.dezon', [{ id: C2, ma: 'dezon' }])];
const vsRaw = { 'TÊN SẢN PHẨM': 'Bồn cầu nhập', 'MÃ SẢN PHẨM': 'BC-IMP', 'HẠNG MỤC': 'bồn cầu', 'MÀU SẮC': 'Trắng', 'KIỂU LẮP ĐẶT': 'Một khối', 'KÍCH THƯỚC': 'L700', 'LƯỢNG NƯỚC XẢ': '4.8L',
  'CÔNG SUẤT (W)': '12', 'GIÁ ĐẠI LÝ': 5, 'ĐỘ PHỦ': 'x', 'ẢNH SẢN PHẨM': 'trong file' };
const drItems = JSON.stringify([{ maSP: 'M7', id: '7', ten: 'SP 7' }, { maSP: 'M8', id: '', ten: 'SP 8' }, null, { maSP: 'KHONG', id: '99', ten: '' }]);
const DR = function (o) { return Object.assign({ id: 31, requester_id: 'U2', requester_name: 'Nhân Viên', items: drItems, status: 'pending', created_at: '2026-01-01T00:00:00+00:00', resolved_at: null, resolver_name: null }, o || {}); };

// [tên, ctx, actor, hàm, args, kịch bản]
const flows = [
  ['perms admin', 'c1', 'adm', 'spMyPerms', [], []], ['perms super', 'sup', 'sup', 'spMyPerms', [], []],
  ['perms nv chưa cấu hình', 'c1', 'nv', 'spMyPerms', [], [uNV('boc, muahang')]], ['perms nv sp_edit', 'c1', 'nv', 'spMyPerms', [], [uNV(' sp_edit ,boc')]],
  ['perms nv sp_duyet', 'c1', 'nv', 'spMyPerms', [], [uNV('sp_duyet')]], ['perms nv cả hai', 'c1', 'nv', 'spMyPerms', [], [uNV('sp_edit,sp_duyet')]],
  ['perms nv không còn', 'c1', 'nv', 'spMyPerms', [], []], ['perms lỗi đọc users', 'c1', 'nv', 'spMyPerms', [], [err('select', 'users', 'DB GET users -> 500 {}')]],

  ['save tạo mới tối thiểu', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'Đèn X' }], []],
  ['save đủ trường', 'c1', 'adm', 'saveDbProduct', [full], []],
  ['save cập nhật SP đã duyệt', 'c1', 'adm', 'saveDbProduct', [full], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 5, da_duyet: true }])]],
  ['save cập nhật chưa duyệt, nv', 'c1', 'nv', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M', 'NGÀNH HÀNG': 'son' }], [uNV('sp_edit'), sel('db_san_pham', 'ma_sp=eq.', [{ id: 6, da_duyet: false }])]],
  ['save không tên', 'c1', 'adm', 'saveDbProduct', [{ 'MÃ SẢN PHẨM': 'M' }], []], ['save thiếu tham số', 'c1', 'adm', 'saveDbProduct', [], []],
  ['save data null', 'c1', 'adm', 'saveDbProduct', [null], []], ['save data chuỗi', 'c1', 'adm', 'saveDbProduct', ['abc'], []],
  ['save data mảng', 'c1', 'adm', 'saveDbProduct', [[{ 'TÊN SẢN PHẨM': 'x' }]], []],
  ['save tên là số', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 12, 'MÃ SẢN PHẨM': 34, 'KÍCH THƯỚC': 5 }], []],
  ['save lỗi tra trùng', 'c1', 'adm', 'saveDbProduct', [full], [err('select', 'db_san_pham', 'DB GET db_san_pham -> 500 {}')]],
  ['save cập nhật lỗi cột', 'c1', 'adm', 'saveDbProduct', [full], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 5 }]), err('update', 'db_san_pham', COL)]],
  ['save cập nhật lỗi khác', 'c1', 'adm', 'saveDbProduct', [full], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 5 }]), err('update', 'db_san_pham', 'DB PATCH db_san_pham -> 409 {"code":"23505"}')]],
  ['save chèn lỗi cột', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T' }], [err('insert', 'db_san_pham', 'DB POST db_san_pham -> 400 {"message":"column \\"tinh_nang\\" does not exist"}')]],
  ['save lịch sử + audit lỗi vẫn xong', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T' }], [err('insert', 'db_san_pham_history', 'hỏng'), err('insert', 'audit_log', 'hỏng')]],
  ['save chèn không trả dòng', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T' }], [{ m: 'insert', table: 'db_san_pham', ret: [] }]],
  ['save không actor + opts', 'c1', 'none', '$saveDbProduct', [null, { 'TÊN SẢN PHẨM': 'T', 'ĐƠN VỊ TÍNH': '' }, { noAudit: 1, macDinh: { dvt: 'Cái', trang_thai: 'Đang kinh doanh', ten_sp: 'không đè' } }], []],
  ['save cập nhật bỏ qua macDinh', 'c1', 'adm', '$saveDbProduct', [actors.adm, { 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M' }, { noAudit: true, macDinh: { dvt: 'Cái' } }], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 6, da_duyet: null }])]],
  ['save super không công ty', 'sup', 'sup', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M', 'HẠNG MỤC': 'Sơn lót' }], []],

  ['get rỗng', 'c1', 'adm', 'getDbProduct', [''], []], ['get thiếu', 'c1', 'adm', 'getDbProduct', [], []], ['get null', 'c1', 'adm', 'getDbProduct', [null], []],
  ['get id', 'c1', 'adm', 'getDbProduct', [' 12 '], [sel('db_san_pham', 'id=eq.12', [P(12)])]], ['get id số', 'c1', 'adm', 'getDbProduct', [12], [sel('db_san_pham', 'id=eq.12', [P(12)])]],
  ['get mã', 'c1', 'adm', 'getDbProduct', ['AB/12 x&y'], []], ['get số thực', 'c1', 'adm', 'getDbProduct', [1.5], []],

  ['update thiếu khoá', 'c1', 'adm', 'updateDbProductTracked', ['  ', {}], []],
  ['update kho chung', 'c1', 'adm', 'updateDbProductTracked', ['50', { 'TÊN SẢN PHẨM': 'x' }], [sel('db_san_pham', 'id,cong_ty_id', [{ id: 50, cong_ty_id: C2 }])]],
  ['update không thấy', 'c1', 'adm', 'updateDbProductTracked', ['M9', { 'TÊN SẢN PHẨM': 'x' }], []],
  ['update không đổi', 'c1', 'adm', 'updateDbProductTracked', [7, { 'TÊN SẢN PHẨM': 'SP 7', 'CỘT CHƯA CÓ': 'x', 'KÍCH THƯỚC': '', 'TÍNH NĂNG': null }], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['update đổi, đang duyệt', 'c1', 'adm', 'updateDbProductTracked', ['7', { 'TÊN SẢN PHẨM': 'Tên mới', 'GIÁ BÁN LẺ': '1.000', 'LẮP NGUỒN RỜI': 'x', 'KÍCH THƯỚC': 'K', 'GHI CHÚ': null, 'BẢO HÀNH (năm)': '', 'CÔNG SUẤT (W)': 12 }],
    [sel('db_san_pham', 'id=eq.7', [P(7, { da_duyet: true, gia_ban_le: 1000, lap_nguon_roi: false, ghi_chu: null, bao_hanh_nam: 2, cong_suat_w: '12', kich_thuoc: null })])]],
  ['update nv, thiếu cột người sửa', 'c1', 'nv', 'updateDbProductTracked', ['M7', { 'TÊN SẢN PHẨM': 'Tên mới' }], [uNV(''), sel('db_san_pham', 'ma_sp=eq.M7', [P(7)]), err('update', 'db_san_pham', WHO, null, true)]],
  ['update sau khi biết thiếu cột', 'c1', 'nv', 'updateDbProductTracked', ['M7', { 'TÊN SẢN PHẨM': 'Tên mới' }], [uNV(''), sel('db_san_pham', 'ma_sp=eq.M7', [P(7)])]],
  ['update lỗi cột', 'c1', 'adm', 'updateDbProductTracked', ['M7', { 'TÊN SẢN PHẨM': 'Tên mới' }], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)]), err('update', 'db_san_pham', COL)]],
  ['update data không phải object', 'c1', 'adm', 'updateDbProductTracked', ['M7', 'abc'], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)])]],
  ['update thiếu data', 'c1', 'adm', 'updateDbProductTracked', ['M7'], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)])]],
  ['update lịch sử lỗi', 'c1', 'adm', 'updateDbProductTracked', ['M7', { 'GHI CHÚ': 'x' }], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)]), err('insert', 'db_san_pham_history', 'hỏng')]],
  ['update có opts', 'sup', 'sup', '$updateDbProductTracked', [actors.sup, 'M7', { 'GHI CHÚ': 'x' }, { giuDuyet: true, auditAction: 'duyet_sua', auditPrefix: 'Duyệt sửa ' }], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7, { da_duyet: true })])]],
  ['update không actor, noAudit', 'none', 'none', '$updateDbProductTracked', [null, 'M7', { 'GHI CHÚ': 'x' }, { noAudit: true }], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7, { da_duyet: true })])]],
  ['save sau khi biết thiếu cột (cập nhật vẫn ghi nguoi_sua?)', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M' }], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 6 }])]],

  ['delete thiếu khoá', 'c1', 'adm', 'deleteDbProduct', [], []], ['delete khoá rỗng', 'sup', 'sup', 'deleteDbProduct', [' '], []],
  ['delete kho chung', 'c1', 'adm', 'deleteDbProduct', ['M50'], [sel('db_san_pham', 'id,cong_ty_id', [{ id: 50, cong_ty_id: C2 }])]],
  ['delete không thấy', 'c1', 'adm', 'deleteDbProduct', ['M9'], []],
  ['delete được', 'c1', 'adm', 'deleteDbProduct', [' 7 '], [sel('db_san_pham', 'id,cong_ty_id', [{ id: 7, cong_ty_id: C1 }]), sel('db_san_pham', 'id=eq.7', [P(7, { ten_sp: null })])]],
  ['delete dọn liên kết lỗi', 'view', 'sup', 'deleteDbProduct', ['M7'], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)]), err('remove', 'sp_combo', NOTBL('sp_combo')), err('remove', 'sp_yeu_thich', 'x'), err('insert', 'db_san_pham_history', 'x')]],
  ['delete lỗi xoá', 'c1', 'adm', 'deleteDbProduct', ['M7'], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)]), err('remove', 'db_san_pham', 'DB DELETE db_san_pham -> 409 {}')]],
  ['delete không actor', 'c1', 'none', '$deleteDbProduct', [null, 7], [sel('db_san_pham', 'id=eq.7', [P(7)])]],

  ['duyệt: nv chỉ sp_edit', 'c1', 'nv', 'setSpDuyet', [['M1'], true], [uNV('sp_edit')]],
  ['duyệt nhiều khoá', 'c1', 'adm', 'setSpDuyet', [[12, ' M1 ', 'KHONG', null, ' 13', { a: 1 }, 14, 15]], [
    sel('db_san_pham', 'ma_sp=eq.M1', [{ id: 21 }, { id: 22 }]), sel('db_san_pham', 'id=eq.12', [P(12)]), sel('db_san_pham', 'id=eq.13', [P(13, { da_duyet: true })]),
    sel('db_san_pham', 'id=eq.21', [P(21, { ma_sp: '' })]), sel('db_san_pham', 'id=eq.22', [P(22, { cong_ty_id: C2 })]), sel('db_san_pham', 'id=eq.14', [P(14)]), sel('db_san_pham', 'id=eq.15', [P(15)]),
    err('update', 'db_san_pham', COL, 'id=eq.14'), err('select', 'db_san_pham', 'DB GET db_san_pham -> 500 {}', 'ma_sp=eq.null')]],
  ['bỏ duyệt 1 khoá không phải mảng', 'c1', 'adm', 'setSpDuyet', ['13', false], [sel('db_san_pham', 'id=eq.13', [P(13, { da_duyet: true })])]],
  ['duyệt approve null', 'sup', 'sup', 'setSpDuyet', [['13'], null], [sel('db_san_pham', 'id=eq.13', [P(13)]), err('insert', 'db_san_pham_history', 'x')]],
  ['duyệt hơn 8 + hơn 5 lỗi', 'c1', 'adm', 'setSpDuyet', [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 31, 32, 33, 34, 35, 36, 37, 'X1', 'X2']], [
    err('select', 'db_san_pham', 'lỗi A', 'id=eq.31'), err('select', 'db_san_pham', 'lỗi A', 'id=eq.32'), err('select', 'db_san_pham', 'lỗi A', 'id=eq.33'),
    err('select', 'db_san_pham', 'lỗi A', 'id=eq.34'), err('select', 'db_san_pham', 'lỗi A', 'id=eq.35'), err('select', 'db_san_pham', 'lỗi A', 'id=eq.36'),
    sel('db_san_pham', 'id=eq.37', []), sel('db_san_pham', 'ma_sp=eq.X', []), sel('db_san_pham', 'id,cong_ty_id', []), sel('db_san_pham', 'id=eq.', [P(77)])]],
  ['duyệt thiếu keys', 'c1', 'adm', 'setSpDuyet', [], []],

  ['yêu thích bật', 'c1', 'nv', 'setYeuThich', [[7, 'M8', '', 'KHONG', 9]], [sel('db_san_pham', 'id=eq.7', [{ id: 7, ma_sp: 'M7', ten_sp: 'x' }]), sel('db_san_pham', 'ma_sp=eq.M8', [{ id: 8, ma_sp: null }]),
    sel('db_san_pham', 'id=eq.9', [{ id: 9, ma_sp: 'M9' }]), sel('sp_yeu_thich', 'sp_id=eq.8', [{ id: 1 }])]],
  ['yêu thích bật: trùng + thiếu bảng', 'c1', 'adm', 'setYeuThich', [[7, 8, 9, 10]], [sel('db_san_pham', 'id=eq.7', [{ id: 7 }]), sel('db_san_pham', 'id=eq.8', [{ id: 8 }]), sel('db_san_pham', 'id=eq.9', [{ id: 9 }]),
    sel('db_san_pham', 'id=eq.10', [{ id: 10 }]),
    err('insert', 'sp_yeu_thich', 'DB POST sp_yeu_thich -> 409 {"code":"23505","message":"duplicate key value violates unique constraint"}', '"sp_id":7'),
    err('insert', 'sp_yeu_thich', NOTBL('sp_yeu_thich'), '"sp_id":8'), err('insert', 'sp_yeu_thich', 'DB POST sp_yeu_thich -> 403 {"code":"42501"}', '"sp_id":9'),
    err('select', 'sp_yeu_thich', 'lỗi mạng', 'sp_id=eq.10')]],
  ['yêu thích tắt, super', 'sup', 'sup', 'setYeuThich', [7, false], [sel('db_san_pham', 'id=eq.7', [{ id: 7 }])]],
  ['yêu thích tắt lỗi', 'view', 'sup', 'setYeuThich', [[7, 8], false], [sel('db_san_pham', 'id=eq.', [{ id: 7 }]), err('remove', 'sp_yeu_thich', NOTBL('sp_yeu_thich'))]],
  ['yêu thích bật super, on null', 'sup', 'sup', 'setYeuThich', [['M7'], null], [sel('db_san_pham', 'ma_sp=eq.M7', [{ id: 7, ma_sp: 'M7' }])]],
  ['yêu thích hơn 5 lỗi', 'c1', 'adm', 'setYeuThich', [[1, 2, 3, 4, 5, 6, 7]], [err('select', 'db_san_pham', 'lỗi B')]],

  ['combo không thấy SP', 'c1', 'adm', 'getCombo', ['M9'], []],
  ['combo hai chiều', 'c1', 'adm', 'getCombo', [7], [sel('db_san_pham', 'id=eq.7', [P(7)]),
    sel('sp_combo', 'sp_id=eq.7', [{ id: 1, sp_id: 7, sp_kem_id: 8, so_luong: 2, ghi_chu: 'gc', sort_no: 0 }, { id: 2, sp_id: 7, sp_kem_id: 7, so_luong: 1 }, { id: 3, sp_id: 7, sp_kem_id: 8, so_luong: 5 }, { id: 4, sp_id: 7, sp_kem_id: 10, so_luong: 0, ghi_chu: null }]),
    sel('sp_combo', 'sp_kem_id=eq.7', [{ id: 5, sp_id: 8, sp_kem_id: 7, so_luong: 3 }, { id: 6, sp_id: 9, sp_kem_id: 7, so_luong: '2,5', ghi_chu: 'ngược' }, { id: 7, sp_id: 11, sp_kem_id: 7, so_luong: null }]),
    sel('db_san_pham', 'id=in.', [P(9, { cong_ty_id: C2 }), P(8), P(10)])]],
  ['combo không có liên kết', 'c1', 'adm', 'getCombo', [7], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['combo chưa có bảng', 'c1', 'adm', 'getCombo', [7], [sel('db_san_pham', 'id=eq.7', [P(7)]), err('select', 'sp_combo', NOTBL('sp_combo'), 'sp_kem_id')]],
  ['combo lỗi khác', 'c1', 'adm', 'getCombo', [7], [sel('db_san_pham', 'id=eq.7', [P(7)]), err('select', 'sp_combo', 'DB GET sp_combo -> 500 {}')]],
  ['setCombo không thấy', 'c1', 'adm', 'setCombo', ['M9', []], []],
  ['setCombo payload hỏng', 'c1', 'adm', 'setCombo', [7, [null, 'x', { id: 0 }, { id: 7 }, { id: '7' }, 5, [1]]], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['setCombo đầy đủ', 'c1', 'nv', 'setCombo', [7, [{ id: 8, soLuong: 1 }, { id: '9', soLuong: '2', ghiChu: 'gc' }, { id: 10 }, { id: 9, soLuong: 7 }, { id: 11, soLuong: 0, ghiChu: null }, { id: 12, soLuong: '1,5' }, { id: 'abc' }, { id: 7 }]],
    [uNV('sp_edit'), sel('db_san_pham', 'id=eq.7', [P(7)]),
      sel('sp_combo', 'sp_kem_id=eq.7', [{ id: 1, sp_id: 8, sp_kem_id: 7 }, { id: 2, sp_id: 9, sp_kem_id: 7 }, { id: 3, sp_id: 20, sp_kem_id: 7 }, { id: 4, sp_id: 21, sp_kem_id: 7 }]),
      sel('sp_combo', 'sp_id=eq.7', [{ id: 5, sp_kem_id: 10 }, { id: 6, sp_kem_id: 30 }, { id: 7, sp_kem_id: 12 }])]],
  ['setCombo bỏ hết', 'c1', 'adm', 'setCombo', ['7', []], [sel('db_san_pham', 'id=eq.7', [P(7)]), sel('sp_combo', 'sp_id=eq.7', [{ id: 5, sp_kem_id: 10 }])]],
  ['setCombo items không phải mảng', 'c1', 'adm', 'setCombo', ['7', { id: 8 }], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['setCombo chưa có bảng', 'c1', 'adm', 'setCombo', ['7', [{ id: 8 }]], [sel('db_san_pham', 'id=eq.7', [P(7)]), err('select', 'sp_combo', NOTBL('sp_combo'))]],
  ['setCombo lỗi chèn', 'c1', 'adm', 'setCombo', ['7', [{ id: 8 }]], [sel('db_san_pham', 'id=eq.7', [P(7)]), err('insert', 'sp_combo', 'DB POST sp_combo -> 409 {"code":"23503"}')]],
  ['setCombo kho chung', 'c1', 'adm', 'setCombo', ['50', [{ id: 8 }]], [sel('db_san_pham', 'id=eq.50', [P(50)]), sel('db_san_pham', 'id,cong_ty_id', [{ id: 50, cong_ty_id: C2 }])]],

  ['biến thể: không thấy', 'c1', 'adm', 'getBienThe', ['M9'], []], ['biến thể: chưa gom', 'c1', 'adm', 'getBienThe', [7], [sel('db_san_pham', 'id=eq.7', [P(7, { nhom_bt: '  ' })])]],
  ['biến thể: có nhóm', 'c1', 'adm', 'getBienThe', [7], [sel('db_san_pham', 'id=eq.7', [P(7, { nhom_bt: ' BT-7 ' })]), sel('db_san_pham', 'nhom_bt=eq.', [P(8, { nhom_bt: 'cũ' }), P(7), P(9)])]],
  ['biến thể: thiếu cột', 'c1', 'adm', 'getBienThe', [7], [sel('db_san_pham', 'id=eq.7', [P(7, { nhom_bt: 'G' })]), err('select', 'db_san_pham', COL, 'nhom_bt=eq.')]],
  ['biến thể: lỗi khác', 'c1', 'adm', 'getBienThe', [7], [sel('db_san_pham', 'id=eq.7', [P(7, { nhom_bt: 'G' })]), err('select', 'db_san_pham', 'DB GET db_san_pham -> 500 {}', 'ten_sp.asc')]],
  ['setBienThe tạo nhóm', 'c1', 'adm', 'setBienThe', [7, [8, '9', { id: 10 }, { id: null }, ' 11 ', 7, 8, 'x', null, [12], 1.5, { id: '13' }]], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['setBienThe sửa nhóm', 'c1', 'nv', 'setBienThe', ['M7', [8, 9]], [uNV(''), sel('db_san_pham', 'ma_sp=eq.M7', [P(7, { nhom_bt: 'G1' })]), sel('db_san_pham', 'nhom_bt=eq.G1', [{ id: 7 }, { id: 8 }, { id: 20 }, { id: 21 }])]],
  ['setBienThe bỏ nhóm', 'c1', 'adm', 'setBienThe', [7, []], [sel('db_san_pham', 'id=eq.7', [P(7, { nhom_bt: 'G1' })])]],
  ['setBienThe bỏ khi chưa có nhóm', 'c1', 'adm', 'setBienThe', [7], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['setBienThe payload hỏng', 'c1', 'adm', 'setBienThe', [7, ['x', 7, {}]], [sel('db_san_pham', 'id=eq.7', [P(7)])]],
  ['setBienThe thiếu cột', 'c1', 'adm', 'setBienThe', [7, [8]], [sel('db_san_pham', 'id=eq.7', [P(7)]), err('update', 'db_san_pham', COL)]],
  ['setBienThe lỗi quyền', 'c1', 'adm', 'setBienThe', [7, [8]], [sel('db_san_pham', 'id=eq.7', [P(7)]), err('update', 'db_san_pham', 'DB PATCH db_san_pham -> 403 {"code":"42501","message":"permission denied"}')]],
  ['setBienThe không thấy', 'c1', 'adm', 'setBienThe', ['M9', [8]], []],

  ['lịch sử rỗng', 'c1', 'adm', 'getProductHistory', [' '], []],
  ['lịch sử', 'c1', 'adm', 'getProductHistory', [' M7 '], [sel('db_san_pham_history', 'ma_sp=eq.M7', [{ id: 1, ma_sp: 'M7', field: 'GIÁ', old_value: null, new_value: '5', changed_by_name: null, changed_at: '2026-01-02T03:04:05.1+00:00' }, { field: 'X', old_value: 'a', new_value: 'b', changed_by_name: 'adm', changed_at: '2026-01-01T00:00:00+00:00' }])]],

  ['danh mục: riêng + kho chung', 'c1', 'adm', 'getProducts', [], [sel('db_san_pham', 'cong_ty_id=eq.', dzRows), sel('db_san_pham', 'ten_sp.asc', spRows)].concat(dzOn, [
    sel('sp_yeu_thich', null, [{ sp_id: 2 }, { sp_id: 50 }]), sel('sp_combo', null, [{ sp_id: 1, sp_kem_id: 2 }, { sp_id: 2, sp_kem_id: 1 }, { sp_id: 3, sp_kem_id: 1 }, { sp_id: 3, sp_kem_id: 3 }, { sp_id: 99, sp_kem_id: 50 }])])],
  ['danh mục cache: đã có', 'c1', 'adm', '$getProductsCached', [], []],
  ['danh mục cache: công ty khác khoá', 'sup', 'sup', '$getProductsCached', [], [sel('db_san_pham', 'ten_sp.asc', [spRows[0]]), err('select', 'sp_yeu_thich', NOTBL('sp_yeu_thich')), err('select', 'sp_combo', NOTBL('sp_combo'))]],
  ['catSheets từ cache', 'c1', 'adm', '$getCatalogSheets', [], []],
  ['buildCatalog', 'c1', 'adm', '$buildCatalog', [], [sel('db_san_pham', 'ten_sp.asc', spRows)]],
  ['danh mục: không dùng kho chung', 'c1', 'adm', 'getProducts', [], [sel('db_san_pham', 'ten_sp.asc', spRows), sel('cong_ty', 'id=eq.', [{ id: C1, dung_sp_dezon: false }])]],
  ['danh mục: chính là dezon', 'c1', 'adm', 'getProducts', [], [sel('db_san_pham', 'ten_sp.asc', spRows), sel('cong_ty', 'id=eq.', [{ id: C1, dung_sp_dezon: true }]), sel('cong_ty', 'ma=eq.dezon', [{ id: C1 }])]],
  ['danh mục: chưa có cột dung_sp_dezon', 'c1', 'adm', 'getProducts', [], [sel('db_san_pham', 'ten_sp.asc', spRows), err('select', 'cong_ty', 'DB GET cong_ty -> 400 {"message":"column dung_sp_dezon does not exist"}')]],
  ['danh mục: lỗi đọc công ty', 'c1', 'adm', 'getProducts', [], [sel('db_san_pham', 'ten_sp.asc', spRows), err('select', 'cong_ty', 'DB GET cong_ty -> 500 {}')]],
  ['danh mục: lỗi đọc kho chung', 'c1', 'adm', 'getProducts', [], [err('select', 'db_san_pham', 'DB GET db_san_pham -> 500 {}', 'cong_ty_id=eq.'), sel('db_san_pham', 'ten_sp.asc', spRows)].concat(dzOn)],
  ['danh mục: lỗi đọc sản phẩm', 'c1', 'adm', 'getProducts', [], [err('select', 'db_san_pham', 'DB GET db_san_pham -> 500 {}')]],
  ['cache bị xoá sau lỗi? (đọc lại)', 'c1', 'adm', '$getProductsCached', [], []],
  ['ghi xong thì cache mất', 'c1', 'adm', 'setYeuThich', [[]], []],
  ['cache: đọc lại sau khi ghi', 'c1', 'adm', '$getProductsCached', [], [sel('db_san_pham', 'ten_sp.asc', [spRows[1]])]],

  ['nhập: nv không quyền? (luôn có quyền sửa)', 'c1', 'nv', 'importCommit', [[]], [uNV('sp_duyet')]],
  ['nhập hàng loạt', 'c1', 'adm', 'importCommit', [[
    { ten: 'Đèn nhập 1', ma: 'IMP-1', nhom: 'Dòng I', hangMuc: 'Đèn rọi', thuongHieu: 'TH', ncc: 'NCC', gia: '1.200.000', moTa: 'mô tả', hinhAnh: 'http://img', dvt: 'Bộ',
      _raw: { 'TÊN SẢN PHẨM': '  ', 'GIÁ ĐẠI LÝ': 9, 'CÔNG SUẤT (W)': '12', 'ẢNH SẢN PHẨM': 'ảnh trong file', 'GIÁ BÁN LẺ': '', 'TRẠNG THÁI': 'Ngừng kinh doanh' } },
    { ten: 'Cập nhật', ma: 'IMP-2', gia: 0, _raw: { 'GIÁ BÁN LẺ': 0, 'ĐƠN VỊ TÍNH': 'Cái' } },
    { ten: '', _raw: { 'MÃ SẢN PHẨM': 'x' } }, { ten: '[VÍ DỤ] dòng mẫu', ma: 'VD' }, 5, 'abc', {},
    { ten: 'Bồn cầu nhập', _nganh: 'vs', _raw: vsRaw, hinhAnh: null, dvt: '' },
    { _nganh: 'vs', _raw: Object.assign({}, vsRaw, { 'HẠNG MỤC': 'ghế' }) },
    { _nganh: 'vs', _raw: Object.assign({}, vsRaw, { 'MÀU SẮC': ' ', 'KÍCH THƯỚC': null }) },
    { ten: 'Sơn tự nhận', hangMuc: 'Sơn lót', _nganh: 'den', _raw: { 'MÀU SẮC': 'Trắng', 'ĐỘ PHỦ': '10', 'KÍCH THƯỚC': '5L', 'CÔNG SUẤT (W)': '1' } },
    { ten: 'Lỗi lưu', ma: 'IMP-ERR' }, { ten: 'CT', _nganh: 'ct', hangMuc: 'ổ cắm điện', _raw: { 'LOẠI CẤU KIỆN': 'Đế âm', 'MÀU SẮC': 'Trắng', 'NGÀNH HÀNG': 'x' } }
  ]], [sel('db_san_pham', 'ma_sp=eq.IMP-2', [{ id: 77, da_duyet: false }]), err('select', 'db_san_pham', 'DB GET db_san_pham -> 500 {}', 'ma_sp=eq.IMP-ERR')]],
  ['nhập: phần tử null', 'c1', 'adm', 'importCommit', [[{ ten: 'A' }, null, { ten: 'B' }]], []],
  ['nhập: không phải mảng', 'c1', 'adm', 'importCommit', [{ ten: 'A' }], []], ['nhập: thiếu tham số', 'c1', 'adm', 'importCommit', [], []],
  ['nhập: chuỗi', 'c1', 'adm', 'importCommit', ['abc'], []],
  ['nhập không actor', 'none', 'none', '$importCommit', [null, [{ ten: 'A', dvt: 0 }]], []],

  ['yc xoá: không hợp lệ', 'c1', 'nv', 'requestDeleteProducts', [[{ id: 5 }, 'x', 7, {}, { maSP: '' }]], []], ['yc xoá: thiếu tham số', 'c1', 'nv', 'requestDeleteProducts', [], []],
  ['yc xoá: phần tử null', 'c1', 'nv', 'requestDeleteProducts', [[{ maSP: 'A' }, null]], []],
  ['yc xoá', 'c1', 'nv', 'requestDeleteProducts', [[{ maSP: 'M7', id: 7, ten: 'SP 7', thua: 1 }, { ma: 'M8', ten: null }, { maSP: 9, id: '0', ten: 5 }, { ten: 'bỏ' }]],
    [uNV('boc'), sel('users', 'role=eq.admin', [{ id: 'A1', active: true }, { id: 'A2', active: false }, { id: 'A3', active: null }, { id: null }]), err('insert', 'notifications', 'hỏng', '"A3"')]],
  ['yc xoá: tài khoản không còn', 'c1', 'nv', 'requestDeleteProducts', [[{ maSP: 'M7' }]], [err('insert', 'audit_log', 'x')]],
  ['yc xoá: tên trống lấy username', 'c1', 'nv', 'requestDeleteProducts', [[{ maSP: 'M7' }]], [sel('users', 'id=eq.U2', [{ id: 'U2', username: 'nv', ho_ten: '' }])]],
  ['yc xoá: lỗi chèn', 'c1', 'nv', 'requestDeleteProducts', [[{ maSP: 'M7' }]], [err('insert', 'delete_requests', 'DB POST delete_requests -> 500 {}')]],
  ['yc xoá: lỗi đọc admin', 'c1', 'nv', 'requestDeleteProducts', [[{ maSP: 'M7' }]], [err('select', 'users', 'DB GET users -> 500 {}', 'role=eq.admin')]],
  ['ds yc xoá', 'c1', 'adm', 'listDeleteRequests', [], [sel('delete_requests', null, [DR(), DR({ id: 30, items: 'hỏng', status: 'approved', resolved_at: '2026-01-02T00:00:00+00:00', resolver_name: 'adm' }), DR({ id: 29, items: null }), DR({ id: 28, items: '{"a":1}' })])]],
  ['xử lý: không thấy', 'c1', 'adm', 'resolveDeleteRequest', [31, true], []],
  ['xử lý: đã xử lý', 'c1', 'adm', 'resolveDeleteRequest', [31, true], [sel('delete_requests', 'id=eq.31', [DR({ status: 'approved' })])]],
  ['xử lý: người khác nhanh hơn', 'c1', 'adm', 'resolveDeleteRequest', [31, true], [sel('delete_requests', 'id=eq.31', [DR()])]],
  ['xử lý: từ chối', 'c1', 'adm', 'resolveDeleteRequest', ['31'], [sel('delete_requests', 'id=eq.31', [DR()]), { m: 'update', table: 'delete_requests', ret: [DR({ status: 'rejected' })] },
    sel('users', 'id=eq.U1', [{ id: 'U1', username: 'adm', ho_ten: 'Quản Trị' }])]],
  ['xử lý: duyệt', 'c1', 'adm', 'resolveDeleteRequest', [31, 1], [sel('delete_requests', 'id=eq.31', [DR()]), { m: 'update', table: 'delete_requests', ret: [DR({ status: 'approved' })] },
    sel('db_san_pham', 'id=eq.7', [P(7)]), sel('db_san_pham', 'id,cong_ty_id', [{ id: 7, cong_ty_id: C1 }], true), sel('db_san_pham', 'ma_sp=eq.M8', [P(8)])]],
  ['xử lý: duyệt, items không phải mảng', 'c1', 'adm', 'resolveDeleteRequest', [31, true], [sel('delete_requests', 'id=eq.31', [DR({ items: '{"a":1}', requester_name: null, requester_id: null })]), { m: 'update', table: 'delete_requests', ret: [DR()] }]],
  ['xử lý: từ chối, items hỏng', 'sup', 'sup', 'resolveDeleteRequest', [31, false], [sel('delete_requests', 'id=eq.31', [DR({ items: 'x' })]), { m: 'update', table: 'delete_requests', ret: [DR()] }]],
  ['xử lý: lỗi giành quyền', 'c1', 'adm', 'resolveDeleteRequest', [31, true], [sel('delete_requests', 'id=eq.31', [DR()]), err('update', 'delete_requests', 'DB PATCH delete_requests -> 500 {}')]],
  // items không phải mảng nhưng có .length: chuỗi (duyệt từng ký tự), object có khoá length
  ['xử lý: duyệt, items là chuỗi', 'c1', 'adm', 'resolveDeleteRequest', [31, true], [sel('delete_requests', 'id=eq.31', [DR({ items: '"ab"' })]), { m: 'update', table: 'delete_requests', ret: [DR()] }]],
  ['xử lý: từ chối, items là chuỗi', 'c1', 'adm', 'resolveDeleteRequest', [31, 0], [sel('delete_requests', 'id=eq.31', [DR({ items: '"a😀"' })]), { m: 'update', table: 'delete_requests', ret: [DR()] }]],
  ['xử lý: duyệt, items có khoá length', 'c1', 'adm', 'resolveDeleteRequest', [31, true], [sel('delete_requests', 'id=eq.31', [DR({ items: '{"length":"3","0":{"maSP":"M8"},"2":null}' })]), { m: 'update', table: 'delete_requests', ret: [DR()] },
    sel('db_san_pham', 'ma_sp=eq.M8', [P(8)])]],
  ['xử lý: duyệt, length không phải số', 'c1', 'adm', 'resolveDeleteRequest', [31, true], [sel('delete_requests', 'id=eq.31', [DR({ items: '{"length":"x","0":{"maSP":"M8"}}' })]), { m: 'update', table: 'delete_requests', ret: [DR()] }]],
  ['xử lý: duyệt, items là số', 'c1', 'adm', 'resolveDeleteRequest', [31, true], [sel('delete_requests', 'id=eq.31', [DR({ items: '5' })]), { m: 'update', table: 'delete_requests', ret: [DR()] }]],
  // insert không trả dòng nào: req = undefined, chỉ lỗi khi có admin để báo
  ['yc xoá: chèn không trả dòng, không có admin', 'c1', 'nv', 'requestDeleteProducts', [[{ maSP: 'M7' }]], [{ m: 'insert', table: 'delete_requests', ret: [] }]],
  ['yc xoá: chèn không trả dòng, có admin', 'c1', 'nv', 'requestDeleteProducts', [[{ maSP: 'M7' }]], [{ m: 'insert', table: 'delete_requests', ret: [] }, sel('users', 'role=eq.admin', [{ id: 'A1', active: true }])]],

  // CUỐI: nhánh thiếu cột người tạo đặt cờ _hasWhoCol = false vĩnh viễn
  ['save cập nhật thiếu cột người sửa (không đặt cờ)', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M' }], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 6, da_duyet: true }]), err('update', 'db_san_pham', WHO, null, true)]],
  ['save cập nhật thiếu cột, lần 2 cũng lỗi', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M' }], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 6 }]), err('update', 'db_san_pham', WHO)]],
  ['save chèn thiếu cột người tạo', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T' }], [err('insert', 'db_san_pham', WHO2, null, true)]],
  ['save sau khi đặt cờ: tạo', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T' }], []],
  ['save sau khi đặt cờ: cập nhật', 'c1', 'adm', 'saveDbProduct', [{ 'TÊN SẢN PHẨM': 'T', 'MÃ SẢN PHẨM': 'M' }], [sel('db_san_pham', 'ma_sp=eq.', [{ id: 6 }])]],
  ['update sau khi đặt cờ', 'c1', 'adm', 'updateDbProductTracked', ['M7', { 'GHI CHÚ': 'x' }], [sel('db_san_pham', 'ma_sp=eq.M7', [P(7)])]]
];

(async function () {
  const out = { pure: pure, upload: [], flows: [] };
  for (const c of upCases) {
    upRec = null; upFail = c[2] || null;
    const rec = { fn: c[0], args: rt(c[1]), fail: upFail };
    try { rec.result = rt(await ref.call(c[0], null, c[1])); } catch (e) { rec.error = e.message; }
    rec.up = upRec;
    out.upload.push(upNorm(rec));
  }
  fakeOn();
  for (const f of flows) {
    script = f[5].map(function (r) { return Object.assign({}, r, { used: false }); });
    log = [];
    const rec = { name: f[0], ctx: ctxs[f[1]], actor: actors[f[2]], fn: f[3], args: rt(f[4]) };
    try { rec.result = ts(await ref.tenant.run(ctxs[f[1]], function () { return ref.call(f[3], actors[f[2]], rt(f[4])); })); }
    catch (e) { rec.error = e.message; }
    rec.calls = log;
    out.flows.push(rec);
  }
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  process.exit(0);
})().catch(function (e) { process.stderr.write(String(e && e.stack) + '\n'); process.exit(1); });
