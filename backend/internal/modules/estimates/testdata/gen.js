'use strict';
/* Sinh testdata/golden.json: giá trị mong đợi của các hàm THUẦN, lấy bằng cách chạy mã Node thật.
     DATABASE_URL=postgresql://qspro:<pw>@localhost:5434/qspro_nodetest SUPABASE_URL_OVERRIDE=http://127.0.0.1:9 \
     PURCHASE_WEBHOOK=http://127.0.0.1:9/x REPORT_WEBHOOK=http://127.0.0.1:9/x node gen.js
   {"$undef":true} trong đầu vào nghĩa là undefined. Không ca nào ở đây đọc / ghi database. */
const fs = require('fs');
const path = require('path');
const ref = require('./noderef');
const ct = ref.loadStore().__ct;
const auth = ref.auth();
const exportCongTacXlsx = ref.loadExport();
const ExcelJS = ref.ExcelJS();

function un(v) {
  if (Array.isArray(v)) return v.map(un);
  if (v && typeof v === 'object') {
    if (v.$undef) return undefined;
    const o = {};
    Object.keys(v).forEach(function (k) { o[k] = un(v[k]); });
    return o;
  }
  return v;
}
function attempt(fn) {
  try { return { out: fn() }; } catch (e) { return { err: e.message }; }
}
async function attemptA(fn) {
  try { return { out: await fn() }; } catch (e) { return { err: e.message }; }
}

