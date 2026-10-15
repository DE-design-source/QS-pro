import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './ChamCong.css'
import './hr/hr.css'
import { useTheme } from '../../hooks/useTheme'
import Icon from '../../components/ui/Icon'
import {
  INITIAL_HR_EMPLOYEES, INITIAL_SHIFTS, TODAY_LOGS, INITIAL_HR_REQUESTS, HR_TODAY, initialSchedule, EMPTY_EMPLOYEE,
  INITIAL_ORG_UNITS, INITIAL_UNIT_HEADS, syncDepts,
} from '../../data/hrData'
import {
  ROLES, DEFAULT_PERMS, SECURITY_SETTINGS, INITIAL_AUDIT, DEFAULT_PAYROLL_CONFIG, INITIAL_ADJUSTMENTS,
  INITIAL_JOBS, INITIAL_JDS, INITIAL_CANDIDATES, INITIAL_INTERVIEWS, INITIAL_OKRS, INITIAL_REVIEWS, INITIAL_ENROLL,
} from '../../data/hrData2'
import EmployeesModule from './hr/EmployeesModule'
import EmployeeForm from './hr/EmployeeForm'
import OrgChart from './hr/OrgChart'
import AttendanceToday from './hr/AttendanceToday'
import ShiftSchedule from './hr/ShiftSchedule'
import LeaveRequests, { reqStatus } from './hr/LeaveRequests'
import MonthlySummary from './hr/MonthlySummary'
import PayrollModule from './hr/PayrollModule'
import RecruitModule from './hr/RecruitModule'
import PerformanceModule from './hr/PerformanceModule'
import SecurityModule from './hr/SecurityModule'
import { AccessContext, makeScope, NoAccess } from './hr/access'
import { Seg, useToast } from './hr/shared'
import HanhChinhTab from './components/HanhChinhTab'
import Dezbot, { loadAiPanelWidth } from './components/Dezbot'

/* Các phân hệ HR — perm: khoá quyền tương ứng trong ma trận phân quyền */
const MODULES = [
  { key: 'employees', label: 'Hồ sơ nhân sự', icon: 'users', perm: 'employees' },
  { key: 'org', label: 'Sơ đồ tổ chức', icon: 'sitemap' },
  { key: 'attendance', label: 'Chấm công & phép', icon: 'clock', perm: 'attendance' },
  { key: 'payroll', label: 'Lương & bảo hiểm', icon: 'wallet', perm: 'payroll' },
  { key: 'recruit', label: 'Tuyển dụng', icon: 'userPlus', perm: 'recruit' },
  { key: 'performance', label: 'Hiệu suất & đào tạo', icon: 'trending', perm: 'performance' },
  { key: 'security', label: 'Phân quyền & bảo mật', icon: 'shield', perm: 'security' },
  { key: 'admin', label: 'Hành chính', icon: 'building' },
]
const ATT_TABS = [
  { value: 'today', label: 'Bảng công hôm nay', icon: 'fingerprint' },
  { value: 'shifts', label: 'Ca & lịch làm việc', icon: 'calendar' },
  { value: 'requests', label: 'Đơn từ & phê duyệt', icon: 'checkCircle' },
  { value: 'monthly', label: 'Tổng hợp công & phép', icon: 'table' },
]

function initialModule() {
  const h = (window.location.hash || '').replace('#', '')
  return MODULES.some(m => m.key === h) ? h : 'employees'
}
/* Vai trò mặc định của từng người dùng: người được gán sẵn trong ROLES, trưởng phòng → manager, còn lại → employee */
function initialUserRoles(employees) {
  const map = {}
  employees.forEach(e => { map[e.id] = { role: e.level === 'Trưởng phòng' || e.level === 'Giám đốc' ? 'manager' : 'employee', branches: [] } })
  Object.entries(ROLES).forEach(([k, r]) => { map[r.userId] = { role: k, branches: [] } })
  map[20] = { role: 'hradmin', branches: [] } // Đặng Hữu Phúc — C&B
  return map
}
const nowLabel = () => '23/09/2026 · ' + new Date().toTimeString().slice(0, 5)

