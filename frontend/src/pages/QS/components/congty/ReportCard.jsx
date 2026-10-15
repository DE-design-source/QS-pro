import { useEffect, useRef, useState } from 'react'
import * as api from '../../api/qsApi'
import { isAbort } from '../../api/http'
import { qsToast, qsConfirm } from '../common/dialogs'
import QsIcon from '../common/QsIcon'
import './report.css'

/* Thẻ "Báo cáo sản phẩm nhập mới (Lark)" — chỉ super (M18.1, QT-15 Q-01).
   Máy chủ: POST /api/v1/reports/new-products (reports/service.go BaoCaoNhapSP), thân {tuVN?, dryRun?}.
   tuVN được máy chủ đọc là ĐỒNG HỒ VN (reports/dto.go), nên ngày chọn D gửi đúng chuỗi 'D' + 'T00:00:00.000Z'
   (= 0h ngày D giờ VN); không qua new Date(...).toISOString() để khỏi lệch múi giờ của máy người dùng.
   Kết quả (không bịa khoá):
     - có message  -> {sent:false, count:0, message, khuyet?}  (kỳ trống / mốc sai / lỗi đọc dữ liệu)
     - dryRun      -> {sent:false, count, soThe, khuyet, tu, the:[{congTy, ctKey, bang[], tk{}, khuyet, nganh[]}]}
     - gửi thật    -> {sent, count, khuyet, the:[{congTy, soSP, sent}]} */

const RE_NGAY = /^\d{4}-\d{2}-\d{2}$/

function tuVNOf(ngay) {
  return RE_NGAY.test(ngay) ? ngay + 'T00:00:00.000Z' : ''
}

// "tu" của dryRun là mốc UTC thật (tuVN - 7h) -> hiện lại theo giờ VN
function fmtMocVN(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso || '')
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(d)
  } catch (e) { return d.toISOString() }
}

function ddmmyyyy(ngay) {
  const m = RE_NGAY.test(ngay) ? ngay.split('-') : null
  return m ? m[2] + '/' + m[1] + '/' + m[0] : ''
}

/* Lượt "Gửi ngay" đang chạy, giữ ở cấp module: rời tab giữa chừng thì máy chủ vẫn gửi xong, nên không huỷ request
   và khi quay lại tab, thẻ vẫn khoá nút + nhận kết quả (tránh bấm gửi lần 2 làm trùng thẻ trên nhóm Lark). */
let guiDangChay = null                        // {ngay, p: Promise<r>}

function thongBaoGui(r) {
  if (r && r.message) qsToast(r.message)
  else qsToast(r && r.sent ? 'Đã gửi báo cáo lên Lark' : 'Gửi Lark thất bại: không công ty nào gửi được')
}

