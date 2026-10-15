import { useState } from 'react'
import { BIM_ROOMS, fmtNum } from '../../../data/bimData'
import { Icon, SearchInput } from './shared'

export default function RoomTab() {
  const [query, setQuery] = useState('')
  const [overlay, setOverlay] = useState(false)
  const q = query.toLowerCase()
  const rooms = BIM_ROOMS.filter(r => !q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))

  return (
    <>
      <div className="bim-eyebrow">Room / Space</div>
      <div>
        <h2 className="bim-title">Không gian dự án</h2>
        <p className="bim-desc" style={{ maxWidth: 520 }}>Space lưu đúng occurrence của face, boundary polygon, cao độ mặt phẳng và chiều cao.</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Tìm mã hoặc tên phòng..." style={{ flex: 1, minWidth: 240 }} />
        <button className={`bim-btn-ghost${overlay ? ' on' : ''}`} onClick={() => setOverlay(o => !o)}><Icon name="eye" />Overlay</button>
      </div>
      <div className="bim-card" style={{ padding: 4 }}>
        {rooms.length ? rooms.map(r => (
          <div key={r.code} className="bim-data-row">
            <div style={{ width: 4, height: 34, borderRadius: 3, background: r.color, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.code} · {r.level}</div>
            </div>
            <div className="mono" style={{ fontSize: 13.5, fontWeight: 700 }}>{fmtNum(r.area)} m²</div>
            <Icon name="chevronRight" size={16} stroke="var(--text-muted)" style={{ flex: 'none' }} />
          </div>
        )) : <div style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>Không tìm thấy phòng phù hợp.</div>}
      </div>
      <div className="bim-card" style={{ padding: '16px 20px', display: 'flex', gap: 32, background: '#12161F', border: 'none' }}>
        <div><div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>18</div><div style={{ fontSize: 11.5, color: '#9AA1AD' }}>spaces đã ghi</div></div>
        <div><div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>94,2%</div><div style={{ fontSize: 11.5, color: '#9AA1AD' }}>objects đã có phòng</div></div>
      </div>
    </>
  )
}
