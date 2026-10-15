import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MINI_CAL_DAYS, CAL_DOW_SHORT, FOLLOWED_CALENDARS, COLLEAGUE_DIRECTORY, MINI_TASKS, MINI_CHATS, MINI_DOCS } from '../../../data/lichData'

const TABS = [['lich', 'Lịch'], ['nhiemvu', 'Nhiệm vụ'], ['chat', 'Chat'], ['taileu', 'Tài liệu']]
const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 15px' }
const listCardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '8px 10px' }
const noteStyle = { fontSize: 10.5, color: 'var(--text-muted)', padding: '0 2px' }
const linkStyle = { color: 'var(--primary)', fontWeight: 600 }

/* Một dòng lịch có ô đánh dấu (bật/tắt hiển thị sự kiện của lịch đó) */
function CalRow({ color, checked, onToggle, label, tag }) {
  return (
    <div className="lc-cal-list-row">
      <div className={`lc-cal-list-dot${checked ? ' checked' : ''}`} style={{ '--dot-c': color }} onClick={onToggle} />
      {label}
      {tag && <span className="lc-cal-list-tag">{tag}</span>}
    </div>
  )
}

const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
)

export default function CalSidebar({ checkedMap, onToggleDot, colleagues, onAddColleague }) {
  const [tab, setTab] = useState('lich')
  const available = COLLEAGUE_DIRECTORY.filter(c => !colleagues.some(t => t.name === c.name))

  return (
    <div style={{ width: 246, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div className="lc-cal-sidebar-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`lc-cal-sidebar-tab${tab === key ? ' active' : ''}`} type="button" onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Tab Lịch */}
      <div className={`lc-cal-sidebar-pane${tab === 'lich' ? ' active' : ''}`} style={{ gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12.5 }}>Tháng 9, 2026</div>
          </div>
          <div className="lc-mini-cal-grid" style={{ marginBottom: 2 }}>
            {CAL_DOW_SHORT.map(d => <div key={d} className="lc-mini-cal-dow">{d}</div>)}
          </div>
          <div className="lc-mini-cal-grid">
            {MINI_CAL_DAYS.map(([d, cls], i) => <div key={i} className={`lc-mini-cal-day${cls ? ' ' + cls : ''}`}>{d}</div>)}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Đang quản lý</div>
          <CalRow color="var(--primary)" checked={checkedMap.me} onToggle={() => onToggleDot('me', 'me')} label="Chu Quang Thành" />
          <div>
            {colleagues.map(c => (
              <CalRow key={c.calKey} color={c.color} checked={checkedMap[c.calKey]} onToggle={() => onToggleDot(c.calKey, c.calKey)} label={c.name} tag="Đã chia sẻ" />
            ))}
          </div>
          {/* Bản HTML: chọn xong thì option bị xóa nên select luôn quay về dòng đầu */}
          <select
            value=""
            onChange={e => onAddColleague(e.target.value)}
            style={{ width: '100%', marginTop: 8, padding: '6px 9px', borderRadius: 7, border: '1px dashed var(--border)', background: 'var(--surface-alt)', color: 'var(--text-muted)', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <option value="">+ Thêm đồng nghiệp để so sánh</option>
            {available.map(c => <option key={c.name} value={`${c.name}|${c.color}`}>{c.name}</option>)}
          </select>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>Chỉ hiện lịch đã được đồng nghiệp chia sẻ với bạn.</div>
        </div>

        <div style={{ ...cardStyle, maxHeight: 260, overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Đang theo dõi</div>
          {FOLLOWED_CALENDARS.map(f => (
            <CalRow key={f.key} color={f.color} checked={checkedMap[f.key]} onToggle={() => onToggleDot(f.key, f.cal)} label={f.label} tag="Bên ngoài" />
          ))}
        </div>
      </div>

      {/* Tab Nhiệm vụ */}
      <div className={`lc-cal-sidebar-pane${tab === 'nhiemvu' ? ' active' : ''}`}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Nhiệm vụ liên kết hôm nay</div>
          {MINI_TASKS.map(t => (
            <div key={t.text} className={`lc-mini-task-row${t.done ? ' done' : ''}`}>
              <input type="checkbox" defaultChecked={!!t.done} />
              <div className="lc-txt">{t.text}<span className="lc-meta">{t.meta}</span></div>
            </div>
          ))}
        </div>
        <div style={noteStyle}>Nhiệm vụ được tạo tự động từ sự kiện lịch có gắn nhãn công việc. Xem đầy đủ tại <Link to="/nhiem-vu" style={linkStyle}>Nhiệm vụ</Link>.</div>
      </div>

      {/* Tab Chat */}
      <div className={`lc-cal-sidebar-pane${tab === 'chat' ? ' active' : ''}`}>
        <div style={listCardStyle}>
          <div style={{ fontWeight: 700, fontSize: 12.5, margin: '6px 6px 4px' }}>Trò chuyện liên quan</div>
          {MINI_CHATS.map(c => (
            <div key={c.name} className="lc-mini-chat-row">
              <span className="lc-avatar" style={{ background: c.color }}>{c.initials}</span>
              <div className="lc-txt"><div className="lc-name">{c.name}</div><div className="lc-preview">{c.preview}</div></div>
            </div>
          ))}
        </div>
        <div style={noteStyle}>Mở đầy đủ tại <Link to="/chat" style={linkStyle}>Chat</Link>.</div>
      </div>

      {/* Tab Tài liệu */}
      <div className={`lc-cal-sidebar-pane${tab === 'taileu' ? ' active' : ''}`}>
        <div style={listCardStyle}>
          <div style={{ fontWeight: 700, fontSize: 12.5, margin: '6px 6px 4px' }}>Tài liệu gắn với sự kiện</div>
          {MINI_DOCS.map(d => (
            <div key={d.name} className="lc-mini-doc-row">
              <span className="lc-ic"><DocIcon /></span>
              <div className="lc-txt"><div className="lc-name">{d.name}</div><div className="lc-meta">{d.meta}</div></div>
            </div>
          ))}
        </div>
        <div style={noteStyle}>Mở đầy đủ tại <Link to="/wiki" style={linkStyle}>Wiki / Tài liệu</Link>.</div>
      </div>
    </div>
  )
}
