import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import Toast from './Toast'
import ConfirmDialog from './ConfirmDialog'
import InputDialog from './InputDialog'
import { getDialogs, subscribeDialogs } from './dialogs'
import { MrootCtx, setMrootEl } from './Mroot'
import './common.css'

export { useMroot, MrootPortal } from './Mroot'

/* Lớp gốc <div class="qs-mroot"> cho mọi hộp thoại / popup / toast của QS (PLAN 1.8).
   Đặt MỘT lần bên trong .qs-page (không portal ra document.body vì biến màu nằm trên .qs-page).
   Props: children (modal riêng muốn đặt thẳng trong lớp gốc).
   Tự vẽ toast / hộp xác nhận / hộp nhập từ hàng đợi dialogs.js (qsToast, qsConfirm, qsAlert, qsAsk).
   Component ở bất kỳ đâu (kể cả panel nằm cạnh ModalHost, không phải con) dùng <MrootPortal> / useMroot()
   để đưa modal/popup của mình vào lớp gốc: phần tử lớp gốc được giữ ở cấp module (Mroot.jsx). */
export default function ModalHost({ children }) {
  const [node, setNode] = useState(null)
  const d = useSyncExternalStore(subscribeDialogs, getDialogs, getDialogs)

  useLayoutEffect(() => {
    if (!node) return undefined
    setMrootEl(node)
    return () => setMrootEl(null, node)
  }, [node])

  return (
    <MrootCtx.Provider value={node}>
      <div className="qs-mroot" ref={setNode}>
        {children}
        {d.asks.map(a => <InputDialog key={a.id} opts={a.opts} onDone={a.resolve} />)}
        {d.confirm && <ConfirmDialog key={d.confirm.id} opts={d.confirm.opts} onDone={d.confirm.resolve} />}
        <Toast text={d.toast ? d.toast.text : ''} on={!!(d.toast && d.toast.on)} />
      </div>
    </MrootCtx.Provider>
  )
}
