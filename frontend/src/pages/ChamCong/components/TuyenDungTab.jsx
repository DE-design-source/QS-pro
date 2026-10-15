import { OPEN_JOBS, CANDIDATES } from '../../../data/chamCongData'
import Kpi from './Kpi'

const COLS = { gridTemplateColumns: '1.4fr 1.5fr 1fr 1.1fr 1fr 1.1fr' }

export default function TuyenDungTab() {
  return (
    <>
      <div className="cc-kpi-grid">
        <Kpi label="Vị trí đang tuyển" value="4" sub="Trên 3 phòng ban" />
        <Kpi label="Ứng viên mới tuần này" value="6" color="var(--primary)" sub="Từ các kênh tuyển dụng" />
        <Kpi label="Đang phỏng vấn" value="3" color="var(--finance)" sub="Vòng 1 & vòng 2" />
        <Kpi label="Đã tuyển tháng này" value="1" color="var(--success)" sub="Nhân viên KD Dự Án" />
      </div>

      <div className="cc-row-between">
        <span className="cc-section-title">Vị trí đang tuyển</span>
      </div>
      <div className="cc-kpi-grid">
        {OPEN_JOBS.map(j => (
          <div key={j.title} className="cc-card" style={{ borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{j.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{j.dept}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.apps}</div>
          </div>
        ))}
      </div>

      <div className="cc-row-between">
        <span className="cc-section-title">Danh sách ứng viên</span>
        <button className="cc-btn-add">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Thêm ứng viên
        </button>
      </div>

      <div className="cc-card cc-table">
        <div className="cc-grid cc-grid-head" style={COLS}>
          <span>Họ tên</span><span>Vị trí ứng tuyển</span><span>Nguồn</span><span>Giai đoạn</span><span>Ngày ứng tuyển</span><span>Người phụ trách</span>
        </div>
        {CANDIDATES.map(c => (
          <div key={c.name} className="cc-grid cc-grid-row" style={COLS}>
            <span style={{ fontSize: 13, fontWeight: 600, ...(c.rejected ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : {}) }}>{c.name}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{c.position}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{c.source}</span>
            <span className="cc-pill" style={{ background: `var(--${c.stageColor}-tint)`, color: `var(--${c.stageColor})` }}>{c.stage}</span>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.date}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{c.owner}</span>
          </div>
        ))}
      </div>
    </>
  )
}
