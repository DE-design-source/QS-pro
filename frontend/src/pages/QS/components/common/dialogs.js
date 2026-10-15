/* Hàng đợi hộp thoại dùng chung của QS (thay toast / xacNhan_ / baoLoi_ / askInput_ của bản gốc, PUB/app.js:81, 2178-2240).
   Hàm gọi được ở bất kỳ đâu (kể cả ngoài cây React); <ModalHost/> đọc hàng đợi này và vẽ ra trong .qs-mroot.
     qsToast(msg)                    -> hiện 2,2 giây, lần gọi sau thay chữ và đếm lại
     qsConfirm(o) -> Promise<bool>   o = chuỗi tiêu đề hoặc {title, note, dong[], ok, huy, nguyHiem, chiBao}
     qsAlert(o)   -> Promise<bool>   = baoLoi_: qsConfirm với chiBao, nguyHiem mặc định true
     qsAsk(o)     -> Promise<string | object | null>
                    o = {title, note, label, value, type, placeholder, fields[{key,label,value,type,placeholder}],
                         required, confirmText | ok}; 1 ô -> chuỗi, nhiều ô -> object theo key, Huỷ -> null
   subscribeDialogs(fn) / getDialogs() dành cho ModalHost (useSyncExternalStore). */

const TOAST_MS = 2200

let state = { toast: null, confirm: null, asks: [] }
const subs = new Set()
let toastTimer = null
let seq = 0

function emit(patch) {
  state = { ...state, ...patch }
  subs.forEach(fn => fn())
}

export function subscribeDialogs(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

export function getDialogs() {
  return state
}

export function qsToast(msg) {
  clearTimeout(toastTimer)
  emit({ toast: { id: ++seq, text: String(msg == null ? '' : msg), on: true } })
  toastTimer = setTimeout(() => {
    if (state.toast) emit({ toast: { ...state.toast, on: false } })
  }, TOAST_MS)
}

export function qsConfirm(o) {
  o = typeof o === 'string' ? { title: o } : (o || {})
  /* Bản gốc: mở hộp mới khi hộp cũ còn mở thì hộp cũ coi như "Huỷ" */
  if (state.confirm) state.confirm.resolve(false)
  return new Promise(resolve => {
    const item = { id: ++seq, opts: o, resolve: null }
    item.resolve = v => {
      if (state.confirm && state.confirm.id === item.id) emit({ confirm: null })
      resolve(v)
    }
    emit({ confirm: item })
  })
}

export function qsAlert(o) {
  o = typeof o === 'string' ? { title: o } : (o || {})
  return qsConfirm({ ...o, chiBao: true, nguyHiem: o.nguyHiem !== false })
}

export function qsAsk(o) {
  o = o || {}
  return new Promise(resolve => {
    const item = { id: ++seq, opts: o, resolve: null }
    item.resolve = v => {
      emit({ asks: state.asks.filter(a => a.id !== item.id) })
      resolve(v)
    }
    emit({ asks: [...state.asks, item] })
  })
}

/* Đóng mọi hộp đang mở (vd. khi đăng xuất / rời /qs): confirm -> false, hộp nhập -> null */
export function qsCloseDialogs() {
  if (state.confirm) state.confirm.resolve(false)
  state.asks.slice().forEach(a => a.resolve(null))
  clearTimeout(toastTimer)
  if (state.toast) emit({ toast: null })
}
