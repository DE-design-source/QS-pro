import { useRef, useState } from 'react'
import { FileIcon } from './shared'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const tbIcon = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

/* Khung soạn tin: thanh công cụ, xem trước tệp/ảnh đính kèm, ô nhập, nút gửi — sendMessage() trong chat.html.
   Nội dung đang soạn + tệp đính kèm được giữ khi đổi hội thoại (giống bản HTML: chỉ có một ô nhập). */
export default function Composer({ onSend }) {
  const [text, setText] = useState('')
  /* {type:'image', dataUrl, name} | {type:'file', name, size} */
  const [pending, setPending] = useState(null)
  const taRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)

  function onPickImage(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPending({ type: 'image', dataUrl: reader.result, name: file.name })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function onPickFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setPending({ type: 'file', name: file.name, size: formatSize(file.size) })
    e.target.value = ''
  }

  function send() {
    const t = text.trim()
    if (!t && !pending) return
    const msg = { text: t }
    if (pending && pending.type === 'image') msg.image = pending.dataUrl
    if (pending && pending.type === 'file') msg.file = { name: pending.name, size: pending.size }
    onSend(msg)
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
    setPending(null)
  }

  /* Ô nhập tự giãn theo nội dung, tối đa 120px */
  function onInput(e) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className="ch-composer">
      <div className="ch-composer-toolbar">
        <button className="ch-icon-btn" title="Đính kèm tệp" onClick={() => fileInputRef.current.click()}><svg {...tbIcon}><path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L10.13 17.1a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
        <button className="ch-icon-btn" title="Hình ảnh" onClick={() => imageInputRef.current.click()}><svg {...tbIcon}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg></button>
        {/* Bản HTML: hai nút dưới chưa gắn hành động */}
        <button className="ch-icon-btn" title="Nhắc đến"><svg {...tbIcon}><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.28" /></svg></button>
        <button className="ch-icon-btn" title="Emoji"><svg {...tbIcon}><circle cx="12" cy="12" r="9" /><line x1="9" y1="10" x2="9.01" y2="10" /><line x1="15" y1="10" x2="15.01" y2="10" /><path d="M8 15c1 1.2 2.4 2 4 2s3-.8 4-2" /></svg></button>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={onPickFile} />
        <input type="file" ref={imageInputRef} accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
      </div>

      <div className={'ch-attach-preview' + (pending ? ' show' : '')}>
        {pending && (
          <div className="ch-attach-preview-item">
            {pending.type === 'image' ? (
              <>
                <img src={pending.dataUrl} />
                <span className="ch-ap-name">{pending.name}</span>
              </>
            ) : (
              <>
                <span className="ch-ap-icon"><FileIcon size={15} /></span>
                <span><span className="ch-ap-name">{pending.name}</span><br /><span className="ch-ap-size">{pending.size}</span></span>
              </>
            )}
            <button className="ch-ap-remove" onClick={() => setPending(null)}>×</button>
          </div>
        )}
      </div>

      <div className="ch-composer-row">
        <textarea
          ref={taRef}
          rows={1}
          placeholder="Nhập tin nhắn... (Enter để gửi)"
          value={text}
          onChange={onInput}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <button className="ch-send-btn" title="Gửi" onClick={send}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>
    </div>
  )
}
