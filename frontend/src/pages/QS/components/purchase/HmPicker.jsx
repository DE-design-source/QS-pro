import { useEffect, useLayoutEffect, useRef } from 'react'
import { MrootPortal } from '../common/Mroot'
import { TREE, nodeCount } from '../../lib/tree'
import { pad2 } from '../../lib/format'

/* Popup "Chọn hạng mục" của hàng đầu tab (port hmPop_ / hmPick_, PUB/app.js:1420-1449).
   Props: anchor (nút đã bấm), cur (hạng mục đang lọc, '' = tất cả), lines (mọi dòng dự án, để đếm),
          onPick(code) (đã đóng popup), onClose().
   Mở dưới nút, thiếu chỗ thì lật lên trên; bấm ra ngoài (trừ chính nút mở) thì đóng. */
export default function HmPicker({ anchor, cur, lines, onPick, onClose }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  /* Popup nằm trong .qs-mroot bị zoom: đo tỉ lệ px style -> px màn hình bằng 2 lần đặt thử (như common/DocsPopover) */
  useLayoutEffect(() => {
    const pop = ref.current
    if (!pop || !anchor) return
    const r = anchor.getBoundingClientRect()
    pop.style.left = '0px'; pop.style.top = '0px'
    const a = pop.getBoundingClientRect()
    pop.style.left = '100px'; pop.style.top = '100px'
    const b = pop.getBoundingClientRect()
    const z = (b.left - a.left) / 100 || 1
    const w = a.width || 330, h = a.height
    let top = r.bottom + 6 * z
    if (top + h > window.innerHeight - 10 * z) top = Math.max(10 * z, r.top - h - 6 * z)
    const left = Math.max(8 * z, Math.min(r.left, window.innerWidth - w - 10 * z))
    pop.style.left = (left - a.left) / z + 'px'
    pop.style.top = (top - a.top) / z + 'px'
  }, [anchor])

  useEffect(() => {
    const out = e => {
      if (ref.current && ref.current.contains(e.target)) return
      if (anchor && anchor.contains(e.target)) return
      closeRef.current()
    }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [anchor])

  const item = (code, label, lvl, cnt) => {
    const on = code === cur
    return (
      <div key={code || '_all'} className={`qs-po-hm-i lvl${lvl}${on ? ' on' : ''}`} onClick={() => onPick(code)}>
        <span className="nm">{label}</span>
        <span className="cn">{cnt}</span>
        <span className={`rd${on ? ' on' : ''}`} />
      </div>
    )
  }

  return (
    <MrootPortal>
      <div className="qsc-pop qs-po-hm" ref={ref} role="dialog">
        <div className="qs-po-hm-h">
          <b>Chọn hạng mục</b>
          <button type="button" className="qsc-x" onClick={() => closeRef.current()}>✕</button>
        </div>
        <div className="qs-po-hm-b">
          {item('', 'Tất cả hạng mục', 1, '[' + pad2((lines || []).length) + ']')}
          {TREE.filter(t => t[0] !== 'X').map(t => {
            const n = nodeCount(lines, t[0])
            return item(t[0], t[0] + '. ' + t[1], t[2], n ? '[' + pad2(n) + ']' : '')
          })}
        </div>
      </div>
    </MrootPortal>
  )
}
