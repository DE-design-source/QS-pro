import { createContext, useContext, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

/* Ngữ cảnh trỏ tới phần tử .qs-mroot do <ModalHost> tạo (tách file riêng để hộp thoại dùng được mà không vòng import) */
export const MrootCtx = createContext(null)

/* Phần tử .qs-mroot đang gắn, giữ ở cấp module: các panel nằm cạnh <ModalHost/> (không phải con của nó)
   nên không nhận được ngữ cảnh, vẫn phải tìm ra lớp gốc (PLAN 1.8). */
let mrootEl = null
const subs = new Set()

function subscribe(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}
function getEl() {
  return mrootEl
}

/* Chỉ ModalHost gọi: gắn (el) hoặc gỡ (null, chỉ khi el đang là lớp gốc hiện tại) */
export function setMrootEl(el, prev) {
  if (el === null && prev !== undefined && mrootEl !== prev) return
  if (mrootEl === el) return
  mrootEl = el
  subs.forEach(fn => fn())
}

/* Phần tử DOM .qs-mroot (null khi chưa gắn ModalHost nào) */
export function useMroot() {
  const ctx = useContext(MrootCtx)
  const el = useSyncExternalStore(subscribe, getEl, getEl)
  return ctx || el
}

/* Đưa children vào .qs-mroot; chưa có lớp gốc thì vẽ tại chỗ (vẫn nằm trong .qs-page nên còn biến màu) */
export function MrootPortal({ children }) {
  const node = useMroot()
  return node ? createPortal(children, node) : children
}
