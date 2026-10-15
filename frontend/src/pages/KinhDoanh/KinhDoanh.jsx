import { useRef, useState } from 'react'
import './KinhDoanh.css'
import { useTheme } from '../../hooks/useTheme'
import {
  LEADS, SALES_TABS, SYNC_STAGES, HANDOFF_CONFIG, KD_STEPS, KD_WALLET_INITIAL, KD_CURRENT_USER, KD_MANAGER, DEPT_LABEL,
  DESIGN_STAGES, DESIGN_LABEL, DESIGN_COLOR, CONSTRUCTION_STAGES, CONSTRUCTION_LABEL, CONSTRUCTION_COLOR,
} from '../../data/kinhDoanhData'
import { fmtTy, matchesTimeFilter, pushSyncedProject, removeSyncedProject } from './utils'
import { addKdRequest } from '../../services/kdRequestService'
import OverviewTab from './components/OverviewTab'
import PipelineTab from './components/PipelineTab'
import SubBoard from './components/SubBoard'
import TasksTab from './components/TasksTab'
import LeadModal from './components/LeadModal'
import LeadDetailModal from './components/LeadDetailModal'
import HandoffModal from './components/HandoffModal'
import TaskModal from './components/TaskModal'
import Dezbot, { loadAiPanelWidth } from './components/Dezbot'

const hintStyle = { fontSize: 11.5, color: 'var(--text-muted)' }

