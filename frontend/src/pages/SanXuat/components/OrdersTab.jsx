import { useState } from 'react'
import { ORDER_FILTERS, PRIO_COLOR, PRIO_LABEL, orderStatusGroup, stageOf } from '../../../data/sanXuatData'

export default function OrdersTab({ orders }) {
  const [filter, setFilter] = useState('all')
  const rows = orders.filter(o => filter === 'all' || orderStatusGroup(o) === filter)

  return (
    <div className="sx-card" style={{ padding: '6px 20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {ORDER_FILTERS.map(f => (
            <button key={f.key} className={`sx-filter-chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="sx-table">
          <thead>
            <tr><th>Mã đơn</th><th>Sản phẩm</th><th>Khách hàng / Dự án</th><th>SL</th><th>Công đoạn</th><th>Phụ trách</th><th>Tiến độ</th><th>Giao hàng</th><th>Ưu tiên</th></tr>
          </thead>
          <tbody>
            {rows.map(o => {
              const stage = stageOf(o.stage)
              return (
                <tr key={o.code}>
                  <td className="mono" style={{ fontWeight: 700 }}>{o.code}</td>
                  <td style={{ fontWeight: 600 }}>{o.name} <span className="mono" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>×{o.qty}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{o.customer}</td>
                  <td className="mono">{o.qty}</td>
                  <td><span className="sx-pill" style={{ background: stage.tint, color: stage.color }}>{stage.label}</span></td>
                  <td>{o.worker}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="sx-progress-track"><div className="sx-progress-fill" style={{ width: `${o.progress}%` }} /></div>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.progress}%</span>
                    </div>
                  </td>
                  <td className="mono" style={o.late ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{o.late ? `Trễ · ${o.due}` : o.due}</td>
                  <td><span className="sx-prio-dot" style={{ background: PRIO_COLOR[o.priority] }} />{PRIO_LABEL[o.priority]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
