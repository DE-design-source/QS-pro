import { useEffect, useState } from 'react'
import * as api from '../../api/qsApi'
import { isAbort } from '../../api/http'
import { money } from '../../lib/format'
import QsIcon from '../common/QsIcon'
import AdmDlg from './AdmDlg'
import { PUR_CLS, fmtDateTime_, imgSrc1_, larkLbl_, larkCls_ } from './adminUtil'

/* Chi tiết đơn mua hàng khi Admin bấm vào 1 đơn (port purDetail / purDetailHtml_, PUB/admin.js:66-113).
   Props: code (maDon), onClose(), onResolve(maDon, approve) — Duyệt / Từ chối rồi đóng như bản gốc. */
export default function PurDetail({ code, onClose, onResolve }) {
  const [o, setO] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const ac = new AbortController()
    setO(null); setErr('')
    api.getPurchaseOrder(code, ac.signal).then(setO, e => { if (!isAbort(e)) setErr(e.message) })
    return () => ac.abort()
  }, [code])

  return (
    <AdmDlg icon="cart" title="Chi tiết đơn mua hàng" wide onClose={onClose}>
      <div className="qsa-pur-body">
        {err ? <div className="qsa-empty" style={{ padding: 26 }}>Lỗi tải đơn: {err}</div>
          : !o ? <div className="qsa-empty" style={{ padding: 26 }}>Đang tải…</div>
            : <PurBody o={o} onClose={onClose} onResolve={onResolve} />}
      </div>
    </AdmDlg>
  )
}

function Info({ k, v }) {
  return v ? <div className="qsa-pur-i"><span>{k}</span><b>{v}</b></div> : null
}

function PurBody({ o, onClose, onResolve }) {
  const scls = PUR_CLS[o.status] || 'pending'
  const items = o.items || []
  return (
    <>
      <div className="qsa-pur-head">
        <div className="qsa-pur-ma">{o.maDon}<span className={`qsa-badge ${scls}`}>{o.status || ''}</span></div>
        <div className="qsa-pur-grid">
          <Info k="Nhà cung cấp" v={o.supplier} /><Info k="Dự án" v={o.project} />
          <Info k="Người gửi" v={o.requester} /><Info k="Phòng ban" v={o.phongBan} />
          <Info k="Hạng mục" v={o.hangMuc} /><Info k="Ngày gửi" v={fmtDateTime_(o.at)} />
          {o.nguoiDuyet ? <Info k="Người duyệt" v={o.nguoiDuyet} /> : null}
          {o.ngayDuyet ? <Info k="Ngày duyệt" v={fmtDateTime_(o.ngayDuyet)} /> : null}
          <div className="qsa-pur-i"><span>Kết quả gửi Lark</span>
            <b><span className={`qsa-lark ${larkCls_(o.ketQuaGui)}`} title={o.kenhGui ? ('Kênh gửi: ' + o.kenhGui) : undefined}>{larkLbl_(o.ketQuaGui)}</span></b></div>
        </div>
        {o.ghiChu ? <div className="qsa-pur-note"><QsIcon name="doc" size={12} /> {o.ghiChu}</div> : null}
      </div>
      <div className="qsa-tblwrap qsa-pur-tblwrap">
        <table className="qsa-pur-tbl">
          <thead><tr>
            <th className="c">STT</th><th>Ảnh</th><th>Sản phẩm</th><th>Thương hiệu</th><th className="c">ĐVT</th>
            <th className="n">SL</th><th className="n">Đơn giá</th><th className="n">Thành tiền</th>
          </tr></thead>
          <tbody>
            {items.length ? items.map((it, i) => (
              <tr key={i}>
                <td className="c">{i + 1}</td>
                <td className="qsa-pur-th">{it.hinhAnh ? <PurImg src={imgSrc1_(it.hinhAnh)} /> : <span className="qsa-pur-noimg" />}</td>
                <td>
                  <b>{it.ten || ''}</b>
                  {it.ma ? <span className="qsa-pur-code">{it.ma}</span> : null}
                  {it.phong ? <span className="qsa-pur-room"><QsIcon name="building" size={10} /> {it.phong}</span> : null}
                </td>
                <td>{it.thuongHieu || ''}</td>
                <td className="c">{it.dvt || ''}</td>
                <td className="n">{it.sl || 0}</td>
                <td className="n">{money(it.donGia)}</td>
                <td className="n b">{money(it.thanhTien)}</td>
              </tr>
            )) : <tr><td colSpan={8} className="qsa-empty" style={{ padding: 18 }}>Đơn không có sản phẩm.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="qsa-pur-tot">
        <div><span>Tạm tính ({o.soSp || 0} SP)</span><b>{money(o.tongTruocVat)} đ</b></div>
        <div><span>VAT {o.vatPct || 0}%</span><b>{money(o.vat)} đ</b></div>
        <div className="grand"><span>TỔNG THANH TOÁN</span><b>{money(o.total)} đ</b></div>
      </div>
      {o.status === 'Chờ duyệt' ? (
        <div className="qsa-pur-act">
          <button type="button" className="qsa-btn ghost sm danger" onClick={() => { onResolve(o.maDon, false); onClose() }}>Từ chối</button>
          <button type="button" className="qsa-btn blue" onClick={() => { onResolve(o.maDon, true); onClose() }}><QsIcon name="check" size={15} /> Duyệt đơn</button>
        </div>
      ) : null}
    </>
  )
}

/* Ảnh lỗi thì ẩn đi (onerror visibility:hidden của bản gốc) */
function PurImg({ src }) {
  const [bad, setBad] = useState(false)
  return <img src={src} alt="" style={bad ? { visibility: 'hidden' } : undefined} onError={() => setBad(true)} />
}
