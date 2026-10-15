import QsIcon from '../common/QsIcon'
import { MrootPortal } from '../common/Mroot'
import './admin.css'

/* Khung hộp chi tiết kiểu .sp-modal-ov > .sp-modal.pd của bản gốc (purDetail admin.js:66-71, dxDetail muahang.js:392-397,
   ctForm_ congty.js:94-97). Vẽ trong .qs-mroot. Bấm nền / nút ✕ -> onClose. Không đóng bằng Esc như bản gốc
   (#ctOv/#purOv/#dxOv): Esc của hộp hỏi lồng bên trên không được đóng luôn form đang sửa.
   Props: icon, title, wide (khung rộng như .pur-modal), className, onClose, children. */
export default function AdmDlg({ icon, title, wide, className = '', onClose, children }) {
  return (
    <MrootPortal>
      <div className="qsa-ov" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className={`qsa-dlg${wide ? ' wide' : ''}${className ? ' ' + className : ''}`} role="dialog" aria-modal="true">
          <div className="qsa-dlg-h">
            <h3>{icon ? <QsIcon name={icon} size={16} /> : null}{title}</h3>
            <button type="button" className="qsa-x" onClick={onClose}>✕</button>
          </div>
          {children}
        </div>
      </div>
    </MrootPortal>
  )
}
