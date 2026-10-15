import { money } from '../../lib/format.js'

/* Ô STT của Bảng thường Chi phí / Dự án: ô tick dòng + số gi.ri (cpSttCell_ PUB/chiphi.js:72-76).
   Props: stt (chữ số dòng), on (đang tick), onTick(ev) */
export default function TickStt({ stt, on, onTick }) {
  return (
    <span className="qs-tk-sttcell">
      <input type="checkbox" className="qs-tk-ck" checked={on} title="Chọn dòng (giữ Shift để chọn cả vùng)"
        onMouseDown={ev => ev.stopPropagation()} onChange={() => {}} onClick={onTick} />
      <span className="qs-tk-sttn">{stt}</span>
    </span>
  )
}

/* Số lợi nhuận có màu (cpSigned_ chiphi.js:7). Props: v */
export function Signed({ v }) {
  v = Math.round(Number(v) || 0)
  return <span className={v < 0 ? 'qs-cp-neg' : v > 0 ? 'qs-cp-pos' : ''}>{money(v)}</span>
}
