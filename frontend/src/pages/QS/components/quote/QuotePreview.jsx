import { useLayoutEffect, useRef } from 'react'
import Icon from '../../../../components/ui/Icon'
import { money } from '../../lib/format.js'
import { bgDocW_ } from '../../lib/quote.js'
import { docScreenCss } from './docCss'
import { useQuoteUi, bgGoPage, bgSetZoom_, bgSetView, setColW } from './quoteState'
import { bgColDrop } from './quoteActions'

/* Cột phải của "Xem trước & Xuất" (bgDocHTML PUB/baogia.js:503-523): thanh trên (tên trang, chip, mức phóng, Xem trước / Chỉnh sửa),
   vùng xem 1 trang giấy, chân phân trang (bgPager 495-502). CSS tài liệu nằm trong <style> của chính vùng xem (không vào document.head),
   mọi selector có tiền tố .qsq-vp [F1]. Kéo đầu cột đổi chỗ / kéo mép chỉnh rộng: bgColDragStart / bgColDrop / mousedown .qxrsz 341-381.
   Props: pages [{html, meta}], mau (màu chủ đạo), vat (VAT dự án) */
const SCOPE = '.qsq-vp'
const ZOOMS = [['fit', 'Vừa khung'], ['75', '75%'], ['100', '100%'], ['125', '125%']]

export function ModeSeg() {
  const q = useQuoteUi()
  return (
    <div className="qs-qt-mode">
      <button type="button" className={q.bgView === 'doc' ? 'on' : ''} onClick={() => bgSetView('doc')}><Icon name="eye" size={14} />Xem trước &amp; Xuất</button>
      <button type="button" className={q.bgView === 'edit' ? 'on' : ''} onClick={() => bgSetView('edit')}><Icon name="sliders" size={14} />Chỉnh sửa</button>
    </div>
  )
}

function Pager({ total, cur }) {
  if (total <= 1) return null
  const set = []
  for (let n = 1; n <= total; n++) if (n === 1 || n === total || Math.abs(n - cur) <= 1) set.push(n)
  const out = []; let prev = 0
  set.forEach(n => {
    if (n - prev > 1) out.push(<span key={'e' + n} className="ell">…</span>)
    out.push(<button type="button" key={n} className={n === cur ? 'on' : ''} onClick={() => bgGoPage(n)}>{n}</button>)
    prev = n
  })
  return (
    <div className="qsq-pgr">
      {cur > 1 && <button type="button" onClick={() => bgGoPage(cur - 1)}>←</button>}
      {out}
      {cur < total && <button type="button" onClick={() => bgGoPage(cur + 1)}>→</button>}
    </div>
  )
}

/* khoá cột của 1 bảng đang hiện (bỏ cột STT đầu tiên); rỗng nếu không phải bảng chi tiết (bgThKeys_) */
function thKeys(t) {
  if (!t) return []
  const ths = [].slice.call(t.querySelectorAll('th')); if (ths.length < 2) return []
  const ks = ths.slice(1).map(th => th.getAttribute('data-k'))
  return ks.every(Boolean) ? ks : []
}

