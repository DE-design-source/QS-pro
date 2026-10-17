import { createContext, useContext, useState } from 'react'

/* Cài đặt người dùng (lưu ở localStorage "siteflow-settings") — CaiDat.jsx cấp giá trị,
   các tab đọc/ghi qua useSettings() để không ghi đè lẫn nhau */
export const SettingsContext = createContext({ s: {}, update: () => {} })
export const useSettings = () => useContext(SettingsContext)

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

/* Thẻ chứa một nhóm cài đặt */
export function Section({ title, desc, children }) {
  return (
    <div style={cardStyle}>
      <h3 style={titleStyle(desc ? 4 : 14)}>{title}</h3>
      {desc && <p style={descStyle}>{desc}</p>}
      {children}
    </div>
  )
}

/* Nhãn + mô tả của một cụm lựa chọn bên trong Section */
export function Group({ label, desc, children }) {
  return (
    <div className="cd-group">
      <div className="cd-group-label">{label}</div>
      {desc && <div className="cd-group-desc">{desc}</div>}
      {children}
    </div>
  )
}

/* Ô tick gắn với khoá k của cài đặt; children = các lựa chọn con, chỉ hiện khi đang bật.
   forced: luôn tick và khoá lại (đã được bao gồm bởi lựa chọn cha) */
export function Check({ k, label, desc, forced, children }) {
  const { s, update } = useSettings()
  const checked = forced || !!s[k]
  return (
    <>
      <label className={`cd-check${forced ? ' disabled' : ''}`}>
        <input type="checkbox" checked={checked} disabled={forced} onChange={e => update({ [k]: e.target.checked })} />
        <span>
          {label}
          {desc && <span className="cd-check-desc">{desc}</span>}
        </span>
      </label>
      {children && checked ? <div className="cd-sub">{children}</div> : null}
    </>
  )
}

/* Nhóm radio xếp dọc — options: [{ value, label, desc }] */
export function Radios({ k, options }) {
  const { s, update } = useSettings()
  return options.map(o => (
    <label key={o.value} className="cd-check">
      <input type="radio" name={`cd-${k}`} checked={s[k] === o.value} onChange={() => update({ [k]: o.value })} />
      <span>
        {o.label}
        {o.desc && <span className="cd-check-desc">{o.desc}</span>}
      </span>
    </label>
  ))
}

/* Thẻ chọn có hình xem trước — options: [{ value, label, preview }] */
export function Choices({ k, options }) {
  const { s, update } = useSettings()
  return (
    <div className="cd-choice-grid">
      {options.map(o => (
        <label key={o.value} className={`cd-choice${s[k] === o.value ? ' active' : ''}`}>
          <div className="cd-choice-preview">{o.preview}</div>
          <div className="cd-choice-foot">
            <input type="radio" name={`cd-${k}`} checked={s[k] === o.value} onChange={() => update({ [k]: o.value })} />
            {o.label}
          </div>
        </label>
      ))}
    </div>
  )
}

/* Ô chọn thả xuống — options: [[value, label]] */
export function Select({ k, options, hint }) {
  const { s, update } = useSettings()
  return (
    <>
      <select className="cd-select" value={s[k]} onChange={e => update({ [k]: e.target.value })}>
        {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {hint && <div className="cd-group-desc" style={{ marginTop: 6 }}>{hint}</div>}
    </>
  )
}

/* Thanh giả lập một dòng nội dung trong hình xem trước */
export function Bar({ w, color = 'var(--surface-alt)', h = 10, style }) {
  return <div style={{ width: w, height: h, borderRadius: 4, background: color, flex: 'none', ...style }} />
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
