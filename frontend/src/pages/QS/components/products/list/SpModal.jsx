import { useEffect, useRef, useState } from 'react'
import QsIcon from '../../common/QsIcon'
import ImgViewer from '../../common/ImgViewer'
import ProductThumb from '../../common/ProductThumb'
import { MrootPortal } from '../../common/Mroot'
import { DocRows, safeUrl_ } from '../../common/DocsPopover'
import * as api from '../../../api/qsApi'
import { isAbort } from '../../../api/http'
import { mediaUrl } from '../../../api/files'
import { money } from '../../../lib/format.js'
import { coSpec_, nganhCuaSP_, prodDocs_ } from '../../../lib/productFields.js'
import { pdImgs_, pdKeyItems_, pdSpecBlocks_ } from '../../breakdown/catalog/catalogModel'
import { putCombo } from '../../breakdown/catalog/comboCache'
import { spKey_ } from './spModel'
import { spAddToProject, spAddCombo } from './spActions'

/* Modal "Thông tin sản phẩm" của tab Danh sách SP (spModal, PUB/sanpham.js:1827-1848): ảnh + thông số (pdMedia_ / pdSpecs_ /
   pdPriceFoot_, app.js:1076-1282), khối "Sản phẩm đi kèm" ghi vào DỰ ÁN (pdLoadCombo_ / pdComboVe_ / pdCbBoSet_ / pdCbSL_ /
   pdAddCombo_, sanpham.js:1849-1930), ←/→ lật ảnh, Esc đóng (spModalKey_).
   Props: product, specs ({VS_SPEC,...} | null), specErr, canEdit, onClose(), onEdit(product). */
