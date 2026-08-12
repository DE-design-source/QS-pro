'use strict';
/************************************************************
 * QS PRO — Tầng dữ liệu trên SUPABASE (Postgres REST).
 * Thay cho store.js (Lark). Giữ nguyên interface cho registry.
 ************************************************************/
const supa = require('./supa');
const larkStore = require('./store');   // tái dùng hàm thuần: importParse, cover template, export helpers

/*** ===== HELPERS ===== ***/
function n(v) { if (v == null || v === '') return 0; var x = Number(v); return isNaN(x) ? 0 : x; }
function round0_(v) { return Math.round(n(v)); }
function s(v) { return v == null ? '' : String(v); }
function nowIso() { return new Date().toISOString(); }
function firstImg(v) { var a = s(v).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); return a[0] || ''; }
function fmtUnit(v, unit) { if (v == null || v === '') return ''; var t = String(v); return new RegExp(unit + '$', 'i').test(t) ? t : t + unit; }
function fmtList(v, unit) { return s(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return new RegExp(unit + '$', 'i').test(x) ? x : x + unit; }).join(', '); }

/*** ===== SẢN PHẨM (db_san_pham) ===== ***/
function prodToObj(r) {
  const congSuat = fmtUnit(r.cong_suat_w, 'W'), nhietDo = fmtList(r.nhiet_do_mau_k, 'K'), gocChieu = fmtList(r.goc_chieu_deg, '°');
  const cri = s(r.cri), chip = s(r.loai_chip_led), dong = s(r.dong_sp), qt = r.quang_thong_lm ? (r.quang_thong_lm + 'lm') : '';
  const chatLieu = s(r.chat_lieu), chieuCao = fmtUnit(r.chieu_cao_mm, 'mm'), duongKinh = r.duong_kinh_mm ? ('Ø' + r.duong_kinh_mm + 'mm') : '', gocNghieng = fmtList(r.goc_nghieng_deg, '°');
  // "Thông tin chính" = gộp thông số cốt lõi (hiện ở cột bảng bóc tách)
  const ttc = [];
  if (dong) ttc.push('Dòng SP: ' + dong);
  if (chip) ttc.push('Chip LED: ' + chip + (cri ? ', CRI ' + cri : ''));
  else if (cri) ttc.push('CRI: ' + cri);
  if (congSuat) ttc.push('Công suất: ' + congSuat);
  if (nhietDo) ttc.push('Nhiệt độ màu: ' + nhietDo);
  if (gocChieu) ttc.push('Góc chiếu: ' + gocChieu);
  if (qt) ttc.push('Quang thông: ' + qt);
  let moTa = ttc.join('\n'); if (s(r.ghi_chu)) moTa += (moTa ? '\n' : '') + s(r.ghi_chu);
  // "Thông số thiết kế" = gộp như Design Specifications (hiện ở cột bảng bóc tách)
  const tsk = [];
  if (chatLieu) tsk.push('Chất liệu: ' + chatLieu);
  if (chieuCao) tsk.push('Chiều cao: ' + chieuCao);
  if (duongKinh) tsk.push('Đường kính: ' + duongKinh);
  if (gocNghieng) tsk.push('Góc nghiêng: ' + gocNghieng);
  if (dong) tsk.push('Dòng SP: ' + dong);
  const size = (r.duong_kinh_mm && r.chieu_cao_mm) ? ('Ø' + r.duong_kinh_mm + '×H' + r.chieu_cao_mm + 'mm') : (r.duong_kinh_mm ? ('Ø' + r.duong_kinh_mm + 'mm') : '');
  const thongSoTK = tsk.join('\n') || size;
  return {
    ma: s(r.ma_sp), ten: s(r.ten_sp), dongSanPham: dong, hangMuc: s(r.hang_muc),
    nhom: s(r.nhom_sp) || dong, muc: 'Thiết bị đèn',
    thuongHieu: s(r.thuong_hieu), ncc: s(r.nha_cung_cap),
    congSuat: congSuat, nhietDo: nhietDo, gocChieu: gocChieu,
    mauSac: s(r.mau_sac), chatLieu: chatLieu,
    chieuCao: chieuCao, duongKinh: duongKinh,
    gocNghieng: gocNghieng, loKhoet: r.cutout_mm ? ('Ø' + r.cutout_mm + 'mm') : '',
    capBaoVe: s(r.chi_so_ip), cri: cri, hieuSuat: r.hieu_suat_lm_w ? (r.hieu_suat_lm_w + ' lm/W') : '',
    ugr: s(r.ugr), sdcm: s(r.sdcm), coi: s(r.coi), tuoiTho: s(r.tuoi_tho), chipLed: chip,
    quangThong: qt, baoHanh: r.bao_hanh_nam ? (r.bao_hanh_nam + ' năm') : '',
    tenBoNguon: s(r.ten_bo_nguon), maBoNguon: s(r.ma_bo_nguon), hangBoNguon: s(r.hang_bo_nguon),
    viTriNguon: s(r.vi_tri_lap_nguon), tuongThich: s(r.dieu_khien), dongRa: r.dong_ra_max_ma ? (r.dong_ra_max_ma + 'mA') : '',
    lapNguonRoi: r.lap_nguon_roi ? 'Có' : '', capBaoVeDien: s(r.class_rating), linkDatasheet: s(r.link_datasheet),
    kichThuoc: thongSoTK, size: size,
    dvt: s(r.dvt) || 'Cái', hinhAnh: firstImg(r.anh_sp), moTa: moTa,
    donGiaVon: n(r.gia_dai_ly), donGiaBan: n(r.gia_dai_ly), lnPct: 0, recordId: r.id
  };
}
let _cache = null, _cacheAt = 0;
async function getProducts() {
  const rows = await supa.select('db_san_pham', { select: '*', order: 'ten_sp.asc', limit: 5000 });
  const out = rows.map(prodToObj);
  _cache = out; _cacheAt = Date.now();
  return out;
}
async function getProductsCached() { if (_cache && Date.now() - _cacheAt < 300000) return _cache; return getProducts(); }
async function getCatalogSheets() {
  const prods = await getProductsCached();
  const seen = {}, out = [];
  prods.forEach(function (p) { var g = p.nhom; if (g && !seen[g]) { seen[g] = 1; out.push(g); } });
  return out;
}
async function buildCatalog() { _cache = null; const p = await getProducts(); return { count: p.length }; }

