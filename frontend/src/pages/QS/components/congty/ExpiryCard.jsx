import { useEffect, useRef, useState } from 'react'
import { request, isAbort } from '../../api/http'
import { qsToast, qsConfirm } from '../common/dialogs'
import QsIcon from '../common/QsIcon'

/* Thẻ "Nhắc gia hạn công ty" — chỉ super (roadmap M17.3, GIẢ ĐỊNH chờ chủ sản phẩm xác nhận; bản Lark đã gỡ ở 42af44d).
   Máy chủ (chỉ bản Go): POST /api/v1/companies/expiry-reminders {dryRun} (companies/expiry.go NhacGiaHan).
   Mốc 30/14/7/3/1/0 ngày trước hạn dùng, mỗi mốc gửi 1 lần: thông báo trong chuông cho admin đang hoạt động của công ty.
   Không Lark, không email. Job nền tự chạy 8h05 giờ VN mỗi ngày (tắt khi REPORT_JOB=0).
   Kết quả: {dryRun, ngay, soCongTy, soThongBao, ds:[{id, ten, hanDung, conLai, moc, mocCu, soAdmin, canGui, daGui, loi?}]} */

// Máy chủ chỉ gửi thật khi dryRun === false (thiếu = chạy thử), nên luôn gửi giá trị boolean rõ ràng.
const nhacGiaHan = (dryRun, signal) => request('POST', '/companies/expiry-reminders', { body: { dryRun: !!dryRun }, signal })

function ddmmyyyy(h) {
  const a = String(h || '').slice(0, 10).split('-')
  return a.length === 3 ? a[2] + '/' + a[1] + '/' + a[0] : String(h || '')
}

export default function ExpiryCard() {
  const [busy, setBusy] = useState('')     // '' | 'dry' | 'send'
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')       // lỗi của lượt chạy gần nhất (hiện ngay trong thẻ, không chỉ toast)
  const acRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; if (acRef.current) acRef.current.abort() }
  }, [])

  async function chay(dryRun) {
    if (busy) return
    if (!dryRun) {
      const ok = await qsConfirm({
        title: 'Gửi nhắc gia hạn ngay?',
        note: 'Mỗi công ty tới mốc nhắc (còn 30/14/7/3/1/0 ngày) mà chưa được nhắc mốc đó sẽ gửi một thông báo trong ứng dụng'
          + ' cho từng admin đang hoạt động. Mốc đã nhắc được ghi lại nên lần tự động 8h05 sẽ không gửi trùng.',
        ok: 'Gửi nhắc ngay',
      })
      if (!ok || !mountedRef.current) return
    }
    const ac = new AbortController()
    if (dryRun) acRef.current = ac
    setBusy(dryRun ? 'dry' : 'send')
    setErr('')
    setRes(null) // bỏ kết quả cũ: lượt mới lỗi thì không để bảng cũ trông như kết quả mới
    try {
      // Gửi thật không gắn signal: rời tab giữa chừng thì máy chủ vẫn gửi xong
      const r = await nhacGiaHan(dryRun, dryRun ? ac.signal : undefined)
      if (!dryRun) qsToast(r && r.soThongBao ? 'Đã gửi ' + r.soThongBao + ' thông báo nhắc gia hạn' : 'Không có công ty nào cần nhắc')
      if (mountedRef.current) setRes(r || {})
    } catch (e) {
      if (!isAbort(e)) {
        qsToast('Lỗi: ' + e.message)
        if (mountedRef.current) setErr((dryRun ? 'Chạy thử' : 'Gửi nhắc') + ' lỗi: ' + e.message)
      }
    } finally {
      if (acRef.current === ac) acRef.current = null
      if (mountedRef.current) setBusy('')
    }
  }

  return (
    <div className="qsa-card qsex-card">
      <div className="qsa-card-h">
        <span className="qsa-card-ic"><QsIcon name="clock" size={16} /></span>
        <h3>Nhắc gia hạn công ty</h3>
        <span className="qsex-tag">Quản trị hệ thống</span>
      </div>
      <div className="qsa-card-b">
        <div className="qsex-hint">
          Nhắc trong ứng dụng (chuông thông báo + dải nhắc) cho admin đang hoạt động khi hạn dùng còn 30 / 14 / 7 / 3 / 1 / 0 ngày,
          mỗi mốc một lần; gia hạn (đổi hạn dùng) thì nhắc lại từ đầu. Lịch tự động: 8h05 sáng mỗi ngày (giờ VN).
          Không gửi Lark, không gửi email. <i>Giả định, chờ chủ sản phẩm xác nhận.</i>
        </div>
        <div className="qsex-bar">
          <span className="qsa-sp" />
          <button type="button" className="qsa-btn sm" disabled={!!busy} onClick={() => chay(true)}>
            <QsIcon name="eye" size={14} /> {busy === 'dry' ? 'Đang chạy…' : 'Chạy thử'}
          </button>
          <button type="button" className="qsa-btn blue sm" disabled={!!busy} onClick={() => chay(false)}>
            <QsIcon name="bell" size={14} /> {busy === 'send' ? 'Đang gửi…' : 'Gửi nhắc ngay'}
          </button>
        </div>
        {busy ? <div className="qsex-msg">{busy === 'dry' ? 'Đang chạy thử…' : 'Đang gửi nhắc…'}</div> : null}
        {err ? <div className="qsex-err" role="alert">{err}</div> : null}
        {res ? <KetQua r={res} /> : null}
      </div>
    </div>
  )
}

function KetQua({ r }) {
  const ds = Array.isArray(r.ds) ? r.ds : []
  return (
    <div className="qsex-res">
      <div className="qsex-res-h">
        <b>{r.dryRun ? 'Chạy thử' : 'Gửi nhắc'}</b> · ngày {ddmmyyyy(r.ngay)} (giờ VN)
        <span className="qsex-sum">{r.soCongTy || 0} công ty tới mốc · {r.soThongBao || 0} thông báo đã gửi</span>
      </div>
      {ds.length ? (
        <div className="qsa-tblwrap">
          <table className="qsa-tbl">
            <thead>
              <tr>
                <th>Công ty</th><th>Hạn dùng</th><th className="num">Còn (ngày)</th><th className="num">Mốc</th>
                <th className="num" title="Mốc đã nhắc trước lượt này">Mốc đã nhắc trước</th><th className="num">Admin</th><th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {ds.map(x => (
                <tr key={x.id}>
                  <td>{String(x.ten || '')}</td>
                  <td>{ddmmyyyy(x.hanDung)}</td>
                  <td className="num">{x.conLai}</td>
                  <td className="num">{x.moc}</td>
                  <td className="num">{x.mocCu == null ? '—' : x.mocCu}</td>
                  <td className="num">{x.soAdmin}</td>
                  <td><TrangThai x={x} dry={r.dryRun} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="qsex-msg">Không công ty nào còn từ 0 đến 30 ngày hạn dùng.</div>}
    </div>
  )
}

function TrangThai({ x, dry }) {
  if (x.loi) return <span className="qsex-st err">{x.loi}</span>
  if (x.daGui) return <span className="qsex-st ok">Đã gửi</span>
  if (!x.canGui) return <span className="qsex-st">Đã nhắc mốc này</span>
  if (!x.soAdmin) return <span className="qsex-st err">Chưa có admin đang hoạt động</span>
  return <span className="qsex-st warn">{dry ? 'Sẽ gửi' : 'Chưa gửi'}</span>
}
