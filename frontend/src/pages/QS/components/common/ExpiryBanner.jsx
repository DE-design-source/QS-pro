import { useEffect, useState } from 'react'
import { useQsSession } from '../../session/QsSession'
import QsIcon from './QsIcon'
import '../notifications/notifications.css'

/* Dải nhắc gia hạn (roadmap M17.3 - GIẢ ĐỊNH, chỉ bản Go): chỉ hiện cho ADMIN của công ty khi hạn dùng còn <= 30 ngày
   hoặc đã hết. Ngày tính theo giờ Việt Nam như máy chủ (companies.todayVN), không theo múi giờ của máy người dùng.
   Ẩn được trong ngày (lưu ở localStorage theo công ty + hạn dùng + ngày; không có localStorage thì ẩn tới khi tải lại).
   Bấm thông báo expiry_* trong chuông thì chuông phát sự kiện EXPIRY_SHOW_EVENT: dải hiện lại (bỏ ẩn của hôm nay),
   vì thẻ Thông tin công ty ở tab Admin không có hạn dùng - dải là chỗ duy nhất admin thấy ngày hết hạn.
   Nhánh "đã hết hạn" (n < 0): đăng nhập bị chặn khi công ty hết hạn (auth), nhưng tab đã mở từ trước vẫn tới được
   nhánh này khi qua ngày hết hạn (ngày tính lại mỗi lần vẽ, hanDung trong phiên không đổi). */

export const EXPIRY_SHOW_EVENT = 'qs:expiry-show'

const RE_NGAY = /^\d{4}-\d{2}-\d{2}/

export function homNayVN() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

/* Số ngày từ hôm nay (giờ VN) tới hanDung; null khi không có / không phải ngày. */
export function conLaiVN(hanDung, homNay = homNayVN()) {
  if (!hanDung || !RE_NGAY.test(String(hanDung))) return null
  const p = s => { const a = s.slice(0, 10).split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2]) }
  return Math.round((p(String(hanDung)) - p(homNay)) / 86400000)
}

function ddmmyyyy(h) { const a = String(h).slice(0, 10).split('-'); return a[2] + '/' + a[1] + '/' + a[0] }

function anKey(ct, homNay) { return 'qs_expiryHide_' + ct.id + '_' + String(ct.hanDung).slice(0, 10) + '_' + homNay }
function daAn(k) { try { return localStorage.getItem(k) === '1' } catch (e) { return false } }

export default function ExpiryBanner() {
  const { me, congTy } = useQsSession()
  const [an, setAn] = useState('')
  const [, setHien] = useState(0)
  useEffect(() => {
    const hien = () => {
      const ct = congTy
      if (ct) { try { localStorage.removeItem(anKey(ct, homNayVN())) } catch (e) { /* bỏ qua */ } }
      setAn('')
      setHien(x => x + 1)
    }
    window.addEventListener(EXPIRY_SHOW_EVENT, hien)
    return () => window.removeEventListener(EXPIRY_SHOW_EVENT, hien)
  }, [congTy])
  if (!me || me.role !== 'admin' || !congTy) return null
  const homNay = homNayVN()
  const n = conLaiVN(congTy.hanDung, homNay)
  if (n === null || n > 30) return null
  const k = anKey(congTy, homNay)
  if (an === k || daAn(k)) return null
  const het = n < 0
  const ten = congTy.ten || 'công ty'
  const an_ = () => { try { localStorage.setItem(k, '1') } catch (e) { /* bỏ qua */ } setAn(k) }
  return (
    <div className={`qs-expb${het ? ' het' : ''}`} role="status">
      <QsIcon name="clock" size={17} />
      <div className="qs-expb-tx">
        {het
          ? <>Gói của <b>{ten}</b> đã hết hạn ngày <b>{ddmmyyyy(congTy.hanDung)}</b>. Liên hệ quản trị hệ thống để gia hạn.</>
          : <>Gói của <b>{ten}</b> hết hạn ngày <b>{ddmmyyyy(congTy.hanDung)}</b> ({n === 0 ? 'hết hạn hôm nay' : 'còn ' + n + ' ngày'}). Liên hệ quản trị hệ thống để gia hạn.</>}
      </div>
      <button type="button" className="qs-expb-x" title="Ẩn trong hôm nay" aria-label="Ẩn trong hôm nay" onClick={an_}>×</button>
    </div>
  )
}
