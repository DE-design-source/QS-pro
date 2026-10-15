import { useEffect, useRef, useState } from 'react'

const dotStyle = { width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }

/* Nút "Đồng bộ lại": Đang đồng bộ… → Đã đồng bộ ✓ → trở về ban đầu */
function ResyncButton() {
  const [state, setState] = useState('idle')
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  function run() {
    setState('syncing')
    timers.current.push(setTimeout(() => {
      setState('done')
      timers.current.push(setTimeout(() => setState('idle'), 1400))
    }, 800))
  }
  const label = state === 'syncing' ? 'Đang đồng bộ…' : state === 'done' ? 'Đã đồng bộ ✓' : 'Đồng bộ lại'
  return <button className="lc-sync-popover-btn" disabled={state !== 'idle'} onClick={run}>{label}</button>
}

/* Cụm trạng thái đồng bộ Google / Lark trên header (+ popover) */
export default function SyncStatus() {
  const [open, setOpen] = useState(false)

  /* Bấm ra ngoài thì đóng popover */
  useEffect(() => {
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <div className="lc-sync-status-cluster" onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
      <button className="lc-sync-badge" type="button"><span className="lc-dot" />Google</button>
      <button className="lc-sync-badge" type="button"><span className="lc-dot" />Lark</button>
      <div className={`lc-sync-popover${open ? ' open' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="lc-sync-popover-row"><span className="lc-lbl"><span style={dotStyle} />Google Calendar</span><ResyncButton /></div>
        <div className="lc-sync-popover-row"><span className="lc-lbl"><span style={dotStyle} />Lark Calendar</span><ResyncButton /></div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border)' }}>Đồng bộ 2 chiều — thay đổi ở SiteFlow, Google hoặc Lark đều tự cập nhật sang 2 bên còn lại.</div>
      </div>
    </div>
  )
}
