'use strict';
const supa = require('../../libraries/supa');
const { n, s } = require('../../libraries/utils');
const { tblErr_ } = require('../../libraries/db-errors');
const { prodToObj } = require('./san-pham.mapper');
const { getDbProduct, guardSpChung_, spHistory_, _cacheClear_ } = require('./san-pham.repository');
const { logAudit_ } = require('../thong-bao/audit');

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
    // 2) liên kết do bên kia đặt và vẫn giữ -> để nguyên dòng của bên kia, không ghi đè.
    //    Nhưng nếu ở phía này người dùng đặt SỐ LƯỢNG khác 1 thì ghi thêm dòng chiều xuôi của mình
    //    (getCombo ưu tiên chiều xuôi) — trước đây số lượng này bị bỏ qua, lưu xong vẫn hiện ×1.
    const giuLai = {}; bw.forEach(function (r) { const x = keep[String(r.sp_id)]; if (x && (n(x.soLuong) || 1) === 1) giuLai[String(r.sp_id)] = 1; });
    // 3) phần mình sở hữu -> ghi lại từ đầu
    // ghi bản mới TRƯỚC rồi mới xoá bản cũ: ghi lỗi thì combo cũ vẫn còn
    const cu = await supa.select('sp_combo', { select: 'id', filter: supa.eq('sp_id', cur.id), limit: 200 });
    const rows = items.filter(function (x) { return !giuLai[String(x.id)]; })
      .map(function (x, i) { return { sp_id: cur.id, sp_kem_id: Number(x.id), so_luong: n(x.soLuong) || 1, ghi_chu: s(x.ghiChu), sort_no: i }; });
    if (rows.length) await supa.insert('sp_combo', rows);
    if (cu.length) await supa.remove('sp_combo', 'id=in.(' + cu.map(function (r) { return r.id; }).join(',') + ')');
  } catch (e) { throw tblErr_(e, 'sp_combo', 'db/sp_combo.sql'); }
  await spHistory_(actor, s(cur.ma_sp), [{ field: 'SẢN PHẨM ĐI KÈM', old: '', new: items.length ? (items.length + ' sản phẩm') : 'Bỏ hết' }]);
  await logAudit_(actor, 'sua_combo', 'Đặt ' + items.length + ' sản phẩm đi kèm cho ' + s(cur.ma_sp) + ' (' + s(cur.ten_sp) + ')');
  _cacheClear_();
  return { ok: true, count: items.length };
}

module.exports = { getCombo, setCombo };
