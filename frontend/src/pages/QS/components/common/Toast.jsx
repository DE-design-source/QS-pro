import './common.css'

/* Thông báo ngắn ở đáy màn hình (port #toast, PUB/app.js:81). Thời gian 2,2 giây do qsToast() (dialogs.js) quản lý.
   Props: text (chuỗi), on (true = đang hiện; false = mờ dần nhưng vẫn giữ chữ cho hiệu ứng). */
export default function Toast({ text, on }) {
  return (
    <div className={`qsc-toast${on ? ' on' : ''}`} role="status" aria-live="polite">
      {text}
    </div>
  )
}
