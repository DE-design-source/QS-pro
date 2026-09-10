'use strict';
/************************************************************
 * QS PRO — Tầng dữ liệu trên SUPABASE (Postgres REST).
 * Thay cho store.js (Lark). Giữ nguyên interface cho registry.
 ************************************************************/
const supa = require('./supa');
const tenant = require('./tenant');
const larkStore = require('./store');   // tái dùng hàm thuần: importParse, cover template, export helpers

/*** ===== HELPERS ===== ***/
function n(v) { if (v == null || v === '') return 0; var x = Number(v); return isNaN(x) ? 0 : x; }
function round0_(v) { return Math.round(n(v)); }
function s(v) { return v == null ? '' : String(v); }
function nowIso() { return new Date().toISOString(); }
function firstImg(v) { var a = s(v).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); return a[0] || ''; }
function fmtUnit(v, unit) { if (v == null || v === '') return ''; var t = String(v); return new RegExp(unit + '$', 'i').test(t) ? t : t + unit; }
function fmtList(v, unit) { return s(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return new RegExp(unit + '$', 'i').test(x) ? x : x + unit; }).join(', '); }

// Lỗ khoét: cho nhập tự do (Ø75 · Ø40×78 · 60×60). Chỉ thêm Ø/mm khi người dùng CHƯA gõ.
function fmtCutout_(v) {
  var t = s(v).trim(); if (!t) return '';
  if (/^[\d.,]+$/.test(t)) return 'Ø' + t + 'mm';          // chỉ có số -> đường kính tròn
  if (!/mm$/i.test(t)) t += 'mm';                            // có ký hiệu (× x *) -> giữ nguyên, thêm mm
  return t;
}

