import Topbar from './Topbar'

export default function PageShell({ title, subtitle, icon, topbarChildren, children }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title={title} subtitle={subtitle} icon={icon}>{topbarChildren}</Topbar>
      {/* Lề nội dung dùng chung --page-gutter như các trang khác */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--page-gutter)', boxSizing: 'border-box' }}>
        {children}
      </div>
    </div>
  )
}
