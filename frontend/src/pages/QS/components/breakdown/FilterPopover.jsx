import { useEffect, useRef } from 'react'
import Icon from '../../../../components/ui/Icon'
import { fltHien_, fltActiveN_ } from '../../lib/catalogFilters.js'
import { fltToggle, clearAllFilters } from './catalog/filterStore'

/* Hộp "Bộ lọc" (port fltNamesRender_ / toggleFiltDrop, PUB/app.js:909-1012 + index.html:6705-6726):
   chỉ liệt kê TÊN các khối lọc áp dụng cho đề mục đang chọn; bật tên nào thì khối đó hiện trên panel.
   Props: secs ([[khoá, tên]] = fltSecs_), st (trạng thái lọc), onClose(), anchorRef (nút mở: bấm vào nó không tính là bấm ngoài) */
export default function FilterPopover({ secs, st, onClose, anchorRef }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  /* Bấm ra ngoài hộp thì đóng (filtOutside_) */
  useEffect(() => {
    const down = e => {
      const t = e.target
      if (ref.current && ref.current.contains(t)) return
      if (anchorRef && anchorRef.current && anchorRef.current.contains(t)) return
      closeRef.current && closeRef.current()
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [anchorRef])

  return (
    <div className="qs-bd-pop" ref={ref}>
      <div className="qs-bd-pop-head">
        <span>Bộ lọc</span>
        <button className="qs-bd-pop-close" title="Đóng" onClick={onClose}><Icon name="x" size={18} /></button>
      </div>
      <div className="qs-bd-pop-body">
        <p className="qs-bd-pop-hint">Bấm tên bộ lọc để hiện / ẩn nó trên panel</p>
        {secs.map(([k, label]) => {
          const on = fltHien_(st.fltShow, k)
          const n = fltActiveN_(k, st)
          return (
            <button key={k} className="qs-bd-pop-row" onClick={() => fltToggle(k)}
              title={on ? 'Đang hiện trên panel — bấm để ẩn' : 'Bấm để hiện trên panel'}>
              <span>{label}{n ? <em className="qs-bdc-fnn">{n}</em> : null}</span>
              <span className={`qs-bd-switch${on ? ' on' : ''}`}><i /></span>
            </button>
          )
        })}
      </div>
      <div className="qs-bd-pop-foot">
        <button className="qs-modal-btn" onClick={clearAllFilters}>Xoá lọc</button>
        <button className="qs-modal-btn primary" onClick={onClose}>Xong</button>
      </div>
    </div>
  )
}
