import { useState } from 'react'

/* Các style inline dùng chung — giữ nguyên dạng inline như bản HTML để
   selector của liquid-glass.css (div[style*="var(--surface)"]...) vẫn khớp */
export const panelStyle = { display: 'flex', flexDirection: 'column', gap: 16 }
export const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px' }
export const listCardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '6px 20px 8px' }
export const listHeadStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px' }
export const titleStyle = mb => ({ fontSize: 14.5, fontWeight: 700, marginBottom: mb })
export const descStyle = { fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }
export const primaryBtnStyle = { border: 'none', background: 'var(--primary)', color: '#fff', padding: '9px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
export const smallPrimaryBtnStyle = { border: 'none', background: 'var(--primary)', color: '#fff', padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }

/* Ô nhập liệu có nhãn (class "field" trong HTML) */
export function Field({ label, last, children, ...inputProps }) {
  return (
    <div className="cd-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(last ? {} : { marginBottom: 14 }) }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
      {children
        ? <select style={inputStyle}>{children}</select>
        : <input style={inputStyle} {...inputProps} />}
    </div>
  )
}

/* Tiêu đề + mô tả bên trái của một .settings-row */
export function RowText({ title, desc }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
    </div>
  )
}

/* Công tắc bật/tắt — tự giữ trạng thái (giống [data-toggle] trong HTML) hoặc điều khiển qua props */
export function ToggleSwitch({ defaultOn = false, on, onClick }) {
  const [inner, setInner] = useState(defaultOn)
  const isOn = on !== undefined ? on : inner
  return (
    <div className={`cd-toggle-switch${isOn ? ' on' : ''}`} onClick={onClick || (() => setInner(v => !v))}>
      <div className="cd-knob" />
    </div>
  )
}
