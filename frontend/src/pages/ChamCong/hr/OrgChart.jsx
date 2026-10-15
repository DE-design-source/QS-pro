import { useEffect, useRef, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { DEPTS, deptOf, UNIT_TYPE_LABEL, LEVELS, LEVEL_TONE } from '../../../data/hrData'
import { Avatar, Seg, Modal, Field, Empty, Pill } from './shared'
import { useAccess } from './access'

const TONES = ['qs', 'primary', 'attendance', 'finance', 'sales', 'marketing', 'danger', 'success', 'muted']

/* Kéo nền để di chuyển sơ đồ */
function usePan(ref) {
  return function onDown(e) {
    if (e.button !== 0 || e.target.closest('button')) return
    const el = ref.current
    const st = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop }
    el.classList.add('panning')
    const move = ev => { el.scrollLeft = st.l - (ev.clientX - st.x); el.scrollTop = st.t - (ev.clientY - st.y) }
    const up = () => { el.classList.remove('panning'); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }
}

function ZoomCtl({ zoom, setZoom }) {
  return (
    <div className="cc-seg icon">
      <button title="Thu nhỏ" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}><Icon name="zoomOut" size={14} /></button>
      <button className="cc-zoom-label" onClick={() => setZoom(1)} title="Về 100%">{Math.round(zoom * 100)}%</button>
      <button title="Phóng to" onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(1)))}><Icon name="zoomIn" size={14} /></button>
    </div>
  )
}

