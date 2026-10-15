/* Thẻ KPI dùng chung của trang Tài chính.
   badge: { text, color } hiển thị dạng nhãn thay cho dòng mô tả */
export default function Kpi({ label, value, color, sub, badge }) {
  return (
    <div className="tc-card tc-kpi">
      <div className="tc-kpi-label">{label}</div>
      <div className="tc-kpi-value mono" style={{ fontFamily: 'var(--tc-font)', ...(color ? { color } : {}) }}>{value}</div>
      {badge
        ? <div className="tc-badge" style={{ background: `var(--${badge.color}-tint)`, color: `var(--${badge.color})` }}>{badge.text}</div>
        : <div className="tc-kpi-sub">{sub}</div>}
    </div>
  )
}
