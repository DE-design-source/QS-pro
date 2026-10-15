import { ME } from '../../../data/chatData'
import { ConvAvatar, PIN_PATH, SearchIcon, UsersIcon } from './shared'

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'group', label: 'Nhóm' },
  { key: 'unread', label: 'Chưa đọc' },
]

/* Cột danh sách hội thoại — renderConvList() trong chat.html */
export default function ConversationList({ conversations, activeId, filterTab, searchTerm, onTab, onSearch, onSelect, onTogglePin, onOpenDirectory }) {
  const rows = conversations
    .filter(c => filterTab === 'all' || (filterTab === 'unread' && c.unread > 0) || (filterTab === 'group' && c.type === 'group'))
    .filter(c => !searchTerm || c.name.toLowerCase().includes(searchTerm))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div className="ch-conv-list">
      <div className="ch-conv-head">
        <div className="ch-row1">
          <h2>Chat</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="ch-icon-btn" title="Danh bạ" onClick={onOpenDirectory}>
              <UsersIcon />
            </button>
            {/* Bản HTML: nút này chưa gắn hành động nào */}
            <button className="ch-icon-btn" title="Soạn tin nhắn mới">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>
        <div className="ch-search-box">
          <SearchIcon />
          {/* Ô nhập không điều khiển (giữ nguyên chuỗi người dùng gõ), từ khoá lọc = trim + lowercase */}
          <input type="text" placeholder="Tìm cuộc trò chuyện..." onChange={e => onSearch(e.target.value.trim().toLowerCase())} />
        </div>
        <div className="ch-conv-tabs">
          {TABS.map(t => (
            <button key={t.key} className={filterTab === t.key ? 'active' : undefined} onClick={() => onTab(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="ch-conv-items">
        {rows.map(c => {
          const last = c.messages[c.messages.length - 1]
          /* Bản HTML giả định hội thoại luôn còn tin nhắn; ở đây xoá hết thì để trống thay vì lỗi */
          const preview = !last ? '' : last.bot ? (last.title + ': ' + last.text) : (last.who === ME ? 'Bạn: ' + last.text : last.text)
          return (
            <div key={c.id} className={'ch-conv-item' + (c.id === activeId ? ' active' : '') + (c.pinned ? ' pinned' : '')} onClick={() => onSelect(c.id)}>
              <ConvAvatar conv={c} />
              <div className="ch-conv-body">
                <div className="ch-conv-top">
                  {c.pinned && <svg className="ch-conv-pinned-icon" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d={PIN_PATH} /></svg>}
                  <span className="ch-conv-name">{c.name}</span>
                  <span className="ch-conv-time">{last ? last.time : ''}</span>
                </div>
                <div className="ch-conv-bottom">
                  <span className="ch-conv-preview">{preview}</span>
                  {c.unread > 0 && <span className="ch-conv-unread">{c.unread}</span>}
                </div>
              </div>
              <button
                type="button"
                className="ch-conv-pin-btn"
                title={c.pinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại lên đầu'}
                onClick={e => { e.stopPropagation(); onTogglePin(c.id) }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={c.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={PIN_PATH} /><line x1="12" y1="17" x2="12" y2="22" /></svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
