import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  CASHFLOW_RANGE_DATA, CHART_TYPES, DEFAULT_THU_COLOR, DEFAULT_CHI_COLOR, CHART_STORAGE,
} from '../../../data/taiChinhData'

const FONT_STACK = "var(--app-font, 'Montserrat'), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const PAD = { l: 50, r: 20, top: 10, bottom: 30 }
const LABEL_FILL = '#9AA1B2'

function readStorage(key, fallback) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function writeStorage(key, value) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* bỏ qua */ }
}
const fmtVal = v => v.toLocaleString('vi-VN') + ' triệu'

/* Dựng toàn bộ SVG theo dạng biểu đồ — chuyển từ các hàm render* của bản HTML */
function ChartSvg({ W, H, type, cfg, thuColor, chiColor }) {
  const { labels, thu, chi, maxVal } = cfg
  const plotBottom = H - PAD.bottom
  const cellW = (W - PAD.l - PAD.r) / labels.length
  const xOf = i => PAD.l + cellW * i + cellW / 2
  const yOf = v => plotBottom - (v / maxVal) * (plotBottom - PAD.top)
  const linePath = values => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
  const tip = (i, label, v) => <title>{`${labels[i]} — ${label}: ${fmtVal(v)}`}</title>

  const grid = []
  for (let s = 0; s <= 4; s++) {
    const v = Math.round((maxVal * s / 4) / 50) * 50
    const y = yOf(v)
    grid.push(
      <line key={`l${s}`} x1={PAD.l} y1={y.toFixed(1)} x2={W - PAD.r} y2={y.toFixed(1)} stroke={v === 0 ? '#E2E5EC' : '#EEF0F4'} strokeDasharray={v === 0 ? 'none' : '4 4'} />,
      <text key={`t${s}`} x="6" y={(y + 4).toFixed(1)} fontFamily={FONT_STACK} fontSize="12" fill={LABEL_FILL}>
        {v >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k' : String(v)}
      </text>,
    )
  }
  const xLabels = labels.map((w, i) => (
    <text key={`x${i}`} x={xOf(i).toFixed(1)} y={H - 10} textAnchor="middle" fontFamily={FONT_STACK} fontSize="12" fill={LABEL_FILL}>{w}</text>
  ))
  const markers = (values, color, label) => values.map((v, i) => (
    <circle key={`${label}${i}`} cx={xOf(i).toFixed(1)} cy={yOf(v).toFixed(1)} r="4" fill="#fff" stroke={color} strokeWidth="2">{tip(i, label, v)}</circle>
  ))
  const hitPoints = (values, label) => values.map((v, i) => (
    <circle key={`h${label}${i}`} cx={xOf(i).toFixed(1)} cy={yOf(v).toFixed(1)} r="9" fill="transparent">{tip(i, label, v)}</circle>
  ))

  let body
  if (type === 'grouped') {
    const barW = Math.min(15, cellW * 0.28)
    body = labels.map((w, i) => {
      const cx = xOf(i), yThu = yOf(thu[i]), yChi = yOf(chi[i])
      return (
        <g key={i}>
          <rect x={(cx - barW - 2).toFixed(1)} y={yThu.toFixed(1)} width={barW.toFixed(1)} height={(plotBottom - yThu).toFixed(1)} rx="3" fill="url(#tcGradThu)">{tip(i, 'Thu', thu[i])}</rect>
          <rect x={(cx + 2).toFixed(1)} y={yChi.toFixed(1)} width={barW.toFixed(1)} height={(plotBottom - yChi).toFixed(1)} rx="3" fill="url(#tcGradChi)">{tip(i, 'Chi', chi[i])}</rect>
        </g>
      )
    })
  } else if (type === 'stacked') {
    const barW = Math.min(28, cellW * 0.5)
    body = labels.map((w, i) => {
      const cx = xOf(i), yThuTop = yOf(chi[i] + thu[i]), yChiTop = yOf(chi[i])
      return (
        <g key={i}>
          <rect x={(cx - barW / 2).toFixed(1)} y={yThuTop.toFixed(1)} width={barW.toFixed(1)} height={(yChiTop - yThuTop).toFixed(1)} rx="3" fill="url(#tcGradThu)">{tip(i, 'Thu', thu[i])}</rect>
          <rect x={(cx - barW / 2).toFixed(1)} y={yChiTop.toFixed(1)} width={barW.toFixed(1)} height={(plotBottom - yChiTop).toFixed(1)} rx="3" fill="url(#tcGradChi)">{tip(i, 'Chi', chi[i])}</rect>
        </g>
      )
    })
  } else if (type === 'line') {
    body = (
      <>
        <path d={linePath(thu)} fill="none" stroke={thuColor} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d={linePath(chi)} fill="none" stroke={chiColor} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        {markers(thu, thuColor, 'Thu')}
        {markers(chi, chiColor, 'Chi')}
      </>
    )
  } else if (type === 'combo') {
    const barW = Math.min(22, cellW * 0.4)
    body = (
      <>
        {labels.map((w, i) => {
          const cx = xOf(i), yChi = yOf(chi[i])
          return <rect key={i} x={(cx - barW / 2).toFixed(1)} y={yChi.toFixed(1)} width={barW.toFixed(1)} height={(plotBottom - yChi).toFixed(1)} rx="4" fill="url(#tcGradChi)" opacity="0.85">{tip(i, 'Chi', chi[i])}</rect>
        })}
        <path d={linePath(thu)} fill="none" stroke={thuColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {markers(thu, thuColor, 'Thu')}
      </>
    )
  } else {
    // area (mặc định)
    const lastX = xOf(labels.length - 1).toFixed(1), firstX = xOf(0).toFixed(1)
    const close = ` L${lastX},${plotBottom} L${firstX},${plotBottom} Z`
    body = (
      <>
        <path d={linePath(thu) + close} fill="url(#tcGradThuArea)" />
        <path d={linePath(chi) + close} fill="url(#tcGradChiArea)" />
        <path d={linePath(thu)} fill="none" stroke={thuColor} strokeWidth="2.5" />
        <path d={linePath(chi)} fill="none" stroke={chiColor} strokeWidth="2.5" />
        {hitPoints(thu, 'Thu')}
        {hitPoints(chi, 'Chi')}
      </>
    )
  }

  const gradient = (id, color, from, to) => (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="Biểu đồ dự báo thu chi 8 tuần tới">
      <defs>
        {gradient('tcGradThu', thuColor, 0.55, 1)}
        {gradient('tcGradChi', chiColor, 0.55, 1)}
        {gradient('tcGradThuArea', thuColor, 0.32, 0)}
        {gradient('tcGradChiArea', chiColor, 0.32, 0)}
      </defs>
      {grid}
      {body}
      {xLabels}
    </svg>
  )
}

export default function CashflowChart({ range }) {
  const [type, setType] = useState(() => readStorage(CHART_STORAGE.type, 'area'))
  const [thuColor, setThuColor] = useState(() => readStorage(CHART_STORAGE.thu, DEFAULT_THU_COLOR))
  const [chiColor, setChiColor] = useState(() => readStorage(CHART_STORAGE.chi, DEFAULT_CHI_COLOR))
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [size, setSize] = useState({ W: 900, H: 170 })
  const boxRef = useRef(null)
  const cfg = CASHFLOW_RANGE_DATA[range] || CASHFLOW_RANGE_DATA.week

  // Đo lại khung khi đổi kích thước (thay cho window resize + render lại khi chuyển danh mục)
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => {
      const W = box.clientWidth || 900
      const H = box.clientHeight || 170
      setSize(s => (s.W === W && s.H === H ? s : { W, H }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!popoverOpen) return
    const close = () => setPopoverOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [popoverOpen])

  function changeColor(which, value) {
    if (which === 'thu') { setThuColor(value); writeStorage(CHART_STORAGE.thu, value) }
    else { setChiColor(value); writeStorage(CHART_STORAGE.chi, value) }
  }
  function resetColors() {
    setThuColor(DEFAULT_THU_COLOR)
    setChiColor(DEFAULT_CHI_COLOR)
    writeStorage(CHART_STORAGE.thu, null)
    writeStorage(CHART_STORAGE.chi, null)
  }

  return (
    <div className="tc-card tc-chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{cfg.title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div className="tc-chart-legend">
            <span><i style={{ background: thuColor }} />Thu</span>
            <span><i style={{ background: chiColor }} />Chi</span>
          </div>
          <button
            type="button"
            className="tc-color-btn"
            title="Chỉnh màu sắc biểu đồ"
            onClick={e => { e.stopPropagation(); setPopoverOpen(o => !o) }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
          </button>
          {popoverOpen && (
            <div className="tc-color-popover" onClick={e => e.stopPropagation()}>
              <div className="tc-color-popover-title">Màu biểu đồ</div>
              <div className="tc-color-row" style={{ marginBottom: 10 }}>
                <label htmlFor="tcColorThu">Thu</label>
                <input type="color" id="tcColorThu" value={thuColor} onChange={e => changeColor('thu', e.target.value)} />
              </div>
              <div className="tc-color-row" style={{ marginBottom: 12 }}>
                <label htmlFor="tcColorChi">Chi</label>
                <input type="color" id="tcColorChi" value={chiColor} onChange={e => changeColor('chi', e.target.value)} />
              </div>
              <button type="button" className="tc-color-reset" onClick={resetColors}>Khôi phục mặc định</button>
            </div>
          )}
          <select
            className="tc-chart-type"
            value={type}
            onChange={e => { setType(e.target.value); writeStorage(CHART_STORAGE.type, e.target.value) }}
          >
            {CHART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div ref={boxRef} style={{ height: 170, flex: 'none' }}>
          <ChartSvg W={size.W} H={size.H} type={type} cfg={cfg} thuColor={thuColor} chiColor={chiColor} />
        </div>
        <figcaption style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Đơn vị: triệu đồng / tuần. Rê chuột vào cột/điểm để xem số liệu.</figcaption>
      </figure>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,15 10,9 14,13 20,5" /><polyline points="14,5 20,5 20,11" /></svg>
        <span style={{ fontSize: 13 }}>Tồn quỹ dự kiến cuối kỳ: <strong>6.78 tỷ</strong> — hiện tại <span className="mono">4.20 tỷ</span></span>
        <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 999, background: 'var(--success-tint)', color: 'var(--success)', fontSize: 11.5, fontWeight: 600 }}>+2.58 tỷ</span>
      </div>
    </div>
  )
}
