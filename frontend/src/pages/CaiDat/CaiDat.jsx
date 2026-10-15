import { useState } from 'react'
import './CaiDat.css'
import { useTheme } from '../../hooks/useTheme'
import { panelStyle } from './components/shared'
import AccountTab from './components/AccountTab'
import AppearanceTab from './components/AppearanceTab'
import NotifyTab from './components/NotifyTab'
import WorkspaceTab from './components/WorkspaceTab'
import RewardsTab from './components/RewardsTab'
import SecurityTab from './components/SecurityTab'
import PermissionsTab from './components/PermissionsTab'
import Dezbot, { loadAiPanelWidth } from './components/Dezbot'

const tabIcon = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

/* Các tab cài đặt (data-tab trong HTML) */
const TABS = [
  { key: 'account', label: 'Tài khoản', Panel: AccountTab, icon: <svg {...tabIcon}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { key: 'appearance', label: 'Giao diện', Panel: AppearanceTab, icon: <svg {...tabIcon}><circle cx="12" cy="12" r="10" /><path d="M12 2a7 7 0 0 0 0 14 7 7 0 0 1 0 6" /></svg> },
  { key: 'notify', label: 'Thông báo', Panel: NotifyTab, icon: <svg {...tabIcon}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg> },
  { key: 'workspace', label: 'Workspace', Panel: WorkspaceTab, icon: <svg {...tabIcon}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg> },
  { key: 'rewards', label: 'Đổi thưởng', Panel: RewardsTab, icon: <svg {...tabIcon}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg> },
  { key: 'security', label: 'Bảo mật', Panel: SecurityTab, icon: <svg {...tabIcon}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg> },
  { key: 'permissions', label: 'Phân quyền', Panel: PermissionsTab, icon: <svg {...tabIcon}><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> },
]

export default function CaiDat() {
  const { theme, toggleTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('account')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiWidth, setAiWidth] = useState(loadAiPanelWidth)
  const [aiResizing, setAiResizing] = useState(false)

  return (
    <div
      className={`cd-page${aiOpen ? ' cd-ai-open' : ''}${aiResizing ? ' cd-ai-resizing' : ''}`}
      style={{ '--ai-panel-width': `${aiWidth}px` }}
    >
      {/* Header — giữ style inline như HTML để theme Liquid Glass (div[style*="height: 64px"]) vẫn áp dụng */}
      <div style={{ height: 64, flex: 'none', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 28px', boxSizing: 'border-box', background: 'var(--surface)', gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary-tint)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
        </div>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>Cài đặt</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tài khoản, giao diện, thông báo &amp; workspace</span>
        <span style={{ flex: 1 }} />
        <button title="Chuyển giao diện sáng/tối" onClick={toggleTheme} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>}
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 0, padding: '22px 28px', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden', display: 'flex', gap: 24 }}>
        {/* Menu cài đặt bên trái */}
        <div style={{ width: 190, flex: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.key} className={`cd-settings-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Các panel — luôn mount (ẩn bằng display) để giữ giá trị đã nhập khi đổi tab, giống HTML */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 900 }}>
          {TABS.map(({ key, Panel }) => (
            <div key={key} className="cd-settings-panel" style={{ ...panelStyle, display: activeTab === key ? 'flex' : 'none' }}>
              <Panel />
            </div>
          ))}
        </div>
      </div>

      <Dezbot
        open={aiOpen}
        onToggle={() => setAiOpen(v => !v)}
        onClose={() => setAiOpen(false)}
        onResize={setAiWidth}
        onResizingChange={setAiResizing}
      />
    </div>
  )
}
