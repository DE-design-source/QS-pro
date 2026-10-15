import { useEffect, useState } from 'react'
import {
  PO_STAGES, TODAY, STATUS_LABEL, avatarColor, initials, parseD, dayDiff, fmt, fmtFull, statusOf, fmtMillion,
} from '../../../data/quanLyThietKeData'

/* Trang chi tiết mua hàng dạng kanban — mở khi bấm công việc thuộc giai đoạn "Mua hàng & cung ứng" */
export default function PurchaseBoard({ task, items, open, onClose, onMove }) {
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const list = items || []
  const total = list.reduce((s, it) => s + it.value, 0)
  const received = list.filter(it => it.stage === 'received')
  const receivedValue = received.reduce((s, it) => s + it.value, 0)
  const lateCount = list.filter(it => it.stage !== 'received' && parseD(it.due) < TODAY).length
  const st = task ? statusOf(task) : 'notstarted'

  function drop(stageKey) {
    if (dragId) onMove(task.id, dragId, stageKey)
    setDragId(null)
    setOverStage(null)
  }

  return (
    <>
      <div className={`tk-scrim${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`tk-pb${open ? ' open' : ''}`} role="dialog" aria-label="Chi tiết mua hàng">
        <div className="tk-pb-head">
          <div className="tk-pb-head-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
          </div>
          <div className="tk-pb-title">
            <span className="tk-pb-kicker">Mua hàng &amp; cung ứng</span>
            <h2>{task ? task.name : '—'}</h2>
          </div>
          <button className="tk-drawer-close" title="Đóng (Esc)" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {task && (
          <div className="tk-pb-meta">
            <div className="tk-pb-meta-item"><span className="tk-fl">Thời gian</span><span className="mono">{fmtFull(parseD(task.start))} → {fmtFull(parseD(task.end))}</span></div>
            <div className="tk-pb-meta-item">
              <span className="tk-fl">Phụ trách</span>
              <span className="tk-pb-person"><span className="tk-avatar-mini" style={{ background: avatarColor(task.assignee) }}>{initials(task.assignee)}</span>{task.assignee}</span>
            </div>
            <div className="tk-pb-meta-item"><span className="tk-fl">Trạng thái</span><span className={`tk-status-badge tk-status-${st}`}><span className="tk-dot" />{STATUS_LABEL[st]}</span></div>
            <div className="tk-pb-meta-item"><span className="tk-fl">Tổng giá trị</span><span className="mono tk-pb-strong">{fmtMillion(total)}</span></div>
            <div className="tk-pb-meta-item"><span className="tk-fl">Đã nhận</span><span className="mono">{received.length}/{list.length} đơn · {fmtMillion(receivedValue)}</span></div>
            <div className="tk-pb-meta-item"><span className="tk-fl">Quá hạn giao</span><span className="mono" style={{ color: lateCount ? 'var(--overdue)' : 'var(--text-dim)' }}>{lateCount} đơn</span></div>
          </div>
        )}

        <div className="tk-pb-board">
          {PO_STAGES.map(stage => {
            const cards = list.filter(it => it.stage === stage.key)
            const sum = cards.reduce((s, it) => s + it.value, 0)
            return (
              <div
                key={stage.key}
                className={`tk-pb-col${overStage === stage.key ? ' over' : ''}`}
                onDragOver={e => { if (dragId) { e.preventDefault(); setOverStage(stage.key) } }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverStage(null) }}
                onDrop={e => { e.preventDefault(); drop(stage.key) }}
              >
                <div className="tk-pb-col-head">
                  <span className="tk-pb-col-dot" style={{ background: stage.color }} />
                  <span className="tk-pb-col-name">{stage.label}</span>
                  <span className="tk-pb-col-count">{cards.length}</span>
                  <span className="tk-pb-col-sum mono">{sum ? fmtMillion(sum) : ''}</span>
                </div>
                <div className="tk-pb-cards">
                  {cards.length === 0 && <div className="tk-pb-empty">Kéo thả đơn vào đây</div>}
                  {cards.map(it => {
                    const late = it.stage !== 'received' && parseD(it.due) < TODAY
                    const soon = !late && it.stage !== 'received' && dayDiff(TODAY, parseD(it.due)) <= 7
                    return (
                      <div
                        key={it.id}
                        className={`tk-pb-card${dragId === it.id ? ' dragging' : ''}`}
                        style={{ borderLeftColor: stage.color }}
                        draggable
                        onDragStart={e => { setDragId(it.id); e.dataTransfer.effectAllowed = 'move' }}
                        onDragEnd={() => { setDragId(null); setOverStage(null) }}
                      >
                        <div className="tk-pb-card-top">
                          <span className="mono tk-pb-code">{it.code}</span>
                          <span className="mono tk-pb-value">{fmtMillion(it.value)}</span>
                        </div>
                        <div className="tk-pb-item">{it.item}</div>
                        <div className="tk-pb-sub">{it.supplier} · <span className="mono">{it.qty}</span></div>
                        <div className="tk-pb-card-foot">
                          <span className={`tk-pb-due mono${late ? ' late' : soon ? ' soon' : ''}`} title={late ? 'Quá hạn giao' : 'Ngày giao dự kiến'}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                            {fmt(parseD(it.due))}{late ? ' · trễ' : ''}
                          </span>
                          <span className="tk-avatar-mini" title={it.owner} style={{ background: avatarColor(it.owner), marginRight: 0 }}>{initials(it.owner)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
