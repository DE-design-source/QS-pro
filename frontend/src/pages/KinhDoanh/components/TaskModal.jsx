import { useEffect, useRef, useState } from 'react'

/* ===================== Modal: Tạo nhiệm vụ mới =====================
   Mount sẵn, bật/tắt bằng class .open; trang cha đổi `key` mỗi lần mở để form trở về mặc định
   (openCreateTaskModalK: xoá tên / nhân sự, điểm = 20, chọn sẵn bước đang "current"). */

export default function TaskModal({ open, steps, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [stepIdx, setStepIdx] = useState(() => {
    const currentIdx = steps.findIndex(s => s.status === 'current')
    return currentIdx >= 0 ? currentIdx : 0
  })
  const [assignee, setAssignee] = useState('')
  const [points, setPoints] = useState('20')
  const nameRef = useRef(null)

  useEffect(() => { if (open && nameRef.current) nameRef.current.focus() }, [open])

  function submit() {
    const n = name.trim()
    if (!n) { nameRef.current.focus(); return }
    onSubmit({
      stepIdx: Number(stepIdx),
      text: n,
      who: assignee.trim() || 'Chưa gán',
      pts: Math.max(0, Number(points) || 0),
    })
  }

  return (
    <div className={`kd-task-modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="kd-task-modal-box">
        <h3>Tạo nhiệm vụ mới</h3>
        <div className="kd-task-modal-sub">Dành cho trưởng phòng Kinh doanh — tạo nhiệm vụ và chỉ định nhân sự tham gia.</div>
        <div className="kd-task-modal-field">
          <label>Tên nhiệm vụ *</label>
          <input type="text" ref={nameRef} placeholder="VD: Gọi lại 5 khách hàng chưa phản hồi" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="kd-task-modal-field">
          <label>Thuộc bước quy trình</label>
          <select value={stepIdx} onChange={e => setStepIdx(e.target.value)}>
            {steps.map((s, i) => <option key={i} value={i}>{i + 1}. {s.title}</option>)}
          </select>
        </div>
        <div className="kd-task-modal-field">
          <label>Nhân sự tham gia</label>
          <input type="text" placeholder="VD: Hoàng Yến Nhi, Đặng Quốc Cường" value={assignee} onChange={e => setAssignee(e.target.value)} />
        </div>
        <div className="kd-task-modal-field">
          <label>Điểm thưởng</label>
          <input type="text" inputMode="numeric" placeholder="VD: 20" value={points} onChange={e => setPoints(e.target.value)} />
        </div>
        <div className="kd-task-modal-actions">
          <button className="kd-task-modal-btn" onClick={onClose}>Huỷ</button>
          <button className="kd-task-modal-btn primary" onClick={submit}>Tạo nhiệm vụ</button>
        </div>
      </div>
    </div>
  )
}
