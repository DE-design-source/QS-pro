import { useState } from 'react'
import QsIcon from '../../common/QsIcon'
import { qsToast } from '../../common/dialogs'
import { templateUrl } from '../../../api/files'
import { readB64_ } from '../imgUpload'
import DbCard from '../DbCard'
import { ctImportParse } from './ptApi'
import { ctGet, ctSet, ctPendUid_ } from './ctImpStore'

/* Nhập công tác Phần thô từ file (roadmap M5.1): "Tải file mẫu" (/mau-nhap-cong-tac.xlsx, file nhúng của máy chủ Go) +
   "Chọn file Excel/CSV" -> máy chủ đọc (POST /work-items/import/parse) -> đổ vào DANH SÁCH CHỜ như form nhập tay.
   Dòng đọc được: thẻ "Chờ lưu". Dòng lỗi (nhãn Loại báo giá / Cách tính lạ, thiếu Hạng mục, Thứ tự sai): thẻ "Lỗi — sửa lại" kèm lý do,
   cờ chan = không lưu cho tới khi mở trong form và bấm Cập nhật. Lưu vẫn bằng nút "Thêm công tác" (ctSave từng công tác). */
const TPL_NAME = 'Mau-nhap-cong-tac-DezonQS.xlsx'

/* Máy chủ API khác nguồn nên trình duyệt bỏ qua thuộc tính download -> tải blob rồi lưu đúng tên (như dlTpl_ của BulkImport) */
async function dlTpl(e) {
  e.preventDefault()
  const url = e.currentTarget.href
  try {
    const r = await fetch(url)
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const u = URL.createObjectURL(await r.blob())
    const a = document.createElement('a')
    a.href = u; a.download = TPL_NAME; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(u), 1500)
  } catch (err) { qsToast('Lỗi tải file mẫu: ' + (err.message || err)) }
}

/* object công tác của máy chủ -> bản ghi danh sách chờ (khoá như ctFormRead_) */
const toD = r => ({ deMuc: '', linkTaiLieu: '', ...(r || {}), loai: (r && r.loai) || '', mode: (r && r.mode) || '' })

export default function PtFileImport() {
  const [msg, setMsg] = useState(null)
  const [seq, setSeq] = useState(0)
  const [busy, setBusy] = useState(false)

  async function onPick(e) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    setBusy(true)
    setMsg({ kind: 'wait', text: 'Đang đọc file "' + f.name + '"…' })
    try {
      let b64
      try { b64 = String(await readB64_(f)).split(',')[1] || '' } catch (x) { setMsg({ kind: 'err', text: 'Không đọc được file.' }); return }
      const res = await ctImportParse(b64, ext)
      const rows = (res && res.rows) || [], loi = (res && res.loi) || []
      const ghi = !!ctGet().ghiAll
      const add = rows.map(r => ({ uid: ctPendUid_(), d: toD(r), ghi }))
        .concat(loi.filter(l => l.row).map(l => ({ uid: ctPendUid_(), d: toD(l.row), ghi, loi: 'Dòng ' + l.dong + ': ' + l.msg, chan: true })))
      if (add.length) ctSet(s => ({ pending: add.concat(s.pending) }))
      if (!rows.length && !loi.length) {
        setMsg({ kind: 'err', text: 'File "' + f.name + '" không có công tác nào (cột Nội dung công việc trống).' })
        return
      }
      const t = 'Đã đưa ' + rows.length + ' công tác từ "' + f.name + '" vào danh sách chờ'
        + (loi.length ? (' · ' + loi.length + ' dòng lỗi cần sửa') : '') + ' — bấm "Thêm công tác" để lưu vào Database.'
      setMsg({ kind: loi.length ? 'warn' : 'ok', text: t, dong: loi.map(l => 'Dòng ' + l.dong + (l.ten ? (' · ' + l.ten) : '') + ': ' + l.msg) })
      qsToast(t)
    } catch (x) {
      setMsg({ kind: 'err', text: 'Lỗi đọc file: ' + ((x && x.message) || x) })
    } finally {
      setBusy(false)
      setSeq(n => n + 1)      // cho chọn lại cùng 1 file
    }
  }

  return (
    <DbCard title="Nhập công tác từ file" ic="download"
      note="Tải file mẫu → điền mỗi dòng 1 công tác (giữ nguyên dòng tiêu đề) → chọn file lên. Công tác đọc được vào danh sách chờ bên phải; dòng lỗi ở lại kèm lý do để sửa. Có thể thêm cột Thứ tự để sắp thư viện.">
      <div className="qsi-file-row">
        <a className="qsi-btn qsi-sm" href={templateUrl('/mau-nhap-cong-tac.xlsx')} download={TPL_NAME} onClick={dlTpl}><QsIcon name="download" size={14} /> Tải file mẫu</a>
        <span className="qsi-file-sep" />
        <label className={'qsi-btn qsi-sm qsip-pick' + (busy ? ' dis' : '')}>
          <QsIcon name="doc" size={14} /> Chọn file Excel/CSV
          <input key={seq} type="file" accept=".xlsx,.csv" disabled={busy} onChange={onPick} hidden />
        </label>
      </div>
      {msg ? (
        <div className={'qsip-fmsg ' + msg.kind} role={msg.kind === 'err' ? 'alert' : 'status'}>
          <div>{msg.text}</div>
          {msg.dong && msg.dong.length ? <ul>{msg.dong.slice(0, 20).map((t, i) => <li key={i}>{t}</li>)}{msg.dong.length > 20 ? <li>… và {msg.dong.length - 20} dòng khác</li> : null}</ul> : null}
        </div>
      ) : null}
    </DbCard>
  )
}
