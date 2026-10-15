/* Bộ tick dòng dùng chung Bóc tách / Chi phí / Dự án (S._tkSel của bản gốc): tick ở tab nào cũng thấy ở tab kia.
   Port: tkSelHas_ / tkSelLines_ / tkSelClick_ PUB/boc.js:914-940. Giữ ở cấp module (ngoài cây React).
   Chuyển từ components/cost/tickSel.js theo requests/2-fixer-2A.txt R2; code giữ nguyên. */
import { useSyncExternalStore } from 'react'

let T = { ma: null, ids: [] }
let anchor = null
const subs = new Set()
const emit = () => subs.forEach(fn => fn())
const sub = fn => { subs.add(fn); return () => subs.delete(fn) }
const get = () => T

/* -> {ma, ids}: bộ tick của dự án ma (đổi dự án thì coi như trống) */
export function useTicks(maDA) {
  const t = useSyncExternalStore(sub, get, get)
  return t.ma === maDA ? t.ids : []
}
export function tickClear_() { anchor = null; if (T.ids.length) { T = { ma: T.ma, ids: [] }; emit() } }
/* Tick thêm mọi dòng đang hiện (tkSelAllVisible_ boc.js:949) */
export function tickSet_(maDA, ids) {
  const m = new Set(T.ma === maDA ? T.ids : [])
  ids.forEach(id => m.add(id))
  T = { ma: maDA, ids: [...m] }
  emit()
}
/* Bấm ô tick (tkSelClick_): Shift = tick cả vùng từ dòng neo theo thứ tự dòng đang hiện (shownIds) */
export function tickClick_(ev, maDA, id, shownIds) {
  const m = new Set(T.ma === maDA ? T.ids : [])
  const i = shownIds.indexOf(id)
  if (ev && ev.shiftKey && anchor != null) {
    let a = shownIds.indexOf(anchor); if (a < 0) a = i
    for (let x = Math.min(a, i); x <= Math.max(a, i); x++) m.add(shownIds[x])
  } else {
    if (m.has(id)) m.delete(id); else m.add(id)
    anchor = id
  }
  T = { ma: maDA, ids: [...m] }
  emit()
}
