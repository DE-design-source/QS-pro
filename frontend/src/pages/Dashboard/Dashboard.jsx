import { useState } from 'react'
import './Dashboard.css'
import { useTheme } from '../../hooks/useTheme'
import { NF_TABS } from '../../data/dashboardData'
import NewsTab from './components/NewsTab'
import RankTab from './components/RankTab'
import Dezbot from './components/Dezbot'
import NotificationBell from '../../components/layout/NotificationBell'

export default function Dashboard() {
  const { theme, toggleTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('tintuc')
  const [filter, setFilter] = useState('all')
  const [rankPeriod, setRankPeriod] = useState('week')

  return (
    <div className="db-page">
      {/* Topbar riêng của Newsfeed (cao 56px, có hai tab chính, ô tìm kiếm, chuông, đổi giao diện, avatar) */}
      <div className="db-topbar">
        {/* Hai tab chính nằm ngay trên thanh đầu trang (bên trái vốn để trống) để nội dung không bị đẩy xuống */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {NF_TABS.map(t => (
            <button key={t.key} type="button" className={`db-newsfeed-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="db-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tìm công việc, hồ sơ...</span>
          </div>
          <NotificationBell />
          <button className="db-theme-toggle" title="Chuyển giao diện sáng/tối" onClick={toggleTheme}>
            {theme === 'dark'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>}
          </button>
          <div className="db-me">TA</div>
        </div>
      </div>

      <div className="db-content">
        <div className="db-feed-col">
          {/* Hai tab luôn được mount, ẩn/hiện bằng display như bản HTML */}
          <NewsTab active={activeTab === 'tintuc'} filter={filter} onFilter={setFilter} />
          <RankTab active={activeTab === 'nhiemvu'} period={rankPeriod} onPeriod={setRankPeriod} />
        </div>

        <Dezbot />
      </div>
    </div>
  )
}