export default function QuotePreview({ pages, mau, vat }) {
  const q = useQuoteUi()
  const vpRef = useRef(null)
  const docRef = useRef(null)
  const dragK = useRef(null)
  const shownPage = useRef(0)
  const N = pages.length
  const page = q.bgPage >= 1 && q.bgPage <= N ? q.bgPage : 1
  const pg = pages[page - 1] || { html: '', meta: {} }
  const m = pg.meta || {}
  const vp = Number(vat) || 0
  const z = String(q.bgZoom || 'fit')

  /* Mức phóng (bgZoomApply_ 399-406): fit = vừa bề ngang khung xem, không lớn hơn 100% */
  useLayoutEffect(() => {
    const box = vpRef.current; const doc = docRef.current
    if (!box || !doc) return undefined
    const apply = () => {
      let v
      if (z === 'fit') { const rong = box.clientWidth - 18; v = rong > 0 ? Math.min(1, rong / 1123) : 1 } else v = (Number(z) || 100) / 100
      doc.style.zoom = v
    }
    apply()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(apply)
    ro.observe(box)
    return () => ro.disconnect()
  }, [z])
  /* Đổi trang thì về đầu trang (bgGoPage 130); vẽ lại cùng trang thì giữ chỗ đang cuộn */
  useLayoutEffect(() => {
    if (shownPage.current !== page && vpRef.current) { vpRef.current.scrollTop = 0; vpRef.current.scrollLeft = 0 }
    shownPage.current = page
  }, [page])

  function onDragStart(e) {
    const th = e.target.closest && e.target.closest('th[draggable]')
    if (!th) return
    if (e.target.closest('.qsd-qxrsz')) { e.preventDefault(); return }
    dragK.current = th.getAttribute('data-k')
    try { e.dataTransfer.setData('text/plain', dragK.current) } catch (x) { /* bỏ qua */ }
  }
  function onDrop(e) {
    const th = e.target.closest && e.target.closest('th[data-k]')
    e.preventDefault()
    const from = dragK.current; dragK.current = null
    if (th && from) bgColDrop(from, th.getAttribute('data-k'))
  }
  /* Kéo mép phải của đầu cột để chỉnh rộng: vẽ lại bề rộng MỌI bảng đang hiện, thả chuột mới lưu (qs_bgdoc) */
  function onMouseDown(e) {
    const rs = e.target.closest && e.target.closest('.qsd-qxrsz'); if (!rs) return
    e.preventDefault(); e.stopPropagation()
    const k = rs.getAttribute('data-k'); const sx = e.clientX
    const w = { ...(q.bgColW || {}) }
    const sw = bgDocW_(k, w)
    const tb = rs.closest('table'); const rong = tb ? tb.getBoundingClientRect().width : 900
    const ksTb = thKeys(tb)
    const heSo = (rong && ksTb.length) ? ((30 + ksTb.reduce((a, x) => a + bgDocW_(x, w), 0)) / rong) : 1
    const ve = () => {
      docRef.current.querySelectorAll('table.qsd-qx-tbl').forEach(t => {
        const ks = thKeys(t); if (!ks.length) return
        const co = t.querySelectorAll('colgroup col'); if (co.length !== ks.length + 1) return
        const tong = 30 + ks.reduce((a, x) => a + bgDocW_(x, w), 0)
        co[0].style.width = (30 / tong * 100).toFixed(3) + '%'
        ks.forEach((x, i) => { co[i + 1].style.width = (bgDocW_(x, w) / tong * 100).toFixed(3) + '%' })
      })
    }
    const mv = ev => { w[k] = Math.max(22, Math.round(sw + (ev.clientX - sx) * heSo)); ve() }
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); setColW(w, true) }
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up)
  }

  const giua = [m.dong ? m.dong + ' dòng · ' + money(m.tien || 0) + ' đ' : '']
  return (
    <main className="qsq-main">
      <div className="qsq-bar">
        <b className="qsq-ten">{m.ten || 'Trang ' + page}</b>
        {page === 1 && <span className="qsq-chip">{q.coverMau === 'm1' ? 'Mẫu 1' : 'Mẫu 2'}</span>}
        {m.dong ? <span className="qsq-chip">{giua[0]}</span> : null}
        <span className="qsq-chip">{vp ? 'VAT ' + vp + '%' : 'Chưa VAT'}</span>
        <span className="qsq-chip">A4 · Ngang</span>
        <span style={{ flex: 1 }} />
        <div className="qs-qt-mode" title="Phóng to / thu nhỏ trang xem trước (không ảnh hưởng file xuất)">
          {ZOOMS.map(o => <button type="button" key={o[0]} className={z === o[0] ? 'on' : ''} onClick={() => bgSetZoom_(o[0])}>{o[1]}</button>)}
        </div>
        <ModeSeg />
      </div>
      <div className="qsq-vp" ref={vpRef}>
        <style>{docScreenCss(mau, SCOPE)}</style>
        <div className="qsd-doc" ref={docRef} onDragStart={onDragStart} onDragOver={e => e.preventDefault()} onDrop={onDrop} onMouseDown={onMouseDown}
          dangerouslySetInnerHTML={{ __html: pg.html }} />
      </div>
      <div className="qsq-foot"><Pager total={N} cur={page} /><span className="qsq-pn">Trang {page} / {N}</span></div>
    </main>
  )
}
