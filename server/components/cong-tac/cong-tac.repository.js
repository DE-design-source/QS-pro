'use strict';
const supa = require('../../libraries/supa');
const { n, s, nowIso, LIM, chamTran_ } = require('../../libraries/utils');
const { logAudit_ } = require('../thong-bao/audit');

/*** ===== CÔNG TÁC XÂY DỰNG (Phần thô) =====
 Trước đây thư viện công tác nằm cứng trong code nên không có ảnh / không duyệt / không sửa
 được như sản phẩm đèn. Bảng cong_tac đưa công tác thành dữ liệu thật: mỗi dòng có ảnh,
 trạng thái duyệt, người tạo / người sửa, và nhập được từ tab Nhập dữ liệu.            ***/
function ctToObj(r) {
  return {
    id: r.id, loai: s(r.loai) || 'kt_chitiet', mode: s(r.che_do) || 'item',
    maNhom: s(r.ma_nhom), hangMuc: s(r.hang_muc), deMuc: s(r.de_muc), ten: s(r.ten), dvt: s(r.dvt), ncc: s(r.nha_cung_cap),
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
// cột DB -> khoá phía client (ctToRow_ dùng cùng bảng này)
const CT_SRC = { loai: 'loai', che_do: 'mode', ma_nhom: 'maNhom', hang_muc: 'hangMuc', de_muc: 'deMuc', ten: 'ten', dvt: 'dvt',
  nha_cung_cap: 'ncc', khoi_luong: 'kl', dien_tich: 'dt', he_so: 'hs', don_gia_nha_thau: 'dgnt', don_gia: 'dg',
  ghi_chu: 'gc', hinh_anh: 'hinhAnh', thong_so: 'thongSo', pham_vi: 'phamVi', link_tai_lieu: 'linkTaiLieu', thu_tu: 'thuTu' };
function ctToRow_(d) {
  function num(v) { return (v === '' || v == null) ? null : n(v); }
  const r = {
    loai: s(d.loai) || 'kt_chitiet', che_do: s(d.mode) || 'item',
    ma_nhom: s(d.maNhom), hang_muc: s(d.hangMuc), de_muc: s(d.deMuc), ten: s(d.ten), dvt: s(d.dvt), nha_cung_cap: s(d.ncc),
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
    const rows = chamTran_(await supa.select('cong_tac', { order: 'loai.asc,thu_tu.asc,ngay_tao.asc', limit: LIM }), LIM, 'Thư viện công tác');
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
  // ghi nhật ký "tạo" theo LÔ (nhập 200+ dòng vẫn chỉ 1 lần gọi)
  try {
    const hs = (out || []).filter(function (r) { return r && r.id; }).map(function (r) {
      return { cong_tac_id: r.id, field: 'TẠO CÔNG TÁC', old_value: '', new_value: s(r.ten),
        changed_by: (actor && actor.uid) || null, changed_by_name: who };
    });
    if (hs.length) await supa.insert('cong_tac_history', hs);
  } catch (e) { if (!ctHistThieu_(e)) console.warn('[cong tac history]', e && e.message); }
  await logAudit_(actor, 'them_cong_tac', 'Thêm ' + body.length + ' công tác: ' +
    body.slice(0, 6).map(function (b) { return b.ten; }).join(', ') + (body.length > 6 ? '…' : ''));
  return { ok: (out || []).length, rows: (out || []).map(ctToObj) };
}
/* ===== Lịch sử cập nhật CÔNG TÁC — y như sản phẩm đèn ===== */
const CT_FIELD_LBL = {
  loai: 'LOẠI BÁO GIÁ', che_do: 'CHẾ ĐỘ', ma_nhom: 'MÃ NHÓM', hang_muc: 'HẠNG MỤC', de_muc: 'ĐỀ MỤC BÓC TÁCH', ten: 'TÊN CÔNG TÁC',
  dvt: 'ĐƠN VỊ TÍNH', nha_cung_cap: 'NHÀ THẦU / NCC', khoi_luong: 'KHỐI LƯỢNG', dien_tich: 'DIỆN TÍCH',
  he_so: 'HỆ SỐ', don_gia_nha_thau: 'ĐƠN GIÁ NHÀ THẦU', don_gia: 'ĐƠN GIÁ', ghi_chu: 'GHI CHÚ',
  hinh_anh: 'HÌNH ẢNH', thong_so: 'THÔNG SỐ', pham_vi: 'PHẠM VI', link_tai_lieu: 'LINK TÀI LIỆU',
  da_duyet: 'TRẠNG THÁI DUYỆT', yeu_thich: 'YÊU THÍCH', thu_tu: 'THỨ TỰ'
};
function ctHistThieu_(e) {
  const m = String((e && e.message) || '');
  return /cong_tac_history/.test(m) && /(does not exist|not find the table|42P01|PGRST205|404)/i.test(m);
}
// Ghi nhật ký (nuốt lỗi — lịch sử không được chặn nghiệp vụ)
async function ctHistory_(actor, id, changes) {
  if (!id || !changes || !changes.length) return;
  try {
    await supa.insert('cong_tac_history', changes.map(function (c) {
      return { cong_tac_id: id, field: c.field, old_value: s(c.old), new_value: s(c.new),
        changed_by: (actor && actor.uid) || null, changed_by_name: (actor && (actor.u || actor.username)) || 'ẩn danh' };
    }));
  } catch (e) { if (!ctHistThieu_(e)) console.warn('[cong tac history]', e && e.message); }
}
// So sánh bản ghi cũ với bản vá -> danh sách thay đổi có nhãn tiếng Việt
function ctDiff_(cur, row) {
  const out = [];
  Object.keys(row).forEach(function (k) {
    if (['nguoi_sua', 'ngay_cap_nhat', 'nguoi_duyet', 'ngay_duyet'].indexOf(k) >= 0) return;
    const a = cur ? cur[k] : null, b = row[k];
    const sa = a == null ? '' : String(a), sb = b == null ? '' : String(b);
    if (sa === sb) return;
    if (sa === '' && sb === '') return;
    if (!isNaN(parseFloat(sa)) && !isNaN(parseFloat(sb)) && parseFloat(sa) === parseFloat(sb)) return;
    out.push({ field: CT_FIELD_LBL[k] || k, old: sa, new: sb });
  });
  return out;
}
async function ctGetHistory(id) {
  if (!id) return [];
  let rows = [];
  try {
    rows = await supa.select('cong_tac_history', { filter: supa.eq('cong_tac_id', id), order: 'changed_at.desc', limit: 200 });
  } catch (e) { if (ctHistThieu_(e)) return []; throw e; }
  return rows.map(function (r) {
    return { field: s(r.field), old: s(r.old_value), new: s(r.new_value), by: s(r.changed_by_name), at: s(r.changed_at) };
  });
}
async function ctUpdate(actor, id, patch) {
  if (!id) throw new Error('Thiếu id công tác');
  const who = (actor && actor.u) || 'ẩn danh';
  // Sửa nội dung -> quay về "Chưa duyệt", đúng như sản phẩm đèn
  // Chỉ ghi các cột có trong patch: sửa 1 ô trước đây ghi '' đè Đề mục / NCC / ... của công tác
  const full = ctToRow_(patch), row = {};
  Object.keys(CT_SRC).forEach(function (col) { if (patch && Object.prototype.hasOwnProperty.call(patch, CT_SRC[col]) && col in full) row[col] = full[col]; });
  Object.assign(row, { nguoi_sua: who, ngay_cap_nhat: nowIso(), da_duyet: false, nguoi_duyet: null, ngay_duyet: null });
  const truoc = (await supa.select('cong_tac', { filter: supa.eq('id', id), limit: 1 }))[0] || null;
  let out;
  try { out = await ctTry_(function (b) { return supa.update('cong_tac', supa.eq('id', id), b); }, row); }
  catch (e) { throw ctErr_(e); }
  if (!out || !out.length) throw new Error('Không tìm thấy công tác để sửa');
  await ctHistory_(actor, id, ctDiff_(truoc, row));
  await logAudit_(actor, 'sua_cong_tac', 'Sửa công tác: ' + s(row.ten || (truoc && truoc.ten)));
  return ctToObj(out[0]);
}
async function ctDelete(actor, ids) {
  ids = Array.isArray(ids) ? ids : [ids];
  let ok = 0; const errs = [];
  for (const id of ids) {
    try {
      const cu = (await supa.select('cong_tac', { filter: supa.eq('id', id), limit: 1 }))[0];
      const xoa = await supa.remove('cong_tac', supa.eq('id', id));
      if (!xoa || !xoa.length) throw new Error('Không tìm thấy công tác');
      ok++;
      await ctHistory_(actor, id, [{ field: 'XOÁ CÔNG TÁC', old: cu ? s(cu.ten) : '', new: 'đã xoá' }]);
    }
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
    try {
      const r = await supa.update('cong_tac', supa.eq('id', id), patch);
      if (r && r.length) { ok++;
        await ctHistory_(actor, id, [{ field: 'TRẠNG THÁI DUYỆT', old: approve ? 'Chưa duyệt' : 'Đã duyệt',
          new: approve ? 'Đã duyệt' : 'Chưa duyệt' }]); }
    }
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

module.exports = { ctList, ctSave, ctUpdate, ctDelete, ctDuyet, ctFav, ctGetHistory };
