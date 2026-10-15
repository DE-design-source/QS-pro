import { useEffect, useRef, useState } from 'react'

/* Lưới widget kéo-thả / đổi kích thước cho tab Tổng quan — cùng cơ chế với lưới Tổng quan của trang Kinh doanh
   (12 cột, kéo mép e/s/w và góc se/sw để đổi kích thước, kéo tiêu đề để đổi chỗ, các ô bị đè tự đẩy xuống).
   Bố cục lưu vào localStorage dạng {id:{x,y,w,h}}. */

const COLS = 12
export const CELL_H = 44
const HANDLES = ['e', 'se', 's', 'sw', 'w']
const CANCEL = 'input,textarea,button,select,option,a'

function collide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/* Đặt ô `id` vào `rect` rồi đẩy các ô bị đè xuống dưới */
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
    layout[id] = { x: pos.x, y: pos.y, w: pos.w, h: pos.h }
  })
  return layout
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

/* Tìm các đường gióng giữa ô đang kéo `t` và các ô khác: so mép trái–trái, phải–phải, tâm–tâm (dọc)
   và mép trên–trên, dưới–dưới, tâm–tâm (ngang). Đường gióng kéo dài phủ cả 2 ô. Đơn vị: ô lưới. */
function alignGuides(t, others) {
  const found = {}
  const add = (axis, kind, pos, offset, from, to) => {
    const key = `${axis}-${kind}-${pos}`
    const g = found[key]
    found[key] = g ? { ...g, from: Math.min(g.from, from), to: Math.max(g.to, to) } : { key, axis, pos, offset, from, to }
  }
  others.forEach(o => {
    const vFrom = Math.min(t.y, o.y), vTo = Math.max(t.y + t.h, o.y + o.h)
    const hFrom = Math.min(t.x, o.x), hTo = Math.max(t.x + t.w, o.x + o.w)
    if (t.x === o.x) add('v', 'l', t.x, 8, vFrom, vTo)
    if (t.x + t.w === o.x + o.w) add('v', 'r', t.x + t.w, -8, vFrom, vTo)
    if (t.x * 2 + t.w === o.x * 2 + o.w) add('v', 'c', t.x + t.w / 2, 0, vFrom, vTo)
    if (t.y === o.y) add('h', 't', t.y, 8, hFrom, hTo)
    if (t.y + t.h === o.y + o.h) add('h', 'b', t.y + t.h, -8, hFrom, hTo)
    if (t.y * 2 + t.h === o.y * 2 + o.h) add('h', 'c', t.y + t.h / 2, 0, hFrom, hTo)
  })
  return Object.values(found)
}

/* editing: chỉ khi bật "Tùy chỉnh bố cục" mới kéo/đổi kích thước được.
   resetSignal: mỗi lần giá trị đổi → trả toàn bộ bố cục về mặc định. */
