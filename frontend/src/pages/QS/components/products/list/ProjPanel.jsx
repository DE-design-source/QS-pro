import { useState } from 'react'
import QsIcon from '../../common/QsIcon'
import ProductThumb from '../../common/ProductThumb'
import { mediaUrl } from '../../../api/files'
import { dezonUrl_, dezonLinkIn_ } from '../../../lib/dashModel.js'
import { spRemoveFromProject } from './spActions'

/* Panel trái "Sản phẩm trong dự án" (renderSpProjPanel_, spSwitchProject, dezonChip_/dezonSet_ - PUB/sanpham.js:46-79, dash.js:11-38).
   Props: qs (useQs()), dragOn (đang kéo SP từ bảng), onDropList() -> thả vào panel, onHide() thu gọn panel. */
const img1 = v => mediaUrl(String(v || '').split('\n')[0].trim())

export default function ProjPanel({ qs, dragOn, onDrop, onHide }) {
  const { cur, projects, lines, selectProject, mutate, toast, ask, confirm } = qs
  const [over, setOver] = useState(false)
  const n = cur ? (lines || []).length : 0

  async function switchProject(v) {
    if (v === '__new__') { await createProject(); return }
    if (!v) return
    await selectProject(v)
  }
  /* Form "Tạo dự án mới" của bản gốc (#mCreate, index.html:6798-6808 · doCreate app.js:450-461) */
  async function createProject() {
    const r = await ask({
      title: 'Tạo dự án mới', ok: 'Lưu dự án',
      fields: [
        { key: 'ten', label: 'Tên dự án *', placeholder: 'VD: Nhà phố anh Thành' },
        { key: 'khachHang', label: 'Khách hàng' },
        { key: 'sdt', label: 'Số điện thoại' },
        { key: 'diaChi', label: 'Địa chỉ' },
        { key: 'linkDezon', label: 'Link dự án trên Dezon (tuỳ chọn)', placeholder: 'https://dezon.vn/…' },
        { key: 'vat', label: 'VAT (%)', type: 'number', value: '0' },
      ],
    })
    if (!r) return
    const ten = String(r.ten || '').trim()
    if (!ten) { toast('Nhập tên dự án'); return }
    try {
      const link = String(r.linkDezon || '').trim()
      await mutate.createProject({ ten, khachHang: r.khachHang || '', sdt: r.sdt || '', diaChi: r.diaChi || '',
        linkDezon: link ? dezonUrl_(link) : '', vat: Number(r.vat) || 0 })
      toast('Đã tạo bản nháp')
    } catch (e) { toast('Lỗi: ' + ((e && e.message) || e)) }
  }
  async function setLink() {
    const p = cur
    const v0 = await ask({ title: 'Link bài dự án trên dezon.vn', label: 'Dán link (để trống = bỏ link)', required: false,
      value: p.linkDezon || 'https://dezon.vn/', placeholder: 'https://dezon.vn/du-an/…', ok: 'Lưu link' })
    if (v0 == null) return
    const L = dezonLinkIn_(v0 && v0.v != null ? v0.v : v0)
    if (L.la && !await confirm('Link này không thuộc dezon.vn:\n' + L.v + '\n\nVẫn lưu?')) return
    try {
      await mutate.updateProject(p.maDA, { linkDezon: L.v })
      toast(L.v ? 'Đã gắn link Dezon cho dự án' : 'Đã bỏ link Dezon')
    } catch (e) { toast('Lỗi lưu link: ' + ((e && e.message) || e)) }
  }

  const link = cur ? String(cur.linkDezon || '').trim() : ''
  const chip = !cur ? null : link
    ? <a className="qspl-dz on" href={dezonUrl_(link)} target="_blank" rel="noopener" title={'Mở bài dự án trên dezon.vn — ' + dezonUrl_(link)}><QsIcon name="link" size={12} /><span>Dezon</span></a>
    : <button type="button" className="qspl-dz" title="Chưa gắn link bài dự án trên dezon.vn — bấm để dán link" onClick={setLink}><QsIcon name="link" size={12} /><span>Gắn link</span></button>

  return (
    <div
      className={`qspl-pp${dragOn ? ' drop-ready' : ''}${over ? ' drop-over' : ''}`}
      onDragOver={e => { if (!dragOn) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy' } catch (x) { /* bỏ qua */ } setOver(true) }}
      onDragLeave={e => { if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) setOver(false) }}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop() }}
    >
      <div className="qspl-pp-head">
        <span className="qspl-pp-ic"><QsIcon name="layers" size={16} /></span>
        <h3>Sản phẩm trong dự án</h3>
        <span className="qspl-pp-count">{n}</span>
        {chip}
        <button type="button" className="qspl-pp-hide" title="Thu gọn panel (mở rộng bảng)" onClick={onHide}><QsIcon name="left" size={14} /></button>
      </div>
      <select className="qspl-pp-sel" value={cur ? cur.maDA : ''} onChange={e => switchProject(e.target.value)}>
        <option value="">— Chọn hoặc tạo dự án —</option>
        {(projects || []).map(p => <option key={p.maDA} value={p.maDA}>{p.ten}</option>)}
        <option value="__new__">＋ Tạo dự án mới…</option>
      </select>
      {!cur
        ? <div className="qspl-pp-empty">Chưa chọn dự án.<br />Chọn dự án ở trên để bắt đầu ghi danh sản phẩm.</div>
        : (
          <>
            <div className="qspl-pp-sub2">Danh sách sản phẩm tham gia dự án</div>
            <div className="qspl-pp-list">
              {(lines || []).length ? lines.map(l => {
                const sub = [l.kichThuoc, l.tang].map(x => String(x || '').trim()).filter(Boolean).join(' · ')
                return (
                  <div className="qspl-pp-item" key={l.lineId}>
                    <ProductThumb product={l} size={38} src={img1(l.hinhAnh)} className="qspl-pp-img" />
                    <div className="qspl-pp-info">
                      <div className="qspl-pp-name" title={l.ten || ''}>{l.ten || ''}</div>
                      {sub && <div className="qspl-pp-isub">{sub}</div>}
                    </div>
                    <span className="qspl-pp-qty">×{Number(l.soLuong) || 0}</span>
                    <button type="button" className="qspl-pp-del" title="Bỏ khỏi dự án" onClick={() => spRemoveFromProject(l)}>✕</button>
                  </div>
                )
              }) : (
                <div className="qspl-pp-empty">Chưa có sản phẩm.<br /><b>Kéo sản phẩm</b> từ bảng bên phải thả vào đây,<br />hoặc bấm ＋ trên từng dòng.</div>
              )}
            </div>
          </>
        )}
    </div>
  )
}
