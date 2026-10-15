import { useEffect, useId, useRef, useState } from 'react'
import { MrootPortal } from './Mroot'
import './common.css'

/* Hộp nhập liệu (port askInput_, PUB/app.js:2203-2240). Thường mở qua qsAsk() (dialogs.js).
   Props: opts = {title, note, label, value, type, placeholder, fields[{key,label,value,type,placeholder}], required,
                  confirmText | ok}; onDone(kết quả): 1 ô -> chuỗi đã trim, nhiều ô -> {key: chuỗi}, Huỷ / Esc / bấm ra ngoài -> null.
   Ô trống khi required !== false -> báo "Vui lòng nhập đầy đủ." và không đóng. */
export default function InputDialog({ opts, onDone }) {
  const o = opts || {}
  const fields = o.fields || [{ key: 'v', label: o.label || '', value: o.value || '', type: o.type || 'text', placeholder: o.placeholder || '' }]
  const [vals, setVals] = useState(() => fields.map(f => (f.value == null ? '' : String(f.value))))
  const [err, setErr] = useState('')
  const uid = useId()
  const firstRef = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') doneRef.current(null) }
    document.addEventListener('keydown', esc)
    const t = setTimeout(() => { if (firstRef.current) { firstRef.current.focus(); firstRef.current.select() } }, 40)
    return () => { document.removeEventListener('keydown', esc); clearTimeout(t) }
  }, [])

  function submit() {
    const out = {}
    let ok = true
    fields.forEach((f, i) => {
      const v = String(vals[i] || '').trim()
      out[f.key] = v
      if (!v && o.required !== false) ok = false
    })
    if (!ok) { setErr('Vui lòng nhập đầy đủ.'); return }
    onDone(fields.length === 1 ? out[fields[0].key] : out)
  }

  return (
    <MrootPortal>
      <div
        className="qsc-ov"
        onClick={e => { if (e.target === e.currentTarget) onDone(null) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
      >
        <div className="qsc-dlg qsc-ask" role="dialog" aria-modal="true">
          <div className="qsc-ask-h">
            <h3>{o.title || 'Nhập thông tin'}</h3>
            <button type="button" className="qsc-x" onClick={() => onDone(null)}>✕</button>
          </div>
          {o.note ? <p className="qsc-ask-note">{o.note}</p> : null}
          {fields.map((f, i) => (
            <div key={f.key || i} className="qsc-ask-f">
              <label htmlFor={uid + i}>{f.label || ''}</label>
              <input
                id={uid + i}
                ref={i === 0 ? firstRef : undefined}
                className="qsc-ask-in"
                type={f.type || 'text'}
                value={vals[i]}
                placeholder={f.placeholder || ''}
                onChange={e => { const v = e.target.value; setVals(a => a.map((x, j) => (j === i ? v : x))) }}
              />
            </div>
          ))}
          {err ? <div className="qsc-ask-err">{err}</div> : null}
          <div className="qsc-ask-btns">
            <button type="button" className="qsc-btn" onClick={() => onDone(null)}>Huỷ</button>
            <button type="button" className="qsc-btn blue" onClick={submit}>{o.confirmText || o.ok || 'Xác nhận'}</button>
          </div>
        </div>
      </div>
    </MrootPortal>
  )
}
