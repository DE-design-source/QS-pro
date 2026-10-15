import { useEffect, useRef, useState } from 'react'

/* Bộ icon dùng lặp lại trong trang BIM (đường vẽ SVG giữ nguyên từ bản HTML) */
export const ICONS = {
  cube: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
}

export function Icon({ name, html, size = 14, stroke = 'currentColor', sw = 2, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" style={style}
      dangerouslySetInnerHTML={{ __html: html || ICONS[name] }}
    />
  )
}

/* Bật một trạng thái tạm thời trong `ms` mili-giây (dùng cho nhãn "Đang scan..." của các nút) */
export function useFlash(ms) {
  const [active, setActive] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  function trigger(onDone) {
    if (active) return
    setActive(true)
    timer.current = setTimeout(() => { setActive(false); onDone?.() }, ms)
  }
  return [active, trigger]
}

/* Tiêu đề khu vực: nhãn nhỏ + tiêu đề + mô tả (+ nút bên phải) */
export function SectionHead({ eyebrow, title, desc, descWidth = 520, children }) {
  const text = (
    <div>
      <h2 className="bim-title">{title}</h2>
      <p className="bim-desc" style={{ maxWidth: descWidth }}>{desc}</p>
    </div>
  )
  return (
    <>
      <div className="bim-eyebrow">{eyebrow}</div>
      {children ? <div className="bim-head-row">{text}{children}</div> : text}
    </>
  )
}

export function SearchInput({ value, onChange, placeholder, style }) {
  return (
    <div className="bim-search" style={style}>
      <Icon name="search" />
      <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

export function StatusBadge({ color, children, style }) {
  return <span className="bim-badge" style={{ background: `var(--${color}-tint)`, color: `var(--${color})`, ...style }}>{children}</span>
}
