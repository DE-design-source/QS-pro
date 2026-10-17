import { useMemo, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { deptOf, companyOf, PARENT_COMPANY, isStandaloneCo, MOTHER_KEY, HOLDING, HOLDING_KEY } from '../../../data/hrData'
import { Avatar, Modal, Field } from './shared'

const TONES = ['qs', 'primary', 'attendance', 'finance', 'sales', 'marketing', 'danger', 'success', 'muted']
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12)
const BOARDS = [
  { kind: 'bks', label: 'Ban kiểm soát', desc: 'Kiểm soát tài chính, tuân thủ & rủi ro của công ty con' },
  { kind: 'bcl', label: 'Ban chiến lược', desc: 'Định hướng chiến lược & đầu tư của công ty con' },
]

/* Chọn nhiều người (danh sách có ô tìm) */
function PeoplePick({ people, value, onChange, max }) {
  const [q, setQ] = useState('')
  const t = q.trim().toLowerCase()
  const list = people.filter(e => !t || (e.name + ' ' + e.position).toLowerCase().includes(t))
  const toggle = id => onChange(value.includes(id) ? value.filter(x => x !== id) : (max === 1 ? [id] : [...value, id]))
  return (
    <div className="cc-au-pick">
      <label className="cc-search" style={{ width: '100%' }}><Icon name="search" size={13} /><input placeholder="Tìm nhân sự..." value={q} onChange={e => setQ(e.target.value)} /></label>
      <div className="cc-au-pick-list">
        {list.map(e => (
          <label key={e.id} className={`cc-pick${value.includes(e.id) ? ' on' : ''}`}>
            <input type={max === 1 ? 'radio' : 'checkbox'} checked={value.includes(e.id)} onChange={() => toggle(e.id)} />
            <Avatar emp={e} size={24} />
            <span className="cc-grow"><b>{e.name}</b><span>{e.position} · {deptOf(e.dept).name}</span></span>
          </label>
        ))}
        {!list.length && <div className="cc-sub" style={{ padding: 10 }}>Không có nhân sự phù hợp</div>}
      </div>
    </div>
  )
}

/* Modal "Thêm bộ phận": phòng ban hoặc công ty con + liên kết người đứng đầu (kiêm nhiệm / độc lập).
   Quy tắc: công ty con do lãnh đạo độc lập điều hành; chỉ Ban kiểm soát / Ban chiến lược được bổ nhiệm từ công ty mẹ. */