export default function ChamCong() {
  const { theme, toggleTheme } = useTheme()
  const [module, setModule] = useState(initialModule)
  const [attTab, setAttTab] = useState('today')
  const [toastNode, toast] = useToast()

  const [role, setRole] = useState('hradmin')
  const [security, setSecurity] = useState(() => ({ perms: DEFAULT_PERMS, userRoles: initialUserRoles(INITIAL_HR_EMPLOYEES), settings: SECURITY_SETTINGS, session: '30 phút' }))
  const [audit, setAudit] = useState(INITIAL_AUDIT)

  const [employees, setEmployees] = useState(INITIAL_HR_EMPLOYEES)
  const [units, setUnits] = useState(INITIAL_ORG_UNITS)
  const [heads, setHeads] = useState(INITIAL_UNIT_HEADS)
  // Thành viên kiêm nhiệm của HĐQT & các ban (không đổi phòng ban trong hồ sơ)
  const [extraMembers, setExtraMembers] = useState({ hdqt: [1, 22, 2], bod: [1, 22, 2, 3], bks: [3, 19], bcl: [1, 22, 23, 26] })
  syncDepts(units) // danh sách phòng ban dùng chung luôn khớp với cơ cấu đang thiết lập
  const [openEmp, setOpenEmp] = useState(null)
  const [form, setForm] = useState({ open: false, emp: null })
  const [shifts, setShifts] = useState(INITIAL_SHIFTS)
  const [schedule, setSchedule] = useState(() => initialSchedule(INITIAL_HR_EMPLOYEES))
  const [logs, setLogs] = useState(TODAY_LOGS)
  const [requests, setRequests] = useState(INITIAL_HR_REQUESTS)
  const [payroll, setPayroll] = useState({ config: DEFAULT_PAYROLL_CONFIG, adjustments: INITIAL_ADJUSTMENTS, runs: { '2026-08': { status: 'paid', sent: [] }, '2026-07': { status: 'paid', sent: [] } } })
  const [recruit, setRecruit] = useState({ jobs: INITIAL_JOBS, jds: INITIAL_JDS, candidates: INITIAL_CANDIDATES, interviews: INITIAL_INTERVIEWS })
  const [perf, setPerf] = useState({ okrs: INITIAL_OKRS, reviews: INITIAL_REVIEWS, enroll: INITIAL_ENROLL })

  const [aiOpen, setAiOpen] = useState(false)
  const [aiWidth, setAiWidth] = useState(loadAiPanelWidth)
  const [aiResizing, setAiResizing] = useState(false)

  useEffect(() => { history.replaceState(null, '', '#' + module) }, [module])

  /* ---------- Phân quyền ---------- */
  const user = employees.find(e => e.id === ROLES[role].userId) || employees[0]
  const log = useCallback((mod, action, target) => {
    setAudit(prev => [{ id: Date.now() + Math.random(), time: nowLabel(), user: user.name, role, module: mod, action, target, ip: '10.0.1.' + (user.id + 20) }, ...prev])
  }, [user, role])
  const access = useMemo(() => {
    const perms = security.perms[role] || {}
    const scope = ROLES[role].scope
    return {
      role, user, log,
      can: (mod, action) => (perms[mod] || []).includes(action),
      inScope: makeScope(scope, user),
    }
  }, [security.perms, role, user, log])
  const scoped = employees.filter(access.inScope)

  function switchRole(r) {
    setRole(r)
    const u = employees.find(e => e.id === ROLES[r].userId)
    setOpenEmp(r === 'employee' ? u.id : null)
    setAudit(prev => [{ id: Date.now(), time: nowLabel(), user: u.name, role: r, module: 'auth', action: 'login', target: `Đăng nhập với vai trò ${ROLES[r].label} (2FA: ${security.settings.require2fa.value && ['sysadmin', 'hradmin'].includes(r) ? 'đã xác thực' : 'không yêu cầu'})`, ip: '10.0.1.' + (u.id + 20) }, ...prev])
    toast(`Đang xem với vai trò ${ROLES[r].label} — ${u.name}`)
  }

  const pending = requests.filter(r => reqStatus(r) === 'pending' && scoped.some(e => e.id === r.empId)).length

  /* ---------- CRUD hồ sơ ---------- */
  function saveEmployee(data) {
    if (data.id) {
      setEmployees(prev => prev.map(e => (e.id === data.id ? data : e)))
      log('employees', 'edit', `Hồ sơ ${data.name}`)
      toast(`Đã cập nhật hồ sơ ${data.name}`)
    } else {
      const id = Math.max(...employees.map(e => e.id)) + 1
      const rec = {
        ...data, id,
        contracts: data.contracts.length ? data.contracts : [{ no: `HĐ-${data.code}`, type: data.contractType, start: data.joinDate, end: null, salary: data.salary || 0, status: 'active' }],
        promotions: [{ date: data.joinDate, note: 'Gia nhập — ' + data.position }],
      }
      setEmployees(prev => [...prev, rec])
      setSchedule(prev => ({ ...prev, [id]: ['HC', 'HC', 'HC', 'HC', 'HC', 'off', 'off'] }))
      setSecurity(s => ({ ...s, userRoles: { ...s.userRoles, [id]: { role: 'employee', branches: [] } } }))
      setOpenEmp(id)
      log('employees', 'create', `Hồ sơ ${data.name} (${data.code})`)
      toast(`Đã tạo hồ sơ ${data.name}`)
    }
    setForm({ open: false, emp: null })
  }
  function deleteEmployee(emp) {
    const reports = employees.filter(e => e.managerId === emp.id)
    if (!confirm(`Xoá vĩnh viễn hồ sơ ${emp.name}?${reports.length ? `\n${reports.length} nhân sự cấp dưới sẽ được chuyển cho quản lý cấp trên.` : ''}\nNên dùng "Cho nghỉ việc" nếu cần giữ lại lịch sử.`)) return
    setEmployees(prev => prev.filter(e => e.id !== emp.id).map(e => (e.managerId === emp.id ? { ...e, managerId: emp.managerId } : e)))
    if (openEmp === emp.id) setOpenEmp(null)
    log('employees', 'delete', `Hồ sơ ${emp.name} (${emp.code})`)
    toast(`Đã xoá hồ sơ ${emp.name}`, 'danger')
  }
  function offboard(emp) {
    const d = prompt(`Ngày nghỉ việc của ${emp.name} (YYYY-MM-DD):`, HR_TODAY)
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return
    setEmployees(prev => prev.map(e => {
      if (e.id === emp.id) return { ...e, status: 'left', leaveDate: d, contracts: e.contracts.map(c => (c.status === 'active' ? { ...c, status: 'expired', end: c.end || d } : c)), promotions: [...e.promotions, { date: d, note: 'Nghỉ việc' }] }
      return e.managerId === emp.id ? { ...e, managerId: emp.managerId } : e
    }))
    log('employees', 'edit', `Cho nghỉ việc ${emp.name} từ ${d}`)
    toast(`${emp.name} đã được chuyển sang "Đã nghỉ việc"`)
  }
  /* ---------- Thiết lập cơ cấu tổ chức ---------- */
  function saveUnit(data, origKey, headId) {
    const { _orig, headId: _h, ...unit } = data
    setUnits(prev => (origKey ? prev.map(u => (u.key === origKey ? unit : u)) : [...prev, unit]))
    setHeads(prev => ({ ...prev, [unit.key]: headId }))
    log('employees', origKey ? 'edit' : 'create', `Cơ cấu tổ chức: ${origKey ? 'cập nhật' : 'thêm'} đơn vị "${unit.label}"`)
    toast(origKey ? `Đã cập nhật ${unit.label}` : `Đã thêm ${unit.label} vào cơ cấu tổ chức`)
  }
  function deleteUnit(unit, memberCount, childCount) {
    if (memberCount || childCount) { toast(`Không thể xoá: ${unit.label} còn ${memberCount} nhân sự, ${childCount} đơn vị trực thuộc`, 'danger'); return }
    if (!confirm(`Xoá đơn vị "${unit.label}" khỏi cơ cấu tổ chức?`)) return
    setUnits(prev => prev.filter(u => u.key !== unit.key))
    log('employees', 'delete', `Cơ cấu tổ chức: xoá đơn vị "${unit.label}"`)
    toast(`Đã xoá ${unit.label}`, 'danger')
  }

  function assignMembers(unit, ids) {
    const names = ids.map(id => employees.find(e => e.id === id)?.name).filter(Boolean)
    if (['board', 'governance'].includes(unit.type)) {
      setExtraMembers(prev => ({ ...prev, [unit.key]: [...new Set([...(prev[unit.key] || []), ...ids])] }))
    } else {
      const head = heads[unit.key]
      // Không gán trưởng đơn vị làm quản lý nếu người đó là cấp trên (trực tiếp/gián tiếp) của trưởng đơn vị — tránh vòng lặp
      const reportsTo = (id, boss) => { for (let cur = employees.find(x => x.id === id), n = 0; cur && n < 50; cur = employees.find(x => x.id === cur.managerId), n++) if (cur.managerId === boss) return true; return false }
      setEmployees(prev => prev.map(e => (ids.includes(e.id) ? { ...e, dept: unit.key, managerId: head && head !== e.id && !reportsTo(head, e.id) ? head : e.managerId, promotions: [...e.promotions, { date: HR_TODAY, note: `Điều chuyển sang ${unit.name}` }] } : e)))
    }
    log('employees', 'edit', `${unit.label}: thêm ${names.join(', ')}`)
    toast(`Đã thêm ${names.length} nhân sự vào ${unit.label}`)
  }
  function removeExtra(unit, emp) {
    setExtraMembers(prev => ({ ...prev, [unit.key]: (prev[unit.key] || []).filter(id => id !== emp.id) }))
    log('employees', 'edit', `${unit.label}: gỡ ${emp.name}`)
    toast(`Đã gỡ ${emp.name} khỏi ${unit.label}`)
  }

  /* Ứng viên trúng tuyển → hồ sơ nhân viên thử việc */
  function hireCandidate(c, job) {
    const id = Math.max(...employees.map(e => e.id)) + 1
    const code = 'NV' + String(Math.max(...employees.map(e => Number(e.code.slice(2)) || 0)) + 1).padStart(3, '0')
    const manager = employees.find(e => e.dept === job.dept && ['Trưởng phòng', 'Giám đốc'].includes(e.level))
    const salary = (Number((job.salary.match(/\d+/) || [12])[0]) || 12) * 1000000
    const rec = {
      ...JSON.parse(JSON.stringify(EMPTY_EMPLOYEE)), id, code, name: c.name, email: c.email, phone: c.phone, dept: job.dept, position: job.title,
      site: job.site, joinDate: '2026-10-01', status: 'probation', contractType: 'Thử việc', salary, managerId: manager?.id ?? null,
      contracts: [{ no: `HĐTV-${code}`, type: 'Thử việc', start: '2026-10-01', end: '2026-12-01', salary: Math.round(salary * 0.85), status: 'active' }],
      promotions: [{ date: '2026-10-01', note: `Gia nhập — ${job.title} (tuyển dụng từ ${c.source})` }],
      attachments: [{ name: c.cv }],
    }
    setEmployees(prev => [...prev, rec])
    setSchedule(prev => ({ ...prev, [id]: job.site === 'Văn phòng HCM' ? ['HC', 'HC', 'HC', 'HC', 'HC', 'off', 'off'] : ['CT', 'CT', 'CT', 'CT', 'CT', 'CT', 'off'] }))
    setSecurity(s => ({ ...s, userRoles: { ...s.userRoles, [id]: { role: 'employee', branches: [] } } }))
    setPerf(p => ({ ...p, enroll: { ...p.enroll, [id]: { 4: 0, ...(job.dept === 'thicong' ? { 1: 0 } : {}) } } }))
    log('recruit', 'approve', `Trúng tuyển ${c.name} → tạo hồ sơ ${code} (thử việc từ 01/10/2026)`)
    toast(`Đã tạo hồ sơ ${code} cho ${c.name} & ghi danh khoá hội nhập`)
    setOpenEmp(id)
    setModule('employees')
  }

  const current = MODULES.find(m => m.key === module)
  const allowed = m => !m.perm || access.can(m.perm, 'view')

  return (
    <AccessContext.Provider value={access}>
      <div
        className={`cc-page${aiOpen ? ' cc-ai-open' : ''}${aiResizing ? ' cc-ai-resizing' : ''}`}
        style={{ '--ai-panel-width': `${aiWidth}px` }}
      >
        <div className="cc-header">
          <div className="cc-header-icon"><Icon name="users" size={16} /></div>
          <span className="cc-header-title">Nhân sự (HR)</span>
          <span className="cc-header-sub">Hồ sơ, tổ chức, chấm công, lương, tuyển dụng, hiệu suất</span>
          <span style={{ flex: 1 }} />
          <label className={`cc-role-switch cc-tone-${ROLES[role].tone}`} title="Mô phỏng đăng nhập với vai trò khác">
            <Icon name="shield" size={14} />
            <span className="cc-role-who">{user.name}</span>
            <select value={role} onChange={e => switchRole(e.target.value)} aria-label="Vai trò">
              {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
            </select>
          </label>
          <Link to="/cham-cong-mobile" className="cc-mobile-link"><Icon name="smartphone" size={13} />Mobile</Link>
          <button className="cc-theme-toggle" title="Chuyển giao diện sáng/tối" onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
        </div>

        <nav className="cc-modnav" aria-label="Phân hệ HR">
          {MODULES.map(m => (
            <button key={m.key} className={`cc-mod${module === m.key ? ' active' : ''}${allowed(m) ? '' : ' locked'}`} onClick={() => setModule(m.key)} title={allowed(m) ? '' : 'Vai trò hiện tại không có quyền'}>
              <Icon name={allowed(m) ? m.icon : 'lock'} size={15} />{m.label}
              {m.key === 'attendance' && pending > 0 && access.can('attendance', 'approve') && <span className="cc-mod-badge">{pending}</span>}
            </button>
          ))}
        </nav>

        <div className="cc-body">
          {current.perm && !allowed(current) ? <NoAccess /> : <>
            {module === 'employees' && (
              <EmployeesModule
                employees={scoped} openId={openEmp} onOpen={setOpenEmp}
                onAdd={() => setForm({ open: true, emp: null })} onEdit={emp => setForm({ open: true, emp })}
                onDelete={deleteEmployee} onOffboard={offboard}
              />
            )}
            {module === 'org' && <OrgChart employees={employees} units={units} heads={heads} extraMembers={extraMembers} onSaveUnit={saveUnit} onDeleteUnit={deleteUnit} onAssign={assignMembers} onRemoveExtra={removeExtra} onOpen={id => { if (access.inScope(employees.find(e => e.id === id))) { setOpenEmp(id); setModule('employees') } else toast('Bạn chỉ xem được hồ sơ trong phạm vi được phân quyền', 'danger') }} />}
            {module === 'attendance' && (
              <div className="cc-stack">
                <Seg value={attTab} onChange={setAttTab} options={ATT_TABS.map(t => (t.value === 'requests' ? { ...t, count: pending || undefined } : t))} />
                {attTab === 'today' && <AttendanceToday employees={scoped} logs={logs} setLogs={setLogs} shifts={shifts} schedule={schedule} toast={toast} meId={user.id} />}
                {attTab === 'shifts' && <ShiftSchedule employees={scoped} shifts={shifts} setShifts={setShifts} schedule={schedule} setSchedule={setSchedule} toast={toast} />}
                {attTab === 'requests' && <LeaveRequests employees={scoped} requests={requests} setRequests={setRequests} toast={toast} />}
                {attTab === 'monthly' && <MonthlySummary employees={scoped} toast={toast} />}
              </div>
            )}
            {module === 'payroll' && <PayrollModule employees={scoped} payroll={payroll} setPayroll={setPayroll} toast={toast} maskDefault={security.settings.maskSalary.value} />}
            {module === 'recruit' && <RecruitModule recruit={recruit} setRecruit={setRecruit} onHire={hireCandidate} toast={toast} />}
            {module === 'performance' && <PerformanceModule employees={employees} perf={perf} setPerf={setPerf} toast={toast} />}
            {module === 'security' && <SecurityModule employees={employees} security={security} setSecurity={setSecurity} audit={audit} toast={toast} />}
            {module === 'admin' && <div className="cc-legacy"><HanhChinhTab /></div>}
          </>}
        </div>

        <EmployeeForm open={form.open} employee={form.emp} employees={employees} onClose={() => setForm({ open: false, emp: null })} onSave={saveEmployee} />
        {toastNode}

        <Dezbot
          open={aiOpen}
          onToggle={() => setAiOpen(o => !o)}
          onClose={() => setAiOpen(false)}
          onResize={setAiWidth}
          onResizingChange={setAiResizing}
        />
      </div>
    </AccessContext.Provider>
  )
}
