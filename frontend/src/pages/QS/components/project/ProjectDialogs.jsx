import { useEffect, useRef, useState } from 'react'
import Icon from '../../../../components/ui/Icon'
import { MrootPortal } from '../common/Mroot'
import { qsToast } from '../common/dialogs'
import { useQs } from '../../state/QsData'
import CreateProjectModal from '../dashboard/CreateProjectModal'
import ProjectInfoModal from './ProjectInfoModal'
import { escOnTop_ } from './projectShell'
import { useProjDlg, closeProjDlg, renameDraftSave, duplicateDraft, createFromForm, draftIndexOf_ } from './projectActions'
import './project.css'

/* Nơi vẽ DUY NHẤT các hộp thoại của phần dự án (đặt trong Bảng điều khiển, panel luôn được mount; hộp được đưa vào .qs-mroot).
   Props: không có. Mở bằng openProjDlg('info'|'dup'|'rename'|'create', maDA) ở projectActions.js. */
export default function ProjectDialogs() {
  const d = useProjDlg()
  if (!d) return null
  if (d.kind === 'info') return <ProjectInfoModal key={d.id} onClose={() => closeProjDlg('info')} />
  if (d.kind === 'dup') return <DuplicateModal key={d.id} maDA={d.maDA} onClose={() => closeProjDlg('dup')} />
  if (d.kind === 'rename') return <RenameDraft key={d.id} maDA={d.maDA} onClose={() => closeProjDlg('rename')} />
  if (d.kind === 'create') return <CreateHost key={d.id} />
  return null
}

/* Esc đóng hộp (chỉ khi không có hộp xác nhận nào đè lên, escOnTop_); trả ref gắn vào lớp phủ .qsc-ov */
function useEsc(onClose) {
  const ref = useRef(onClose)
  const ovRef = useRef(null)
  ref.current = onClose
  useEffect(() => {
    const k = e => { if (e.key === 'Escape' && escOnTop_(ovRef.current)) ref.current() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [])
  return ovRef
}

function CreateHost() {
  const [busy, setBusy] = useState(false)
  return (
    <MrootPortal>
      <CreateProjectModal
        busy={busy}
        onClose={() => closeProjDlg('create')}
        onSave={async form => {
          if (busy) return
          setBusy(true)
          const ok = await createFromForm(form)
          setBusy(false)
          if (ok) closeProjDlg('create')
        }}
      />
    </MrootPortal>
  )
}

/* Nhân bản: chọn phần cần sao chép (port duplicateDraft / dupDo_, PUB/dash.js:113-140) */
function DuplicateModal({ maDA, onClose }) {
  const [o, setO] = useState({ boc: true, cover: true, pt: true })
  const [busy, setBusy] = useState(false)
  const ovRef = useEsc(onClose)
  const ck = (k, title, note) => (
    <label className="qs-dup-ck">
      <input type="checkbox" checked={o[k]} onChange={e => { const v = e.target.checked; setO(x => ({ ...x, [k]: v })) }} />
      <span><b>{title}</b> — {note}</span>
    </label>
  )
  async function run() {
    setBusy(true)
    try { await duplicateDraft(maDA, o); onClose() } catch (e) {
      setBusy(false)
      if (!(e && e.name === 'QsAuthError')) qsToast('Lỗi nhân bản: ' + ((e && e.message) || e))
    }
  }
  return (
    <MrootPortal>
      <div ref={ovRef} className="qsc-ov" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="qsc-dlg qs-pdlg qs-dup-dlg" role="dialog" aria-modal="true">
          <div className="qs-pdlg-h">
            <h3><Icon name="copy" size={15} />Nhân bản bản nháp</h3>
            <button type="button" className="qsc-x" onClick={onClose}>✕</button>
          </div>
          <p className="qs-dup-hint">Chọn phần cần sao chép sang bản nháp mới (Thông tin dự án luôn được copy):</p>
          <div className="qs-dup-list">
            {ck('boc', 'Bóc tách', 'sản phẩm đã bóc (Chi phí · Mua hàng đi theo phần này)')}
            {ck('cover', 'Xuất báo giá', 'tờ bìa / ước tính chi phí')}
            {ck('pt', 'Phần thô', 'bảng ước tính xây thô')}
          </div>
          <div className="qs-pdlg-f">
            <button type="button" className="qsc-btn" onClick={onClose}>Huỷ</button>
            <button type="button" className="qsc-btn blue" disabled={busy} onClick={run}>
              {busy ? 'Đang nhân bản…' : <><Icon name="copy" size={14} />Nhân bản</>}
            </button>
          </div>
        </div>
      </div>
    </MrootPortal>
  )
}

/* Đổi tên bản nháp (port renameDraft / rnSave_, PUB/app.js:2241-2257, 2283-2289) */
function RenameDraft({ maDA, onClose }) {
  const { projects } = useQs()
  const p = (projects || []).filter(x => x.maDA === maDA)[0]
  const [v, setV] = useState(() => (p ? (p.tenBanNhap || ('Bản nháp ' + (draftIndexOf_(projects, maDA) + 1))) : ''))
  const inRef = useRef(null)
  const ovRef = useEsc(onClose)
  useEffect(() => {
    const t = setTimeout(() => { if (inRef.current) { inRef.current.focus(); inRef.current.select() } }, 40)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { if (!p) onClose() }, [p, onClose])
  if (!p) return null
  async function save() { if (await renameDraftSave(maDA, v.trim())) onClose() }
  return (
    <MrootPortal>
      <div ref={ovRef} className="qsc-ov" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="qsc-dlg qs-pdlg qs-rn-dlg" role="dialog" aria-modal="true">
          <div className="qs-pdlg-h">
            <h3><Icon name="edit" size={15} />Đổi tên bản nháp</h3>
            <button type="button" className="qsc-x" onClick={onClose}>✕</button>
          </div>
          <input ref={inRef} className="qs-rn-in" value={v} placeholder="Tên bản nháp"
            onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save() }} />
          <div className="qs-pdlg-f">
            <button type="button" className="qsc-btn" onClick={onClose}>Huỷ</button>
            <button type="button" className="qsc-btn blue" onClick={save}><Icon name="check" size={14} />Lưu</button>
          </div>
        </div>
      </div>
    </MrootPortal>
  )
}
