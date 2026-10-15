import { useRef, useState } from 'react'
import { CAL_DOW_SHORT, WEEK_DATES, TODAY_IDX, HOUR_LABELS, DAYCOL_ROW_HEIGHT, GRID_HEIGHT, DAY_DATE_LABELS, cellMinutesFromTop, fmtHM } from '../../../data/lichData'

const DRAG_THRESHOLD = 4
const SNAP_PX = 20 // bước 30 phút
const COMPACT_MAX_H = 20

/* Cập nhật nhãn giờ của sự kiện theo vị trí/chiều cao mới, giữ nguyên phần " · khách mời" phía sau */
function withTime(ev, top, height) {
  const startMin = cellMinutesFromTop(top)
  const endMin = cellMinutesFromTop(top + height)
  const compact = height <= COMPACT_MAX_H
  if (ev.sub == null) return { top, height, compact }
  const idx = ev.sub.indexOf(' · ')
  const suffix = idx === -1 ? '' : ev.sub.slice(idx)
  const label = compact ? fmtHM(startMin) : fmtHM(startMin) + ' - ' + fmtHM(endMin)
  return { top, height, compact, sub: label + (compact ? '' : suffix) }
}

/* Xếp các sự kiện trùng giờ trong một ngày thành các cột song song để không che chữ nhau.
   Bỏ qua sự kiện cả ngày, sự kiện đang ẩn và bản sao trên lịch khách mời (đã có độ lệch `left` riêng). */
function layoutOverlaps(dayEvents) {
  const items = dayEvents
    .filter(ev => !ev.allday && !ev.dim && ev.left == null)
    .sort((a, b) => a.top - b.top || b.height - a.height)
  const out = {}
  let cluster = [], colEnds = [], clusterEnd = -1
  const flush = () => {
    cluster.forEach(c => { out[c.id] = { col: c.col, cols: colEnds.length } })
    cluster = []; colEnds = []
  }
  items.forEach(ev => {
    if (ev.top >= clusterEnd) flush()
    let col = colEnds.findIndex(end => end <= ev.top)
    if (col === -1) { col = colEnds.length; colEnds.push(0) }
    colEnds[col] = ev.top + ev.height
    cluster.push({ id: ev.id, col })
    clusterEnd = Math.max(clusterEnd, ev.top + ev.height)
  })
  flush()
  return out
}

function overlapStyle(pos) {
  if (!pos || pos.cols < 2) return {}
  const w = `(100% - 8px) / ${pos.cols}`
  return { left: `calc(4px + ${w} * ${pos.col})`, right: 'auto', width: `calc(${w} - 2px)` }
}

