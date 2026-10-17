import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  INITIAL_ORG_UNITS, INITIAL_UNIT_HEADS, INITIAL_HR_EMPLOYEES, HR_TODAY, LEVELS, fmtDate, initials, avatarColor,
} from '../../data/hrData'
import './DeptStaff.css'

/* Tab "Nhân sự" dùng chung cho các trang phòng ban — cơ cấu tổ chức & danh sách nhân sự lấy từ HR
   (Sơ đồ tổ chức + Hồ sơ nhân sự). units: các đơn vị HR của trang (kèm toàn bộ đơn vị con). */
const unitOf = key => INITIAL_ORG_UNITS.find(u => u.key === key)
const empOf = id => INITIAL_HR_EMPLOYEES.find(e => e.id === id)
const childUnits = key => INITIAL_ORG_UNITS.filter(u => u.parent === key && u.type !== 'board')
const subtree = key => [key, ...childUnits(key).flatMap(u => subtree(u.key))]
const STATUS_LABEL = { active: 'Chính thức', probation: 'Thử việc', leave: 'Nghỉ phép', left: 'Đã nghỉ' }
const yearsOf = iso => (new Date(HR_TODAY) - new Date(iso)) / (365.25 * 86400000)
const tenure = iso => { const y = yearsOf(iso); return y < 1 ? `${Math.max(1, Math.round(y * 12))} tháng` : `${y.toFixed(1).replace('.', ',').replace(',0', '')} năm` }

function Avatar({ e, size = 34 }) {
  return <span className="ds-avatar" style={{ background: avatarColor(e.id), width: size, height: size, fontSize: size * 0.36 }}>{initials(e.name)}</span>
}

