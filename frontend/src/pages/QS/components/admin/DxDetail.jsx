import { useEffect, useState } from 'react'
import * as api from '../../api/qsApi'
import { isAbort } from '../../api/http'
import { money, fmtDate } from '../../lib/format'
import QsIcon from '../common/QsIcon'
import AdmDlg from './AdmDlg'
import { DX_TEN_, dxStatusCls_, fmtDateTime_ } from './adminUtil'

/* Chi tiết phiếu đề xuất khi Admin bấm vào thẻ "Đề xuất mua hàng" (port dxDetail / dxDetailHtml_, PUB/muahang.js:392-450).
   Danh sách admin không kèm dòng nên luôn gọi getDeXuat (chỉ Admin).
   Props: ma, onClose(), onResolve(ma, approve). */
export default function DxDetail({ ma, onClose, onResolve }) {
  const [o, setO] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    const ac = new AbortController()
    setO(null); setErr('')
    api.getDeXuat(ma, ac.signal).then(setO, e => { if (!isAbort(e)) setErr(e.message) })
    return () => ac.abort()
  }, [ma])

  return (
    <AdmDlg icon="gauge" title="Chi tiết đề xuất" wide onClose={onClose}>
      <div className="qsa-pur-body">
        {err ? <div className="qsa-empty" style={{ padding: 26 }}>Lỗi tải phiếu: {err}</div>
          : !o ? <div className="qsa-empty" style={{ padding: 26 }}>Đang tải…</div>
            : <DxBody o={o} onClose={onClose} onResolve={onResolve} />}
      </div>
    </AdmDlg>
  )
}

function Info({ k, v }) {
  return v ? <div className="qsa-pur-i"><span>{k}</span><b>{v}</b></div> : null
}

function DxBody({ o, onClose, onResolve }) {
  const scls = dxStatusCls_(o.status)
  const isCK = o.loai !== 'tt'
  const items = o.items || []
  let head, rows, tot
  if (isCK) {
    head = (
      <tr><th className="c">STT</th><th>Sản phẩm</th><th className="c">ĐVT</th><th className="n">SL</th>
        <th className="n">Đơn giá hiện tại</th><th className="c">Đề xuất giảm</th><th className="n">Đơn giá đề xuất</th><th className="n">Thành tiền</th></tr>
    )
    rows = items.length ? items.map((it, i) => (
      <tr key={i}>
        <td className="c">{i + 1}</td>
        <td><b>{it.ten || ''}</b>{it.ma ? <span className="qsa-pur-code">{it.ma}</span> : null}</td>
        <td className="c">{it.dvt || ''}</td><td className="n">{it.sl || 0}</td>
        <td className="n">{money(it.donGiaGoc)}</td>
        <td className="c"><b className="qsa-dx-pct">{it.pct || 0}%</b></td>
        <td className="n">{money(it.donGia)}</td>
        <td className="n b">{money(it.thanhTien)}</td>
      </tr>
    )) : <tr><td colSpan={8} className="qsa-empty" style={{ padding: 18 }}>Phiếu không có dòng nào.</td></tr>
    tot = (
      <>
        <div><span>Giá hiện tại</span><b>{money(o.tongGoc)} đ</b></div>
        <div><span>Sau đề xuất</span><b>{money(o.tongDeXuat)} đ</b></div>
        <div className="grand"><span>TIẾT KIỆM</span><b>{money(o.tienGiam)} đ</b></div>
      </>
    )
  } else {
    head = <tr><th className="c">Đợt</th><th className="c">Tỷ lệ</th><th className="n">Số tiền</th><th className="c">Ngày dự kiến</th><th>Ghi chú</th></tr>
    rows = items.length ? items.map((it, i) => (
      <tr key={i}>
        <td className="c b">{it.ten || ('Đợt ' + (i + 1))}</td>
        <td className="c"><b className="qsa-dx-pct">{it.pct || 0}%</b></td>
        <td className="n b">{money(it.thanhTien)}</td>
        <td className="c">{it.ngay ? fmtDate(it.ngay) : '—'}</td>
        <td>{it.ghiChu || ''}</td>
      </tr>
    )) : <tr><td colSpan={5} className="qsa-empty" style={{ padding: 18 }}>Phiếu không có đợt nào.</td></tr>
    tot = (
      <>
        <div><span>Giá trị đơn hàng</span><b>{money(o.tongGoc)} đ</b></div>
        <div className="grand"><span>TỔNG ĐỀ XUẤT</span><b>{money(o.tongDeXuat)} đ</b></div>
      </>
    )
  }
  return (
    <>
      <div className="qsa-pur-head">
        <div className="qsa-pur-ma">{o.ma}<span className={`qsa-badge ${scls}`}>{o.status || ''}</span>
          <span className="qsa-dx-kind">{DX_TEN_[o.loai] || 'Đề xuất'}</span></div>
        <div className="qsa-pur-grid">
          <Info k="Nhà cung cấp" v={o.supplier} /><Info k="Dự án" v={o.project} />
          <Info k="Người gửi" v={o.requester} /><Info k="Phòng ban" v={o.phongBan} />
          <Info k="Hạng mục" v={o.hangMuc} /><Info k="Ngày gửi" v={fmtDateTime_(o.at)} />
          {o.nguoiDuyet ? <Info k="Người duyệt" v={o.nguoiDuyet} /> : null}
          {o.ngayDuyet ? <Info k="Ngày duyệt" v={fmtDateTime_(o.ngayDuyet)} /> : null}
        </div>
        {o.ghiChu ? <div className="qsa-pur-note"><QsIcon name="doc" size={12} /> {o.ghiChu}</div> : null}
      </div>
      <div className="qsa-tblwrap qsa-pur-tblwrap">
        <table className="qsa-pur-tbl"><thead>{head}</thead><tbody>{rows}</tbody></table>
      </div>
      <div className="qsa-pur-tot">{tot}</div>
      {o.status === 'Chờ duyệt' ? (
        <div className="qsa-pur-act">
          <button type="button" className="qsa-btn ghost sm danger" onClick={() => { onResolve(o.ma, false); onClose() }}>Từ chối</button>
          <button type="button" className="qsa-btn blue" onClick={() => { onResolve(o.ma, true); onClose() }}><QsIcon name="check" size={15} /> Duyệt phiếu</button>
        </div>
      ) : null}
    </>
  )
}
