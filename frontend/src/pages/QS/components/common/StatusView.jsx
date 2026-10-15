import { useEffect, useRef, useState } from 'react'
import QsIcon from './QsIcon'
import './common.css'

/* Mọi trạng thái giao diện của QS (PLAN 1.6), vẽ bằng biến màu của .qs-page (sáng + tối).
   Props chung: kind, message (chữ phụ / lỗi từ máy chủ), title (ghi đè tiêu đề), onRetry (có thì hiện nút "Thử lại").
   kind:
     'notConfigured' - thẻ "Chưa cấu hình VITE_API_URL" (caller không gọi API nào)
     'splash'        - màn hình chờ lần đầu (port #splash, PUB/index.html:6563-6573, app.js:2435-2447).
                       Thêm props: message = bước đang làm, done (true khi đã tải xong / cần đăng nhập), logoSrc
                       (`${base}/logo.svg`), onHidden() (gọi sau khi mờ hẳn; component tự trả null).
                       Hiện tối thiểu 0,65 s, sau 6 s hiện lời nhắc máy chủ khởi động, quá 45 s tự ẩn.
                       Phủ kín phần tử cha (position:absolute), cha cần position:relative.
     'loading'       - dòng "Đang tải…" trong tab (kiểu .nb-empty)
     'empty'         - thẻ trống viền đứt (port .dash-empty); title, message, icon (mặc định 'layers'), children = nút thêm
     'error'         - thẻ lỗi tải dữ liệu: title (mặc định "Không tải được dữ liệu") + message + "Thử lại"
     'forbidden'     - "Không có quyền (chỉ Admin)" + message (chữ của máy chủ)
     'expired'       - dòng báo "Phiên đã hết, mời đăng nhập lại." (dùng trong màn đăng nhập)
     'unreachable'   - "Không kết nối được máy chủ QS (<apiUrl>)" + "Thử lại"; thêm prop apiUrl
     'specsMissing'  - dòng báo "Không tải được thông số ngành" (+ message; có onRetry thì thêm nút "Thử lại")
   kind khác (gõ sai / thiếu) -> thẻ lỗi nêu rõ kind, không lặng lẽ hiện thẻ trống. */
const HINT_SLOW = 'Máy chủ đang khởi động — lần đầu có thể mất 20–30 giây.'

function Splash({ message, done, logoSrc, onHidden }) {
  const t0 = useRef(Date.now())
  const timers = useRef([])
  const ending = useRef(false)
  const hiddenRef = useRef(onHidden)
  hiddenRef.current = onHidden
  const [hint, setHint] = useState('')
  const [hide, setHide] = useState(false)
  const [gone, setGone] = useState(false)
  const [logoBad, setLogoBad] = useState(false)
  /* Như splashDone_ của bản gốc: lúc mờ dần giữ nguyên chữ của bước cuối, không quay về chữ mặc định */
  const lastMsg = useRef(message)
  if (!done && message) lastMsg.current = message

  function later(fn, ms) { timers.current.push(setTimeout(fn, ms)) }

  /* splashDone_: chờ đủ 0,65 s rồi mờ dần 0,6 s */
  function finish() {
    if (ending.current) return
    ending.current = true
    later(() => {
      setHide(true)
      later(() => { setGone(true); if (hiddenRef.current) hiddenRef.current() }, 600)
    }, Math.max(0, 650 - (Date.now() - t0.current)))
  }

  useEffect(() => {
    later(() => setHint(HINT_SLOW), 6000)
    later(finish, 45000)
    return () => { timers.current.forEach(clearTimeout); timers.current = []; ending.current = false }
  }, [])

  useEffect(() => { if (done) finish() }, [done])

  if (gone) return null
  return (
    <div className={`qsc-splash${hide ? ' hide' : ''}`} role="status" aria-live="polite">
      <div className="qsc-spl-glow" />
      <div className="qsc-spl-card">
        {logoSrc && !logoBad
          ? <img className="qsc-spl-logo" src={logoSrc} alt="DEZON" onError={() => setLogoBad(true)} />
          : <div className="qsc-spl-word">DEZON</div>}
        <div className="qsc-spl-tag">Dự toán <i /> Bóc tách <i /> Báo giá</div>
        <div className="qsc-spl-bar"><span /></div>
        <div className="qsc-spl-msg">{lastMsg.current || 'Đang khởi động…'}</div>
        <div className="qsc-spl-hint">{hint}</div>
      </div>
      <div className="qsc-spl-foot">DEZON PRO · dezon.vn</div>
    </div>
  )
}

function Retry({ onRetry }) {
  if (!onRetry) return null
  return (
    <div className="qsc-state-actions">
      <button type="button" className="qsc-btn blue" onClick={onRetry}>Thử lại</button>
    </div>
  )
}

export default function StatusView(props) {
  const { kind, message, title, onRetry, apiUrl, icon, children } = props

  switch (kind) {
    case 'splash':
      return <Splash message={message} done={props.done} logoSrc={props.logoSrc} onHidden={props.onHidden} />
    case 'loading':
      return <div className="qsc-loading">{message || 'Đang tải…'}</div>
    case 'expired':
      return <div className="qsc-note" role="alert">{message || 'Phiên đã hết, mời đăng nhập lại.'}</div>
    case 'specsMissing':
      return (
        <div className="qsc-note err" role="alert">
          {title || 'Không tải được thông số ngành'}{message ? ': ' + message : ''}
          {onRetry ? <button type="button" className="qsc-btn qsc-note-retry" onClick={onRetry}>Thử lại</button> : null}
        </div>
      )
    case 'notConfigured':
      return (
        <div className="qsc-state err" role="alert">
          <QsIcon name="sliders" size={34} />
          <h3>{title || 'Chưa cấu hình VITE_API_URL'}</h3>
          <p>{message || 'Đặt VITE_API_URL (địa chỉ máy chủ QS, không có dấu / ở cuối) trong .env rồi chạy lại Vite.'}</p>
        </div>
      )
    case 'unreachable':
      return (
        <div className="qsc-state err" role="alert">
          <QsIcon name="plug" size={34} />
          <h3>{title || `Không kết nối được máy chủ QS (${apiUrl || ''})`}</h3>
          {message ? <p className="qsc-state-detail">{message}</p> : null}
          <Retry onRetry={onRetry} />
        </div>
      )
    case 'forbidden':
      return (
        <div className="qsc-state err" role="alert">
          <QsIcon name="lock" size={34} />
          <h3>{title || 'Không có quyền (chỉ Admin)'}</h3>
          {message ? <p className="qsc-state-detail">{message}</p> : null}
        </div>
      )
    case 'error':
      return (
        <div className="qsc-state err" role="alert">
          <QsIcon name="x" size={34} />
          <h3>{title || 'Không tải được dữ liệu'}</h3>
          {message ? <p className="qsc-state-detail">{message}</p> : null}
          <Retry onRetry={onRetry} />
        </div>
      )
    case 'empty':
      return (
        <div className="qsc-state empty">
          <QsIcon name={icon || 'layers'} size={40} />
          {title ? <h3>{title}</h3> : null}
          {message ? <p>{message}</p> : null}
          {children}
        </div>
      )
    default:
      return (
        <div className="qsc-state err" role="alert">
          <QsIcon name="x" size={34} />
          <h3>{'StatusView: kind không hợp lệ "' + String(kind) + '"'}</h3>
          {message ? <p className="qsc-state-detail">{message}</p> : null}
        </div>
      )
  }
}
