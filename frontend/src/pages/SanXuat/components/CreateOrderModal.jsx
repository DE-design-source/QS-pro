import { useEffect, useRef, useState } from 'react'
import { WORKERS, initialsOf } from '../../../data/sanXuatData'

const EMPTY = { name: '', customer: '', qty: '1', prio: 'med', due: '2026-10-10', note: '' }

/* Ô chọn nhiều người phụ trách: gõ để gợi ý, Enter để thêm, Backspace để xoá tag cuối */
function WorkerTagInput({ selected, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  const q = query.trim().toLowerCase()
  const matches = WORKERS.filter(w => !selected.includes(w.name) && (!q || w.name.toLowerCase().includes(q)))

  function add(name) {
    if (!name || selected.includes(name)) return
    onChange([...selected, name])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!q) return
      const match = WORKERS.find(w => !selected.includes(w.name) && w.name.toLowerCase().includes(q))
      add(match ? match.name : query.trim())
    } else if (e.key === 'Backspace' && !query && selected.length) {
      onChange(selected.slice(0, -1))
    }
  }

  return (
    <div className="sx-worker-tag-box" ref={boxRef}>
      {selected.map(name => (
        <span key={name} className="sx-worker-tag">
          {name}
          <button type="button" className="sx-worker-tag-remove" onClick={() => onChange(selected.filter(n => n !== name))}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        placeholder="Gõ tên để thêm nhân sự..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && matches.length > 0 && (
        <div className="sx-suggest-dropdown">
          {matches.map(w => (
            <div key={w.name} className="sx-suggest-item" onMouseDown={e => { e.preventDefault(); add(w.name) }}>
              <span className="sx-comment-avatar" style={{ width: 20, height: 20, fontSize: 9 }}>{initialsOf(w.name)}</span>{w.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* Modal luôn được mount: các ô khác giữ nội dung khi Huỷ, giống bản HTML (chỉ danh sách nhân sự được làm mới khi mở) */
export default function CreateOrderModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [workers, setWorkers] = useState([])
  const bind = key => ({ value: form[key], onChange: e => setForm(f => ({ ...f, [key]: e.target.value })) })

  useEffect(() => { if (open) setWorkers([]) }, [open])

  function submit() {
    if (!form.name.trim()) { alert('Vui lòng nhập tên sản phẩm.'); return }
    if (!workers.length) { alert('Vui lòng thêm ít nhất một người phụ trách.'); return }
    onCreate({
      name: form.name.trim(),
      customer: 'KH: ' + (form.customer.trim() || 'Chưa rõ khách hàng'),
      qty: parseInt(form.qty, 10) || 1,
      worker: workers.join(', '),
      due: form.due ? form.due.split('-').reverse().slice(0, 2).join('/') : '',
      priority: form.prio,
    })
    setForm(f => ({ ...f, name: '', customer: '', qty: '1', note: '' }))
    setWorkers([])
  }

  return (
    <div className={`sx-modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sx-modal-box">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Tạo đơn sản xuất</h3>
        <div className="sx-modal-field"><label>Tên sản phẩm</label><input type="text" placeholder="VD: Tủ bếp gỗ óc chó" {...bind('name')} /></div>
        <div className="sx-modal-field"><label>Khách hàng / Dự án</label><input type="text" placeholder="VD: Nguyễn Văn A" {...bind('customer')} /></div>
        <div className="sx-modal-row">
          <div className="sx-modal-field"><label>Số lượng</label><input type="text" inputMode="numeric" {...bind('qty')} /></div>
          <div className="sx-modal-field"><label>Độ ưu tiên</label>
            <select {...bind('prio')}><option value="high">Cao</option><option value="med">Trung bình</option><option value="low">Thấp</option></select>
          </div>
        </div>
        <div className="sx-modal-field"><label>Người phụ trách</label><WorkerTagInput selected={workers} onChange={setWorkers} /></div>
        <div className="sx-modal-field"><label>Ngày giao dự kiến</label><input type="date" {...bind('due')} /></div>
        <div className="sx-modal-field"><label>Ghi chú</label><textarea rows={2} placeholder="Vật liệu, quy cách..." {...bind('note')} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button className="sx-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="sx-modal-btn submit" onClick={submit}>Tạo đơn</button>
        </div>
      </div>
    </div>
  )
}
