import { useState } from 'react'
import { HANDOFF_CONFIG, DEPT_LABEL } from '../../../data/kinhDoanhData'
import { FONT_STACK, fmtTy } from '../utils'

/* ===================== Modal: Thông báo bàn giao sang phòng ban (Phiếu yêu cầu báo giá / bàn giao) =====================
   Mount sẵn, ẩn bằng display; trang cha đổi `key` mỗi lần mở để 2 ô nhập trở về rỗng (openHandoffModal). */

export default function HandoffModal({ open, lead, stageKey, onClose, onSend, onSelf }) {
  const [dateTime, setDateTime] = useState('')
  const [assignee, setAssignee] = useState('')
  /* Khi chưa mở lần nào: hiển thị nội dung tĩnh mặc định của bản HTML (phiếu yêu cầu báo giá) */
  const cfg = HANDOFF_CONFIG[stageKey] || HANDOFF_CONFIG['bao-gia']
  /* Phòng nhận phiếu: mặc định theo cấu hình, phiếu có deptOptions thì người gửi được chọn */
  const [dept, setDept] = useState(cfg.dept)
  const fill = text => text.replace('{dept}', dept)

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ display: open ? 'flex' : 'none', position: 'fixed', inset: 0, background: 'rgba(15,18,25,.5)', zIndex: 110, alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--surface)', width: 460, maxWidth: '92vw', borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: FONT_STACK, fontWeight: 800, fontSize: 16 }}>{cfg.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{fill(cfg.subtitle)}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flex: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface-alt)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{lead ? lead.name : ''}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead ? `${lead.type} · ${fmtTy(lead.value)} · ${DEPT_LABEL[lead.dept]}` : ''}</div>
          </div>
          {cfg.deptOptions ? (
            <div className="kd-field">
              <label>Phòng nhận yêu cầu</label>
              <select value={dept} onChange={e => setDept(e.target.value)}>
                {cfg.deptOptions.map(d => <option key={d} value={d}>Phòng {d}</option>)}
              </select>
            </div>
          ) : null}
          <div className="kd-field">
            <label>{cfg.dateLabel}</label>
            <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} />
          </div>
          <div className="kd-field">
            <label>{fill(cfg.assigneeLabel)}</label>
            <input type="text" placeholder={fill(cfg.assigneePlaceholder)} value={assignee} onChange={e => setAssignee(e.target.value)} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--primary-tint)', borderRadius: 8, padding: '9px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none' }}>ℹ</span>
            <span>{fill(cfg.note)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="kd-pjm-btn" onClick={onClose}>Huỷ</button>
            <button className="kd-pjm-btn primary" style={{ flex: 2 }} onClick={() => onSend(dateTime, assignee.trim(), dept)}>{fill(cfg.sendLabel)}</button>
          </div>
          <button onClick={onSelf} style={{ display: cfg.selfLabel ? 'block' : 'none', border: 'none', background: 'var(--success)', color: '#fff', fontSize: 12, fontWeight: 700, padding: 9, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>{cfg.selfLabel || 'Phòng KD tự đề xuất báo giá'}</button>
        </div>
      </div>
    </div>
  )
}
