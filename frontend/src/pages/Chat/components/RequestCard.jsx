import { useState } from 'react'
import { COMPANY_DIRECTORY } from '../../../data/chatData'

/* Thẻ phiếu yêu cầu từ trang Kinh doanh (hiện trong hội thoại SiteFlow Bot).
   Luồng: xác nhận (Đồng ý / Từ chối + lý do) → điều phối cho quản lý hoặc nhân viên
   → người được giao gửi yêu cầu duyệt (hoặc từ chối + lý do) → quản lý duyệt. */

/* Tên phòng nhận phiếu (HANDOFF_CONFIG.dept) → tên phòng trong danh bạ công ty */
const DIRECTORY_DEPT = { 'Thiết kế': 'Thiết kế', QS: 'QS - Dự toán', 'Thi công': 'Thi công' }

const STATUS = {
  pending: { label: 'Chờ xác nhận', tone: 'wait' },
  dispatch: { label: 'Chờ điều phối', tone: 'wait' },
  assigned: { label: 'Đã điều phối', tone: 'wait' },
  review: { label: 'Chờ quản lý duyệt', tone: 'wait' },
  approved: { label: 'Đã duyệt', tone: 'ok' },
  rejected: { label: 'Đã từ chối', tone: 'no' },
}

const fmtDateTime = iso => new Date(iso).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtShort = iso => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function RequestCard({ req, onUpdate }) {
  /* Ô đang mở trong thẻ: null | 'reject' (nhập lý do) */
  const [mode, setMode] = useState(null)
  const [reason, setReason] = useState('')
  const deptPeople = (COMPANY_DIRECTORY.find(d => d.dept === DIRECTORY_DEPT[req.dept]) || { people: [] }).people
  const [person, setPerson] = useState(deptPeople.length ? deptPeople[0].name : COMPANY_DIRECTORY[0].people[0].name)

  const st = STATUS[req.status] || STATUS.pending

  /* Ghi bước mới vào lịch sử rồi đổi trạng thái */
  function advance(patch, text) {
    onUpdate(req.id, { ...patch, history: [...req.history, { at: new Date().toISOString(), text }] })
    setMode(null); setReason('')
  }

  function reject() {
    const r = reason.trim()
    if (!r) return
    const by = req.status === 'pending' ? `Phòng ${req.dept} từ chối tiếp nhận`
      : req.status === 'assigned' ? `${req.assignee.name} từ chối nhận việc`
        : 'Quản lý không duyệt'
    advance({ status: 'rejected', rejectReason: r }, `${by} — Lý do: ${r}`)
  }

  function dispatch() {
    const found = COMPANY_DIRECTORY.flatMap(d => d.people).find(p => p.name === person)
    if (!found) return
    advance({ status: 'assigned', assignee: { name: found.name, role: found.role } }, `Điều phối cho ${found.name} (${found.role})`)
  }

  const rejectLabel = req.status === 'review' ? 'Không duyệt' : 'Từ chối'

  return (
    <div className={'ch-req-wrap t-' + req.stageKey}>
      <div className="ch-req-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
      </div>
      <div className="ch-req-card">
        <div className="ch-req-head">
          <span>{req.title} — {req.leadName}</span>
          <span className={'ch-req-status ' + st.tone}>{st.label}</span>
        </div>
        <div className="ch-req-body">
          <div className="ch-req-text">
            {req.sender} gửi {req.title.toLowerCase()} cho khách hàng <strong>{req.leadName}</strong> ({req.leadInfo}) đến Phòng {req.dept}.
            {req.requestedAt ? <> Ngày giờ hẹn dự kiến: <strong>{fmtDateTime(req.requestedAt)}</strong>.</> : null}
            {req.suggestedAssignee ? <> Người phụ trách đề xuất: <strong>{req.suggestedAssignee}</strong>.</> : null}
          </div>

          <div className="ch-req-field"><strong>Người gửi:</strong><span>{req.sender}{req.senderDept ? ` — ${req.senderDept}` : ''}</span></div>
          <div className="ch-req-field"><strong>Thời gian:</strong><span>{fmtDateTime(req.createdAt)}</span></div>
          {req.assignee ? <div className="ch-req-field"><strong>Người được điều phối:</strong><span>{req.assignee.name} — {req.assignee.role}</span></div> : null}
          {req.status === 'rejected' ? <div className="ch-req-reason"><strong>Lý do từ chối:</strong> {req.rejectReason}</div> : null}

          {req.history.length > 1 ? (
            <div className="ch-req-history">
              {req.history.map((h, i) => <div key={i}><span>{fmtShort(h.at)}</span>{h.text}</div>)}
            </div>
          ) : null}

          {/* ---- Ô nhập lý do từ chối ---- */}
          {mode === 'reject' ? (
            <div className="ch-req-form">
              <textarea rows={2} autoFocus placeholder="Nhập lý do..." value={reason} onChange={e => setReason(e.target.value)} />
              <div className="ch-req-actions">
                <button type="button" className="ch-req-btn" onClick={() => { setMode(null); setReason('') }}>Huỷ</button>
                <button type="button" className="ch-req-btn no" disabled={!reason.trim()} onClick={reject}>Xác nhận {rejectLabel.toLowerCase()}</button>
              </div>
            </div>
          ) : null}

          {/* ---- Bước 1: phòng nhận xác nhận ---- */}
          {mode === null && req.status === 'pending' ? (
            <div className="ch-req-actions">
              <button type="button" className="ch-req-btn ok" onClick={() => advance({ status: 'dispatch' }, `Phòng ${req.dept} đồng ý tiếp nhận`)}>Đồng ý</button>
              <button type="button" className="ch-req-btn" onClick={() => setMode('reject')}>Từ chối</button>
            </div>
          ) : null}

          {/* ---- Bước 2: điều phối cho quản lý / nhân viên ---- */}
          {mode === null && req.status === 'dispatch' ? (
            <div className="ch-req-form">
              <label>Điều phối đến quản lý hoặc nhân viên</label>
              <select value={person} onChange={e => setPerson(e.target.value)}>
                {COMPANY_DIRECTORY.map(d => (
                  <optgroup key={d.dept} label={d.dept}>
                    {d.people.map(p => <option key={p.name} value={p.name}>{p.name} — {p.role}</option>)}
                  </optgroup>
                ))}
              </select>
              <div className="ch-req-actions">
                <button type="button" className="ch-req-btn ok" onClick={dispatch}>Điều phối</button>
              </div>
            </div>
          ) : null}

          {/* ---- Bước 3: người được giao gửi yêu cầu duyệt ---- */}
          {mode === null && req.status === 'assigned' ? (
            <div className="ch-req-actions">
              <button type="button" className="ch-req-btn ok" onClick={() => advance({ status: 'review' }, `${req.assignee.name} nhận việc và gửi yêu cầu duyệt`)}>Nhận việc &amp; gửi yêu cầu duyệt</button>
              <button type="button" className="ch-req-btn" onClick={() => setMode('reject')}>Từ chối</button>
            </div>
          ) : null}

          {/* ---- Bước 4: quản lý duyệt ---- */}
          {mode === null && req.status === 'review' ? (
            <div className="ch-req-actions">
              <button type="button" className="ch-req-btn ok" onClick={() => advance({ status: 'approved' }, 'Quản lý đã duyệt')}>Duyệt</button>
              <button type="button" className="ch-req-btn" onClick={() => setMode('reject')}>Không duyệt</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
