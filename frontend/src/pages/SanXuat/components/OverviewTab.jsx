import { STAGES, firstWorkerInitials } from '../../../data/sanXuatData'

const ALERTS = [
  { color: 'danger', title: 'SX-002 trễ 2 ngày', sub: 'Bộ bàn ghế ăn 6 ghế — đang QC xưởng', icon: <><path d="M12 3l10 18H2z" /><line x1="12" y1="10" x2="12" y2="15" /><circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none" /></> },
  { color: 'finance', title: 'Gỗ óc chó sắp hết', sub: 'Còn 4 tấm — ảnh hưởng SX-001', icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /></> },
  { color: 'danger', title: 'Máy khoan ngang CNC hỏng', sub: 'Cần kỹ thuật viên xử lý gấp', icon: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></> },
]
const TEAM_OUTPUT = [
  { team: 'Tổ lắp ráp', value: '6 SP/tháng', pct: 85 },
  { team: 'Tổ cắt & gia công', value: '5 SP/tháng', pct: 70 },
  { team: 'Tổ sơn hoàn thiện', value: '7 SP/tháng', pct: 92 },
]

export default function OverviewTab({ orders }) {
  const active = orders.filter(o => o.stage !== 'hoanThanh').length
  const late = orders.filter(o => o.late).length
  const priority = orders.filter(o => o.priority === 'high' && o.stage !== 'hoanThanh')

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        <div className="sx-card sx-kpi-card">
          <div className="sx-kpi-label">Đơn đang sản xuất</div>
          <div className="sx-kpi-num">{active}</div>
          <div className="sx-kpi-sub">Trên 6 khách hàng &amp; dự án</div>
        </div>
        <div className="sx-card sx-kpi-card">
          <div className="sx-kpi-label">Hoàn thành tháng này</div>
          <div className="sx-kpi-num" style={{ color: 'var(--success)' }}>9</div>
          <div className="sx-kpi-sub">+2 so với tháng trước</div>
        </div>
        <div className="sx-card sx-kpi-card">
          <div className="sx-kpi-label">Công suất xưởng</div>
          <div className="sx-kpi-num">82%</div>
          <div className="sx-badge" style={{ background: 'var(--wood-tint)', color: 'var(--wood)' }}>4/5 thợ đang có việc</div>
        </div>
        <div className="sx-card sx-kpi-card">
          <div className="sx-kpi-label">Trễ tiến độ</div>
          <div className="sx-kpi-num" style={{ color: 'var(--danger)' }}>{late}</div>
          <div className="sx-badge" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>Cần xử lý ngay</div>
        </div>
        <div className="sx-card sx-kpi-card">
          <div className="sx-kpi-label">Giá trị tồn kho</div>
          <div className="sx-kpi-num">318tr</div>
          <div className="sx-badge" style={{ background: 'var(--finance-tint)', color: 'var(--finance)' }}>2 mặt hàng sắp hết</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, minHeight: 0 }}>
        <div className="sx-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 className="sx-card-title">Tiến độ theo công đoạn</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STAGES.map(stage => {
              const count = orders.filter(o => o.stage === stage.key).length
              const pct = orders.length ? Math.round(count / orders.length * 100) : 0
              return (
                <div key={stage.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{stage.label}</span>
                    <span className="mono" style={{ color: 'var(--text-muted)' }}>{count} đơn</span>
                  </div>
                  <div className="sx-progress-track" style={{ width: '100%' }}><div className="sx-progress-fill" style={{ width: `${pct}%`, background: stage.color }} /></div>
                </div>
              )
            })}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Đơn ưu tiên hôm nay</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {priority.map(o => (
                <div key={o.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--wood-tint)', color: 'var(--wood)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{firstWorkerInitials(o.worker)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{o.code} — {o.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.customer}</div>
                  </div>
                  {o.late
                    ? <span className="sx-badge" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>Trễ</span>
                    : <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Giao {o.due}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div className="sx-card" style={{ padding: '18px 20px' }}>
            <h3 className="sx-card-title" style={{ marginBottom: 12 }}>Cảnh báo cần xử lý</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ALERTS.map(a => (
                <div key={a.title} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `var(--${a.color}-tint)`, color: `var(--${a.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{a.icon}</svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sx-card" style={{ padding: '18px 20px', flex: 1 }}>
            <h3 className="sx-card-title" style={{ marginBottom: 12 }}>Năng suất theo tổ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TEAM_OUTPUT.map(t => (
                <div key={t.team}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{t.team}</span><span className="mono" style={{ color: 'var(--text-muted)' }}>{t.value}</span>
                  </div>
                  <div className="sx-progress-track" style={{ width: '100%' }}><div className="sx-progress-fill" style={{ width: `${t.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
