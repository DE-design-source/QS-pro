import { useState } from 'react'
import { TASK_PROJECTS, shortDate } from '../../../data/banLamViecData'

/* Modal "Thêm việc hàng ngày". Luôn được mount nên giữ lại dự án / hạn / độ ưu tiên
   giữa các lần mở như bản HTML; chỉ ô nội dung bị xoá sau khi thêm. */
export default function AddTaskModal({ open, onClose, onAdd }) {
  const [title, setTitle] = useState('')
  const [project, setProject] = useState(TASK_PROJECTS[0])
  const [due, setDue] = useState('2026-09-26')
  const [prio, setPrio] = useState('med')

  function submit() {
    const t = title.trim()
    if (!t) { alert('Vui lòng nhập tiêu đề task.'); return }
    const dueLabel = shortDate(due)
    onAdd({ title: t, meta: project + (dueLabel ? (' · Hạn ' + dueLabel) : ''), prio })
    setTitle('')
    onClose()
  }

  return (
    <div className={`blv-modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="blv-modal-box">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Thêm việc hàng ngày</h3>
        <div className="blv-modal-field">
          <label>Nội dung ghi chú</label>
          <input type="text" placeholder="VD: Gọi lại cho nhà cung cấp thép" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="blv-modal-field">
          <label>Liên quan tới (không bắt buộc)</label>
          <select value={project} onChange={e => setProject(e.target.value)}>
            {TASK_PROJECTS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="blv-modal-field">
          <label>Hạn chót (không bắt buộc)</label>
          <input type="date" value={due} onChange={e => setDue(e.target.value)} />
        </div>
        <div className="blv-modal-field">
          <label>Độ ưu tiên</label>
          <select value={prio} onChange={e => setPrio(e.target.value)}>
            <option value="high">Cao</option>
            <option value="med">Trung bình</option>
            <option value="low">Thấp</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button className="blv-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="blv-modal-btn submit" onClick={submit}>Thêm việc</button>
        </div>
      </div>
    </div>
  )
}
