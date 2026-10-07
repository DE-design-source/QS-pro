'use strict';
/************************************************************
 * SẢN PHẨM (db_san_pham) — đọc / ghi danh mục, lịch sử sửa, trạng thái duyệt.
 ************************************************************/
const supa = require('../../libraries/supa');
const tenant = require('../../libraries/tenant');
const { n, s, LIM, chamTran_ } = require('../../libraries/utils');
const { colErr_ } = require('../../libraries/db-errors');
const { nganhCua_, prodToObj, DB_NUM, DB_LABEL2COL, COL2LABEL, dataToRow_ } = require('./san-pham.mapper');
const { logAudit_ } = require('../thong-bao/audit');

/* Cache danh mục SP — PHẢI tách theo công ty: getProducts() lọc theo công ty đang
   đăng nhập và còn đóng dấu yêu thích / combo của chính công ty đó. Dùng chung một
   ô nhớ cho mọi công ty sẽ khiến công ty B nhận danh mục của công ty A. */
let _cache = {}, _cacheAt = {};
function _ckey_() { try { return String(tenant.tenantId() || '_all'); } catch (e) { return '_all'; } }
function _cacheClear_() { _cache = {}; _cacheAt = {}; }
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
  const rows = chamTran_(await supa.select('db_san_pham', { select: '*', order: 'ten_sp.asc', limit: LIM }), LIM, 'Danh mục sản phẩm');
  const out = rows.map(prodToObj);
  // Kèm KHO CHUNG của Dezon (chỉ đọc) nếu công ty được bật quyền dùng
  try {
    const dzId = await spChungId_();
    if (dzId) {
      const shared = await supa.select('db_san_pham', {
        select: '*', filter: supa.eq('cong_ty_id', dzId), order: 'ten_sp.asc', limit: LIM, noScope: true });
      const has = {}; out.forEach(function (p) { has[p.ma + '|' + p.congSuat + '|' + p.nhietDo + '|' + p.gocChieu + '|' + p.mauSac] = 1; });
      shared.forEach(function (r) {
        const o = prodToObj(r);
        if (has[o.ma + '|' + o.congSuat + '|' + o.nhietDo + '|' + o.gocChieu + '|' + o.mauSac]) return;  // SP riêng đè kho chung
        o.spChung = true;          // đánh dấu: của kho chung, KHÔNG cho sửa/xoá
        out.push(o);
      });
      out.sort(function (a, b) { return String(a.ten).localeCompare(String(b.ten), 'vi'); });
    }
  } catch (e) { if (!/dung_sp_dezon/.test((e && e.message) || '')) throw e; }   // chỉ bỏ qua khi chưa có cột dung_sp_dezon
  await stampYeuThich_(out);         // đánh dấu sản phẩm yêu thích của công ty
  await stampCombo_(out);            // đếm số SP đi kèm (combo)
  _cache[_ckey_()] = out; _cacheAt[_ckey_()] = Date.now();
  return out;
}
// Chặn sửa/xoá sản phẩm thuộc KHO CHUNG (không phải của công ty mình)
async function guardSpChung_(key) {
  const t = tenant.tenantId(); if (!t) return;               // super admin: cho phép
  const filter = /^\d+$/.test(String(key)) ? supa.eq('id', key) : supa.eq('ma_sp', key);
  const r = (await supa.select('db_san_pham', { select: 'id,cong_ty_id', filter: filter, order: 'id.asc', limit: 1, noScope: true }))[0];
  if (r && String(r.cong_ty_id) !== String(t))
    throw new Error('Sản phẩm thuộc kho chung của Dezon — không sửa/xoá được. Hãy tạo bản sao riêng cho công ty bạn.');
}
async function getProductsCached() {
  const k = _ckey_();
  if (_cache[k] && Date.now() - (_cacheAt[k] || 0) < 300000) return _cache[k];
  return getProducts();
}
async function getCatalogSheets() {
  const prods = await getProductsCached();
  const seen = {}, out = [];
  prods.forEach(function (p) { var g = p.nhom; if (g && !seen[g]) { seen[g] = 1; out.push(g); } });
  return out;
}
async function buildCatalog() { _cacheClear_(); const p = await getProducts(); return { count: p.length }; }
async function ytIds_() {
  try {
    const rows = await supa.select('sp_yeu_thich', { select: 'sp_id', limit: LIM });
    const set = {}; rows.forEach(function (r) { set[String(r.sp_id)] = 1; });
    return set;
  } catch (e) { return null; }          // bảng chưa tạo -> coi như chưa có SP yêu thích nào
}
// Đếm số SP đi kèm của từng sản phẩm -> danh sách/bảng hiện được nhãn "combo N"
// mà không phải mở từng sản phẩm ra xem.
async function stampCombo_(list) {
  let rows = [];
  try { rows = await supa.select('sp_combo', { select: 'sp_id,sp_kem_id', limit: LIM, noScope: true }); }
  catch (e) { return list; }                       // chưa có bảng sp_combo -> bỏ qua
  // đếm CẢ HAI CHIỀU: A kèm B thì cả A lẫn B đều được tính là có combo
  // (đếm theo ĐỐI TÁC khác nhau: cặp A–B có thể lưu 2 dòng A->B và B->A khi mỗi bên đặt số lượng riêng)
  const cnt = {};
  rows.forEach(function (r) {
    const a = String(r.sp_id), b = String(r.sp_kem_id); if (a === b) return;
    (cnt[a] = cnt[a] || {})[b] = 1;
    (cnt[b] = cnt[b] || {})[a] = 1;
  });
  list.forEach(function (p) { p.comboN = Object.keys(cnt[String(p.recordId)] || {}).length; });
  return list;
}
async function stampYeuThich_(list) {
  const set = await ytIds_(); if (!set) return list;
  list.forEach(function (p) { p.yeuThich = !!set[String(p.recordId)]; });
  return list;
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
  if (!row.nganh) { const ng0 = nganhCua_('', row.hang_muc); if (ng0 !== 'den') row.nganh = ng0; }
  const ma = s(data['MÃ SẢN PHẨM']).trim();
  // Khoá trùng = MÃ SP + các trục BIẾN THỂ (nhiệt độ màu / công suất / góc chiếu).
  // Nhờ vậy cùng mã nhưng khác nhiệt độ màu sẽ là 2 SẢN PHẨM RIÊNG (biến thể), không ghi đè nhau.
  if (ma) {
    let filter = supa.eq('ma_sp', ma);
    // Thiết bị vệ sinh: thêm KÍCH THƯỚC vào khoá (khớp unique index trong db/thiet_bi_ve_sinh.sql).
    // Chỉ thêm với ngành vệ sinh — SP đèn không có cột này nên giữ khoá cũ, và nếu DB
    // chưa chạy migration thì lưu SP đèn vẫn không bị lỗi thiếu cột.
    const keyCols = ['nhiet_do_mau_k', 'cong_suat_w', 'goc_chieu_deg', 'mau_sac'];
    if (row.nganh === 'vs' || row.nganh === 'son' || row.kich_thuoc) keyCols.push('kich_thuoc');
    // '' và null coi là một (khớp unique index coalesce(col,'')) — trước chỉ tìm is.null, gặp '' thì chèn trùng -> lỗi duplicate key
    filter += '&and=(' + keyCols.map(function (col) {
      const v = row[col];
      return (v == null || v === '') ? 'or(' + col + '.is.null,' + col + '.eq.)' : col + '.eq.' + encodeURIComponent('"' + String(v).replace(/["\\]/g, '\\$&') + '"');
    }).join(',') + ')';
    const ex = await supa.select('db_san_pham', { select: 'id', filter: filter, limit: 1 });
    if (ex.length) {
      if (who && _hasWhoCol !== false) { row.nguoi_sua = who; row.ngay_cap_nhat = new Date().toISOString(); }
      try { await supa.update('db_san_pham', supa.eq('id', ex[0].id), row); }
      catch (e) { if (whoColMissing_(e)) { delete row.nguoi_sua; await supa.update('db_san_pham', supa.eq('id', ex[0].id), row); } else throw colErr_(e); }
      _cacheClear_();
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
  _cacheClear_();
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
  if (!cur) throw new Error('Không tìm thấy sản phẩm để xoá.');
  // Xoá ĐÚNG dòng đã tra được. Trước đây key là mã thì xoá theo ma_sp -> mất CẢ NHÓM
  // biến thể dùng chung mã, dù người dùng chỉ bấm xoá một biến thể.
  await supa.remove('db_san_pham', supa.eq('id', cur.id)); _cacheClear_();
  // Dọn liên kết trỏ tới sản phẩm vừa xoá — trước đây để lại nên combo còn hiện
  // "sản phẩm đi kèm" đã biến mất, và mục yêu thích vẫn đếm nó.
  try { await supa.remove('sp_combo', supa.eq('sp_id', cur.id)); } catch (e) {}
  try { await supa.remove('sp_combo', supa.eq('sp_kem_id', cur.id)); } catch (e) {}
  try { await supa.remove('sp_yeu_thich', supa.eq('sp_id', cur.id)); } catch (e) {}
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
// ===== Cập nhật SP + LƯU LỊCH SỬ (ai, lúc nào, đổi gì) =====
// Nhận ID dòng (chính xác 1 BIẾN THỂ). Nếu truyền mã SP thì lấy biến thể đầu (tương thích ngược).
async function getDbProduct(key) {
  key = s(key).trim(); if (!key) return null;
  const filter = /^\d+$/.test(key) ? supa.eq('id', key) : supa.eq('ma_sp', key);
  // ma_sp KHÔNG unique (biến thể dùng chung mã) -> phải sắp xếp để luôn lấy đúng một dòng,
  // nếu không mỗi lần gọi có thể trúng biến thể khác nhau và sửa nhầm dòng.
  const rows = await supa.select('db_san_pham', { select: '*', filter: filter, order: 'id.asc', limit: 1 });
  return rows[0] || null;
}
// So sánh dữ liệu gửi lên với sản phẩm đang có -> danh sách trường thật sự đổi.
// Dùng chung cho LƯU THẲNG và GỬI CHỜ DUYỆT nên 2 luồng luôn hiểu giống nhau.
async function diffDbProduct(key, data) {
  const cur = await getDbProduct(key);
  if (!cur) throw new Error('Không tìm thấy sản phẩm.');
  const row = dataToRow_(data);
  const changes = [];
  Object.keys(row).forEach(function (col) {
    // Cột chưa có trong DB (chưa chạy migration) mà cũng không nhập gì -> bỏ, tránh lỗi "column does not exist"
    if (!(col in cur) && (row[col] == null || row[col] === '')) { delete row[col]; return; }
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
  _cacheClear_();
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
  let ok = 0, daDung = 0; const errs = []; const hist = [];
  // Khoá là MÃ (không phải id dòng) -> mã dùng chung cho cả nhóm biến thể, phải duyệt HẾT nhóm,
  // trước đây getDbProduct chỉ lấy dòng đầu nên bấm duyệt xong các biến thể sau vẫn "chưa duyệt".
  const ids = [];
  for (const k of keys) {
    if (/^\d+$/.test(String(k).trim())) { ids.push(String(k).trim()); continue; }
    try {
      const rows = await supa.select('db_san_pham', { select: 'id', filter: supa.eq('ma_sp', String(k).trim()), order: 'id.asc', limit: 200 });
      if (rows.length) rows.forEach(function (r) { ids.push(String(r.id)); });
      else ids.push(String(k));
    } catch (e) { ids.push(String(k)); }
  }
  for (const k of ids) {
    try {
      const cur = await getDbProduct(k);
      if (!cur) { errs.push({ key: k, error: 'Không tìm thấy sản phẩm' }); continue; }
      // Đã đúng trạng thái rồi thì coi như XONG (trước đây bỏ qua lặng lẽ -> ok=0 nên
      // màn hình báo "Chưa duyệt được sản phẩm" dù sản phẩm đang ở đúng trạng thái).
      if ((cur.da_duyet === true) === !!approve) { daDung++; continue; }
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
  _cacheClear_();
  const out = { ok: ok, daDung: daDung };
  if (errs.length) out.errors = errs;
  return out;
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

module.exports = {
  getProducts, getProductsCached, getCatalogSheets, buildCatalog, guardSpChung_, _cacheClear_, spHistory_,
  saveDbProduct, deleteDbProduct, getDbProduct, diffDbProduct, updateDbProductTracked, setSpDuyet,
  getProductHistory, saveLineAsProduct
};
