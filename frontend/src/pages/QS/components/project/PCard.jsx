import { useMemo } from 'react'
import Icon from '../../../../components/ui/Icon'
import { useQs } from '../../state/QsData'
import { cpTong_ } from '../../lib/totals.js'
import { money, fmtDate, safeUrl_ } from '../../lib/format.js'
import { dezonUrl_ } from '../../lib/dashModel.js'
import { useFold, foldToggle_, projCtx_, usePdState, pdRetry_ } from './projectShell'
import { projInfoModal, dezonSet_, openProjDlg } from './projectActions'
import './project.css'

/* Băng thông tin dự án #pcard (port PUB/index.html:6643-6661, renderCard app.js:424-447; shot tab-boc.png).
   Một bản duy nhất, QS.jsx đặt trên các panel (ẩn ở dash/admin/sanpham/import/congty). Props: không có.
   Bấm băng = mở hộp Thông tin dự án; gập / mở nhớ ở qs_fold.pcard (chung với nút "Mở rộng bảng" của Bóc tách).
   Dạng gập dùng lại thanh .qs-bd-bar của bản clone. Số tiền chỉ hiện khi đã có projData của bản nháp (usePdState). */
export default function PCard() {
  const { cur, lines, projects, projData, selectProject, status } = useQs()
  const pd = usePdState(cur, status)
  const folded = useFold('pcard')
  const p = cur || {}
  const pct = Math.max(0, Math.min(100, Number(p.tienDo) || 0))
  // đúng số tab Chi phí: gồm Phần thô, đã trừ CK báo giá (cpTong_ với hm = '')
  const TT = useMemo(() => (cur ? cpTong_(lines || [], '', projCtx_(cur, projData)) : null), [cur, lines, projData])

  const openInfo = () => { if (cur) projInfoModal(cur.maDA) }
  const stop = e => e.stopPropagation()
  const sel = (
    <select
      className={folded ? 'qs-bd-bar-select' : 'qs-pc-sel'}
      value={cur ? cur.maDA : ''}
      onChange={e => selectProject(e.target.value)}
    >
      {projects.length
        ? projects.map(x => <option key={x.maDA} value={x.maDA}>{x.ten}</option>)
        : <option value="">— Chưa có dự án —</option>}
    </select>
  )
  const create = (
    <button type="button" className={folded ? 'qs-bd-bar-create' : 'qs-pc-create'} onClick={() => openProjDlg('create')}>Tạo dự án +</button>
  )
  const fold = (
    <button type="button" className={folded ? 'qs-bd-bar-toggle' : 'qs-pc-fold'} title="Thu gọn / mở băng thông tin dự án"
      aria-label="Thu gọn băng dự án" onClick={e => { e.stopPropagation(); foldToggle_('pcard') }}>
      <Icon name={folded ? 'chevronDown' : 'chevronUp'} size={14} />
    </button>
  )
  const dz = cur ? <DezonChip p={cur} cls={folded ? 'qs-bd-bar-link' : 'qs-pc-dz'} /> : null

  if (folded) {
    return (
      <div className="qs-bd-bar qs-pc-folded" onClick={openInfo} title="Bấm để sửa thông tin dự án">
        <span className="qs-bd-bar-name" title={p.ten || ''}>{p.ten || 'Chưa chọn dự án'}</span>
        <span className="qs-bd-bar-status">{p.trangThai || 'Bản nháp'}</span>
        {dz}
        <span className="qs-bd-bar-code">Mã: {p.maDA || '—'}</span>
        <span style={{ flex: 1 }} />
        <span className="qs-bd-bar-pct">{pct}%</span>
        <span className="qs-pc-proj-f" onClick={stop} title="Đổi dự án đang làm việc">{sel}{create}</span>
        {fold}
      </div>
    )
  }

  return (
    <div className="qs-pc" onClick={openInfo} title="Bấm để sửa thông tin dự án">
      <div className="qs-pc-main">
        <div className="qs-pc-top">
          <h1>{p.ten || 'Chưa chọn dự án'}</h1>
          <span className="qs-pc-status">{p.trangThai || 'Bản nháp'}</span>
          {dz}
          <span className="qs-pc-edit">Bấm để sửa ›</span>
        </div>
        <div className="qs-pc-code">Mã: <span>{p.maDA || '—'}</span></div>
      </div>
      <div className="qs-pc-info">
        <div><span className="k">Khách hàng</span><span className="v">{p.khachHang || '—'}</span></div>
        <div><span className="k">Điện thoại</span><span className="v">{p.sdt || '—'}</span></div>
        <div><span className="k">Địa chỉ</span><span className="v">{p.diaChi || '—'}</span></div>
        <div><span className="k">Ngày tạo</span><span className="v">{fmtDate(p.ngayTao)}</span></div>
      </div>
      <div className="qs-pc-kpi">
        {TT && (
          <>
            <div className="qs-pc-k"><span className="kv">{(lines || []).length}</span><span className="kl">Hạng mục</span></div>
            {pd.ready
              ? (
                <>
                  <div className="qs-pc-k"><span className="kv">{money(TT.net)}đ</span><span className="kl">Tổng giá bán</span></div>
                  <div className="qs-pc-k"><span className="kv">{money(TT.net - TT.von)}đ</span><span className="kl">Lợi nhuận</span></div>
                  {TT.ptErr && <div className="qs-pc-k qs-pc-err" title={TT.ptErr}><span className="kv">!</span><span className="kl">Phần thô lỗi, chưa tính</span></div>}
                </>
              )
              : (
                <div className={`qs-pc-k${pd.err ? ' qs-pc-err' : ''}`} title={pd.err || 'Đang tải dữ liệu dự án (Phần thô, chiết khấu báo giá)'}>
                  <span className="kv">{pd.err ? 'Lỗi tải dữ liệu' : 'Đang tải…'}</span>
                  {(pd.err || pd.slow)
                    ? <button type="button" className="qs-pc-retry" onClick={e => { e.stopPropagation(); pdRetry_(cur.maDA) }}>Thử lại</button>
                    : <span className="kl">Tổng giá bán · Lợi nhuận</span>}
                </div>
              )}
          </>
        )}
      </div>
      <div className="qs-pc-prog"><div className="qs-pc-pct">{pct}%</div><div className="qs-pc-bar"><i style={{ width: pct + '%' }} /></div></div>
      <div className="qs-pc-proj" onClick={stop} title="Đổi dự án đang làm việc">{sel}{create}</div>
      {fold}
    </div>
  )
}

/* Chip link bài dự án trên dezon.vn (port dezonChip_, PUB/dash.js:12-20): đã gắn -> mở bài; chưa -> bấm để dán link */
export function DezonChip({ p, cls, label = true }) {
  const u = String((p && p.linkDezon) || '').trim()
  if (u) {
    return (
      <a className={`${cls} on`} href={safeUrl_(dezonUrl_(u))} target="_blank" rel="noopener noreferrer"
        title={'Mở bài dự án trên dezon.vn — ' + dezonUrl_(u)} onClick={e => e.stopPropagation()}>
        <Icon name="link" size={label ? 10 : 13} />{label && 'Dezon'}
      </a>
    )
  }
  return (
    <button type="button" className={cls} title="Chưa gắn link bài dự án trên dezon.vn — bấm để dán link"
      onClick={e => { e.stopPropagation(); dezonSet_(p.maDA) }}>
      <Icon name="link" size={label ? 10 : 13} />{label && 'Gắn link'}
    </button>
  )
}
