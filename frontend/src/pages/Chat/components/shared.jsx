/* Phần dùng chung của trang Chat: initials(), iconSvg(), convAvatarHTML() trong chat.html */

export function initials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* iconSvg(kind) — icon trắng 19px của nhóm / bot */
export function IconSvg({ kind }) {
  const p = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (kind === 'building') return <svg {...p}><path d="M6 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18" /><path d="M6 12h12M6 8h12M6 16h12" /><path d="M10 22v-4h4v4" /></svg>
  if (kind === 'hardhat') return <svg {...p}><path d="M3 18h18" /><path d="M5 18a7 7 0 0 1 14 0" /><path d="M12 8v3" /><path d="M9 4h6" /></svg>
  if (kind === 'bot') return <svg {...p}><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4" /><circle cx="9" cy="14" r="1.2" fill="#fff" stroke="none" /><circle cx="15" cy="14" r="1.2" fill="#fff" stroke="none" /></svg>
  return null
}

/* convAvatarHTML(c, size) — extraClass dùng cho đầu thread ("conv-avatar t-avatar") */
export function ConvAvatar({ conv, size = 42, extraClass = '' }) {
  const style = { width: size, height: size, background: conv.color }
  const cls = 'ch-conv-avatar' + (extraClass ? ' ' + extraClass : '')
  if (conv.type === 'dm') {
    return (
      <div className={cls + ' round'} style={style}>
        {initials(conv.name)}
        {conv.online && <span className="ch-dot-online" />}
      </div>
    )
  }
  return <div className={cls} style={style}><IconSvg kind={conv.type === 'bot' ? 'bot' : conv.icon} /></div>
}

/* Đường path của icon ghim (dùng ở danh sách hội thoại, bubble, thanh ghim) */
export const PIN_PATH = 'M12 2a1 1 0 0 1 1 1v7l3 4v2H8v-2l3-4V3a1 1 0 0 1 1-1z'

/* Icon tệp (file-chip, attach preview, info panel) */
export function FileIcon({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
}

/* Icon nhóm người (nút Danh bạ, nút thêm người vào nhóm) */
export function UsersIcon({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}

/* Icon kính lúp của ô tìm kiếm */
export function SearchIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
}
