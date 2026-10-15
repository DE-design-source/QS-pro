import { CAL_DOW_SHORT, MONTH_CELLS } from '../../../data/lichData'

/* Lưới Tháng — giống #calMonthGridWrap trong lich.html (dữ liệu tĩnh) */
export default function MonthView({ hidden, onGotoDay }) {
  return (
    <div style={{ display: hidden ? 'none' : 'flex', flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)', flex: 'none' }}>
        {CAL_DOW_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', padding: '9px 0', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      <div className="lc-cal-month-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: 'repeat(5,1fr)', overflowY: 'auto' }}>
        {MONTH_CELLS.map((c, i) => (
          <div
            key={i}
            className={`lc-cal-month-cell${c.muted ? ' muted' : ''}${c.today ? ' today' : ''}`}
            onClick={c.gotoday != null ? () => onGotoDay(c.gotoday) : undefined}
          >
            <div className="lc-cmc-date">{c.d}</div>
            {(c.chips || c.more) && (
              <div className="lc-cmc-events">
                {(c.chips || []).map(ch => <div key={ch.label} className="lc-cmc-chip" style={{ '--chip-c': ch.color }}>{ch.label}</div>)}
                {c.more && <div className="lc-cmc-more">{c.more}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
