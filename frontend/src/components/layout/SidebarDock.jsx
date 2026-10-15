import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { NAV_MAIN, NAV_BOTTOM } from '../../data/navigation'

const SIZE = 44 // đường kính nút tròn
const MARGIN = 6 // khoảng cách tối thiểu tới mép màn hình
const POS_KEY = 'siteflow-dock-pos'
const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
const clamp = p => ({
  x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - SIZE - MARGIN),
  y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - SIZE - MARGIN),
})

/* Vị trí đã lưu, chưa có thì đặt giữa mép trên (vùng thường trống của thanh tiêu đề trang) */
function initialPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY))
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return clamp(p)
  } catch { /* bỏ qua */ }
  return clamp({ x: window.innerWidth / 2 - SIZE / 2, y: 10 })
}

function ItemIcon({ pathData, size = 18 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}
      dangerouslySetInnerHTML={{ __html: pathData }}
    />
  )
}

const actIcon = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

/*
 * Sidebar khi thu gọn tối đa: một nút tròn nổi, kéo đi được.
 *  - Rê chuột vào: nở thành thanh hiện trang đang mở + các nút tải lại / mở rộng sidebar / đóng.
 *  - Bấm vào: bung menu đầy đủ (có ô tìm trang) ở mép màn hình.
 */
export default function SidebarDock({ onExpand }) {
  const [pos, setPos] = useState(initialPos)
  const [dragging, setDragging] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pillOff, setPillOff] = useState(false) // đã bấm X: ẩn thanh cho tới khi chuột rời nút
  const [q, setQ] = useState('')
  const drag = useRef(null)
  const dockRef = useRef(null)
  const menuRef = useRef(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  /* Đổi cỡ cửa sổ: giữ nút trong màn hình */
  useEffect(() => {
    const onResize = () => setPos(p => clamp(p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* Menu đang mở: bấm ra ngoài hoặc nhấn Esc để đóng */
  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = e => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !dockRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  /* Kéo nút để đổi chỗ; nhả ra mà chưa kéo quá vài pixel thì tính là bấm (mở / đóng menu) */
  function onPointerDown(e) {
    if (e.button !== 0) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* con trỏ không còn hợp lệ */ }
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, moved: false }
  }
  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.px, dy = e.clientY - d.py
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return
    d.moved = true
    setDragging(true)
    setPos(clamp({ x: d.x + dx, y: d.y + dy }))
  }
  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved) {
      setDragging(false)
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* bỏ qua */ }
    } else {
      setQ('')
      setMenuOpen(o => !o)
    }
  }

  const all = [...NAV_MAIN, ...NAV_BOTTOM]
  const current = all.find(i => (i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(i.path + '/')))
  const key = fold(q.trim())
  const match = i => !key || fold(i.label).includes(key)
  const main = NAV_MAIN.filter(match)
  const bottom = NAV_BOTTOM.filter(match)

  function go(item) {
    navigate(item.path)
    setMenuOpen(false)
  }

  const item = i => (
    <NavLink key={i.path} to={i.path} end={i.path === '/'} className={({ isActive }) => 'sidebar-nav-item' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
      <ItemIcon pathData={i.icon} />
      <span style={{ flex: 1 }}>{i.label}</span>
      {i.badge && <span className="sidebar-menu-badge">{i.badge}</span>}
    </NavLink>
  )

  /* Nút nằm nửa phải màn hình thì thanh nở sang trái để không tràn ra ngoài */
  const toLeft = pos.x + SIZE / 2 > window.innerWidth / 2
  const place = toLeft
    ? { top: pos.y - 4, right: window.innerWidth - pos.x - SIZE - 4 }
    : { top: pos.y - 4, left: pos.x - 4 }

  return (
    <>
      <div
        ref={dockRef}
        className={`sidebar-dock${toLeft ? ' left' : ''}${dragging ? ' dragging' : ''}${menuOpen ? ' menu-open' : ''}${pillOff ? ' pill-off' : ''}`}
        style={place}
        onMouseLeave={() => setPillOff(false)}
      >
        <button
          type="button" className="sidebar-dock-logo" title={menuOpen ? 'Đóng menu' : 'Mở menu (kéo để đổi chỗ)'}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        >
          {/* Logo của app, giống logo ở đầu sidebar */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z" />
            <circle cx="12" cy="9" r="2.3" />
          </svg>
        </button>
        <div className="sidebar-dock-pill">
          <span className="sidebar-dock-page">{current ? <ItemIcon pathData={current.icon} size={16} /> : null}</span>
          <span className="sidebar-dock-title"><b>{current ? current.label : 'SiteFlow'}</b><small>Đang hoạt động</small></span>
          <button type="button" className="sidebar-dock-act" title="Tải lại trang" onClick={() => window.location.reload()}>
            <svg {...actIcon}><path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" /></svg>
          </button>
          <button type="button" className="sidebar-dock-act" title="Mở rộng sidebar" onClick={onExpand}>
            <svg {...actIcon}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          </button>
          <button type="button" className="sidebar-dock-act" title="Đóng" onClick={() => setPillOff(true)}>
            <svg {...actIcon}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div ref={menuRef} className="sidebar-flyout sidebar-menu">
          <div className="sidebar-menu-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              autoFocus value={q} placeholder="Tìm trang…" onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (main[0] || bottom[0])) go(main[0] || bottom[0]) }}
            />
            <button type="button" title="Mở rộng sidebar" onClick={onExpand}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /></svg>
            </button>
          </div>
          <nav>
            {main.length > 0 && <div className="sidebar-menu-label">Menu</div>}
            {main.map(item)}
            {bottom.length > 0 && <div className="sidebar-menu-label">Ứng dụng</div>}
            {bottom.map(item)}
            {main.length + bottom.length === 0 && <div className="sidebar-menu-empty">Không có trang nào khớp.</div>}
          </nav>
          <div className="sidebar-menu-user">
            <span>TA</span>
            <div><b>Trần Anh</b><small>Quản lý dự án</small></div>
          </div>
        </div>
      )}
    </>
  )
}