/*** ===== DỰ ÁN (du_an) ===== ***/
const PROJ_MAP = { ten: 'ten_du_an', khachHang: 'khach_hang', diaChi: 'dia_chi', sdt: 'sdt', trangThai: 'trang_thai',
  vat: 'vat_pct', tienDo: 'tien_do_pct', ghiChu: 'ghi_chu', quyMo: 'quy_mo', tongDT: 'tong_dt', dtBaoGia: 'dt_bao_gia',
  nhuCau: 'nhu_cau', phanKhuc: 'phan_khuc', maBaoGia: 'ma_bao_gia', nhomTuTao: 'nhom_tu_tao', tangTuTao: 'tang_tu_tao' };
function projToObj(r) {
  const o = { maDA: s(r.ma_da), ngayTao: s(r.ngay_tao), capNhat: s(r.cap_nhat) };
  Object.keys(PROJ_MAP).forEach(function (k) { var col = PROJ_MAP[k]; o[k] = (k === 'vat' || k === 'tienDo') ? n(r[col]) : s(r[col]); });
  return o;
}
async function getProjects() {
  const rows = await supa.select('du_an', { select: '*', order: 'ngay_tao.desc', limit: 2000 });
  return rows.map(projToObj);
}
async function getProject(maDA) {
  const rows = await supa.select('du_an', { filter: supa.eq('ma_da', maDA), limit: 1 });
  return rows[0] ? projToObj(rows[0]) : null;
}
function genMaDA_() {
  const d = new Date();
  const pad = function (x) { return String(x).padStart(2, '0'); };
  return 'DA-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}
async function createProject(data) {
  data = data || {};
  const row = { ma_da: data.maDA || genMaDA_(), ngay_tao: nowIso(), cap_nhat: nowIso() };
  Object.keys(PROJ_MAP).forEach(function (k) { if (data[k] != null && data[k] !== '') row[PROJ_MAP[k]] = data[k]; });
  if (!row.trang_thai) row.trang_thai = 'Bản nháp';
  const res = await supa.insert('du_an', row);
  return projToObj(res[0]);
}
async function updateProject(maDA, fields) {
  fields = fields || {};
  const patch = { cap_nhat: nowIso() };
  Object.keys(fields).forEach(function (k) { if (PROJ_MAP[k]) patch[PROJ_MAP[k]] = fields[k]; });
  const res = await supa.update('du_an', supa.eq('ma_da', maDA), patch);
  return res[0] ? projToObj(res[0]) : getProject(maDA);
}
async function deleteProject(maDA) {
  await supa.remove('db_bao_gia', supa.eq('ma_du_an', maDA));
  await supa.remove('khai_toan', supa.eq('ma_da', maDA));
  await supa.remove('du_an', supa.eq('ma_da', maDA));
  return { ok: true };
}

/*** ===== DÒNG BÓC TÁCH (db_bao_gia) ===== ***/
function lineToObj(r) {
  const von = n(r.gia_ban_le), ck = n(r.ck_dai_ly_pct), sl = n(r.so_luong);
  const giaDaiLy = n(r.gia_dai_ly);
  return {
    lineId: String(r.id), maDA: s(r.ma_du_an), stt: n(r.sort_no),
    nhom: s(r.nhom), loai: s(r.loai), tang: s(r.tang), maSP: s(r.ma_sp), ten: s(r.ten_sp),
    thuongHieu: s(r.thuong_hieu), ncc: s(r.nha_cung_cap), moTa: s(r.mo_ta), kichThuoc: s(r.kich_thuoc),
    hinhAnh: s(r.hinh_anh), dvt: s(r.dvt) || 'Cái', khuVuc: s(r.phong), maBanVe: s(r.ma_so_ban_ve),
    soLuong: sl, donGiaVon: von, chietKhau: ck, lnPct: n(r.loi_nhuan_pct), donGiaBan: n(r.gia_ban),
    ckKhach: n(r.ck_khach_hang_pct),
    thanhTienVon: round0_(sl * giaDaiLy), thanhTienBan: n(r.thanh_tien),
    trangThai: s(r.trang_thai), ghiChu: s(r.ghi_chu), tuNhap: r.tu_nhap ? 1 : 0, daLuuDM: r.da_luu_dm ? 1 : 0,
    extra: r.extra || {}
  };
}
async function getLines(maDA) {
  const rows = await supa.select('db_bao_gia', { filter: supa.eq('ma_du_an', maDA), order: 'sort_no.asc', limit: 5000 });
  return rows.map(lineToObj);
}
// tính các cột dẫn xuất giống bản Lark
function calc_(von, ckDaiLy, ln, ban, ckKhach, sl) {
  const giaDaiLy = round0_(von * (1 - ckDaiLy / 100));
  if (ban == null) ban = round0_(von * (1 + ln / 100));
  const donGia = round0_(ban * (1 - ckKhach / 100));
  const markup = giaDaiLy > 0 ? Math.round((donGia - giaDaiLy) / giaDaiLy * 100) : 0;
  const margin = donGia > 0 ? Math.round((donGia - giaDaiLy) / donGia * 100) : 0;
  return { giaDaiLy: giaDaiLy, ban: ban, donGia: donGia, markup: markup, margin: margin,
    thanhTien: round0_(sl * donGia), lnVnd: round0_((donGia - giaDaiLy) * sl) };
}
async function addLine(maDA, product, soLuong) {
  product = product || {};
  const sl = Number(soLuong) || 1;
  const von = n(product.donGiaVon);
  const ln = von > 0 && product.donGiaBan ? Math.round((n(product.donGiaBan) - von) / von * 100) : (Number(product.lnPct) || 0);
  const existing = await supa.select('db_bao_gia', { select: 'id', filter: supa.eq('ma_du_an', maDA), limit: 5000 });
  const c = calc_(von, Number(product.chietKhau) || 0, ln, product.donGiaBan != null ? n(product.donGiaBan) : null, Number(product.ckKhach) || 0, sl);
  const row = {
    ma_du_an: maDA, sort_no: existing.length + 1, stt: String(existing.length + 1),
    nhom: product.nhom || '', loai: product.hangMuc || product.loai || '', tang: product.tang || '',
    ma_sp: product.ma || '', ten_sp: product.ten || '', thuong_hieu: product.thuongHieu || '', nha_cung_cap: product.ncc || '',
    mo_ta: product.moTa || '', kich_thuoc: product.kichThuoc || '', hinh_anh: product.hinhAnh || '', dvt: product.dvt || 'Cái',
    phong: product.khuVuc || '', ma_so_ban_ve: product.maBanVe || '',
    so_luong: sl, gia_ban_le: von, ck_dai_ly_pct: Number(product.chietKhau) || 0, loi_nhuan_pct: ln,
    gia_dai_ly: c.giaDaiLy, gia_ban: c.ban, ck_khach_hang_pct: Number(product.ckKhach) || 0, don_gia: c.donGia,
    thanh_tien: c.thanhTien, markup_pct: c.markup, margin_pct: c.margin, loi_nhuan_vnd: c.lnVnd,
    trang_thai: product.trangThai || '', ghi_chu: product.ghiChu || '', tu_nhap: Number(product.tuNhap) || 0, da_luu_dm: Number(product.daLuuDM) || 0,
    extra: product.extra || null
  };
  const res = await supa.insert('db_bao_gia', row);
  return lineToObj(res[0]);
}
function addBlankLine(maDA, opts) {
  opts = opts || {};
  return addLine(maDA, { ten: 'Hạng mục mới', dvt: 'Cái', donGiaVon: 0, donGiaBan: 0, tang: opts.tang || '', nhom: opts.nhom || '' }, 0);
}
const LINE_MAP = { nhom: 'nhom', loai: 'loai', tang: 'tang', ten: 'ten_sp', thuongHieu: 'thuong_hieu', ncc: 'nha_cung_cap',
  moTa: 'mo_ta', kichThuoc: 'kich_thuoc', hinhAnh: 'hinh_anh', dvt: 'dvt', khuVuc: 'phong', maBanVe: 'ma_so_ban_ve',
  maSP: 'ma_sp', trangThai: 'trang_thai', ghiChu: 'ghi_chu' };
async function updateLine(lineId, fields) {
  fields = fields || {};
  const cur = (await supa.select('db_bao_gia', { filter: supa.eq('id', lineId), limit: 1 }))[0];
  if (!cur) return null;
  const patch = {};
  Object.keys(LINE_MAP).forEach(function (k) { if (fields.hasOwnProperty(k)) patch[LINE_MAP[k]] = fields[k] == null ? '' : fields[k]; });
  if (fields.hasOwnProperty('tuNhap')) patch.tu_nhap = Number(fields.tuNhap) || 0;
  if (fields.hasOwnProperty('daLuuDM')) patch.da_luu_dm = Number(fields.daLuuDM) || 0;
  if (fields.hasOwnProperty('stt')) { patch.sort_no = Number(fields.stt) || 0; patch.stt = String(fields.stt); }
  if (fields.hasOwnProperty('extra')) patch.extra = fields.extra || null;
  const sl = fields.hasOwnProperty('soLuong') ? Number(fields.soLuong) || 0 : n(cur.so_luong);
  const von = fields.hasOwnProperty('donGiaVon') ? n(fields.donGiaVon) : n(cur.gia_ban_le);
  const ckDaiLy = fields.hasOwnProperty('chietKhau') ? Number(fields.chietKhau) || 0 : n(cur.ck_dai_ly_pct);
  const ckKhach = fields.hasOwnProperty('ckKhach') ? Number(fields.ckKhach) || 0 : n(cur.ck_khach_hang_pct);
  let ln = fields.hasOwnProperty('lnPct') ? Number(fields.lnPct) || 0 : n(cur.loi_nhuan_pct);
  let ban = null;
  if (fields.hasOwnProperty('donGiaBan')) { ban = n(fields.donGiaBan); ln = von > 0 ? Math.round((ban - von) / von * 100) : 0; }
  const c = calc_(von, ckDaiLy, ln, ban, ckKhach, sl);
  Object.assign(patch, { so_luong: sl, gia_ban_le: von, ck_dai_ly_pct: ckDaiLy, loi_nhuan_pct: ln, gia_dai_ly: c.giaDaiLy,
    gia_ban: c.ban, ck_khach_hang_pct: ckKhach, don_gia: c.donGia, thanh_tien: c.thanhTien, markup_pct: c.markup, margin_pct: c.margin, loi_nhuan_vnd: c.lnVnd });
  const res = await supa.update('db_bao_gia', supa.eq('id', lineId), patch);
  return res[0] ? lineToObj(res[0]) : null;
}
async function deleteLine(lineId) { await supa.remove('db_bao_gia', supa.eq('id', lineId)); return { ok: true }; }

/*** ===== KHÁI TOÁN (khai_toan) ===== ***/
async function getCover(maDA) {
  const rows = await supa.select('khai_toan', { filter: supa.eq('ma_da', maDA), order: 'sort_no.asc', limit: 2000 });
  return rows.map(function (r) { return { stt: s(r.stt), hangMuc: s(r.hang_muc), moTa: s(r.mo_ta), chiPhi: n(r.chi_phi) }; });
}
function buildCoverFromTemplate() { return larkStore.buildCoverFromTemplate(); }
async function getCoverOrInit(maDA) {
  const cur = await getCover(maDA);
  if (cur.length) return cur;
  return buildCoverFromTemplate();
}
async function saveCover(maDA, rows) {
  await supa.remove('khai_toan', supa.eq('ma_da', maDA));
  const arr = (rows || []).map(function (r, i) { return { ma_da: maDA, stt: s(r.stt), hang_muc: s(r.hangMuc), mo_ta: s(r.moTa), chi_phi: n(r.chiPhi), sort_no: i }; });
  if (arr.length) await supa.insert('khai_toan', arr);
  return { ok: true, count: arr.length };
}

/*** ===== SP MỚI / ẢNH ===== ***/
const DB_NUM = ['CÔNG SUẤT (W)', 'NHIỆT ĐỘ MÀU (K)', 'QUANG THÔNG (lm)', 'GÓC CHIẾU (°)', 'GÓC NGHIÊNG (°)',
  'CHIỀU CAO (mm)', 'ĐƯỜNG KÍNH (mm)', 'LỖ KHOÉT TRẦN (mm)', 'HIỆU SUẤT PHÁT QUANG (lm/W)', 'DÒNG RA TỐI ĐA (mA)',
  'BẢO HÀNH (năm)', 'GIÁ BÁN LẺ', 'CHIẾT KHẤU ĐẠI LÝ (%)'];
const DB_LABEL2COL = {
  'MÃ SẢN PHẨM': 'ma_sp', 'TÊN SẢN PHẨM': 'ten_sp', 'DÒNG SẢN PHẨM': 'dong_sp', 'HẠNG MỤC': 'hang_muc', 'NHÓM SẢN PHẨM': 'nhom_sp',
  'THƯƠNG HIỆU': 'thuong_hieu', 'NHÀ CUNG CẤP': 'nha_cung_cap', 'CÔNG SUẤT (W)': 'cong_suat_w', 'NHIỆT ĐỘ MÀU (K)': 'nhiet_do_mau_k',
  'QUANG THÔNG (lm)': 'quang_thong_lm', 'GÓC CHIẾU (°)': 'goc_chieu_deg', 'GÓC NGHIÊNG (°)': 'goc_nghieng_deg', 'MÀU SẮC': 'mau_sac',
  'CHẤT LIỆU': 'chat_lieu', 'CHIỀU CAO (mm)': 'chieu_cao_mm', 'ĐƯỜNG KÍNH (mm)': 'duong_kinh_mm', 'LỖ KHOÉT TRẦN (mm)': 'cutout_mm',
  'CHỈ SỐ IP': 'chi_so_ip', 'CRI': 'cri', 'HIỆU SUẤT PHÁT QUANG (lm/W)': 'hieu_suat_lm_w', 'UGR': 'ugr', 'SDCM': 'sdcm', 'COI': 'coi',
  'TUỔI THỌ': 'tuoi_tho', 'LOẠI CHIP LED': 'loai_chip_led', 'CẤP BẢO VỆ ĐIỆN': 'class_rating', 'LẮP NGUỒN RỜI': 'lap_nguon_roi',
  'TÊN BỘ NGUỒN': 'ten_bo_nguon', 'MÃ BỘ NGUỒN': 'ma_bo_nguon', 'HÃNG BỘ NGUỒN': 'hang_bo_nguon', 'VỊ TRÍ LẮP NGUỒN': 'vi_tri_lap_nguon',
  'TƯƠNG THÍCH ĐIỀU KHIỂN': 'dieu_khien', 'DÒNG RA TỐI ĐA (mA)': 'dong_ra_max_ma', 'BẢO HÀNH (năm)': 'bao_hanh_nam', 'ĐƠN VỊ TÍNH': 'dvt',
  'GIÁ BÁN LẺ': 'gia_ban_le', 'CHIẾT KHẤU ĐẠI LÝ (%)': 'ck_dai_ly_pct', 'ẢNH SẢN PHẨM': 'anh_sp', 'LINK DATASHEET': 'link_datasheet',
  'TRẠNG THÁI': 'trang_thai', 'GHI CHÚ': 'ghi_chu'
};
async function saveDbProduct(data) {
  data = data || {};
  const ten = s(data['TÊN SẢN PHẨM']).trim();
  if (!ten) throw new Error('Chưa có Tên sản phẩm.');
  const row = {};
  Object.keys(data).forEach(function (label) {
    const col = DB_LABEL2COL[label]; if (!col) return;
    let v = data[label]; if (v == null || v === '') return;
    if (label === 'LẮP NGUỒN RỜI') v = /^(có|yes|true|1|x)$/i.test(String(v));
    else if (DB_NUM.indexOf(label) >= 0) v = n(v);
    row[col] = v;
  });
  const ma = s(data['MÃ SẢN PHẨM']).trim();
  if (ma) {
    const ex = await supa.select('db_san_pham', { select: 'id', filter: supa.eq('ma_sp', ma), limit: 1 });
    if (ex.length) { await supa.update('db_san_pham', supa.eq('ma_sp', ma), row); _cache = null; return { updated: true, ma: ma, ten: ten }; }
  }
  await supa.insert('db_san_pham', row); _cache = null;
  return { created: true, ma: ma, ten: ten };
}
async function deleteDbProduct(key) {
  key = s(key).trim(); if (!key) throw new Error('Thiếu mã/ID sản phẩm.');
  const filter = /^\d+$/.test(key) ? supa.eq('id', key) : supa.eq('ma_sp', key);
  await supa.remove('db_san_pham', filter); _cache = null;
  return { ok: true };
}
async function saveLineAsProduct(p) {
  p = p || {};
  const data = { 'TÊN SẢN PHẨM': p.ten, 'MÃ SẢN PHẨM': p.ma, 'DÒNG SẢN PHẨM': p.nhom, 'HẠNG MỤC': p.hangMuc,
    'THƯƠNG HIỆU': p.thuongHieu, 'NHÀ CUNG CẤP': p.ncc, 'ĐƠN VỊ TÍNH': p.dvt, 'GIÁ BÁN LẺ': p.gia != null ? p.gia : p.donGiaBan,
    'GHI CHÚ': p.moTa, 'ẢNH SẢN PHẨM': p.hinhAnh };
  const r = await saveDbProduct(data);
  return Object.assign({ ten: p.ten, ma: s(p.ma), thuongHieu: s(p.thuongHieu), ncc: s(p.ncc), nhom: s(p.nhom),
    hangMuc: s(p.hangMuc), dvt: s(p.dvt) || 'Cái', donGiaVon: n(p.gia), donGiaBan: n(p.gia), hinhAnh: s(p.hinhAnh) }, r);
}
async function uploadImage(base64, fileName) {
  const raw = s(base64).replace(/^data:([^;]+);base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) throw new Error('Ảnh rỗng.');
  const m = /^data:([^;]+);base64,/.exec(s(base64)); const ct = m ? m[1] : 'image/jpeg';
  const ext = (ct.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const path = 'sp/' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.' + ext;
  const url = await supa.uploadToStorage(buf, path, ct);
  return { token: url, url: url };
}

/*** ===== DASHBOARD / QUOTE / BOOTSTRAP ===== ***/
async function getDashboard() {
  const projects = await getProjects();
  return { projects: projects, count: projects.length };
}
async function getQuote(maDA) {
  const lines = await getLines(maDA);
  const proj = await getProject(maDA);
  let subtotal = 0; lines.forEach(function (l) { subtotal += n(l.thanhTienBan); });
  const vatPct = proj ? n(proj.vat) : 0;
  const vat = round0_(subtotal * vatPct / 100);
  return { maDA: maDA, project: proj, lines: lines, subtotal: subtotal, vatPct: vatPct, vat: vat, total: subtotal + vat };
}
async function bootstrap(maDA) {
  const [projects, products] = await Promise.all([getProjects(), getProducts()]);
  let lines = [];
  if (maDA) { try { lines = await getLines(maDA); } catch (e) { lines = []; } }
  const catSheets = getCatalogSheetsFrom_(products);
  return { projects: projects, products: products, lines: lines, catSheets: catSheets, sheetCols: [] };
}
function getCatalogSheetsFrom_(products) {
  const seen = {}, out = [];
  products.forEach(function (p) { if (p.nhom && !seen[p.nhom]) { seen[p.nhom] = 1; out.push(p.nhom); } });
  return out;
}

/*** ===== IMPORT (tái dùng parse của store.js) ===== ***/
function importParse(base64, ext) { return larkStore.importParse(base64, ext); }
async function importCommit(products) {
  const arr = (products || []).map(function (p) {
    return { ma_sp: s(p.ma), ten_sp: s(p.ten), dong_sp: s(p.nhom), hang_muc: s(p.hangMuc), thuong_hieu: s(p.thuongHieu),
      nha_cung_cap: s(p.ncc), dvt: s(p.dvt) || 'Cái', gia_ban_le: n(p.gia), ghi_chu: s(p.moTa), anh_sp: s(p.hinhAnh) };
  }).filter(function (r) { return r.ten_sp; });
  if (arr.length) await supa.insert('db_san_pham', arr);
  _cache = null;
  return { inserted: arr.length };
}

module.exports = {
  bootstrap, buildCatalog, getProducts, getCatalogSheets, getProjects, getProject, createProject, updateProject, deleteProject,
  getLines, addLine, addBlankLine, updateLine, deleteLine, saveLineAsProduct, saveDbProduct, deleteDbProduct, uploadImage,
  getCover, saveCover, buildCoverFromTemplate, getCoverOrInit, getDashboard, getQuote, importParse, importCommit
};
