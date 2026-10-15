import { useEffect, useRef, useState } from 'react'
import QsIcon from '../../common/QsIcon'
import ImgViewer from '../../common/ImgViewer'
import { MrootPortal } from '../../common/Mroot'
import { mediaUrl } from '../../../api/files'
import { money, safeUrl_ } from '../../../lib/format.js'
import { ctOf_, ptVal_, ptLoaiGop_, PT_LOAI } from '../../../lib/phantho.js'
import { projDataSet_ } from '../../../state/projData'
import { qsToast } from '../../common/dialogs'
import { ptInfo_, ptInfoKey_, ptInfoUser_ } from './ptCore'
import { usePtUi } from '../../phantho/ptState'

/* Popup "Thông tin công tác" của Danh sách SP (ptModal_ + ptDetailParts_ + ptInfoEditModal_ / ptInfoSaveModal_ / ptInfoForm_,
   PUB/sanpham.js:1427-1471, phantho.js:1756-1898): 2 cột giống popup Thông tin sản phẩm - ảnh, khối giá, thông tin chính,
   thông số, ghi chú, phạm vi, tài liệu. Công tác CSDL: nút "Sửa công tác" (CtEditModal); bản dựng sẵn: "Sửa thông tin" (qs_ptinfo / projData.ptInfo).
   Props: r (dòng của bảng: {si, ii, sec, a}), ovr, projData, onClose(), onEditCt(ct), onAdd(r) */
const lines_ = t => String(t || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)

