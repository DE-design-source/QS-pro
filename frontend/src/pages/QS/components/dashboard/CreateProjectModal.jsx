import { useEffect, useRef, useState } from 'react'
import { qsToast } from '../common/dialogs'
import { escOnTop_ } from '../project/projectShell'

const EMPTY = { name: '', client: '', phone: '', address: '', link: '', vat: '0' }

/* Hộp thoại "Tạo dự án mới" (#mCreate, PUB/index.html:6798-6808); onSave nhận dữ liệu form khi tên dự án hợp lệ.
   busy (tuỳ chọn): đang lưu -> khoá nút Lưu. Thiếu tên: báo "Nhập tên dự án" như doCreate (PUB/app.js:452). */
export default function CreateProjectModal({ onClose, onSave, busy }) {
  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState(false)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const nameMissing = !form.name.trim()
  const ovRef = useRef(null)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && escOnTop_(ovRef.current)) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit(e) {
    e.preventDefault()
    setTouched(true)
    if (nameMissing) { qsToast('Nhập tên dự án'); return }
    onSave(form)
  }

  return (
    <div ref={ovRef} className="qs-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="qs-modal" onSubmit={submit}>
        <h3 className="qs-modal-title">Tạo dự án mới</h3>
        <label className="qs-field">
          <span>Tên dự án *</span>
          <input autoFocus value={form.name} onChange={set('name')} placeholder="VD: Nhà phố anh Thành" className={touched && nameMissing ? 'invalid' : ''} />
        </label>
        <label className="qs-field"><span>Khách hàng</span><input value={form.client} onChange={set('client')} /></label>
        <label className="qs-field"><span>Số điện thoại</span><input value={form.phone} onChange={set('phone')} /></label>
        <label className="qs-field"><span>Địa chỉ</span><input value={form.address} onChange={set('address')} /></label>
        <label className="qs-field">
          <span>Link dự án trên Dezon <i>(tuỳ chọn)</i></span>
          <input value={form.link} onChange={set('link')} placeholder="https://dezon.vn/..." />
        </label>
        <label className="qs-field"><span>VAT (%)</span><input type="number" min="0" max="100" value={form.vat} onChange={set('vat')} /></label>
        <div className="qs-modal-actions">
          <button type="button" className="qs-modal-btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="qs-modal-btn primary" disabled={!!busy}>Lưu dự án</button>
        </div>
      </form>
    </div>
  )
}
