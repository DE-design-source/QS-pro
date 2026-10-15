import { useEffect, useRef } from 'react'
import { ME, COLORS } from '../../../data/chatData'
import { ConvAvatar, FileIcon, PIN_PATH, SearchIcon, UsersIcon, initials } from './shared'
import AddMemberPopover from './AddMemberPopover'
import Composer from './Composer'
import RequestCard from './RequestCard'

/* Ô sửa tin nhắn: mở ra là focus và đặt con trỏ ở cuối (giống bản HTML) */
function MessageEditor({ text, onCancel, onSave }) {
  const taRef = useRef(null)
  useEffect(() => {
    const ta = taRef.current
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
  }, [])
  return (
    <div className="ch-bubble ch-msg-edit-box">
      <textarea ref={taRef} defaultValue={text} />
      <div className="ch-msg-edit-actions">
        <button type="button" className="ch-msg-edit-btn cancel" onClick={onCancel}>Huỷ</button>
        <button type="button" className="ch-msg-edit-btn save" onClick={() => onSave(taRef.current.value.trim())}>Lưu</button>
      </div>
    </div>
  )
}

/* Thẻ thông báo của SiteFlow Bot */
function BotCard({ m }) {
  /* Bản HTML: mức "amber" tô màu bằng inline style */
  const style = m.level === 'amber' ? { borderColor: 'var(--finance)', background: 'var(--finance-tint)', color: 'var(--finance)' } : undefined
  return (
    <div className={'ch-bot-card' + (m.level === 'info' ? ' info' : '')} style={style}>
      <span className="ch-bc-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l10 18H2z" /><line x1="12" y1="10" x2="12" y2="15" /><circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none" /></svg></span>
      <div className="ch-bc-text"><strong>{m.title}</strong>{m.text}<div className="ch-bc-meta">{m.meta} · {m.time}</div></div>
    </div>
  )
}

const actIcon = { width: 12, height: 12, viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

/* Cột hội thoại: đầu thread, thanh tin ghim, danh sách tin nhắn, khung soạn tin
   — renderThread() + renderPinnedBar() trong chat.html */
export default function Thread({
  conv, requests, onUpdateRequest, editingIdx, scrollTick, memberPopOpen,
  onToggleMemberPop, onCloseMemberPop, onAddMember,
  onStartEdit, onCancelEdit, onSaveEdit, onTogglePinMsg, onUnpinMsg, onDeleteMsg, onSend,
}) {
  const boxRef = useRef(null)

  /* Bản HTML: mỗi lần renderThread() đều cuộn xuống cuối */
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [conv.id, conv.messages, editingIdx, scrollTick])

  const pinned = conv.messages.map((m, i) => ({ m, i })).filter(x => x.m.pinned && !x.m.bot)

  let lastWho = null
  const items = conv.messages.map((m, idx) => {
    if (m.bot) {
      lastWho = null
      if (m.request) {
        const req = requests.find(r => r.id === m.reqId)
        return req ? <RequestCard key={m.reqId} req={req} onUpdate={onUpdateRequest} /> : null
      }
      return <BotCard key={idx} m={m} />
    }
    const own = m.who === ME
    const sameAsLast = lastWho === m.who
    lastWho = m.who
    return (
      <div key={idx} className={'ch-msg-group' + (own ? ' own' : '')} data-msg-idx={idx}>
        {sameAsLast
          ? <div style={{ width: 34, flex: 'none' }} />
          : <div className="ch-g-avatar" style={{ background: own ? COLORS.purple : m.color }}>{initials(m.who)}</div>}
        <div className="ch-g-col">
          {!sameAsLast && !own && <div className="ch-sender-name">{m.who}</div>}
          <div className="ch-bubble-row">
            <div>
              {m.pinned && (
                <div className="ch-msg-pinned-flag"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d={PIN_PATH} /></svg>Đã ghim</div>
              )}
              {editingIdx === idx ? (
                <MessageEditor text={m.text} onCancel={onCancelEdit} onSave={val => onSaveEdit(idx, val)} />
              ) : (
                <div className="ch-bubble">
                  {m.text}
                  {m.image && <img className="ch-msg-image" src={m.image} alt="Ảnh đã gửi" />}
                  {m.file && (
                    <div className="ch-file-chip">
                      <span className="ch-f-icon"><FileIcon size={15} /></span>
                      <span><span className="ch-f-name">{m.file.name}</span><br /><span className="ch-f-size">{m.file.size}</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ch-msg-actions">
              <button className={'ch-msg-action-btn' + (m.pinned ? ' active' : '')} title={m.pinned ? 'Bỏ ghim' : 'Ghim tin nhắn'} onClick={() => onTogglePinMsg(idx)}>
                <svg {...actIcon} fill={m.pinned ? 'currentColor' : 'none'}><path d={PIN_PATH} /><line x1="12" y1="17" x2="12" y2="22" /></svg>
              </button>
              {own && (
                <button className="ch-msg-action-btn" title="Chỉnh sửa tin nhắn" onClick={() => onStartEdit(idx)}>
                  <svg {...actIcon} fill="none"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="M15 5l4 4" /></svg>
                </button>
              )}
              <button className="ch-msg-action-btn" title="Xoá tin nhắn" onClick={() => onDeleteMsg(idx)}>
                <svg {...actIcon} fill="none"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-.9 14a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
              </button>
            </div>
          </div>
          <span className="ch-msg-time">{m.time}{m.edited && <span className="ch-msg-edited-flag">(đã chỉnh sửa)</span>}</span>
        </div>
      </div>
    )
  })

  return (
    <div className="ch-thread">
      <div className="ch-thread-head">
        <ConvAvatar conv={conv} size={36} extraClass="ch-t-avatar" />
        <div>
          <div className="ch-t-name">{conv.name}</div>
          <div className="ch-t-sub">{conv.sub}</div>
        </div>
        <div className="ch-thread-actions">
          {/* Bản HTML: hai nút đầu chưa gắn hành động */}
          <button className="ch-icon-btn" title="Tìm trong hội thoại"><SearchIcon size={15} /></button>
          <button className="ch-icon-btn" title="Gọi thoại"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 3a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.4c1 .4 2 .6 3 .7a2 2 0 0 1 1.6 2z" /></svg></button>
          {conv.type === 'group' && (
            <button className="ch-icon-btn" title="Thêm người vào nhóm" onClick={e => { e.stopPropagation(); onToggleMemberPop() }}><UsersIcon /></button>
          )}
          {conv.type === 'group' && memberPopOpen && <AddMemberPopover onAdd={onAddMember} onClose={onCloseMemberPop} />}
        </div>
      </div>

      <div className="ch-pinned-bar" style={{ display: pinned.length ? 'flex' : 'none' }}>
        {pinned.length > 0 && <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ flex: 'none' }}><path d={PIN_PATH} /></svg>}
        {pinned.map(x => (
          <span key={x.i} className="ch-pin-chip">
            {x.m.text.slice(0, 40)}{x.m.text.length > 40 ? '…' : ''}
            <button title="Bỏ ghim" onClick={() => onUnpinMsg(x.i)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </span>
        ))}
      </div>

      <div className="ch-thread-messages" ref={boxRef}>
        <div className="ch-date-divider">Hôm nay</div>
        {items}
      </div>

      <div className="ch-typing">{conv.id === 'g1' ? 'Chị Hoa đang nhập...' : ''}</div>

      <Composer onSend={onSend} />
    </div>
  )
}