export default function DeptStaff({ units: unitKeys, title, note }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const units = unitKeys.map(unitOf).filter(Boolean)
  const allKeys = new Set(unitKeys.flatMap(subtree))
  const staff = INITIAL_HR_EMPLOYEES.filter(e => allKeys.has(e.dept) && e.status !== 'left')
    .sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || a.name.localeCompare(b.name))
  const isHead = e => INITIAL_UNIT_HEADS[e.dept] === e.id
  // Khối điều hành (VD: CCO) → 'Lãnh đạo khối'; phòng ban → 'Trưởng <tên phòng>'
  const headTitle = e => { const u = unitOf(e.dept); return u?.type === 'exec' ? 'Lãnh đạo khối' : `Trưởng ${u?.label || 'đơn vị'}` }
  const openHR = () => navigate('/cham-cong#employees')

  /* Cây: đơn vị → trưởng đơn vị → cấp dưới trong đơn vị; đơn vị con treo dưới trưởng đơn vị */
  const personNode = (e, members, subUnits, seen) => {
    seen.add(e.id)
    const kids = members.filter(x => x.managerId === e.id && !seen.has(x.id))
    return (
      <li key={'e' + e.id}>
        <div className={`ds-node${isHead(e) ? ' head' : ''}`}>
          <Avatar e={e} />
          <div><b>{e.name}</b><span>{e.position}</span><em>{isHead(e) ? headTitle(e) : e.level}</em></div>
        </div>
        {(kids.length > 0 || subUnits.length > 0) && <ul>{kids.map(k => personNode(k, members, [], seen))}{subUnits.map(unitBranch)}</ul>}
      </li>
    )
  }
  function unitBranch(u) {
    const members = staff.filter(e => e.dept === u.key)
    const subs = childUnits(u.key)
    const head = empOf(INITIAL_UNIT_HEADS[u.key])
    const ids = new Set(members.map(e => e.id))
    const roots = head && ids.has(head.id) ? [head] : members.filter(e => !ids.has(e.managerId))
    const seen = new Set()
    return (
      <li key={'u' + u.key}>
        <div className="ds-unit">{u.label}<em>{staff.filter(e => subtree(u.key).includes(e.dept)).length}</em></div>
        {(roots.length > 0 || subs.length > 0) && (
          <ul>
            {roots.map((r, i) => personNode(r, members, i === 0 ? subs : [], seen))}
            {roots.length === 0 && subs.map(unitBranch)}
          </ul>
        )}
      </li>
    )
  }
  // Một đơn vị: hiện thêm cấp trên trực tiếp (trưởng đơn vị cha)
  const single = units.length === 1 ? units[0] : null
  const parent = single && unitOf(single.parent)
  const boss = parent && empOf(INITIAL_UNIT_HEADS[parent.key])
  const path = []
  for (let u = single, n = 0; u && n < 10; u = unitOf(u.parent), n++) path.unshift(u)

  const avgYears = staff.length ? staff.reduce((s, e) => s + yearsOf(e.joinDate), 0) / staff.length : 0
  const byLevel = LEVELS.slice().reverse().map(l => ({ l, n: staff.filter(e => e.level === l).length })).filter(x => x.n)
  const heads = units.map(u => empOf(INITIAL_UNIT_HEADS[u.key])).filter(Boolean)
  const certs = staff.reduce((s, e) => s + (e.certificates?.length || 0), 0)
  const t = q.trim().toLowerCase()
  const rows = staff.filter(e => !t || (e.name + ' ' + e.position + ' ' + e.code + ' ' + (unitOf(e.dept)?.label || '')).toLowerCase().includes(t))
  const multiUnit = allKeys.size > 1

  if (!units.length) return <div className="ds-card ds-empty">Chưa có phòng ban tương ứng trong HR — tạo trong HR › Sơ đồ tổ chức.</div>

  return (
    <div className="ds-wrap">
      <div className="ds-card ds-hero">
        <div className="ds-hero-main">
          <div className="ds-crumbs">{single ? path.map((u, i) => <span key={u.key}>{i > 0 && ' › '}{u.label}</span>) : units.map(u => u.name).join(' · ')}</div>
          <h2>{title || single?.name}</h2>
          <p>{single ? single.desc : units.map(u => u.desc).filter(Boolean).join(' · ')}</p>
          {note && <p className="ds-note">{note}</p>}
        </div>
        <div className="ds-hero-side">
          <span className="ds-source">Nguồn: HR · Sơ đồ tổ chức &amp; Hồ sơ nhân sự</span>
          <button className="ds-btn" onClick={openHR}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
            Mở trong HR
          </button>
        </div>
      </div>

      <div className="ds-kpis">
        <div className="ds-card ds-kpi"><span>Nhân sự</span><b>{staff.length}</b></div>
        <div className="ds-card ds-kpi"><span>{heads.length > 1 ? 'Trưởng đơn vị' : units[0]?.type === 'exec' ? 'Lãnh đạo khối' : 'Trưởng phòng'}</span><b className="name">{heads.map(h => h.name).join(', ') || 'Chưa bổ nhiệm'}</b></div>
        <div className="ds-card ds-kpi"><span>Thâm niên trung bình</span><b>{avgYears.toFixed(1).replace('.', ',')} năm</b></div>
        <div className="ds-card ds-kpi"><span>Cơ cấu cấp bậc</span><div className="ds-levels">{byLevel.map(x => <em key={x.l}>{x.l} · {x.n}</em>)}</div></div>
      </div>

      <div className="ds-card ds-section">
        <div className="ds-section-head">
          <h3>Cơ cấu tổ chức</h3>
          <span>Theo quan hệ báo cáo trong hồ sơ HR{certs ? ` · ${certs} chứng chỉ chuyên môn` : ''}</span>
        </div>
        <div className="ds-tree">
          <ul>
            {boss ? (
              <li>
                <div className="ds-node up">
                  <Avatar e={boss} size={28} />
                  <div><b>{boss.name}</b><span>{boss.position}</span><em>Cấp trên · {parent.label}</em></div>
                </div>
                <ul>{units.map(unitBranch)}</ul>
              </li>
            ) : units.map(unitBranch)}
          </ul>
        </div>
      </div>

      <div className="ds-card ds-section">
        <div className="ds-section-head">
          <h3>Danh sách nhân sự</h3>
          <label className="ds-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input placeholder="Tìm theo tên, chức danh, mã NV…" value={q} onChange={e => setQ(e.target.value)} />
          </label>
        </div>
        <div className="ds-table">
          <div className="ds-row head"><span>Nhân sự</span><span>Chức danh{multiUnit ? ' · đơn vị' : ''}</span><span>Cấp bậc</span><span>Ngày vào · thâm niên</span><span>Hợp đồng</span><span>Chứng chỉ</span><span>Liên hệ</span></div>
          {rows.length === 0 && <div className="ds-empty-row">Không có nhân sự phù hợp</div>}
          {rows.map(e => (
            <div key={e.id} className="ds-row" onClick={openHR} title="Xem hồ sơ đầy đủ trong HR">
              <span className="ds-person"><Avatar e={e} size={30} /><span><b>{e.name}</b><em className="ds-mono">{e.code}{isHead(e) ? ' · Trưởng đơn vị' : ''}</em></span></span>
              <span>{e.position}{multiUnit && <em className="ds-sub">{unitOf(e.dept)?.label}</em>}</span>
              <span><span className="ds-pill level">{e.level}</span></span>
              <span className="ds-mono">{fmtDate(e.joinDate)} · {tenure(e.joinDate)}</span>
              <span><span className={`ds-pill status ${e.status}`}>{STATUS_LABEL[e.status] || e.status}</span><em className="ds-sub">{e.contract}</em></span>
              <span className="ds-certs">{(e.certificates || []).length ? e.certificates.map(c => <em key={c.name} title={`${c.name} — ${c.issuer}`}>{c.name}</em>) : <em>—</em>}</span>
              <span className="ds-contact"><span className="ds-mono">{e.phone}</span><em>{e.email}</em></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
