import { useEffect, useState } from 'react'
import { onNewAppVer } from '../../api/http'
import { MrootPortal } from './Mroot'
import './updateBanner.css'

/* Dải nhắc "Đã có bản cập nhật mới" (roadmap M1.1, port banMoi_ PUB/app.js:30-38 + .banmoi PUB/index.html:4829-4832).
   Hiện khi lớp http thấy header x-app-ver khác giá trị đầu tiên; "Tải lại" nạp lại trang, ✕ ẩn tới response lệch kế tiếp.
   Chỉ gắn trong khung QS (QS.jsx) nên không ảnh hưởng module SiteFlow khác. */
export default function UpdateBanner() {
  const [hien, setHien] = useState(false)
  useEffect(() => onNewAppVer(() => setHien(true)), [])
  if (!hien) return null
  return (
    <MrootPortal>
      <div className="qsc-banmoi" role="status" aria-live="polite">
        <span>Đã có bản cập nhật mới của Dezon Pro.</span>
        <button type="button" onClick={() => window.location.reload()}>Tải lại</button>
        <button type="button" className="x" title="Để sau" aria-label="Để sau" onClick={() => setHien(false)}>✕</button>
      </div>
    </MrootPortal>
  )
}
