/* Loại báo giá của Phần thô (S._ptLoai, nhớ ở localStorage qs_ptLoai như bản gốc).
   Port: PT_LOAI_NHOM PUB/sanpham.js:1336-1341 · ptLoai_ / ptSetLoai phantho.js:310-317 · mmLoai_ app.js:1580-1587 ·
   ptSheetPick_ boc.js:1766-1768. Dùng chung cho cây hạng mục + chip đầu bảng (1B) và panel Phần thô (3A). */
import { useSyncExternalStore } from 'react'

export const PT_LOAI_NHOM = [
  ['kt', '1', 'Khái toán', [['kt_chitiet', '1.1', 'Khái toán chi tiết', 'Chọn nhà thầu → báo giá theo m2 / md / cái'],
    ['kt_sobo', '1.2', 'Khái toán sơ bộ', 'Chọn nhà thầu → chọn dự án mẫu → đơn giá trọn gói']]],
  ['dt', '2', 'Dự toán', [['dt_nhancong', '2.1', 'Nhân công', 'Báo giá theo m2 / md / cái'],
    ['dt_vattu', '2.2', 'Vật tư', 'Báo giá vật tư']]],
]
const PT_SHEET_LOAI = { nc: 'dt_nhancong', vt: 'dt_vattu' }
/* "Khái toán chi tiết" -> "Chi tiết" khi đã nằm dưới nhóm Khái toán */
export const ptLoaiNgan = t => String(t).replace(/^Khái toán (\S)/, (m, c) => c.toUpperCase())

let cur
const subs = new Set()
export function ptLoai_() {
  if (cur === undefined) { try { cur = localStorage.getItem('qs_ptLoai') || 'kt_chitiet' } catch (e) { cur = 'kt_chitiet' } }
  return String(cur || 'kt_chitiet')
}
export function ptSetLoai(v) {
  cur = v
  try { localStorage.setItem('qs_ptLoai', v) } catch (e) { /* bỏ qua */ }
  subs.forEach(fn => fn())
}
export function ptSheetPick_(v) { ptSetLoai(PT_SHEET_LOAI[v] || v || 'kt_chitiet') }
/* Chọn ở cấp phụ của cây (mmLoai_): bấm nhóm khác thì sang loại đầu của nhóm và giữ ô mở để chọn tiếp.
   Trả true khi đã chọn xong (người gọi đóng ô chọn). */
export function mmLoai_(v) {
  const lo = ptLoai_()
  let vuaMoNhom = false
  if (v === 'dt') { vuaMoNhom = lo.indexOf('dt_') !== 0; v = vuaMoNhom ? 'dt_nhancong' : lo }
  else if (v === 'kt') { vuaMoNhom = lo.indexOf('kt_') !== 0; v = vuaMoNhom ? 'kt_chitiet' : lo }
  ptSetLoai(v)
  return !vuaMoNhom
}
const subscribe = fn => { subs.add(fn); return () => subs.delete(fn) }
export function usePtLoai() { return useSyncExternalStore(subscribe, ptLoai_, ptLoai_) }
