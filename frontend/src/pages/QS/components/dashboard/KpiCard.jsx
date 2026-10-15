import Icon from '../../../../components/ui/Icon'

/* Thẻ KPI: icon + số lớn + mô tả "label · note" (note đậm hơn).
   tone: blue | gray | green | red - màu nền ô icon; positive: tô xanh lá giá trị; negative: tô đỏ (lợi nhuận âm, dash.js:178) */
export default function KpiCard({ icon, tone = 'blue', value, label, note, positive, negative }) {
  return (
    <div className="qs-card qs-dash-kpi">
      <div className={`qs-dash-kpi-icon ${tone}`}><Icon name={icon} size={20} /></div>
      <div style={{ minWidth: 0 }}>
        <div className={`qs-dash-kpi-value${positive ? ' positive' : ''}${negative ? ' negative' : ''}`}>{value}</div>
        <div className="qs-dash-kpi-sub">{label} · <b>{note}</b></div>
      </div>
    </div>
  )
}
