import { useEffect, useRef, useState } from 'react'
import Icon from '../../../../components/ui/Icon'
import * as api from '../../api/qsApi'
import { isAbort } from '../../api/http'
import { useQsStore, refreshNotifCount, isAdminRole_, showTab } from '../../state/store'
import { qsToast } from '../common/dialogs'
import QsIcon from '../common/QsIcon'
import { fmtDateTime_ } from '../admin/adminUtil'
import './notifications.css'

/* Chuông thông báo (port toggleNotif / renderNotif_ / notifClick / notifMarkAll, PUB/app.js:2541-2599).
   Số chưa đọc lấy từ store (GET /notifications/unread-count, poll 30 s trong store, dừng khi rời /qs).
   Mở chuông -> tải 30 thông báo mới nhất. Bấm 1 thông báo -> đánh dấu đã đọc và mở đúng đối tượng:
     purchase_* : Admin -> tab Admin + chi tiết đơn ({purDetail}); người khác -> tab Mua hàng
     delete_*   : Admin -> tab Admin + làm nổi yêu cầu ({highlightDrq}); người khác -> Danh sách SP
     sp_edit*   : Danh sách SP tìm mã và mở sản phẩm ({spSearch, openFirst})
   Props cố định: {} (Batch 0). */
export default function NotificationBell() {
  const unread = useQsStore(s => s.notifUnread)
  const me = useQsStore(s => s.me)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState({ st: 'loading', items: [], err: '' })
  const [seq, setSeq] = useState(0)
  const box = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const out = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const ac = new AbortController()
    setList(l => ({ ...l, st: 'loading', err: '' }))
    api.notifList(30, ac.signal).then(ns => setList({ st: 'ready', items: ns || [], err: '' }),
      e => { if (!isAbort(e)) setList({ st: 'error', items: [], err: e.message }) })
    return () => ac.abort()
  }, [open, seq])

  function notifClick(n) {
    const kind = n.kind || ''
    // bản gốc nuốt lỗi (app.js:2596); ở đây báo rõ theo yêu cầu không nuốt lỗi
    api.notifRead(n.id).then(refreshNotifCount, e => qsToast('Lỗi: ' + e.message))
    setOpen(false)
    const refId = n.refId != null ? String(n.refId) : ''
    const isAdmin = isAdminRole_(me)
    if (/^purchase_/.test(kind)) {
      if (isAdmin && refId) showTab('admin', { purDetail: refId })
      else { showTab('muahang'); qsToast(refId ? ('Đơn ' + refId) : 'Mở tab Mua hàng') }
      return
    }
    if (/^delete_/.test(kind)) {
      if (isAdmin) showTab('admin', { highlightDrq: refId })
      else { showTab('sanpham'); qsToast('Yêu cầu xoá sản phẩm ' + (kind === 'delete_approved' ? 'đã được duyệt' : kind === 'delete_rejected' ? 'bị từ chối' : 'đang chờ duyệt')) }
      return
    }
    if (/^sp_edit/.test(kind)) { showTab('sanpham', refId ? { spSearch: refId, openFirst: true } : undefined) }
  }

  function markAll(e) {
    if (e) e.stopPropagation()
    api.notifReadAll().then(() => { refreshNotifCount(); setSeq(s => s + 1) }, e => qsToast('Lỗi: ' + e.message))
  }

  return (
    <div className="qs-nb" ref={box}>
      <button className="qs-top-btn icon" title="Thông báo" onClick={() => setOpen(o => !o)}>
        <Icon name="bell" size={15} />
        {unread > 0 ? <span className="qs-top-badge">{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open && (
        <div className="qs-nb-dd">
          <div className="qsn-hd"><b>Thông báo</b><a onClick={markAll}>Đánh dấu đã đọc</a></div>
          <div className="qsn-list">
            {list.st === 'loading' ? <div className="qsn-empty">Đang tải…</div>
              : list.st === 'error' ? <div className="qsn-empty">Lỗi: {list.err}</div>
                : !list.items.length ? <div className="qsn-empty">Chưa có thông báo</div>
                  : list.items.map(n => <NotifItem key={n.id} n={n} onClick={() => notifClick(n)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function NotifItem({ n, onClick }) {
  const k = n.kind || ''
  const cls = /_approved$/.test(k) ? 'ok' : (/_rejected$/.test(k) ? 'no' : 'req')
  let ic = /^purchase_/.test(k) ? 'cart' : (/^delete_/.test(k) ? 'trash' : (/^sp_edit/.test(k) ? 'edit' : 'bell'))
  if (/_approved$/.test(k)) ic = 'check'; else if (/_rejected$/.test(k)) ic = 'x'
  return (
    <div className={`qsn-item${n.read ? '' : ' unread'}`} title="Bấm để xem chi tiết" onClick={onClick}>
      <div className={`qsn-ic ${cls}`}><QsIcon name={ic} size={15} /></div>
      <div className="qsn-tx"><b>{n.title || ''}</b><span>{n.body || ''}</span><i>{fmtDateTime_(n.at)}</i></div>
      <span className="qsn-go"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></span>
    </div>
  )
}
