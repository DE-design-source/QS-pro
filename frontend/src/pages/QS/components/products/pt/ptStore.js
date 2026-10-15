/* Trạng thái giao diện riêng của bảng công tác (S._ptView, S._ptOrder2 / S._ptW2 / S._ptColsOn / S._ptColsOnBak của bản gốc),
   giữ ở cấp module: đổi tab / rời /qs rồi quay lại vẫn còn. Ô tìm, trang, dòng đã tick, bộ lọc và số dòng/trang dùng CHUNG với
   bảng sản phẩm (spStore: q, page, sel, f, per) như S._spFilters / S._spSel của bản gốc. Edit (sửa nhanh) tách riêng: bật ở bảng
   công tác chỉ đổi bộ cột công tác. Đổi phiên (tài khoản / công ty xem) thì về trạng thái đầu. */
import { useSyncExternalStore } from 'react'
import { getState, subscribe } from '../../../state/store'
import { ptCfgLoad_ } from './ptModel'

function init() { return { view: 'all', cfg: null, onBak: null, edit: false, ovrVer: 0 } }
let P = init()
const subs = new Set()
let lastKey = getState().key
subscribe(() => {
  const k = getState().key
  if (k !== lastKey) { lastKey = k; setP(init()) }
})
export function getP() { return P }
export function setP(patch) {
  P = { ...P, ...(typeof patch === 'function' ? patch(P) : patch) }
  subs.forEach(fn => fn())
}
export function usePt() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, () => P, () => P)
}
/* bộ cột: nạp lần đầu từ qs_ptcolcfg */
export function ptCfg_() {
  if (!P.cfg) P = { ...P, cfg: ptCfgLoad_() }
  return P.cfg
}
