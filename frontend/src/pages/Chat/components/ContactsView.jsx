import { useState } from 'react'
import { COMPANY_DIRECTORY, ME, ORG_NAME, TRUSTED_ORGS, EXTERNAL_CONTACTS, CONTACT_REQUESTS, HELP_DESKS, MY_CARD } from '../../../data/chatData'
import { SearchIcon, initials } from './shared'

/* Icon nét 2 (24x24) cho menu danh bạ */
const I = {
  org: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5v4M5 16.5V14h14v2.5" /></>,
  trusted: <><rect x="3" y="3" width="11" height="11" rx="2" /><rect x="10" y="10" width="11" height="11" rx="2" /></>,
  external: <><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" /><circle cx="12" cy="11" r="2.5" /><path d="M8 17a4 4 0 0 1 8 0" /></>,
  newc: <><circle cx="10" cy="8" r="4" /><path d="M2 21v-1a6 6 0 0 1 9-5.2" /><path d="M18 14v6M15 17h6" /></>,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="9" cy="11" r="2.5" /><path d="M5.5 16a3.5 3.5 0 0 1 7 0M15 10h4M15 14h3" /></>,
  groups: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0" /><circle cx="17" cy="9" r="2.5" /><path d="M17.5 14.5A5 5 0 0 1 22 19" /></>,
  help: <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><rect x="2" y="14" width="4" height="6" rx="1.5" /><rect x="18" y="14" width="4" height="6" rx="1.5" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  plus: <><circle cx="10" cy="8" r="4" /><path d="M2 21v-1a6 6 0 0 1 10-4.4" /><path d="M18 14v6M15 17h6" /></>,
  chev: <polyline points="9 18 15 12 9 6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></>,
}
const Ic = ({ n, size = 18, fill }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{I[n]}</svg>

const MENU = [
  { key: 'org', label: 'Danh bạ tổ chức', icon: 'org', tone: '#0E8A82' },
  { key: 'trusted', label: 'Bên đáng tin cậy', icon: 'trusted', tone: '#7658C2' },
  { key: 'external', label: 'Liên hệ bên ngoài', icon: 'external', tone: '#2F5DA8' },
  { key: 'new', label: 'Liên hệ mới', icon: 'newc', tone: '#2F5DA8' },
  { key: 'starred', label: 'Liên hệ được gắn dấu sao', icon: 'star', tone: '#E08A1E' },
  { key: 'card', label: 'Thẻ liên lạc', icon: 'card', tone: '#E0632E' },
  { key: 'groups', label: 'Nhóm của tôi', icon: 'groups', tone: '#1E8E5A' },
  { key: 'help', label: 'Bộ phận trợ giúp', icon: 'help', tone: '#C0392B' },
]
const REQ_STATUS = { accepted: 'Đã chấp nhận', expired: 'Đã hết hạn', sent: 'Đã gửi lời mời' }
const Avatar = ({ name, color, size = 40 }) => <span className="ch-ct-av" style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.34) }}>{initials(name)}</span>