/*** ===== SẢN PHẨM (db_san_pham) ===== ***/
function prodToObj(r) {
  const congSuat = fmtUnit(r.cong_suat_w, 'W'), nhietDo = fmtList(r.nhiet_do_mau_k, 'K'), gocChieu = fmtList(r.goc_chieu_deg, '°');
  const cri = s(r.cri), chip = s(r.loai_chip_led), chipTen = s(r.ten_chip_led), dong = s(r.dong_sp), qt = r.quang_thong_lm ? (r.quang_thong_lm + 'lm') : '';
  const chipTxt = [chipTen, chip].filter(Boolean).join(' · ');   // "Bridgelux · COB"
  const chatLieu = s(r.chat_lieu), chieuCao = fmtUnit(r.chieu_cao_mm, 'mm'), duongKinh = r.duong_kinh_mm ? ('Ø' + r.duong_kinh_mm + 'mm') : '', gocNghieng = fmtList(r.goc_nghieng_deg, '°');
  // "Thông tin chính" = gộp thông số cốt lõi (hiện ở cột bảng bóc tách)
  const ttc = [];
  if (dong) ttc.push('Dòng SP: ' + dong);
  if (chipTxt) ttc.push('Chip LED: ' + chipTxt + (cri ? ', CRI ' + cri : ''));
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
    gocNghieng: gocNghieng, loKhoet: fmtCutout_(r.cutout_mm),
    capBaoVe: s(r.chi_so_ip), cri: cri, hieuSuat: r.hieu_suat_lm_w ? (r.hieu_suat_lm_w + ' lm/W') : '',
    ugr: s(r.ugr), sdcm: s(r.sdcm), coi: s(r.coi), tuoiTho: s(r.tuoi_tho), chipLed: chip, tenChip: chipTen,
    quangThong: qt, baoHanh: r.bao_hanh_nam ? (r.bao_hanh_nam + ' năm') : '',
    tenBoNguon: s(r.ten_bo_nguon), maBoNguon: s(r.ma_bo_nguon), hangBoNguon: s(r.hang_bo_nguon),
    viTriNguon: s(r.vi_tri_lap_nguon), tuongThich: s(r.dieu_khien), dongRa: r.dong_ra_max_ma ? (r.dong_ra_max_ma + 'mA') : '',
    lapNguonRoi: r.lap_nguon_roi ? 'Có' : '', capBaoVeDien: s(r.class_rating), linkDatasheet: s(r.link_datasheet),
    kichThuoc: thongSoTK, size: size,
    dvt: s(r.dvt) || 'Cái', hinhAnh: firstImg(r.anh_sp), anhTatCa: s(r.anh_sp), moTa: moTa,
    giaBanLe: n(r.gia_ban_le), ckDaiLy: n(r.ck_dai_ly_pct),   // để sửa TRỰC TIẾP trong bảng Danh sách SP
    donGiaVon: n(r.gia_dai_ly), donGiaBan: n(r.gia_dai_ly), lnPct: 0, recordId: r.id, ngayCapNhat: s(r.ngay_cap_nhat),
    // Giá trị GỐC của TẤT CẢ trường trong form Nhập — để bảng Danh sách SP hiển thị/sửa
    // được đúng bộ cột như form (hiển thị là '12W'/'4000K' nhưng DB lưu '12'/'4000').
    daDuyet: r.da_duyet === true, nguoiDuyet: s(r.nguoi_duyet), ngayDuyet: s(r.ngay_duyet),
    nguoiTao: s(r.nguoi_tao), ngayTao: s(r.ngay_tao), nguoiSua: s(r.nguoi_sua),
    raw: rawCols_(r)
  };
}
// Bộ cột "thô" gửi kèm mỗi sản phẩm = đúng các trường của form Nhập (bỏ ảnh vì đã có ở hinhAnh
// và chuỗi rất dài). Nhờ vậy bảng Danh sách SP sinh cột thẳng từ danh sách trường, không lệch nhau.
let _rawCols = null;
function rawCols_(r) {
  if (!_rawCols) _rawCols = Object.keys(DB_LABEL2COL).map(function (k) { return DB_LABEL2COL[k]; })
    .filter(function (c) { return c !== 'anh_sp'; });
  const o = {};
  _rawCols.forEach(function (c) {
    if (c === 'lap_nguon_roi') { o[c] = r[c] ? 'Có' : ''; return; }
    const v = r[c]; o[c] = (v == null) ? '' : String(v);
  });
  return o;
}
let _cache = null, _cacheAt = 0;
// Công ty có được dùng kho SP chung của Dezon không? -> trả id công ty Dezon
async function spChungId_() {
  const t = tenant.tenantId(); if (!t) return null;          // super admin xem toàn hệ thống
  const me = (await supa.select('cong_ty', { filter: supa.eq('id', t), limit: 1, noScope: true }))[0];
  if (!me || me.dung_sp_dezon !== true) return null;
  const dz = (await supa.select('cong_ty', { filter: supa.eq('ma', 'dezon'), limit: 1, noScope: true }))[0];
  if (!dz || String(dz.id) === String(t)) return null;        // chính Dezon thì thôi
  return dz.id;
}
async function getProducts() {
  const rows = await supa.select('db_san_pham', { select: '*', order: 'ten_sp.asc', limit: 5000 });
  const out = rows.map(prodToObj);
  // Kèm KHO CHUNG của Dezon (chỉ đọc) nếu công ty được bật quyền dùng
  try {
    const dzId = await spChungId_();
    if (dzId) {
      const shared = await supa.select('db_san_pham', {
        select: '*', filter: supa.eq('cong_ty_id', dzId), order: 'ten_sp.asc', limit: 5000, noScope: true });
      const has = {}; out.forEach(function (p) { has[p.ma + '|' + p.congSuat + '|' + p.nhietDo + '|' + p.gocChieu + '|' + p.mauSac] = 1; });
      shared.forEach(function (r) {
        const o = prodToObj(r);
        if (has[o.ma + '|' + o.congSuat + '|' + o.nhietDo + '|' + o.gocChieu + '|' + o.mauSac]) return;  // SP riêng đè kho chung
        o.spChung = true;          // đánh dấu: của kho chung, KHÔNG cho sửa/xoá
        out.push(o);
      });
      out.sort(function (a, b) { return String(a.ten).localeCompare(String(b.ten), 'vi'); });
    }
  } catch (e) { /* chưa có cột dung_sp_dezon -> bỏ qua */ }
  await stampYeuThich_(out);         // đánh dấu sản phẩm yêu thích của công ty
  await stampCombo_(out);            // đếm số SP đi kèm (combo)
  _cache = out; _cacheAt = Date.now();
  return out;
}
// Chặn sửa/xoá sản phẩm thuộc KHO CHUNG (không phải của công ty mình)
async function guardSpChung_(key) {
  const t = tenant.tenantId(); if (!t) return;               // super admin: cho phép
  const filter = /^\d+$/.test(String(key)) ? supa.eq('id', key) : supa.eq('ma_sp', key);
  const r = (await supa.select('db_san_pham', { select: 'id,cong_ty_id', filter: filter, limit: 1, noScope: true }))[0];
  if (r && String(r.cong_ty_id) !== String(t))
    throw new Error('Sản phẩm thuộc kho chung của Dezon — không sửa/xoá được. Hãy tạo bản sao riêng cho công ty bạn.');
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
  nhuCau: 'nhu_cau', phanKhuc: 'phan_khuc', maBaoGia: 'ma_bao_gia', nhomTuTao: 'nhom_tu_tao', tangTuTao: 'tang_tu_tao',
  tenBanNhap: 'ten_ban_nhap' };
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
// Nhân bản 1 bản nháp: copy nguyên project (mã mới) + toàn bộ dòng bóc tách + tờ bìa
async function duplicateProject(maDA, opts) {
  opts = opts || {};
  const cpBoc = opts.boc !== false;      // mặc định copy dòng bóc tách
  const cpCover = opts.cover !== false;  // mặc định copy tờ bìa
  const src = (await supa.select('du_an', { filter: supa.eq('ma_da', maDA), limit: 1 }))[0];
  if (!src) throw new Error('Không tìm thấy bản nháp nguồn');
  const newMa = genMaDA_();
  const projRow = Object.assign({}, src);
  delete projRow.id;
  projRow.ma_da = newMa; projRow.ngay_tao = nowIso(); projRow.cap_nhat = nowIso();
  const proj = (await supa.insert('du_an', projRow))[0];
  // copy dòng bóc tách (tuỳ chọn)
  if (cpBoc) {
    const lines = await supa.select('db_bao_gia', { select: '*', filter: supa.eq('ma_du_an', maDA), order: 'sort_no.asc', limit: 5000 });
    if (lines.length) {
      const rows = lines.map(function (r) { const o = Object.assign({}, r); delete o.id; delete o.created_at; o.ma_du_an = newMa; return o; });
      await supa.insert('db_bao_gia', rows);
    }
  }
  // copy tờ bìa (khái toán) nếu có (tuỳ chọn)
  if (cpCover) try {
    const cover = await supa.select('khai_toan', { select: '*', filter: supa.eq('ma_da', maDA), limit: 2000 });
    if (cover.length) {
      const crows = cover.map(function (r) { const o = Object.assign({}, r); delete o.id; delete o.created_at; o.ma_da = newMa; return o; });
      await supa.insert('khai_toan', crows);
    }
  } catch (e) { /* best-effort */ }
  return projToObj(proj);
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
    ckKhach: n(r.ck_khach_hang_pct), donGia: n(r.don_gia),   // đơn giá NET (sau CK khách) — dùng cho xuất để đơn giá×SL = thành tiền
    giamGiaNcc: n(r.giam_gia_ncc_pct),   // % giảm giá từ NCC khi mua hàng (lưu trên dòng để copy theo)
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
  if (fields.hasOwnProperty('giamGiaNcc')) patch.giam_gia_ncc_pct = Number(fields.giamGiaNcc) || 0;
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
  // Chỉ tính lại giá bán từ %LN khi trường giá thật sự đổi (donGiaBan/lnPct/donGiaVon).
  // Nếu chỉ sửa trường khác (khu vực, ghi chú...) thì GIỮ nguyên giá bán đã lưu — tránh trôi giá do %LN đã làm tròn.
  else if (!fields.hasOwnProperty('lnPct') && !fields.hasOwnProperty('donGiaVon')) { ban = n(cur.gia_ban); }
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
// Nạp mẫu tờ bìa + tự cộng chi phí theo nhóm (đọc dòng từ Supabase, KHÔNG gọi Lark)
async function buildCoverFromTemplate(maDA) {
  const tmpl = larkStore._COVER_TEMPLATE || [];
  const norm = larkStore._normalize || function (x) { return String(x || '').toUpperCase(); };
  const byNhom = {};
  if (maDA) {
    const lines = await getLines(maDA);
    lines.forEach(function (l) { const k = norm(l.nhom); byNhom[k] = (byNhom[k] || 0) + n(l.thanhTienBan); });
  }
  return tmpl.map(function (t) {
    let chiPhi = 0;
    if (t[3]) String(t[3]).split(',').forEach(function (nm) { chiPhi += byNhom[norm(nm.trim())] || 0; });
    return { stt: t[0], hangMuc: t[1], moTa: t[2], chiPhi: chiPhi };
  });
}
async function getCoverOrInit(maDA) {
  const cur = await getCover(maDA);
  if (cur.length) return cur;
  return buildCoverFromTemplate(maDA);
}
async function saveCover(maDA, rows) {
  await supa.remove('khai_toan', supa.eq('ma_da', maDA));
  const arr = (rows || []).map(function (r, i) { return { ma_da: maDA, stt: s(r.stt), hang_muc: s(r.hangMuc), mo_ta: s(r.moTa), chi_phi: n(r.chiPhi), sort_no: i }; });
  if (arr.length) await supa.insert('khai_toan', arr);
  return { ok: true, count: arr.length };
}

/*** ===== SP MỚI / ẢNH ===== ***/
// Các trường ÉP KIỂU SỐ khi lưu. CHỈ liệt kê cột thật sự là numeric trong DB —
// nhiet_do_mau_k / goc_chieu_deg / goc_nghieng_deg / cong_suat_w / cutout_mm đều là TEXT
// (cho nhập "3000, 4000", "2×5W", "24°/38°"); ép n() sẽ biến các giá trị đó thành 0 -> MẤT DỮ LIỆU.
const DB_NUM = ['QUANG THÔNG (lm)',
  'CHIỀU CAO (mm)', 'ĐƯỜNG KÍNH (mm)', 'HIỆU SUẤT PHÁT QUANG (lm/W)', 'DÒNG RA TỐI ĐA (mA)',
  'BẢO HÀNH (năm)', 'GIÁ BÁN LẺ', 'CHIẾT KHẤU ĐẠI LÝ (%)', 'GIÁ BÁN BỘ NGUỒN'];
const DB_LABEL2COL = {
  'MÃ SẢN PHẨM': 'ma_sp', 'TÊN SẢN PHẨM': 'ten_sp', 'DÒNG SẢN PHẨM': 'dong_sp', 'HẠNG MỤC': 'hang_muc', 'NHÓM SẢN PHẨM': 'nhom_sp',
  'THƯƠNG HIỆU': 'thuong_hieu', 'NHÀ CUNG CẤP': 'nha_cung_cap', 'CÔNG SUẤT (W)': 'cong_suat_w', 'NHIỆT ĐỘ MÀU (K)': 'nhiet_do_mau_k',
  'QUANG THÔNG (lm)': 'quang_thong_lm', 'GÓC CHIẾU (°)': 'goc_chieu_deg', 'GÓC NGHIÊNG (°)': 'goc_nghieng_deg', 'MÀU SẮC': 'mau_sac',
  'CHẤT LIỆU': 'chat_lieu', 'CHIỀU CAO (mm)': 'chieu_cao_mm', 'ĐƯỜNG KÍNH (mm)': 'duong_kinh_mm', 'LỖ KHOÉT TRẦN (mm)': 'cutout_mm',
  'CHỈ SỐ IP': 'chi_so_ip', 'CRI': 'cri', 'HIỆU SUẤT PHÁT QUANG (lm/W)': 'hieu_suat_lm_w', 'UGR': 'ugr', 'SDCM': 'sdcm', 'COI': 'coi',
  'TUỔI THỌ': 'tuoi_tho', 'TÊN CHIP LED': 'ten_chip_led', 'LOẠI CHIP LED': 'loai_chip_led', 'CẤP BẢO VỆ ĐIỆN': 'class_rating', 'LẮP NGUỒN RỜI': 'lap_nguon_roi',
  'TÊN BỘ NGUỒN': 'ten_bo_nguon', 'MÃ BỘ NGUỒN': 'ma_bo_nguon', 'HÃNG BỘ NGUỒN': 'hang_bo_nguon', 'GIÁ BÁN BỘ NGUỒN': 'gia_ban_bo_nguon', 'VỊ TRÍ LẮP NGUỒN': 'vi_tri_lap_nguon',
  'TƯƠNG THÍCH ĐIỀU KHIỂN': 'dieu_khien', 'DÒNG RA TỐI ĐA (mA)': 'dong_ra_max_ma', 'BẢO HÀNH (năm)': 'bao_hanh_nam', 'ĐƠN VỊ TÍNH': 'dvt',
  'GIÁ BÁN LẺ': 'gia_ban_le', 'CHIẾT KHẤU ĐẠI LÝ (%)': 'ck_dai_ly_pct', 'ẢNH SẢN PHẨM': 'anh_sp', 'LINK DATASHEET': 'link_datasheet',
  'TRẠNG THÁI': 'trang_thai', 'GHI CHÚ': 'ghi_chu'
};
// Migration chạy tay -> nếu DB chưa có cột thì đổi lỗi kỹ thuật thành hướng dẫn cụ thể
const COL_SQL = { ten_chip_led: 'db/chip_name.sql', gia_ban_bo_nguon: 'db/gia_bo_nguon.sql', da_duyet: 'db/sp_duyet_status.sql',
  nguoi_duyet: 'db/sp_duyet_status.sql', ngay_duyet: 'db/sp_duyet_status.sql' };
function colErr_(e) {
  const m = (e && e.message) || '';
  for (const col in COL_SQL) {
    if (m.indexOf(col) >= 0 && /(column|schema cache)/i.test(m))
      return new Error('Cơ sở dữ liệu chưa có cột "' + col + '". Vào Supabase → SQL Editor chạy file ' + COL_SQL[col] + ' rồi thử lại.');
  }
  return e;
}
// Chưa chạy db/sp_nguoi_tao.sql thì bỏ qua 3 cột này, KHÔNG chặn việc lưu sản phẩm
let _hasWhoCol = null;
function whoColMissing_(e) {
  const m = (e && e.message) || '';
  return /(nguoi_tao|ngay_tao|nguoi_sua)/.test(m) && /(column|schema cache|PGRST204)/i.test(m);
}
// Ghi 1 hoặc nhiều dòng lịch sử cho sản phẩm (nuốt lỗi — nhật ký không được chặn nghiệp vụ)
async function spHistory_(actor, ma, changes) {
  if (!changes || !changes.length) return;
  try {
    await supa.insert('db_san_pham_history', changes.map(function (c) {
      return { ma_sp: s(ma), field: c.field, old_value: s(c.old), new_value: s(c.new),
        changed_by: (actor && actor.uid) || null, changed_by_name: (actor && (actor.u || actor.username)) || 'ẩn danh' };
    }));
  } catch (e) { console.warn('[product history]', e && e.message); }
}
async function saveDbProduct(actor, data, opts) {
  opts = opts || {};
  // Tương thích ngược: vài chỗ trong server vẫn gọi saveDbProduct(data)
  if (data === undefined && actor && typeof actor === 'object' && !actor.uid && !actor.u) { data = actor; actor = null; }
  data = data || {};
  const who = (actor && (actor.u || actor.username)) || '';
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
  // Khoá trùng = MÃ SP + các trục BIẾN THỂ (nhiệt độ màu / công suất / góc chiếu).
  // Nhờ vậy cùng mã nhưng khác nhiệt độ màu sẽ là 2 SẢN PHẨM RIÊNG (biến thể), không ghi đè nhau.
  if (ma) {
    let filter = supa.eq('ma_sp', ma);
    ['nhiet_do_mau_k', 'cong_suat_w', 'goc_chieu_deg', 'mau_sac'].forEach(function (col) {
      const v = row[col];
      filter += '&' + (v == null || v === '' ? col + '=is.null' : supa.eq(col, v));
    });
    const ex = await supa.select('db_san_pham', { select: 'id', filter: filter, limit: 1 });
    if (ex.length) {
      if (who && _hasWhoCol !== false) { row.nguoi_sua = who; row.ngay_cap_nhat = new Date().toISOString(); }
      try { await supa.update('db_san_pham', supa.eq('id', ex[0].id), row); }
      catch (e) { if (whoColMissing_(e)) { delete row.nguoi_sua; await supa.update('db_san_pham', supa.eq('id', ex[0].id), row); } else throw colErr_(e); }
      _cache = null;
      await spHistory_(actor, ma, [{ field: 'CẬP NHẬT (nhập liệu)', old: '', new: ten }]);
      if (!opts.noAudit) await logAudit_(actor, 'cap_nhat_sp', 'Cập nhật SP ' + ma + ' (' + ten + ') qua form Nhập dữ liệu');
      return { updated: true, ma: ma, ten: ten, id: ex[0].id };
    }
  }
  if (who && _hasWhoCol !== false) { row.nguoi_tao = who; row.ngay_tao = new Date().toISOString(); }
  let res;
  try { res = await supa.insert('db_san_pham', row); }
  catch (e) {
    if (whoColMissing_(e)) { delete row.nguoi_tao; delete row.ngay_tao; _hasWhoCol = false; res = await supa.insert('db_san_pham', row); }
    else throw colErr_(e);
  }
  _cache = null;
  await spHistory_(actor, ma || ten, [{ field: 'TẠO SẢN PHẨM', old: '', new: ten + (who ? ' (bởi ' + who + ')' : '') }]);
  if (!opts.noAudit) await logAudit_(actor, 'them_sp', 'Thêm SP mới ' + (ma || '') + ' (' + ten + ')');
  return { created: true, ma: ma, ten: ten, id: res && res[0] && res[0].id };
}
async function deleteDbProduct(actor, key) {
  // Tương thích ngược: có nơi gọi deleteDbProduct(key) không kèm actor
  if (key === undefined && (typeof actor === 'string' || typeof actor === 'number')) { key = actor; actor = null; }
  await guardSpChung_(key);
  key = s(key).trim(); if (!key) throw new Error('Thiếu mã/ID sản phẩm.');
  const cur = await getDbProduct(key);
  const filter = /^\d+$/.test(key) ? supa.eq('id', key) : supa.eq('ma_sp', key);
  await supa.remove('db_san_pham', filter); _cache = null;
  if (cur) {
    try {
      await supa.insert('db_san_pham_history', { ma_sp: s(cur.ma_sp), field: 'XOÁ SẢN PHẨM',
        old_value: s(cur.ten_sp), new_value: '', changed_by: (actor && actor.uid) || null,
        changed_by_name: (actor && actor.u) || 'ẩn danh' });
    } catch (e) { console.warn('[product history] xoá:', e && e.message); }
    await logAudit_(actor, 'xoa_sp', 'Xoá SP ' + s(cur.ma_sp) + ' (' + s(cur.ten_sp) + ')');
  }
  return { ok: true, ma: cur ? s(cur.ma_sp) : '', ten: cur ? s(cur.ten_sp) : '' };
}
// Ghi nhật ký hoạt động (bảng audit_log) — nuốt lỗi, không được làm hỏng nghiệp vụ
async function logAudit_(actor, action, detail) {
  try {
    await supa.insert('audit_log', {
      user_id: (actor && actor.uid) || null, username: (actor && (actor.u || actor.username)) || '',
      action: s(action), detail: s(detail)
    });
  } catch (e) { /* nhật ký hỏng không được chặn nghiệp vụ */ }
}
// ===== Cập nhật SP + LƯU LỊCH SỬ (ai, lúc nào, đổi gì) =====
const COL2LABEL = {}; Object.keys(DB_LABEL2COL).forEach(function (lb) { COL2LABEL[DB_LABEL2COL[lb]] = lb; });
// Nhận ID dòng (chính xác 1 BIẾN THỂ). Nếu truyền mã SP thì lấy biến thể đầu (tương thích ngược).
async function getDbProduct(key) {
  key = s(key).trim(); if (!key) return null;
  const filter = /^\d+$/.test(key) ? supa.eq('id', key) : supa.eq('ma_sp', key);
  const rows = await supa.select('db_san_pham', { select: '*', filter: filter, limit: 1 });
  return rows[0] || null;
}
// Chuyển {nhãn: giá trị} -> {cột DB: giá trị đã ép kiểu}
function dataToRow_(data) {
  const row = {};
  Object.keys(data || {}).forEach(function (label) {
    const col = DB_LABEL2COL[label]; if (!col) return;
    let v = data[label];
    if (label === 'LẮP NGUỒN RỜI') v = /^(có|yes|true|1|x)$/i.test(String(v));
    else if (DB_NUM.indexOf(label) >= 0) v = (v === '' || v == null) ? null : n(v);
    else v = (v == null) ? '' : String(v);
    row[col] = v;
  });
  return row;
}
// So sánh dữ liệu gửi lên với sản phẩm đang có -> danh sách trường thật sự đổi.
// Dùng chung cho LƯU THẲNG và GỬI CHỜ DUYỆT nên 2 luồng luôn hiểu giống nhau.
async function diffDbProduct(key, data) {
  const cur = await getDbProduct(key);
  if (!cur) throw new Error('Không tìm thấy sản phẩm.');
  const row = dataToRow_(data);
  const changes = [];
  Object.keys(row).forEach(function (col) {
    const oldS = (cur[col] == null ? '' : String(cur[col]));
    const newS = (row[col] == null ? '' : String(row[col]));
    if (oldS !== newS) changes.push({ field: COL2LABEL[col] || col, old: oldS, new: newS });
  });
  return { cur: cur, row: row, changes: changes };
}
async function updateDbProductTracked(actor, key, data, opts) {
  opts = opts || {};
  key = s(key).trim(); if (!key) throw new Error('Thiếu mã/ID sản phẩm.');
  await guardSpChung_(key);
  const d = await diffDbProduct(key, data);
  const cur = d.cur, row = d.row, changes = d.changes;
  const ma = s(cur.ma_sp);
  if (!changes.length) return { updated: false, changes: 0 };
  row.ngay_cap_nhat = new Date().toISOString();
  if (_hasWhoCol !== false && actor && (actor.u || actor.username)) row.nguoi_sua = (actor.u || actor.username);
  // Nội dung đổi -> phải duyệt lại. Ghi luôn 1 dòng lịch sử cho dễ truy vết.
  if (!opts.giuDuyet && cur.da_duyet === true) {
    row.da_duyet = false; row.nguoi_duyet = null; row.ngay_duyet = null;
    changes.push({ field: 'TRẠNG THÁI DUYỆT', old: 'Đã duyệt', new: 'Chưa duyệt (do sửa lại)' });
  }
  // CHỈ cập nhật ĐÚNG dòng đang sửa (trước đây eq('ma_sp') -> ghi đè MỌI biến thể cùng mã -> lỗi trùng khoá)
  try { await supa.update('db_san_pham', supa.eq('id', cur.id), row); }
  catch (e) { if (whoColMissing_(e)) { _hasWhoCol = false; delete row.nguoi_sua; await supa.update('db_san_pham', supa.eq('id', cur.id), row); } else throw colErr_(e); }
  _cache = null;
  const who = (actor && actor.u) || 'ẩn danh';
  try {
    await supa.insert('db_san_pham_history', changes.map(function (c) {
      return { ma_sp: ma, field: c.field, old_value: c.old, new_value: c.new, changed_by: (actor && actor.uid) || null, changed_by_name: who };
    }));
  } catch (e) { console.warn('[product history] insert lỗi:', e && e.message); }
  if (!opts.noAudit) await logAudit_(actor, opts.auditAction || 'sua_sp',
    (opts.auditPrefix || 'Sửa SP ') + ma + ' (' + s(cur.ten_sp) + '): ' +
    changes.map(function (c) { return c.field; }).join(', '));
  return { updated: true, changes: changes.length, ten: s(cur.ten_sp), ma: ma, id: cur.id,
    daDuyet: row.da_duyet === false ? false : (cur.da_duyet === true) };
}
// Đánh dấu ĐÃ DUYỆT / BỎ DUYỆT cho 1 hoặc nhiều sản phẩm (chỉ tài khoản có quyền duyệt).
// Không đụng tới nội dung SP, chỉ đổi trạng thái + ghi lịch sử.
async function setSpDuyet(actor, keys, approve) {
  keys = Array.isArray(keys) ? keys : [keys];
  const who = (actor && actor.u) || 'ẩn danh';
  const now = new Date().toISOString();
  let ok = 0; const errs = []; const hist = [];
  for (const k of keys) {
    try {
      const cur = await getDbProduct(k);
      if (!cur) { errs.push({ key: k, error: 'Không tìm thấy sản phẩm' }); continue; }
      if ((cur.da_duyet === true) === !!approve) continue;              // đã đúng trạng thái rồi
      await guardSpChung_(k);
      try {
        await supa.update('db_san_pham', supa.eq('id', cur.id), approve
          ? { da_duyet: true, nguoi_duyet: who, ngay_duyet: now }
          : { da_duyet: false, nguoi_duyet: null, ngay_duyet: null });
      } catch (e) { throw colErr_(e); }
      hist.push({ ma_sp: s(cur.ma_sp), field: 'TRẠNG THÁI DUYỆT',
        old: approve ? 'Chưa duyệt' : 'Đã duyệt', new: approve ? 'Đã duyệt' : 'Chưa duyệt',
        ten: s(cur.ten_sp) });
      ok++;
    } catch (e) { if (errs.length < 5) errs.push({ key: k, error: e.message }); }
  }
  if (hist.length) {
    try {
      await supa.insert('db_san_pham_history', hist.map(function (h) {
        return { ma_sp: h.ma_sp, field: h.field, old_value: h.old, new_value: h.new,
          changed_by: (actor && actor.uid) || null, changed_by_name: who };
      }));
    } catch (e) { console.warn('[product history] duyệt:', e && e.message); }
    await logAudit_(actor, approve ? 'duyet_sp' : 'bo_duyet_sp',
      (approve ? 'Duyệt ' : 'Bỏ duyệt ') + ok + ' sản phẩm: ' +
      hist.slice(0, 8).map(function (h) { return h.ma_sp || h.ten; }).join(', ') + (hist.length > 8 ? '…' : ''));
  }
  _cache = null;
  const out = { ok: ok };
  if (errs.length) out.errors = errs;
  return out;
}
/*** ===== SẢN PHẨM YÊU THÍCH =====
 Kho lưu những SP hay dùng để lấy lại cho các dự án sau (yêu cầu trong slide Update QS).
 Đánh dấu theo TỪNG CÔNG TY, bảng riêng — vì SP kho chung của Dezon thuộc tenant khác,
 công ty khác không được ghi vào dòng sản phẩm đó.                                    ***/
async function ytIds_() {
  try {
    const rows = await supa.select('sp_yeu_thich', { select: 'sp_id', limit: 5000 });
    const set = {}; rows.forEach(function (r) { set[String(r.sp_id)] = 1; });
    return set;
  } catch (e) { return null; }          // bảng chưa tạo -> coi như chưa có SP yêu thích nào
}
// Đếm số SP đi kèm của từng sản phẩm -> danh sách/bảng hiện được nhãn "combo N"
// mà không phải mở từng sản phẩm ra xem.
async function stampCombo_(list) {
  let rows = [];
  try { rows = await supa.select('sp_combo', { select: 'sp_id,sp_kem_id', limit: 5000, noScope: true }); }
  catch (e) { return list; }                       // chưa có bảng sp_combo -> bỏ qua
  // đếm CẢ HAI CHIỀU: A kèm B thì cả A lẫn B đều được tính là có combo
  const cnt = {};
  rows.forEach(function (r) {
    const a = String(r.sp_id), b = String(r.sp_kem_id);
    cnt[a] = (cnt[a] || 0) + 1;
    cnt[b] = (cnt[b] || 0) + 1;
  });
  list.forEach(function (p) { p.comboN = cnt[String(p.recordId)] || 0; });
  return list;
}
async function stampYeuThich_(list) {
  const set = await ytIds_(); if (!set) return list;
  list.forEach(function (p) { p.yeuThich = !!set[String(p.recordId)]; });
  return list;
}
// bật/tắt yêu thích cho 1 hoặc nhiều sản phẩm
// tìm SP kể cả trong KHO CHUNG của Dezon — vẫn được đánh dấu yêu thích dù không sửa được
async function findSpAny_(key) {
  const k = s(key).trim(); if (!k) return null;
  const filter = /^\d+$/.test(k) ? supa.eq('id', k) : supa.eq('ma_sp', k);
  const rows = await supa.select('db_san_pham', { select: 'id,ma_sp,ten_sp', filter: filter, limit: 1, noScope: true });
  return rows[0] || null;
}
async function setYeuThich(actor, keys, on) {
  keys = Array.isArray(keys) ? keys : [keys];
  const who = (actor && actor.u) || 'ẩn danh';
  const ct = tenant.tenantId() || null;
  let ok = 0; const errs = [];
  for (const k of keys) {
    try {
      const cur = await findSpAny_(k);
      if (!cur) { errs.push({ key: k, error: 'Không tìm thấy sản phẩm' }); continue; }
      if (on) {
        try {
          // chặn trùng ở tầng app luôn: chỉ mục duy nhất coi NULL là khác nhau nên
          // tài khoản super (không có công ty) vẫn có thể tạo ra nhiều dòng giống hệt.
          const daCo = await supa.select('sp_yeu_thich', { select: 'id',
            filter: supa.eq('sp_id', cur.id) + '&' + (ct ? supa.eq('cong_ty_id', ct) : 'cong_ty_id=is.null'),
            limit: 1, noScope: true });
          if (daCo.length) { ok++; continue; }
          await supa.insert('sp_yeu_thich',
            [{ cong_ty_id: ct, sp_id: cur.id, ma_sp: s(cur.ma_sp), nguoi_tao: who }]);
        } catch (e) {
          if (/duplicate|unique/i.test((e && e.message) || '')) { ok++; continue; }   // đã yêu thích rồi
          throw tblErr_(e, 'sp_yeu_thich', 'db/sp_yeu_thich.sql');
        }
      } else {
        // LUÔN kèm điều kiện công ty: tài khoản super không có ngữ cảnh công ty nên
        // bộ lọc tự động không áp -> nếu chỉ lọc sp_id sẽ xoá luôn dấu yêu thích của MỌI công ty.
        const loc = supa.eq('sp_id', cur.id) + '&' + (ct ? supa.eq('cong_ty_id', ct) : 'cong_ty_id=is.null');
        try { await supa.remove('sp_yeu_thich', loc, { noScope: true }); }
        catch (e) { throw tblErr_(e, 'sp_yeu_thich', 'db/sp_yeu_thich.sql'); }
      }
      ok++;
    } catch (e) { if (errs.length < 5) errs.push({ key: k, error: e.message }); }
  }
  _cache = null;
  const out = { ok: ok };
  if (errs.length) out.errors = errs;
  return out;
}
/*** ===== COMBO: sản phẩm đi kèm ===== ***/
// Trả danh sách SP đi kèm của 1 sản phẩm, kèm thông tin để hiển thị/thêm vào dự án
/* Combo là quan hệ HAI CHIỀU: A kèm B thì mở B cũng phải thấy đang kèm A.
   Mỗi liên kết chỉ lưu 1 dòng (sp_id -> sp_kem_id, so_luong = N), hiểu là
   "1 bộ gồm: 1 sp_id + N sp_kem_id". Vì vậy khi đọc:
     · chiều xuôi  (mình là sp_id)     -> đối tác hiện ×N   (bộ có N cái kia)
     · chiều ngược (mình là sp_kem_id) -> đối tác hiện ×1   (bộ có 1 cái kia)
   Không nhân đôi dữ liệu, xoá liên kết ở bên nào cũng mất ở cả hai bên.        */
async function getCombo(key) {
  const cur = await getDbProduct(key); if (!cur) return [];
  let fw = [], bw = [];
  try {
    fw = await supa.select('sp_combo', { filter: supa.eq('sp_id', cur.id), order: 'sort_no.asc', limit: 100 });
    bw = await supa.select('sp_combo', { filter: supa.eq('sp_kem_id', cur.id), order: 'sort_no.asc', limit: 100 });
  } catch (e) { if (/sp_combo/.test((e && e.message) || '')) return []; throw e; }   // bảng chưa sẵn sàng
  // gộp 2 chiều về 1 danh sách "đối tác", chiều xuôi được ưu tiên nếu trùng
  const seen = {}, link = [];
  fw.forEach(function (r) {
    const id = String(r.sp_kem_id);
    if (id === String(cur.id) || seen[id]) return; seen[id] = 1;
    link.push({ id: r.sp_kem_id, sl: n(r.so_luong) || 1, gc: s(r.ghi_chu), rowId: r.id, nguoc: false });
  });
  bw.forEach(function (r) {
    const id = String(r.sp_id);
    if (id === String(cur.id) || seen[id]) return; seen[id] = 1;
    link.push({ id: r.sp_id, sl: 1, gc: s(r.ghi_chu), rowId: r.id, nguoc: true, boSL: n(r.so_luong) || 1 });
  });
  if (!link.length) return [];
  const ids = link.map(function (x) { return x.id; });
  const sps = await supa.select('db_san_pham', { select: '*', filter: 'id=in.(' + ids.join(',') + ')', limit: 200, noScope: true });
  const by = {}; sps.forEach(function (r) { by[r.id] = r; });
  return link.filter(function (x) { return by[x.id]; }).map(function (x) {
    const o = prodToObj(by[x.id]);
    o.comboSL = x.sl; o.comboGhiChu = x.gc; o.comboId = x.rowId;
    o.comboNguoc = !!x.nguoc;                      // liên kết được đặt từ phía sản phẩm kia
    if (x.nguoc) o.comboBoSL = x.boSL;             // bộ gốc: 1 <sp kia> + boSL <sp này>
    return o;
  });
}
function comboMissing_(e) { const m = (e && e.message) || ''; return /sp_combo/.test(m) && /(does not exist|schema cache|PGRST205|404)/i.test(m); }
// Dịch lỗi Supabase của 1 bảng thành hướng dẫn ĐÚNG nguyên nhân
function tblErr_(e, table, file) {
  const m = (e && e.message) || '';
  if (!new RegExp(table).test(m)) return e;
  if (/42501|row-level security/i.test(m))
    return new Error('Bảng ' + table + ' đang BẬT RLS nên không ghi được. Vào Supabase → SQL Editor chạy: ' +
      'alter table public.' + table + ' disable row level security; ' +
      'grant all on public.' + table + ' to anon, authenticated, service_role;');
  if (/does not exist|schema cache|PGRST205|404/i.test(m))
    return new Error('Chưa có bảng ' + table + '. Vào Supabase → SQL Editor chạy file ' + file + ' rồi thử lại.');
  return e;
}
// Ghi đè toàn bộ danh sách SP đi kèm của 1 sản phẩm
/* Ghi combo cho 1 sản phẩm. Vì liên kết là HAI CHIỀU nhưng chỉ lưu 1 dòng, khi
   lưu ở phía A phải cẩn thận với các liên kết do phía B đặt:
     · liên kết NGƯỢC còn trong danh sách -> GIỮ NGUYÊN dòng cũ (không ghi đè,
       nếu ghi lại sẽ mất số lượng gốc mà bên kia đã đặt)
     · liên kết NGƯỢC bị bỏ khỏi danh sách -> xoá hẳn (bỏ ở bên nào cũng mất cả 2 bên)
     · phần còn lại -> ghi lại theo chiều xuôi như bình thường                      */
async function setCombo(actor, key, items) {
  const cur = await getDbProduct(key); if (!cur) throw new Error('Không tìm thấy sản phẩm.');
  await guardSpChung_(key);
  const goc = Array.isArray(items) ? items : [];
  items = goc.filter(function (x) { return x && x.id && String(x.id) !== String(cur.id); });
  // Chặn XOÁ NHẦM: gửi lên có sản phẩm nhưng không cái nào hợp lệ (sai định dạng, thiếu id)
  // thì đó là lỗi payload, KHÔNG phải ý muốn xoá sạch combo -> báo lỗi thay vì âm thầm xoá.
  if (goc.length && !items.length)
    throw new Error('Danh sách sản phẩm đi kèm không hợp lệ (thiếu id) — không thay đổi combo. Tải lại trang rồi thử lại.');
  const seen = {}; items = items.filter(function (x) { const k = String(x.id); if (seen[k]) return false; seen[k] = 1; return true; });
  const keep = {}; items.forEach(function (x) { keep[String(x.id)] = x; });
  try {
    const bw = await supa.select('sp_combo', { filter: supa.eq('sp_kem_id', cur.id), limit: 100 });
    // 1) liên kết do bên kia đặt, nay bị bỏ -> xoá
    const boDi = bw.filter(function (r) { return !keep[String(r.sp_id)]; }).map(function (r) { return r.id; });
    if (boDi.length) await supa.remove('sp_combo', 'id=in.(' + boDi.join(',') + ')');
    // 2) liên kết do bên kia đặt và vẫn giữ -> để nguyên, không ghi đè
    const giuLai = {}; bw.forEach(function (r) { if (keep[String(r.sp_id)]) giuLai[String(r.sp_id)] = 1; });
    // 3) phần mình sở hữu -> ghi lại từ đầu
    await supa.remove('sp_combo', supa.eq('sp_id', cur.id));
    const rows = items.filter(function (x) { return !giuLai[String(x.id)]; })
      .map(function (x, i) { return { sp_id: cur.id, sp_kem_id: Number(x.id), so_luong: n(x.soLuong) || 1, ghi_chu: s(x.ghiChu), sort_no: i }; });
    if (rows.length) await supa.insert('sp_combo', rows);
  } catch (e) { throw tblErr_(e, 'sp_combo', 'db/sp_combo.sql'); }
  await spHistory_(actor, s(cur.ma_sp), [{ field: 'SẢN PHẨM ĐI KÈM', old: '', new: items.length ? (items.length + ' sản phẩm') : 'Bỏ hết' }]);
  await logAudit_(actor, 'sua_combo', 'Đặt ' + items.length + ' sản phẩm đi kèm cho ' + s(cur.ma_sp) + ' (' + s(cur.ten_sp) + ')');
  _cache = null;
  return { ok: true, count: items.length };
}
async function getProductHistory(ma) {
  ma = s(ma).trim(); if (!ma) return [];
  const rows = await supa.select('db_san_pham_history', { filter: supa.eq('ma_sp', ma), order: 'changed_at.desc', limit: 200 });
  return rows.map(function (r) { return { field: s(r.field), old: s(r.old_value), new: s(r.new_value), by: s(r.changed_by_name), at: s(r.changed_at) }; });
}
async function saveLineAsProduct(actor, p) {
  if (p === undefined) { p = actor; actor = null; }
  p = p || {};
  const data = { 'TÊN SẢN PHẨM': p.ten, 'MÃ SẢN PHẨM': p.ma, 'DÒNG SẢN PHẨM': p.nhom, 'HẠNG MỤC': p.hangMuc,
    'THƯƠNG HIỆU': p.thuongHieu, 'NHÀ CUNG CẤP': p.ncc, 'ĐƠN VỊ TÍNH': p.dvt, 'GIÁ BÁN LẺ': p.gia != null ? p.gia : p.donGiaBan,
    'GHI CHÚ': p.moTa, 'ẢNH SẢN PHẨM': p.hinhAnh };
  const r = await saveDbProduct(actor, data);
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
async function importCommit(actor, products) {
  if (products === undefined && Array.isArray(actor)) { products = actor; actor = null; }
  // Dùng lại saveDbProduct cho từng SP (đúng path đã hoạt động: tự check + INSERT/UPDATE,
  // map đủ cột qua DB_LABEL2COL, xử lý số/boolean). Tránh upsert merge-duplicates bị RLS chặn.
  const list = products || [];
  let inserted = 0, updated = 0; const errors = [];
  const fill = function (d, lbl, v) { if (!s(d[lbl]).trim() && v != null && v !== '') d[lbl] = v; };
  for (const p of list) {
    const data = Object.assign({}, p._raw || {}); // cột từ file (tiêu đề = nhãn DB trong file mẫu)
    fill(data, 'TÊN SẢN PHẨM', p.ten); fill(data, 'MÃ SẢN PHẨM', p.ma); fill(data, 'DÒNG SẢN PHẨM', p.nhom);
    fill(data, 'HẠNG MỤC', p.hangMuc); fill(data, 'THƯƠNG HIỆU', p.thuongHieu); fill(data, 'NHÀ CUNG CẤP', p.ncc);
    fill(data, 'GIÁ BÁN LẺ', p.gia); fill(data, 'GHI CHÚ', p.moTa);
    delete data['GIÁ ĐẠI LÝ']; // cột tự tính (generated)
    data['ẢNH SẢN PHẨM'] = s(p.hinhAnh); // ảnh người dùng tải (ghi đè mọi cột ảnh trong file)
    if (!s(data['ĐƠN VỊ TÍNH']).trim()) data['ĐƠN VỊ TÍNH'] = p.dvt || 'Cái';
    if (!s(data['TRẠNG THÁI']).trim()) data['TRẠNG THÁI'] = 'Đang kinh doanh';
    if (!s(data['TÊN SẢN PHẨM']).trim()) continue;
    try { const r = await saveDbProduct(actor, data, { noAudit: true }); if (r && r.updated) updated++; else inserted++; }
    catch (e) { errors.push({ ten: s(data['TÊN SẢN PHẨM']), error: e && e.message }); }
  }
  _cache = null;
  await logAudit_(actor, 'nhap_sp', 'Nhập hàng loạt: thêm ' + inserted + ', cập nhật ' + updated +
    ' sản phẩm' + (errors.length ? ' (' + errors.length + ' lỗi)' : ''));
  const out = { inserted: inserted, updated: updated };
  if (errors.length) out.errors = errors;
  return out;
}

/*** ===== MUA HÀNG ===== ***/
function genMaDon_() { return 'MH-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1e4); }
// Lưu đơn mua hàng vào DB (mỗi nhà cung cấp = 1 đơn). Payload giống sendPurchaseRequest.
async function savePurchaseOrder(order) {
  order = order || {};
  const orders = Array.isArray(order.orders) ? order.orders : [];
  const saved = [];
  for (const od of orders) {
    const maDon = genMaDon_();
    const items = Array.isArray(od.items) ? od.items : [];
    const total = n(od.total), vat = n(od.vat);
    await supa.insert('don_mua_hang', {
      ma_don: maDon, ma_du_an: s(order.maDA), ten_du_an: s(order.project), hang_muc: s(order.hangMuc || order.node),
      nha_cung_cap: s(od.supplier), so_sp: items.length, tong_truoc_vat: total - vat, vat_pct: n(od.vatPct),
      vat: vat, tong_cong: total, trang_thai: 'Chờ duyệt', kenh_gui: s(order.kenh) || 'Lark',
      ket_qua_gui: s(order.ketQua) || 'ok', nguoi_gui: s(order.nguoiGui), phong_ban: s(order.phongBan), ghi_chu: s(order.ghiChu),
      requester_id: order.requesterId || null
    });
    if (items.length) {
      await supa.insert('chi_tiet_mua_hang', items.map(function (it, i) {
        const sl = n(it.sl), dg = n(it.donGia);
        return { ma_don: maDon, ma_sp: s(it.ma), ten_sp: s(it.ten), thuong_hieu: s(it.thuongHieu), phong: s(it.khuVuc),
          dvt: s(it.dvt) || 'Cái', so_luong: sl, don_gia: dg, thanh_tien: sl * dg, hinh_anh: s(it.hinhAnh), sort_no: i };
      }));
    }
    saved.push(maDon);
  }
  return { saved: saved };
}
// Lịch sử đơn mua hàng của 1 bản nháp (kèm chi tiết)
async function getPurchaseOrders(maDA) {
  const heads = await supa.select('don_mua_hang', { filter: supa.eq('ma_du_an', maDA), order: 'ngay_gui.desc' });
  if (!heads.length) return [];
  const out = [];
  for (const h of heads) {
    const dt = await supa.select('chi_tiet_mua_hang', { filter: supa.eq('ma_don', h.ma_don), order: 'sort_no.asc' });
    out.push({
      maDon: s(h.ma_don), ncc: s(h.nha_cung_cap), hangMuc: s(h.hang_muc), soSP: n(h.so_sp),
      tongTruocVat: n(h.tong_truoc_vat), vatPct: n(h.vat_pct), vat: n(h.vat), tongCong: n(h.tong_cong),
      trangThai: s(h.trang_thai), nguoiGui: s(h.nguoi_gui), phongBan: s(h.phong_ban), ghiChu: s(h.ghi_chu), ngayGui: s(h.ngay_gui),
      items: dt.map(function (r) { return { ma: s(r.ma_sp), ten: s(r.ten_sp), thuongHieu: s(r.thuong_hieu), khuVuc: s(r.phong), dvt: s(r.dvt), sl: n(r.so_luong), donGia: n(r.don_gia), thanhTien: n(r.thanh_tien), hinhAnh: s(r.hinh_anh) }; })
    });
  }
  return out;
}

/*** ===== CÔNG TÁC XÂY DỰNG (Phần thô) =====
 Trước đây thư viện công tác nằm cứng trong code nên không có ảnh / không duyệt / không sửa
 được như sản phẩm đèn. Bảng cong_tac đưa công tác thành dữ liệu thật: mỗi dòng có ảnh,
 trạng thái duyệt, người tạo / người sửa, và nhập được từ tab Nhập dữ liệu.            ***/
function ctToObj(r) {
  return {
    id: r.id, loai: s(r.loai) || 'kt_chitiet', mode: s(r.che_do) || 'item',
    maNhom: s(r.ma_nhom), hangMuc: s(r.hang_muc), ten: s(r.ten), dvt: s(r.dvt), ncc: s(r.nha_cung_cap),
    kl: r.khoi_luong == null ? '' : n(r.khoi_luong),
    dt: r.dien_tich == null ? '' : n(r.dien_tich),
    hs: r.he_so == null ? '' : n(r.he_so),
    dgnt: n(r.don_gia_nha_thau), dg: n(r.don_gia),
    gc: s(r.ghi_chu), hinhAnh: s(r.hinh_anh), thongSo: s(r.thong_so),
    phamVi: s(r.pham_vi), linkTaiLieu: s(r.link_tai_lieu),
    daDuyet: r.da_duyet === true, nguoiDuyet: s(r.nguoi_duyet), ngayDuyet: r.ngay_duyet || '',
    yeuThich: r.yeu_thich === true,
    nguoiTao: s(r.nguoi_tao), ngayTao: r.ngay_tao || '',
    nguoiSua: s(r.nguoi_sua), ngayCapNhat: r.ngay_cap_nhat || '',
    thuTu: n(r.thu_tu)
  };
}
function ctToRow_(d) {
  function num(v) { return (v === '' || v == null) ? null : n(v); }
  const r = {
    loai: s(d.loai) || 'kt_chitiet', che_do: s(d.mode) || 'item',
    ma_nhom: s(d.maNhom), hang_muc: s(d.hangMuc), ten: s(d.ten), dvt: s(d.dvt), nha_cung_cap: s(d.ncc),
    khoi_luong: num(d.kl), dien_tich: num(d.dt), he_so: num(d.hs),
    don_gia_nha_thau: num(d.dgnt), don_gia: num(d.dg),
    ghi_chu: s(d.gc), hinh_anh: s(d.hinhAnh), thong_so: s(d.thongSo),
    pham_vi: s(d.phamVi), link_tai_lieu: s(d.linkTaiLieu)
  };
  if (d.thuTu != null && d.thuTu !== '') r.thu_tu = n(d.thuTu);
  return r;
}
// Cột mới thêm sau (vd nha_cung_cap): nếu Supabase chưa có thì bỏ cột đó ra và ghi lại,
// để người chưa chạy lại db/cong_tac.sql vẫn nhập được dữ liệu.
function ctMissingCol_(e) {
  const m = (e && e.message) || '';
  const g = m.match(/Could not find the '([a-z0-9_]+)' column/i);
  return g ? g[1] : '';
}
async function ctTry_(fn, body) {
  try { return await fn(body); }
  catch (e) {
    const col = ctMissingCol_(e);
    if (col && Object.prototype.hasOwnProperty.call(Array.isArray(body) ? (body[0] || {}) : body, col)) {
      console.warn('[cong_tac] thiếu cột ' + col + ' — chạy lại db/cong_tac.sql. Tạm bỏ cột này.');
      const strip = function (o) { const c = Object.assign({}, o); delete c[col]; return c; };
      return fn(Array.isArray(body) ? body.map(strip) : strip(body));
    }
    throw e;
  }
}
function ctErr_(e) {
  const m = (e && e.message) || '';
  if (/relation .*cong_tac.* does not exist|PGRST205|Could not find the table/i.test(m))
    return new Error('Chưa có bảng cong_tac trong Supabase — chạy file db/cong_tac.sql rồi thử lại.');
  if (/42501|row-level security/i.test(m))
    return new Error('Bảng cong_tac đang bật RLS nên không ghi được — chạy lại db/cong_tac.sql.');
  return e;
}
async function ctList() {
  try {
    const rows = await supa.select('cong_tac', { order: 'loai.asc,thu_tu.asc,ngay_tao.asc', limit: 5000 });
    return (rows || []).map(ctToObj);
  } catch (e) {
    const m = (e && e.message) || '';
    if (/does not exist|PGRST205|Could not find the table/i.test(m)) return [];   // chưa chạy SQL -> coi như chưa có
    throw e;
  }
}
async function ctSave(actor, data) {
  const who = (actor && actor.u) || 'ẩn danh';
  const rows = Array.isArray(data) ? data : [data];
  const body = rows.filter(function (d) { return s(d && d.ten).trim(); }).map(function (d) {
    return Object.assign(ctToRow_(d), { nguoi_tao: who, ngay_tao: nowIso(), da_duyet: false });
  });
  if (!body.length) throw new Error('Chưa có công tác nào để lưu (thiếu tên công việc)');
  let out;
  try { out = await ctTry_(function (b) { return supa.insert('cong_tac', b); }, body); }
  catch (e) { throw ctErr_(e); }
  await logAudit_(actor, 'them_cong_tac', 'Thêm ' + body.length + ' công tác: ' +
    body.slice(0, 6).map(function (b) { return b.ten; }).join(', ') + (body.length > 6 ? '…' : ''));
  return { ok: (out || []).length, rows: (out || []).map(ctToObj) };
}
async function ctUpdate(actor, id, patch) {
  if (!id) throw new Error('Thiếu id công tác');
  const who = (actor && actor.u) || 'ẩn danh';
  // Sửa nội dung -> quay về "Chưa duyệt", đúng như sản phẩm đèn
  const row = Object.assign(ctToRow_(patch),
    { nguoi_sua: who, ngay_cap_nhat: nowIso(), da_duyet: false, nguoi_duyet: null, ngay_duyet: null });
  Object.keys(row).forEach(function (k) { if (row[k] === undefined) delete row[k]; });
  let out;
  try { out = await ctTry_(function (b) { return supa.update('cong_tac', supa.eq('id', id), b); }, row); }
  catch (e) { throw ctErr_(e); }
  if (!out || !out.length) throw new Error('Không tìm thấy công tác để sửa');
  await logAudit_(actor, 'sua_cong_tac', 'Sửa công tác: ' + s(row.ten));
  return ctToObj(out[0]);
}
async function ctDelete(actor, ids) {
  ids = Array.isArray(ids) ? ids : [ids];
  let ok = 0; const errs = [];
  for (const id of ids) {
    try { await supa.remove('cong_tac', supa.eq('id', id)); ok++; }
    catch (e) { if (errs.length < 5) errs.push({ id: id, error: (ctErr_(e)).message }); }
  }
  if (ok) await logAudit_(actor, 'xoa_cong_tac', 'Xoá ' + ok + ' công tác');
  const out = { ok: ok }; if (errs.length) out.errors = errs; return out;
}
async function ctDuyet(actor, ids, approve) {
  ids = Array.isArray(ids) ? ids : [ids];
  const who = (actor && actor.u) || 'ẩn danh';
  const patch = approve
    ? { da_duyet: true, nguoi_duyet: who, ngay_duyet: nowIso() }
    : { da_duyet: false, nguoi_duyet: null, ngay_duyet: null };
  let ok = 0; const errs = [];
  for (const id of ids) {
    try { const r = await supa.update('cong_tac', supa.eq('id', id), patch); if (r && r.length) ok++; }
    catch (e) { if (errs.length < 5) errs.push({ id: id, error: (ctErr_(e)).message }); }
  }
  if (ok) await logAudit_(actor, approve ? 'duyet_cong_tac' : 'bo_duyet_cong_tac',
    (approve ? 'Duyệt ' : 'Bỏ duyệt ') + ok + ' công tác');
  const out = { ok: ok }; if (errs.length) out.errors = errs; return out;
}
// Yêu thích công tác — công tác luôn thuộc 1 công ty nên đánh dấu ngay trên dòng
async function ctFav(actor, ids, on) {
  ids = Array.isArray(ids) ? ids : [ids];
  let ok = 0; const errs = [];
  for (const id of ids) {
    try {
      const r = await supa.update('cong_tac', supa.eq('id', id), { yeu_thich: !!on });
      if (r && r.length) ok++;
    } catch (e) {
      if (ctMissingCol_(e) === 'yeu_thich')
        throw new Error('Chưa có cột "yêu thích" trong bảng cong_tac — chạy lại db/cong_tac.sql rồi thử lại.');
      if (errs.length < 5) errs.push({ id: id, error: (ctErr_(e)).message });
    }
  }
  const out = { ok: ok }; if (errs.length) out.errors = errs; return out;
}
/* Nhập hàng loạt công tác từ Excel/CSV — đọc file rồi trả về danh sách để xem trước.
   Cột nhận diện theo tiêu đề (không phân biệt hoa thường, bỏ dấu).                */
const CT_ALIAS = {
  ten: ['nội dung công việc', 'noi dung cong viec', 'tên công việc', 'ten cong viec', 'công việc', 'cong viec', 'tên công tác', 'ten cong tac', 'hạng mục công việc'],
  hangMuc: ['hạng mục', 'hang muc', 'nhóm', 'nhom'],
  maNhom: ['số hạng mục', 'so hang muc', 'stt hạng mục', 'mã nhóm', 'ma nhom'],
  loai: ['loại báo giá', 'loai bao gia', 'loại', 'loai'],
  mode: ['cách tính', 'cach tinh', 'kiểu tính', 'kieu tinh'],
  dvt: ['đvt', 'dvt', 'đơn vị tính', 'don vi tinh'],
  kl: ['khối lượng', 'khoi luong', 'khối lượng mẫu', 'kl'],
  dt: ['diện tích', 'dien tich', 'diện tích mẫu'],
  hs: ['hệ số', 'he so'],
  dgnt: ['đơn giá nhà thầu', 'don gia nha thau', 'giá đại lý', 'gia dai ly', 'giá vốn', 'gia von'],
  dg: ['đơn giá', 'don gia', 'giá bán lẻ', 'gia ban le', 'đơn giá bán', 'don gia ban', 'giá bán', 'gia ban'],
  ncc: ['nhà thầu', 'nha thau', 'nhà cung cấp', 'nha cung cap'],
  gc: ['ghi chú', 'ghi chu'],
  thongSo: ['thông số kỹ thuật', 'thong so ky thuat', 'thông số', 'thong so'],
  phamVi: ['phạm vi ứng dụng', 'pham vi ung dung', 'phạm vi', 'pham vi'],
  hinhAnh: ['ảnh', 'anh', 'hình ảnh', 'hinh anh', 'link ảnh']
};
function toNumber_(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const t = String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const x = parseFloat(t); return isNaN(x) ? 0 : x;
}
function ctNorm_(v) {
  return String(v == null ? '' : v).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[×✕✖]/g, 'x').replace(/[·•]/g, ' ')      // "Diện tích × hệ số", "Dự toán · Vật tư"
    .replace(/\s+/g, ' ').trim();
}
function ctMatchAlias_(h) {
  const t = ctNorm_(h); if (!t) return '';
  for (const k of Object.keys(CT_ALIAS)) {
    if (CT_ALIAS[k].some(function (a) { return ctNorm_(a) === t; })) return k;
  }
  return '';
}
const CT_LOAI_ALIAS = { 'khai toan chi tiet': 'kt_chitiet', 'khai toan so bo': 'kt_sobo',
  'du toan nhan cong': 'dt_nhancong', 'du toan vat tu': 'dt_vattu' };
const CT_MODE_ALIAS = { 'khoi luong x don gia': 'item', 'khoi luong': 'item', 'item': 'item',
  'dien tich x he so': 'area', 'dien tich': 'area', 'area': 'area',
  'chi tinh khoi luong': 'area0', 'area0': 'area0', 'chi liet ke': 'none', 'none': 'none' };
async function ctImportParse(base64, ext) {
  const ExcelJS = require('exceljs');
  const buf = Buffer.from(String(base64 || ''), 'base64');
  const wb = new ExcelJS.Workbook();
  if (String(ext || '').toLowerCase().indexOf('csv') >= 0) {
    const Readable = require('stream').Readable;
    await wb.csv.read(Readable.from(buf.toString('utf8')));
  } else { await wb.xlsx.load(buf); }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File không có sheet dữ liệu');
  const grid = [];
  ws.eachRow({ includeEmpty: false }, function (row) {
    const arr = []; row.eachCell({ includeEmpty: true }, function (cell, col) {
      let v = cell.value;
      if (v && typeof v === 'object') v = v.text || v.result || v.richText && v.richText.map(function (x) { return x.text; }).join('') || '';
      arr[col - 1] = v == null ? '' : v;
    });
    grid.push(arr);
  });
  if (!grid.length) throw new Error('File rỗng');
  let hr = -1, map = null;
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const m = {}; grid[i].forEach(function (h, ci) { const k = ctMatchAlias_(h); if (k && m[k] === undefined) m[k] = ci; });
    if (m.ten !== undefined) { hr = i; map = m; break; }
  }
  if (hr < 0) throw new Error('Không tìm thấy cột "Nội dung công việc" trong file — tải file mẫu để xem đúng tiêu đề cột');
  function cell(row, i) { return i === undefined ? '' : String(row[i] == null ? '' : row[i]).trim(); }
  const rows = [];
  for (let r = hr + 1; r < grid.length; r++) {
    const row = grid[r]; const ten = cell(row, map.ten); if (!ten) continue;
    // Bỏ qua dòng chú thích cuối file: chỉ có ô đầu, dài như một câu
    const coCotKhac = ['hangMuc', 'loai', 'mode', 'dvt', 'kl', 'dt', 'hs', 'dg', 'dgnt', 'ncc']
      .some(function (k) { return cell(row, map[k]); });
    if (!coCotKhac && (ten.length > 80 || /^(ghi chu|luu y|note|chu thich)/i.test(ctNorm_(ten)))) continue;
    const loaiTxt = ctNorm_(cell(row, map.loai)), modeTxt = ctNorm_(cell(row, map.mode));
    rows.push({
      ten: ten, hangMuc: cell(row, map.hangMuc), maNhom: cell(row, map.maNhom),
      loai: CT_LOAI_ALIAS[loaiTxt] || (/^(kt_|dt_)/.test(loaiTxt) ? loaiTxt : 'kt_chitiet'),
      mode: CT_MODE_ALIAS[modeTxt] || 'item',
      dvt: cell(row, map.dvt), ncc: cell(row, map.ncc),
      kl: toNumber_(cell(row, map.kl)), dt: toNumber_(cell(row, map.dt)), hs: toNumber_(cell(row, map.hs)),
      dgnt: round0_(toNumber_(cell(row, map.dgnt))), dg: round0_(toNumber_(cell(row, map.dg))),
      gc: cell(row, map.gc), thongSo: cell(row, map.thongSo), phamVi: cell(row, map.phamVi),
      hinhAnh: cell(row, map.hinhAnh)
    });
    if (rows.length >= 2000) break;
  }
  if (!rows.length) throw new Error('Không đọc được dòng nào có "Nội dung công việc"');
  return { rows: rows, count: rows.length };
}
// Nạp thư viện mẫu (PT_TEMPLATE ở client gửi lên) — chỉ chạy khi công ty CHƯA có công tác nào
async function ctSeed(actor, rows) {
  const cur = await ctList();
  if (cur.length) return { ok: 0, daCo: cur.length };
  const r = await ctSave(actor, rows || []);
  return { ok: r.ok, daCo: 0 };
}

module.exports = {
  bootstrap, buildCatalog, getProducts, getCatalogSheets, getProjects, getProject, createProject, updateProject, deleteProject, duplicateProject,
  getLines, addLine, addBlankLine, updateLine, deleteLine, saveLineAsProduct, saveDbProduct, deleteDbProduct, uploadImage,
  getDbProduct, updateDbProductTracked, getProductHistory, diffDbProduct, dataToRow_, logAudit_, setSpDuyet,
  setYeuThich,
  ctList, ctSave, ctUpdate, ctDelete, ctDuyet, ctSeed, ctFav, ctImportParse,
  getCombo, setCombo,
  DB_LABEL2COL,
  getCover, saveCover, buildCoverFromTemplate, getCoverOrInit, getDashboard, getQuote, importParse, importCommit,
  savePurchaseOrder, getPurchaseOrders
};
