import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from '../../../api/files'
import QsIcon from '../../common/QsIcon'
import ImgViewer from '../../common/ImgViewer'
import { qsToast } from '../../common/dialogs'
import { downscaleImage_, uploadImg_ } from './editModel'

/* Khối ảnh 2 cột của modal Sửa SP (port imgUpBlock_ + upFile / upPick / upDrop / upAddUrl / upRemove / upMakeMain_ / upXemAnh_
   và bắt Ctrl+V, PUB/nhap.js:350-460, 1026-1160). Ảnh đại diện chỉ 1, ảnh chi tiết nhiều; ảnh đang tải hiện bằng dataURL rồi được
   thay bằng token máy chủ trả về; tải lỗi thì gỡ đúng ảnh đó và báo.
   Props: imgs {main, list}, setImgs(fn), busy {add(+1/-1)} (modal đợi ảnh tải xong trước khi lưu). */
export default function ImgUpBlock({ imgs, setImgs, busy }) {
  const [drag, setDrag] = useState('')
  const [mainFocus, setMainFocus] = useState(false)
  const [view, setView] = useState(null)
  const [mainUrl, setMainUrl] = useState('')
  const [moreUrl, setMoreUrl] = useState('')
  const imgsRef = useRef(imgs)
  imgsRef.current = imgs
  const focusRef = useRef(false)
  focusRef.current = mainFocus

  async function upFile(zone, file) {
    busy.add(1)   // đánh dấu có ảnh đang xử lý ngay từ đầu
    try {
      const dataUrl = await downscaleImage_(file, 1600, 0.82)
      if (dataUrl === '__DECODE_FAIL__') { qsToast('Không đọc được ảnh — có thể ảnh iPhone (.HEIC). Hãy đổi sang JPG/PNG hoặc dán URL ảnh.'); return }
      if (!dataUrl) { qsToast('Không đọc được ảnh — hãy thử ảnh khác hoặc dán URL.'); return }
      // dataURL làm khoá tạm: tải nhiều ảnh cùng lúc vẫn thay đúng ô
      setImgs(s => zone === 'main' ? { ...s, main: dataUrl } : { ...s, list: s.list.concat([dataUrl]) })
      qsToast('Đang tải ảnh lên…')
      try {
        const tok = await uploadImg_(dataUrl, file.name)
        setImgs(s => zone === 'main'
          ? (s.main === dataUrl ? { ...s, main: tok } : s)
          : { ...s, list: s.list.map(v => v === dataUrl ? tok : v) })
        qsToast('Đã tải ảnh lên')
      } catch (e) {
        setImgs(s => zone === 'main'
          ? (s.main === dataUrl ? { ...s, main: '' } : s)
          : { ...s, list: s.list.filter(v => v !== dataUrl) })
        const m = String((e && e.message) || e)
        qsToast('Tải ảnh lỗi: ' + (/fetch/i.test(m) ? 'mất kết nối, thử lại' : m) + ' — hoặc dán URL ảnh.')
      }
    } finally { busy.add(-1) }
  }
  async function upFilesSeq(zone, fs) {
    if (zone === 'main') { if (fs.length > 1) qsToast('Hình đại diện chỉ 1 ảnh — lấy ảnh đầu.'); fs = fs.slice(0, 1) }
    for (let i = 0; i < fs.length; i++) { await upFile(zone, fs[i]) }   // tải TUẦN TỰ
  }
  const upFilesRef = useRef(upFilesSeq)
  upFilesRef.current = upFilesSeq

  function upPick(zone) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (zone === 'more') inp.multiple = true
    inp.onchange = () => { upFilesSeq(zone, Array.prototype.slice.call(inp.files || [])) }
    inp.click()
  }
  function upDrop(e, zone) {
    e.preventDefault(); e.stopPropagation(); setDrag('')   // không cho chốt chặn thả file của form Nhập (document) báo nhầm
    // type rỗng (vd HEIC) vẫn thử, bước nén sẽ báo nếu không đọc được
    const fs = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []).filter(f => !f.type || /^image\//.test(f.type))
    upFilesSeq(zone, fs)
  }
  function upAddUrl(zone) {
    const u = (zone === 'main' ? mainUrl : moreUrl).trim()
    if (!u) { qsToast('Nhập URL ảnh'); return }
    setImgs(s => zone === 'main' ? { ...s, main: u } : { ...s, list: s.list.concat([u]) })
    if (zone === 'main') setMainUrl(''); else setMoreUrl('')
  }
  function upRemove(zone, i) { setImgs(s => zone === 'main' ? { ...s, main: '' } : { ...s, list: s.list.filter((_, k) => k !== i) }) }
  function upMakeMain(i) {
    setImgs(s => {
      const list = s.list.slice(); if (i < 0 || i >= list.length) return s
      const old = s.main, main = list[i]
      if (old) list[i] = old; else list.splice(i, 1)
      return { main, list }
    })
    qsToast('Đã đặt làm hình đại diện')
  }
  function upXemAnh(k) {
    const ds = [imgs.main].concat(imgs.list || []).filter(Boolean).map(mediaUrl)
    if (!ds.length) return
    setView({ src: ds[Math.max(0, Math.min(ds.length - 1, Number(k) || 0))], gallery: ds })
  }

  // Dán ảnh bằng Ctrl+V: vào ô đang focus, chưa có ảnh đại diện thì ưu tiên ô đại diện
  useEffect(() => {
    function onPaste(e) {
      if (e.defaultPrevented) return
      const items = (e.clipboardData && e.clipboardData.items) || []
      const files = []
      for (let i = 0; i < items.length; i++) { if (items[i].type && /^image\//.test(items[i].type)) { const f = items[i].getAsFile(); if (f) files.push(f) } }
      if (!files.length) return
      const a = document.activeElement
      if (a && /INPUT|TEXTAREA/.test(a.tagName) && !a.closest('.qspe-upzone')) return   // đang gõ chữ -> bỏ qua
      e.preventDefault(); e.stopPropagation()
      const zone = focusRef.current ? 'main' : (!imgsRef.current.main ? 'main' : 'more')
      upFilesRef.current(zone, files)
      qsToast('Đã dán ' + files.length + ' ảnh vào ' + (zone === 'main' ? 'hình đại diện' : 'hình chi tiết'))
    }
    // nghe ở pha capture + chặn lan: form Nhập (luôn gắn, ẩn) cũng nghe paste trên document; modal mở thì ảnh chỉ vào modal (upRoot_, nhap.js:416)
    document.addEventListener('paste', onPaste, true)
    return () => document.removeEventListener('paste', onPaste, true)
  }, [])

  const coMain = imgs.main ? 1 : 0
  const nMore = (imgs.list || []).length
  const dragOn = zone => e => { e.preventDefault(); setDrag(zone) }
  const dragOff = e => { e.preventDefault(); setDrag('') }

  return (
    <div className="qspe-imgup">
      <div className="qspe-upcol">
        <div className="qspe-uphead"><span className="qspe-uplabel">Hình đại diện</span><span className="qspe-upbadge">{imgs.main ? '1 ảnh' : 'bắt buộc'}</span></div>
        <div className={`qspe-upzone main${drag === 'main' ? ' drag' : ''}${mainFocus ? ' focus' : ''}`} tabIndex={0}
          onClick={() => upPick('main')} onDragOver={dragOn('main')} onDragLeave={dragOff} onDrop={e => upDrop(e, 'main')}
          onFocus={() => setMainFocus(true)} onBlur={() => setMainFocus(false)}>
          <div className="qspe-upic"><QsIcon name="camera" size={20} /></div>
          <div className="qspe-up-t">{imgs.main ? 'Kéo/thả hoặc bấm để ĐỔI ảnh' : 'Kéo/thả hoặc bấm để chọn'}</div>
          <div className="qspe-up-s">ảnh chính hiện trong bảng &amp; báo giá — <b>chỉ 1 ảnh</b></div>
          <div className="qspe-up-paste"><QsIcon name="copy" size={11} /> hoặc dán ảnh bằng Ctrl+V</div>
        </div>
        <div className="qspe-upgrid">
          {imgs.main ? (
            <Thumb src={mediaUrl(imgs.main)} main onZoom={() => upXemAnh(0)} onDel={() => upRemove('main')} />
          ) : null}
        </div>
        <UrlRow value={mainUrl} onChange={setMainUrl} onAdd={() => upAddUrl('main')} />
      </div>
      <div className="qspe-upcol">
        <div className="qspe-uphead"><span className="qspe-uplabel">Hình chi tiết sản phẩm</span><span className="qspe-upbadge">{nMore ? nMore + ' ảnh' : 'tuỳ chọn'}</span></div>
        <div className={`qspe-upzone more${drag === 'more' ? ' drag' : ''}`} tabIndex={0}
          onClick={() => upPick('more')} onDragOver={dragOn('more')} onDragLeave={dragOff} onDrop={e => upDrop(e, 'more')}>
          <div className="qspe-upic"><QsIcon name="camera" size={20} /></div>
          <div className="qspe-up-t">Kéo/thả hoặc bấm để chọn</div>
          <div className="qspe-up-s">chọn được <b>nhiều ảnh</b> cùng lúc</div>
          <div className="qspe-up-paste"><QsIcon name="copy" size={11} /> hoặc dán ảnh bằng Ctrl+V</div>
        </div>
        <div className="qspe-upgrid">
          {(imgs.list || []).map((v, i) => (
            <Thumb key={i + '|' + v.slice(0, 64)} src={mediaUrl(v)} num={i + 1} hideOnErr
              onZoom={() => upXemAnh(i + coMain)} onDel={() => upRemove('more', i)} onStar={() => upMakeMain(i)} />
          ))}
        </div>
        <UrlRow value={moreUrl} onChange={setMoreUrl} onAdd={() => upAddUrl('more')} />
      </div>
      {view && <ImgViewer src={view.src} gallery={view.gallery} onClose={() => setView(null)} />}
    </div>
  )
}

/* Ô ảnh nhỏ. Ảnh đại diện lỗi: giữ thẻ img, báo "Không tải được ảnh" + Thử lại (upImgErr_ / upImgRetry_);
   ảnh chi tiết lỗi: ẩn ảnh như bản gốc. */
function Thumb({ src, main, num, hideOnErr, onZoom, onDel, onStar }) {
  const [err, setErr] = useState(false)
  const [retry, setRetry] = useState(0)
  const url = retry ? src + (src.indexOf('?') >= 0 ? '&' : '?') + 'r=' + retry : src
  return (
    <div className={`qspe-upthumb${main ? ' is-main' : ''}${err && !hideOnErr ? ' has-err' : ''}`}>
      <img src={url} alt="" style={err && hideOnErr ? { visibility: 'hidden' } : undefined}
        onError={() => setErr(true)} onLoad={() => setErr(false)} />
      <button type="button" className="qspe-upzoom" title="Xem ảnh lớn" onClick={e => { e.stopPropagation(); onZoom() }}><QsIcon name="search" size={12} /></button>
      <button type="button" className="qspe-upx" title={main ? 'Xoá ảnh' : 'Xoá'} onClick={e => { e.stopPropagation(); onDel() }}>✕</button>
      {onStar && <button type="button" className="qspe-upstar" title="Đặt làm hình đại diện" onClick={e => { e.stopPropagation(); onStar() }}><QsIcon name="star" size={11} /></button>}
      {main ? <span className="qspe-upnum main"><QsIcon name="star" size={10} /></span> : <span className="qspe-upnum">{num}</span>}
      {err && !hideOnErr && (
        <span className="qspe-up-err"><b>Không tải được ảnh</b><i onClick={e => { e.stopPropagation(); setErr(false); setRetry(Date.now()) }}>Thử lại</i></span>
      )}
    </div>
  )
}

function UrlRow({ value, onChange, onAdd }) {
  return (
    <div className="qspe-upurl">
      <span className="qspe-upurl-ic"><QsIcon name="link" size={13} /></span>
      <input value={value} placeholder="Dán link ảnh…" onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }} />
      <button type="button" className="qspe-upurl-btn" onClick={onAdd}>Thêm</button>
    </div>
  )
}
