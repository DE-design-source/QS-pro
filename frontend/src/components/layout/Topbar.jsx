
import { useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { useSidebar } from '../../hooks/useSidebar'

export default function Topbar({ title, subtitle, icon, children }) {
  const { theme, toggleTheme } = useTheme()
  const { level, cycle } = useSidebar()
  const [searchValue, setSearchValue] = useState('')

  return (
    <div className="app-topbar" style={{
      height: 64, borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 14,
      flex: 'none', background: 'var(--surface)',
    }}>

      {icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--primary-tint)', color: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        }}>
          {icon}
        </div>
      )}

      {/* Tiêu đề & Subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{title}</h1>}
        {subtitle && <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
      </div>

      {children}

      {/* 1. Thanh tìm kiếm (Tìm công việc, hồ sơ...) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface-alt)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '0 14px',
        height: 38,
        width: 250,
        gap: 9,
      }}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Tìm công việc, hồ sơ..."
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '13px',
            color: 'var(--text)',
            width: '100%',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* 2. Nút chuông thông báo có chấm đỏ */}
      <button
        type="button"
        title="Thông báo"
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: '6px',
          flex: 'none',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Chấm tròn đỏ thông báo mới */}
        <span style={{
          position: 'absolute',
          top: 3,
          right: 3,
          width: 8.5,
          height: 8.5,
          borderRadius: '50%',
          background: '#ef4444',
          border: '1.5px solid var(--surface)',
        }} />
      </button>

      {/* 3. Theme toggle */}
      <button
        onClick={toggleTheme}
        title="Đổi giao diện sáng/tối"
        style={{
          width: 36, height: 36, borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--surface-alt)',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', flex: 'none',
        }}
      >
        {theme === 'dark'
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
        }
      </button>

      {/* 4. User avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--primary-tint)', color: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13, flex: 'none',
        cursor: 'pointer',
      }}>TA</div>
    </div>
  )
}