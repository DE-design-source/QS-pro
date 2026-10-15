import { chipGroupVals_, ctColor, brandOptions, comboCounts_, favCount_, FLT_REG, fltHien_, fltPinned_ } from '../../lib/catalogFilters.js'
import { setF, toggleFsec, toggleIn } from './catalog/filterStore'

/* Các khối lọc đang hiện trên panel danh mục (port renderFilters / chipGroup / renderVsFilters_ / favChips_ / comboChips_ /
   fltApplyPins_, PUB/app.js:476-664, 913-964). Props:
     st       trạng thái lọc (catalog/filterStore)
     node     đề mục đang bóc
     products danh mục đầy đủ (chip đèn, thương hiệu, combo, yêu thích đếm trên toàn bộ danh mục như bản gốc)
     vsModel  kết quả vsFilterModel_ (null khi đề mục không có spec riêng)
     hideDen  ẩn Công suất / Nhiệt độ / Góc chiếu (đề mục có thư viện công tác, app.js:1022) */
const DEN = {
  watt: { field: 'congSuat', map: 'fWatt', wide: true },
  kelvin: { field: 'nhietDo', map: 'fKelvin', dot: true },
  angle: { field: 'gocChieu', map: 'fAngle' },
}

export default function FilterSections({ st, node, products, vsModel, hideDen }) {
  const out = []

  function sec(foldKey, title, badge, body) {
    const open = st.fsecOpen[foldKey] !== false
    out.push(
      <div key={foldKey} className="qs-bd-fsec">
        <button className="qs-bd-fsec-head" onClick={() => toggleFsec(foldKey)}>
          <span>{title}{badge ? <em className="qs-bdc-fn">{badge}</em> : null}</span>
          <span className={`qs-bd-tri up${open ? '' : ' closed'}`} />
        </button>
        {open && body}
      </div>,
    )
  }
  const none = <div className="qs-bd-fchips"><span className="qs-bdc-nil">—</span></div>

  /* Ngành có spec (vệ sinh / sơn / công tắc): khối Hạng mục + thông số dạng chọn của hạng mục */
  if (vsModel) {
    if (vsModel.noSpec) out.push(<p key="nospec" className="qs-bd-hint qs-bdc-err">Không tải được thông số ngành</p>)
    vsModel.sections.forEach(s => {
      if (!fltHien_(st.fltShow, 'vs_' + s.key)) return
      const chips = s.chips.length ? (
        <div className="qs-bd-fchips">
          {s.chips.map(c => (
            <button key={c.v} className={`qs-bd-fchip${c.on ? ' on' : ''}`}
              onClick={() => (c.c === '__hm' ? toggleIn('fNhomSet', c.v) : setF(f => {
                const o = { ...(f.fVs[c.c] || {}) }
                if (o[c.v]) delete o[c.v]; else o[c.v] = 1
                return { fVs: { ...f.fVs, [c.c]: o } }
              }))}>
              {c.v}<small>{c.n}</small>
            </button>
          ))}
        </div>
      ) : none
      sec('vs_' + s.key, s.title, s.selN ? s.selN + ' đã chọn' : '', chips)
    })
    if (vsModel.note) out.push(<p key="note" className="qs-bd-hint in-list">Chọn 1 hạng mục để lọc theo thông số riêng của hạng mục đó.</p>)
  }

  /* Khối cố định theo thứ tự FLT_REG (fltApplyPins_) */
  FLT_REG.forEach(([k, title]) => {
    if (!fltPinned_(st.fltShow, k, node)) return
    const den = DEN[k]
    if (den) {
      if (hideDen) return
      const g = chipGroupVals_(products, den.field, st[den.map])
      sec(k, title, g.badge, g.all.length ? (
        <div className="qs-bd-fchips">
          {g.all.map(v => (
            <button key={v} title={v} className={`qs-bd-fchip${den.wide ? ' qs-bdc-wide' : ''}${st[den.map][v] ? ' on' : ''}`} onClick={() => toggleIn(den.map, v)}>
              {den.dot && <span className="qs-bdc-dot" style={{ background: ctColor(v) }} />}{v}
            </button>
          ))}
        </div>
      ) : none)
    } else if (k === 'yeuthich') {
      sec(k, title, st.fFav ? '1' : '', (
        <div className="qs-bd-fchips">
          <button className={`qs-bd-fchip${st.fFav ? ' on' : ''}`} onClick={() => setF(f => ({ fFav: !f.fFav }))}>
            ♥ Chỉ sản phẩm yêu thích<small>{favCount_(products)}</small>
          </button>
        </div>
      ))
    } else if (k === 'combo') {
      const n = comboCounts_(products)
      sec(k, title, st.fCombo ? '1' : '', (
        <div className="qs-bd-fchips">
          {[['co', 'Có', n.co], ['khong', 'Không có', n.khong]].map(([v, lb, c]) => (
            <button key={v} className={`qs-bd-fchip${st.fCombo === v ? ' on' : ''}`} onClick={() => setF(f => ({ fCombo: f.fCombo === v ? '' : v }))}>
              {lb}<small>{c}</small>
            </button>
          ))}
        </div>
      ))
    } else if (k === 'brand') {
      sec(k, title, '', (
        <div className="qs-bd-fbrand">
          <select value={st.fBrand} onChange={e => setF({ fBrand: e.target.value })}>
            <option value="">Tất cả thương hiệu</option>
            {brandOptions(products).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <span>+</span>
        </div>
      ))
    } else if (k === 'price') {
      sec(k, title, '', (
        <div className="qs-bd-fprice">
          <span>Giá từ</span>
          <input type="number" value={st.min} onChange={e => setF({ min: e.target.value })} />
          <span>Tới</span>
          <input type="number" value={st.max} onChange={e => setF({ max: e.target.value })} />
        </div>
      ))
    }
  })
  return out
}
