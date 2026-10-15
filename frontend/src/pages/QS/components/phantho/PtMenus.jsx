import { useRef, useState } from 'react'
import QsIcon from '../common/QsIcon'
import { MrootPortal } from '../common/Mroot'
import Pop from '../breakdown/sheet/Pop'
import '../breakdown/sheet/sheet.css'
import { money, ptN } from '../../lib/format.js'
import { ptSecTotals } from '../../lib/phantho.js'
import { qsToast as toast } from '../common/dialogs'
import { PT_BULK_F, PT_CELL_F, PT_NUM_K, ptCellVal_, ptKeyLabel_ } from './ptModel'
import { setPtUi, ptUi } from './ptState'
import * as A from './ptActions'
import './phantho.css'

/* Popup của bảng Phần thô, dùng chung khung Pop + lớp menu của bảng Bóc tách để cùng một kiểu:
   PtFilterPop  - lọc theo cột (ptOpenFilter / ptSetFilter / ptClearFilter, PUB/phantho.js:1316-1344)
   PtCtxMenu    - chuột phải Bảng thường (ptCtx 1548-1617 + ptCopyCell_ / ptCopyRow_ / ptPasteCell_ / ptClearCell_ / ptSumCol_ / ptCfToggle_ 1495-1539)
   PtSheetMenu  - chuột phải Bảng tính (btMenuChung_('pt') bangtinh.js:769-787)
   PtBulkBar    - thanh thao tác các dòng đã chọn + Sửa hàng loạt (ptSelBar_ / ptBulkEditPop_ / ptBulkEditRun_ 1412-1475) */

const Sec = ({ t }) => <div className="qs-tk-cmh">{t}</div>
const Sep = () => <div className="qs-tk-cmsep" />
function Mi({ ic, label, fn, hint, danger, onClose }) {
  return (
    <div className={`qs-tk-cmi${danger ? ' danger' : ''}`} onClick={() => { onClose(); fn() }}>
      <QsIcon name={ic} size={14} /><span>{label}</span>{hint && <i className="qs-tk-cmik">{hint}</i>}
    </div>
  )
}
const copyText = t => A.ctxCopy_(t)

export function PtFilterPop({ anchor, colKey, phanTho, onClose }) {
  const flt = ptUi().filter || {}
  const vals = {}; let tong = 0
  ;(phanTho || []).forEach(sec => { ptSecTotals(sec); sec.items.forEach(it => { const v = ptCellVal_(sec, it, colKey).trim(); tong++; if (v) vals[v] = (vals[v] || 0) + 1 }) })
  const ds = Object.keys(vals).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))
  const cur = flt[colKey]
  const set = v => { onClose(); setPtUi(s => { const f = { ...(s.filter || {}) }; if (v == null) delete f[colKey]; else f[colKey] = v; return { filter: f } }) }
  return (
    <Pop anchor={anchor} width={250} className="qs-tk-flt" onClose={onClose}>
      <div className="qs-tk-fhdr">Lọc: {ptKeyLabel_(colKey)}</div>
      <div className="qs-tk-fitems">
        <div className={`qs-tk-fi${cur == null ? ' on' : ''}`} onClick={() => set(null)}>Tất cả <span className="qs-tk-fcnt">{tong}</span></div>
        {ds.length ? ds.map(v => <div key={v} className={`qs-tk-fi${cur === v ? ' on' : ''}`} onClick={() => set(v)}>{v} <span className="qs-tk-fcnt">{vals[v]}</span></div>)
          : <div className="qs-tk-fi all">Cột này chưa có dữ liệu</div>}
      </div>
      {Object.keys(flt).length > 0 && <><div className="qs-tk-fpsep" /><div className="qs-tk-fpa" onClick={() => { onClose(); setPtUi({ filter: {} }) }}>✕ Bỏ mọi bộ lọc cột</div></>}
    </Pop>
  )
}

/* cell = {si, ii, key, lbl, text} khi bấm vào ô; row = {si, ii}; secSi = hạng mục (dòng tên / dòng "＋ Thêm dòng"); colKey = cột (tiêu đề hoặc ô);
   act = {freezeTo(key), freezeRowTo(si, ii), rename(si), find(), exportXlsx()} do bảng truyền vào */
