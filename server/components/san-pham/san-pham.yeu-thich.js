'use strict';
const supa = require('../../libraries/supa');
const tenant = require('../../libraries/tenant');
const { s } = require('../../libraries/utils');
const { tblErr_ } = require('../../libraries/db-errors');
const { _cacheClear_ } = require('./san-pham.repository');

/*** ===== SẢN PHẨM YÊU THÍCH =====
 Kho lưu những SP hay dùng để lấy lại cho các dự án sau (yêu cầu trong slide Update QS).
 Đánh dấu theo TỪNG CÔNG TY, bảng riêng — vì SP kho chung của Dezon thuộc tenant khác,
 công ty khác không được ghi vào dòng sản phẩm đó.                                    ***/
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
  _cacheClear_();
  const out = { ok: ok };
  if (errs.length) out.errors = errs;
  return out;
}

module.exports = { setYeuThich };
