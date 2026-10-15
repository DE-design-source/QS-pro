import { useEffect, useRef, useState } from 'react'

/* Modal "Tạo nhiệm vụ mới". Luôn được mount (bật/tắt bằng class .open);
   mỗi lần mở, trang cha đổi `key` để form về mặc định giống openCreateTaskModalM(). */
export default function CreateTaskModal({ open, steps, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [stepIdx, setStepIdx] = useState(() => {
    /* Mặc định chọn bước đang "current" (populateStepSelectM) */
    const cur = steps.findIndex(s => s.status === 'current')
    return String(cur >= 0 ? cur : 0)
  })
  const [assignee, setAssignee] = useState('')
  const [points, setPoints] = useState('20')
  const nameRef = useRef(null)

  useEffect(() => { if (open && nameRef.current) nameRef.current.focus() }, [open])

  function submit() {
    const text = name.trim()
    if (!text) { nameRef.current.focus(); return }
    onSubmit({
      stepIdx: Number(stepIdx),
      text,
      who: assignee.trim() || 'Chưa gán',
      pts: Math.max(0, Number(points) || 0),
    })
  }

  return (
    <div className={`mk-task-modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mk-task-modal-box">
        <h3>Tạo nhiệm vụ mới</h3>
        <div className="mk-task-modal-sub">Dành cho trưởng phòng Marketing — tạo nhiệm vụ và chỉ định nhân sự tham gia.</div>
        <div className="mk-task-modal-field">
          <label>Tên nhiệm vụ *</label>
          <input ref={nameRef} type="text" placeholder="VD: Thiết kế thêm 3 mẫu ảnh quảng cáo" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="mk-task-modal-field">
          <label>Thuộc bước chiến dịch</label>
          <select value={stepIdx} onChange={e => setStepIdx(e.target.value)}>
            {steps.map((s, i) => <option key={i} value={i}>{i + 1}. {s.title}</option>)}
          </select>
        </div>
        <div className="mk-task-modal-field">
          <label>Nhân sự tham gia</label>
          <input type="text" placeholder="VD: Ngọc Hà, Minh Quân" value={assignee} onChange={e => setAssignee(e.target.value)} />
        </div>
        <div className="mk-task-modal-field">
          <label>Điểm thưởng</label>
          <input type="text" inputMode="numeric" placeholder="VD: 20" value={points} onChange={e => setPoints(e.target.value)} />
        </div>
        <div className="mk-task-modal-actions">
          <button className="mk-task-modal-btn" onClick={onClose}>Huỷ</button>
          <button className="mk-task-modal-btn primary" onClick={submit}>Tạo nhiệm vụ</button>
        </div>
      </div>
    </div>
  )
}
