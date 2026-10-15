import { useRef, useState } from 'react'
import { uploadRaw, DOC_MAX_MB } from '../../../api/files'
import { docList_, docExt_ } from '../../../lib/productFields'
import { docName_ } from '../../common/DocsPopover'
import QsIcon from '../../common/QsIcon'
import { qsToast } from '../../common/dialogs'
import { docHref_ } from './editModel'

/* Ô tài liệu nhiều file (port docInput_ / docRender_ / docDel_ / docAddUrl_ / docPick_, PUB/nhap.js:203-247):
   giá trị = mỗi dòng 1 link; dán link hoặc tải file lên kho (/upload/file). Lưu sẽ đợi file tải xong (busy).
   Props: value (chuỗi), onChange(chuỗi mới), busy {add(+1/-1)}. */
export default function DocField({ value, onChange, busy }) {
  const [url, setUrl] = useState('')
  const [up, setUp] = useState('')
  const valRef = useRef(value)
  valRef.current = value
  const ds = docList_(value)

  function set(list) { valRef.current = list.join('\n'); onChange(valRef.current) }
  function del(i) { const l = docList_(valRef.current); l.splice(i, 1); set(l) }
  function addUrl() {
    let u = String(url || '').trim(); if (!u) return
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u
    const l = docList_(valRef.current); if (l.indexOf(u) < 0) l.push(u)
    setUrl(''); set(l)
  }
  function pick() {
    const f = document.createElement('input'); f.type = 'file'; f.multiple = true
    f.accept = '.pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf,.skp,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
    f.onchange = async () => {
      const fs = Array.prototype.slice.call(f.files || []); if (!fs.length) return
      busy.add(1)
      const loi = []
      try {
        for (let k = 0; k < fs.length; k++) {
          const file = fs[k]; setUp('Đang tải ' + (k + 1) + '/' + fs.length + '…')
          if (file.size > DOC_MAX_MB * 1024 * 1024) { loi.push('"' + file.name + '" nặng ' + (file.size / 1048576).toFixed(1) + 'MB — quá giới hạn ' + DOC_MAX_MB + 'MB, hãy dán link'); qsToast(loi[loi.length - 1]); continue }
          try {
            const r = await uploadRaw(file)
            if (r && r.url) { const l = docList_(valRef.current); l.push(r.url); set(l) }
          } catch (e) { loi.push('Tải "' + file.name + '" lỗi: ' + e.message); qsToast(loi[loi.length - 1]) }
        }
        // bản gốc luôn báo "Đã tải lên N file" sau cùng, che mất lỗi -> có lỗi thì báo lỗi
        qsToast(loi.length ? loi.join(' · ') : ('Đã tải lên ' + fs.length + ' file — bấm "Lưu cập nhật" để gắn vào sản phẩm'))
      } finally { setUp(''); busy.add(-1) }
    }
    f.click()
  }

  return (
    <div className="qspe-docf">
      {ds.length > 0 && (
        <div className="qspe-docf-list">
          {ds.map((u, i) => {
            const ext = docExt_(u)
            return (
              <div className="qspe-docf-it" key={i + '|' + u}>
                <span className={`qsc-tl-ext e-${ext}`}>{ext === 'link' ? 'LINK' : ext.toUpperCase()}</span>
                <a href={docHref_(u)} target="_blank" rel="noopener" title={'Mở: ' + docName_(u)}>{docName_(u)}</a>
                <button type="button" title="Bỏ file này" onClick={() => del(i)}>✕</button>
              </div>
            )
          })}
        </div>
      )}
      <div className="qspe-docf-add">
        <input className="qspe-docf-url" placeholder="Dán link rồi Enter" value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }} />
        <button type="button" className="qspe-docf-b" onClick={addUrl} title="Thêm link đã dán">Thêm link</button>
        <button type="button" className="qspe-docf-b up" onClick={pick} disabled={!!up}
          title="Tải 1 hoặc nhiều file lên (PDF, ảnh, DWG/DXF, ZIP…, mỗi file tối đa 20MB)">
          {up || <><QsIcon name="download" size={14} /> Tải file</>}
        </button>
      </div>
    </div>
  )
}
