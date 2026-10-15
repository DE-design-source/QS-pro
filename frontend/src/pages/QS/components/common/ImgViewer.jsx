import { useEffect, useState } from 'react'
import { MrootPortal } from './Mroot'
import './common.css'

/* Xem ảnh cỡ lớn (port imgPop_, PUB/nhap.js:294-349): lật ‹ › bằng chuột hoặc phím ←/→, Esc để đóng, có số đếm.
   Props: src (URL đã qua mediaUrl; rỗng = không hiện), gallery (mảng URL của panel chi tiết, tuỳ chọn),
          onClose(), onIndexChange(i) (tuỳ chọn: chỉ gọi khi đang lật đúng bộ ảnh gallery, để panel chi tiết đổi ảnh theo).
   Như bản gốc: chỉ dùng gallery khi src nằm trong gallery, ngược lại chỉ xem 1 ảnh src. */
export default function ImgViewer({ src, gallery, onClose, onIndexChange }) {
  const gal = gallery && gallery.length ? gallery : []
  const at = src ? gal.indexOf(src) : -1
  const list = at >= 0 ? gal : (src ? [src] : [])
  /* Vị trí đang xem gắn với src: mở ảnh khác thì quay về đúng ảnh vừa bấm */
  const [pos, setPos] = useState(() => ({ src, i: at >= 0 ? at : 0 }))
  const idx = pos.src === src ? pos.i : (at >= 0 ? at : 0)

  const many = list.length > 1

  function go(d) {
    if (list.length < 2) return
    const n = (((idx + d) % list.length) + list.length) % list.length
    setPos({ src, i: n })
    if (at >= 0 && onIndexChange) onIndexChange(n)
  }

  useEffect(() => {
    if (!src) return undefined
    const key = e => {
      if (e.key === 'Escape') onClose && onClose()
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  })

  if (!src) return null

  return (
    <MrootPortal>
      <div className="qsc-iv" onClick={e => { if (e.target.tagName !== 'IMG') onClose && onClose() }}>
        {many && <button type="button" className="qsc-iv-nav prev" title="Ảnh trước (←)" onClick={e => { e.stopPropagation(); go(-1) }}>‹</button>}
        <img src={list[idx] || src} alt="" />
        {many && <button type="button" className="qsc-iv-nav next" title="Ảnh sau (→)" onClick={e => { e.stopPropagation(); go(1) }}>›</button>}
        {many && <span className="qsc-iv-n">{idx + 1} / {list.length}</span>}
        <button type="button" className="qsc-iv-x" title="Đóng (Esc)" onClick={e => { e.stopPropagation(); onClose && onClose() }}>✕</button>
      </div>
    </MrootPortal>
  )
}