export default function SpModal({ product, specs, specErr, canEdit, onClose, onEdit }) {
  const p = product || {}
  const imgs = pdImgs_(p).map(v => mediaUrl(v))
  const [idx, setIdx] = useState(0)
  const [view, setView] = useState('')
  const [bad, setBad] = useState('')
  const n = imgs.length
  const at = n ? (((idx % n) + n) % n) : 0
  const go = d => { if (n > 1) setIdx(i => (((i + d) % n) + n) % n) }
  const goRef = useRef(go); goRef.current = go
  const viewRef = useRef(view); viewRef.current = view
  const closeRef = useRef(onClose); closeRef.current = onClose

  useEffect(() => {
    const key = e => {
      if (viewRef.current) return                       // đang xem ảnh lớn: ImgViewer lo phím
      const a = document.activeElement, tg = a ? a.tagName : ''
      if (e.key === 'Escape') { closeRef.current(); return }
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goRef.current(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goRef.current(1) }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])

  const ng = nganhCuaSP_(p, specs)
  const keyItems = pdKeyItems_(p, specs)
  const blocks = pdSpecBlocks_(p, specs)
  const docs = prodDocs_(p)
  const specMissing = coSpec_(ng) && !specs
  const main = imgs[at]

  return (
    <MrootPortal>
      <div className="qsc-ov qspl-ov" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="qspl-pd" role="dialog" aria-label="Thông tin sản phẩm">
          <div className="qspl-pd-head">
            <h3>Thông tin sản phẩm</h3>
            <span className={`qspl-duyet${p.daDuyet ? ' on' : ''}`}>{p.daDuyet ? 'Đã duyệt' : 'Chưa duyệt'}</span>
            <button type="button" className="qspl-pd-x" title="Đóng" onClick={onClose}>✕</button>
          </div>
          <div className="qspl-pdm-grid">
            <div className="qspl-pdm-left">
              <div className="qspl-pd-gal">
                <div className="qspl-pd-imgbox">
                  {main
                    ? <img src={main} alt="" title="Bấm để xem ảnh lớn" style={bad === main ? { visibility: 'hidden' } : null}
                        onError={() => setBad(main)} onClick={() => setView(main)} />
                    : <span className="qspl-pd-noimg"><QsIcon name="image" size={26} /><i>Chưa có ảnh</i></span>}
                  {n > 1 && <button type="button" className="qspl-pd-nav prev" title="Ảnh trước (←)" onClick={() => go(-1)}>‹</button>}
                  {n > 1 && <button type="button" className="qspl-pd-nav next" title="Ảnh sau (→)" onClick={() => go(1)}>›</button>}
                  {n > 1 && <span className="qspl-pd-count">{at + 1}/{n}</span>}
                  {main && <a className="qspl-pd-dl" href={safeUrl_(imgs[0])} target="_blank" rel="noopener noreferrer" title="Mở ảnh gốc"><QsIcon name="download" size={14} /></a>}
                </div>
                {n > 1 && (
                  <div className="qspl-pd-thumbs">
                    {imgs.map((v, i) => (
                      <button type="button" key={i} className={`qspl-pd-thumb${i === at ? ' on' : ''}`} title={'Ảnh ' + (i + 1)} onClick={() => setIdx(i)}>
                        <img src={v} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="qspl-pd-code">{p.ma || p.ten}</div>
              {p.ten && <div className="qspl-pd-name">{p.ten}</div>}
              {keyItems.length > 0 && (
                <>
                  <div className="qspl-pd-sec">Key Product Info <i>(Thông tin chính)</i></div>
                  <div className="qspl-pd-keys">
                    {keyItems.map((x, i) => <div key={i} className="qspl-pd-key"><span className="ic"><QsIcon name={x[0]} size={15} /></span><span>{x[1]}</span></div>)}
                  </div>
                </>
              )}
              <div className="qspl-pd-sec">Tài liệu <i>({docs.length} file)</i></div>
              {docs.length
                ? <div className="qspl-pd-docs"><DocRows docs={docs} /></div>
                : <div className="qspl-pd-nodoc">Sản phẩm chưa có tài liệu — thêm ở Nhập dữ liệu hoặc Sửa sản phẩm.</div>}
              <div className="qspl-pd-price"><span>Đơn giá</span><b>{money(p.donGiaBan)} đ</b></div>
            </div>
            <div className="qspl-pdm-right">
              {specMissing && <div className="qspl-note err">{specErr ? 'Không tải được thông số ngành' : 'Đang tải thông số ngành…'}</div>}
              {blocks.map((b, i) => (
                <div key={i} className="qspl-pd-block">
                  <div className="qspl-pd-sec">{b.en}{b.vn ? <> <i>({b.vn})</i></> : null}</div>
                  {b.type === 'bullets'
                    ? <ul className="qspl-pd-list">{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
                    : b.rows.map((r, j) => (r[0] == null
                      ? <div key={j} className="qspl-pd-kv"><b className="line">{r[1]}</b></div>
                      : <div key={j} className="qspl-pd-kv"><span>{r[0]}</span><b>{r[1]}</b></div>))}
                </div>
              ))}
            </div>
          </div>
          <SpCombo key={spKey_(p)} product={p} />
          <div className="qspl-pd-actions">
            <button type="button" className="qsc-btn" onClick={onClose}>Đóng</button>
            {canEdit && !p.spChung && <button type="button" className="qsc-btn" onClick={() => { onClose(); onEdit(p) }}><QsIcon name="edit" size={14} /> Cập nhật</button>}
            <button type="button" className="qsc-btn blue" onClick={() => spAddToProject(p)}><QsIcon name="plus" size={15} /> Thêm vào dự án</button>
          </div>
        </div>
      </div>
      {view && <ImgViewer src={view} gallery={imgs} onClose={() => setView('')} onIndexChange={i => setIdx(i)} />}
    </MrootPortal>
  )
}

/* Ô số SL / Số bộ: đổi xong (rời ô / Enter) mới tính lại, ô trống giữ số cũ (onchange của bản gốc) */
function NumIn({ value, onCommit, ...rest }) {
  const [d, setD] = useState(String(value))
  useEffect(() => { setD(String(value)) }, [value])
  return (
    <input type="number" min="1" step="1" {...rest} value={d}
      onChange={e => setD(e.target.value)}
      onBlur={() => { if (d !== '') onCommit(d); else setD(String(value)) }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
  )
}

/* Khối "Sản phẩm đi kèm": số bộ (1-999), SL kèm mỗi dòng (1-9999, sửa tạm không lưu), "Thêm combo" vào dự án */
function SpCombo({ product }) {
  const k = spKey_(product)
  const [st, setSt] = useState({ loading: !!k, list: [], error: '' })
  const [bo, setBo] = useState(1)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!k) return undefined
    const ctl = new AbortController()
    api.getCombo(k, ctl.signal).then(list => {
      list = list || []
      putCombo(k, list)        // bản SAO cho thư viện / dòng combo của bảng (S._catCb)
      setSt({ loading: false, list: list.map(x => ({ ...x })), error: '' })
    }, e => {
      if (isAbort(e)) return
      setSt({ loading: false, list: [], error: (e && e.message) || 'lỗi' })
    })
    return () => ctl.abort()
  }, [k])

  if (st.error) return <div className="qspl-note err">Không tải được sản phẩm đi kèm: {st.error}</div>
  const list = st.list
  if (!list.length) return null
  const boN = Math.max(1, Math.min(999, Number(bo) || 1))
  const tong = list.reduce((a, x) => a + (Number(x.donGiaBan) || 0) * (Number(x.comboSL) || 1) * boN, 0)
  const setBoTo = v => setBo(Math.max(1, Math.min(999, Math.round(Number(String(v).replace(',', '.')) || 0) || 1)))
  const setSl = (j, v) => setSt(s => ({
    ...s,
    list: s.list.map((x, i) => (i === j ? { ...x, comboSL: Math.max(1, Math.min(9999, Math.round(Number(String(v).replace(',', '.')) || 0) || 1)) } : x)),
  }))
  async function addAll() {
    if (busy) return
    setBusy(true)
    try { await spAddCombo(product, list, boN) } finally { setBusy(false) }
  }

  return (
    <div className="qspl-pcb">
      <div className="qspl-pcb-h"><span className="t"><QsIcon name="layers" size={14} /> Sản phẩm đi kèm</span><span className="n">{list.length}</span></div>
      <div className="qspl-pcb-list">
        {list.map((x, j) => {
          const sl = Number(x.comboSL) || 1, dg = Number(x.donGiaBan) || 0, slTong = sl * boN
          return (
            <div key={j} className="qspl-pcb-r" title={x.comboNguoc ? 'Liên kết đặt từ phía sản phẩm kia — đi kèm 2 chiều' : undefined}>
              <ProductThumb product={x} size={34} src={x.hinhAnh ? mediaUrl(String(x.hinhAnh).split('\n')[0].trim()) : ''} />
              <div className="qspl-pcb-m">
                <b>{x.ten || ''}{x.comboNguoc && <span className="rev"> ↔</span>}</b>
                <span>{x.ma || ''}{x.ma ? ' · ' : ''}{money(dg)} đ</span>
                {String(x.comboGhiChu || '').trim() && (
                  <span className="qspl-pcb-gc" title="Ghi chú của sản phẩm đi kèm"
                    style={{ color: 'var(--text)', fontStyle: 'italic', whiteSpace: 'normal', wordBreak: 'break-word' }}>Ghi chú: {String(x.comboGhiChu).trim()}</span>
                )}
              </div>
              <div className="qspl-pcb-p">
                <b>{money(dg * slTong)} đ</b>
                <label title="Số lượng đi kèm cho MỖI bộ">SL <NumIn value={sl} onClick={e => e.stopPropagation()} onCommit={v => setSl(j, v)} />
                  {boN > 1 && <em>× {boN} = {slTong}</em>}</label>
              </div>
            </div>
          )
        })}
      </div>
      <div className="qspl-pcb-tot"><span>Tổng {boN > 1 ? boN + ' bộ' : 'combo'}</span><b>{money(tong)} đ</b></div>
      <div className="qspl-pcb-ft">
        <span className="qspl-pcb-bo" title="Số bộ combo cần thêm"><label>Số bộ</label>
          <button type="button" onClick={() => setBoTo(boN - 1)} aria-label="Bớt 1 bộ">−</button>
          <NumIn value={boN} onCommit={setBoTo} />
          <button type="button" onClick={() => setBoTo(boN + 1)} aria-label="Thêm 1 bộ">+</button></span>
        <button type="button" className="qsc-btn blue qspl-pcb-add" disabled={busy} title="Thêm sản phẩm chính và toàn bộ sản phẩm đi kèm vào dự án" onClick={addAll}>
          <QsIcon name="plus" size={14} /> Thêm {boN > 1 ? boN + ' bộ' : 'combo'}
        </button>
      </div>
    </div>
  )
}
