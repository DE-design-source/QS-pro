import { useState } from 'react'
import './IT.css'
import { useTheme } from '../../hooks/useTheme'
import { TICKETS, PRIO_LABEL, PRIO_COLOR, TICKET_STATUS, ASSETS, ASSET_STATUS, isOpenTicket } from '../../data/itData'
import Dezbot, { loadAiPanelWidth } from './components/Dezbot'

function StatusBadge({ status }) {
  const [label, color, bg] = status
  return <span className="it-badge" style={{ background: bg, color }}>{label}</span>
}

function Kpi({ label, value, valueColor, children }) {
  return (
    <div className="it-card it-kpi-card">
      <div className="it-kpi-label">{label}</div>
      <div className="it-kpi-num" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      {children}
    </div>
  )
}

function Section({ icon, title, meta, headers, children }) {
  return (
    <div className="it-card it-section-card">
      <div className="it-section-head">
        <div className="it-section-icon">{icon}</div>
        <h3>{title}</h3>
        <span style={{ flex: 1 }} />
        <span className="it-section-meta">{meta}</span>
      </div>
      <div className="it-table-wrap">
        <table className="it-table">
          <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

const iconProps = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export default function IT() {
  const { theme, toggleTheme } = useTheme()
  const [aiOpen, setAiOpen] = useState(false)
  const [aiWidth, setAiWidth] = useState(loadAiPanelWidth)
  const [aiResizing, setAiResizing] = useState(false)

  const openTickets = TICKETS.filter(isOpenTicket).length

  return (
    <div
      className={`it-page${aiOpen ? ' it-ai-open' : ''}${aiResizing ? ' it-ai-resizing' : ''}`}
      style={{ '--ai-panel-width': `${aiWidth}px` }}
    >
      <div className="it-header">
        <div className="it-header-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
        </div>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>IT</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Quản lý hạ tầng CNTT, thiết bị &amp; yêu cầu hỗ trợ</span>
        <span style={{ flex: 1 }} />
        <button className="it-theme-toggle" title="Chuyển giao diện sáng/tối" onClick={toggleTheme}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>}
        </button>
      </div>

      <div className="it-scroll">
        <div className="it-content">
          <div className="it-kpi-grid">
            <Kpi label="Ticket đang mở" value={openTickets}>
              <div className="it-badge" style={{ background: 'var(--warn-tint)', color: 'var(--warn)' }}>Cần theo dõi</div>
            </Kpi>
            <Kpi label="Thiết bị đang quản lý" value="186">
              <div className="it-kpi-sub">Laptop, máy chủ, camera, mạng</div>
            </Kpi>
            <Kpi label="Uptime hệ thống tháng này" value="99.8%" valueColor="var(--success)">
              <div className="it-kpi-sub">Máy chủ &amp; hạ tầng mạng</div>
            </Kpi>
            <Kpi label="Yêu cầu hoàn thành tuần này" value="27">
              <div className="it-badge" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>+5 so với tuần trước</div>
            </Kpi>
          </div>

          <Section
            title="Yêu cầu hỗ trợ"
            meta={`${TICKETS.length} yêu cầu gần đây`}
            headers={['Người yêu cầu', 'Vấn đề', 'Mức độ ưu tiên', 'Trạng thái', 'Ngày tạo']}
            icon={<svg {...iconProps}><path d="M2 9a3 3 0 0 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /></svg>}
          >
            {TICKETS.map(t => (
              <tr key={t.requester + t.date}>
                <td style={{ fontWeight: 700 }}>{t.requester}</td>
                <td>{t.issue}</td>
                <td><span className="it-prio-dot" style={{ background: PRIO_COLOR[t.priority] }} />{PRIO_LABEL[t.priority]}</td>
                <td><StatusBadge status={TICKET_STATUS[t.status]} /></td>
                <td className="mono">{t.date}</td>
              </tr>
            ))}
          </Section>

          <Section
            title="Thiết bị & tài sản CNTT"
            meta="Đang theo dõi 186 thiết bị"
            headers={['Thiết bị', 'Loại', 'Người / vị trí sử dụng', 'Trạng thái']}
            icon={<svg {...iconProps}><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>}
          >
            {ASSETS.map(a => (
              <tr key={a.name}>
                <td style={{ fontWeight: 700 }}>{a.name}</td>
                <td>{a.type}</td>
                <td>{a.owner}</td>
                <td><StatusBadge status={ASSET_STATUS[a.status]} /></td>
              </tr>
            ))}
          </Section>
        </div>
      </div>

      <Dezbot
        open={aiOpen}
        onOpen={() => setAiOpen(true)}
        onClose={() => setAiOpen(false)}
        onResize={setAiWidth}
        onResizingChange={setAiResizing}
      />
    </div>
  )
}