const U = { $undef: true };
const toObjIn = [
  { id: 'a1', loai: 'kt_sobo', che_do: 'area', ma_nhom: 'M1', hang_muc: 'Móng', de_muc: '3.1', ten: 'Đào đất', dvt: 'm3',
    nha_cung_cap: 'NT A', khoi_luong: 12.5, dien_tich: 0, he_so: 1.05, don_gia_nha_thau: 150000, don_gia: 180000.5,
    ghi_chu: 'gc', hinh_anh: 'a\nb', thong_so: 'ts', pham_vi: 'pv', link_tai_lieu: 'http://x', da_duyet: true,
    nguoi_duyet: 'sep', ngay_duyet: '2026-10-01T00:00:00+00:00', yeu_thich: true, nguoi_tao: 'mai',
    ngay_tao: '2026-09-01T01:02:03.123456+00:00', nguoi_sua: 'lan', ngay_cap_nhat: '2026-09-02T00:00:00+00:00', thu_tu: 7 },
  { id: 5, loai: null, che_do: '', ma_nhom: null, hang_muc: null, de_muc: null, ten: null, dvt: null, nha_cung_cap: null,
    khoi_luong: null, dien_tich: null, he_so: null, don_gia_nha_thau: null, don_gia: null, ghi_chu: null, hinh_anh: null,
    thong_so: null, pham_vi: null, link_tai_lieu: null, da_duyet: false, nguoi_duyet: null, ngay_duyet: null,
    yeu_thich: false, nguoi_tao: null, ngay_tao: null, nguoi_sua: null, ngay_cap_nhat: null, thu_tu: null },
  {},
  { id: 'x', khoi_luong: '12.500', dien_tich: '12,5', he_so: 'abc', don_gia_nha_thau: '1.234.567', don_gia: '30%',
    da_duyet: 1, yeu_thich: 'true', ten: 123, dvt: false, thu_tu: '3', ngay_tao: 0 },
  { id: 'y', khoi_luong: 1e21, dien_tich: 1e-7, he_so: -0, don_gia: 0.1, thu_tu: 2.5 }
];
const toRowIn = [
  { loai: 'dt_vattu', mode: 'area0', maNhom: 'N', hangMuc: 'HM', deMuc: 'DM', ten: 'Tên', dvt: 'm2', ncc: 'NCC',
    kl: 1, dt: 2.5, hs: 0, dgnt: 1000, dg: 2000, gc: 'g', hinhAnh: 'h', thongSo: 't', phamVi: 'p', linkTaiLieu: 'l', thuTu: 4 },
  {},
  { ten: '  có khoảng trắng  ', kl: '', dt: null, hs: '0', dgnt: '12.500.000', dg: '12,5', thuTu: '' },
  { ten: 5, loai: 0, mode: false, kl: '1.234', dt: 'abc', hs: true, dgnt: '30%', dg: -3, thuTu: 0, dvt: null, gc: 1.5 },
  { ten: 'x', thuTu: null, kl: 0, dt: '1,234,567', hs: '1e3', maNhom: ['a', 'b'], hangMuc: { a: 1 } },
  { ten: 'x', thuTu: '1.500', extra: 'bỏ qua', id: 'zzz' },
  null, U, 'chuỗi', 0, 7, true, [1, 2]
];
const diffIn = [
  { cur: { ten: 'A', don_gia: 100, khoi_luong: null, ghi_chu: null, da_duyet: true, nguoi_duyet: 'x', ngay_duyet: 't', nguoi_sua: 'c' },
    row: { ten: 'B', don_gia: 100, khoi_luong: null, ghi_chu: '', nguoi_sua: 'z', ngay_cap_nhat: 'n', da_duyet: false, nguoi_duyet: null, ngay_duyet: null } },
  { cur: { don_gia: 5, khoi_luong: 12.5, he_so: 1, ten: '5abc', dvt: 'm2', thu_tu: 3 },
    row: { don_gia: 5.0, khoi_luong: 12.50, he_so: 2, ten: '5', dvt: 'm3', thu_tu: 4, cot_la: 'v' } },
  { cur: null, row: { ten: 'Mới', don_gia: null, da_duyet: false, khoi_luong: 0 } },
  { cur: { ten: 'A' }, row: { ten: 'A', loai: 'kt_sobo', che_do: 'area', ma_nhom: 'a', hang_muc: 'b', de_muc: 'c', nha_cung_cap: 'd',
    dien_tich: 1, don_gia_nha_thau: 2, hinh_anh: 'e', thong_so: 'f', pham_vi: 'g', link_tai_lieu: 'h', yeu_thich: true } },
  { cur: { don_gia: 1e21, khoi_luong: 1e-7, he_so: 0.1, dien_tich: '1.0', ten: ' 5', dvt: '' },
    row: { don_gia: 1e21, khoi_luong: 2e-7, he_so: 0.10, dien_tich: 1, ten: '5 ', dvt: 'Infinity' } },
  { cur: { da_duyet: false, ten: 'x', don_gia: 0 }, row: { da_duyet: false, ten: '', don_gia: '0.0' } }
];
const errIn = [
  'DB POST cong_tac -> 404 {"code":"PGRST205","details":null,"hint":null,"message":"Could not find the table \'public.cong_tac\' in the schema cache"}',
  'DB POST cong_tac -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the \'nha_cung_cap\' column of \'cong_tac\' in the schema cache"}',
  'DB PATCH cong_tac -> 400 {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the \'yeu_thich\' column of \'cong_tac\' in the schema cache"}',
  'DB POST cong_tac -> 404 {"code":"42P01","details":null,"hint":null,"message":"relation \\"public.cong_tac\\" does not exist"}',
  'DB POST cong_tac_history -> 404 {"code":"42P01","details":null,"hint":null,"message":"relation \\"cong_tac_history\\" does not exist"}',
  'DB GET cong_tac_history -> 404 {"code":"PGRST205","details":null,"hint":null,"message":"Could not find the table \'public.cong_tac_history\' in the schema cache"}',
  'DB POST cong_tac_history -> 409 {"code":"23503","details":"Key is not present","hint":null,"message":"insert or update on table violates foreign key"}',
  'DB POST cong_tac -> 403 {"code":"42501","details":null,"hint":null,"message":"permission denied for table work_items"}',
  'new row violates Row-Level Security policy for table "work_items"',
  'DB POST cong_tac -> 400 {"code":"23514","details":"Failing row contains (...)","hint":null,"message":"new row for relation \\"work_items\\" violates check constraint \\"ck_work_items_name\\""}',
  'DB GET du_an -> 404 {"code":"42P01","details":null,"hint":null,"message":"relation \\"du_an\\" does not exist"}',
  'COULD NOT FIND THE \'Ten_1\' COLUMN',
  'Could not find the \'tên\' column',
  'lỗi mạng cong_tac_history 404',
  '',
  // cờ /i của JS chỉ gập hoa thường kiểu ASCII: U+017F (ſ) không phải "s", U+212A (K) không phải "k"
  'DB GET cong_tac -> 400 {"code":"22P02","details":null,"hint":null,"message":"invalid input syntax for type uuid: \\"PGR\u017FT205\\""}',
  'DB GET cong_tac -> 400 {"code":"22P02","details":null,"hint":null,"message":"invalid input syntax for type uuid: \\"row-level \u017Fecurity\\""}',
  'DB GET cong_tac_history -> 400 {"code":"22P02","details":null,"hint":null,"message":"invalid input syntax for type uuid: \\"doe\u017F not exi\u017Ft\\""}',
  'Could not find the \'\u017Fo_luong\' column',
  'Could not find the \'\u212Aho\' column',
  'could not find the TABLE cong_tac_history pgrst205',
  'ROW-LEVEL SECURITY',
  // dấu chấm của JS không khớp CR / U+2028
  'relation "a\rcong_tac" does not exist',
  'relation "cong_tac\u2028" does not exist',
  'relation "a\ncong_tac" does not exist'
];

