import { useState } from 'react'
import { COMPANY_DIRECTORY } from '../../../data/chatData'
import { SearchIcon, initials } from './shared'

/* Modal "Danh bạ công ty" — renderDirectory() / openDirectory() / closeDirectory() trong chat.html.
   Component được mount mỗi lần mở nên ô tìm kiếm luôn bắt đầu rỗng. */
export default function DirectoryModal({ conversations, onClose, onOpenDm }) {
  const [search, setSearch] = useState('')
  const filter = search.trim().toLowerCase()

  const groups = COMPANY_DIRECTORY.map(g => ({
    dept: g.dept,
    people: g.people.filter(p => !filter || p.name.toLowerCase().includes(filter) || p.role.toLowerCase().includes(filter) || g.dept.toLowerCase().includes(filter)),
  })).filter(g => g.people.length)

  return (
    <div
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,18,25,.5)', zIndex: 120, alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', width: 520, maxWidth: '92vw', maxHeight: '82vh', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--ch-font)', fontWeight: 800, fontSize: 16 }}>Danh bạ công ty</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flex: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: '14px 22px 0' }}>
          <div className="ch-search-box" style={{ margin: 0 }}>
            <SearchIcon />
            <input type="text" placeholder="Tìm theo tên, vai trò, phòng ban..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 22px 20px' }}>
          {!groups.length && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: '24px 0' }}>Không tìm thấy liên hệ phù hợp.</div>
          )}
          {groups.map(g => (
            <div key={g.dept} className="ch-dir-dept">
              <div className="ch-dir-dept-title">{g.dept} ({g.people.length})</div>
              {g.people.map(p => {
                /* Chỉ người đã có hội thoại riêng mới bấm được để mở chat (giống bản HTML) */
                const dm = conversations.find(c => c.type === 'dm' && c.name === p.name)
                return (
                  <div key={p.name} className="ch-dir-person" onClick={dm ? () => onOpenDm(dm.id) : undefined}>
                    <span className="ch-m-avatar" style={{ background: p.color }}>{initials(p.name)}</span>
                    <span><span className="ch-m-name">{p.name}</span><br /><span className="ch-m-role">{p.role}</span></span>
                    {dm && <span className="ch-m-msg-hint">Nhắn tin →</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
