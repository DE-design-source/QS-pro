import { useEffect } from 'react'
import StatusView from '../common/StatusView'
import { useQs } from '../../state/QsData'
import { useFold, usePdState, pdRetry_ } from '../project/projectShell'
import { usePhanTho, usePtTemplate } from './ptHooks'
import { setPtUi } from './ptState'
import PtTable from './PtTable'
import PtSheet from './PtSheet'
import './phantho.css'

/* Đề mục 3.1 Phần thô trong tab Bóc tách (port renderPhanTho / renderPTLibrary / ptShowDetail_, PUB/phantho.js).
   Props: tools (tuỳ chọn: nút "Vừa thêm" + "Cập nhật giá" của BreakdownTab, như dải công cụ tkToolsSync_ boc.js:1643-1645
   vẫn hiện ở 3.1). Bên phải: bảng ước tính (Bảng tính = PtSheet, Bảng thường = PtTable, theo qs_bt_mode như
   btCheDo_ bangtinh.js:10). Thư viện công tác + các bước chọn + panel thông tin công tác là các component riêng
   (PtLibrary.jsx, PtDetail.jsx) do BreakdownTab cắm vào CatalogPanel (prop ptCount / ptFilters / ptLib) và cạnh cột phải.
   Bảng trống luôn vẽ bằng Bảng thường như bản gốc (btOn_('pt') && S.phanTho.length, PUB/phantho.js:2298).
   usePtTotals() -> {count, grand, vatPct, vat, afterTax} cho dòng tổng ở đầu bảng (ptTotalsBar_ 2331-2338, tkCount 2287). */

export function usePtTotals() {
  const d = usePhanTho()
  const c = d.comp || { grand: 0, vatPct: 0, vat: 0, afterTax: 0 }
  const count = d.phanTho.reduce((s, se) => s + ((se.items || []).length), 0)
  return { count, grand: c.grand, vatPct: c.vatPct, vat: c.vat, afterTax: c.afterTax }
}

function lsGet(k) { try { return localStorage.getItem(k) } catch (e) { return null } }

export default function PhanThoPanel({ tools } = {}) {
  const qs = useQs()
  const { cur, status } = qs
  const visible = qs.panelVisible('boc')
  const data = usePhanTho()
  const tpl = usePtTemplate()
  const pd = usePdState(cur, status)
  const foldCols = useFold('cols')
  const view = lsGet('qs_bt_mode') === 'cu' ? 'plain' : 'sheet'

  // Đổi dự án: bỏ chọn dòng / công tác đang mở của dự án cũ
  const ma = cur ? cur.maDA : ''
  useEffect(() => { setPtUi({ sel: {}, anchor: null, newRow: null, frzRows: 0 }) }, [ma])

  let main
  if (!cur) main = <div className="qspt-nocur">Chưa chọn dự án.</div>
  else if (data.err) main = <StatusView kind="error" title="Không đọc được bảng Phần thô" message={data.err} />
  else if (!pd.ready) {
    main = pd.err
      ? <StatusView kind="error" title="Không tải được dữ liệu dự án" message={pd.err} onRetry={() => pdRetry_(cur.maDA)} />
      : <StatusView kind="loading" message="Đang tải bảng Phần thô…" />
  } else if (view === 'plain' || !data.phanTho.length) main = <PtTable data={data} tpl={tpl} showCols={!foldCols} visible={visible} />
  else main = <PtSheet data={data} tpl={tpl} showCols={!foldCols} visible={visible} tools={tools} />

  return (
    <div className="qs-card qspt-card" data-pt-view={view}>
      {main}
    </div>
  )
}