export function PtCtxMenu({ at, cell, row, secSi, colKey, phanTho, act, onClose }) {
  const st = ptUi()
  const cf = st.cf || {}
  const P = { onClose }
  const sumCol = k => {
    let tong = 0, n = 0
    ;(phanTho || []).forEach(sec => { ptSecTotals(sec); (sec.items || []).forEach(it => {
      let v
      if (k === 'ttnt') v = it._ttnt; else if (k === 'tt') v = it._tt
      else if (k === 'lnvnd') v = (ptN(it._tt) - ptN(it._ttnt))
      else v = ptCellVal_(sec, it, k)
      v = ptN(v); if (v) { tong += v; n++ }
    }) })
    toast('Tổng cột "' + ptKeyLabel_(k) + '" (' + n + ' dòng có số): ' + money(tong))
  }
  const paste = async () => {
    const f = PT_CELL_F[cell.key]
    if (!f) { toast('Cột "' + cell.lbl + '" là cột tự tính — không dán vào được'); return }
    let txt = ''
    try { txt = await navigator.clipboard.readText() } catch (e) { toast('Trình duyệt chặn đọc clipboard — bấm vào ô rồi nhấn Ctrl+V'); return }
    if (!txt) return
    A.ptEdit(cell.si, cell.ii, f, String(txt).split('\t')[0].split('\n')[0].trim()); toast('Đã dán vào ô')
  }
  const clearCell = () => {
    const f = PT_CELL_F[cell.key]
    if (!f) { toast('Cột "' + cell.lbl + '" là cột tự tính — không có nội dung để xoá'); return }
    A.ptEdit(cell.si, cell.ii, f, ''); toast('Đã xoá nội dung ô')
  }
  const copyRow = () => {
    const tr = document.querySelector('.qspt-t tr.qspt-row[data-si="' + cell.si + '"][data-ii="' + cell.ii + '"]'); if (!tr) return
    const n = tr.children.length - 1, vals = []
    Array.prototype.slice.call(tr.children, 0, n).forEach(td => { const i = td.querySelector('input,textarea'); vals.push(i ? String(i.value || '') : String(td.textContent || '').trim()) })
    copyText(vals.join('\t')); toast('Đã sao chép cả dòng — dán được thẳng vào Excel')
  }
  const cfToggle = rule => {
    const r = { ...(ptUi().cf || {}) }; if (r[rule]) delete r[rule]; else r[rule] = 1
    try { localStorage.setItem('qs_ptcf', JSON.stringify(r)) } catch (e) { /* bỏ qua */ }
    setPtUi({ cf: r }); onClose()
  }
  const selKey = row ? row.si + '|' + row.ii : ''
  const secName = secSi >= 0 ? String(((phanTho || [])[secSi] || {}).t || '').split('\n')[0] : ''
  const Ck = ({ rule, cls, label }) => (
    <div className={`qs-tk-cmi qs-tk-cmck${cf[rule] ? ' on' : ''}`} onClick={() => cfToggle(rule)}>
      <span className="bx">{cf[rule] ? '✓' : ''}</span><span className={'qs-tk-cfdot ' + cls} /><span>{label}</span>
    </div>
  )
  return (
    <Pop anchor={at} width={270} className="qs-tk-ctx" onClose={onClose}>
      {cell && (
        <>
          <Sec t="Ô đang chọn" />
          <Mi {...P} ic="copy" label="Sao chép ô" hint="Ctrl+C" fn={() => { copyText(String(cell.text || '')); toast('Đã sao chép: ' + String(cell.text || '').slice(0, 40)) }} />
          <Mi {...P} ic="copy" label="Sao chép cả dòng" fn={copyRow} />
          <Mi {...P} ic="edit" label="Dán vào ô" hint="Ctrl+V" fn={paste} />
          <Mi {...P} ic="trash" label="Xoá nội dung ô" hint="Del" fn={clearCell} />
          <Sep />
        </>
      )}
      {row && (
        <>
          <Sec t="Dòng" />
          <Mi {...P} ic="check" label="Chọn dòng này" fn={() => setPtUi(s => { const o = { ...(s.sel || {}) }; if (o[selKey]) delete o[selKey]; else o[selKey] = 1; return { sel: o, anchor: selKey } })} />
          <Mi {...P} ic="list" label="Chọn tất cả dòng đang hiện" fn={() => {
            const o = { ...(ptUi().sel || {}) }
            document.querySelectorAll('.qspt-t tr.qspt-row').forEach(tr => { o[tr.getAttribute('data-si') + '|' + tr.getAttribute('data-ii')] = 1 })
            setPtUi({ sel: o })
          }} />
          <Mi {...P} ic="copy" label="Nhân bản dòng" fn={() => A.ptDupItem(row.si, row.ii)} />
          <Mi {...P} ic="plus" label="Chèn dòng trống bên dưới" fn={() => A.ptInsertItem(row.si, row.ii)} />
          <Mi {...P} ic="trash" label="Xoá dòng này" danger fn={() => A.ptDelItem(row.si, row.ii)} />
          <Sep />
        </>
      )}
      {secSi >= 0 && (
        <>
          <Sec t={'Hạng mục: ' + secName} />
          <Mi {...P} ic="edit" label="Đổi tên hạng mục" fn={() => act.rename(secSi)} />
          <Mi {...P} ic="plus" label="Thêm dòng vào hạng mục" fn={() => A.ptAddItem(secSi)} />
          <Mi {...P} ic="trash" label="Xoá cả hạng mục" danger fn={() => A.ptDelSection(secSi)} />
          <Sep />
        </>
      )}
      {colKey && (
        <>
          <Sec t={'Cột: ' + ptKeyLabel_(colKey)} />
          <Mi {...P} ic="up" label="Sắp xếp tăng dần" fn={() => setPtUi({ sort: colKey, sortDir: 'asc' })} />
          <Mi {...P} ic="down" label="Sắp xếp giảm dần" fn={() => setPtUi({ sort: colKey, sortDir: 'desc' })} />
          {st.sort && <Mi {...P} ic="close" label="Bỏ sắp xếp" fn={() => setPtUi({ sort: '', sortDir: 'asc' })} />}
          {cell && PT_CELL_F[colKey] && <Mi {...P} ic="down" label="Điền giá trị ô này xuống cả cột" fn={() => A.ptFillDown(cell)} />}
          {PT_NUM_K[colKey] && <Mi {...P} ic="gauge" label="Tính tổng cột" fn={() => sumCol(colKey)} />}
          <Mi {...P} ic="lock" label="Cố định đến cột này" fn={() => act.freezeTo(colKey)} />
          {(st.freeze || 0) > 0 && <Mi {...P} ic="close" label="Bỏ cố định cột" fn={() => setPtUi({ freeze: 0 })} />}
          {row && <Mi {...P} ic="lock" label="Cố định đến hàng này" fn={() => act.freezeRowTo(row.si, row.ii)} />}
          {(st.frzRows || 0) > 0 && <Mi {...P} ic="close" label="Bỏ cố định hàng" fn={() => { setPtUi({ frzRows: 0 }); toast('Đã bỏ cố định hàng') }} />}
          <Mi {...P} ic="eye" label="Ẩn cột này" fn={() => setPtUi(s => ({ cols: { ...s.cols, [colKey]: !s.cols[colKey] } }))} />
          <Mi {...P} ic="list" label="Hiện lại tất cả cột" fn={() => setPtUi(s => { const o = {}; Object.keys(s.cols).forEach(k => { o[k] = true }); return { cols: o } })} />
          <Sep />
        </>
      )}
      <Sec t="Tô màu điều kiện" />
      <Ck rule="ln0" cls="cf-red" label="Lợi nhuận < 0" />
      <Ck rule="noPrice" cls="cf-yellow" label="Chưa có đơn giá" />
      <Ck rule="kl0" cls="cf-grey" label="Khối lượng = 0" />
      <Sep />
      <Sec t="Bảng" />
      <Mi {...P} ic="search" label="Tìm & thay thế" hint="Ctrl+F" fn={act.find} />
      <Mi {...P} ic="download" label="Xuất bảng ra Excel" fn={act.exportXlsx} />
      <Mi {...P} ic="plus" label="Thêm hạng mục" fn={A.ptAddSection} />
      {Object.keys(st.filter || {}).length > 0 && <Mi {...P} ic="close" label="Bỏ mọi bộ lọc cột" fn={() => setPtUi({ filter: {} })} />}
      <Mi {...P} ic="trash" label="Xoá hết bảng" danger fn={A.ptReset} />
    </Pop>
  )
}

