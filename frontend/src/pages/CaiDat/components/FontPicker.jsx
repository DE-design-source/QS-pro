import { useEffect, useState } from 'react'
import { FONT_CATALOG, FONT_CATEGORIES, fontPreviewCss, loadFontPreviews } from '../../../data/fontCatalog'

const PinIcon = ({ on }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
)

/*
 * Danh sách chọn font: ô tìm kiếm, lọc theo nhóm, font đã ghim, font dùng gần đây và toàn bộ danh mục.
 * value = giá trị fontFamily đang dùng; pins / recent = mảng tên font.
 */
export default function FontPicker({ value, pins, recent, onPick, onTogglePin }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')

  useEffect(() => { loadFontPreviews() }, [])

  const key = q.trim().toLowerCase()
  const filtered = FONT_CATALOG.filter(f => (cat === 'all' || f.cat === cat) && (!key || f.name.toLowerCase().includes(key)))
  const byName = names => names.map(n => FONT_CATALOG.find(f => f.name === n)).filter(Boolean)
  const browsing = !key && cat === 'all'

  const row = f => (
    <div key={f.name} className={`cd-fp-row${f.value === value ? ' active' : ''}`}>
      <button type="button" className="cd-fp-name" style={{ fontFamily: fontPreviewCss(f) }} onClick={() => onPick(f)}>{f.name}</button>
      {f.value === value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7" /></svg>}
      <button type="button" className={`cd-fp-pin${pins.includes(f.name) ? ' on' : ''}`} title={pins.includes(f.name) ? 'Bỏ ghim' : 'Ghim font này'} onClick={() => onTogglePin(f.name)}><PinIcon on={pins.includes(f.name)} /></button>
    </div>
  )
  const group = (title, fonts) => fonts.length > 0 && (
    <>
      <div className="cd-fp-group">{title}</div>
      {fonts.map(row)}
    </>
  )

  return (
    <div className="cd-fp">
      <div className="cd-fp-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Gõ tên font để tìm…" />
      </div>
      <div className="cd-fp-cats">
        {FONT_CATEGORIES.map(([k, label]) => (
          <button key={k} type="button" className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{label}</button>
        ))}
      </div>
      <div className="cd-fp-list">
        {browsing && group('Đã ghim', byName(pins))}
        {browsing && group('Dùng gần đây', byName(recent))}
        {group(browsing ? `Tất cả font (${filtered.length})` : `Kết quả (${filtered.length})`, filtered)}
        {filtered.length === 0 && <div className="cd-fp-empty">Không có font nào khớp.</div>}
      </div>
    </div>
  )
}
