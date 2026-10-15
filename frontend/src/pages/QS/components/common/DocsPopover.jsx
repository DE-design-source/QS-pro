import { useEffect, useLayoutEffect, useRef } from 'react'
import QsIcon from './QsIcon'
import { MrootPortal } from './Mroot'
import './common.css'

/* Popup "Tài liệu" của một dòng (port tlPop_ + docRowsHtml_, PUB/nhap.js:180-202).
   Props: anchor (DOMRect hoặc phần tử đã bấm), title (tên SP, hiện sau "Tài liệu · "),
          docs ([{g: tên nhóm, url}] theo thứ tự DOC_GROUPS, caller lấy từ lineDocs_), onClose().
   Đóng khi bấm ra ngoài hoặc nút ✕. Mở dưới nút, thiếu chỗ thì lật lên trên (giống bản gốc). */

/* PUB/app.js:69 */
export function safeUrl_(u) {
  u = String(u == null ? '' : u).trim()
  return /^(https?:|\/|data:image\/|blob:)/i.test(u) || (u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) ? u : '#'
}
/* PUB/nhap.js:179 */
export function docExt_(u) {
  const m = /\.([a-z0-9]{2,4})(?:$|[?#])/i.exec(String(u || '').split('?')[0])
  return m ? m[1].toLowerCase() : 'link'
}
/* PUB/nhap.js:204-206: bỏ tiền tố thời gian của file đã tải lên */
export function docName_(u) {
  u = String(u || '').trim()
  if (!u) return ''
  let t = u.split('?')[0].split('/').pop() || u
  try { t = decodeURIComponent(t) } catch (e) { /* tên lỗi mã hoá: giữ nguyên */ }
  return t.replace(/^\d{10,}-/, '')
}

/* Danh sách file theo nhóm (docRowsHtml_), dùng chung với panel chi tiết SP */
export function DocRows({ docs }) {
  let g = ''
  return (docs || []).map((d, i) => {
    const head = d.g !== g ? <div className="qsc-tl-g">{d.g}</div> : null
    g = d.g
    const ext = docExt_(d.url)
    const href = safeUrl_(d.url)
    const name = docName_(d.url)
    return (
      <div key={i}>
        {head}
        <div className="qsc-tl-row">
          <span className={`qsc-tl-ext e-${ext}`}>{ext === 'link' ? 'LINK' : ext.toUpperCase()}</span>
          <a className="qsc-tl-nm" href={href} target="_blank" rel="noopener" title={'Mở ' + name}>{name}</a>
          <a className="qsc-tl-act" href={href} target="_blank" rel="noopener" download title="Tải về"><QsIcon name="download" size={13} /></a>
        </div>
      </div>
    )
  })
}

export default function DocsPopover({ anchor, title, docs, onClose }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const list = docs || []

  /* Đặt vị trí theo toạ độ màn hình của nút. Popup nằm trong vùng bị zoom nên đo tỉ lệ px style -> px màn hình
     bằng hai lần đặt thử, thay vì đoán mức zoom (QS 0.75 x mật độ của SiteFlow). */
  useLayoutEffect(() => {
    const pop = ref.current
    if (!pop || !anchor) return
    const r = typeof anchor.getBoundingClientRect === 'function' ? anchor.getBoundingClientRect() : anchor
    pop.style.left = '0px'; pop.style.top = '0px'
    const a = pop.getBoundingClientRect()
    pop.style.left = '100px'; pop.style.top = '100px'
    const b = pop.getBoundingClientRect()
    const z = (b.left - a.left) / 100 || 1
    const w = a.width || 340, h = a.height
    const vw = window.innerWidth, vh = window.innerHeight
    let top = r.bottom + 6 * z
    if (top + h > vh - 10 * z) top = Math.max(10 * z, r.top - h - 6 * z)
    const left = Math.max(8 * z, Math.min(r.left, vw - w - 10 * z))
    pop.style.left = (left - a.left) / z + 'px'
    pop.style.top = (top - a.top) / z + 'px'
  }, [anchor, list.length])

  useEffect(() => {
    const out = e => { if (ref.current && !ref.current.contains(e.target)) closeRef.current && closeRef.current() }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [])

  return (
    <MrootPortal>
      <div className="qsc-pop qsc-tl" ref={ref} role="dialog">
        <div className="qsc-pop-h">
          <b>Tài liệu · {title || ''}</b>
          <button type="button" className="qsc-x" onClick={() => onClose && onClose()}>✕</button>
        </div>
        <div className="qsc-tl-body">
          {list.length ? <DocRows docs={list} /> : <div className="qsc-tl-empty">Sản phẩm chưa có tài liệu.</div>}
        </div>
      </div>
    </MrootPortal>
  )
}
