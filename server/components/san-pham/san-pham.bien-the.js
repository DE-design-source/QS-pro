'use strict';
const supa = require('../../libraries/supa');
const { s } = require('../../libraries/utils');
const { tblErr_ } = require('../../libraries/db-errors');
const { prodToObj } = require('./san-pham.mapper');
const { getDbProduct, guardSpChung_, spHistory_, _cacheClear_ } = require('./san-pham.repository');
const { logAudit_ } = require('../thong-bao/audit');

/*** ===== BIẾN THỂ: nhóm do người dùng tự gom ===== ***/
/* Biến thể mặc định suy ra từ MÃ SP trùng nhau. Cột nhom_bt (db/bien_the_nhom.sql)
   cho phép gom tay: các SP cùng nhom_bt là biến thể của nhau, kể cả khác mã.
   Gom/bỏ chỉ ghi cột nhom_bt -> KHÔNG đụng tới mã SP, bỏ ra lúc nào cũng được.   */
function btMissing_(e) { const m = (e && e.message) || ''; return /nhom_bt/.test(m); }
async function getBienThe(key) {
  const cur = await getDbProduct(key); if (!cur) return [];
  const g = s(cur.nhom_bt).trim(); if (!g) return [];
  let rows = [];
  try {
    rows = await supa.select('db_san_pham', { select: '*', filter: supa.eq('nhom_bt', g), order: 'ten_sp.asc', limit: 200 });
  } catch (e) { if (btMissing_(e)) return []; throw e; }      // chưa chạy migration -> coi như chưa gom
  return rows.filter(function (r) { return String(r.id) !== String(cur.id); })
             .map(function (r) { const o = prodToObj(r); o.nhomBT = g; return o; });
}
// Ghi đè toàn bộ nhóm biến thể của 1 sản phẩm (ids = danh sách SP cùng nhóm, không kể chính nó)
async function setBienThe(actor, key, ids) {
  const cur = await getDbProduct(key); if (!cur) throw new Error('Không tìm thấy sản phẩm.');
  await guardSpChung_(key);
  const goc = Array.isArray(ids) ? ids : [];
  const seen = {};
  const list = goc.map(function (x) { return String((x && x.id != null) ? x.id : x).trim(); })
    .filter(function (id) {
      if (!id || !/^\d+$/.test(id) || id === String(cur.id) || seen[id]) return false;
      seen[id] = 1; return true;
    });
  // Chặn xoá nhầm: gửi lên có sản phẩm nhưng không cái nào hợp lệ -> lỗi payload
  if (goc.length && !list.length)
    throw new Error('Danh sách biến thể không hợp lệ (thiếu id) — không thay đổi nhóm. Tải lại trang rồi thử lại.');
  const cu = s(cur.nhom_bt).trim();
  try {
    if (!list.length) {                                   // bỏ hết -> giải tán nhóm
      if (cu) await supa.update('db_san_pham', supa.eq('nhom_bt', cu), { nhom_bt: null });
    } else {
      const g = cu || ('BT-' + cur.id);
      // SP cũ trong nhóm nhưng nay bị bỏ ra -> trả về không nhóm
      if (cu) {
        const truoc = await supa.select('db_san_pham', { select: 'id', filter: supa.eq('nhom_bt', cu), limit: 200 });
        const ra = truoc.filter(function (r) { return String(r.id) !== String(cur.id) && !seen[String(r.id)]; })
                        .map(function (r) { return r.id; });
        if (ra.length) await supa.update('db_san_pham', 'id=in.(' + ra.join(',') + ')', { nhom_bt: null });
      }
      await supa.update('db_san_pham', 'id=in.(' + [cur.id].concat(list).join(',') + ')', { nhom_bt: g });
    }
  } catch (e) {
    if (btMissing_(e)) throw new Error('Chưa có cột nhom_bt. Vào Supabase → SQL Editor chạy file db/bien_the_nhom.sql rồi thử lại.');
    throw tblErr_(e, 'db_san_pham', 'db/bien_the_nhom.sql');
  }
  await spHistory_(actor, s(cur.ma_sp), [{ field: 'BIẾN THỂ', old: '', new: list.length ? (list.length + ' sản phẩm cùng nhóm') : 'Bỏ nhóm' }]);
  await logAudit_(actor, 'sua_bien_the', 'Gom ' + list.length + ' biến thể cho ' + s(cur.ma_sp) + ' (' + s(cur.ten_sp) + ')');
  _cacheClear_();
  return { ok: true, count: list.length };
}

module.exports = { getBienThe, setBienThe };