export default function ReportCard() {
  const [ngay, setNgay] = useState('')
  const [busy, setBusy] = useState('')        // '' | 'dry' | 'send'
  const [res, setRes] = useState(null)        // {mode:'dry'|'send', ngay, r}
  const acRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    if (guiDangChay) choGui(guiDangChay)
    return () => {
      mountedRef.current = false
      if (acRef.current) acRef.current.abort()   // chỉ huỷ Chạy thử; Gửi ngay không gắn signal
    }
  }, [])

  // Theo dõi một lượt gửi (của lần mount này hoặc lần trước) để hiện kết quả trên thẻ.
  function choGui(g) {
    setBusy('send')
    g.p.then(r => {
      if (mountedRef.current) setRes({ mode: 'send', ngay: g.ngay, r: r || {} })
    }, () => {}).finally(() => {
      if (mountedRef.current) setBusy('')
    })
  }

  async function chay(dryRun) {
    if (busy || guiDangChay) return
    if (ngay && !RE_NGAY.test(ngay)) { qsToast('Ngày không hợp lệ'); return }
    const tuVN = tuVNOf(ngay)
    if (!dryRun) {
      const ok = await qsConfirm({
        title: 'Gửi báo cáo lên Lark ngay?',
        note: 'Mỗi công ty có sản phẩm nhập mới sẽ nhận một thẻ báo cáo trên nhóm Lark, kỳ tính '
          + (ngay ? 'từ 0h ngày ' + ddmmyyyy(ngay) + ' (giờ VN)' : 'hiện tại (từ 8h sáng ngày gửi định kỳ trước)')
          + '. Việc gửi không hoàn tác được. Gửi thành công được tính là lần gửi của hôm nay: nếu hôm nay là thứ 4 / thứ 7'
          + ' và chưa tới 8h, lần gửi tự động 8h hôm nay sẽ bỏ qua, và kỳ tự động kế tiếp tính từ 8h hôm nay'
          + ' (sản phẩm nhập trước lúc đó mà không thuộc kỳ gửi tay này sẽ không có trong báo cáo nào).',
        ok: 'Gửi ngay',
      })
      if (!ok || !mountedRef.current || guiDangChay) return
      const g = { ngay, p: null }
      g.p = api.baoCaoNhapSP(tuVN ? { tuVN } : {})
      guiDangChay = g
      g.p.then(thongBaoGui, e => qsToast('Lỗi: ' + (e && e.message)))
        .finally(() => { if (guiDangChay === g) guiDangChay = null })
      choGui(g)
      return
    }
    const opts = { dryRun: true }
    if (tuVN) opts.tuVN = tuVN
    const ac = new AbortController()
    acRef.current = ac
    setBusy('dry')
    try {
      const r = await api.baoCaoNhapSP(opts, ac.signal)
      if (ac.signal.aborted) return
      setRes({ mode: 'dry', ngay, r: r || {} })
      if (r && r.message) qsToast(r.message)
    } catch (e) {
      if (!isAbort(e)) qsToast('Lỗi: ' + e.message)
    } finally {
      if (acRef.current === ac) { acRef.current = null; if (mountedRef.current) setBusy('') }
    }
  }

  return (
    <div className="qsa-card qsrp-card">
      <div className="qsa-card-h">
        <span className="qsa-card-ic"><QsIcon name="bell" size={16} /></span>
        <h3>Báo cáo sản phẩm nhập mới (Lark)</h3>
        <span className="qsrp-tag">Quản trị hệ thống</span>
      </div>
      <div className="qsa-card-b">
        <div className="qsrp-hint">
          Gom sản phẩm mới có ghi nhận người nhập, tách theo công ty, mỗi công ty một thẻ Lark.
          Lịch tự động: 8h sáng thứ 4 và thứ 7 (giờ VN). Để trống “Từ ngày” = kỳ hiện tại (từ 8h sáng ngày gửi định kỳ trước).
          “Gửi ngay” thành công được tính là lần gửi của hôm nay (thứ 4 / thứ 7 trước 8h thì lần tự động hôm nay bỏ qua).
        </div>
        <div className="qsrp-bar">
          <label className="qsrp-f">
            <span>Từ ngày (giờ VN)</span>
            <input type="date" value={ngay} disabled={!!busy} onChange={e => setNgay(e.target.value)} />
          </label>
          {ngay ? <button type="button" className="qsa-btn ghost xs" disabled={!!busy} onClick={() => setNgay('')}>Về kỳ hiện tại</button> : null}
          <span className="qsa-sp" />
          <button type="button" className="qsa-btn sm" disabled={!!busy} onClick={() => chay(true)}>
            <QsIcon name="eye" size={14} /> {busy === 'dry' ? 'Đang chạy…' : 'Chạy thử (không gửi)'}
          </button>
          <button type="button" className="qsa-btn blue sm" disabled={!!busy} onClick={() => chay(false)}>
            <QsIcon name="bell" size={14} /> {busy === 'send' ? 'Đang gửi…' : 'Gửi ngay lên Lark'}
          </button>
        </div>
        {res ? <KetQua res={res} /> : null}
      </div>
    </div>
  )
}

