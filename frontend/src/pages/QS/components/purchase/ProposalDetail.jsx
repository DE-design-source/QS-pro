import { useEffect, useState } from 'react'
import Icon from '../../../../components/ui/Icon'
import { MrootPortal } from '../common/Mroot'
import * as api from '../../api/qsApi'
import { isAbort } from '../../api/http'
import { money, fmtDate } from '../../lib/format'
import { DX_TEN_, dxStatusCls_ } from '../../lib/purchase'
import { fmtDateTime_ } from './purchaseUi'

/* Chi tiết phiếu đề xuất #dxOv (port dxDetail / dxDetailHtml_, PUB/muahang.js:392-450).
   Lấy phiếu từ danh sách của dự án (đã có items) [F7]; không có mới gọi getDeXuat (chỉ Admin).
   Props: ma, list (phiếu của dự án đang mở), onClose(), onResolve(ma, approve) (đã đóng hộp trước, như bản gốc). */
export default function ProposalDetail({ ma, list, onClose, onResolve }) {
  const [st, setSt] = useState(() => {
    const o = (list || []).filter(r => r.ma === ma)[0]
    return o ? { o } : { loading: true }
  })

  useEffect(() => {
    if (!st.loading) return undefined
    const ctl = new AbortController()
    api.getDeXuat(ma, ctl.signal)
      .then(o => setSt({ o }))
      .catch(e => { if (!isAbort(e)) setSt({ err: e.message }) })
    return () => ctl.abort()
    // chỉ tải 1 lần khi mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ma])

  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  let body
  if (st.loading) body = <div className="qs-po-dx-empty">Đang tải…</div>
  else if (st.err != null) body = <div className="qs-po-dx-empty">Lỗi tải phiếu: {st.err}</div>
  else body = <DetailBody o={st.o || {}} onResolve={(approve) => { onClose(); onResolve(st.o.ma, approve) }} />

  return (
    <MrootPortal>
      <div className="qsc-ov" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="qsc-dlg qs-po-dx" role="dialog" aria-modal="true">
          <div className="qs-po-dlg-h">
            <h3><Icon name="gauge" size={16} /> Chi tiết đề xuất</h3>
            <button type="button" className="qsc-x" onClick={onClose}>✕</button>
          </div>
          <div className="qs-po-dx-body">{body}</div>
        </div>
      </div>
    </MrootPortal>
  )
}

function DetailBody({ o, onResolve }) {
  const scls = dxStatusCls_(o.status)
  const isCK = o.loai !== 'tt'
  const info = (k, v) => (v ? <div className="qs-po-dx-i" key={k}><span>{k}</span><b>{v}</b></div> : null)
  const items = o.items || []
  let head, rows, tot
  if (isCK) {
    head = <tr><th className="c">STT</th><th>Sản phẩm</th><th className="c">ĐVT</th><th className="n">SL</th><th className="n">Đơn giá hiện tại</th><th className="c">Đề xuất giảm</th><th className="n">Đơn giá đề xuất</th><th className="n">Thành tiền</th></tr>
    rows = items.length ? items.map((it, i) => (
      <tr key={i}>
        <td className="c">{i + 1}</td>
        <td><b>{it.ten || ''}</b>{it.ma ? <span className="qs-po-dx-code">{it.ma}</span> : null}</td>
        <td className="c">{it.dvt || ''}</td><td className="n">{it.sl || 0}</td>
        <td className="n">{money(it.donGiaGoc)}</td>
        <td className="c"><b className="qs-po-dx-pct">{(it.pct || 0) + '%'}</b></td>
        <td className="n">{money(it.donGia)}</td>
        <td className="n b">{money(it.thanhTien)}</td>
      </tr>
    )) : <tr><td colSpan={8} className="qs-po-dx-none">Phiếu không có dòng nào.</td></tr>
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
        <td className="c"><b className="qs-po-dx-pct">{(it.pct || 0) + '%'}</b></td>
        <td className="n b">{money(it.thanhTien)}</td>
        <td className="c">{it.ngay ? fmtDate(it.ngay) : '—'}</td>
        <td>{it.ghiChu || ''}</td>
      </tr>
    )) : <tr><td colSpan={5} className="qs-po-dx-none">Phiếu không có đợt nào.</td></tr>
    tot = (
      <>
        <div><span>Giá trị đơn hàng</span><b>{money(o.tongGoc)} đ</b></div>
        <div className="grand"><span>TỔNG ĐỀ XUẤT</span><b>{money(o.tongDeXuat)} đ</b></div>
      </>
    )
  }
  return (
    <>
      <div className="qs-po-dx-head">
        <div className="qs-po-dx-ma">{o.ma}<span className={`qs-po-badge ${scls}`}>{o.status || ''}</span>
          <span className="qs-po-dx-kind">{DX_TEN_[o.loai] || 'Đề xuất'}</span></div>
        <div className="qs-po-dx-grid">
          {info('Nhà cung cấp', o.supplier)}{info('Dự án', o.project)}
          {info('Người gửi', o.requester)}{info('Phòng ban', o.phongBan)}
          {info('Hạng mục', o.hangMuc)}{info('Ngày gửi', fmtDateTime_(o.at))}
          {o.nguoiDuyet ? info('Người duyệt', o.nguoiDuyet) : null}
          {o.ngayDuyet ? info('Ngày duyệt', fmtDateTime_(o.ngayDuyet)) : null}
        </div>
        {o.ghiChu ? <div className="qs-po-dx-note"><Icon name="fileText" size={12} /> {o.ghiChu}</div> : null}
      </div>
      <div className="qs-po-dx-tblwrap"><table className="qs-po-dx-tbl"><thead>{head}</thead><tbody>{rows}</tbody></table></div>
      <div className="qs-po-dx-tot">{tot}</div>
      {o.status === 'Chờ duyệt' && (
        <div className="qs-po-dx-act">
          <button type="button" className="qsc-btn qs-po-danger" onClick={() => onResolve(false)}>Từ chối</button>
          <button type="button" className="qsc-btn blue" onClick={() => onResolve(true)}><Icon name="check" size={15} /> Duyệt phiếu</button>
        </div>
      )}
    </>
  )
}
