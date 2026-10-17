import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NOTIFICATIONS, NOTIF_MODULES } from '../../data/notificationsData'
import './NotificationBell.css'

/* Chuông thông báo đầu trang — mở bảng thông báo, lọc chưa đọc, bấm để đi tới trang liên quan.
   Trạng thái đã đọc chỉ lưu trên trình duyệt của người xem (tiện dụng, không bắt buộc). */
const READ_KEY = 'siteflow-notif-read'
const loadRead = () => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')) } catch { return new Set() } }
const saveRead = s => { try { localStorage.setItem(READ_KEY, JSON.stringify([...s])) } catch { /* bỏ qua */ } }

export default function NotificationBell({ size = 20, color = 'var(--text)' }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('all')
  const [read, setRead] = useState(loadRead)
  const ref = useRef(null)

  useEffect(() => { saveRead(read) }, [read])
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const isUnread = n => n.unread && !read.has(n.id)
  const unread = NOTIFICATIONS.filter(isUnread).length
  const list = tab === 'unread' ? NOTIFICATIONS.filter(isUnread) : NOTIFICATIONS
  const markAll = () => setRead(new Set(NOTIFICATIONS.map(n => n.id)))
  const go = n => { setRead(s => new Set([...s, n.id])); setOpen(false); navigate(n.to) }

  return (
    <div className="nb" ref={ref}>
      <button type="button" className={`nb-btn${open ? ' on' : ''}`} title="Thông báo" aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ''}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8z" /><path d="M9.5 17.5a2.5 2.5 0 0 0 5 0" /></svg>
        {unread > 0 && <span className="nb-count">{unread}</span>}
      </button>
      {open && (
        <div className="nb-popover" role="dialog" aria-label="Thông báo">
          <div className="nb-head">
            <b>Thông báo</b>
            <button type="button" className="nb-link" disabled={!unread} onClick={markAll}>Đánh dấu đã đọc tất cả</button>
          </div>
          <div className="nb-tabs">
            <button type="button" className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Tất cả</button>
            <button type="button" className={tab === 'unread' ? 'active' : ''} onClick={() => setTab('unread')}>Chưa đọc{unread ? ` (${unread})` : ''}</button>
          </div>
          <div className="nb-list">
            {list.length === 0 && <div className="nb-empty">Bạn đã đọc hết thông báo 🎉</div>}
            {list.map(n => {
              const m = NOTIF_MODULES[n.module] || NOTIF_MODULES.it
              const un = isUnread(n)
              return (
                <button type="button" key={n.id} className={`nb-item${un ? ' unread' : ''}`} onClick={() => go(n)}>
                  <span className="nb-ic" style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
                  </span>
                  <span className="nb-txt">
                    <b>{n.title}</b>
                    <span>{n.text}</span>
                    <em>{m.label} · {n.time}</em>
                  </span>
                  {un && <i className="nb-dot" title="Chưa đọc" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
