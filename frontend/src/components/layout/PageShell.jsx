import Topbar from './Topbar'

export default function PageShell({ title, subtitle, icon, topbarChildren, children }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title={title} subtitle={subtitle} icon={icon}>{topbarChildren}</Topbar>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
