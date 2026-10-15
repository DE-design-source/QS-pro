import { useState } from 'react'
import QsIcon from '../common/QsIcon'
import { docList_, docExt_ } from '../../lib/productFields'
import { safeUrl_ } from '../../lib/format'
import { uploadRaw, DOC_MAX_MB } from '../../api/files'
import { qsToast } from '../common/dialogs'
import { upBusy_ } from './importStore'
import { pickFiles_ } from './imgUpload'

/* Ô tài liệu nhiều file (port docInput_ / docRender_ / docDel_ / docAddUrl_ / docPick_, PUB/nhap.js:204-258):
   giá trị = chuỗi, mỗi dòng 1 link (file đã tải lên kho hoặc link dán). Props: value, onChange(newValue).
   onChange nhận hàm (giá trị cũ -> giá trị mới) khi đang tải file, để các file xong lần lượt không đè nhau. */
export function docName_(u) {
  u = String(u || '').trim(); if (!u) return ''
  let t = u.split('?')[0].split('/').pop() || u
  try { t = decodeURIComponent(t) } catch (e) { /* giữ nguyên */ }
  return t.replace(/^\d{10,}-/, '')     // bỏ tiền tố thời gian của file đã tải lên
}

export default function DocField({ value, onChange }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState('')
  const ds = docList_(value)
  const addUrl = () => {
    let u = String(url || '').trim(); if (!u) return
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u
    onChange(v => { const l = docList_(v); if (l.indexOf(u) < 0) l.push(u); return l.join('\n') })
    setUrl('')
  }
  const pick = () => pickFiles_(true, '.pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf,.skp,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx', async fs => {
    if (!fs.length) return
    upBusy_(1)                            // Lưu sẽ đợi file tải xong
    let ok = 0
    try {
      for (let k = 0; k < fs.length; k++) {
        const file = fs[k]
        setBusy('Đang tải ' + (k + 1) + '/' + fs.length + '…')
        if (file.size > DOC_MAX_MB * 1024 * 1024) { qsToast('"' + file.name + '" nặng ' + (file.size / 1048576).toFixed(1) + 'MB — quá giới hạn ' + DOC_MAX_MB + 'MB, hãy dán link'); continue }
        try {
          const r = await uploadRaw(file)
          if (r && r.url) { ok++; onChange(v => { const l = docList_(v); l.push(r.url); return l.join('\n') }) }
        } catch (e) { qsToast('Tải "' + file.name + '" lỗi: ' + e.message) }
      }
      // bản gốc luôn báo "Đã tải lên <số file đã chọn>" đè lên toast lỗi; chỉ báo khi có file lên được để lỗi không bị che
      if (ok) qsToast('Đã tải lên ' + ok + ' file — bấm "Lưu cập nhật" để gắn vào sản phẩm')
    } finally { setBusy(''); upBusy_(-1) }
  })
  return (
    <div className="qsi-docf">
      <div className="qsi-docf-list">{ds.map((u, i) => {
        const ext = docExt_(u)
        return (
          <div className="qsi-docf-it" key={i + '|' + u}><span className={'qsi-tl-ext qsi-e-' + ext}>{ext === 'link' ? 'LINK' : ext.toUpperCase()}</span>
            <a href={safeUrl_(u)} target="_blank" rel="noopener noreferrer" title={'Mở: ' + docName_(u)}>{docName_(u)}</a>
            <button type="button" title="Bỏ file này" onClick={() => onChange(v => docList_(v).filter((x, k) => k !== i).join('\n'))}>✕</button></div>
        )
      })}</div>
      <div className="qsi-docf-add">
        <input className="qsi-docf-url" placeholder="Dán link rồi Enter" value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }} />
        <button type="button" className="qsi-docf-b" onClick={addUrl} title="Thêm link đã dán">Thêm link</button>
        <button type="button" className="qsi-docf-b qsi-up" onClick={pick} disabled={!!busy}
          title="Tải 1 hoặc nhiều file lên (PDF, ảnh, DWG/DXF, ZIP…, mỗi file tối đa 20MB)">{busy || <><QsIcon name="download" size={14} /> Tải file</>}</button>
      </div>
    </div>
  )
}
