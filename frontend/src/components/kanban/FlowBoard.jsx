import { useEffect, useRef, useState } from 'react'
import './FlowBoard.css'

/* Bảng kanban theo quy trình (dùng chung) — mỗi bước có phòng ban & người phụ trách,
   kéo thả thẻ giữa các bước (gửi thông báo cho người phụ trách bước), chi tiết thẻ,
   chỉnh sửa / khởi tạo quy trình từ mẫu. Dữ liệu do trang cha giữ (items + onItemsChange). */

const STEP_COLORS = ['#8A8F98', '#3B82F6', '#F59E0B', '#8B5CF6', '#0EA5A4', '#16A34A', '#D9822B', '#C2185B', '#E04848']
const STEP_KIND = [{ value: 'normal', label: 'Đang xử lý' }, { value: 'done', label: 'Hoàn thành' }, { value: 'closed', label: 'Hủy / đóng' }]
const kindOf = s => (s.closed ? 'closed' : s.done ? 'done' : 'normal')
const PALETTE = ['#3B82F6', '#8B5CF6', '#0EA5A4', '#E0A030', '#E05A5A', '#16A34A', '#C2185B', '#64748B']
const colorOf = name => PALETTE[[...(name || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length]
const initials = name => (name || '?').split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase()
const norm = t => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const nowLabel = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

const Svg = ({ d, size = 14, sw = 2 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const IcBell = <Svg d={<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>} />
const IcFlow = <Svg d={<><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M6 9v3a3 3 0 0 0 3 3h6" /></>} />
const IcPlus = <Svg d={<path d="M12 5v14M5 12h14" />} sw={2.4} />
const IcX = <Svg d={<path d="M18 6 6 18M6 6l12 12" />} />
const IcUp = <Svg d={<path d="m18 15-6-6-6 6" />} size={13} />
const IcDown = <Svg d={<path d="m6 9 6 6 6-6" />} size={13} />
const IcTrash = <Svg d={<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />} size={13} />
const IcUsers = <Svg d={<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6 6 0 0 0-3-5.2" /></>} size={12} />
const IcCal = <Svg d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} size={11} sw={2.2} />

export const Avatar = ({ name, size = 22 }) => <span className="fb-avatar" title={name} style={{ background: colorOf(name), width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>

/* Ô "+ Thêm" có tìm kiếm (↑↓ Enter Esc) — danh sách nổi position:fixed để không bị cắt */
function SearchAdd({ placeholder, options, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const list = options.filter(o => !q.trim() || norm(o.label + ' ' + (o.sub || '')).includes(norm(q.trim()))).slice(0, 40)
  const place = () => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 260) }) }
  const pick = o => { if (!o) return; onPick(o.value); setQ(''); setHi(0) }
  let lastGroup = null
  return (
    <span className="fb-sa" ref={ref}>
      <input value={q} placeholder={placeholder} onFocus={() => { place(); setOpen(true) }} onBlur={() => setOpen(false)}
        onChange={e => { setQ(e.target.value); setHi(0); setOpen(true); place() }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, list.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); pick(list[hi]) }
          else if (e.key === 'Escape') { e.nativeEvent.stopPropagation(); setOpen(false); e.currentTarget.blur() }
        }} />
      {open && pos && (
        <div className="fb-sa-list" style={{ left: pos.left, top: pos.top, width: pos.width }} onMouseDown={e => e.preventDefault()}>
          {list.length === 0 && <div className="fb-sa-empty">Không tìm thấy "{q}"</div>}
          {list.map((o, i) => {
            const head = o.group && o.group !== lastGroup ? (lastGroup = o.group) : null
            return (
              <div key={o.value}>
                {head && <div className="fb-sa-group">{head}</div>}
                <button type="button" className={i === hi ? 'hi' : ''} onMouseEnter={() => setHi(i)} onClick={() => pick(o)}>
                  {o.avatar && <Avatar name={o.value} size={20} />}
                  <span><b>{o.label}</b>{o.sub && <em>{o.sub}</em>}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </span>
  )
}

export default function FlowBoard({
  open, onClose, kicker, title, meta, info, stages: initialStages, onStagesChange, templates = [], people = [], depts = [],
  items, onItemsChange, codePrefix = 'CV', codeSep = '-', itemNoun = 'việc', accent,
  variant = 'modal', backLabel = 'Quay lại', // variant 'page': hiển thị như một trang (nút quay lại, không lớp phủ)
}) {
  const [stages, setStagesState] = useState(initialStages)
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [flowDraft, setFlowDraft] = useState(null) // { steps, tpl, newTpl? }
  const [customTpls, setCustomTpls] = useState([])
  const [notes, setNotes] = useState([])
  const [bellOpen, setBellOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [adding, setAdding] = useState(null) // { stage, text }

  useEffect(() => { setStagesState(initialStages) }, [initialStages])
  const setStages = s => { setStagesState(s); onStagesChange?.(s) }
  const byKey = Object.fromEntries(stages.map(s => [s.key, s]))
  const personOf = n => people.find(p => p.name === n)
  const peopleIn = d => people.filter(p => p.dept === d)

  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (flowDraft) setFlowDraft(null)
      else if (adding) setAdding(null)
      else if (detailId) setDetailId(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, flowDraft, adding, detailId])
  useEffect(() => { if (!open) { setDetailId(null); setFlowDraft(null); setBellOpen(false); setAdding(null) } }, [open])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t) }, [toast])
  if (!open) return null

  const list = items || []
  const detail = list.find(it => it.id === detailId)
  const doneCount = list.filter(it => byKey[it.stage]?.done).length
  const notify = (to, text) => setNotes(n => [{ id: Date.now() + Math.random(), to, text, at: nowLabel() }, ...n])
  const update = fn => onItemsChange(fn)
  const updateItem = (id, patch) => update(l => l.map(it => (it.id === id ? { ...it, ...patch } : it)))

  function moveTo(it, stageKey) {
    if (!it || it.stage === stageKey) return
    updateItem(it.id, { stage: stageKey })
    const s = byKey[stageKey]
    const owners = s?.owners || []
    owners.forEach(o => notify(o, `${it.code} — ${it.title} chuyển sang "${s.label}", cần bạn xử lý`))
    setToast(`Đã chuyển ${it.code} sang "${s.label}"${owners.length ? ` · thông báo tới ${owners.join(', ')}` : ''}`)
  }
  function addAssignee(it, name) {
    if ((it.assignees || []).includes(name)) return
    updateItem(it.id, { assignees: [...(it.assignees || []), name] })
    notify(name, `Bạn được giao ${it.code} — ${it.title} (${title})`)
    setToast(`Đã giao ${it.code} cho ${name} · đã gửi thông báo`)
  }
  function setDept(it, dept) {
    updateItem(it.id, { dept })
    if (!dept) return
    const names = peopleIn(dept).map(p => p.name)
    notify(`${dept}${names.length ? ` (${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''})` : ''}`, `Phòng ban được giao ${it.code} — ${it.title}`)
    setToast(`Đã giao ${it.code} cho ${dept}`)
  }
  function addItem() {
    const text = adding?.text.trim()
    if (!text) { setAdding(null); return }
    const s = byKey[adding.stage]
    // số kế tiếp = số lớn nhất ở cuối mã hiện có (VD: #1529.5 → 6, PO-12 → 13)
    const n = list.reduce((m, it) => Math.max(m, Number((/(\d+)\D*$/.exec(String(it.code)) || [])[1]) || 0), 0) + 1
    const item = { id: 'n' + Date.now(), code: `${codePrefix}${codeSep}${n}`, title: text, sub: '', due: '', assignees: [...(s.owners || [])], dept: s.depts?.[0] || '', stage: s.key }
    update(l => [...l, item])
    item.assignees.forEach(o => notify(o, `${item.code} — ${text} được tạo ở bước "${s.label}"`))
    setAdding({ stage: adding.stage, text: '' })
    setToast(`Đã thêm ${item.code}${item.assignees.length ? ` · thông báo tới ${item.assignees.join(', ')}` : ''}`)
  }

  /* ---------- Quy trình ---------- */
  const newStep = i => ({ key: 's' + Date.now().toString(36) + i, label: '', color: STEP_COLORS[i % STEP_COLORS.length], depts: [], owners: [] })
  const openFlow = withNew => {
    const steps = stages.map(s => ({ ...s, depts: [...(s.depts || [])], owners: [...(s.owners || [])] }))
    if (withNew) steps.splice(Math.max(0, steps.findIndex(s => s.done || s.closed)), 0, newStep(steps.length))
    setFlowDraft({ steps, tpl: null })
  }
  const setStep = (i, patch) => setFlowDraft(d => ({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const moveStep = (i, dir) => setFlowDraft(d => { const steps = [...d.steps]; const j = i + dir; if (j < 0 || j >= steps.length) return d; [steps[i], steps[j]] = [steps[j], steps[i]]; return { ...d, steps } })
  const addTo = (i, field, v) => setFlowDraft(d => ({ ...d, steps: d.steps.map((st, j) => {
    if (j !== i || !v || st[field].includes(v)) return st
    const next = { ...st, [field]: [...st[field], v] }
    if (field === 'depts' && !st.owners.length && peopleIn(v)[0]) next.owners = [peopleIn(v)[0].name]
    return next
  }) }))
  const removeFrom = (i, field, v) => setFlowDraft(d => ({ ...d, steps: d.steps.map((st, j) => (j === i ? { ...st, [field]: st[field].filter(x => x !== v) } : st)) }))
  const applyTemplate = t => setFlowDraft({ steps: t.stages.map(s => ({ ...s, depts: [...(s.depts || [])], owners: [...(s.owners || [])] })), tpl: t.key })
  const createTemplate = () => setFlowDraft({ steps: [newStep(0), { ...newStep(1), label: 'Hoàn thành', done: true, color: '#16A34A' }], tpl: '__new', newTpl: '' })
  const draftKeys = new Set((flowDraft?.steps || []).map(s => s.key))
  const draftFirst = flowDraft?.steps.find(s => !s.closed) || flowDraft?.steps[0]
  const orphanCount = flowDraft ? list.filter(it => !draftKeys.has(it.stage)).length : 0
  const draftValid = flowDraft && flowDraft.steps.length > 0 && flowDraft.steps.every(s => s.label.trim()) && (flowDraft.newTpl === undefined || flowDraft.newTpl.trim())
  function saveFlow() {
    if (!draftValid) return
    const steps = flowDraft.steps.map(s => ({ ...s, label: s.label.trim() }))
    const first = steps.find(s => !s.closed) || steps[0]
    const keys = new Set(steps.map(s => s.key))
    if (flowDraft.newTpl !== undefined) setCustomTpls(t => [...t, { key: 'c' + Date.now().toString(36), label: flowDraft.newTpl.trim(), desc: `Mẫu tự tạo · ${steps.map(x => x.label).join(' → ')}`, stages: steps, custom: true }])
    setStages(steps)
    if (orphanCount) update(l => l.map(it => (keys.has(it.stage) ? it : { ...it, stage: first.key })))
    let sent = 0
    steps.forEach(s => { const before = byKey[s.key]?.owners || []; s.owners.filter(o => !before.includes(o)).forEach(o => { notify(o, `Bạn phụ trách bước "${s.label}" — ${title}`); sent++ }) })
    setFlowDraft(null)
    setToast(`Đã lưu quy trình · ${steps.length} bước${orphanCount ? ` · ${orphanCount} ${itemNoun} chuyển về "${first.label}"` : ''}${sent ? ` · ${sent} thông báo` : ''}`)
  }

  const personOptions = (exclude, preferDepts = []) => [
    ...people.filter(p => preferDepts.includes(p.dept) && !exclude.includes(p.name)).map(p => ({ value: p.name, label: p.name, sub: `${p.role} · ${p.dept}`, avatar: true, group: 'Trong phòng ban đã chọn' })),
    ...people.filter(p => !preferDepts.includes(p.dept) && !exclude.includes(p.name)).map(p => ({ value: p.name, label: p.name, sub: `${p.role} · ${p.dept}`, avatar: true, group: preferDepts.length ? 'Khác' : 'Tất cả' })),
  ]

  return (
    <>
      {variant !== 'page' && <div className="fb-scrim" onClick={onClose} />}
      <div className={`fb${variant === 'page' ? ' page' : ''}`} role={variant === 'page' ? 'region' : 'dialog'} aria-label={title} style={accent ? { '--fb-accent': accent } : undefined}>
        <div className="fb-head">
          {variant === 'page' && <button className="fb-back" onClick={onClose} title={`${backLabel} (Esc)`}><Svg d={<path d="M19 12H5M12 19l-7-7 7-7" />} size={15} sw={2.2} />{backLabel}</button>}
          <div className="fb-title"><span className="fb-kicker">{kicker}</span><h2>{title}</h2></div>
          <span className="fb-grow" />
          <span className="fb-progress" title="Tiến độ">{doneCount}/{list.length} {itemNoun} hoàn thành</span>
          <button className="fb-btn" onClick={() => openFlow(false)}>{IcFlow}Quy trình</button>
          <div className="fb-bell-wrap">
            <button className={`fb-btn icon${bellOpen ? ' on' : ''}`} onClick={() => setBellOpen(o => !o)} title="Thông báo đã gửi">{IcBell}{notes.length > 0 && <span className="fb-badge">{notes.length}</span>}</button>
            {bellOpen && (
              <div className="fb-bell">
                <div className="fb-bell-head">Thông báo đã gửi <span>{notes.length}</span></div>
                {notes.length === 0
                  ? <div className="fb-bell-empty">Chưa có thông báo. Giao người, chuyển bước hoặc thêm {itemNoun} để gửi thông báo.</div>
                  : notes.map(n => <div key={n.id} className="fb-note"><span className="fb-note-ic">{IcBell}</span><div><b>Tới {n.to}</b><span>{n.text}</span></div><em>{n.at}</em></div>)}
              </div>
            )}
          </div>
          {variant !== 'page' && <button className="fb-btn icon" onClick={onClose} title="Đóng (Esc)">{IcX}</button>}
        </div>

        {meta?.length > 0 && <div className="fb-meta">{meta.map(m => <div key={m.label} className="fb-meta-item"><span>{m.label}</span><div>{m.value}</div></div>)}</div>}
        {info && <div className="fb-info">{info}</div>}

        <div className="fb-body">
          <div className="fb-board" style={{ gridTemplateColumns: `repeat(${stages.length + 1}, minmax(230px, 1fr))` }}>
            {stages.map(stage => {
              const cards = list.filter(it => it.stage === stage.key)
              return (
                <div key={stage.key} className={`fb-col${overStage === stage.key ? ' over' : ''}`}
                  onDragOver={e => { if (dragId) { e.preventDefault(); setOverStage(stage.key) } }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverStage(null) }}
                  onDrop={e => { e.preventDefault(); moveTo(list.find(it => it.id === dragId), stage.key); setDragId(null); setOverStage(null) }}>
                  <div className="fb-col-head"><i style={{ background: stage.color }} /><b>{stage.label}</b><span>{cards.length}</span></div>
                  <button className="fb-col-owner" onClick={() => openFlow(false)} title="Phụ trách bước — bấm để chỉnh quy trình">
                    {stage.owners?.length ? <span className="fb-avatars">{stage.owners.slice(0, 3).map(n => <Avatar key={n} name={n} size={18} />)}</span> : <span className="fb-noowner">{IcUsers}</span>}
                    <span>{stage.owners?.length ? (stage.owners.length > 1 ? `${stage.owners[0]} +${stage.owners.length - 1}` : stage.owners[0]) : 'Chưa giao người phụ trách'}{stage.depts?.length ? <em> · {stage.depts.join(', ')}</em> : null}</span>
                  </button>
                  <div className="fb-cards">
                    {cards.length === 0 && adding?.stage !== stage.key && <div className="fb-empty">Kéo thả {itemNoun} vào đây</div>}
                    {cards.map(it => (
                      <div key={it.id} className={`fb-card${dragId === it.id ? ' dragging' : ''}${detailId === it.id ? ' selected' : ''}`} style={{ borderLeftColor: stage.color }}
                        draggable onClick={() => setDetailId(it.id)}
                        onDragStart={e => { setDragId(it.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDragId(null); setOverStage(null) }}>
                        <div className="fb-card-top"><span className="fb-code">{it.code}</span>{it.tag && <span className="fb-tag">{it.tag}</span>}</div>
                        <div className="fb-card-title">{it.title}</div>
                        {it.sub && <div className="fb-card-sub">{it.sub}</div>}
                        {it.dept && <span className="fb-dept">{IcUsers}{it.dept}</span>}
                        <div className="fb-card-foot">
                          {it.due ? <span className={`fb-due${it.late && !stage.done ? ' late' : ''}`}>{IcCal}{it.due}</span> : <span />}
                          <span className="fb-avatars">{(it.assignees || []).slice(0, 3).map(n => <Avatar key={n} name={n} size={20} />)}{(it.assignees || []).length > 3 && <em>+{it.assignees.length - 3}</em>}{!(it.assignees || []).length && <em className="fb-none">Chưa giao</em>}</span>
                        </div>
                      </div>
                    ))}
                    {adding?.stage === stage.key
                      ? (
                        <div className="fb-addbox">
                          <textarea autoFocus rows={2} value={adding.text} placeholder={`Tên ${itemNoun}… (Enter để thêm)`} onChange={e => setAdding({ ...adding, text: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addItem() } }} />
                          <div><button className="fb-btn primary sm" onClick={addItem}>Thêm</button><button className="fb-btn sm" onClick={() => setAdding(null)}>Hủy</button></div>
                        </div>
                      )
                      : !stage.closed && <button className="fb-add" onClick={() => setAdding({ stage: stage.key, text: '' })}>{IcPlus}Thêm {itemNoun}</button>}
                  </div>
                </div>
              )
            })}
            <button className="fb-col fb-addcol" onClick={() => openFlow(true)}>{IcPlus}<b>Thêm bước quy trình</b><span>Chỉnh sửa, sắp xếp hoặc khởi tạo quy trình từ mẫu</span></button>
          </div>

          {detail && (
            <aside className="fb-detail">
              <div className="fb-detail-head"><div><span className="fb-code">{detail.code}</span><h3>{detail.title}</h3></div><button className="fb-btn icon" onClick={() => setDetailId(null)}>{IcX}</button></div>
              {detail.sub && <p className="fb-detail-sub">{detail.sub}</p>}
              <label className="fb-field"><span>Bước hiện tại</span>
                <select value={detail.stage} onChange={e => moveTo(detail, e.target.value)}>{stages.map(s => <option key={s.key} value={s.key}>{s.label}{s.owners?.length ? ` — ${s.owners.join(', ')}` : ''}</option>)}</select>
              </label>
              <label className="fb-field"><span>Phòng ban phụ trách</span>
                <select value={detail.dept || ''} onChange={e => setDept(detail, e.target.value)}><option value="">— Chưa giao phòng ban —</option>{depts.map(d => <option key={d} value={d}>{d}</option>)}</select>
              </label>
              <div className="fb-field"><span>Người phụ trách</span>
                <div className="fb-people">
                  {(detail.assignees || []).map(n => (
                    <span key={n} className="fb-chip"><Avatar name={n} size={20} /><span><b>{n}</b><em>{personOf(n)?.role || ''}</em></span><button onClick={() => updateItem(detail.id, { assignees: detail.assignees.filter(x => x !== n) })} title="Bỏ">{IcX}</button></span>
                  ))}
                </div>
                <div className="fb-multi"><SearchAdd placeholder="+ Tìm người để giao…" onPick={v => addAssignee(detail, v)} options={personOptions(detail.assignees || [], detail.dept ? [detail.dept] : [])} /></div>
                <div className="fb-hint">{IcBell}Người / phòng ban được giao sẽ nhận thông báo ngay.</div>
              </div>
              {notes.some(n => n.text.includes(detail.code)) && (
                <div className="fb-field"><span>Thông báo của {itemNoun} này</span>
                  {notes.filter(n => n.text.includes(detail.code)).map(n => <div key={n.id} className="fb-note small"><div><b>Tới {n.to}</b><span>{n.text}</span></div><em>{n.at}</em></div>)}
                </div>
              )}
              <button className="fb-del" onClick={() => { update(l => l.filter(it => it.id !== detail.id)); setDetailId(null); setToast(`Đã xoá ${detail.code}`) }}>{IcTrash}Xoá {itemNoun}</button>
            </aside>
          )}
        </div>

        {flowDraft && (
          <div className="fb-pf-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setFlowDraft(null) }}>
            <div className="fb-pf" role="dialog" aria-label="Quy trình">
              <div className="fb-pf-head"><div><h3>Quy trình xử lý</h3><span>{title} · chỉnh sửa các bước hoặc khởi tạo từ mẫu</span></div><button className="fb-btn icon" onClick={() => setFlowDraft(null)}>{IcX}</button></div>
              <div className="fb-pf-body">
                <div className="fb-pf-label">Khởi tạo quy trình từ mẫu</div>
                <div className="fb-pf-tpls">
                  {[...templates, ...customTpls].map(t => (
                    <button key={t.key} className={`fb-pf-tpl${flowDraft.tpl === t.key ? ' active' : ''}`} onClick={() => applyTemplate(t)}><b>{t.label}</b><span>{t.desc}</span><em>{t.stages.length} bước{t.custom ? ' · mẫu tự tạo' : ''}</em></button>
                  ))}
                  <button className={`fb-pf-tpl add${flowDraft.tpl === '__new' ? ' active' : ''}`} onClick={createTemplate}><b>{IcPlus}Tạo thêm</b><span>Tạo quy trình mới từ đầu và lưu thành mẫu để dùng lại</span></button>
                </div>
                {flowDraft.newTpl !== undefined && (
                  <label className="fb-pf-newtpl"><span>Tên mẫu quy trình mới *</span><input autoFocus value={flowDraft.newTpl} placeholder="VD: Cấp thiết bị cho nhân sự mới" className={flowDraft.newTpl.trim() ? '' : 'err'} onChange={e => setFlowDraft(d => ({ ...d, newTpl: e.target.value }))} /></label>
                )}
                <div className="fb-pf-label">Các bước <span>· thứ tự từ trái sang phải · mỗi bước giao được nhiều phòng ban & nhiều người</span></div>
                <div className="fb-pf-steps">
                  <div className="fb-pf-row head"><span /><span>Tên bước</span><span>Phòng ban phụ trách</span><span>Người phụ trách</span><span>Loại</span><span /></div>
                  {flowDraft.steps.map((s, i) => {
                    const count = list.filter(it => it.stage === s.key).length
                    return (
                      <div key={s.key} className="fb-pf-row">
                        <span className="fb-pf-order">
                          <button disabled={i === 0} onClick={() => moveStep(i, -1)} title="Lên trước">{IcUp}</button>
                          <button className="fb-pf-color" style={{ background: s.color }} title="Đổi màu" onClick={() => setStep(i, { color: STEP_COLORS[(STEP_COLORS.indexOf(s.color) + 1) % STEP_COLORS.length] })} />
                          <button disabled={i === flowDraft.steps.length - 1} onClick={() => moveStep(i, 1)} title="Xuống sau">{IcDown}</button>
                        </span>
                        <input value={s.label} placeholder={`Bước ${i + 1}`} className={s.label.trim() ? '' : 'err'} onChange={e => setStep(i, { label: e.target.value })} />
                        <div className="fb-multi">
                          {s.depts.map(d => <span key={d} className="fb-tagx">{d}<button onClick={() => removeFrom(i, 'depts', d)}>{IcX}</button></span>)}
                          <SearchAdd placeholder={s.depts.length ? '+ Thêm…' : '+ Tìm phòng ban…'} onPick={v => addTo(i, 'depts', v)} options={depts.filter(d => !s.depts.includes(d)).map(d => ({ value: d, label: d, sub: `${peopleIn(d).length} người` }))} />
                        </div>
                        <div className="fb-multi">
                          {s.owners.map(o => <span key={o} className="fb-tagx person"><Avatar name={o} size={16} />{o}<button onClick={() => removeFrom(i, 'owners', o)}>{IcX}</button></span>)}
                          <SearchAdd placeholder={s.owners.length ? '+ Thêm…' : '+ Tìm người phụ trách…'} onPick={v => addTo(i, 'owners', v)} options={personOptions(s.owners, s.depts)} />
                        </div>
                        <select value={kindOf(s)} onChange={e => setStep(i, { done: e.target.value === 'done', closed: e.target.value === 'closed' })}>{STEP_KIND.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
                        <button className="fb-pf-del" disabled={flowDraft.steps.length <= 1} onClick={() => setFlowDraft(d => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }))} title={count ? `Xoá bước — ${count} ${itemNoun} chuyển về bước đầu` : 'Xoá bước'}>{IcTrash}{count > 0 && <em>{count}</em>}</button>
                      </div>
                    )
                  })}
                  <button className="fb-btn ghost" onClick={() => setFlowDraft(d => ({ ...d, steps: [...d.steps, newStep(d.steps.length)] }))}>{IcPlus}Thêm bước</button>
                </div>
                {orphanCount > 0 && draftFirst && <div className="fb-pf-warn">{orphanCount} {itemNoun} ở bước bị xoá sẽ chuyển về "{draftFirst.label || 'bước đầu'}".</div>}
                <div className="fb-hint">{IcBell}Người phụ trách bước nhận thông báo khi lưu và mỗi khi có {itemNoun} chuyển tới bước đó.</div>
              </div>
              <div className="fb-pf-foot"><span className="fb-grow" /><button className="fb-btn" onClick={() => setFlowDraft(null)}>Hủy</button><button className="fb-btn primary" disabled={!draftValid} onClick={saveFlow}>Lưu quy trình</button></div>
            </div>
          </div>
        )}

        {toast && <div className="fb-toast">{IcBell}{toast}</div>}
      </div>
    </>
  )
}
