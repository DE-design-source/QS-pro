import { useMemo } from 'react'
import { useQs } from '../state/QsData'
import { dashTotals_, cpTong_ } from '../lib/totals.js'
import { money } from '../lib/format.js'
import { projectGroups, currentGroup } from '../lib/dashModel.js'
import StatusView from './common/StatusView'
import ProjectBanner from './dashboard/ProjectBanner'
import KpiCard from './dashboard/KpiCard'
import ProjectList from './dashboard/ProjectList'
import GroupValueCard from './dashboard/GroupValueCard'
import QuickActions from './dashboard/QuickActions'
import ProjectDialogs from './project/ProjectDialogs'
import { projCtx_, usePdState, pdRetry_ } from './project/projectShell'
import './dashboard/dashboard.css'

/* Tab "Bảng điều khiển" (port renderDash, PUB/dash.js:142-195; shots tab-dash.png, tab-dash-emptyproject.png).
   Số liệu TOÀN DỰ ÁN của bản nháp đang mở (không theo hmNode): cpTong_(lines, '') = dòng + Phần thô - CK báo giá -> VAT.
   Props: onGoto (giữ để tương thích QS.jsx, không dùng: điều hướng qua useQs().navigate).
   Panel này luôn được mount nên cũng là nơi vẽ các hộp thoại của phần dự án (<ProjectDialogs/>).
   Danh sách dự án + hộp thoại giữ CÙNG vị trí trong cây ở mọi trạng thái (không mất ô tìm khi cur tạm null).
   Chưa có dữ liệu rời của bản nháp (projData) thì số tiền hiện "Đang tải…", lỗi thì báo + "Thử lại" (usePdState). */
export default function OverviewTab() {
  const { cur, lines, projects, projData, status } = useQs()
  const pd = usePdState(cur, status)
  const T = useMemo(() => {
    if (!cur) return null
    const ctx = projCtx_(cur, projData)
    const r = dashTotals_(lines || [], ctx)
    r.ptErr = cpTong_(lines || [], '', ctx).ptErr || ''
    return r
  }, [cur, lines, projData])
  const groups = useMemo(() => projectGroups(projects), [projects])
  const has = !!(cur && T)
  const gr = has ? currentGroup(projects, cur) : null
  const ok = has && pd.ready
  const m = v => (ok ? money(v) + ' đ' : (pd.err ? '—' : 'Đang tải…'))

  return (
    <>
      {!has && <StatusView kind="empty" icon="layers" title="Chưa chọn bản nháp" message="Chọn một bản nháp bên dưới để xem tổng quan — hoặc tạo dự án mới." />}
      {has && <ProjectBanner cur={cur} idx={gr ? gr.idx : 0} />}
      {has && !pd.ready && (
        <div className={`qsc-note qs-dash-pd${pd.err ? ' err' : ''}`} role={pd.err ? 'alert' : 'status'}>
          <span>{pd.err
            ? pd.err + ' Số tiền chưa hiện vì sẽ thiếu Phần thô và chiết khấu báo giá.'
            : 'Đang tải dữ liệu dự án (Phần thô, chiết khấu báo giá)…' + (pd.slow ? ' Lâu hơn bình thường.' : '')}</span>
          {(pd.err || pd.slow) && <button type="button" className="qsc-btn blue" onClick={() => pdRetry_(cur.maDA)}>Thử lại</button>}
        </div>
      )}
      {ok && T.ptErr && <div className="qsc-note err qs-dash-pd" role="alert">Phần thô lỗi, chưa tính vào tổng: {T.ptErr}</div>}
      {has && (
        <div className="qs-dash-kpi-grid">
          <KpiCard icon="listLines" tone="blue" value={T.n} label="Dòng sản phẩm" note="toàn dự án" />
          <KpiCard icon="lock" tone="gray" value={m(T.von)} label="Giá vốn" note="toàn dự án" />
          <KpiCard icon="banknote" tone="blue" value={m(T.ban)} label="Giá bán" note="chưa VAT" />
          <KpiCard icon="fileText" tone="gray" value={m(T.total)} label="Tổng thanh toán" note={'gồm VAT ' + T.vatPct + '%'} />
          <KpiCard icon="gauge" tone={ok && T.ln < 0 ? 'red' : 'green'} value={m(T.ln)} label="Lợi nhuận" note={(ok ? T.bien.toFixed(1) : '—') + '% biên'}
            positive={ok && T.ln >= 0} negative={ok && T.ln < 0} />
        </div>
      )}

      <div className="qs-dash-main">
        <ProjectList groups={groups} curMa={has ? cur.maDA : ''} />
        <div className="qs-dash-side">
          {has && <GroupValueCard groups={ok ? T.groups.map(g => ({ key: g.k, name: g.ten, value: g.ban, pct: g.pct })) : null} wait={pd.err ? 'Chưa tải được dữ liệu dự án.' : 'Đang tải…'} />}
          <QuickActions />
        </div>
      </div>
      <ProjectDialogs />
    </>
  )
}
