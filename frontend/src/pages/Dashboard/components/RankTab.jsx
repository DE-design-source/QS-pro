import { TASK_POINTS, RANK_PERIODS, NF_CURRENT_USER, NF_MEDAL_BG, NF_MEDAL_FG, fmtPoints } from '../../../data/dashboardData'

/* Bục vinh danh xếp theo thứ tự hạng 2 – hạng 1 – hạng 3 (giống nfRenderLeaderboard) */
const PODIUM = [
  { idx: 1, rank: 2, cls: 'silver' },
  { idx: 0, rank: 1, cls: 'gold' },
  { idx: 2, rank: 3, cls: 'bronze' },
]

/* Tab "Nhiệm vụ": bảng xếp hạng điểm thưởng theo tuần / tháng / quý / năm */
export default function RankTab({ active, period, onPeriod }) {
  const ranked = [...TASK_POINTS].sort((a, b) => b[period] - a[period])

  return (
    <div className="db-view" style={{ display: active ? 'flex' : 'none' }}>
      <div className="db-section-head">
        <div className="db-section-icon" style={{ background: 'var(--finance-tint)', color: 'var(--finance)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5" /></svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <h2>Bảng xếp hạng nhiệm vụ</h2>
          <p>Xếp hạng nhân sự theo điểm thưởng tích lũy từ hoàn thành nhiệm vụ.</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {RANK_PERIODS.map(p => (
          <button key={p.key} type="button" className={`db-rank-period${period === p.key ? ' active' : ''}`} onClick={() => onPeriod(p.key)}>{p.label}</button>
        ))}
      </div>

      <div className="db-podium">
        {PODIUM.map(({ idx, rank, cls }) => {
          const p = ranked[idx]
          if (!p) return null
          return (
            <div key={rank} className={`db-podium-card ${cls}`}>
              <div className="db-medal" style={{ background: NF_MEDAL_BG[rank - 1], color: NF_MEDAL_FG[rank - 1] }}>#{rank}</div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `var(--${p.color}-tint)`, color: `var(--${p.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>{p.initials}</div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.dept}</div>
              <div style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: 17, color: 'var(--finance)' }}>{fmtPoints(p[period])} đ</div>
            </div>
          )
        })}
      </div>

      <div className="db-rank-table">
        <div className="db-rank-head"><span>Hạng</span><span>Nhân sự</span><span>Phòng ban</span><span>Điểm</span></div>
        <div>
          {ranked.map((p, i) => {
            const isMe = p.name === NF_CURRENT_USER
            return (
              <div key={p.name} className={`db-rank-row${isMe ? ' db-rank-me' : ''}`}>
                <span className="db-rank-num">#{i + 1}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: `var(--${p.color}-tint)`, color: `var(--${p.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flex: 'none' }}>{p.initials}</span>
                  {p.name}{isMe && <> <span style={{ fontSize: 10.5, color: 'var(--primary)', fontWeight: 700 }}>(Bạn)</span></>}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{p.dept}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--finance)' }}>{fmtPoints(p[period])} đ</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