function KetQua({ res }) {
  const { mode, r } = res
  const ky = res.ngay ? 'từ 0h ngày ' + ddmmyyyy(res.ngay) : 'kỳ hiện tại'
  const nhan = mode === 'dry' ? 'Chạy thử' : 'Gửi ngay'
  const khuyet = Number(r.khuyet) || 0
  const the = Array.isArray(r.the) ? r.the : []

  if (r.message) {
    return (
      <div className="qsrp-res">
        <div className="qsrp-res-h"><b>{nhan}</b> · {ky}</div>
        <div className="qsrp-msg">{r.message}</div>
        {khuyet ? <div className="qsrp-warn">{khuyet} sản phẩm trong kỳ chưa ghi nhận người nhập (không tính vào báo cáo).</div> : null}
      </div>
    )
  }

  if (mode === 'send') {
    return (
      <div className="qsrp-res">
        <div className="qsrp-res-h"><b>{nhan}</b> · {ky}
          <span className={`qsrp-st ${r.sent ? 'ok' : 'err'}`}>{r.sent ? 'Đã gửi' : 'Gửi thất bại'}</span>
        </div>
        <div className="qsrp-sum">
          <Sum v={r.count} l="Sản phẩm" /><Sum v={the.length} l="Công ty" />
          {khuyet ? <Sum v={khuyet} l="Chưa rõ người nhập" warn /> : null}
        </div>
        {!r.sent ? <div className="qsrp-msg err">Máy chủ không gửi được thẻ nào tới Lark (webhook lỗi hoặc không phản hồi). Chi tiết lỗi nằm trong nhật ký máy chủ.</div> : null}
        <div className="qsa-tblwrap">
          <table className="qsa-tbl">
            <thead><tr><th>Công ty</th><th className="num">Số SP</th><th>Kết quả</th></tr></thead>
            <tbody>
              {the.map((t, i) => (
                <tr key={i}>
                  <td>{String(t.congTy)}</td>
                  <td className="num">{t.soSP}</td>
                  <td><span className={`qsrp-st ${t.sent ? 'ok' : 'err'}`}>{t.sent ? 'Đã gửi' : 'Lỗi gửi Lark'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="qsrp-res">
      <div className="qsrp-res-h"><b>{nhan}</b> · {r.tu ? <>tính từ <b>{fmtMocVN(r.tu)}</b> (giờ VN){res.ngay ? null : ' · kỳ hiện tại'}</> : ky}
        <span className="qsrp-st">Không gửi Lark</span>
      </div>
      <div className="qsrp-sum">
        <Sum v={r.count} l="Sản phẩm có người nhập" /><Sum v={r.soThe} l="Công ty (số thẻ)" />
        <Sum v={khuyet} l="Chưa rõ người nhập" warn={khuyet > 0} />
      </div>
      <div className="qsa-tblwrap">
        <table className="qsa-tbl qsrp-tbl">
          <thead><tr><th>Công ty</th><th className="num">Số SP</th><th className="num">Số NCC</th><th className="num">Người nhập</th><th>Theo ngành</th><th className="num">Chưa rõ người nhập</th></tr></thead>
          <tbody>
            {the.map((t, i) => <TheRow key={t.ctKey || ('_' + i)} t={t} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TheRow({ t }) {
  const [mo, setMo] = useState(false)
  const tk = t.tk || {}
  const bang = Array.isArray(t.bang) ? t.bang : []
  const nganh = Array.isArray(t.nganh) ? t.nganh : []
  return (
    <>
      <tr className="qsrp-ct" onClick={() => setMo(v => !v)} title="Bấm để xem theo người nhập">
        <td><span className={`qsrp-caret${mo ? ' on' : ''}`}>›</span> <b>{String(t.congTy)}</b>{tk.chuaGanCT && String(t.congTy) !== 'Chưa gắn công ty' ? <span className="qsrp-st err">Chưa gắn công ty</span> : null}</td>
        <td className="num"><b>{tk.tongSP}</b></td>
        <td className="num">{tk.tongNCC}</td>
        <td className="num">{tk.tongNguoi}</td>
        <td>{nganh.map((g, j) => <span key={j} className="qsrp-chip">{g.ten}: {g.soSP} SP · {g.soNCC} NCC</span>)}</td>
        <td className="num">{t.khuyet ? <span className="qsrp-warn-n">{t.khuyet}</span> : 0}</td>
      </tr>
      {mo ? (
        <tr className="qsrp-sub">
          <td colSpan={6}>
            <table className="qsrp-ng">
              <thead><tr><th>Người nhập</th><th>Phòng ban</th><th className="num">Tổng SP</th><th className="num">Số NCC</th><th>Theo ngày</th></tr></thead>
              <tbody>
                {bang.map((b, j) => (
                  <tr key={j}>
                    <td>{String(b.ten)}</td>
                    <td>{String(b.phongBan || '')}</td>
                    <td className="num">{b.tongSP}</td>
                    <td className="num">{b.tongNCC}</td>
                    <td>{(b.ngay || []).map((d, k) => <span key={k} className="qsrp-chip">{d.ngay}: {d.soSP} SP · {d.soNCC} NCC</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function Sum({ v, l, warn }) {
  return <div className={`qsrp-sumi${warn ? ' warn' : ''}`}><b>{v == null ? 0 : v}</b><i>{l}</i></div>
}