/* Bảng tính: m = {k:'it'|'sec', si, ii}, key = cột (khoá PT_COLS) */
export function PtSheetMenu({ at, m, colKey, act, onClose }) {
  const st = ptUi()
  const P = { onClose }
  return (
    <Pop anchor={at} width={260} className="qs-tk-ctx" onClose={onClose}>
      {m && m.k === 'it' && (
        <>
          <Sec t="Dòng" />
          <Mi {...P} ic="plus" label="Chèn dòng trống bên dưới" fn={act.insert} />
          <Mi {...P} ic="copy" label="Nhân bản dòng" fn={act.dup} />
          <Mi {...P} ic="trash" label="Xoá các dòng đang chọn" danger fn={act.del} />
          <Sep />
        </>
      )}
      {m && m.k === 'sec' && (
        <>
          <Sec t="Nhóm" />
          <Mi {...P} ic="plus" label="Thêm dòng vào nhóm này" fn={() => A.ptAddItem(m.si)} />
          <Sep />
        </>
      )}
      {colKey && colKey !== 'stt' && (
        <>
          <Sec t={'Cột: ' + ptKeyLabel_(colKey)} />
          <Mi {...P} ic="up" label="Sắp xếp tăng dần" fn={() => act.sort(colKey, 'asc')} />
          <Mi {...P} ic="down" label="Sắp xếp giảm dần" fn={() => act.sort(colKey, 'desc')} />
          {st.sort && <Mi {...P} ic="close" label="Bỏ sắp xếp" fn={() => setPtUi({ sort: '', sortDir: 'asc' })} />}
          <Mi {...P} ic="down" label="Điền xuống (Ctrl+D)" fn={act.fill} />
          {colKey !== 'noidung' && <Mi {...P} ic="eye" label="Ẩn cột này" fn={() => setPtUi(s => ({ cols: { ...s.cols, [colKey]: !s.cols[colKey] } }))} />}
          <Sep />
        </>
      )}
      <Mi {...P} ic="copy" label="Sao chép" hint="Ctrl+C" fn={act.copy} />
      <Mi {...P} ic="search" label="Tìm & thay thế" hint="Ctrl+F" fn={act.find} />
    </Pop>
  )
}

