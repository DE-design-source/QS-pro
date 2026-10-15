import { useEffect, useState } from 'react'

/* Modal nhập / xuất kho. mode: 'in' | 'out' | null (đóng) */
export default function StockModal({ mode, materials, onClose, onSubmit }) {
  const [idx, setIdx] = useState(0)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const isIn = mode === 'in'

  // Mỗi lần mở: chọn lại vật tư đầu tiên, xoá số lượng & ghi chú (giống openStockModal)
  useEffect(() => {
    if (mode) { setIdx(0); setQty(''); setNote('') }
  }, [mode])

  function submit() {
    const m = materials[idx]
    const n = parseInt(qty, 10)
    if (!m || !n || n <= 0) { alert('Vui lòng chọn vật tư và nhập số lượng hợp lệ.'); return }
    if (!isIn && n > m.qty) { alert(`Số lượng xuất vượt quá tồn kho hiện có (${m.qty} ${m.unit}).`); return }
    onSubmit(idx, isIn ? n : -n)
  }

  return (
    <div className={`sx-modal-overlay${mode ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sx-modal-box">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{isIn ? 'Nhập kho' : 'Xuất kho'}</h3>
        <div className="sx-modal-field">
          <label>Vật tư</label>
          <select value={idx} onChange={e => setIdx(parseInt(e.target.value, 10))}>
            {materials.map((m, i) => <option key={m.name} value={i}>{m.name}</option>)}
          </select>
        </div>
        <div className="sx-modal-row">
          <div className="sx-modal-field"><label>Số lượng</label><input type="text" inputMode="numeric" placeholder="VD: 10" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div className="sx-modal-field"><label>Đơn vị</label><input type="text" disabled value={materials[idx] ? materials[idx].unit : ''} /></div>
        </div>
        <div className="sx-modal-field">
          <label>{isIn ? 'Nhà cung cấp / ghi chú' : 'Lý do xuất kho'}</label>
          <textarea rows={2} placeholder="Nhà cung cấp, lý do..." value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button className="sx-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="sx-modal-btn submit" style={{ background: isIn ? 'var(--success)' : 'var(--danger)' }} onClick={submit}>Xác nhận</button>
        </div>
      </div>
    </div>
  )
}
