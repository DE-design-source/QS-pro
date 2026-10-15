import { useEffect, useRef, useState } from 'react'
import { STAGES, STAGE_LABEL, DEPT_COLOR, DEPT_SHORT, DEPT_TINT } from '../../../data/kinhDoanhData'
import { fmtTy, stageAccent } from '../utils'
import { DeptFilter, TimeFilter } from './Filters'
import LeadCard from './LeadCard'

/* ===================== Tab Pipeline khách hàng (Kanban + Danh sách) ===================== */

const LIST_COLS = '1.4fr 1.2fr 1fr 0.9fr 1.2fr 1fr'
const viewBtnStyle = active => ({
  border: 'none', cursor: 'pointer', padding: '7px 13px', fontSize: 12.5, fontWeight: 600,
  background: active ? 'var(--sales-tint)' : 'none', color: active ? 'var(--sales)' : 'var(--text-muted)', fontFamily: 'inherit',
})

export default function PipelineTab({ leads, dept, onDeptChange, timeFilter, onTimeFilterChange, scrollRef, onMove, onDelete, onOpenDetail, onAddAssignee, onRemoveAssignee }) {
  const [view, setView] = useState('kanban')
  const [draggingId, setDraggingId] = useState(null)
  const [hoverStage, setHoverStage] = useState(null)
  const [memberOpenFor, setMemberOpenFor] = useState(null)
  const kanbanRef = useRef(null)

  /* Bấm ra ngoài → đóng popover người phụ trách trên thẻ */
  useEffect(() => {
    const close = () => setMemberOpenFor(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  /* Tự động cuộn khi kéo thẻ lead (trái/phải/lên/xuống) */
  useEffect(() => {
    const kanban = kanbanRef.current
    const scrollWrap = scrollRef.current
    if (!kanban || !scrollWrap) return undefined
    const EDGE = 70, MAX_SPEED = 16
    let dragging = false
    let lastEvent = null
    let rafId = null

    function edgeSpeed(pos, min, max) {
      if (pos < min + EDGE) return -MAX_SPEED * (1 - Math.max(0, pos - min) / EDGE)
      if (pos > max - EDGE) return MAX_SPEED * (1 - Math.max(0, max - pos) / EDGE)
      return 0
    }
    function tick() {
      if (dragging && lastEvent) {
        const kRect = kanban.getBoundingClientRect()
        const sRect = scrollWrap.getBoundingClientRect()
        const hSpeed = edgeSpeed(lastEvent.clientX, kRect.left, kRect.right)
        const vSpeed = edgeSpeed(lastEvent.clientY, sRect.top, sRect.bottom)
        if (hSpeed) kanban.scrollLeft += hSpeed
        if (vSpeed) scrollWrap.scrollTop += vSpeed
        rafId = requestAnimationFrame(tick)
      } else {
        rafId = null
      }
    }
    const onStart = () => { dragging = true }
    const onOver = e => {
      if (!dragging) return
      lastEvent = e
      if (!rafId) rafId = requestAnimationFrame(tick)
    }
    const onStop = () => { dragging = false; lastEvent = null }
    kanban.addEventListener('dragstart', onStart)
    document.addEventListener('dragover', onOver)
    document.addEventListener('dragend', onStop)
    document.addEventListener('drop', onStop)
    return () => {
      kanban.removeEventListener('dragstart', onStart)
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('dragend', onStop)
      document.removeEventListener('drop', onStop)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [scrollRef])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Kéo thả thẻ giữa các cột, hoặc dùng ô chọn giai đoạn trên mỗi thẻ để chuyển. Thẻ vào cột "Dự án (Thiết kế)" / "Dự án (Thi công)" sẽ tự xuất hiện ở tab Dự án.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none', flexWrap: 'wrap' }}>
          <DeptFilter dept={dept} onChange={onDeptChange} />
          <TimeFilter filter={timeFilter} onChange={onTimeFilterChange} />
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button className={view === 'kanban' ? 'active' : undefined} style={viewBtnStyle(view === 'kanban')} onClick={() => setView('kanban')}>Kanban</button>
            <button className={view === 'list' ? 'active' : undefined} style={viewBtnStyle(view === 'list')} onClick={() => setView('list')}>Danh sách</button>
          </div>
        </div>
      </div>

      {/* ---- Kanban ---- */}
      <div ref={kanbanRef} style={{ display: view === 'kanban' ? 'flex' : 'none', gap: 14, overflowX: 'auto', paddingBottom: 6 }}>
        {STAGES.map(stageId => {
          const items = leads.filter(l => l.stage === stageId)
          const total = items.reduce((s, l) => s + l.value, 0)
          const accent = stageAccent(stageId)
          const isLostStage = stageId === 'truot-thau'
          const headColor = accent ? accent.color : ''
          return (
            <div
              key={stageId}
              className={`kd-stage-col${hoverStage === stageId ? ' drop-hover' : ''}`}
              style={{ minWidth: 220, ...(isLostStage ? { opacity: 0.85 } : null) }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (hoverStage !== stageId) setHoverStage(stageId) }}
              onDragLeave={() => setHoverStage(cur => (cur === stageId ? null : cur))}
              onDrop={e => {
                e.preventDefault()
                setHoverStage(null)
                setDraggingId(null)
                onMove(e.dataTransfer.getData('text/plain'), stageId)
              }}
            >
              <div className="kd-stage-head">
                <span style={{ fontWeight: 700, fontSize: 13, ...(headColor ? { color: headColor } : null) }}>{STAGE_LABEL[stageId]}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: headColor || 'var(--text-muted)' }}>({items.length} dự án - {fmtTy(total)})</span>
              </div>
              <div style={{ minHeight: 40, borderRadius: 8 }}>
                {items.map(l => (
                  <LeadCard
                    key={l.id} lead={l}
                    dragging={draggingId === l.id}
                    onDragStart={setDraggingId}
                    onDragEnd={() => setDraggingId(null)}
                    onOpen={onOpenDetail} onDelete={onDelete} onMove={onMove}
                    memberOpen={memberOpenFor === l.id}
                    onToggleMember={id => setMemberOpenFor(cur => (cur === id ? null : id))}
                    onCloseMember={() => setMemberOpenFor(null)}
                    onAddAssignee={onAddAssignee} onRemoveAssignee={onRemoveAssignee}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ---- Danh sách ---- */}
      <div style={{ display: view === 'list' ? 'block' : 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '6px 20px 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: LIST_COLS, gap: 10, padding: '12px 4px', fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          <span>Lead khách hàng</span><span>Loại dự án</span><span>Phòng ban</span><span>Giá trị</span><span>Giai đoạn</span><span>Chuyển tới</span>
        </div>
        {leads.map((l, i) => {
          const a = stageAccent(l.stage)
          return (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: LIST_COLS, gap: 10, alignItems: 'center', padding: '11px 4px', ...(i < leads.length - 1 ? { borderBottom: '1px solid var(--border)' } : null) }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{l.type}</span>
              <span style={{ padding: '3px 9px', borderRadius: 999, background: DEPT_TINT[l.dept], color: DEPT_COLOR[l.dept], fontSize: 10.5, fontWeight: 600, justifySelf: 'start' }}>{DEPT_SHORT[l.dept]}</span>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--sales)', fontWeight: 700 }}>{fmtTy(l.value)}</span>
              <span style={{ padding: '3px 9px', borderRadius: 999, background: a ? a.bg : 'var(--sales-tint)', color: a ? a.color : 'var(--sales)', fontSize: 11, fontWeight: 600, justifySelf: 'start' }}>{STAGE_LABEL[l.stage]}</span>
              <select
                value={l.stage} onChange={e => onMove(l.id, e.target.value)}
                style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 11, padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
              >
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </div>
          )
        })}
      </div>
    </>
  )
}
