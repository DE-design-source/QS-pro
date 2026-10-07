'use strict';
const supa = require('../../libraries/supa');
const tenant = require('../../libraries/tenant');
const { n, s, nowIso, LIM } = require('../../libraries/utils');
const { colErr_ } = require('../../libraries/db-errors');

/*** ===== DỰ ÁN (du_an) ===== ***/
const PROJ_MAP = { ten: 'ten_du_an', khachHang: 'khach_hang', diaChi: 'dia_chi', sdt: 'sdt', trangThai: 'trang_thai',
  vat: 'vat_pct', tienDo: 'tien_do_pct', ghiChu: 'ghi_chu', quyMo: 'quy_mo', tongDT: 'tong_dt', dtBaoGia: 'dt_bao_gia',
  nhuCau: 'nhu_cau', phanKhuc: 'phan_khuc', maBaoGia: 'ma_bao_gia', nhomTuTao: 'nhom_tu_tao', tangTuTao: 'tang_tu_tao',
  tenBanNhap: 'ten_ban_nhap', linkDezon: 'link_dezon' };
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
  const d = new Date(Date.now() + 7 * 3600e3);          // giờ Việt Nam (server chạy UTC) -> đọc bằng getUTC*
  const pad = function (x) { return String(x).padStart(2, '0'); };
  // + 2 ký tự ngẫu nhiên: ma_da duy nhất toàn hệ thống, 2 lần tạo cùng 1 giây (khác công ty) từng trùng khoá
  return 'DA-' + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + '-' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds())
    + Math.random().toString(36).slice(2, 4).toUpperCase();
}
async function createProject(data) {
  data = data || {};
  const row = { ma_da: data.maDA || genMaDA_(), ngay_tao: nowIso(), cap_nhat: nowIso() };
  Object.keys(PROJ_MAP).forEach(function (k) { if (data[k] != null && data[k] !== '') row[PROJ_MAP[k]] = data[k]; });
  if (!row.trang_thai) row.trang_thai = 'Bản nháp';
  let res;
  try { res = await supa.insert('du_an', row); }
  catch (e) { throw colErr_(e); }
  return projToObj(res[0]);
}
async function updateProject(maDA, fields) {
  fields = fields || {};
  const patch = { cap_nhat: nowIso() };
  Object.keys(fields).forEach(function (k) { if (PROJ_MAP[k]) patch[PROJ_MAP[k]] = fields[k]; });
  let res;
  try { res = await supa.update('du_an', supa.eq('ma_da', maDA), patch); }
  catch (e) { throw colErr_(e); }            // chưa chạy migration -> báo đúng file SQL cần chạy
  return res[0] ? projToObj(res[0]) : getProject(maDA);
}
async function deleteProject(maDA) {
  await supa.remove('db_bao_gia', supa.eq('ma_du_an', maDA));
  await supa.remove('khai_toan', supa.eq('ma_da', maDA));
  // dữ liệu rời của dự án (phần thô · diện tích · VAT) — trước đây bỏ quên nên nằm lại vĩnh viễn
  try { await supa.remove('du_an_data', supa.eq('ma_da', maDA)); } catch (e) { /* chưa có bảng */ }
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
  try {                                   // hỏng giữa chừng -> xoá bản nháp dở, không để lại bản sao thiếu dữ liệu
  // copy dòng bóc tách (tuỳ chọn)
  if (cpBoc) {
    const lines = await supa.select('db_bao_gia', { select: '*', filter: supa.eq('ma_du_an', maDA), order: 'sort_no.asc', limit: LIM });
    if (lines.length) {
      const rows = lines.map(function (r) { const o = Object.assign({}, r); delete o.id; delete o.created_at; o.ma_du_an = newMa; return o; });
      await supa.insert('db_bao_gia', rows);
    }
  }
  // copy tờ bìa (khái toán) nếu có (tuỳ chọn)
  if (cpCover) {
    const cover = await supa.select('khai_toan', { select: '*', filter: supa.eq('ma_da', maDA), limit: 2000 });
    if (cover.length) {
      const crows = cover.map(function (r) { const o = Object.assign({}, r); delete o.id; delete o.created_at; o.ma_da = newMa; return o; });
      await supa.insert('khai_toan', crows);
    }
  }
  // copy dữ liệu rời của dự án (phần thô · diện tích · cài đặt báo giá). KHÔNG chép lịch sử phiên bản báo giá;
  // bỏ tick "Phần thô" (opts.pt === false) thì không chép bảng phần thô.
  let ds = [];
  try { ds = await supa.select('du_an_data', { select: '*', filter: supa.eq('ma_da', maDA), limit: 50 }); }
  catch (e) { if (!daDataThieuBang_(e)) throw e; }        // chưa có bảng du_an_data -> bỏ qua
  ds = ds.filter(function (r) { return r.khoa !== 'bgHist' && (opts.pt !== false || ['phanTho', 'ptVat'].indexOf(r.khoa) < 0); });
  if (ds.length) await supa.insert('du_an_data', ds.map(function (r) { const o = Object.assign({}, r); o.ma_da = newMa; o.cap_nhat = nowIso(); return o; }));
  } catch (e) { try { await deleteProject(newMa); } catch (x) {} throw e; }
  return projToObj(proj);
}

