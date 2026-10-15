import { useState } from 'react'
import Pop from './Pop'
import { colPlain } from '../../../lib/columns.js'
import { money } from '../../../lib/format.js'
import { mediaUrl } from '../../../api/files'

/* Lọc cột kiểu AutoFilter (openFilter PUB/boc.js:678-711): sắp xếp, cố định đến cột, danh sách giá trị kèm số dòng
   (cột Tên: ảnh + tên + giá như bản cũ), ô tìm giá trị, "— Tất cả (n) —".
   Props: anchor, colKey, label, lines (dòng của đề mục), value (giá trị đang lọc), sortKey, freezeN, act, onClose */
export default function ColFilterPop({ anchor, colKey, label, lines, value, sortKey, freezeN, act, onClose }) {
  const [q, setQ] = useState('')
  const vals = {}; const meta = {}
  lines.forEach(l => { const v = colPlain(l, colKey); if (v !== '') { vals[v] = (vals[v] || 0) + 1; if (!meta[v]) meta[v] = { img: l.hinhAnh, price: l.donGiaBan } } })
  const keys = Object.keys(vals).sort()
  const rich = colKey === 'ten'
  const ql = q.trim().toLowerCase()
  const run = fn => () => { onClose(); fn() }
  return (
    <Pop anchor={anchor} width={rich ? 400 : 250} className="qs-tk-flt" onClose={onClose}>
      <div className="qs-tk-fhdr">{label}</div>
      <div className="qs-tk-fpa" onClick={run(() => act.sort(colKey, 'asc'))}>▲ Sắp xếp tăng dần</div>
      <div className="qs-tk-fpa" onClick={run(() => act.sort(colKey, 'desc'))}>▼ Sắp xếp giảm dần</div>
      {sortKey === colKey && <div className="qs-tk-fpa" onClick={run(act.resetSort)}>✕ Bỏ sắp xếp</div>}
      <div className="qs-tk-fpa" onClick={run(() => act.freezeTo(colKey))}>❄ Cố định đến cột này</div>
      {freezeN > 0 && <div className="qs-tk-fpa" onClick={run(act.unfreeze)}>✕ Bỏ cố định cột</div>}
      <div className="qs-tk-fpsep" />
      <div className="qs-tk-fhdr sm">Lọc giá trị</div>
      <input className="qs-tk-fsearch" autoFocus placeholder="Tìm giá trị…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="qs-tk-fitems">
        <div className="qs-tk-fi all" onClick={run(() => act.setFilter(colKey, null))}>— Tất cả ({lines.length}) —</div>
        {keys.filter(v => !ql || v.toLowerCase().indexOf(ql) >= 0).map(v => {
          const on = value === v
          if (rich) {
            const m = meta[v] || {}
            const src = m.img ? mediaUrl(String(m.img).split('\n')[0].trim()) : ''
            return (
              <div key={v} className={`qs-tk-fi frow${on ? ' on' : ''}`} onClick={run(() => act.setFilter(colKey, v))}>
                {src ? <img src={src} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden' }} /> : <span className="noimg" />}
                <span className="fnm">{v}</span><span className="fpr">{money(m.price)}</span>
              </div>
            )
          }
          return <div key={v} className={`qs-tk-fi${on ? ' on' : ''}`} onClick={run(() => act.setFilter(colKey, v))}>{v} <span className="qs-tk-fcnt">({vals[v]})</span></div>
        })}
      </div>
    </Pop>
  )
}
