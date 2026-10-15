import { useEffect, useRef, useState } from 'react'
import { money } from '../../../lib/format'
import { nganhCuaSP_ } from '../../../lib/productFields'
import QsIcon from '../../common/QsIcon'
import { qsToast } from '../../common/dialogs'
import { imgSrc1_, cbLbl_, btLbl_, spMauCss_, cbSuggest_, btSuggest_, btCungMa_, btItem_ } from './editModel'

/* Khối "Sản phẩm liên quan" của modal Sửa: tab Đi kèm (combo) + Biến thể (port cbSection_ / cbRender_ / cbSearch_ / cbAdd_ /
   btRender_ / btSearch_ / btAdd_ / cbTab_ / cbOutside_, PUB/sanpham.js:1994-2159, 2391-2394).
   Props: me (SP đang sửa, object danh sách), products, specs, combo / setCombo, bt / setBt, tab / setTab ('combo' | 'bt'),
          onQuickVariants() (mở "Tạo nhanh biến thể"; chỉ hiện khi SP có mã và không phải SP chung). */
export default function RelatedBox({ me, products, specs, combo, setCombo, bt, setBt, tab, setTab, onQuickVariants }) {
  const [cbQ, setCbQ] = useState('')
  const [btQ, setBtQ] = useState('')
  const [cbOpen, setCbOpen] = useState(false)
  const [btOpen, setBtOpen] = useState(false)
  const cbIn = useRef(null)
  const btIn = useRef(null)
  const curId = me ? me.recordId : ''
  const isVS = nganhCuaSP_(me, specs) === 'vs'

  // bấm ra ngoài ô tìm thì đóng gợi ý
  useEffect(() => {
    function out(e) { if (e.target.closest && e.target.closest('.qspe-cb-find')) return; setCbOpen(false); setBtOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [])

  function cbAdd(p) {
    if (String(p.recordId) === String(curId)) { qsToast('Không thể cho sản phẩm đi kèm chính nó'); return }
    if (combo.some(x => String(x.recordId) === String(p.recordId))) { qsToast('Sản phẩm này đã có trong combo'); return }
    setCombo(c => c.concat([{ recordId: p.recordId, ma: p.ma, ten: p.ten, hinhAnh: p.hinhAnh, donGiaBan: p.donGiaBan, comboSL: 1, comboGhiChu: '' }]))
    setCbQ(''); setCbOpen(true)
    if (cbIn.current) cbIn.current.focus()
  }
  function btAdd(p) {
    if (String(p.recordId) === String(curId)) { qsToast('Không thể gom sản phẩm với chính nó'); return }
    if (bt.some(x => String(x.recordId) === String(p.recordId))) { qsToast('Sản phẩm này đã có trong nhóm biến thể'); return }
    if (String(p.nhomBT || '').trim()) qsToast('Sản phẩm này đang ở nhóm biến thể khác — lưu xong sẽ chuyển sang nhóm này')
    setBt(b => b.concat([btItem_(p)]))
    setBtQ(''); setBtOpen(false)
    if (btIn.current) btIn.current.focus()
  }

  const cbSug = cbOpen ? cbSuggest_(cbQ, me, curId, combo, products, specs) : { show: false }
  const btSug = btOpen ? btSuggest_(btQ, curId, bt, products) : { show: false }
  const cungMa = btCungMa_(me, bt, products)
  const img = (src, cls) => src
    ? <img className={cls} src={imgSrc1_(src)} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
    : <span className="qspe-cb-img" />

  return (
    <div className="qspe-cb-box">
      <div className="qspe-cb-h"><QsIcon name="layers" size={15} /> Sản phẩm liên quan
        <div className="qspe-cb-tabs">
          <button type="button" className={`qspe-cb-tab${tab === 'combo' ? ' on' : ''}`} onClick={() => setTab('combo')}>
            Đi kèm (combo)<span className="qspe-cb-n">{combo.length}</span></button>
          <button type="button" className={`qspe-cb-tab bt${tab === 'bt' ? ' on' : ''}`} onClick={() => setTab('bt')}>
            Biến thể<span className="qspe-cb-n">{bt.length + cungMa.length}</span></button>
        </div>
      </div>
      <div style={tab === 'combo' ? undefined : { display: 'none' }}>
        <p className="qspe-cb-note">{isVS
          ? 'Chọn các thiết bị luôn bán/lắp cùng sản phẩm này (VD bồn cầu + nắp rửa điện tử + vòi xịt, lavabo + vòi lavabo + bộ xả). '
          : 'Chọn các sản phẩm luôn bán/lắp cùng sản phẩm này (bộ nguồn, thanh ray…). '}Khi thêm vào dự án có thể thêm cả combo một lượt.</p>
        <div className="qspe-cb-find">
          <input ref={cbIn} placeholder="Tìm theo tên, mã hoặc thương hiệu…" autoComplete="off" value={cbQ}
            onChange={e => { setCbQ(e.target.value); setCbOpen(true) }} onFocus={() => setCbOpen(true)} />
          {cbSug.show && (
            <div className="qspe-cb-sug-box">
              {cbSug.hits.length ? <>
                {cbSug.title ? <div className="qspe-cb-sug-h">{cbSug.title}</div> : null}
                {cbSug.hits.map(p => {
                  const lbl = cbLbl_(p, specs)
                  return (
                    <button type="button" key={p.recordId} className="qspe-cb-sug" onMouseDown={e => e.preventDefault()} onClick={() => cbAdd(p)}>
                      {img(p.hinhAnh)}
                      <span className="qspe-cb-sug-nm">{p.ten || ''}<i>{(p.ma || '') + (lbl ? ' · ' + lbl : '') + (p.donGiaBan ? ' · ' + money(p.donGiaBan) + 'đ' : '')}</i></span>
                    </button>
                  )
                })}
              </> : <div className="qspe-cb-empty">Không tìm thấy sản phẩm khớp.</div>}
            </div>
          )}
        </div>
        <div className="qspe-cb-list">
          {combo.length ? combo.map(x => (
            <div className="qspe-cb-item" key={x.recordId}>
              {img(x.hinhAnh, 'qspe-cb-img')}
              <div className="qspe-cb-info">
                <div className="qspe-cb-nm" title={x.ten || ''}>{x.ten || ''}
                  {x.comboNguoc && <span className="qspe-cb-rev" title={'Liên kết được đặt từ phía sản phẩm này (bộ gồm 1 ' + (x.ma || '') + ' + ' + (Number(x.comboBoSL) || 1) + ' sản phẩm đang mở). Bỏ ở đây thì bên kia cũng mất.'}>↔ hai chiều</span>}
                </div>
                <div className="qspe-cb-sub">{(x.ma || '') + (x.donGiaBan ? ' · ' + money(x.donGiaBan) + 'đ' : '')}</div>
                {x.comboNguoc ? (
                  // liên kết ngược: ghi chú thuộc dòng liên kết của sản phẩm kia -> chỉ xem (M10.2)
                  <div className="qspe-cb-gc ro" title={'Ghi chú do sản phẩm ' + (x.ma || '') + ' đặt — muốn sửa thì mở sản phẩm ' + (x.ma || '') + ' ra sửa'}>
                    {String(x.comboGhiChu || '').trim()
                      ? <><QsIcon name="edit" size={11} /> {x.comboGhiChu}</>
                      : <i>Không có ghi chú.</i>}
                    <span className="qspe-cb-gc-hint"> Sửa ghi chú ở sản phẩm kia ({x.ma || ''}).</span>
                  </div>
                ) : (
                  <input className="qspe-cb-gc" type="text" placeholder="Ghi chú cho sản phẩm đi kèm này (tuỳ chọn)" aria-label={'Ghi chú đi kèm ' + (x.ma || '')}
                    value={x.comboGhiChu || ''}
                    onChange={e => { const v = e.currentTarget.value; setCombo(c => c.map(y => String(y.recordId) === String(x.recordId) ? { ...y, comboGhiChu: v } : y)) }} />
                )}
              </div>
              <label className="qspe-cb-sl" title="Số lượng đi kèm cho mỗi sản phẩm chính">×
                <input type="number" min="0" step="1" defaultValue={Number(x.comboSL) || 1}
                  onInput={e => { const v = Math.max(0, Number(e.currentTarget.value) || 0); setCombo(c => c.map(y => String(y.recordId) === String(x.recordId) ? { ...y, comboSL: v } : y)) }} />
              </label>
              <button type="button" className="qspe-cb-del" title="Bỏ khỏi combo" onClick={() => setCombo(c => c.filter(y => String(y.recordId) !== String(x.recordId)))}><QsIcon name="x" size={14} /></button>
            </div>
          )) : <div className="qspe-cb-empty">Chưa chọn sản phẩm nào đi kèm. Gõ tên/mã ở ô trên để tìm và thêm.</div>}
        </div>
      </div>
      <div style={tab === 'bt' ? undefined : { display: 'none' }}>
        <p className="qspe-cb-note">Gom các sản phẩm là CÙNG một sản phẩm nhưng khác thông số ({isVS ? 'màu sắc, kích thước' : 'công suất, nhiệt độ màu, góc chiếu, màu'}). Bảng Danh sách SP và thư viện Bóc tách sẽ gộp chúng thành một dòng, bung ra mới thấy từng biến thể.</p>
        {me && me.ma && !me.spChung && onQuickVariants
          ? <button type="button" className="qspe-btn blue sm qspe-nbt-open" onClick={onQuickVariants}><QsIcon name="layers" size={14} /> Tạo nhanh biến thể</button>
          : null}
        <div className="qspe-cb-find">
          <input ref={btIn} placeholder="Tìm biến thể theo tên, mã hoặc thương hiệu…" autoComplete="off" value={btQ}
            onChange={e => { setBtQ(e.target.value); setBtOpen(true) }} />
          {btSug.show && (
            <div className="qspe-cb-sug-box">
              {btSug.hits.length ? btSug.hits.map(p => {
                const lbl = btLbl_(p)
                return (
                  <button type="button" key={p.recordId} className="qspe-cb-sug" onClick={() => btAdd(p)}>
                    {img(p.hinhAnh)}
                    <span className="qspe-cb-sug-nm">{p.ten || ''}<i>{(p.ma || '') + (lbl ? ' · ' + lbl : '')}</i></span>
                  </button>
                )
              }) : <div className="qspe-cb-empty">Không tìm thấy sản phẩm khớp.</div>}
            </div>
          )}
        </div>
        <div className="qspe-cb-list">
          {bt.length ? bt.map(x => {
            const lbl = btLbl_(x)
            return (
              <div className="qspe-cb-item" key={x.recordId}>
                {img(x.hinhAnh, 'qspe-cb-img')}
                <div className="qspe-cb-info">
                  <div className="qspe-cb-nm" title={x.ten || ''}>{x.ten || ''}</div>
                  <div className="qspe-cb-sub">{(x.ma || '') + (lbl ? ' · ' + lbl : '') + (x.donGiaBan ? ' · ' + money(x.donGiaBan) + 'đ' : '')}</div>
                </div>
                <button type="button" className="qspe-cb-del" title="Bỏ khỏi nhóm biến thể" onClick={() => setBt(b => b.filter(y => String(y.recordId) !== String(x.recordId)))}><QsIcon name="x" size={14} /></button>
              </div>
            )
          }) : <div className="qspe-cb-empty">Chưa gom tay sản phẩm khác mã nào — ô tìm ở trên dùng khi muốn gom cả sản phẩm khác mã.</div>}
          {cungMa.length ? (
            <div className="qspe-bt-auto"><b>Cùng mã {me.ma} — tự động là biến thể ({cungMa.length}):</b>{' '}
              {cungMa.map(x => {
                const c = spMauCss_(x.mauSac)
                return (
                  <span className="qspe-bt-auto-i" key={x.recordId}>
                    <i style={c ? { background: c } : undefined} className={c ? undefined : 'qspe-mau-x'} />
                    {(btLbl_(x) || x.ten || '') + (x.donGiaBan ? ' · ' + money(x.donGiaBan) + 'đ' : '')}
                  </span>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