/* ================= Cơ cấu phòng ban (theo sơ đồ tổ chức công ty) ================= */
function UnitsView({ employees, units, heads, extraMembers, onSaveUnit, onDeleteUnit, onAssign, onRemoveExtra, onOpen }) {
  const { can } = useAccess()
  const [zoom, setZoom] = useState(1)
  const [sel, setSel] = useState(null) // đơn vị đang xem chi tiết — bảng bên phải chỉ hiện khi bấm vào 1 đơn vị
  const [focus, setFocus] = useState('') // lọc: chỉ xem sơ đồ của 1 đơn vị
  const [form, setForm] = useState(null)
  const [picker, setPicker] = useState(null) // { q, ids:Set }
  const wrapRef = useRef(null)
  const orgRef = useRef(null)
  const onDown = usePan(wrapRef)
  const editable = can('employees', 'edit')
  // Thu phóng vừa khung: so độ rộng thật của cây (ở 100%) với khung hiển thị
  const fit = () => {
    const w = wrapRef.current, o = orgRef.current
    if (!w || !o) return
    // Độ rộng thật của cây ở 100% = độ rộng đang hiển thị / mức zoom hiện tại (+ lề trái/phải 48px)
    const z = parseFloat(o.style.zoom) || 1
    // Đo độ rộng thật của cây = tổng độ rộng các nút gốc (ul có thể rộng bằng khung nên không dùng được)
    const roots = o.querySelectorAll(':scope > ul > li')
    const natural = [...roots].reduce((w, li) => w + li.getBoundingClientRect().width, 0) / z + 48
    setZoom(Math.max(0.5, Math.min(1, Math.floor((w.clientWidth - 8) / natural * 100) / 100)))
  }
  useEffect(() => { requestAnimationFrame(fit) }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = employees.filter(e => e.status !== 'left')
  const empOf = id => employees.find(e => e.id === id)
  const kids = key => units.filter(u => u.parent === key && u.type !== 'board')
  const boards = key => units.filter(u => u.parent === key && u.type === 'board')
  const unitOf = key => units.find(u => u.key === key)
  // Phòng ban / khối: thành viên theo phòng ban trong hồ sơ · Ban & HĐQT: thành viên kiêm nhiệm gán riêng
  const isConcurrent = key => ['board', 'governance'].includes(unitOf(key)?.type)
  const members = key => (isConcurrent(key) ? (extraMembers[key] || []).map(empOf).filter(e => e && e.status !== 'left') : current.filter(e => e.dept === key))
  const subtreeKeys = key => [key, ...kids(key).flatMap(k => subtreeKeys(k.key))]
  const total = key => subtreeKeys(key).reduce((n, k) => n + members(k).length, 0)

  useEffect(() => {
    const el = wrapRef.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [zoom])

  const Card = ({ u, small }) => {
    const head = empOf(heads[u.key])
    const n = members(u.key).length
    return (
      <button className={`cc-unit cc-tone-${u.tone} type-${u.type}${sel === u.key ? ' active' : ''}${small ? ' small' : ''}`} onClick={() => setSel(u.key)}>
        <b>{u.label}</b>
        {!small && head && <span className="cc-unit-head"><Avatar emp={head} size={18} />{head.name}</span>}
        {!small && u.type !== 'governance' && <span className="cc-unit-count">{u.type === 'exec' ? `${total(u.key)} nhân sự` : `${n} nhân sự`}</span>}
      </button>
    )
  }
  /* drop: phòng ban trực thuộc trực tiếp một cấp có cả khối điều hành (VD: KD dân dụng, Marketing, R&D dưới CEO)
     được hạ xuống cùng hàng với các phòng ban của COO/CCO — giống sơ đồ gốc */
  const render = (u, drop) => {
    const ch = kids(u.key)
    const side = boards(u.key)
    const hasExec = ch.some(c => c.type === 'exec')
    return (
      <li key={u.key} className={drop ? 'drop' : undefined}>
        <div className="cc-unit-row">
          <Card u={u} />
          {side.length > 0 && (
            <div className="cc-unit-side">{side.map(b => <div key={b.key} className="cc-unit-side-item"><Card u={b} small /></div>)}</div>
          )}
        </div>
        {ch.length > 0 && <ul>{ch.map(c => render(c, hasExec && c.type !== 'exec'))}</ul>}
      </li>
    )
  }

  const focusUnit = focus ? unitOf(focus) : null
  const roots = focusUnit ? [focusUnit] : units.filter(u => !u.parent || !units.some(p => p.key === u.parent))
  // Lọc tới 1 phòng ban không có đơn vị con → vẽ sơ đồ nhân sự riêng của phòng (trưởng phòng → các cấp)
  const deptPeopleMode = focusUnit && kids(focusUnit.key).length === 0
  const renderPerson = (e, inDept, seen = new Set()) => {
    seen.add(e.id)
    const sub = inDept.filter(x => x.managerId === e.id && !seen.has(x.id))
    return (
      <li key={e.id}>
        <div className={`cc-org-node cc-tone-${focusUnit.tone}`}>
          <button className="cc-org-card" onClick={() => onOpen(e.id)} title="Xem hồ sơ">
            <Avatar emp={e} size={36} />
            <span className="cc-org-text"><b>{e.name}</b><span>{e.position}</span><em>{heads[focusUnit.key] === e.id ? 'Trưởng đơn vị' : focusUnit.label}</em></span>
          </button>
        </div>
        {sub.length > 0 && <ul>{sub.map(x => renderPerson(x, inDept, seen))}</ul>}
      </li>
    )
  }
  const deptTree = () => {
    const inDept = members(focusUnit.key)
    const ids = new Set(inDept.map(e => e.id))
    // Gốc = người không có quản lý trong đơn vị; nếu dữ liệu bị vòng thì lấy trưởng đơn vị làm gốc
    let top = inDept.filter(e => !ids.has(e.managerId))
    if (!top.length && inDept.length) top = [inDept.find(e => e.id === heads[focusUnit.key]) || inDept[0]]
    const seen = new Set()
    const out = top.map(e => renderPerson(e, inDept, seen))
    // Người chưa được vẽ (do vòng) → gắn thêm ở hàng gốc
    inDept.filter(e => !seen.has(e.id)).forEach(e => out.push(renderPerson(e, inDept, seen)))
    return out.length ? out : null
  }
  const path = []
  for (let u = focusUnit; u; u = unitOf(u.parent)) path.unshift(u)
  const unit = units.find(u => u.key === sel)
  const parent = unit && units.find(u => u.key === unit.parent)
  const head = unit && empOf(heads[unit.key])
  const list = unit ? members(unit.key) : []

  function save() {
    const f = form
    const key = f.key || f.label.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12)
    if (!f.label.trim() || !key) return
    if (!f._orig && units.some(u => u.key === key)) { alert('Mã đơn vị đã tồn tại'); return }
    onSaveUnit({ ...f, key, name: f.name.trim() || f.label.trim(), label: f.label.trim() }, f._orig, f.headId ? Number(f.headId) : null)
    setSel(key)
    setForm(null)
  }
  // Không cho chọn chính nó / đơn vị con làm cấp trên (tránh vòng lặp)
  const blocked = form?._orig ? new Set(subtreeKeys(form._orig)) : new Set()

  return (
    <div className={`cc-units-layout${unit ? ' with-panel' : ''}`}>
      <div className="cc-stack cc-fill" style={{ minWidth: 0 }}>
        <div className="cc-card cc-pad cc-org-bar">
          <div>
            <h3 className="cc-h3" style={{ margin: 0 }}>{focusUnit ? `Sơ đồ tổ chức — ${focusUnit.name}` : 'Cơ cấu tổ chức công ty'}</h3>
            {focusUnit
              ? <div className="cc-crumbs"><button className="cc-link-btn" onClick={() => setFocus('')}>Toàn công ty</button>{path.map(u => <span key={u.key}> › {u.key === focus ? <b>{u.label}</b> : <button className="cc-link-btn" onClick={() => setFocus(u.key)}>{u.label}</button>}</span>)}<span className="cc-sub"> · {total(focusUnit.key)} nhân sự</span></div>
              : <span className="cc-sub">{units.filter(u => u.type === 'dept').length} phòng ban · {units.filter(u => u.type === 'exec').length} khối điều hành · {current.length} nhân sự</span>}
          </div>
          <span className="cc-grow" />
          <label className="cc-filter-unit"><Icon name="search" size={14} />
            <select value={focus} onChange={e => { setFocus(e.target.value); setSel(e.target.value || null) }} aria-label="Lọc theo đơn vị">
              <option value="">Xem: toàn công ty</option>
              {units.filter(u => u.type === 'exec').map(x => (
                <optgroup key={x.key} label={x.label}>
                  <option value={x.key}>{x.name} (cả khối)</option>
                  {units.filter(u => u.parent === x.key && u.type === 'dept').map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                </optgroup>
              ))}
              <optgroup label="Ban trực thuộc">{units.filter(u => u.type === 'board' || u.type === 'governance').map(u => <option key={u.key} value={u.key}>{u.name}</option>)}</optgroup>
            </select>
          </label>
          <ZoomCtl zoom={zoom} setZoom={setZoom} />
          <button className="cc-btn ghost" onClick={fit}>Vừa khung</button>
          {editable && <button className="cc-btn" onClick={() => setForm({ key: '', label: '', name: '', type: 'dept', parent: sel || 'ceo', tone: 'primary', desc: '', headId: '' })}><Icon name="plus" size={14} stroke={2.4} />Thêm đơn vị</button>}
        </div>
        <div className="cc-card cc-org-wrap" ref={wrapRef} onMouseDown={onDown}>
          <div className="cc-org cc-org-units" style={{ zoom }} ref={orgRef}>
            {deptPeopleMode
              ? <ul>{deptTree() || <li><Empty icon="users" text="Đơn vị chưa có nhân sự — bấm vào đơn vị để thêm" /></li>}</ul>
              : <ul>{roots.map(r => render(r))}</ul>}
          </div>
        </div>
      </div>

      {unit && (
        <div className={`cc-card cc-pad cc-unit-panel cc-tone-${unit.tone}`}>
          <div className="cc-job-top">
            <span className="cc-ico"><Icon name={unit.type === 'dept' ? 'building' : 'sitemap'} size={15} /></span>
            <div className="cc-grow"><span className="cc-kicker">{UNIT_TYPE_LABEL[unit.type]}</span><b style={{ fontSize: 16 }}>{unit.name}</b></div>
            {editable && <button className="cc-icon-btn" title="Sửa đơn vị" onClick={() => setForm({ ...unit, _orig: unit.key, headId: heads[unit.key] || '' })}><Icon name="edit" size={15} /></button>}
            {editable && unit.type !== 'governance' && <button className="cc-icon-btn danger" title="Xoá đơn vị" onClick={() => onDeleteUnit(unit, isConcurrent(unit.key) ? 0 : members(unit.key).length, kids(unit.key).length + boards(unit.key).length)}><Icon name="trash" size={15} /></button>}
            <button className="cc-icon-btn" title="Đóng" onClick={() => setSel(null)}><Icon name="x" size={15} /></button>
          </div>
          {focus !== unit.key && <button className="cc-link-btn" style={{ marginTop: 8 }} onClick={() => setFocus(unit.key)}><Icon name="sitemap" size={13} />Xem sơ đồ riêng của đơn vị này</button>}
          {unit.desc && <p className="cc-job-desc" style={{ marginTop: 10 }}>{unit.desc}</p>}
          <div className="cc-kv"><span>Trực thuộc</span><b>{parent ? <button className="cc-link-btn" onClick={() => setSel(parent.key)}>{parent.label}</button> : '—'}</b></div>
          <div className="cc-kv"><span>Trưởng đơn vị</span><b>{head ? <button className="cc-link-btn" onClick={() => onOpen(head.id)}>{head.name}</button> : 'Chưa bổ nhiệm'}</b></div>
          <div className="cc-kv"><span>Nhân sự</span><b>{list.length} người{unit.type === 'exec' ? ` · cả khối ${total(unit.key)}` : ''}</b></div>
          {(kids(unit.key).length > 0 || boards(unit.key).length > 0) && (
            <>
              <h3 className="cc-h3" style={{ marginTop: 14 }}>Đơn vị trực thuộc</h3>
              <div className="cc-checks">{[...boards(unit.key), ...kids(unit.key)].map(k => <button key={k.key} className={`cc-legend-chip cc-tone-${k.tone}`} onClick={() => setSel(k.key)}><i />{k.label} · {k.type === 'board' ? 'ban' : total(k.key)}</button>)}</div>
            </>
          )}
          <div className="cc-row-between" style={{ marginTop: 14, marginBottom: 6 }}>
            <h3 className="cc-h3" style={{ margin: 0 }}>Thành viên{isConcurrent(unit.key) ? ' (kiêm nhiệm)' : ''}</h3>
            {editable && <button className="cc-btn ghost" style={{ height: 30 }} onClick={() => setPicker({ q: '', ids: new Set() })}><Icon name="userPlus" size={14} />Thêm nhân sự</button>}
          </div>
          {list.length === 0 ? <Empty icon="users" text="Chưa có thành viên" /> : list.map(e => (
            <div key={e.id} className="cc-unit-member">
              <button className="cc-unit-member-main" onClick={() => onOpen(e.id)}>
                <Avatar emp={e} size={28} />
                <span className="cc-grow"><b>{e.name}</b><span>{e.position}{isConcurrent(unit.key) ? ` · ${deptOf(e.dept).name}` : ''}</span></span>
              </button>
              {heads[unit.key] === e.id && <Pill tone={unit.tone}>Trưởng</Pill>}
              {editable && isConcurrent(unit.key) && <button className="cc-icon-btn sm danger" title="Gỡ khỏi ban" onClick={() => onRemoveExtra(unit, e)}><Icon name="x" size={13} /></button>}
              {editable && !isConcurrent(unit.key) && (
                <label className="cc-move" title="Chuyển sang đơn vị khác">
                  <Icon name="arrowRight" size={13} />
                  <select value="" onChange={ev => ev.target.value && onAssign(unitOf(ev.target.value), [e.id])}>
                    <option value="">Chuyển sang...</option>
                    {units.filter(u => (u.type === 'dept' || u.type === 'exec') && u.key !== unit.key).map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!picker && !!unit} onClose={() => setPicker(null)} width={560} icon="userPlus" title={`Thêm nhân sự vào ${unit?.label || ''}`}
        sub={unit && isConcurrent(unit.key) ? 'Thành viên kiêm nhiệm — vẫn giữ phòng ban hiện tại' : 'Nhân sự được chuyển sang đơn vị này, quản lý trực tiếp = trưởng đơn vị'}
        footer={<><span className="cc-grow cc-sub">{picker?.ids.size || 0} người được chọn</span><button className="cc-btn ghost" onClick={() => setPicker(null)}>Hủy</button>
          <button className="cc-btn" disabled={!picker?.ids.size} onClick={() => { onAssign(unit, [...picker.ids]); setPicker(null) }}><Icon name="check" size={14} stroke={2.6} />Thêm {picker?.ids.size || ''} người</button></>}>
        {picker && unit && (() => {
          const inUnit = new Set(members(unit.key).map(e => e.id))
          const t = picker.q.trim().toLowerCase()
          const cands = current.filter(e => !inUnit.has(e.id) && (!t || (e.name + ' ' + e.position + ' ' + deptOf(e.dept).name).toLowerCase().includes(t)))
          const toggle = id => setPicker(p => { const ids = new Set(p.ids); ids.has(id) ? ids.delete(id) : ids.add(id); return { ...p, ids } })
          return (
            <div className="cc-stack" style={{ gap: 10 }}>
              <label className="cc-search" style={{ width: '100%' }}><Icon name="search" size={14} /><input autoFocus placeholder="Tìm theo tên, chức danh, phòng ban..." value={picker.q} onChange={e => setPicker({ ...picker, q: e.target.value })} /></label>
              <div className="cc-pick-list">
                {cands.length === 0 && <Empty icon="search" text="Không còn nhân sự phù hợp" />}
                {cands.map(e => (
                  <label key={e.id} className={`cc-pick${picker.ids.has(e.id) ? ' on' : ''}`}>
                    <input type="checkbox" checked={picker.ids.has(e.id)} onChange={() => toggle(e.id)} />
                    <Avatar emp={e} size={28} />
                    <span className="cc-grow"><b>{e.name}</b><span>{e.position}</span></span>
                    <Pill tone={deptOf(e.dept).tone}>{deptOf(e.dept).name}</Pill>
                  </label>
                ))}
              </div>
            </div>
          )
        })()}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} width={600} icon="sitemap" title={form?._orig ? `Thiết lập — ${form.label}` : 'Thêm đơn vị tổ chức'} sub="Phòng ban, khối điều hành hoặc ban trực thuộc"
        footer={<><span className="cc-grow" /><button className="cc-btn ghost" onClick={() => setForm(null)}>Hủy</button><button className="cc-btn" onClick={save} disabled={!form?.label.trim()}>Lưu</button></>}>
        {form && <div className="cc-form" style={{ marginTop: 0 }}>
          <Field label="Tên trên sơ đồ *"><input value={form.label} placeholder="VD: Pháp chế" onChange={e => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="Tên đầy đủ"><input value={form.name} placeholder="VD: Phòng Pháp chế" onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Loại đơn vị"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{Object.entries(UNIT_TYPE_LABEL).filter(([k]) => k !== 'governance' || form.type === 'governance').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Trực thuộc">
            <select value={form.parent || ''} disabled={form.type === 'governance'} onChange={e => setForm({ ...form, parent: e.target.value })}>
              {units.filter(u => u.type !== 'board' && !blocked.has(u.key)).map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </Field>
          <Field label="Trưởng đơn vị">
            <select value={form.headId} onChange={e => setForm({ ...form, headId: e.target.value })}>
              <option value="">— Chưa bổ nhiệm —</option>
              {current.map(e => <option key={e.id} value={e.id}>{e.name} · {e.position}</option>)}
            </select>
          </Field>
          <Field label="Màu nhận diện"><div className="cc-tone-pick">{TONES.map(t => <button type="button" key={t} className={`cc-tone-${t}${form.tone === t ? ' active' : ''}`} onClick={() => setForm({ ...form, tone: t })} aria-label={t} />)}</div></Field>
          <Field label="Chức năng, nhiệm vụ" full><input value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></Field>
        </div>}
      </Modal>
    </div>
  )
}

/* ================= Sơ đồ nhân sự =================
   Khung là cơ cấu phòng ban; mỗi đơn vị hiển thị trưởng đơn vị và mở ra toàn bộ nhân sự theo cấp bậc
   (Trưởng phòng → Phó phòng / Quản lý / Trưởng nhóm / Điều phối → Chuyên viên / Nhân viên).
   "Thu gọn" ẩn nhân sự, chỉ còn khung cơ cấu phòng ban. */
const rankOf = e => LEVELS.indexOf(e.level)
function PeopleView({ employees, units, heads, extraMembers, onOpen }) {
  const [hidden, setHidden] = useState(() => new Set()) // đơn vị đang thu gọn nhân sự
  const [zoom, setZoom] = useState(1)
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('all')
  const wrapRef = useRef(null)
  const orgRef = useRef(null)
  const onDown = usePan(wrapRef)

  const current = employees.filter(e => e.status !== 'left')
  const empOf = id => employees.find(e => e.id === id)
  const kids = key => units.filter(u => u.parent === key && u.type !== 'board')
  const boards = key => units.filter(u => u.parent === key && u.type === 'board')
  const members = key => {
    const u = units.find(x => x.key === key)
    if (u && (u.type === 'board' || u.type === 'governance')) return (extraMembers[key] || []).map(empOf).filter(e => e && e.status !== 'left')
    return current.filter(e => e.dept === key)
  }
  const subtreeKeys = key => [key, ...kids(key).flatMap(k => subtreeKeys(k.key))]

  const t = q.trim().toLowerCase()
  const isMatch = e => (t && (e.name + ' ' + e.position).toLowerCase().includes(t)) || (dept !== 'all' && e.dept === dept)
  const filtering = !!t || dept !== 'all'
  const unitHasMatch = key => subtreeKeys(key).some(k => members(k).some(isMatch))
  const isOpen = key => (t ? true : !hidden.has(key)) // đang tìm kiếm → mở hết để thấy kết quả

  const fit = () => {
    const w = wrapRef.current, o = orgRef.current
    if (!w || !o || !o.firstElementChild) return
    const z = parseFloat(o.style.zoom) || 1
    // Đo độ rộng thật của cây = tổng độ rộng các nút gốc (ul có thể rộng bằng khung nên không dùng được)
    const roots = o.querySelectorAll(':scope > ul > li')
    const natural = [...roots].reduce((w, li) => w + li.getBoundingClientRect().width, 0) / z + 48
    setZoom(Math.max(0.4, Math.min(1, Math.floor((w.clientWidth - 8) / natural * 100) / 100)))
  }
  useEffect(() => { requestAnimationFrame(fit) }, [hidden]) // eslint-disable-line react-hooks/exhaustive-deps

  const RankPill = ({ e, tone }) => <span className={`cc-rank cc-tone-${tone || LEVEL_TONE[e.level] || 'muted'}`}>{e.level}</span>

  /* Một nhân sự (không phải trưởng đơn vị) + các cấp dưới trong cùng đơn vị */
  const renderPerson = (e, pool, seen) => {
    seen.add(e.id)
    const sub = pool.filter(x => x.managerId === e.id && !seen.has(x.id)).sort((a, b) => rankOf(b) - rankOf(a) || a.name.localeCompare(b.name))
    const d = deptOf(e.dept)
    const m = isMatch(e)
    return (
      <li key={'p' + e.id}>
        <div className={`cc-org-node cc-tone-${d.tone}${m ? ' match' : ''}${filtering && !m ? ' dim' : ''}`}>
          <button className="cc-org-card cc-person-card" onClick={() => onOpen(e.id)} title="Xem hồ sơ">
            <Avatar emp={e} size={32} />
            <span className="cc-org-text"><b>{e.name}</b><span>{e.position}</span><RankPill e={e} /></span>
          </button>
        </div>
        {sub.length > 0 && <ul>{sub.map(x => renderPerson(x, pool, seen))}</ul>}
      </li>
    )
  }
  /* Nhân sự của đơn vị (trừ trưởng): người có quản lý ngoài đơn vị / là trưởng → treo dưới trưởng đơn vị */
  const staffOf = u => {
    if (u.type === 'board' || u.type === 'governance') return [] // thành viên kiêm nhiệm: chỉ hiện avatar trên ô ban
    const head = heads[u.key]
    const pool = members(u.key).filter(e => e.id !== head)
    const ids = new Set(pool.map(e => e.id))
    const top = pool.filter(e => !ids.has(e.managerId)).sort((a, b) => rankOf(b) - rankOf(a) || a.name.localeCompare(b.name))
    const seen = new Set()
    const out = top.map(e => renderPerson(e, pool, seen))
    pool.filter(e => !seen.has(e.id)).forEach(e => out.push(renderPerson(e, pool, seen)))
    return out
  }

  const render = (u, drop) => {
    const ch = kids(u.key)
    const side = boards(u.key)
    const hasExec = ch.some(c => c.type === 'exec')
    const head = empOf(heads[u.key])
    const staffN = u.type === 'board' || u.type === 'governance' ? 0 : members(u.key).filter(e => e.id !== heads[u.key]).length
    const open = isOpen(u.key)
    const m = head && isMatch(head)
    const dim = filtering && !m && !unitHasMatch(u.key)
    return (
      <li key={u.key} className={drop ? 'drop' : undefined}>
        <div className="cc-unit-row">
          <div className={`cc-punit cc-tone-${u.tone} type-${u.type}${m ? ' match' : ''}${dim ? ' dim' : ''}`}>
            <div className="cc-punit-band">{u.label}</div>
            {head ? (
              <button className="cc-punit-head" onClick={() => onOpen(head.id)} title="Xem hồ sơ">
                <Avatar emp={head} size={30} />
                <span className="cc-org-text"><b>{head.name}</b><span>{head.position}</span></span>
              </button>
            ) : <div className="cc-punit-head empty">Chưa bổ nhiệm trưởng đơn vị</div>}
            {staffN > 0 && (
              <button className="cc-punit-toggle" onClick={() => setHidden(prev => { const n = new Set(prev); n.has(u.key) ? n.delete(u.key) : n.add(u.key); return n })}>
                {open ? <><Icon name="minus" size={11} stroke={3} />Ẩn {staffN} nhân sự</> : <><Icon name="plus" size={11} stroke={3} />{staffN} nhân sự</>}
              </button>
            )}
          </div>
          {side.length > 0 && (
            <div className="cc-unit-side">{side.map(b => (
              <div key={b.key} className="cc-unit-side-item">
                <div className={`cc-unit small cc-tone-${b.tone} type-board`}><b>{b.label}</b><span className="cc-board-avs">{members(b.key).slice(0, 4).map(e => <Avatar key={e.id} emp={e} size={16} />)}</span></div>
              </div>
            ))}</div>
          )}
        </div>
        {(ch.length > 0 || (open && staffN > 0)) && (
          <ul>
            {open && staffOf(u)}
            {ch.map(c => render(c, hasExec && c.type !== 'exec'))}
          </ul>
        )}
      </li>
    )
  }

  const roots = units.filter(u => !u.parent || !units.some(p => p.key === u.parent))
  const allKeys = units.map(u => u.key)
  const anyOpen = allKeys.some(k => !hidden.has(k))

  return (
    <div className="cc-stack cc-fill">
      <div className="cc-card cc-pad cc-org-bar">
        <div><h3 className="cc-h3" style={{ margin: 0 }}>Sơ đồ nhân sự</h3><span className="cc-sub">{current.length} nhân sự · theo cơ cấu phòng ban & cấp bậc</span></div>
        <label className="cc-search"><Icon name="search" size={14} /><input placeholder="Tìm người trong sơ đồ..." value={q} onChange={e => setQ(e.target.value)} /></label>
        <select className="cc-select" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="all">Tô sáng phòng ban...</option>
          {DEPTS.map(d => <option key={d.key} value={d.key}>{d.name} · {current.filter(e => e.dept === d.key).length}</option>)}
        </select>
        <span className="cc-grow" />
        <div className="cc-rank-legend">{['Giám đốc', 'Trưởng phòng', 'Trưởng nhóm', 'Điều phối', 'Nhân viên'].map(l => <span key={l} className={`cc-rank cc-tone-${LEVEL_TONE[l]}`}>{l}</span>)}</div>
        <ZoomCtl zoom={zoom} setZoom={setZoom} />
        <button className="cc-btn ghost" onClick={fit}>Vừa khung</button>
        {anyOpen
          ? <button className="cc-btn ghost" onClick={() => setHidden(new Set(allKeys))}><Icon name="minus" size={13} stroke={2.6} />Thu gọn (cơ cấu)</button>
          : <button className="cc-btn" onClick={() => setHidden(new Set())}><Icon name="plus" size={13} stroke={2.6} />Mở rộng tất cả</button>}
      </div>
      <div className="cc-card cc-org-wrap" ref={wrapRef} onMouseDown={onDown}>
        <div className="cc-org cc-org-units cc-org-people" style={{ zoom }} ref={orgRef}><ul>{roots.map(r => render(r))}</ul></div>
      </div>
    </div>
  )
}

/* Phân hệ "Sơ đồ tổ chức": cơ cấu phòng ban + sơ đồ nhân sự */
export default function OrgChart({ employees, units, heads, extraMembers, onSaveUnit, onDeleteUnit, onAssign, onRemoveExtra, onOpen }) {
  const [view, setView] = useState('units')
  return (
    <div className="cc-stack cc-fill">
      <Seg value={view} onChange={setView} options={[{ value: 'units', label: 'Cơ cấu phòng ban', icon: 'sitemap' }, { value: 'people', label: 'Sơ đồ nhân sự', icon: 'users' }]} />
      {view === 'units'
        ? <UnitsView employees={employees} units={units} heads={heads} extraMembers={extraMembers} onSaveUnit={onSaveUnit} onDeleteUnit={onDeleteUnit} onAssign={onAssign} onRemoveExtra={onRemoveExtra} onOpen={onOpen} />
        : <PeopleView employees={employees} units={units} heads={heads} extraMembers={extraMembers} onOpen={onOpen} />}
      <div className="cc-sub" style={{ textAlign: 'center' }}>Kéo nền để di chuyển · bấm vào thẻ để xem chi tiết</div>
    </div>
  )
}