/*** ===== DỮ LIỆU RỜI CỦA DỰ ÁN (du_an_data) =====
 * Bảng ước tính PHẦN THÔ, bảng DIỆN TÍCH và thông tin công tác người dùng tự nhập trước
 * đây chỉ nằm trong localStorage của MÁY người dùng: người khác mở cùng dự án thấy trống,
 * xoá cache trình duyệt là mất sạch. Nay lưu trên server theo từng dự án.
 * khoa: 'phanTho' | 'area' | 'ptInfo' (ptInfo dùng chung công ty -> ma_da = '__cty')
 * Chưa chạy db/du_an_data.sql thì các hàm này trả rỗng / nuốt lỗi, app vẫn chạy như cũ
 * (bản localStorage vẫn còn ở client).                                              ***/
function daDataThieuBang_(e) {
  const m = String((e && e.message) || '');
  return /du_an_data/.test(m) && /(does not exist|not find the table|42P01|PGRST205|404)/i.test(m);
}
// Bảng đã có nhưng còn bật RLS / chưa grant -> Supabase trả 401 mã 42501
function daDataCamQuyen_(e) {
  const m = String((e && e.message) || '');
  return /42501|permission denied|row-level security/i.test(m);
}
const DA_DATA_HD = 'Bảng du_an_data chưa được cấp quyền ghi — vào Supabase SQL Editor chạy lại db/du_an_data.sql (tắt RLS + grant) rồi thử lại.';
// Khoá "dùng chung cả công ty" (ptInfo) phải kèm id công ty: khoá chính của bảng là
// (ma_da, khoa) nên nếu mọi công ty cùng ghi '__cty' thì công ty này ghi đè công ty kia.
function ctyKey_() { try { return '__cty:' + (tenant.tenantId() || '0'); } catch (e) { return '__cty:0'; } }
async function getProjData(maDA) {
  maDA = s(maDA).trim(); if (!maDA) return {};
  const out = {};
  async function lay(ma) {
    try { return await supa.select('du_an_data', { select: 'khoa,gia_tri', filter: supa.eq('ma_da', ma), limit: 50 }) || []; }
    catch (e) { if (daDataThieuBang_(e) || daDataCamQuyen_(e)) return []; throw e; }   // chưa cài xong bảng -> coi như chưa có dữ liệu, app vẫn chạy
  }
  (await lay('__cty')).forEach(function (r) { out[s(r.khoa)] = r.gia_tri; });     // bản cũ chưa tách công ty
  (await lay(ctyKey_())).forEach(function (r) { out[s(r.khoa)] = r.gia_tri; });   // dùng chung trong công ty (ptInfo)
  (await lay(maDA)).forEach(function (r) { out[s(r.khoa)] = r.gia_tri; });        // của riêng dự án -> đè lên
  return out;
}
const PROJ_DATA_KEYS = ['phanTho', 'area', 'ptInfo', 'ptVat', 'cpCfg', 'bgCfg', 'bgHist', 'bgOrg', 'mhPay', 'btFmt'];   // btFmt: định dạng ô của bảng tính (đậm, màu, căn…)
async function setProjData(actor, maDA, khoa, giaTri) {
  maDA = s(maDA).trim(); khoa = s(khoa).trim();
  if (maDA === '__cty') maDA = ctyKey_();        // dùng chung trong công ty -> tách theo công ty
  if (!maDA || !khoa) throw new Error('Thiếu mã dự án hoặc khoá dữ liệu');
  // cpCfg: cài đặt tab Chi phí · bgCfg: tổng kết & điều khoản báo giá · bgHist: các phiên bản báo giá đã chốt
  // bgOrg: thông tin công ty in trên báo giá (lưu theo công ty, ma '__cty')
  if (PROJ_DATA_KEYS.indexOf(khoa) < 0) throw new Error('Khoá dữ liệu không hợp lệ: ' + khoa);
  const row = { ma_da: maDA, khoa: khoa, gia_tri: (giaTri === undefined ? null : giaTri),
    cap_nhat: new Date().toISOString(), nguoi_sua: (actor && actor.u) || '' };
  try { row.cong_ty_id = tenant.tenantId() || null; } catch (e) {}
  try {
    const cu = await supa.select('du_an_data', { select: 'ma_da', filter: supa.eq('ma_da', maDA) + '&' + supa.eq('khoa', khoa), limit: 1 });
    if (cu && cu.length) await supa.update('du_an_data', supa.eq('ma_da', maDA) + '&' + supa.eq('khoa', khoa), row);
    else await supa.insert('du_an_data', row);
  } catch (e) {
    if (daDataThieuBang_(e)) throw new Error('Chưa có bảng du_an_data trong Supabase — vào SQL Editor chạy file db/du_an_data.sql rồi thử lại.');
    if (daDataCamQuyen_(e)) throw new Error(DA_DATA_HD);
    throw e;
  }
  return { ok: true };
}

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject, duplicateProject, getProjData, setProjData };