/* Thanh các dòng đã chọn (Bảng thường). sel = ['si|ii'] */
export function PtBulkBar({ sel, phanTho, onAll }) {
  const [pop, setPop] = useState(false)
  const [field, setField] = useState(PT_BULK_F[0][0])
  const [val, setVal] = useState('')
  const ref = useRef(null)
  const n = sel.length
  let tien = 0
  sel.forEach(k => { const a = k.split('|'), sec = (phanTho || [])[+a[0]]; const it = sec && sec.items && sec.items[+a[1]]; if (it) tien += ptN(it._tt) })
  const list = () => sel.map(k => { const a = k.split('|'); return { si: +a[0], ii: +a[1] } })
  function run() {
    const nhan = (PT_BULK_F.filter(f => f[0] === field)[0] || [field, field])[1]
    if (String(val).trim() === '' && field !== 'ghichu') { toast('Chưa nhập giá trị mới'); return }
    setPop(false)
    A.ptBulkEditRun(list(), field, val, nhan)
  }
  return (
    <MrootPortal>
      <div className="qs-tk-bbar qspt-bbar">
        <div className="qs-tk-bbcount"><b>{n}</b><span>dòng đã chọn · {money(tien)} đ</span>
          <button className="qs-tk-bbx" title="Bỏ chọn" onClick={() => setPtUi({ sel: {}, anchor: null })}>✕</button></div>
        <div className="qs-tk-bbsep" />
        <button className="qs-tk-bbb" title="Chọn tất cả dòng đang hiện" onClick={onAll}><QsIcon name="list" size={15} /> Chọn tất cả</button>
        <button ref={ref} className="qs-tk-bbb" title="Đổi một cột cho mọi dòng đã chọn" onClick={() => setPop(p => !p)}><QsIcon name="edit" size={15} /> Sửa hàng loạt <i>▾</i></button>
        <button className="qs-tk-bbb" title="Xoá các dòng đã chọn" onClick={async () => { if (await A.ptDelMany(list())) setPtUi({ sel: {}, anchor: null }) }}><QsIcon name="trash" size={15} /> Xoá dòng</button>
      </div>
      {pop && (
        <Pop anchor={ref.current} place="above" width={280} onClose={() => setPop(false)} keepOpenOn=".qspt-bbar">
          <div className="qs-tk-bph">Sửa hàng loạt <span>{n} dòng</span></div>
          <div className="qs-tk-bpb">
            <label>Cột cần đổi</label>
            <select value={field} onChange={e => setField(e.target.value)}>{PT_BULK_F.map(f => <option key={f[0]} value={f[0]}>{f[1]}</option>)}</select>
            <label>Giá trị mới</label>
            <input autoFocus placeholder="Nhập giá trị…" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') run() }} />
          </div>
          <div className="qs-tk-bpf">
            <button className="qspt-btn ghost sm" onClick={() => setPop(false)}>Huỷ</button>
            <button className="qspt-btn blue sm" onClick={run}><QsIcon name="check" size={14} /> Áp dụng</button>
          </div>
        </Pop>
      )}
    </MrootPortal>
  )
}
