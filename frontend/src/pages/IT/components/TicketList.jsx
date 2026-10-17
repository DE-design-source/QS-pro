import { useState } from 'react'
import { TICKETS, TICKET_GROUPS, PRIO_LABEL, PRIO_COLOR, TICKET_CATEGORIES } from '../../../data/itData'

const PAGE_SIZE = 10
const CATEGORY = Object.fromEntries(TICKET_CATEGORIES)
const GROUP = Object.fromEntries(TICKET_GROUPS.map(([key, label, color]) => [key, { label, color }]))
const toISO = d => d.split('/').reverse().join('-')
const norm = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

const Chevron = ({ d }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>

/* Danh sách yêu cầu hỗ trợ — lọc theo trạng thái, tìm kiếm, phân trang; bấm một dòng để xem chi tiết */
export default function TicketList({ tickets = TICKETS, highlightId, onOpen }) {
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)

  const sorted = [...tickets].sort((a, b) => toISO(b.date).localeCompare(toISO(a.date)) || b.id - a.id)
  const term = norm(q.trim())
  const searched = sorted.filter(t => !term || norm(`#${t.id} ${t.issue} ${t.requester}`).includes(term))
  const list = status === 'all' ? searched : searched.filter(t => t.status === status)
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const rows = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)
  const count = key => (key === 'all' ? searched.length : searched.filter(t => t.status === key).length)
  const go = p => setPage(Math.max(1, Math.min(pages, p)))
  const pick = key => { setStatus(key); setPage(1) }

  return (
    <div className="it-card it-tl">
      <div className="it-tl-head">
        <h2>Danh sách yêu cầu</h2>
        <span className="it-tl-updated">Cập nhật ngày {sorted[0]?.date}</span>
        <span style={{ flex: 1 }} />
        <label className="it-tl-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input placeholder="Tìm yêu cầu" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} />
        </label>
      </div>

      <div className="it-tl-bar">
        <div className="it-tl-pills">
          <button className={`it-tl-pill${status === 'all' ? ' active' : ''}`} onClick={() => pick('all')}>
            <i className="all" />Tất cả ({count('all')})
          </button>
          {TICKET_GROUPS.map(([key, label, color]) => (
            <button key={key} className={`it-tl-pill${status === key ? ' active' : ''}`} onClick={() => pick(key)}>
              <i style={{ background: color }} />{label} ({count(key)})
            </button>
          ))}
        </div>
        <div className="it-tl-pager">
          <button disabled={cur <= 1} onClick={() => go(1)} title="Trang đầu"><Chevron d="m11 17-5-5 5-5M18 17l-5-5 5-5" /></button>
          <button disabled={cur <= 1} onClick={() => go(cur - 1)} title="Trang trước"><Chevron d="m15 18-6-6 6-6" /></button>
          <span className="it-tl-page">{cur} / {pages}</span>
          <button disabled={cur >= pages} onClick={() => go(cur + 1)} title="Trang sau"><Chevron d="m9 18 6-6-6-6" /></button>
          <button disabled={cur >= pages} onClick={() => go(pages)} title="Trang cuối"><Chevron d="m13 17 5-5-5-5M6 17l5-5-5-5" /></button>
        </div>
      </div>

      <div className="it-tl-list">
        {rows.length === 0 && <div className="it-tl-empty">Không có yêu cầu phù hợp</div>}
        {rows.map(t => {
          const g = GROUP[t.status]
          const open = openId === t.id
          return (
            <div key={t.id} className={`it-tl-item${open ? ' open' : ''}${highlightId === t.id ? ' new' : ''}`}>
              <button className="it-tl-row" onClick={() => (onOpen ? onOpen(t) : setOpenId(open ? null : t.id))} title={onOpen ? 'Mở trang yêu cầu' : g?.label}>
                <i className="it-tl-dot" style={{ background: g?.color }} />
                <span className="it-tl-id">#{t.id}</span>
                <span className="it-tl-title">{t.issue}</span>
                {t.deadline && <span className="it-tl-deadline" title="Deadline dự kiến">⏱ {t.deadline}</span>}
                <span className="it-tl-date">{t.date}</span>
              </button>
              {open && (
                <div className="it-tl-detail">
                  <span><em>Trạng thái</em><b style={{ color: g?.color }}>{g?.label}</b></span>
                  <span><em>Người yêu cầu</em><b>{t.requester}</b></span>
                  <span><em>Ưu tiên</em><b><i className="it-prio-dot" style={{ background: PRIO_COLOR[t.priority] }} />{PRIO_LABEL[t.priority]}</b></span>
                  {t.category && <span><em>Hạng mục</em><b>{CATEGORY[t.category]}</b></span>}
                  {t.deadline && <span><em>Deadline dự kiến</em><b>{t.deadline}</b></span>}
                  {t.roles?.length
                    ? t.roles.map(r => <span key={r.label}><em>{r.label}</em><b>{r.people.join(', ')}</b></span>)
                    : <span><em>Phụ trách</em><b>{t.assignee || '—'}</b></span>}
                  {t.desc && <p className="it-tl-desc">{t.desc}</p>}
                  {t.images?.length > 0 && <div className="it-tl-imgs">{t.images.map(im => <a key={im.url} href={im.url} target="_blank" rel="noreferrer" title={im.name}><img src={im.url} alt={im.name} /></a>)}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
