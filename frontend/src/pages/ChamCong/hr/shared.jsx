import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { avatarColor, initials, deptOf, STATUS } from '../../../data/hrData'

/* Thành phần dùng chung cho phân hệ HR (tiền tố class "cc-") */

export function Avatar({ emp, size = 32 }) {
  return (
    <span className="cc-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: avatarColor(emp.id) }}>
      {initials(emp.name)}
    </span>
  )
}

export function Pill({ tone = 'muted', children, dot }) {
  return <span className={`cc-pill2 cc-tone-${tone}`}>{dot && <i />}{children}</span>
}
export const DeptPill = ({ dept }) => { const d = deptOf(dept); return <Pill tone={d.tone}>{d.name}</Pill> }
export const StatusPill = ({ status }) => <Pill tone={STATUS[status].tone} dot>{STATUS[status].label}</Pill>

export function Seg({ value, onChange, options }) {
  return (
    <div className="cc-seg" role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={13} />}{o.label}{o.count != null && <span className="cc-seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, sub, icon, tone = 'attendance', width = 560, children, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="cc-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cc-modal" style={{ width }} role="dialog" aria-modal="true">
        <div className="cc-modal-head">
          {icon && <span className={`cc-ico cc-tone-${tone}`}><Icon name={icon} size={16} /></span>}
          <div className="cc-grow">
            <h3>{title}</h3>
            {sub && <div className="cc-sub">{sub}</div>}
          </div>
          <button className="cc-icon-btn" aria-label="Đóng" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="cc-modal-body">{children}</div>
        {footer && <div className="cc-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, full, hint }) {
  return (
    <label className={`cc-f${full ? ' full' : ''}`}>
      <span className="cc-f-label">{label}</span>
      {children}
      {hint && <span className="cc-f-hint">{hint}</span>}
    </label>
  )
}

export function Empty({ icon = 'inbox', text }) {
  return <div className="cc-empty"><Icon name={icon} size={24} stroke={1.6} /><span>{text}</span></div>
}

/* Thông báo nhỏ ở góc màn hình */
export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const show = useCallback((text, tone = 'success') => {
    clearTimeout(timer.current)
    setToast({ text, tone, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const node = toast && (
    <div key={toast.key} className={`cc-toast cc-tone-${toast.tone}`} role="status">
      <Icon name={toast.tone === 'danger' ? 'alert' : 'checkCircle'} size={15} />{toast.text}
    </div>
  )
  return [node, show]
}

/* Xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt) */
export function downloadCsv(filename, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
