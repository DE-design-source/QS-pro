import { useEffect, useRef, useState } from 'react'

/* Lưới bố cục kéo-thả / đổi kích thước cho tab Tổng quan.
   Bản HTML dùng thư viện GridStack (CDN) với cấu hình:
   column 12, cellHeight 56, margin 8, float true, handle '.grid-drag-handle',
   resizable handles 'e, se, s, sw, w'. Ở đây dựng lại bằng React state,
   lưu bố cục vào localStorage đúng định dạng {id:{x,y,w,h}} như bản HTML. */

const COLS = 12
const CELL_H = 56
const HANDLES = ['e', 'se', 's', 'sw', 'w']
/* GridStack không bắt đầu kéo khi nhấn vào các phần tử nhập liệu */
const CANCEL = 'input,textarea,button,select,option'

function collide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/* Đặt ô `id` vào vị trí `rect` rồi đẩy các ô bị đè xuống dưới (float: true — không tự dồn lên) */
function settle(base, id, rect) {
  const nodes = {}
  Object.keys(base).forEach(k => { nodes[k] = { ...base[k] } })
  nodes[id] = { ...rect }
  const push = moverId => {
    const m = nodes[moverId]
    Object.keys(nodes)
      .filter(k => k !== moverId && k !== id)
      .sort((a, b) => nodes[a].y - nodes[b].y)
      .forEach(k => {
        if (collide(nodes[k], m)) { nodes[k].y = m.y + m.h; push(k) }
      })
  }
  push(id)
  return nodes
}

function loadLayout(order, defs, storageKey) {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(storageKey)) || {} } catch { saved = {} }
  const layout = {}
  order.forEach(id => {
    const pos = saved[id] || defs[id]
    /* Bố cục đã lưu nhỏ hơn kích thước tối thiểu (minW/minH) thì nới lại cho đủ chỗ hiển thị */
    layout[id] = { x: pos.x, y: pos.y, w: Math.max(pos.w, defs[id].minW || 1), h: Math.max(pos.h, defs[id].minH || 1) }
  })
  return layout
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export default function OverviewGrid({ order, defs, storageKey, renderItem }) {
  const [layout, setLayout] = useState(() => loadLayout(order, defs, storageKey))
  /* active = { id, mode:'drag'|'resize', px:{left,top,width,height}, target:{x,y,w,h}, base } */
  const [active, setActive] = useState(null)
  const gridRef = useRef(null)
  const cleanupRef = useRef(null)

  useEffect(() => () => { if (cleanupRef.current) cleanupRef.current() }, [])

  function start(e, id, mode, dir) {
    if (e.button !== 0) return
    if (mode === 'drag' && (!e.target.closest('.kd-grid-drag-handle') || e.target.closest(CANCEL))) return
    e.preventDefault()
    const gw = gridRef.current.getBoundingClientRect().width
    const colW = gw / COLS
    const base = layout
    const n = base[id]
    const from = { left: n.x * colW, top: n.y * CELL_H, width: n.w * colW, height: n.h * CELL_H }
    const startX = e.clientX
    const startY = e.clientY
    let started = false
    let latest = n

    function onMove(ev) {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!started && Math.abs(dx) + Math.abs(dy) < 3) return
      started = true
      let px
      let target
      if (mode === 'drag') {
        px = { ...from, left: from.left + dx, top: Math.max(0, from.top + dy) }
        target = { x: clamp(Math.round(px.left / colW), 0, COLS - n.w), y: Math.max(0, Math.round(px.top / CELL_H)), w: n.w, h: n.h }
      } else {
        let { left, width, height } = from
        if (dir.indexOf('e') > -1) width = clamp(from.width + dx, colW, gw - from.left)
        if (dir.indexOf('w') > -1) {
          width = clamp(from.width - dx, colW, from.left + from.width)
          left = from.left + from.width - width
        }
        if (dir.indexOf('s') > -1) height = Math.max(CELL_H, from.height + dy)
        px = { left, top: from.top, width, height }
        const w = clamp(Math.round(width / colW), defs[id].minW || 1, COLS)
        const h = Math.max(defs[id].minH || 1, Math.round(height / CELL_H))
        const x = dir.indexOf('w') > -1 ? clamp(n.x + n.w - w, 0, COLS - 1) : n.x
        target = { x, y: n.y, w: Math.min(w, COLS - x), h }
      }
      latest = target
      setActive({ id, mode, px, target, base })
    }
    function stop() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      cleanupRef.current = null
    }
    function onUp() {
      stop()
      if (!started) return
      const next = settle(base, id, latest)
      setLayout(next)
      setActive(null)
      /* Bản HTML: ovGrid.on('change', ovSaveLayout) */
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* bỏ qua */ }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    cleanupRef.current = stop
  }

  const shown = active ? settle(active.base, active.id, active.target) : layout
  const rows = order.reduce((m, id) => Math.max(m, shown[id].y + shown[id].h), 0)
  const cellStyle = n => ({ left: `${n.x / COLS * 100}%`, top: n.y * CELL_H, width: `${n.w / COLS * 100}%`, height: n.h * CELL_H })

  return (
    <div className="kd-grid-stack" ref={gridRef} style={{ height: rows * CELL_H }}>
      {order.map(id => {
        const isActive = active && active.id === id
        const style = isActive ? { left: active.px.left, top: active.px.top, width: active.px.width, height: active.px.height } : cellStyle(shown[id])
        return (
          <div
            key={id}
            className={`kd-grid-item${isActive ? (active.mode === 'drag' ? ' dragging' : ' resizing') : ''}`}
            style={style}
            onMouseDown={e => start(e, id, 'drag')}
          >
            <div className="kd-grid-item-content">{renderItem(id)}</div>
            {HANDLES.map(d => (
              <div key={d} className={`kd-resize-handle kd-resize-${d}`} onMouseDown={e => { e.stopPropagation(); start(e, id, 'resize', d) }} />
            ))}
          </div>
        )
      })}
      {active && (
        <div className="kd-grid-item kd-grid-placeholder" style={cellStyle(active.target)}>
          <div className="kd-placeholder-content" />
        </div>
      )}
    </div>
  )
}