/* Màn Danh bạ (tham khảo Lark): menu trái + danh sách phải */
export default function ContactsView({ conversations, onMessage, onOpenConv, onBack }) {
  const [section, setSection] = useState('new')
  const [dept, setDept] = useState(null) // phòng ban đang chọn trong Danh bạ tổ chức
  const [orgOpen, setOrgOpen] = useState(true)
  const [q, setQ] = useState('')
  const [external, setExternal] = useState(EXTERNAL_CONTACTS)
  const [requests, setRequests] = useState(CONTACT_REQUESTS)
  const [starred, setStarred] = useState(() => new Set(['Nguyễn Đức Anh', 'Phan Bảo Ngọc', 'Bùi Thị Thanh Tiền']))
  const [adding, setAdding] = useState(null)
  const [copied, setCopied] = useState(false)

  const t = q.trim().toLowerCase()
  const match = (...xs) => !t || xs.join(' ').toLowerCase().includes(t)
  const internal = COMPANY_DIRECTORY.flatMap(g => g.people.map(p => ({ ...p, dept: g.dept })))
  const toggleStar = name => setStarred(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })
  const pending = requests.filter(r => r.status === 'pending').length
  const go = key => { setSection(key); if (key !== 'org') setDept(null) }

  function accept(r) {
    const c = { id: 'x' + Date.now(), name: r.name, company: r.org, role: '', phone: '', email: '', color: r.color }
    setExternal(list => [c, ...list])
    setRequests(list => list.map(x => (x.id === r.id ? { ...x, status: 'accepted', contactId: c.id } : x)))
  }
  const decline = r => setRequests(list => list.filter(x => x.id !== r.id))
  function saveExternal() {
    const f = adding
    if (!f.name.trim()) return
    const c = { id: 'x' + Date.now(), ...f, name: f.name.trim(), color: '#2F5DA8' }
    setExternal(list => [c, ...list])
    setRequests(list => [{ id: 'r' + Date.now(), contactId: c.id, name: c.name, org: c.company || 'Liên hệ cá nhân', note: f.note || `Lời mời từ ${ME}`, status: 'sent', color: c.color }, ...list])
    setAdding(null)
    setSection('new')
  }

  const StarBtn = ({ name }) => (
    <button className={`ch-ct-star${starred.has(name) ? ' on' : ''}`} title={starred.has(name) ? 'Bỏ gắn sao' : 'Gắn dấu sao'} onClick={e => { e.stopPropagation(); toggleStar(name) }}>
      <Ic n="star" size={15} fill={starred.has(name) ? 'currentColor' : 'none'} />
    </button>
  )
  const MsgBtn = ({ p }) => p.name === ME ? <span className="ch-ct-me">Bạn</span> : (
    <button className="ch-ct-msg" onClick={e => { e.stopPropagation(); onMessage(p) }}><Ic n="chat" size={13} />Nhắn tin</button>
  )
  const PersonRow = ({ p, sub, sub2 }) => (
    <div className="ch-ct-row" onClick={() => p.name !== ME && onMessage(p)}>
      <Avatar name={p.name} color={p.color} />
      <div className="ch-ct-main"><b>{p.name}</b>{sub && <span>{sub}</span>}{sub2 && <span>{sub2}</span>}</div>
      <div className="ch-ct-actions"><StarBtn name={p.name} /><MsgBtn p={p} /></div>
    </div>
  )

  /* ---------- Nội dung bên phải ---------- */
  let title = MENU.find(m => m.key === section).label
  let action = <button className="ch-ct-btn" onClick={() => setAdding({ name: '', company: '', role: '', phone: '', email: '', note: '' })}><Ic n="plus" size={15} />Thêm Liên hệ bên ngoài</button>
  let body = null
  const empty = text => <div className="ch-ct-empty">{text}</div>

  if (section === 'org') {
    if (dept) {
      const g = COMPANY_DIRECTORY.find(x => x.dept === dept)
      title = dept
      const list = g.people.filter(p => match(p.name, p.role))
      body = list.length ? list.map(p => <PersonRow key={p.name} p={p} sub={p.role} sub2={`${ORG_NAME} · ${dept}`} />) : empty('Không tìm thấy thành viên')
    } else {
      title = ORG_NAME
      const people = internal.filter(p => match(p.name, p.role, p.dept))
      body = t
        ? (people.length ? people.map(p => <PersonRow key={p.dept + p.name} p={p} sub={p.role} sub2={p.dept} />) : empty('Không tìm thấy thành viên'))
        : COMPANY_DIRECTORY.map(g => (
          <div key={g.dept} className="ch-ct-row" onClick={() => setDept(g.dept)}>
            <span className="ch-ct-av sq" style={{ background: '#E8EEFB', color: '#2F5DA8' }}><Ic n="org" size={18} /></span>
            <div className="ch-ct-main"><b>{g.dept}</b><span>{g.people.length} thành viên</span></div>
            <span className="ch-ct-chev"><Ic n="chev" size={16} /></span>
          </div>
        ))
    }
  } else if (section === 'trusted') {
    const list = TRUSTED_ORGS.filter(o => match(o.name, o.kind))
    body = list.map(o => (
      <div key={o.id} className="ch-ct-row">
        <span className="ch-ct-av sq" style={{ background: o.color }}><Ic n="building" size={18} /></span>
        <div className="ch-ct-main"><b>{o.name}</b><span>{o.kind} · {o.members} thành viên</span><span>Kết nối từ {o.since}</span></div>
        <span className="ch-ct-status ok">Đã kết nối</span>
      </div>
    ))
  } else if (section === 'external') {
    const list = external.filter(c => match(c.name, c.company, c.role))
    body = list.length ? list.map(c => <PersonRow key={c.id} p={c} sub={[c.role, c.company].filter(Boolean).join(' · ')} sub2={[c.phone, c.email].filter(Boolean).join(' · ')} />) : empty('Chưa có liên hệ bên ngoài')
  } else if (section === 'new') {
    const list = requests.filter(r => match(r.name, r.org, r.note))
    body = list.map(r => (
      <div key={r.id} className="ch-ct-row">
        <Avatar name={r.name} color={r.color} />
        <div className="ch-ct-main"><b>{r.name}</b><span>{r.org}</span><span>{r.note}</span></div>
        {r.status === 'pending'
          ? <div className="ch-ct-actions show"><button className="ch-ct-btn ghost" onClick={() => decline(r)}>Từ chối</button><button className="ch-ct-btn solid" onClick={() => accept(r)}>Chấp nhận</button></div>
          : <span className={`ch-ct-status${r.status === 'expired' ? ' muted' : ''}`}>{REQ_STATUS[r.status]}</span>}
      </div>
    ))
  } else if (section === 'starred') {
    const all = [...internal.map(p => ({ ...p, sub: p.role, sub2: `${ORG_NAME} · ${p.dept}` })), ...external.map(c => ({ ...c, sub: [c.role, c.company].filter(Boolean).join(' · '), sub2: 'Liên hệ bên ngoài' }))]
    const seen = new Set()
    const list = all.filter(p => starred.has(p.name) && !seen.has(p.name) && seen.add(p.name) && match(p.name, p.sub))
    body = list.length ? list.map(p => <PersonRow key={p.name} p={p} sub={p.sub} sub2={p.sub2} />) : empty('Bấm biểu tượng ☆ trên một liên hệ để gắn dấu sao')
  } else if (section === 'card') {
    action = null
    const text = `${MY_CARD.name}\n${MY_CARD.role} · ${MY_CARD.dept}\n${ORG_NAME}\n${MY_CARD.phone}\n${MY_CARD.email}`
    body = (
      <div className="ch-ct-cardwrap">
        <div className="ch-ct-card">
          <div className="ch-ct-card-top"><Avatar name={MY_CARD.name} color={MY_CARD.color} size={64} /><div><b>{MY_CARD.name}</b><span>{MY_CARD.role} · {MY_CARD.dept}</span><span>{ORG_NAME}</span></div></div>
          <div className="ch-ct-card-line"><Ic n="phone" size={15} />{MY_CARD.phone}</div>
          <div className="ch-ct-card-line"><Ic n="mail" size={15} />{MY_CARD.email}</div>
          <div className="ch-ct-qr" aria-hidden="true">{Array.from({ length: 81 }, (_, i) => <i key={i} className={(i * 37 + (i % 7) * 11) % 3 === 0 || [0, 1, 2, 9, 11, 18, 19, 20, 6, 7, 8, 15, 17, 24, 25, 26, 54, 55, 56, 63, 65, 72, 73, 74].includes(i) ? 'on' : ''} />)}</div>
          <button className="ch-ct-btn solid" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }}>{copied ? 'Đã sao chép thẻ' : 'Sao chép thẻ liên lạc'}</button>
        </div>
        <p className="ch-ct-hint">Người khác quét mã hoặc nhận thẻ này để gửi lời mời kết nối tới bạn.</p>
      </div>
    )
  } else if (section === 'groups') {
    action = null
    const list = conversations.filter(c => c.type === 'group' && match(c.name))
    body = list.map(c => (
      <div key={c.id} className="ch-ct-row" onClick={() => onOpenConv(c.id)}>
        <span className="ch-ct-av sq" style={{ background: c.color }}><Ic n="groups" size={18} /></span>
        <div className="ch-ct-main"><b>{c.name}</b><span>{c.sub || `${(c.members || []).length} thành viên`}</span></div>
        <button className="ch-ct-msg" onClick={e => { e.stopPropagation(); onOpenConv(c.id) }}><Ic n="chat" size={13} />Mở nhóm</button>
      </div>
    ))
  } else if (section === 'help') {
    action = null
    const list = HELP_DESKS.filter(h => match(h.name, h.desc))
    body = list.map(h => (
      <div key={h.id} className="ch-ct-row" onClick={() => onMessage({ name: h.owner || h.name, color: h.color, bot: !h.owner })}>
        <span className="ch-ct-av sq" style={{ background: h.color }}><Ic n="help" size={18} /></span>
        <div className="ch-ct-main"><b>{h.name}</b><span>{h.desc}</span>{h.owner && <span>Phụ trách: {h.owner}</span>}</div>
        <button className="ch-ct-msg" onClick={e => { e.stopPropagation(); onMessage({ name: h.owner || h.name, color: h.color, bot: !h.owner }) }}><Ic n="chat" size={13} />Liên hệ</button>
      </div>
    ))
  }

  return (
    <div className="ch-ct">
      <aside className="ch-ct-nav">
        <div className="ch-ct-title">
          {onBack && <button className="ch-ct-tomsg" onClick={onBack} title="Quay lại tin nhắn" aria-label="Quay lại tin nhắn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></button>}
          <h2>Danh bạ</h2>
        </div>
        <div className="ch-search-box" style={{ margin: '4px 0 10px' }}><SearchIcon /><input type="text" placeholder="Tìm liên hệ, phòng ban..." value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className={`ch-ct-org${section === 'org' && !dept ? ' active' : ''}`} onClick={() => { setSection('org'); setDept(null) }}>
          <span className="ch-ct-orgav">{ORG_NAME[0]}</span>{ORG_NAME}
        </button>
        {MENU.map(m => (
          <div key={m.key}>
            <button className={`ch-ct-item${section === m.key && !(m.key === 'org' && dept) ? ' active' : ''}`} onClick={() => { go(m.key); if (m.key === 'org') setOrgOpen(o => (section === 'org' ? !o : true)) }}>
              <span className="ch-ct-ico" style={{ color: m.tone }}><Ic n={m.icon} /></span>
              <span className="ch-ct-label">{m.label}</span>
              {m.key === 'new' && pending > 0 && <span className="ch-ct-badge">{pending}</span>}
            </button>
            {m.key === 'org' && orgOpen && (
              <div className="ch-ct-sub">
                {COMPANY_DIRECTORY.map(g => (
                  <button key={g.dept} className={`ch-ct-subitem${section === 'org' && dept === g.dept ? ' active' : ''}`} onClick={() => { setSection('org'); setDept(g.dept) }}>
                    <span className="ch-ct-elbow" />{g.dept}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>

      <section className="ch-ct-panel">
        <header className="ch-ct-head">
          {section === 'org' && dept && <button className="ch-ct-back" onClick={() => setDept(null)} title="Quay lại"><Ic n="chev" size={16} /></button>}
          <h3>{title}</h3>
          <span className="ch-ct-grow" />
          {action}
        </header>
        <div className="ch-ct-list">{body}</div>
      </section>

      {adding && (
        <div className="ch-ct-modal" onMouseDown={e => { if (e.target === e.currentTarget) setAdding(null) }}>
          <div className="ch-ct-modal-box">
            <div className="ch-ct-modal-head"><h3>Thêm liên hệ bên ngoài</h3><button className="ch-ct-x" onClick={() => setAdding(null)}><Ic n="x" size={16} /></button></div>
            {[['name', 'Họ và tên *'], ['company', 'Công ty / tổ chức'], ['role', 'Chức danh'], ['phone', 'Số điện thoại'], ['email', 'Email'], ['note', 'Lời nhắn kèm lời mời']].map(([k, l]) => (
              <label key={k} className="ch-ct-field"><span>{l}</span><input autoFocus={k === 'name'} value={adding[k]} onChange={e => setAdding({ ...adding, [k]: e.target.value })} placeholder={k === 'note' ? `Tôi là ${ME}, ${ORG_NAME}` : ''} /></label>
            ))}
            <div className="ch-ct-modal-foot"><button className="ch-ct-btn ghost" onClick={() => setAdding(null)}>Hủy</button><button className="ch-ct-btn solid" disabled={!adding.name.trim()} onClick={saveExternal}>Gửi lời mời</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
