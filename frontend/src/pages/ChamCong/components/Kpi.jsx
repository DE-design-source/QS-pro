/* Thẻ KPI dùng chung cho các tab HR */
export default function Kpi({ label, value, of, color, sub, mono, small }) {
  return (
    <div className="cc-card cc-kpi">
      <div className="cc-kpi-label">{label}</div>
      <div className={`cc-kpi-value${small ? ' small' : ''}${mono ? ' mono' : ''}`} style={{ ...(color ? { color } : {}), ...(mono ? { fontFamily: 'var(--cc-font)' } : {}) }}>
        {value}{of && <span className="cc-kpi-of">{of}</span>}
      </div>
      <div className="cc-kpi-sub">{sub}</div>
    </div>
  )
}
