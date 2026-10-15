/* Thẻ KPI dùng chung của trang QS.
   mono: giá trị dạng số tiền (cỡ 24px); badge: { text, color } thay cho dòng mô tả */
export default function Kpi({ label, value, color, sub, mono, badge }) {
  return (
    <div className="qs-card qs-kpi">
      <div className="qs-kpi-label">{label}</div>
      <div
        className={`qs-kpi-value${mono ? ' mono small' : ''}`}
        style={{ ...(mono ? { fontFamily: 'var(--qs-font)' } : {}), ...(color ? { color } : {}) }}
      >{value}</div>
      {badge && (
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 999, background: `var(--${badge.color}-tint)`, color: `var(--${badge.color})`, fontSize: 11.5, fontWeight: 600 }}>{badge.text}</div>
      )}
      {sub && <div className="qs-kpi-sub">{sub}</div>}
    </div>
  )
}
