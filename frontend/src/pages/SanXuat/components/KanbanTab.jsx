import { useState } from 'react'
import { STAGES, firstWorkerInitials, workerExtraCount } from '../../../data/sanXuatData'

function OrderCard({ order: o, onOpen }) {
  const [dragging, setDragging] = useState(false)
  const extra = workerExtraCount(o.worker)
  const commentCount = o.comments.length
  return (
    <div
      className={`sx-order-card${dragging ? ' dragging' : ''}`}
      draggable="true"
      onDragStart={e => { setDragging(true); e.dataTransfer.setData('text/plain', o.code); e.dataTransfer.effectAllowed = 'move' }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onOpen(o.code)}
    >
      <div className="code">{o.code}</div>
      <div className="name">{o.name}</div>
      <div className="meta">{o.customer}</div>
      <div className="pbar-track"><div className="pbar-fill" style={{ width: `${o.progress}%` }} /></div>
      <div className="foot">
        <span className="avatar">{firstWorkerInitials(o.worker)}</span>
        {extra > 0 && <span className="avatar" style={{ marginLeft: -8, background: 'var(--surface-alt)', color: 'var(--text-muted)', fontSize: 8 }}>+{extra}</span>}
        {commentCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {commentCount}
          </span>
        )}
        <span className={`due${o.late ? ' late' : ''}`}>{o.late ? 'Trễ tiến độ' : `Giao ${o.due}`}</span>
      </div>
    </div>
  )
}

function StageColumn({ stage, orders, onMove, onOpen }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className={`sx-stage-col${hover ? ' drop-hover' : ''}`}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHover(true) }}
      onDragLeave={() => setHover(false)}
      onDrop={e => { e.preventDefault(); setHover(false); onMove(e.dataTransfer.getData('text/plain'), stage.key) }}
    >
      <div className="sx-stage-head">
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{stage.label}</span>
        <span className="sx-stage-count">{orders.length}</span>
      </div>
      {orders.map(o => <OrderCard key={o.code} order={o} onOpen={onOpen} />)}
    </div>
  )
}

export default function KanbanTab({ orders, onMoveOrder, onOpenOrder }) {
  return (
    <div className="sx-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="sx-card-title">Quy trình sản xuất</h3>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>Kéo thẻ để đổi công đoạn, hoặc bấm vào thẻ để xem chi tiết &amp; bình luận.</p>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 14, overflowX: 'auto', minHeight: 0 }}>
        {STAGES.map(stage => (
          <StageColumn
            key={stage.key}
            stage={stage}
            orders={orders.filter(o => o.stage === stage.key)}
            onMove={onMoveOrder}
            onOpen={onOpenOrder}
          />
        ))}
      </div>
    </div>
  )
}