export default function KinhDoanh() {
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab] = useState('overview')

  /* ---------- Dữ liệu pipeline ---------- */
  const [leads, setLeads] = useState(() => LEADS.map(l => ({ ...l })))
  const leadCounter = useRef(LEADS.length + 1)
  const [dept, setDept] = useState('all')
  const [timeFilter, setTimeFilter] = useState({ time: 'all', from: '', to: '' })

  /* ---------- Modal ---------- */
  const [leadModal, setLeadModal] = useState({ open: false, id: null, seq: 0 })
  const [detail, setDetail] = useState({ open: false, id: null })
  const [handoff, setHandoff] = useState({ open: false, leadId: null, stageKey: null, seq: 0 })
  const [taskModal, setTaskModal] = useState({ open: false, seq: 0 })

  /* ---------- Nhiệm vụ & điểm thưởng ---------- */
  const [steps, setSteps] = useState(() => KD_STEPS.map(s => ({ ...s, subtasks: s.subtasks.map(x => ({ ...x })) })))
  const [wallet, setWallet] = useState(KD_WALLET_INITIAL)

  /* ---------- Dezbot ---------- */
  const [aiOpen, setAiOpen] = useState(false)
  const [aiWidth, setAiWidth] = useState(loadAiPanelWidth)
  const [aiResizing, setAiResizing] = useState(false)

  const scrollRef = useRef(null)

  const filteredLeads = leads.filter(l => (dept === 'all' || l.dept === dept) && matchesTimeFilter(l, timeFilter))
  const patchLead = (id, fn) => setLeads(prev => prev.map(l => (l.id === id ? fn(l) : l)))
  const syncLead = lead => {
    if (SYNC_STAGES.indexOf(lead.stage) !== -1) pushSyncedProject(lead)
    else removeSyncedProject(lead.id)
  }

  /* ---------- Chuyển giai đoạn (moveLead) ---------- */
  function moveLead(id, newStage) {
    const lead = leads.find(l => l.id === id)
    if (!lead || lead.stage === newStage) return
    patchLead(id, l => ({ ...l, stage: newStage }))
    syncLead({ ...lead, stage: newStage })
    const cfg = HANDOFF_CONFIG[newStage]
    /* Cột nào có cấu hình phiếu thì kéo thẻ vào (từ bất kỳ cột nào) đều hiện phiếu */
    if (cfg) setHandoff(h => ({ open: true, leadId: id, stageKey: newStage, seq: h.seq + 1 }))
  }

  function deleteLead(id) {
    const lead = leads.find(l => l.id === id)
    if (!lead) return
    if (!window.confirm('Xoá lead "' + lead.name + '"? Hành động này không thể hoàn tác.')) return
    setLeads(prev => prev.filter(l => l.id !== id))
    removeSyncedProject(id)
  }

  /* ---------- Modal thêm / sửa lead ---------- */
  const openLeadModal = id => setLeadModal(m => ({ open: true, id: id || null, seq: m.seq + 1 }))
  const closeLeadModal = () => setLeadModal(m => ({ ...m, open: false }))
  function saveLead(data) {
    const editing = leadModal.id ? leads.find(l => l.id === leadModal.id) : null
    if (editing) {
      const merged = { ...editing, ...data }
      patchLead(editing.id, () => merged)
      syncLead(merged)
    } else if (!leadModal.id) {
      const created = { ...data, id: 'lnew' + (leadCounter.current++), createdAt: new Date().toISOString().slice(0, 10) }
      setLeads(prev => [...prev, created])
      if (SYNC_STAGES.indexOf(created.stage) !== -1) pushSyncedProject(created)
    }
    closeLeadModal()
  }

  /* ---------- Người phụ trách trên thẻ kanban ---------- */
  const addAssignee = (id, person) => patchLead(id, l => ({ ...l, assignees: [...(l.assignees || []), person] }))
  const removeAssignee = (id, idx) => patchLead(id, l => ({ ...l, assignees: (l.assignees || []).filter((_, i) => i !== idx) }))

  /* ---------- Phiếu bàn giao / yêu cầu báo giá ---------- */
  const closeHandoff = () => setHandoff(h => ({ ...h, open: false, leadId: null, stageKey: h.stageKey }))
  function sendHandoff(dt, assigneeName, pickedDept) {
    const cfg = HANDOFF_CONFIG[handoff.stageKey]
    if (!handoff.leadId || !cfg) return
    /* Phiếu cho chọn phòng nhận (deptOptions) thì dùng phòng đã chọn */
    const dept = pickedDept || cfg.dept
    const role = cfg.role.replace('{dept}', dept)
    /* Gửi phiếu sang Chat (SiteFlow Bot) để phòng nhận xác nhận → điều phối → duyệt */
    const lead = leads.find(l => l.id === handoff.leadId)
    if (lead) {
      addKdRequest({
        leadId: lead.id, leadName: lead.name, leadInfo: `${lead.type} · ${fmtTy(lead.value)}`,
        stageKey: handoff.stageKey, title: cfg.title, dept, role,
        sender: KD_CURRENT_USER, senderDept: DEPT_LABEL[lead.dept] || '',
        requestedAt: dt || null, suggestedAssignee: assigneeName || null,
      })
    }
    patchLead(handoff.leadId, l => ({
      ...l,
      handoff: { status: cfg.pendingStatus, dept, requestedAt: dt || null, assignee: assigneeName || null },
      ...(assigneeName ? { assignees: [...(l.assignees || []), { name: assigneeName, role }] } : null),
    }))
    closeHandoff()
  }
  function selfQuote() {
    const cfg = HANDOFF_CONFIG[handoff.stageKey]
    if (!handoff.leadId || !cfg || !cfg.selfStatus) return
    patchLead(handoff.leadId, l => ({ ...l, handoff: { status: cfg.selfStatus, dept: cfg.dept, requestedAt: null, assignee: null } }))
    closeHandoff()
  }

  /* ---------- Bảng con Thiết kế / Thi công ---------- */
  const setLeadSub = (id, sub) => patchLead(id, l => ({ ...l, sub }))
  function addSubCard(name, parentStage, sub) {
    setLeads(prev => [...prev, { id: 'lnew' + (leadCounter.current++), name, type: 'Chưa xác định', value: 0, stage: parentStage, sub, dept: 'dan-dung', creator: KD_CURRENT_USER, manager: KD_MANAGER, createdAt: new Date().toISOString().slice(0, 10) }])
  }

  /* ---------- Nhiệm vụ ---------- */
  function checkSubtask(stepIdx, subIdx) {
    setSteps(prev => {
      if (prev[stepIdx].subtasks[subIdx].done) return prev
      const next = prev.map(s => ({ ...s, subtasks: s.subtasks.map(x => ({ ...x })) }))
      const step = next[stepIdx]
      step.subtasks[subIdx].done = true
      if (step.subtasks.every(s => s.done)) {
        step.status = 'done'
        if (next[stepIdx + 1] && next[stepIdx + 1].status === 'locked') next[stepIdx + 1].status = 'current'
      }
      return next
    })
  }
  function createTask({ stepIdx, text, who, pts }) {
    setSteps(prev => prev.map((s, i) => (i !== stepIdx ? s : {
      ...s,
      subtasks: [...s.subtasks, { text, who, pts, done: false }],
      status: s.status === 'done' ? 'current' : s.status,
    })))
    setTaskModal(m => ({ ...m, open: false }))
  }
  function redeem(cost) {
    if (cost > wallet) return
    setWallet(wallet - cost)
  }

  const panel = (name, gap) => ({ display: tab === name ? 'flex' : 'none', flexDirection: 'column', gap })
  const editingLead = leadModal.id ? leads.find(l => l.id === leadModal.id) || null : null
  const detailLead = detail.id ? leads.find(l => l.id === detail.id) || null : null
  const handoffLead = handoff.leadId ? leads.find(l => l.id === handoff.leadId) || null : null

  return (
    <div
      className={`kd-page${aiOpen ? ' kd-ai-open' : ''}${aiResizing ? ' kd-ai-resizing' : ''}`}
      style={{ '--ai-panel-width': `${aiWidth}px` }}
    >
      {/* ---------- Header ---------- */}
      <div style={{ height: 64, flex: 'none', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 28px', boxSizing: 'border-box', background: 'var(--surface)', gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--sales-tint)', color: 'var(--sales)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
        </div>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>Kinh doanh</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pipeline khách hàng — chốt hợp đồng sẽ tự tạo hồ sơ tại tab Dự án</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => openLeadModal(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', background: 'var(--sales)', color: '#fff', padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Thêm khách hàng tiềm năng
        </button>
        <button title="Chuyển giao diện sáng/tối" onClick={toggleTheme} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>}
        </button>
      </div>

      {/* ---------- Thanh tab ---------- */}
      <div style={{ height: 52, flex: 'none', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 28px', boxSizing: 'border-box', background: 'var(--surface)', gap: 4 }}>
        {SALES_TABS.map(([key, label]) => (
          <button key={key} className={`kd-sales-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Các tab luôn được mount (ẩn bằng display) để giữ trạng thái đang chọn, giống bản HTML */}
      <div ref={scrollRef} style={{ flex: 1, padding: '22px 28px', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden' }}>

        {/* ================= TAB: TỔNG QUAN ================= */}
        <div style={panel('overview', 16)}>
          <OverviewTab allLeads={leads} leads={filteredLeads} dept={dept} onDeptChange={setDept} timeFilter={timeFilter} onTimeFilterChange={setTimeFilter} />
        </div>

        {/* ================= TAB: PIPELINE ================= */}
        <div style={panel('pipeline', 14)}>
          <PipelineTab
            leads={filteredLeads} dept={dept} onDeptChange={setDept} timeFilter={timeFilter} onTimeFilterChange={setTimeFilter}
            scrollRef={scrollRef} onMove={moveLead} onDelete={deleteLead}
            onOpenDetail={id => setDetail({ open: true, id })}
            onAddAssignee={addAssignee} onRemoveAssignee={removeAssignee}
          />
        </div>

        {/* ================= TAB: DỰ ÁN (THIẾT KẾ) ================= */}
        <div style={panel('design-board', 14)}>
          <div style={hintStyle}>Bảng Kanban kiểu Lark Base — kéo thả thẻ giữa các cột, hoặc bấm "+ Thêm thẻ" ở cuối mỗi cột để tạo nhanh.</div>
          <SubBoard leads={leads} parentStage="thiet-ke" subStages={DESIGN_STAGES} subLabel={DESIGN_LABEL} subColor={DESIGN_COLOR} onSetSub={setLeadSub} onAddCard={addSubCard} />
        </div>

        {/* ================= TAB: DỰ ÁN (THI CÔNG) ================= */}
        <div style={panel('construction-board', 14)}>
          <div style={hintStyle}>Bảng Kanban kiểu Lark Task — kéo thả thẻ giữa các cột, hoặc bấm "+ Thêm thẻ" ở cuối mỗi cột để tạo nhanh.</div>
          <SubBoard leads={leads} parentStage="thi-cong" subStages={CONSTRUCTION_STAGES} subLabel={CONSTRUCTION_LABEL} subColor={CONSTRUCTION_COLOR} onSetSub={setLeadSub} onAddCard={addSubCard} />
        </div>

        {/* ================= TAB: NHIỆM VỤ & ĐIỂM THƯỞNG ================= */}
        <div style={panel('tasks', 16)}>
          <TasksTab steps={steps} onCheckSubtask={checkSubtask} wallet={wallet} onRedeem={redeem} onOpenCreateTask={() => setTaskModal(m => ({ open: true, seq: m.seq + 1 }))} />
        </div>
      </div>

      {/* ---------- Modal (render bên trong .kd-page để dùng chung biến màu) ---------- */}
      <LeadModal key={`lead-${leadModal.seq}`} open={leadModal.open} lead={editingLead} onClose={closeLeadModal} onSave={saveLead} />
      <LeadDetailModal
        open={detail.open} lead={detailLead}
        onClose={() => setDetail(d => ({ ...d, open: false }))}
        onEdit={() => { const id = detail.id; setDetail(d => ({ ...d, open: false })); openLeadModal(id) }}
      />
      <HandoffModal key={`handoff-${handoff.seq}`} open={handoff.open} lead={handoffLead} stageKey={handoff.stageKey} onClose={closeHandoff} onSend={sendHandoff} onSelf={selfQuote} />
      <TaskModal key={`task-${taskModal.seq}`} open={taskModal.open} steps={steps} onClose={() => setTaskModal(m => ({ ...m, open: false }))} onSubmit={createTask} />

      <Dezbot
        open={aiOpen}
        onToggle={() => setAiOpen(o => !o)}
        onClose={() => setAiOpen(false)}
        onResize={setAiWidth}
        onResizingChange={setAiResizing}
      />
    </div>
  )
}
