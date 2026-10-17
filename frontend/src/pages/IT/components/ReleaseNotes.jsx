import { useState } from 'react'
import { RELEASES } from '../../../data/itData'

const IcGear = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
const IcFix = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 12h8M10 15h4" /></svg>

/* Ghi chú cập nhật hệ thống — mỗi phiên bản 1 thẻ, thu gọn / mở rộng được (bản mới nhất mở sẵn) */
export default function ReleaseNotes() {
  const [open, setOpen] = useState(() => new Set([RELEASES[0]?.version]))
  const toggle = v => setOpen(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n })
  return RELEASES.map(r => {
    const isOpen = open.has(r.version)
    return (
      <div key={r.version} className="it-card it-rn">
        <button className="it-rn-head" onClick={() => toggle(r.version)} aria-expanded={isOpen}>
          <h2>{r.version}</h2>
          <span className="it-tl-updated">Cập nhật ngày {r.date}</span>
          <span style={{ flex: 1 }} />
          <span className="it-rn-toggle" title={isOpen ? 'Thu gọn' : 'Mở rộng'}>{isOpen ? '—' : '+'}</span>
        </button>
        {isOpen && (
          <div className="it-rn-body">
            {r.improvements?.length > 0 && (
              <>
                <span className="it-rn-tag improve">Cải tiến</span>
                {r.improvements.map(x => <div key={x} className="it-rn-line"><span className="it-rn-ic">{IcGear}</span>{x}</div>)}
              </>
            )}
            {r.fixes?.length > 0 && (
              <>
                <span className="it-rn-tag fix">Sửa lỗi</span>
                {r.fixes.map(x => <div key={x} className="it-rn-line"><span className="it-rn-ic">{IcFix}</span>{x}</div>)}
              </>
            )}
          </div>
        )}
      </div>
    )
  })
}
