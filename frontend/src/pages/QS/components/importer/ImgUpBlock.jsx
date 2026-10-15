import { useEffect, useRef, useState } from 'react'
import QsIcon from '../common/QsIcon'
import ImgViewer from '../common/ImgViewer'
import { mediaUrl } from '../../api/files'
import { qsToast } from '../common/dialogs'
import { upFilesSeq_, pickFiles_ } from './imgUpload'

/* Thẻ "Ảnh sản phẩm" của trang Nhập dữ liệu (port imgSection / imgUpBlock_ / upRefresh / upAddUrl / upRemove / upMakeMain_ /
   upXemAnh_ / dán ảnh Ctrl+V / chặn thả file ra ngoài, PUB/nhap.js:352-454, 1026-1080, 1140-1146).
   Props:
     acc = {main, list, put(fn)}  ảnh đại diện + ảnh chi tiết; put nhận fn({main,list}) -> {main,list}
     title ('Ảnh sản phẩm'), moreLabel ('Hình chi tiết sản phẩm'), mainOptional (badge "tuỳ chọn" thay "bắt buộc", dùng cho công tác)
     active  true khi khối đang hiện -> mới nhận ảnh dán Ctrl+V và nhắc khi thả file trượt ra ngoài khung */
export default function ImgUpBlock({ acc, title = 'Ảnh sản phẩm', moreLabel = 'Hình chi tiết sản phẩm', mainOptional = false, active = false }) {
  const [view, setView] = useState(-1)
  const accRef = useRef(acc)
  accRef.current = acc
  const lastZone = useRef('')
  const rootRef = useRef(null)
  const main = acc.main || ''
  const list = acc.list || []

  const activeRef = useRef(active)
  activeRef.current = active
  // Dán ảnh Ctrl+V: chỉ khi khối đang hiện (tab Nhập dữ liệu) và không có hộp thoại / modal Sửa SP nào đang mở
  // (bản gốc: modal mở thì ảnh vào modal, upRoot_ PUB/nhap.js:416)
  useEffect(() => {
    if (!active) return undefined
    const onFocus = e => {
      const z = e.target.closest && e.target.closest('.qsi-upzone')
      lastZone.current = z && rootRef.current && rootRef.current.contains(z) ? (z.classList.contains('qsi-upmain') ? 'main' : 'more') : ''
    }
    const onPaste = e => {
      if (e.defaultPrevented || document.querySelector('.qsc-ov')) return
      const items = (e.clipboardData && e.clipboardData.items) || []
      const files = []
      for (let i = 0; i < items.length; i++) { if (items[i].type && /^image\//.test(items[i].type)) { const f = items[i].getAsFile(); if (f) files.push(f) } }
      if (!files.length) return
      const ae = document.activeElement
      if (ae && /INPUT|TEXTAREA/.test(ae.tagName) && !ae.closest('.qsi-upzone')) return   // đang gõ chữ -> bỏ qua
      e.preventDefault()
      const a = accRef.current
      const zone = lastZone.current === 'main' ? 'main' : (!a.main ? 'main' : 'more')   // chưa có ảnh đại diện -> ưu tiên
      upFilesSeq_(zone, files, a)
      qsToast('Đã dán ' + files.length + ' ảnh vào ' + (zone === 'main' ? 'hình đại diện' : 'hình chi tiết'))
    }
    document.addEventListener('focusin', onFocus)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('paste', onPaste)
    }
  }, [active])
  // Chặn trình duyệt mở file khi thả trượt ra ngoài vùng tải ảnh (guardFileDrop_, PUB/nhap.js:1052-1063).
  // Vùng thả nào đã tự nhận (của modal Sửa SP, bảng...) thì bỏ qua; lời nhắc chỉ hiện khi khối này đang hiện.
  useEffect(() => {
    const hasFiles = e => { const d = e.dataTransfer; return d && d.types && [].indexOf.call(d.types, 'Files') >= 0 }
    const onDragOver = e => { if (hasFiles(e)) e.preventDefault() }
    const onDrop = e => {
      if (!hasFiles(e) || e.defaultPrevented) return
      if (e.target.closest && e.target.closest('[class*="upzone"]')) return
      e.preventDefault()
      if (activeRef.current) qsToast('Thả ảnh vào đúng khung "Hình đại diện" hoặc "Hình chi tiết" nhé')
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [])

  const [drag, setDrag] = useState('')
  const [urls, setUrls] = useState({ main: '', more: '' })
  const pick = zone => pickFiles_(zone === 'more', 'image/*', fs => upFilesSeq_(zone, fs, accRef.current))
  const onDrop = (e, zone) => {
    e.preventDefault(); setDrag('')
    // nhận ảnh; type rỗng (vd HEIC) vẫn thử, bước nén sẽ báo nếu không đọc được
    const fs = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []).filter(f => !f.type || /^image\//.test(f.type))
    upFilesSeq_(zone, fs, accRef.current)
  }
  const addUrl = zone => {
    const u = (urls[zone] || '').trim()
    if (!u) { qsToast('Nhập URL ảnh'); return }
    acc.put(s => (zone === 'main' ? { ...s, main: u } : { ...s, list: s.list.concat(u) }))
    setUrls(x => ({ ...x, [zone]: '' }))
  }
  const remove = (zone, i) => acc.put(s => (zone === 'main' ? { ...s, main: '' } : { ...s, list: s.list.filter((x, k) => k !== i) }))
  const makeMain = i => {
    acc.put(s => {
      const l = s.list.slice(); if (i < 0 || i >= l.length) return s
      const old = s.main, m = l[i]
      if (old) l[i] = old; else l.splice(i, 1)
      return { ...s, main: m, list: l }
    })
    qsToast('Đã đặt làm hình đại diện')
  }
  const gallery = [main].concat(list).filter(Boolean).map(mediaUrl)
  const zoneProps = zone => ({
    tabIndex: 0,
    onClick: () => pick(zone),
    onDragOver: e => { e.preventDefault(); setDrag(zone) },
    onDragLeave: e => { e.preventDefault(); setDrag('') },
    onDrop: e => onDrop(e, zone),
  })
  const urlRow = zone => (
    <div className="qsi-upurl"><span className="qsi-upurl-ic"><QsIcon name="link" size={13} /></span>
      <input placeholder="Dán link ảnh…" value={urls[zone]} onChange={e => setUrls({ ...urls, [zone]: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(zone) } }} />
      <button className="qsi-upurl-btn" onClick={() => addUrl(zone)}>Thêm</button></div>
  )
  const paste = <div className="qsi-up-paste"><QsIcon name="copy" size={11} /> hoặc dán ảnh bằng Ctrl+V</div>

  return (
    <div className="qsi-dbcard" ref={rootRef}>
      <div className="qsi-dbcard-h"><span className="qsi-dbcard-ic"><QsIcon name="camera" size={18} /></span><h3>{title}</h3>
        <span className="qsi-sp" style={{ flex: 1 }} /><span className="qsi-up-hint2"><QsIcon name="image" size={13} /> JPG · PNG · WEBP · tối đa 5MB</span></div>
      <div className="qsi-dbcard-b">
        <div className="qsi-imgup">
          <div className="qsi-upcol">
            <div className="qsi-uphead"><span className="qsi-uplabel">Hình đại diện</span><span className="qsi-upbadge">{main ? '1 ảnh' : (mainOptional ? 'tuỳ chọn' : 'bắt buộc')}</span></div>
            <div className={'qsi-upzone qsi-upmain' + (drag === 'main' ? ' qsi-drag' : '')} {...zoneProps('main')}>
              <div className="qsi-upic"><QsIcon name="camera" size={26} /></div>
              <div className="qsi-up-t">{main ? 'Kéo/thả hoặc bấm để ĐỔI ảnh' : 'Kéo/thả hoặc bấm để chọn'}</div>
              <div className="qsi-up-s">ảnh chính hiện trong bảng &amp; báo giá — <b>chỉ 1 ảnh</b></div>
              {paste}
            </div>
            <div className="qsi-upgrid">{main && (
              <MainThumb src={mediaUrl(main)} onZoom={() => setView(0)} onRemove={() => remove('main')} />
            )}</div>
            {urlRow('main')}
          </div>
          <div className="qsi-upcol">
            <div className="qsi-uphead"><span className="qsi-uplabel">{moreLabel}</span><span className="qsi-upbadge">{list.length ? list.length + ' ảnh' : 'tuỳ chọn'}</span></div>
            <div className={'qsi-upzone qsi-upmore' + (drag === 'more' ? ' qsi-drag' : '')} {...zoneProps('more')}>
              <div className="qsi-upic"><QsIcon name="camera" size={26} /></div>
              <div className="qsi-up-t">Kéo/thả hoặc bấm để chọn</div>
              <div className="qsi-up-s">chọn được <b>nhiều ảnh</b> cùng lúc</div>
              {paste}
            </div>
            <div className="qsi-upgrid">{list.map((v, i) => (
              <div className="qsi-upthumb" key={i + '|' + v.slice(0, 64)}>
                <img src={mediaUrl(v)} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                <button className="qsi-upzoom" title="Xem ảnh lớn" onClick={e => { e.stopPropagation(); setView(i + (main ? 1 : 0)) }}><QsIcon name="search" size={12} /></button>
                <button className="qsi-upx" title="Xoá" onClick={e => { e.stopPropagation(); remove('more', i) }}>✕</button>
                <button className="qsi-upstar" title="Đặt làm hình đại diện" onClick={e => { e.stopPropagation(); makeMain(i) }}><QsIcon name="star" size={11} /></button>
                <span className="qsi-upnum">{i + 1}</span>
              </div>
            ))}</div>
            {urlRow('more')}
          </div>
        </div>
      </div>
      {view >= 0 && gallery.length > 0 && (
        <ImgViewer src={gallery[Math.max(0, Math.min(gallery.length - 1, view))]} gallery={gallery} onClose={() => setView(-1)} />
      )}
    </div>
  )
}

/* Ảnh đại diện: ảnh lỗi giữ thẻ img, báo nhẹ + "Thử lại" (upImgErr_ / upImgRetry_, PUB/nhap.js:352-372) */
function MainThumb({ src, onZoom, onRemove }) {
  const [err, setErr] = useState(false)
  const [bust, setBust] = useState('')
  const url = bust ? src + (src.indexOf('?') >= 0 ? '&' : '?') + 'r=' + bust : src
  return (
    <div className={'qsi-upthumb qsi-is-main' + (err ? ' qsi-has-err' : '')}>
      <img src={url} alt="" onError={() => setErr(true)} onLoad={() => setErr(false)} />
      <button className="qsi-upzoom" title="Xem ảnh lớn" onClick={e => { e.stopPropagation(); onZoom() }}><QsIcon name="search" size={12} /></button>
      <button className="qsi-upx" title="Xoá ảnh" onClick={e => { e.stopPropagation(); onRemove() }}>✕</button>
      <span className="qsi-upnum qsi-main"><QsIcon name="star" size={10} /></span>
      {err && <span className="qsi-up-err"><b>Không tải được ảnh</b><i onClick={e => { e.stopPropagation(); setErr(false); setBust(String(Date.now())) }}>Thử lại</i></span>}
    </div>
  )
}
