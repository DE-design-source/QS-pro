import { FileIcon, IconSvg, initials } from './shared'
import AddMemberPopover from './AddMemberPopover'

const ico16 = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const LINK_PATHS = <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>
const IMAGE_PATHS = <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>

/* Cột thông tin hội thoại bên phải — renderInfo() trong chat.html */
export default function InfoPanel({ conv, conversations, memberPopOpen, onToggleMemberPop, onCloseMemberPop, onAddMember, onOpenConv }) {
  const c = conv
  /* Chat cá nhân (dm): các nhóm chung đang tham gia cùng người này */
  const sharedGroups = c.type === 'dm'
    ? conversations.filter(x => x.type === 'group' && x.members && x.members.some(m => m.name === c.name))
    : []

  const files = c.files || []
  const images = c.images || []
  const links = c.links || []

  return (
    <div className="ch-info-panel">
      <div className="ch-info-hero">
        {c.type === 'dm'
          ? <div className="ch-avatar-lg round" style={{ background: c.color }}>{initials(c.name)}</div>
          : <div className="ch-avatar-lg" style={{ background: c.color }}><IconSvg kind={c.type === 'bot' ? 'bot' : c.icon} /></div>}
        <div className="ch-name">{c.name}</div>
        <div className="ch-sub">{c.sub}</div>
      </div>

      {c.type === 'group' && (
        <div className="ch-info-section">
          <div className="ch-sec-title-row">
            <div className="ch-sec-title">Thành viên ({c.members.length}{c.sub ? ' / ' + c.sub.split(' ')[0] : ''})</div>
            <button type="button" className="ch-pjm-add-btn" title="Thêm người vào nhóm" onClick={e => { e.stopPropagation(); onToggleMemberPop() }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            {memberPopOpen && <AddMemberPopover onAdd={onAddMember} onClose={onCloseMemberPop} />}
          </div>
          {c.members.map((m, i) => (
            <div key={i} className="ch-member-row">
              <span className="ch-m-avatar" style={{ background: m.color }}>{initials(m.name)}</span>
              <span><span className="ch-m-name">{m.name}</span><br /><span className="ch-m-role">{m.role}</span></span>
            </div>
          ))}
        </div>
      )}

      {sharedGroups.length > 0 && (
        <div className="ch-info-section">
          <div className="ch-sec-title">Nhóm chung ({sharedGroups.length})</div>
          {sharedGroups.map(g => (
            <a key={g.id} className="ch-group-row" href="#" onClick={e => { e.preventDefault(); onOpenConv(g.id) }}>
              <span className="ch-g-ico" style={{ background: g.color }}><IconSvg kind={g.icon} /></span>
              <span><span className="ch-g-n">{g.name}</span><br /><span className="ch-g-m">{g.sub}</span></span>
            </a>
          ))}
        </div>
      )}

      {(files.length > 0 || images.length > 0 || links.length > 0) && (
        <div className="ch-info-section">
          <div className="ch-cat-icons">
            <div className="ch-cat-icon-btn" title="Ảnh & video"><svg {...ico16}>{IMAGE_PATHS}</svg><span className="ch-cnt">{images.length}</span><span className="ch-lbl">Ảnh/Video</span></div>
            <div className="ch-cat-icon-btn" title="Tệp"><svg {...ico16}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg><span className="ch-cnt">{files.length}</span><span className="ch-lbl">File</span></div>
            <div className="ch-cat-icon-btn" title="Liên kết"><svg {...ico16}>{LINK_PATHS}</svg><span className="ch-cnt">{links.length}</span><span className="ch-lbl">Link</span></div>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="ch-info-section">
          <div className="ch-sec-title">Ảnh &amp; video đã gửi</div>
          <div className="ch-media-grid">
            {images.map((im, i) => (
              <div key={i} className="ch-media-thumb" style={{ background: im.color }}>
                {im.kind === 'video'
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5,3 19,12 5,21" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{IMAGE_PATHS}</svg>}
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="ch-info-section">
          <div className="ch-sec-title">Tệp đã chia sẻ</div>
          {files.map((f, i) => (
            <div key={i} className="ch-file-row">
              <span className="ch-f-ico" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}><FileIcon size={14} /></span>
              <span><span className="ch-f-n">{f.name}</span><br /><span className="ch-f-m">{f.size}</span></span>
            </div>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="ch-info-section">
          <div className="ch-sec-title">Liên kết đã chia sẻ</div>
          {links.map((l, i) => (
            <div key={i} className="ch-link-row">
              <span className="ch-l-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{LINK_PATHS}</svg></span>
              <span><span className="ch-l-t">{l.title}</span><br /><span className="ch-l-d">{l.domain}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