export default function WidgetGrid({ order, defs, storageKey, renderItem, editing, resetSignal }) {
  const [layout, setLayout] = useState(() => loadLayout(order, defs, storageKey))
  /* active = { id, mode:'drag'|'resize', px:{left,top,width,height}, target:{x,y,w,h}, base } */
  const [active, setActive] = useState(null)
  const gridRef = useRef(null)
  const cleanupRef = useRef(null)

  useEffect(() => () => { if (cleanupRef.current) cleanupRef.current() }, [])

  const firstReset = useRef(true)
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return }
    const next = {}
    order.forEach(id => { next[id] = { ...defs[id] } })
    setLayout(next)
    try { localStorage.removeItem(storageKey) } catch { /* bỏ qua */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  function start(e, id, mode, dir) {
    if (e.button !== 0) return
    if (!editing) return
    if (mode === 'drag' && e.target.closest(CANCEL)) return
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
        if (dir.indexOf('e') > -1) width = clamp(from.width + dx, colW * 2, gw - from.left)
        if (dir.indexOf('w') > -1) {
          width = clamp(from.width - dx, colW * 2, from.left + from.width)
          left = from.left + from.width - width
        }
        if (dir.indexOf('s') > -1) height = Math.max(CELL_H * 2, from.height + dy)
        px = { left, top: from.top, width, height }
        const w = clamp(Math.round(width / colW), 2, COLS)
        const h = Math.max(2, Math.round(height / CELL_H))
        const x = dir.indexOf('w') > -1 ? clamp(n.x + n.w - w, 0, COLS - 2) : n.x
        target = { x, y: n.y, w: Math.min(w, COLS - x), h }
      }
      latest = target
      setActive({ id, mode, px, target, base })
    }
    function stop() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      cleanupRef.current = null
    }
    function onUp() {
      stop()
      if (!started) return
      const next = settle(base, id, latest)
      setLayout(next)
      setActive(null)
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* bỏ qua */ }
    }
    if (mode === 'resize') document.body.style.cursor = getComputedStyle(e.currentTarget).cursor
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    cleanupRef.current = stop
  }

  /* Nhấp đúp tay nắm → trả ô về kích thước mặc định */
  function resetItem(id) {
    const d = defs[id]
    const next = settle(layout, id, { ...layout[id], w: d.w, h: d.h, x: Math.min(layout[id].x, COLS - d.w) })
    setLayout(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* bỏ qua */ }
  }

  const shown = active ? settle(active.base, active.id, active.target) : layout
  const rows = order.reduce((m, id) => Math.max(m, shown[id].y + shown[id].h), 0)
  const cellStyle = n => ({ left: `${n.x / COLS * 100}%`, top: n.y * CELL_H, width: `${n.w / COLS * 100}%`, height: n.h * CELL_H })
  const guides = active ? alignGuides(active.target, order.filter(k => k !== active.id).map(k => shown[k])) : []

  return (
    <div className={`blv-grid-stack${active ? ' is-active' : ''}${editing ? ' is-editing' : ''}`} ref={gridRef} style={{ height: Math.max(rows, active ? active.target.y + active.target.h : 0) * CELL_H }}>
      {order.map(id => {
        const isActive = active && active.id === id
        const style = isActive ? { left: active.px.left, top: active.px.top, width: active.px.width, height: active.px.height } : cellStyle(shown[id])
        return (
          <div
            key={id}
            className={`blv-grid-item${isActive ? (active.mode === 'drag' ? ' dragging' : ' resizing') : ''}`}
            style={style}
            onMouseDown={e => start(e, id, 'drag')}
          >
            <div className="blv-grid-item-content">{renderItem(id)}</div>
            {editing && HANDLES.map(d => (
              <div
                key={d}
                className={`blv-resize-handle blv-resize-${d}`}
                title="Kéo để đổi kích thước · Nhấp đúp để đặt lại"
                onMouseDown={e => { e.stopPropagation(); start(e, id, 'resize', d) }}
                onDoubleClick={() => resetItem(id)}
              />
            ))}
          </div>
        )
      })}
      {active && (
        <div className="blv-grid-item blv-grid-placeholder" style={cellStyle(active.target)}>
          <div className="blv-placeholder-content">
            {active.mode === 'resize' && (
              <span className="blv-size-badge mono">{active.target.w}/{COLS} cột · {active.target.h * CELL_H - 16}px</span>
            )}
          </div>
        </div>
      )}
      {/* Đường gióng hàng: mép/tâm của widget đang kéo trùng với widget khác */}
      {guides.map(g => (
        <div
          key={g.key}
          className={`blv-guide ${g.axis}`}
          style={g.axis === 'v'
            ? { left: `calc(${g.pos / COLS * 100}% + ${g.offset}px)`, top: g.from * CELL_H + 8, height: (g.to - g.from) * CELL_H - 16 }
            : { top: g.pos * CELL_H + g.offset, left: `calc(${g.from / COLS * 100}% + 8px)`, width: `calc(${(g.to - g.from) / COLS * 100}% - 16px)` }}
        />
      ))}
    </div>
  )
}
