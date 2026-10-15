import { PROJECT_FINANCE, PROJECT_FINANCE_TOTAL, BUDGET_CATEGORIES, INVOICE_SUMMARY } from '../../../data/taiChinhData'
import CashflowChart from './CashflowChart'
import Kpi from './Kpi'

const INV_ICONS = {
  down: <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19,12 12,19 5,12" /></>,
  up: <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5,12 12,5 19,12" /></>,
  done: <polyline points="4,12 9,17 20,6" />,
}

function SummaryCard({ title, leftLabel, leftValue, rightLabel, rightValue, rightColor, pct, gradient, note }) {
  const big = { fontFamily: 'var(--tc-font)', fontWeight: 800, fontSize: 22, marginTop: 4 }
  const small = { fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
  return (
    <div className="tc-card tc-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 className="tc-card-title">{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><div style={small}>{leftLabel}</div><div className="mono" style={big}>{leftValue}</div></div>
        <div><div style={small}>{rightLabel}</div><div className="mono" style={{ ...big, color: rightColor }}>{rightValue}</div></div>
      </div>
      <div className="tc-track"><div style={{ width: `${pct}%`, background: gradient }} /></div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{note}</div>
    </div>
  )
}

export default function DuAnPanel({ range }) {
  return (
    <>
      <CashflowChart range={range} />

      <div className="tc-kpi-grid">
        <Kpi label="Tổng ngân sách" value="8.50 tỷ" sub="Giai đoạn 2 — Riverside" />
        <Kpi label="Đã chi thực tế" value="5.20 tỷ" badge={{ text: '61% ngân sách', color: 'primary' }} />
        <Kpi label="Còn lại" value="3.30 tỷ" color="var(--success)" badge={{ text: '39% ngân sách', color: 'success' }} />
        <Kpi label="Công nợ phải thu" value="1.80 tỷ" badge={{ text: '620tr quá hạn', color: 'danger' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <SummaryCard
          title="Các khoản phải thu"
          leftLabel="Tổng phải thu" leftValue="1.80 tỷ"
          rightLabel="Đã thu" rightValue="1.18 tỷ" rightColor="var(--success)"
          pct={66} gradient="linear-gradient(90deg, #7ED9A6, #1E8E5A)"
          note={<>Đã thu 66% — còn 620tr chưa thu, trong đó <span style={{ color: 'var(--danger)', fontWeight: 600 }}>620tr quá hạn</span></>}
        />
        <SummaryCard
          title="Các khoản dự chi"
          leftLabel="Tổng dự chi" leftValue="8.50 tỷ"
          rightLabel="Thực chi" rightValue="5.20 tỷ" rightColor="var(--finance)"
          pct={61} gradient="linear-gradient(90deg, #F0B45E, #C2711A)"
          note="Đã chi 61% ngân sách dự kiến — còn 3.30 tỷ"
        />
      </div>

      <div className="tc-card tc-pad">
        <h3 className="tc-card-title" style={{ marginBottom: 12 }}>Thu chi theo dự án</h3>
        <div className="tc-proj-grid tc-proj-head">
          <span>Dự án</span><span>Dự thu</span><span>Thực thu</span><span>Dự chi</span><span>Thực chi</span>
        </div>
        {PROJECT_FINANCE.map(p => (
          <div key={p.name} className="tc-proj-grid tc-proj-row">
            <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
            <span className="mono">{p.planIn}</span>
            <span className="mono" style={{ color: 'var(--success)' }}>{p.actualIn}</span>
            <span className="mono">{p.planOut}</span>
            <span className="mono" style={{ color: 'var(--finance)' }}>{p.actualOut}</span>
          </div>
        ))}
        <div className="tc-proj-grid tc-proj-row" style={{ borderBottom: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Tổng</span>
          <span className="mono" style={{ fontWeight: 700 }}>{PROJECT_FINANCE_TOTAL.planIn}</span>
          <span className="mono" style={{ fontWeight: 700, color: 'var(--success)' }}>{PROJECT_FINANCE_TOTAL.actualIn}</span>
          <span className="mono" style={{ fontWeight: 700 }}>{PROJECT_FINANCE_TOTAL.planOut}</span>
          <span className="mono" style={{ fontWeight: 700, color: 'var(--finance)' }}>{PROJECT_FINANCE_TOTAL.actualOut}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 0 }}>
        <div className="tc-card tc-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 className="tc-card-title">Ngân sách theo hạng mục</h3>
          {BUDGET_CATEGORIES.map(b => (
            <div key={b.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="tc-line-item">
                <span className="name">{b.name}</span>
                <span className="mono val" style={b.over ? { color: 'var(--danger)' } : undefined}>{b.value}</span>
              </div>
              <div className="tc-track"><div style={{ width: `${b.pct}%`, background: `var(--${b.color})` }} /></div>
              {b.over && <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{b.over}</div>}
            </div>
          ))}
        </div>

        <div className="tc-card tc-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <h3 className="tc-card-title">Hoá đơn &amp; công nợ</h3>
          {INVOICE_SUMMARY.map(inv => (
            <div key={inv.label} className="tc-inv-item">
              <div className="tc-inv-icon" style={{ background: `var(--${inv.color}-tint)`, color: `var(--${inv.color})` }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{INV_ICONS[inv.dir]}</svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{inv.label}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.amount}</div>
              </div>
              <span className="tc-pill" style={{ background: `var(--${inv.color}-tint)`, color: `var(--${inv.color})` }}>{inv.status}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
