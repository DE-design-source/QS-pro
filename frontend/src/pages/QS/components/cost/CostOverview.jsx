import { useEffect, useState } from 'react'
import { money } from '../../lib/format.js'
import { cpWarnCount_, cpOvCharts_ } from '../../lib/totals.js'

const dong = n => `${money(n)} đ`
const WARN = [['lo', 'đang lỗ'], ['thap', 'biên dưới'], ['chuaGia', 'chưa có giá bán'], ['chuaVon', 'chưa có giá vốn']]

/* Khối "Tổng quan chi phí" (port cpOverview_ PUB/chiphi.js:423-463): 6 ô số liệu theo cpTong_ của hạng mục đang chọn,
   biểu đồ theo hạng mục (8 nhóm, bấm để lọc hạng mục) + tỷ trọng giá vốn theo nhà cung cấp (6 nhóm).
   Props: T (cpTong_), scope (dòng của hạng mục), minBien, onMinBien(chuỗi) -> số đã lưu, false khi bị từ chối, onFilter(k), onHm(code), onCollapse(), ready
   (false = dữ liệu dự án chưa tải xong: chưa hiện số tiền vì thiếu Phần thô / chiết khấu báo giá), pending (node thay số) */
export default function CostOverview({ T, scope, minBien, onMinBien, onFilter, onHm, onCollapse, ready, pending }) {
  const [minDraft, setMinDraft] = useState(String(minBien))
  useEffect(() => { setMinDraft(String(minBien)) }, [minBien])
  const w = cpWarnCount_(scope, minBien)
  const ws = WARN.filter(x => w[x[0]])
  const lnCls = T.ln < 0 ? ' neg' : (T.bien < minBien ? ' low' : ' pos')
  const ch = scope.length ? cpOvCharts_(scope, T, minBien) : null
  const v = x => (ready ? dong(x) : pending)
  // Bản gốc vẽ lại ô sau khi đổi: bị từ chối thì về số đang lưu, nhận thì hiện đúng số đã lưu (VD "12.0" -> 12)
  const commitMin = () => {
    if (minDraft === String(minBien)) return
    const r = onMinBien(minDraft)
    setMinDraft(String(r === false || r == null ? minBien : r))
  }
  return (
    <div className="qs-card qs-ct-overview">
      <div className="qs-ct-overview-head">
        <span className="qs-ct-title">Tổng quan chi phí</span>
        <button className="qs-ct-dash-btn" onClick={onCollapse}>Thu gọn</button>
      </div>

      <div className="qs-ct-tiles">
        <div className="qs-ct-tile">
          <span>Giá vốn</span><b>{v(T.von)}</b><small>{T.n} dòng{T.ptVon ? ' + Phần thô' : ''}</small>
        </div>
        <div className="qs-ct-tile">
          <span>Giá bán</span><b>{v(T.net)}</b><small>{T.ck ? `đã trừ CK báo giá ${dong(T.ck)} · chưa VAT` : 'chưa gồm VAT'}</small>
        </div>
        <div className={`qs-ct-tile qs-cp-ln${lnCls}`}>
          <span>Lợi nhuận</span><b>{v(T.ln)}</b><small>{ready ? `biên ${T.bien.toFixed(1)}% trên giá bán` : pending}</small>
        </div>
        <div className="qs-ct-tile">
          <span>VAT {T.vatPct}%</span><b>{v(T.vat)}</b>
        </div>
        <div className="qs-ct-tile total">
          <span>Tổng thanh toán</span><b>{v(T.total)}</b>
        </div>
        <div className={`qs-ct-tile warn${ws.length ? '' : ' qs-cp-ok'}`}>
          <span>Cảnh báo</span>
          <div className="qs-ct-warn-row">
            {ws.length ? ws.map(x => (
              <button key={x[0]} className="qs-ct-warn-chip" title="Lọc các dòng này" onClick={() => onFilter(x[0])}>
                <b>{w[x[0]]}</b> {x[0] === 'thap' ? `biên dưới ${minBien}%` : x[1]}
              </button>
            )) : <b className="qs-cp-okv">Không có dòng nào cần xem lại</b>}
            <label className="qs-ct-min" title="Dòng có biên lợi nhuận (trên giá bán) thấp hơn mức này bị tô vàng">
              Biên tối thiểu
              <input type="number" min="0" max="99" step="any" value={minDraft} onChange={e => setMinDraft(e.target.value)}
                onBlur={commitMin} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
              %
            </label>
          </div>
        </div>
      </div>

      {ch && (
        <div className="qs-ct-charts">
          <div className="qs-ct-chart">
            <div className="qs-ct-chart-head">
              <b>Theo hạng mục</b>
              <span><i className="sale" />giá bán</span><span><i className="cost" />giá vốn · % = biên</span>
            </div>
            {ch.bars.map(b => (
              <div key={b.g.k} className="qs-ct-cat qs-cp-click" onClick={() => onHm(b.g.k === '__k' ? '' : b.g.k)}
                title={`${b.g.ten} — vốn ${money(b.g.t.von)} · bán ${money(b.g.t.ban)} · bấm để xem riêng`}>
                <span className="qs-ct-cat-name">{b.g.ten}</span>
                <div className="qs-ct-cat-bar">
                  <div className="sale" style={{ width: `${b.wBan.toFixed(1)}%` }} />
                  <div className="cost" style={{ width: `${b.wVon.toFixed(1)}%` }} />
                </div>
                <span className="qs-ct-cat-value">{money(b.g.t.ban)}</span>
                <span className={`qs-ct-cat-pct qs-cp-pct${b.cls ? ' ' + b.cls : ''}`}>{b.b.toFixed(1)}%</span>
              </div>
            ))}
            {ch.moreHm > 0 && <div className="qs-ct-empty">+ {ch.moreHm} hạng mục khác</div>}
          </div>
          <div className="qs-ct-chart">
            <div className="qs-ct-chart-head"><b>Tỷ trọng giá vốn theo nhà cung cấp</b></div>
            {ch.ncc.map(s => (
              <div key={s.g.k} className="qs-ct-sup" title={`${s.g.ten}: ${money(s.g.t.von)} đ giá vốn`}>
                <span className="qs-ct-sup-name">{s.g.ten}</span>
                <div className="qs-ct-sup-bar"><div style={{ width: `${s.p.toFixed(1)}%` }} /></div>
                <span className="qs-ct-sup-pct">{s.p.toFixed(1)}%</span>
              </div>
            ))}
            {ch.moreNcc > 0 && <div className="qs-ct-empty">+ {ch.moreNcc} nhà cung cấp khác</div>}
          </div>
        </div>
      )}
    </div>
  )
}
