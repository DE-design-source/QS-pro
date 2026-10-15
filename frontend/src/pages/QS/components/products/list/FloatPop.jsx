import { useEffect, useLayoutEffect, useRef } from 'react'
import { MrootPortal } from '../../common/ModalHost'

/* Popup nổi đặt trong .qs-mroot (PLAN 1.8), bám theo nút mở - thay cho các popup document.body của bản gốc
   (spColPop_, spBoLocPop_, bb-pop, ctxmenu). Props:
     anchor   phần tử nút mở (đo toạ độ màn hình)
     place    'below-left' (mép trái = nút) | 'below-right' (mép phải = nút) | 'above-center' (trên nút, giữa) | 'menu-right'
     onClose  bấm ra ngoài (trừ chính nút mở) hoặc Esc
     className, children
   Lớp gốc bị zoom nên đo tỉ lệ px style -> px màn hình bằng hai lần đặt thử (cùng cách DocsPopover). */
export default function FloatPop({ anchor, place = 'below-left', onClose, className = '', children, deps = [] }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useLayoutEffect(() => {
    const pop = ref.current
    if (!pop || !anchor) return
    const r = anchor.getBoundingClientRect()
    pop.style.left = '0px'; pop.style.top = '0px'
    const a = pop.getBoundingClientRect()
    pop.style.left = '100px'; pop.style.top = '100px'
    const b = pop.getBoundingClientRect()
    const z = (b.left - a.left) / 100 || 1
    const w = a.width, h = a.height
    const vw = window.innerWidth, vh = window.innerHeight
    let left, top
    if (place === 'above-center') {
      left = Math.max(10 * z, Math.min(r.left + r.width / 2 - w / 2, vw - w - 10 * z))
      top = Math.max(10 * z, r.top - h - 10 * z)
    } else if (place === 'below-right' || place === 'menu-right') {
      left = Math.max(8 * z, Math.min(r.right - w, vw - w - 8 * z))
      top = r.bottom + (place === 'menu-right' ? 4 : 6) * z
      if (top + h > vh - 8 * z) top = Math.max(8 * z, vh - h - 8 * z)
    } else {
      left = Math.max(8 * z, Math.min(r.left, vw - w - 10 * z))
      top = r.bottom + 6 * z
      if (top + h > vh - 10 * z) top = Math.max(10 * z, r.top - h - 6 * z)
    }
    pop.style.left = (left - a.left) / z + 'px'
    pop.style.top = (top - a.top) / z + 'px'
    pop.style.visibility = 'visible'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, place, ...deps])

  useEffect(() => {
    const out = e => {
      if (ref.current && ref.current.contains(e.target)) return
      if (anchor && anchor.contains && anchor.contains(e.target)) return
      if (closeRef.current) closeRef.current()
    }
    const key = e => { if (e.key === 'Escape' && closeRef.current) closeRef.current() }
    const t = setTimeout(() => document.addEventListener('mousedown', out), 0)
    document.addEventListener('keydown', key)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key) }
  }, [anchor])

  return (
    <MrootPortal>
      <div className={'qspl-fpop ' + className} ref={ref} style={{ visibility: 'hidden' }}>{children}</div>
    </MrootPortal>
  )
}
