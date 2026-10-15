import { WORKERS, EQUIPMENT, EQUIPMENT_STATUS, initialsOf } from '../../../data/sanXuatData'

/* Tab "Nhân công" */
export function WorkersTab() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="sx-card sx-kpi-card"><div className="sx-kpi-label">Tổng thợ xưởng</div><div className="sx-kpi-num">5</div><div className="sx-kpi-sub">3 tổ sản xuất</div></div>
        <div className="sx-card sx-kpi-card"><div className="sx-kpi-label">Đang có việc</div><div className="sx-kpi-num" style={{ color: 'var(--success)' }}>4</div><div className="sx-kpi-sub">1 thợ nghỉ phép</div></div>
        <div className="sx-card sx-kpi-card"><div className="sx-kpi-label">SP hoàn thành tháng này</div><div className="sx-kpi-num">25</div><div className="sx-kpi-sub">Trung bình 5 SP/thợ</div></div>
      </div>
      <div className="sx-card" style={{ padding: '8px 12px' }}>
        {WORKERS.map((w, i) => {
          const working = w.status === 'working'
          return (
            <div key={w.name} className="sx-worker-card" style={i < WORKERS.length - 1 ? { borderBottom: '1px solid var(--border)' } : undefined}>
              <span className="sx-avatar-lg">{initialsOf(w.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{w.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{w.team}</div>
              </div>
              <div style={{ textAlign: 'center', width: 110 }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{w.active}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Đơn đang làm</div>
              </div>
              <div style={{ textAlign: 'center', width: 110 }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)' }}>{w.done}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Hoàn thành / tháng</div>
              </div>
              <span className="sx-badge" style={{ background: working ? 'var(--success-tint)' : 'var(--surface-alt)', color: working ? 'var(--success)' : 'var(--text-muted)' }}>
                {working ? 'Đang làm việc' : 'Nghỉ phép'}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* Tab "Máy móc" */
export function EquipmentTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {EQUIPMENT.map(eq => {
        const s = EQUIPMENT_STATUS[eq.status]
        return (
          <div key={eq.name} className="sx-card sx-equip-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 700 }}>{eq.name}</h3>
              <span style={{ padding: '3px 9px', borderRadius: 999, background: s[2], color: s[1], fontSize: 10.5, fontWeight: 700 }}>{s[0]}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bảo trì gần nhất: <span className="mono">{eq.last}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kế hoạch tiếp theo: <span className="mono">{eq.next}</span></div>
          </div>
        )
      })}
    </div>
  )
}