function KV({ k, v }) {
  if (v == null || v === '') return null
  const dai = String(v).length > 20 || String(k).length > 14
  return <div className={'qsppt-spec' + (dai ? ' stack' : '')}><span className="k">{k}</span><span className="v">{v}</span></div>
}
function Notes({ text }) {
  const ls = lines_(text); if (!ls.length) return null
  return <div className="qsppt-notes">{ls.map((l, i) => <div key={i} className="qsppt-note">{l}</div>)}</div>
}
function Bullets({ text }) {
  const ls = lines_(text); if (!ls.length) return null
  return <ul className="qsppt-uls">{ls.map((l, i) => <li key={i}>{l}</li>)}</ul>
}
/* Thông số: "## nhóm" -> tiêu đề nhỏ, dòng "Tên: giá trị" -> hàng 2 cột, dòng còn lại -> khối chữ (ptSpecRows_) */
function SpecRows({ text }) {
  const out = []; let buf = []
  const flush = () => { if (buf.length) { out.push(<Notes key={'n' + out.length} text={buf.join('\n')} />); buf = [] } }
  lines_(text).forEach(l => {
    const g = l.match(/^##\s*(.*)$/)
    if (g) { flush(); out.push(<div key={'g' + out.length} className="qsppt-grp">{g[1] || 'Thông số kỹ thuật'}</div>); return }
    const m = l.match(/^([^:：]{2,40})[:：]\s*(.+)$/)
    if (m) { flush(); out.push(<KV key={'k' + out.length} k={m[1].trim()} v={m[2].trim()} />) } else buf.push(l)
  })
  flush()
  return out
}

export default function PtDetailModal({ r, ovr, projData, onClose, onEditCt, onAdd }) {
  const [sua, setSua] = useState(false)
  // S._ptContractor của bản gốc: nhà thầu chọn ở Bóc tách 3.1 trong phiên (phantho/ptState, chỉ đọc)
  const contractor = usePtUi(s => s.contractor)
  const [idx, setIdx] = useState(0)
  const [view, setView] = useState('')
  const sec = r.sec, a = r.a, ii = r.ii
  const ctr = ctOf_(a)
  const ten = String(a[0]), dvt = ptVal_(sec, a, 'dvt', ovr)
  let gc = ptVal_(sec, a, 'gc', ovr)
  const dgBan = (sec.mode === 'area') ? (Number(sec.up) || 0) : ptVal_(sec, a, 'dg', ovr), dgNT = ptVal_(sec, a, 'dgnt', ovr)
  const inf = ctr ? { anh: ctr.hinhAnh || '', model: '', ts: ctr.thongSo || '', gc: '', pv: ctr.phamVi || '', tl: ctr.linkTaiLieu || '' } : ptInfo_(ten, projData)
  const imgs = String(inf.anh || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean).map(mediaUrl)
  const gcGoc = gc; if (inf.gc) gc = inf.gc
  const loai = PT_LOAI.filter(x => x[0] === ptLoaiGop_(sec.loai))[0] || PT_LOAI[0]
  const ln = dgBan - dgNT, lnPct = dgBan ? (ln / dgBan * 100) : 0
  const n = imgs.length, at = n ? (((idx % n) + n) % n) : 0
  const go = d => { if (n > 1) setIdx(i => (((i + d) % n) + n) % n) }
  const goRef = useRef(go); goRef.current = go
  const viewRef = useRef(view); viewRef.current = view
  const closeRef = useRef(onClose); closeRef.current = onClose

  useEffect(() => {
    const key = e => {
      if (viewRef.current) return
      if (e.key === 'Escape') { closeRef.current(); return }
      const t = document.activeElement ? document.activeElement.tagName : ''
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goRef.current(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goRef.current(1) }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])

  const thieu = []
  if (!imgs.length) thieu.push('ảnh'); if (!inf.ts) thieu.push('thông số kỹ thuật')
  if (!gc) thieu.push('ghi chú'); if (!inf.pv) thieu.push('phạm vi ứng dụng')
  const chinh = [['Tên / model', inf.model || ''], ['Hạng mục', String(sec.t).split('\n')[0]], ['Nhà thầu · nhà cung cấp', (ctr && ctr.ncc) || ''],
    ['Đơn vị tính', dvt], ['Loại báo giá', loai[1]], ['Nhà thầu đang chọn', contractor || '']].filter(x => x[1] != null && x[1] !== '')

  const duyet = ctr ? <span className={`qspl-duyet${ctr.daDuyet ? ' on' : ''}`}>{ctr.daDuyet ? 'Đã duyệt' : 'Chưa duyệt'}</span>
    : <span className="qspl-duyet qsppt-mau">Thư viện mẫu</span>

  return (
    <MrootPortal>
      <div className="qsc-ov qspl-ov" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="qspl-pd qsppt-detail" role="dialog" aria-label="Thông tin công tác">
          {sua ? (
            <InfoForm ten={ten} gcGoc={(sec.mode === 'none') ? (a[2] || '') : (a[4] || '')} projData={projData}
              onClose={onClose} onBack={() => setSua(false)} />
          ) : (
            <>
              <div className="qspl-pd-head">
                <h3>Thông tin công tác</h3>
                {duyet}
                <span className="qsppt-pd-loai">{loai[1]}</span>
                <button type="button" className="qspl-pd-x" title="Đóng" onClick={onClose}>✕</button>
              </div>
              <div className="qspl-pdm-grid qsppt-pdm-grid">
                <div className="qspl-pdm-left">
                  {n > 0 && (
                    <div className="qspl-pd-gal">
                      <div className="qspl-pd-imgbox">
                        <img src={imgs[at]} alt="" title="Bấm để xem ảnh lớn" onClick={() => setView(imgs[at])} onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                        {n > 1 && <button type="button" className="qspl-pd-nav prev" title="Ảnh trước (←)" onClick={() => go(-1)}>‹</button>}
                        {n > 1 && <button type="button" className="qspl-pd-nav next" title="Ảnh sau (→)" onClick={() => go(1)}>›</button>}
                        {n > 1 && <span className="qspl-pd-count">{at + 1}/{n}</span>}
                        <a className="qspl-pd-dl" href={safeUrl_(imgs[0])} target="_blank" rel="noopener noreferrer" title="Mở ảnh gốc"><QsIcon name="download" size={14} /></a>
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
                  )}
                  <div className="qspl-pd-code qsppt-pcode">{sec.r}.{ii + 1} · {String(sec.t).split('\n')[0]}</div>
                  <div className="qspl-pd-name">{ten}</div>
                  <div className="qsppt-hero">
                    <div className="qsppt-hero-t">Đơn giá bán</div>
                    <div className="qsppt-hero-v">{money(dgBan)}<i>đ{dvt ? (' / ' + dvt) : ''}</i></div>
                    {(dgNT || ln) ? (
                      <div className="qsppt-hero-r">
                        {dgNT ? <span><em>Giá nhà thầu</em><b>{money(dgNT)} đ</b></span> : null}
                        {(dgBan && dgNT) ? <span><em>Lợi nhuận</em><b className={ln < 0 ? 'neg' : 'ok'}>{money(ln)} đ · {lnPct.toFixed(1)}%</b></span> : null}
                      </div>
                    ) : null}
                  </div>
                  {inf.tl ? (
                    <div className="qsppt-foot2">
                      <a className="qsppt-fbtn" href={safeUrl_(inf.tl)} target="_blank" rel="noopener noreferrer"><QsIcon name="doc" size={14} /> Tài liệu kỹ thuật</a>
                      <a className="qsppt-fbtn" href={safeUrl_(inf.tl)} download target="_blank" rel="noopener noreferrer"><QsIcon name="download" size={14} /> Tải về</a>
                    </div>
                  ) : null}
                </div>
                <div className="qspl-pdm-right qsppt-pdm-right">
                  {chinh.length > 0 && <div className="qspl-pd-block"><div className="qspl-pd-sec qsppt-sec">Thông tin chính</div>{chinh.map(x => <KV key={x[0]} k={x[0]} v={x[1]} />)}</div>}
                  {inf.ts ? <div className="qspl-pd-block"><div className="qspl-pd-sec qsppt-sec">Thông số kỹ thuật tham khảo</div><SpecRows text={inf.ts} /></div> : null}
                  {gc ? (
                    <div className="qspl-pd-block"><div className="qspl-pd-sec qsppt-sec">Ghi chú · điều kiện áp dụng</div><Notes text={gc} />
                      {inf.gc && gcGoc && inf.gc !== gcGoc ? <div className="qsppt-goc">Ghi chú gốc trong bảng giá: {gcGoc}</div> : null}
                    </div>
                  ) : null}
                  {inf.pv ? <div className="qspl-pd-block"><div className="qspl-pd-sec qsppt-sec">Phạm vi ứng dụng</div><Bullets text={inf.pv} /></div> : null}
                  {thieu.length >= 2 ? <div className="qsppt-thieu">Chưa có {thieu.join(' · ')}</div> : null}
                </div>
              </div>
              <div className="qspl-pd-actions">
                <button type="button" className="qsc-btn" onClick={onClose}>Đóng</button>
                {ctr
                  ? <button type="button" className="qsc-btn" onClick={() => onEditCt(ctr)}><QsIcon name="edit" size={14} /> Sửa công tác</button>
                  : <button type="button" className="qsc-btn" onClick={() => setSua(true)}><QsIcon name="edit" size={14} /> Sửa thông tin</button>}
                <button type="button" className="qsc-btn blue" onClick={() => { onAdd(r); onClose() }}><QsIcon name="plus" size={15} /> Thêm vào bảng khái toán</button>
              </div>
            </>
          )}
        </div>
      </div>
      {view && <ImgViewer src={view} gallery={imgs} onClose={() => setView('')} onIndexChange={setIdx} />}
    </MrootPortal>
  )
}

/* Sửa thông tin công tác dựng sẵn (ptInfoForm_ / ptInfoSaveModal_): lưu theo công ty ở projData.ptInfo, dự phòng qs_ptinfo */
function InfoForm({ ten, gcGoc, projData, onClose, onBack }) {
  const inf0 = ptInfo_(ten, projData)
  const [o, setO] = useState({ model: inf0.model, anh: inf0.anh, ts: inf0.ts, gc: inf0.gc, pv: inf0.pv, tl: inf0.tl })
  const fld = (k, lbl, hint, rows, note) => (
    <div className="qsppt-inf-f"><label>{lbl}</label>
      <textarea rows={rows || 2} placeholder={hint} value={o[k] || ''} onChange={e => setO({ ...o, [k]: e.target.value })} />
      {note ? <i className="qsppt-inf-h">{note}</i> : null}
    </div>
  )
  function save() {
    const v = {}; Object.keys(o).forEach(k => { v[k] = String(o[k] || '').replace(/\s+$/, '') })
    const k = ptInfoKey_(ten)
    const U = { ...ptInfoUser_(projData) }
    if (!v.model && !v.anh && !v.ts && !v.gc && !v.pv && !v.tl) delete U[k]; else U[k] = v
    try { localStorage.setItem('qs_ptinfo', JSON.stringify(U)) } catch (e) { /* bỏ qua */ }
    projDataSet_('ptInfo', U)
    qsToast('Đã lưu thông tin công tác'); onBack()
  }
  return (
    <>
      <div className="qspl-pd-head"><h3>Sửa thông tin công tác</h3><button type="button" className="qspl-pd-x" title="Đóng" onClick={onClose}>✕</button></div>
      <div className="qsppt-inf-form">
        <div className="qspl-pd-sec qsppt-sec">Sửa thông tin công tác</div>
        {fld('model', 'Tên / model', 'VD: Giàn tải, máy ép cọc Pmax 90T', 1)}
        {fld('anh', 'Ảnh (mỗi dòng 1 link)', 'https://… (dán link ảnh, mỗi dòng một ảnh)', 2)}
        {fld('ts', 'Thông số kỹ thuật (mỗi dòng "Tên: giá trị")', 'Lực ép tối đa (Pmax): 90 tấn\nLoại cọc phù hợp: vuông 250×250, tròn ly tâm D300', 5)}
        {fld('gc', 'Ghi chú · điều kiện áp dụng', gcGoc || 'VD: Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)', 3,
          gcGoc ? 'Để trống = dùng ghi chú gốc trong bảng giá thư viện.' : 'Công tác này chưa có ghi chú gốc — nhập ở đây để hiện trên panel.')}
        {fld('pv', 'Phạm vi ứng dụng (mỗi dòng 1 ý)', 'Nhà phố, biệt thự, công trình tải trung bình\nYêu cầu mặt bằng thi công', 3)}
        {fld('tl', 'Link tài liệu kỹ thuật', 'https://…', 1)}
        <div className="qsppt-inf-act">
          <button type="button" className="qsc-btn" onClick={onBack}>Huỷ</button>
          <button type="button" className="qsc-btn blue" onClick={save}><QsIcon name="check" size={14} /> Lưu thông tin</button>
        </div>
      </div>
    </>
  )
}
