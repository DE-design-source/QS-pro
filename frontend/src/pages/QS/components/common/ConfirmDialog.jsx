import { useEffect, useRef } from 'react'
import QsIcon from './QsIcon'
import { MrootPortal } from './Mroot'
import './common.css'

/* Hộp xác nhận / báo lỗi (port xacNhan_ / baoLoi_, PUB/app.js:2178-2201). Thường mở qua qsConfirm()/qsAlert() (dialogs.js).
   Props: opts = {title, note, dong[] (tối đa 200 dòng hiện), ok, huy, nguyHiem, chiBao}; onDone(bool).
   Esc / bấm ra ngoài = false, Enter = true; nút đồng ý được focus sẵn. */
export default function ConfirmDialog({ opts, onDone }) {
  const o = opts || {}
  const okRef = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const key = e => {
      if (e.key === 'Escape') doneRef.current(false)
      if (e.key === 'Enter') { e.preventDefault(); doneRef.current(true) }
    }
    document.addEventListener('keydown', key)
    if (okRef.current) okRef.current.focus()
    return () => document.removeEventListener('keydown', key)
  }, [])

  const all = o.dong || []
  const ds = all.slice(0, 200)

  return (
    <MrootPortal>
      <div className="qsc-ov" onClick={e => { if (e.target === e.currentTarget) onDone(false) }}>
        <div className={`qsc-dlg qsc-xn${o.nguyHiem ? ' red' : ''}`} role="alertdialog" aria-modal="true">
          <div className="qsc-xn-h">
            <QsIcon name={o.nguyHiem ? 'trash' : 'bell'} size={18} />
            <h3>{o.title || 'Xác nhận'}</h3>
          </div>
          {o.note ? <div className="qsc-xn-note">{String(o.note)}</div> : null}
          {ds.length ? (
            <div className="qsc-xn-b">
              {ds.map((t, i) => <div key={i} className="qsc-xn-i">{String(t)}</div>)}
              {all.length > ds.length && <div className="qsc-xn-i more">… và {all.length - ds.length} dòng nữa</div>}
            </div>
          ) : null}
          <div className="qsc-xn-f">
            {!o.chiBao && <button type="button" className="qsc-btn" onClick={() => onDone(false)}>{o.huy || 'Huỷ'}</button>}
            <button type="button" ref={okRef} className={`qsc-btn ${o.nguyHiem ? 'red' : 'blue'}`} onClick={() => onDone(true)}>
              {o.ok || (o.chiBao ? 'Đã hiểu' : 'Đồng ý')}
            </button>
          </div>
        </div>
      </div>
    </MrootPortal>
  )
}