/* Dòng gửi lên POST /export/cong-tac: đủ kiểu giá trị mà JSON mang được. */
const exportRows = [
  { stt: 1, loai: 'Khái toán chi tiết', hangMuc: 'Móng', noiDung: 'Đào đất hố móng', dvt: 'm3', khoiLuong: 12.5, dienTich: 30,
    heSo: 1.05, dgnt: 150000, dg: 180000, ghiChu: 'Ghi chú <b>&</b> "nháy"' },
  { stt: '2', loai: '', hangMuc: null, noiDung: 'Dòng số dạng chuỗi', dvt: '', khoiLuong: '12.5', dienTich: '', heSo: '0',
    dgnt: '1500000', dg: '12,5', ghiChu: '' },
  { stt: 3, noiDung: 'Số 0 và âm', khoiLuong: 0, dienTich: -4.25, heSo: null, dgnt: false, dg: true },
  { noiDung: 'Thiếu stt', khoiLuong: 1e21, dienTich: 1e-7, heSo: 0.1, dgnt: '1e999', dg: ' 42 ' },
  { stt: null, loai: 5, hangMuc: true, noiDung: 0, dvt: false, ghiChu: 7.25 },
  { stt: true, loai: ['a', 'b'], hangMuc: { a: 1, b: [null, 'x'] }, noiDung: 'Kiểu lạ', dvt: 'cái', khoiLuong: [5], dienTich: {}, heSo: [1, 2] },
  { stt: 1.5, loai: 'xuống\ndòng', hangMuc: '  khoảng trắng  ', noiDung: 'Emoji 😀 và tiếng Việt: Đặng Thị Ánh', dvt: 'm²',
    khoiLuong: '0x10', dienTich: '1.234', heSo: '1,234', dgnt: 1234567.891, dg: -0, ghiChu: 'x'.repeat(300) },
  {}, 'chuỗi', 12, true, ['mảng'], { stt: { c: 1 } },
  // ký tự điều khiển, CR, chuỗi dài hơn 32767 ký tự
  { stt: '\u0001ctl\u000bx\u007f', loai: 'a\r\nb', hangMuc: 'a\rb\r', noiDung: 'x'.repeat(40000), dvt: '\ttab\t',
    ghiChu: '\u0000\u0008\u000c\u000e\u001fz\r\n' },
  { stt: 'y'.repeat(32767), loai: 'y'.repeat(32768), hangMuc: ' ' + 'x'.repeat(40000), noiDung: 'x'.repeat(40000),
    dvt: 'đ'.repeat(32768), ghiChu: '\r' }
];
const exportErrRows = [[null], [{ stt: 1 }, null]];