/* Lưới Tuần / Ngày — giống #calWeekGridWrap trong lich.html (kể cả kéo thả đổi ngày/giờ) */
export default function WeekView({ hidden, view, dayIdx, events, setEvents, onOpenDetail }) {
  const colRefs = useRef([])
  const [draggingId, setDraggingId] = useState(null)
  const [dropIdx, setDropIdx] = useState(-1)
  const [tooltip, setTooltip] = useState(null)
  const isDay = view === 'day'

  /* ---- Kéo thả sự kiện để đổi ngày/giờ ---- */
  function startDrag(e, ev) {
    e.preventDefault()
    const el = e.currentTarget
    const startX = e.clientX, startY = e.clientY
    const startTop = parseFloat(ev.top) || 0
    const eventHeight = el.offsetHeight
    const durationMin = Math.round(eventHeight / DAYCOL_ROW_HEIGHT * 60)
    let dragging = false
    let curDay = ev.day

    function onMove(me) {
      const dx = me.clientX - startX, dy = me.clientY - startY
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        dragging = true
        setDraggingId(ev.id)
      }
      let newTop = startTop + dy
      newTop = Math.round(newTop / 20) * 20 // bắt theo bước 30 phút
      newTop = Math.max(0, Math.min(GRID_HEIGHT - eventHeight, newTop))

      let hoverIdx = -1
      for (let i = 0; i < 7; i++) {
        const col = colRefs.current[i]
        if (!col) continue
        const r = col.getBoundingClientRect()
        if (me.clientX >= r.left && me.clientX < r.right) { hoverIdx = i; break }
      }
      setDropIdx(hoverIdx)
      const moveCol = hoverIdx !== -1 && hoverIdx !== curDay // theo con trỏ ngay lập tức, không đợi đến lúc thả
      if (moveCol) curDay = hoverIdx
      setEvents(prev => {
        const cur = prev.find(x => x.id === ev.id)
        if (!cur) return prev
        const next = { ...cur, ...(cur.allday ? { top: newTop } : withTime(cur, newTop, cur.height)), day: curDay }
        /* Bản HTML dùng appendChild nên sự kiện chuyển cột sẽ nằm cuối cột mới */
        return moveCol ? [...prev.filter(x => x.id !== ev.id), next] : prev.map(x => (x.id === ev.id ? next : x))
      })
      if (hoverIdx !== -1) {
        const startMin = cellMinutesFromTop(newTop)
        setTooltip({
          text: CAL_DOW_SHORT[hoverIdx] + ' · ' + fmtHM(startMin) + '–' + fmtHM(startMin + durationMin),
          x: me.clientX + 16, y: me.clientY - 12,
        })
      }
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setTooltip(null)
      setDropIdx(-1)
      if (dragging) setDraggingId(null)
      else onOpenDetail(ev, el.getBoundingClientRect())
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /* ---- Kéo mép trên/dưới sự kiện để đổi giờ bắt đầu / kết thúc ---- */
  function startResize(e, ev, edge) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startTop = ev.top
    const startBottom = ev.top + ev.height
    let resized = false

    function onMove(me) {
      const dy = me.clientY - startY
      if (!resized) {
        if (Math.abs(dy) < DRAG_THRESHOLD) return
        resized = true
        setDraggingId(ev.id)
      }
      let top = startTop, bottom = startBottom
      if (edge === 'top') {
        top = Math.round((startTop + dy) / SNAP_PX) * SNAP_PX
        top = Math.max(0, Math.min(startBottom - SNAP_PX, top))
      } else {
        bottom = Math.round((startBottom + dy) / SNAP_PX) * SNAP_PX
        bottom = Math.max(startTop + SNAP_PX, Math.min(GRID_HEIGHT, bottom))
      }
      setEvents(prev => prev.map(x => (x.id === ev.id ? { ...x, ...withTime(x, top, bottom - top) } : x)))
      const startMin = cellMinutesFromTop(top)
      const endMin = cellMinutesFromTop(bottom)
      const dur = endMin - startMin
      setTooltip({
        text: fmtHM(startMin) + '–' + fmtHM(endMin) + ' · ' + (dur >= 60 ? Math.floor(dur / 60) + ' giờ' + (dur % 60 ? ' ' + (dur % 60) + ' phút' : '') : dur + ' phút'),
        x: me.clientX + 16, y: me.clientY - 12,
      })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      setTooltip(null)
      if (resized) setDraggingId(null)
    }
    document.body.style.cursor = 'ns-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const cols = isDay ? '1fr' : 'repeat(7,1fr)'
  const showDay = i => !isDay || i === dayIdx

  return (
    <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: hidden ? 'none' : 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flex: 'none' }}>
        <div style={{ width: 52, flex: 'none' }} />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: cols }}>
          {WEEK_DATES.map((d, i) => {
            const today = i === TODAY_IDX
            return (
              <div key={i} style={{ textAlign: 'center', padding: '9px 0', ...(today ? { background: 'var(--primary-tint)' } : {}), ...(showDay(i) ? {} : { display: 'none' }) }}>
                <div style={{ fontSize: 10.5, color: today ? 'var(--primary)' : 'var(--text-muted)', fontWeight: today ? 700 : 600 }}>{CAL_DOW_SHORT[i]}</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: today ? 800 : 700, ...(today ? { color: 'var(--primary)' } : {}) }}>{d}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
        <div className="mono" style={{ width: 52, flex: 'none', position: 'relative', height: 560, color: 'var(--text-muted)', fontSize: 10 }}>
          {HOUR_LABELS.map(([top, label]) => (
            <div key={label} style={{ position: 'absolute', top, left: 0, right: 6, textAlign: 'right' }}>{label}</div>
          ))}
          <div style={{ position: 'absolute', top: 356, left: 0, right: 0, textAlign: 'right', color: 'var(--danger)', fontWeight: 700, fontSize: 9.5 }}>5:06 CH</div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: cols, position: 'relative', height: 560 }}>
          {/* vạch giờ hiện tại */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 364, height: 0, borderTop: '1.5px solid var(--danger)', zIndex: 4, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', left: -5, top: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
          </div>

          {DAY_DATE_LABELS.map((label, i) => {
            const dayEvents = events.filter(ev => ev.day === i)
            const overlaps = layoutOverlaps(dayEvents)
            return (
            <div
              key={i}
              ref={el => { colRefs.current[i] = el }}
              className={`lc-cal-daycol${dropIdx === i ? ' drop-target' : ''}`}
              data-date={label}
              style={{ ...(i === TODAY_IDX ? { background: 'var(--primary-tint)' } : {}), ...(showDay(i) ? {} : { display: 'none' }) }}
            >
              {dayEvents.map(ev => (
                <div
                  key={ev.id}
                  className={`lc-cal-event${ev.allday ? ' allday' : ''}${ev.compact ? ' compact' : ''}${ev.dim ? ' dim' : ''}${draggingId === ev.id ? ' dragging' : ''}`}
                  data-cal={ev.cal}
                  style={{ '--ev-c': ev.color, '--ev-tint': ev.tint, top: ev.top + 'px', height: ev.height + 'px', ...(ev.left != null ? { left: ev.left + 'px' } : overlapStyle(overlaps[ev.id])), cursor: 'grab' }}
                  onMouseDown={e => startDrag(e, ev)}
                >
                  <div className="lc-t">{ev.title}</div>
                  {ev.sub != null && <div className="lc-s">{ev.sub}</div>}
                  {!ev.allday && <>
                    <div className="lc-cal-resize top" title="Kéo để đổi giờ bắt đầu" onMouseDown={e => startResize(e, ev, 'top')} />
                    <div className="lc-cal-resize bottom" title="Kéo để đổi giờ kết thúc" onMouseDown={e => startResize(e, ev, 'bottom')} />
                  </>}
                </div>
              ))}
            </div>
            )
          })}

          {/* đường kẻ giờ (14 hàng x 40px) */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent 40px)', opacity: 0.6 }} />
        </div>
      </div>

      {tooltip && <div className="lc-cal-drag-tooltip" style={{ left: tooltip.x + 'px', top: tooltip.y + 'px' }}>{tooltip.text}</div>}
    </div>
  )
}
