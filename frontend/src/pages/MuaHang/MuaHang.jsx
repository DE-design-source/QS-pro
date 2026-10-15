import { useState } from 'react'
import { Link } from 'react-router-dom'
import './MuaHang.css'
import { useTheme } from '../../hooks/useTheme'
import { PURCHASE_ORDERS, PO_STATUS, PO_FILTERS, KPIS } from '../../data/muaHangData'
import Dezbot, { loadAiPanelWidth } from './components/Dezbot'

export default function MuaHang() {
  const { theme, toggleTheme } = useTheme()
  const [filter, setFilter] = useState('all')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiWidth, setAiWidth] = useState(loadAiPanelWidth)
  const [aiResizing, setAiResizing] = useState(false)

  return (
    <div
      className={`mh-page${aiOpen ? ' mh-ai-open' : ''}${aiResizing ? ' mh-ai-resizing' : ''}`}
      style={{ '--ai-panel-width': `${aiWidth}px` }}
    >
      <div className="mh-header">
        <div className="mh-header-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
        </div>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>Mua hàng</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Đơn mua hàng vật tư — đồng bộ từ bóc tách QS</span>
        <span style={{ flex: 1 }} />
        <Link to="/qs" className="mh-qs-link">Xem bóc tách tại QS ›</Link>
        <button className="mh-theme-toggle" title="Chuyển giao diện sáng/tối" onClick={toggleTheme}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>}
        </button>
      </div>

      <div className="mh-scroll">
        <div className="mh-kpi-grid">
          {KPIS.map(k => (
            <div key={k.label} className="mh-card mh-kpi">
              <div className="mh-kpi-label">{k.label}</div>
              <div className={`mh-kpi-value${k.mono ? ' mono' : ''}`} style={k.color ? { color: k.color } : undefined}>{k.value}</div>
              <div className="mh-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="mh-card" style={{ padding: '6px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {PO_FILTERS.map(f => (
                <button key={f} className={`mh-po-filter${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'Tất cả' : f}
                </button>
              ))}
            </div>
            <div className="mh-create-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Tạo đơn mua hàng
            </div>
          </div>
          <div className="mh-po-grid mh-po-head">
            <span>Mã PO</span><span>Nhà cung cấp</span><span>Số mặt hàng</span><span>Tổng giá trị</span><span>Ngày giao dự kiến</span><span>Trạng thái</span>
          </div>
          {PURCHASE_ORDERS.map((po, i) => {
            if (filter !== 'all' && po.status !== filter) return null
            const st = PO_STATUS[po.status]
            // Viền dưới gắn với từng dòng theo thứ tự gốc (dòng cuối không viền), giống bản HTML khi lọc
            const isLast = i === PURCHASE_ORDERS.length - 1
            return (
              <div key={po.code} className="mh-po-grid mh-po-row" style={isLast ? undefined : { borderBottom: '1px solid var(--border)' }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{po.code}</span>
                <span style={{ fontSize: 12.5 }}>{po.supplier}</span>
                <span className="mono" style={{ fontSize: 12 }}>{po.items}</span>
                <span className="mono" style={{ fontSize: 12.5 }}>{po.total}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{po.date}</span>
                <span className="mh-pill" style={{ background: st.bg, color: st.color }}>{po.status}</span>
              </div>
            )
          })}
        </div>

        <div className="mh-card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 14 }}>Nhà cung cấp</h3>
          <div className="mh-supplier-grid">
            {PURCHASE_ORDERS.map(po => (
              <div key={po.supplier} className="mh-supplier">
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{po.supplier}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>1 đơn · {po.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dezbot
        open={aiOpen}
        onToggle={() => setAiOpen(o => !o)}
        onClose={() => setAiOpen(false)}
        onResize={setAiWidth}
        onResizingChange={setAiResizing}
      />
    </div>
  )
}
