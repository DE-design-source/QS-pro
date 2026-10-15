import { useState } from 'react'

/* Popover "Thêm người vào nhóm" — openAddMemberPopover() trong chat.html.
   Mỗi lần mở là một popover mới (ô nhập trống), bấm ra ngoài thì đóng (xử lý ở Chat.jsx). */
export default function AddMemberPopover({ onAdd, onClose }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [hint, setHint] = useState(false)

  function add() {
    const n = name.trim()
    const r = role.trim()
    if (!n || !r) { setHint(true); return }
    onAdd(n, r)
  }

  return (
    <div className="ch-pjm-popover" onClick={e => e.stopPropagation()}>
      <div className="ch-pjm-title">Thêm người vào nhóm</div>
      <input type="text" placeholder="Họ tên" value={name} onChange={e => setName(e.target.value)} />
      <input type="text" placeholder="Vai trò trong nhóm (bắt buộc)" value={role} onChange={e => setRole(e.target.value)} />
      <div className="ch-pjm-hint" style={{ display: hint ? 'block' : 'none', color: 'var(--danger)' }}>Vui lòng nhập đầy đủ họ tên và vai trò</div>
      <div className="ch-pjm-actions">
        <button type="button" className="ch-pjm-btn" onClick={onClose}>Đóng</button>
        <button type="button" className="ch-pjm-btn primary" onClick={add}>Thêm</button>
      </div>
    </div>
  )
}