export default function AddUnitModal({ open, onClose, units, employees, defaultParent, initialKind, onCreate }) {
  const [f, setF] = useState(() => ({ kind: initialKind || 'dept', label: '', name: '', parent: defaultParent || 'ceo', tone: 'primary', desc: '', leadMode: initialKind === 'subsidiary' ? 'independent' : 'concurrent', lead: [], leadTitle: '', leadPct: 20, boards: { bks: [], bcl: [] }, boardOn: { bks: true, bcl: false }, linked: true }))
  const [err, setErr] = useState('')
  const set = patch => { setErr(''); setF(p => ({ ...p, ...patch })) }

  const current = employees.filter(e => e.status !== 'left')
  const parentCompany = companyOf(units, f.parent)
  const inCompany = (e, co) => companyOf(units, e.dept) === co
  const isSub = f.kind === 'subsidiary'
  const leadMode = isSub && f.leadMode === 'concurrent' ? 'independent' : f.leadMode
  // Kiêm nhiệm: chỉ nhân sự cùng pháp nhân với đơn vị cấp trên · Độc lập: bất kỳ ai (được điều chuyển hẳn sang)
  const leadPeople = useMemo(() => (leadMode === 'concurrent' ? current.filter(e => inCompany(e, parentCompany)) : current), [leadMode, parentCompany, current]) // eslint-disable-line react-hooks/exhaustive-deps
  const motherPeople = current.filter(e => inCompany(e, parentCompany))
  // Thêm từ trong công ty thành viên độc lập: chỉ chọn đơn vị của công ty đó; ngược lại bỏ các công ty thành viên độc lập
  const homeCo = units.find(u => u.key === companyOf(units, defaultParent))
  const standaloneHome = homeCo && isStandaloneCo(homeCo)
  const parents = units.filter(u => u.type !== 'board' && (standaloneHome ? companyOf(units, u.key) === homeCo.key : !units.some(c => isStandaloneCo(c) && companyOf(units, u.key) === c.key)))
  const linked = !isSub || f.linked

  function submit() {
    const label = f.label.trim()
    if (!label) { setErr('Nhập tên bộ phận'); return }
    let key = slug(label) || 'unit'
    while (units.some(u => u.key === key)) key += '1'
    if (leadMode !== 'none' && !f.lead.length) { setErr(leadMode === 'concurrent' ? 'Chọn người quản lý kiêm nhiệm' : 'Chọn lãnh đạo độc lập, hoặc chọn "Chưa bổ nhiệm"'); return }
    const boards = isSub && linked ? BOARDS.filter(b => f.boardOn[b.kind]).map(b => ({ ...b, members: f.boards[b.kind] })) : []
    onCreate({
      unit: { key, label, name: f.name.trim() || (isSub ? label : label), type: isSub ? 'subsidiary' : 'dept', parent: linked ? f.parent : null, tone: f.tone, desc: f.desc.trim() },
      lead: { mode: leadMode, empId: f.lead[0] || null, title: f.leadTitle.trim() || (isSub ? 'Giám đốc công ty con' : leadMode === 'concurrent' ? 'Quản lý kiêm nhiệm' : 'Trưởng ' + label), pct: Number(f.leadPct) || 10 },
      boards,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={720} icon={isSub ? 'building' : 'sitemap'} title="Thêm bộ phận" sub="Phòng ban hoặc công ty con — liên kết người đứng đầu theo hình thức kiêm nhiệm hoặc độc lập"
      footer={<><span className="cc-grow cc-sub" style={err ? { color: 'var(--danger)' } : undefined}>{err}</span><button className="cc-btn ghost" onClick={onClose}>Hủy</button><button className="cc-btn" onClick={submit}><Icon name="check" size={14} stroke={2.6} />Thêm bộ phận</button></>}>
      <div className="cc-stack" style={{ gap: 16 }}>
        <div className="cc-au-kinds">
          {[{ v: 'dept', icon: 'sitemap', t: 'Phòng ban', d: 'Bộ phận thuộc pháp nhân hiện tại' }, { v: 'subsidiary', icon: 'building', t: 'Công ty con', d: 'Pháp nhân riêng, vận hành độc lập' }].map(k => (
            <button key={k.v} type="button" className={`cc-au-kind${f.kind === k.v ? ' active' : ''}`} onClick={() => set({ kind: k.v, leadMode: k.v === 'subsidiary' ? 'independent' : f.leadMode, parent: k.v === 'subsidiary' && !standaloneHome ? (defaultParent === HOLDING_KEY ? HOLDING_KEY : MOTHER_KEY) : [MOTHER_KEY, HOLDING_KEY].includes(f.parent) ? (defaultParent && ![MOTHER_KEY, HOLDING_KEY].includes(defaultParent) ? defaultParent : 'ceo') : f.parent })}>
              <Icon name={k.icon} size={18} /><span><b>{k.t}</b><em>{k.d}</em></span>
            </button>
          ))}
        </div>

        <div className="cc-form" style={{ marginTop: 0 }}>
          <Field label={isSub ? 'Tên công ty con *' : 'Tên phòng ban *'}><input value={f.label} placeholder={isSub ? 'VD: Dezon Interior' : 'VD: Pháp chế'} onChange={e => set({ label: e.target.value })} /></Field>
          <Field label="Tên đầy đủ"><input value={f.name} placeholder={isSub ? 'VD: Công ty TNHH Nội thất Dezon' : 'VD: Phòng Pháp chế'} onChange={e => set({ name: e.target.value })} /></Field>
          {isSub && (
            <div className="cc-f full">
              <span className="cc-f-label">Quan hệ với tập đoàn ({HOLDING.name})</span>
              <div className="cc-au-modes two">
                <button type="button" className={`cc-au-mode${f.linked ? ' active' : ''}`} onClick={() => set({ linked: true })}><b>Liên kết</b><em>Trực thuộc {HOLDING.name}, {PARENT_COMPANY.name} hoặc một đơn vị; BKS / BCL được bổ nhiệm từ công ty mẹ</em></button>
                <button type="button" className={`cc-au-mode${!f.linked ? ' active' : ''}`} onClick={() => set({ linked: false })}><b>Không liên kết (độc lập)</b><em>Không trực thuộc {HOLDING.name}; có sơ đồ tổ chức riêng, sơ đồ tập đoàn hiện tách biệt</em></button>
              </div>
            </div>
          )}
          <Field label="Trực thuộc">
            <select value={linked ? f.parent : ''} disabled={!linked} onChange={e => set({ parent: e.target.value, lead: [], boards: { bks: [], bcl: [] } })}>{!linked && <option value="">— Độc lập, không trực thuộc —</option>}{isSub && linked && !standaloneHome && <option value={HOLDING_KEY}>{HOLDING.name} — công ty thành viên tập đoàn</option>}{isSub && linked && !standaloneHome && <option value={MOTHER_KEY}>{PARENT_COMPANY.name} — trực thuộc trực tiếp công ty mẹ</option>}{parents.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}</select>
          </Field>
          <Field label="Màu nhận diện"><div className="cc-tone-pick">{TONES.map(t => <button type="button" key={t} className={`cc-tone-${t}${f.tone === t ? ' active' : ''}`} onClick={() => set({ tone: t })} aria-label={t} />)}</div></Field>
          <Field label="Chức năng, nhiệm vụ" full><input value={f.desc} onChange={e => set({ desc: e.target.value })} /></Field>
        </div>

        <div>
          <div className="cc-f-label" style={{ marginBottom: 6 }}>Người đứng đầu</div>
          <div className="cc-au-modes">
            <button type="button" disabled={isSub} className={`cc-au-mode${leadMode === 'concurrent' ? ' active' : ''}`} onClick={() => set({ leadMode: 'concurrent', lead: [] })} title={isSub ? 'Công ty con phải do lãnh đạo độc lập điều hành' : ''}>
              <span className="cc-role-tag conc">Kiêm nhiệm</span><b>Liên kết với quản lý</b><em>Một quản lý hiện có kiêm thêm vai trò này, giữ phòng ban chính</em>
            </button>
            <button type="button" className={`cc-au-mode${leadMode === 'independent' ? ' active' : ''}`} onClick={() => set({ leadMode: 'independent', lead: [] })}>
              <span className="cc-role-tag main">Độc lập</span><b>Lãnh đạo độc lập</b><em>Điều chuyển toàn thời gian sang bộ phận mới</em>
            </button>
            <button type="button" className={`cc-au-mode${leadMode === 'none' ? ' active' : ''}`} onClick={() => set({ leadMode: 'none', lead: [] })}>
              <span className="cc-role-tag" style={{ background: 'var(--surface-alt)', color: 'var(--text-muted)' }}>Trống</span><b>Chưa bổ nhiệm</b><em>Tuyển dụng / bổ nhiệm sau</em>
            </button>
          </div>
          {isSub && <div className="cc-au-note"><Icon name="lock" size={13} /><span>Công ty con do lãnh đạo độc lập điều hành. Chỉ <b>Ban kiểm soát</b> và <b>Ban chiến lược</b> được bổ nhiệm từ công ty mẹ.</span></div>}
          {leadMode !== 'none' && (
            <div className="cc-au-lead">
              <PeoplePick people={leadPeople} value={f.lead} onChange={v => set({ lead: v })} max={1} />
              <div className="cc-stack" style={{ gap: 10 }}>
                <Field label="Chức danh tại bộ phận mới"><input value={f.leadTitle} placeholder={isSub ? 'Giám đốc công ty con' : leadMode === 'concurrent' ? 'Quản lý kiêm nhiệm' : 'Trưởng phòng'} onChange={e => set({ leadTitle: e.target.value })} /></Field>
                {leadMode === 'concurrent' && <Field label="Tỉ lệ kiêm nhiệm (%)" hint={undefined}><input type="number" min="5" max="90" step="5" value={f.leadPct} onChange={e => set({ leadPct: e.target.value })} /></Field>}
                <div className="cc-sub">{leadMode === 'concurrent'
                  ? 'Người này vẫn thuộc phòng ban chính; tỉ lệ được trừ vào phòng chính và dùng để phân bổ lương.'
                  : 'Người này được điều chuyển hẳn sang bộ phận mới và báo cáo cho trưởng đơn vị cấp trên.'}</div>
              </div>
            </div>
          )}
        </div>

        {isSub && !linked && <div className="cc-au-note"><Icon name="lock" size={13} /><span>Công ty thành viên độc lập không nhận bổ nhiệm từ công ty mẹ. Có thể thành lập các ban của công ty này sau khi tạo.</span></div>}
        {isSub && linked && (
          <div>
            <div className="cc-f-label" style={{ marginBottom: 6 }}>Ban bổ nhiệm từ công ty mẹ <span style={{ fontWeight: 500 }}>(kiêm nhiệm, mặc định 5%) · có thể để trống và bổ nhiệm sau</span></div>
            <div className="cc-au-boards">
              {BOARDS.map(b => (
                <div key={b.kind} className={`cc-au-board${f.boardOn[b.kind] ? ' on' : ''}`}>
                  <label className="cc-au-board-head"><input type="checkbox" checked={f.boardOn[b.kind]} onChange={e => set({ boardOn: { ...f.boardOn, [b.kind]: e.target.checked } })} /><b>Thành lập {b.label}</b><span className="cc-chip-sm">Từ công ty mẹ</span></label>
                  {f.boardOn[b.kind] && <PeoplePick people={motherPeople} value={f.boards[b.kind]} onChange={v => set({ boards: { ...f.boards, [b.kind]: v } })} />}
                  {f.boardOn[b.kind] && <div className="cc-sub">Người chọn đầu tiên là trưởng ban · {f.boards[b.kind].length} người</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