(async function () {
  const out = {};
  out.toObj = toObjIn.map(function (r) { return { in: r, out: ct.ctToObj(r) }; });
  out.toRow = toRowIn.map(function (d) { return Object.assign({ in: d }, attempt(function () { return ct.ctToRow_(un(d)); })); });
  out.diff = diffIn.map(function (c) { return { cur: c.cur, row: c.row, out: ct.ctDiff_(c.cur, c.row) }; });
  out.err = errIn.map(function (m) {
    const e = new Error(m);
    return { msg: m, ctErr: ct.ctErr_(e).message, missingCol: ct.ctMissingCol_(e), histThieu: ct.ctHistThieu_(e) };
  });
  // cửa ngõ khi KHÔNG có quyền: actor null -> spPerms_ trả {edit:false, duyet:false}, không chạm database
  out.gates = {
    ctSave: (await attemptA(function () { return auth.ctSaveGated(null, [{ ten: 'x' }]); })).err,
    ctUpdate: (await attemptA(function () { return auth.ctUpdateGated(null, 'id', {}); })).err,
    ctDelete: (await attemptA(function () { return auth.ctDeleteGated(null, ['id']); })).err,
    ctDuyet: (await attemptA(function () { return auth.ctDuyetGated(null, ['id'], true); })).err
  };
  // lỗi không cần database
  const store = ref.loadStore();
  // ctList / ctGetHistory thật với supa.select ném đúng lỗi đó: [] = lỗi bị nuốt, còn lại là thông báo lỗi
  const supa = ref.supa();
  const select0 = supa.select;
  for (const c of out.err) {
    supa.select = async function () { throw new Error(c.msg); };
    c.ctList = await attemptA(function () { return store.ctList(); });
    c.ctGetHistory = await attemptA(function () { return store.ctGetHistory('x'); });
  }
  supa.select = select0;
  out.noDb = {
    ctSaveEmpty: (await attemptA(function () { return store.ctSave({ u: 'a' }, [{ ten: '  ' }, null, '', {}]); })).err,
    ctSaveUndef: (await attemptA(function () { return store.ctSave({ u: 'a' }); })).err,
    ctUpdateNoId: (await attemptA(function () { return store.ctUpdate({ u: 'a' }, 0, {}); })).err,
    ctUpdateNullPatch: (await attemptA(function () { return store.ctUpdate({ u: 'a' }, 'x', null); })).err,
    ctUpdateUndefPatch: (await attemptA(function () { return store.ctUpdate({ u: 'a' }, 'x'); })).err,
    ctHistoryNoId: await store.ctGetHistory('')
  };

  // file xuất: đọc lại workbook của Node bằng ExcelJS, ghi từng ô {a, type, value}
  const res = await exportCongTacXlsx(exportRows);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.buf);
  const ws = wb.worksheets[0];
  const cells = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = ws.getRow(r).getCell(c);
      let v = cell.value;
      if (typeof v === 'number' && !isFinite(v)) v = String(v);
      cells.push({ a: cell.address, type: cell.type, value: v === undefined ? null : v });
    }
  }
  out.export = { rows: exportRows, name: res.name, count: res.count, sheet: ws.name, rowCount: ws.rowCount, cells: cells, errs: [] };
  for (const rows of exportErrRows) {
    out.export.errs.push({ rows: rows, err: (await attemptA(function () { return exportCongTacXlsx(rows); })).err });
  }

  fs.writeFileSync(path.join(__dirname, 'golden.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(__dirname, 'export-rows.json'), JSON.stringify(exportRows) + '\n');
  console.log('ok: golden.json, export-rows.json');
  await ref.supa().close();
})().catch(function (e) { console.error(e); process.exit(1); });
