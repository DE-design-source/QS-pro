'use strict';
const supa = require('../../libraries/supa');
const { n, s, round0_, LIM, chamTran_ } = require('../../libraries/utils');

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
  const rows = chamTran_(await supa.select('db_bao_gia', { filter: supa.eq('ma_du_an', maDA), order: 'sort_no.asc', limit: LIM }), LIM, 'Dòng bóc tách của dự án');
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
  // Lấy sort_no LỚN NHẤT đang có, không đếm số dòng: xoá dòng giữa rồi thêm mới là trùng STT
  const existing = await supa.select('db_bao_gia', { select: 'sort_no', filter: supa.eq('ma_du_an', maDA), order: 'sort_no.desc', limit: 1 });
  const stt = (existing && existing[0] ? (Number(existing[0].sort_no) || 0) : 0) + 1;
  const c = calc_(von, Number(product.chietKhau) || 0, ln, product.donGiaBan != null ? n(product.donGiaBan) : null, Number(product.ckKhach) || 0, sl);
  const row = {
    ma_du_an: maDA, sort_no: stt, stt: String(stt),
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

module.exports = { getLines, addLine, addBlankLine, updateLine, deleteLine };
