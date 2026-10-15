import { useEffect, useState } from 'react'
import { useFold, foldToggle_ } from '../project/projectShell'
import Icon from '../../../../components/ui/Icon'
import { money } from '../../lib/format.js'

const Caret = () => <span className="qs-bd-caret" />
const dong = n => `${money(n)} đ`
const pad2 = n => (n < 10 ? '0' : '') + n

/* Phần đầu bảng bóc tách (port hàng "Hạng mục đã bóc" PUB/index.html:6733-6750 + tkTongTien_ boc.js:583-597):
   hạng mục đang bóc (bấm mở cây hạng mục), chip Nhân công / Vật tư, kiểu bảng, tổng tiền + VAT, cấu hình cột.
   Thu gọn: chỉ còn một hàng (ẩn phần tổng tiền, đưa cấu hình cột lên cùng hàng).
   Props: count (số dòng đang bóc; 3.1 = số dòng Phần thô), treeCount (tuỳ chọn: số trên nút hạng mục, mặc định = count),
          hideCols (tuỳ chọn: ẩn nút Cột hiển thị / bộ cột, như đề mục 3.1 của bản gốc), nodeLabel ("3.2.6.1.Thiết bị đèn"), onOpenTree(ev), treeOpen, treeAddTitle, sheetChips (node),
          subtotal, vat, onVat(v) (ghi khi rời ô / Enter như onchange của bản gốc), view, onView, catalogOpen, onToggleCatalog,
          colsShown, colsTotal, colsOpen, onOpenCols, presetLabel, onOpenPreset(ev), presetOpen */
export default function SheetHeader({
  count, treeCount, hideCols, nodeLabel, onOpenTree, treeOpen, sheetChips, subtotal, vat, onVat, view, onView, catalogOpen, onToggleCatalog,
  colsShown, colsTotal, colsOpen, onOpenCols, presetLabel, onOpenPreset, presetOpen,
}) {
  /* Gập dải tổng tiền: nhớ theo máy ở qs_fold.totals, chung với băng dự án (blkFold_ PUB/app.js:1557, boc.js:1215-1232) */
  const collapsed = useFold('totals')
  const [vatDraft, setVatDraft] = useState(String(vat))
  useEffect(() => { setVatDraft(String(vat)) }, [vat])
  const vatAmount = Math.round(subtotal * (Number(vat) || 0) / 100)
  const preset = `${colsShown}/${colsTotal}`
  const commitVat = () => { if (String(Number(vatDraft) || 0) !== String(Number(vat) || 0)) onVat(vatDraft); else setVatDraft(String(vat)) }
  const colTools = (
    <>
      {!hideCols && <button className={`qs-bd-cols-label${colsOpen ? ' on' : ''}`} title="Ẩn / hiện các chip cột" onClick={onOpenCols}>Cột hiển thị <span>{preset}</span><Icon name="chevronDown" size={16} /></button>}
      {!hideCols && <button className={`qs-bd-preset${presetOpen ? ' on' : ''}`} title="Bật cả một bộ cột theo mục đích / bộ cột của tôi" onClick={onOpenPreset}><Icon name="sliders" size={13} />{presetLabel} {preset}<Caret /></button>}
      <button className="qs-bd-round-btn" title={collapsed ? 'Mở rộng' : 'Thu gọn'} onClick={() => foldToggle_('totals')}><Icon name={collapsed ? 'chevronDown' : 'chevronUp'} size={14} /></button>
    </>
  )
  return (
    <div className={`qs-card qs-bd-head${collapsed ? ' collapsed' : ''}`}>
      <div className="qs-bd-head-row">
        <button className="qs-bd-icon-btn" title={catalogOpen ? 'Ẩn cột hạng mục' : 'Hiện cột hạng mục'} onClick={onToggleCatalog}><Icon name="panelLeft" size={17} /></button>
        <span className="qs-bd-h">Hạng mục đã bóc</span>
        <span className="qs-bd-count">[{pad2(count)}]</span>
        <button className={`qs-bd-category${treeOpen ? ' on' : ''}`} title="Chọn hạng mục" onClick={onOpenTree}>
          <b>{nodeLabel}</b>
          <span className="qs-bd-count">[{pad2(treeCount == null ? count : treeCount)}]</span>
          <span style={{ flex: 1 }} />
          <span className="qs-bd-acc-plus"><Icon name="plus" size={10} stroke={3} /></span>
        </button>
        {sheetChips}
        <span style={{ flex: 1 }} />
        <div className="qs-bd-seg" title="Chọn kiểu bảng — máy sẽ nhớ">
          <button className={view === 'sheet' ? 'on' : ''} onClick={() => onView('sheet')}><Icon name="table" size={15} />Bảng tính</button>
          <button className={view === 'plain' ? 'on' : ''} onClick={() => onView('plain')}><Icon name="listLines" size={15} />Bảng thường</button>
        </div>
        {collapsed ? <div className="qs-bd-head-cols">{colTools}</div> : (
          <div className="qs-bd-totals">
            <span className="qs-bd-muted">Chưa VAT</span><b>{dong(subtotal)}</b>
            <span className="qs-bd-vsep" />
            <span className="qs-bd-muted">VAT</span>
            <input className="qs-bd-vat" type="number" step="any" min="0" title="Thuế VAT (%)" value={vatDraft}
              onChange={e => setVatDraft(e.target.value)} onBlur={commitVat} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
            <span className="qs-bd-muted">%</span><b>{dong(vatAmount)}</b>
            <span className="qs-bd-vsep" />
            <span className="qs-bd-total-label">Tổng</span><b className="qs-bd-total">{dong(subtotal + vatAmount)}</b>
          </div>
        )}
      </div>
      {!collapsed && <div className="qs-bd-head-row second">{colTools}</div>}
    </div>
  )
}
