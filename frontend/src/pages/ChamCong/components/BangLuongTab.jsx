import { PAYROLL_ROWS } from '../../../data/chamCongData'
import Kpi from './Kpi'

const COLS = { gridTemplateColumns: '1.6fr 1.4fr 1.1fr 1.1fr 1.1fr 1.1fr' }

export default function BangLuongTab() {
  return (
    <>
      <div className="cc-row-between">
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Kỳ lương hiện tại</span>
        <span style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--finance-tint)', color: 'var(--finance)', fontSize: 11.5, fontWeight: 600 }}>Tháng 9/2026</span>
      </div>

      <div className="cc-kpi-grid">
        <Kpi label="Tổng quỹ lương (Gross)" value="174.000.000 đ" mono small sub="11 nhân sự nhận lương kỳ này" />
        <Kpi label="Bảo hiểm NLĐ đóng" value="18.270.000 đ" mono small color="var(--finance)" sub="BHXH 8% + BHYT 1.5% + BHTN 1%" />
        <Kpi label="Tổng thực nhận" value="155.730.000 đ" mono small color="var(--success)" sub="Sau khi trừ bảo hiểm" />
        <Kpi label="Đã chi trả" value="9" of=" / 11" color="var(--success)" sub="2 hồ sơ đang chờ chi trả" />
      </div>

      <div className="cc-card cc-table">
        <div className="cc-grid cc-grid-head" style={COLS}>
          <span>Họ tên</span><span>Chức vụ</span><span>Lương Gross</span><span>BH (NLĐ 10.5%)</span><span>Thực nhận</span><span>Trạng thái</span>
        </div>
        {PAYROLL_ROWS.map(r => (
          <div key={r.name} className="cc-grid cc-grid-row" style={COLS}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{r.position}</span>
            <span className="mono" style={{ fontSize: 12.5 }}>{r.gross}</span>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--finance)' }}>{r.ins}</span>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{r.net}</span>
            {r.paid
              ? <span className="cc-pill" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>Đã chi trả</span>
              : <span className="cc-pill" style={{ background: 'var(--finance-tint)', color: 'var(--finance)' }}>Chờ chi trả</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>* Lý Thu Trang (Kế toán) đã nghỉ việc trong kỳ — không nằm trong bảng lương tháng này.</div>
    </>
  )
}
