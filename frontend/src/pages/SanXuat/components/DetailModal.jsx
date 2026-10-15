import { useEffect, useRef, useState } from 'react'
import { MENTION_NAMES, initialsOf, stageOf } from '../../../data/sanXuatData'

const MENTION_QUERY_RE = /@([^\s@]*)$/
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MENTION_RE = new RegExp(`@(${MENTION_NAMES.map(escapeRe).join('|')})`, 'g')

/* Tô sáng "@Tên" của các nhân sự đã biết, giống formatCommentText */
function CommentText({ text }) {
  const parts = []
  let last = 0
  for (const m of text.matchAll(MENTION_RE)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<span key={m.index} className="sx-mention-pill">@{m[1]}</span>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

export default function DetailModal({ order, open, onClose, onComment }) {
  const [input, setInput] = useState('')
  const [mentions, setMentions] = useState([])
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { if (open) { setInput(''); setMentions([]) } }, [open, order?.code])
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [order?.comments.length, open])

  function handleInput(e) {
    const value = e.target.value
    setInput(value)
    const match = value.slice(0, e.target.selectionStart).match(MENTION_QUERY_RE)
    setMentions(match ? MENTION_NAMES.filter(n => n.toLowerCase().includes(match[1].toLowerCase())) : [])
  }

  function pickMention(name) {
    const el = inputRef.current
    const caret = el.selectionStart
    const replaced = input.slice(0, caret).replace(MENTION_QUERY_RE, '@' + name + ' ')
    setInput(replaced + input.slice(caret))
    setMentions([])
    el.focus()
  }

  function submit() {
    const text = input.trim()
    if (!text || !order) return
    onComment(order.code, text)
    setInput('')
    setMentions([])
  }

  const stage = order ? stageOf(order.stage) : null
  const strong = { color: 'var(--text)' }

  return (
    <div className={`sx-modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sx-detail-box">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{order?.code}</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{order?.name}</h3>
          </div>
          <button className="sx-close-btn" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', padding: '10px 0 14px', borderBottom: '1px solid var(--border)', marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          {order && (
            <>
              <span><strong style={strong}>Khách hàng:</strong> {order.customer}</span>
              <span><strong style={strong}>Công đoạn:</strong> <span style={{ color: stage.color, fontWeight: 600 }}>{stage.label}</span></span>
              <span><strong style={strong}>Phụ trách:</strong> {order.worker}</span>
              <span><strong style={strong}>Giao hàng:</strong> {order.late ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Trễ · {order.due}</span> : order.due}</span>
            </>
          )}
        </div>

        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Bình luận</h4>
        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflowY: 'auto' }}>
          {order && order.comments.length ? order.comments.map((c, i) => (
            <div key={i} className="sx-comment-row">
              <div className="sx-comment-avatar">{initialsOf(c.author)}</div>
              <div className="sx-comment-bubble">
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{c.author} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 10.5 }}>{c.time}</span></div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5 }}><CommentText text={c.text} /></div>
              </div>
            </div>
          )) : <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '14px 0', textAlign: 'center' }}>Chưa có bình luận nào.</div>}
        </div>

        <div style={{ position: 'relative', marginTop: 14 }}>
          {mentions.length > 0 && (
            <div className="sx-mention-dropdown">
              {mentions.map(n => (
                <div key={n} className="sx-suggest-item" onMouseDown={e => { e.preventDefault(); pickMention(n) }}>
                  <span className="sx-comment-avatar" style={{ width: 20, height: 20, fontSize: 9 }}>{initialsOf(n)}</span>{n}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="sx-comment-avatar" style={{ flex: 'none' }}>TA</div>
            <textarea
              ref={inputRef}
              rows={2}
              placeholder="Viết bình luận, gõ @ để nhắc đến đồng nghiệp..."
              value={input}
              onChange={handleInput}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !mentions.length) { e.preventDefault(); submit() } }}
              style={{ flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 11px', fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface-alt)', color: 'var(--text)' }}
            />
            <button className="sx-modal-btn submit" style={{ flex: 'none' }} onClick={submit}>Gửi</button>
          </div>
        </div>
      </div>
    </div>
  )
}
