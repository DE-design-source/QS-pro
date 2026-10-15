import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { useQs } from '../state/QsData'
import { useLinesSheet } from '../state/useLinesSheet'
import { histOf, setHist, setState, isTmp, DEFAULT_NODE } from '../state/store'
import { useTicks, tickClick_, tickSet_, tickClear_ } from '../state/tickSel'
import CatalogPanel from './breakdown/CatalogPanel'
import SheetHeader from './breakdown/SheetHeader'
import ProductInfo from './breakdown/ProductInfo'
import SheetBody from './breakdown/SheetBody'
import PhanThoPanel, { usePtTotals } from './phantho/PhanThoPanel'
import { PtFilters, PtLibrary, usePtLibCount } from './phantho/PtLibrary'
import PtDetail from './phantho/PtDetail'
import ProductThumb from './common/ProductThumb'
import ImgViewer from './common/ImgViewer'
import DocsPopover from './common/DocsPopover'
import { mediaUrl } from '../api/files'
import { COLS, PHONG_LIST, colPlain, cellSortVal_, tkSheetCo_, tkSheetOf_, TK_SHEETS } from '../lib/columns.js'
import { tkFieldsFor_, ttBan_, lnVnd_ } from '../lib/calc.js'
import { TREE, nodeName, customGroups } from '../lib/tree.js'
import { money } from '../lib/format.js'
import { lineDocs_ } from '../lib/productFields.js'
import { lnDiff_, lnDiffTip_, spOfLine_, giaLechList_ } from '../lib/bocSync.js'
import { CHUA_PHAN_TANG, floorsList } from '../lib/sheetModel.js'
import {
  ROW_NUM_WIDTH, colLetter, tkColumns, lineText, lineApply, lineNumber, tkFlatten, tkEntryText, tkSheetSua_, TK_SO, TK_PRICE_KEYS, tkXlsxBody,
} from './breakdown/sheet/tkModel'
import { useTkCols, setColsMap, hideCol, showAllCols, moveCol, setColW } from './breakdown/sheet/tkCols'
import { PT_LOAI_NHOM, ptLoaiNgan, ptSheetPick_, mmLoai_, usePtLoai } from './breakdown/sheet/ptLoai'
import * as act from './breakdown/sheet/bocActions'
import TreePopover from './breakdown/sheet/TreePopover'
import { PresetPopover, ColsStrip, presetLabel } from './breakdown/sheet/ColsTools'
import ContextMenu from './breakdown/sheet/ContextMenu'
import ColFilterPop from './breakdown/sheet/ColFilterPop'
import LinePicker from './breakdown/sheet/LinePicker'
import BulkBar from './breakdown/sheet/BulkBar'
import { LineUpdatePop, PriceSyncModal, LnPickPop, RecentPop } from './breakdown/sheet/SyncPops'
import './breakdown/sheet/sheet.css'

/* Bề rộng cột sản phẩm (px bố cục): mặc định và giới hạn khi kéo vạch ngăn */
const CATALOG_DEFAULT = 440
const CATALOG_MIN = 300
const CATALOG_MAX = 760
const INITIAL_SEL = { a: { r: 0, c: 0 }, f: { r: 0, c: 0 } }
const NO_FAVS = new Set()
const TK_DATALISTS = { khuVuc: PHONG_LIST }

function lsGet(k) { try { return localStorage.getItem(k) || '' } catch (e) { return '' } }
function lsSet(k, v) { try { localStorage.setItem(k, v) } catch (e) { /* bỏ qua */ } }
function lsJson(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {} } catch (e) { return {} } }
const img1 = v => mediaUrl(String(v || '').split('\n')[0].trim())
function copyText(t) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return } } catch (e) { /* dự phòng bên dưới */ }
  const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'
  document.body.appendChild(a); a.select(); try { document.execCommand('copy') } catch (x) { /* bỏ qua */ } a.remove()
}
const pad2 = n => (n < 10 ? '0' : '') + n

/* Tab "Bóc tách": cột sản phẩm bên trái + bảng tính bóc tách bên phải.
   Dữ liệu thật: useQs() (dự án, dòng, sản phẩm, đề mục node) + useLinesSheet({node}) (mặt tiền nhóm theo tầng, hoàn tác).
   Port PUB/boc.js (renderTable, addProdObj, tầng, menu chuột phải, tìm & thay, lọc cột, chọn SP cho dòng, thanh hàng loạt,
   dòng lệch danh mục, cập nhật giá, sheet Nhân công / Vật tư), app.js (cây hạng mục, bộ cột, % LN nhanh, VAT), bangtinh.js (btFmt, Excel). */
export default function BreakdownTab() {
  const qs = useQs()
  const { cur, lines, products, node, setNode, setHmNode, mutate, navigate, toast, confirm } = qs
  const visible = qs.panelVisible('boc')
  const isPT = node === '3.1'
  /* Đề mục 3.1: thư viện + bước chọn + panel công tác của Phần thô cắm vào khung Bóc tách; đầu bảng dùng tổng Phần thô
     (renderPTLibrary phantho.js:1226-1295, ptShowDetail_ 1908-1932, ptTotalsBar_ 2331-2338, tkCount 2287) */
  const ptCount = usePtLibCount()
  const ptTot = usePtTotals()
  const facade = useLinesSheet({ node })
  const { groups } = facade
  const colState = useTkCols()

  const [view, setViewState] = useState(() => (lsGet('qs_bt_mode') === 'cu' ? 'plain' : 'sheet'))
  const [sheetSel, setSheetSel] = useState(() => lsGet('qs_sheet'))
  const [targetId, setTargetId] = useState('')
  const [catalogOpen, setCatalogOpen] = useState(true)
  const [panel, setPanel] = useState(null)
  const [full, setFull] = useState(false)
  const [catalogW, setCatalogW] = useState(CATALOG_DEFAULT)
  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef(null)
  const [dragProduct, setDragProduct] = useState(null)
  const dragSl = useRef(null)
  const [drop, setDrop] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailSl, setDetailSl] = useState(null)
  const [flash, setFlash] = useState(null)
  const [sort, setSort] = useState({ key: '', dir: 'asc' })
  const [colFilter, setColFilter] = useState({})
  const [cfRules, setCfRules] = useState({})
  const [freezeN, setFreezeN] = useState(0)
  const [frzRows, setFrzRows] = useState(0)
  const [rowH, setRowH] = useState(() => lsJson('qs_rowh'))
  /* Dòng đã chọn cho thanh hàng loạt (S._tkSel, dùng chung với Chi phí / Dự án qua state/tickSel):
     Bảng thường = ô đánh dấu đầu dòng; Bảng tính = chọn cả dòng (bấm số dòng) */
  const rowSel = useTicks(cur ? cur.maDA : null)
  const sheetTick = useRef(false)
  const [adderKey, setAdderKey] = useState(0)
  const [pop, setPop] = useState(null)   // {kind, anchor, ...}
  const [imgView, setImgView] = useState('')
  const sheetApi = useRef(null)

  const ptLoai = usePtLoai()
  const sheetCo = tkSheetCo_(node) && !isPT
  const sheetF = sheetCo ? sheetSel : ''
  const plain = view === 'plain'

  /* ---- Dòng đang bóc (bocLines_: đúng đề mục, sheet, lọc cột) ---- */
  const nodeLines = useMemo(() => lines.filter(l => l.nhom === node || String(l.nhom || '').indexOf(node + '.') === 0), [lines, node])
  const sheetLines = useMemo(() => (sheetF ? nodeLines.filter(l => tkSheetOf_(l) === sheetF) : nodeLines), [nodeLines, sheetF])
  const colFilterKeys = Object.keys(colFilter)
  const basePred = useMemo(() => {
    if (!sheetF && !colFilterKeys.length) return null
    return l => (!sheetF || tkSheetOf_(l) === sheetF) && colFilterKeys.every(k => colPlain(l, k) === colFilter[k])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetF, colFilter])
  const shownLines = useMemo(() => (basePred ? nodeLines.filter(l => basePred(l)) : nodeLines), [nodeLines, basePred])
  const subtotal = shownLines.reduce((s, l) => s + ttBan_(l), 0)

  /* ---- Tầng đang chọn để thêm (S.selFloor) ---- */
  const target = groups.find(g => g.id === targetId) || groups[0] || null
  const targetFloor = target && target.id !== CHUA_PHAN_TANG ? target.id : ''
  const floorNames = groups.map(g => g.id).filter(g => g !== CHUA_PHAN_TANG)
  /* Công bố tầng đang chọn cho tab khác (Danh sách SP thêm vào đúng tầng như S.selFloor, boc.js:294) */
  useEffect(() => { setState({ selFloor: target ? targetFloor : null }) }, [target ? target.id : null, targetFloor]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Cột: 27 cột theo thứ tự đã lưu, cột ẩn theo bộ cột của tài khoản ---- */
  const allOn = useMemo(() => { const m = {}; COLS.forEach(c => { m[c[0]] = true }); return m }, [])
  const columns = useMemo(() => {
    const vis = tkColumns(colState.order, colState.cols, node, colState.w, freezeN, 1100)
    const pin = {}; vis.forEach(c => { pin[c.key] = c.pin })
    return tkColumns(colState.order, allOn, node, colState.w, 0, 1100).map(c => ({ ...c, pin: !!pin[c.key] }))
  }, [colState, node, freezeN, allOn])
  const hiddenCols = useMemo(() => new Set(COLS.map(c => c[0]).filter(k => !colState.cols[k])), [colState.cols])
  const visibleCols = columns.filter(c => !hiddenCols.has(c.key))
  const onHiddenCols = useCallback(set => {
    const m = {}; COLS.forEach(c => { m[c[0]] = !set.has(c[0]) }); m.ten = true
    setColsMap(m)
  }, [])

  /* ---- Cách đọc / ghi ô của dòng Line ---- */
  const adapter = useMemo(() => ({
    rowId: r => r.lineId,
    cellText: (r, k, stt) => lineText(r, k, stt),
    editText: (r, k) => lineText(r, k, ''),
    applyEdit: lineApply,
    cellNumber: lineNumber,
    entryText: tkEntryText,
    colLetter,
    editable: tkSheetSua_,
    isNumeric: k => !!TK_SO[k],
    isFav: r => { const p = spOfLine_(r, products); return !!(p && p.yeuThich) },
    priceKeys: TK_PRICE_KEYS,
    rowNumWidth: ROW_NUM_WIDTH,
  }), [products])
  const flatten = useCallback((gs, pred) => tkFlatten(gs, pred, sort), [sort])
  const dispFlat = useMemo(() => tkFlatten(groups, basePred, sort), [groups, basePred, sort])
  const dispItems = dispFlat.filter(e => e.type === 'item')

  /* ---- Thêm sản phẩm / dòng ---- */
  const flashTo = useCallback((rowId, mark = true) => setFlash(f => ({ rowId, text: null, mark, n: (f ? f.n : 0) + 1 })), [])
  const expandFloor = useCallback(fid => facade.patch(gs => (gs.some(g => g.id === fid && g.collapsed) ? gs.map(g => (g.id === fid ? { ...g, collapsed: false } : g)) : gs)), [facade])
  async function addProduct(product, opts = {}) {
    if (!product) return
    const floor = opts.tang != null ? opts.tang : targetFloor
    expandFloor(floor || CHUA_PHAN_TANG)
    let tmp = null
    const r = await act.addProdObj(product, {
      floor, sl: opts.sl, node, sheet: sheetF,
      onTemp: id => { tmp = id; flashTo(id) },
    })
    if (r) { if (floor) setTargetId(floor); if (r.lineId !== tmp) flashTo(r.lineId) }
  }
  async function addBlank() {
    const l = await act.addItemToFloor(targetFloor, node, sheetF)
    if (l) flashTo(l.lineId, false)
  }
  async function addGroup(name) {
    const nm = await act.addFloorName(name)
    if (nm) setTargetId(nm)
  }

  /* ---- Kéo vạch ngăn cột sản phẩm ---- */
  function startResize(e) {
    const el = e.currentTarget.previousElementSibling
    const w = el.offsetWidth
    resizeRef.current = { x: e.clientX, w, scale: el.getBoundingClientRect().width / w || 1 }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    setResizing(true)
  }
  function moveResize(e) {
    const d = resizeRef.current
    if (!d) return
    if (e.buttons === 0) { endResize(); return }
    setCatalogW(Math.max(CATALOG_MIN, Math.min(CATALOG_MAX, Math.round(d.w + (e.clientX - d.x) / d.scale))))
  }
  function endResize() { resizeRef.current = null; setResizing(false) }

  /* ---- Kéo sản phẩm từ cột trái thả vào bảng: thả lên 1 dòng -> vào tầng của dòng đó; lên dòng tầng -> tầng đó;
     chỗ khác -> tầng đang chọn. Dòng mới vào cuối tầng như bản gốc (tkSheetNhanTha_ bangtinh.js:625-642, boc.js:625-631) ---- */
  const dropGroup = (drop && groups.find(g => g.id === drop.groupId)) || target
  const dropMark = !dragProduct ? null
    : drop ? { key: drop.rowId || `g:${drop.groupId}`, pos: 'after' }
      : target ? { key: target.rows.length && !target.collapsed ? target.rows[target.rows.length - 1].lineId : `g:${target.id}`, pos: 'after' } : null
  const isProdDrag = e => !!dragProduct || (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('text/plain') >= 0)
  function onDragOver(e) {
    if (!isProdDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const tr = e.target.closest ? e.target.closest('tr[data-group]') : null
    let next = null
    if (tr) next = { groupId: tr.dataset.group, rowId: tr.dataset.row || null }
    const same = (!next && !drop) || (next && drop && next.groupId === drop.groupId && next.rowId === drop.rowId)
    if (!same) setDrop(next)
  }
  function onDrop(e) {
    if (!isProdDrag(e)) return
    e.preventDefault()
    let p = dragProduct
    if (!p) {
      let t = ''
      try { t = e.dataTransfer.getData('text/plain') } catch (x) { t = '' }
      if (!t || t.indexOf('qs-row:') === 0) { endDragProduct(); return }
      p = products.filter(x => String(x.recordId) === t || String(x.ma) === t)[0]
    }
    const g = dropGroup
    const floor = g ? (g.id === CHUA_PHAN_TANG ? '' : g.id) : targetFloor
    const sl = dragProduct ? dragSl.current : null
    endDragProduct()
    if (p) addProduct(p, { tang: floor, sl: sl || undefined })
  }
  /* sl: số lượng đi kèm khi kéo SP con của combo từ panel chi tiết (comboSL) */
  function onDragProduct(product, sl) { dragSl.current = sl || null; setDragProduct(product) }
  function endDragProduct() { dragSl.current = null; setDragProduct(null); setDrop(null) }

  /* ---- Kéo đổi chỗ dòng / tầng (tkMoveLine_ qua mặt tiền -> hoàn tác được; moveFloor) ---- */
  const rowDrag = useMemo(() => ({
    canGroup: g => g.id !== CHUA_PHAN_TANG,
    onDrop: (src, dst, before) => {
      if (sort.key) { toast('Đang sắp xếp theo cột — bỏ sắp xếp (chuột phải → Bỏ sắp xếp) rồi kéo'); return }
      if (src.kind === 'group') {
        const fl = floorsList(cur, lines)
        const den = dst.kind === 'group' ? dst.id : ((lines.filter(l => l.lineId === dst.id)[0] || {}).tang || '')
        if (!den || den === src.id) return
        if (fl.indexOf(den) < 0 || den === CHUA_PHAN_TANG) { toast('Thả lên một tầng / phòng khác để đổi thứ tự'); return }
        act.moveFloor(src.id, den, fl.indexOf(src.id) < fl.indexOf(den))
        return
      }
      if (dst.kind === 'item' && dst.id === src.id) return
      /* Gọi thẳng tkMoveLine_ (btDoiHang_ bangtinh.js:518-523) để vị trí trong CẢ dự án đúng bản gốc: qua mặt tiền thì
         "thả sau X" bị đổi thành "trước dòng kế cùng hạng mục", lệch khi giữa hai dòng có dòng của hạng mục khác.
         Bước đổi chỗ vẫn ghi vào lịch sử để hoàn tác được (D12). */
      const t = dst.kind === 'item' ? lines.filter(l => l.lineId === dst.id)[0] : null
      const run = dst.kind === 'group' ? mutate.moveLine(src.id, dst.id, null, false) : mutate.moveLine(src.id, (t && t.tang) || '', dst.id, before)
      if (dst.kind === 'group') expandFloor(dst.id)
      Promise.resolve(run).then(moves => {
        if (!cur || !moves || !moves.length) return
        const h = histOf(cur.maDA)
        setHist(cur.maDA, { past: [...h.past, { label: 'Di chuyển dòng', patches: [], moves }], future: [] })
      })
    },
  }), [sort.key, cur, lines, mutate, toast, expandFloor])

  function onRowHeight(id, h, done) {
    setRowH(m => {
      const n = { ...m, [id]: h }
      if (done) lsSet('qs_rowh', JSON.stringify(n))
      return n
    })
  }

  /* ---- Ô vẽ riêng: ảnh, tài liệu, chip lệch danh mục, nút chọn SP, % LN nhanh, tên tầng ---- */
  const renderCell = (e, c, info) => {
    if (e.type === 'group') {
      if (c.key !== 'khuVuc' && c.key !== 'ten') return undefined
      if (info.live != null) return info.live
      const nameCol = visibleCols.findIndex(x => x.key === 'khuVuc') >= 0 ? 'khuVuc' : 'ten'
      if (c.key !== nameCol) return undefined
      const on = target && target.id === e.g.id
      return (
        <>
          {e.g.name}{e.g.collapsed ? '  ·  ' + e.count + ' dòng (đang thu gọn)' : ''}
          {plain && <span className={`qs-tk-gsel${on ? ' on' : ''}`} onMouseDown={ev => { ev.stopPropagation(); setTargetId(e.g.id) }}>{on ? '✓ đang thêm' : 'chọn'}</span>}
        </>
      )
    }
    if (e.type !== 'item') return undefined
    const l = e.r
    /* Bảng thường: ô chọn dòng + tay kéo + số gi.ri (boc.js:540-543) */
    if (c.key === 'stt' && plain) {
      return (
        <span className="qs-tk-sttcell">
          <input type="checkbox" className="qs-tk-ck" checked={selSet.has(l.lineId)} title="Chọn dòng (giữ Shift để chọn cả vùng)"
            onMouseDown={ev => ev.stopPropagation()} onChange={() => {}} onClick={ev => selClick(ev, l.lineId)} />
          <span className="qs-tk-grip">⠿</span><span className="qs-tk-sttn">{e.stt}</span>
        </span>
      )
    }
    if (c.key === 'hinhAnh') {
      if (!l.hinhAnh) return ''
      const src = img1(l.hinhAnh)
      return <ProductThumb product={l} size={plain ? 72 : 44} src={src} onClick={() => setImgView(src)} title="Bấm để xem ảnh lớn" className="qs-tk-img" />
    }
    if (c.key === 'taiLieu') {
      const dl = lineDocs_(l, products)
      if (!dl.length) return plain ? <span className="qs-tk-tlnone" title="Sản phẩm chưa có tài liệu">—</span> : ''
      return (
        <button className="qs-tk-tlbadge" title={'Xem ' + dl.length + ' tài liệu'} onMouseDown={ev => ev.stopPropagation()}
          onClick={ev => setPop({ kind: 'docs', anchor: ev.currentTarget, line: l, docs: dl })}>
          <Icon name="fileText" size={13} /> {dl.length}
        </button>
      )
    }
    /* Chip ⟳ và nút ⌕ chỉ có ở Bảng thường (cellInput app.js:1919-1922); Bảng tính của bản gốc không vẽ chip */
    if (c.key === 'ten') {
      if (!plain) return undefined
      const d = lnDiff_(l, products)
      return (
        <span className="qs-tk-tencell">
          <span className="qs-tk-tentext">{info.live != null ? info.live : (l.ten || '')}</span>
          {d && (
            <button className="qs-tk-lnupd" title={lnDiffTip_(d)} onMouseDown={ev => ev.stopPropagation()}
              onClick={ev => setPop({ kind: 'lnupd', anchor: ev.currentTarget, line: l })}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5h-5" /></svg>
            </button>
          )}
          {plain && (
            <button className="qs-tk-pickb" title="Chọn sản phẩm từ danh mục" onMouseDown={ev => ev.stopPropagation()}
              onClick={ev => setPop({ kind: 'pick', anchor: ev.currentTarget, line: l })}>⌕</button>
          )}
        </span>
      )
    }
    if (c.key === 'lnPct' && plain) {   // nút ▾ chỉ ở Bảng thường như bản gốc
      return (
        <span className="qs-tk-lncell">
          <span>{info.live != null ? info.live : lineText(l, 'lnPct')}</span>
          <button className="qs-tk-lnpickb" title="Chọn nhanh 5 · 10 · 15 · 20 · 30 · 35 · 40 · 45%" onMouseDown={ev => ev.stopPropagation()}
            onClick={ev => setPop({ kind: 'lnpick', anchor: ev.currentTarget, line: l })}>▾</button>
        </span>
      )
    }
    return undefined
  }

  const cfClass = l => {
    const r = cfRules; let s = ''
    if (r.ln0 && lnVnd_(l) < 0) s += ' cf-red'
    if (r.noPrice && !(Number(l.donGiaBan) || 0)) s += ' cf-yellow'
    if (r.sl0 && !(Number(l.soLuong) || 0)) s += ' cf-grey'
    return s
  }
  const rowClass = e => (e.type === 'item' ? cfClass(e.r) + (selSet.has(e.r.lineId) ? ' qs-tk-rowsel' : '') : '')

  /* ---- Chọn dòng cho thanh hàng loạt (tkSelClick_ / tkSelAllVisible_ / tkClearSel / tkSelPrune_ boc.js:914-949) ---- */
  const shownIds = dispItems.map(x => x.r.lineId)
  const selShown = rowSel.filter(id => shownIds.indexOf(id) >= 0)
  const selSet = new Set(selShown)
  function selClick(ev, id) {
    if (!cur) return
    sheetTick.current = false
    tickClick_(ev, cur.maDA, id, shownIds)
  }
  function clearSel() {
    sheetTick.current = false
    tickClear_()
    if (!plain && sheetApi.current) sheetApi.current.clear()
  }
  /* Đổi đề mục / sheet / kiểu bảng NGAY TẠI Bóc tách thì bỏ tick (mmSheet_ / setSheet app.js:1552, boc.js:1742).
     Đề mục đổi từ tab khác (hmNode của Chi phí kéo theo node) không xoá tick đang dùng ở tab đó; đổi dự án: useTicks tự coi là trống. */
  const firstReset = useRef(true)
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return }
    if (visible) { sheetTick.current = false; tickClear_() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, sheetF, view])
  /* Bảng tính: chọn cả dòng = tick các dòng đó; vùng chọn khác chỉ bỏ những tick do chính vùng chọn bảng tính đặt */
  function onSheetSel(ids, info) {
    if (plain || !cur) return
    if (info && info.fullRow && ids.length) { tickClear_(); tickSet_(cur.maDA, ids); sheetTick.current = true } else if (sheetTick.current) { sheetTick.current = false; tickClear_() }
  }
  const barOn = visible && !isPT && selShown.length > 0
  useEffect(() => {
    if (!barOn) return undefined
    const onKey = ev => { if (ev.key === 'Escape') clearSel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  /* Dán / xoá / điền nhiều ô (btLineGhiO_ bangtinh.js:676-690; Bảng thường rngPasteText_ / rngFill_ boc.js:1343-1363):
     ghi theo lô tkApplyEdits_, vẫn ghi 1 bước hoàn tác cho các trường đã đổi (D12) */
  function applyCells(info, cells) {
    const edits = []
    cells.forEach(c => { const l = lineOf(c.id); const f = l && tkFieldsFor_(l, c.key, c.text); if (f) edits.push({ id: c.id, fields: f }) })
    if (!edits.length) {
      if (plain) toast(info.kind === 'paste' ? 'Vùng dán không có ô nào sửa được' : 'Vùng chọn không có ô nào sửa được')
      return
    }
    const by = {}
    edits.forEach(x => { if (!isTmp(x.id)) by[x.id] = { ...(by[x.id] || {}), ...x.fields } })
    const patches = []
    Object.keys(by).forEach(id => {
      const l = lineOf(id)
      Object.keys(by[id]).forEach(f => { if (l && l[f] !== by[id][f]) patches.push({ lineId: id, field: f, old: l[f], new: by[id][f] }) })
    })
    const record = () => {
      if (!cur || !patches.length) return
      const h = histOf(cur.maDA)
      setHist(cur.maDA, { past: [...h.past, { label: info.label, patches, moves: [] }], future: [] })
    }
    if (!plain && edits.length === 1) { mutate.updateLine(edits[0].id, edits[0].fields); record(); return }
    const nhan = !plain ? 'Đã sửa'
      : info.kind === 'paste' ? 'Đã dán ' + edits.length + ' ô vào'
        : info.kind === 'clear' ? 'Đã xoá nội dung' : 'Đã điền “' + String(info.value == null ? '' : info.value).slice(0, 24) + '”'
    act.applyEdits(edits, nhan).then(n => { if (n) record() })
  }
  const delSel = ids => (ids.length ? mutate.deleteLines(ids, { confirm: true }) : toast('Chọn ô ở các dòng cần xoá'))

  /* ---- Thao tác cho menu chuột phải / lọc cột / thanh hàng loạt ---- */
  const lineOf = id => lines.filter(l => l.lineId === id)[0]
  const A = {
    copyCell: t => { copyText(String(t || '')); toast('Đã sao chép: ' + String(t || '').slice(0, 40)) },
    copyRow: l => { copyText(visibleCols.map(c => { const v = cellSortVal_(l, c.key); return v == null ? '' : String(v) }).join('\t')); toast('Đã sao chép cả dòng — dán được thẳng vào Excel') },
    pasteCell: async (l, key) => {
      let txt = ''
      try { txt = await navigator.clipboard.readText() } catch (e) { toast('Trình duyệt chặn đọc clipboard — bấm vào ô rồi nhấn Ctrl+V'); return }
      if (!txt) return
      const d = tkFieldsFor_(l, key, String(txt).split('\t')[0].split('\n')[0].trim())
      if (!d) { toast('Cột này tự tính — không sửa trực tiếp được'); return }
      mutate.updateLine(l.lineId, d); toast('Đã dán vào ô')
    },
    clearCell: (l, key) => {
      const d = tkFieldsFor_(l, key, '')
      if (!d) { toast('Cột này tự tính — không sửa trực tiếp được'); return }
      mutate.updateLine(l.lineId, d); toast('Đã xoá nội dung ô')
    },
    pick: (l, at) => setPop({ kind: 'pick', anchor: at, line: l }),
    selectRow: l => selClick(null, l.lineId),
    selectAll: () => { if (cur) tickSet_(cur.maDA, shownIds); if (!plain && sheetApi.current) sheetApi.current.selectRows(shownIds) },
    dupRow: l => act.dupRows([l.lineId]),
    dupRows: ids => act.dupRows(ids),
    insertRow: l => act.insertRowBelow(l.lineId, node, sheetF),
    delRow: l => mutate.deleteLines([l.lineId]),
    delRows: ids => mutate.deleteLines(ids, { confirm: true }),
    delSel,
    fillDownSheet: (l, key, text, label) => act.fillDownSheet(shownIds.filter(id => id !== l.lineId), key, text, label),
    openCols: () => setPanel('cols'),
    addFloor: () => setAdderKey(k => k + 1),
    addToFloor: async g => { const l = await act.addItemToFloor(g.id, node, sheetF); if (l) flashTo(l.lineId, false) },
    renameFloor: g => act.renameFloor(g.id),
    sort: (key, dir) => setSort({ key, dir }),
    resetSort: () => setSort({ key: '', dir: 'asc' }),
    fillDown: async (l, key, text) => {
      const rows = dispItems.map(e => e.r).filter(x => x.lineId !== l.lineId)
      if (!rows.length) { toast('Không có dòng nào khác trong hạng mục này'); return }
      if (!await confirm('Điền "' + String(text || '').slice(0, 30) + '" cho ' + rows.length + ' dòng còn lại trong cột này?')) return
      if (!tkFieldsFor_(rows[0], key, text)) { toast('Cột này tự tính — không điền được'); return }
      rows.forEach(x => { const d = tkFieldsFor_(x, key, text); if (d) mutate.updateLine(x.lineId, d) })
      toast('Đã điền xuống ' + rows.length + ' dòng')
    },
    sumCol: (key, lbl) => {
      const rows = dispItems.map(e => e.r)
      const sum = rows.reduce((a, l) => a + (Number(cellSortVal_(l, key)) || 0), 0)
      toast('Tổng cột "' + lbl + '" (' + rows.length + ' dòng): ' + money(sum))
    },
    freezeTo: key => setFreezeN(visibleCols.findIndex(c => c.key === key) + 1),
    unfreeze: () => setFreezeN(0),
    freezeRowTo: l => {
      const i = dispItems.findIndex(e => e.r.lineId === l.lineId)
      const n = i >= 0 ? i + 1 : 0
      setFrzRows(n); toast(n ? ('Đã cố định ' + n + ' hàng đầu') : 'Đã bỏ cố định hàng')
    },
    unfreezeRows: () => { setFrzRows(0); toast('Đã bỏ cố định hàng') },
    hideCol, showAllCols,
    cfToggle: rule => setCfRules(r => { const n = { ...r }; if (n[rule]) delete n[rule]; else n[rule] = 1; return n }),
    findReplace: () => setPanel('find'),
    gotoExport: () => navigate('export'),
    setFilter: (key, v) => setColFilter(f => { const n = { ...f }; if (v == null) delete n[key]; else n[key] = v; return n }),
    applyFields: (edits, nhan) => act.applyEdits(edits, nhan),
    bulkEdit: (ls, k, val, nhan) => act.applyEdits(ls.map(l => {
      if (k === 'tang') return { id: l.lineId, fields: { tang: String(val) } }
      const fl = tkFieldsFor_(l, k, val); return fl ? { id: l.lineId, fields: fl } : null
    }).filter(Boolean), 'Đã đặt “' + nhan + '”'),
    bulkSheet: (ids, v) => act.bulkSheet(ids, v),
    bulkCopy: ls => {
      const head = visibleCols.map(c => c.label).join('\t')
      const rows = ls.map(l => visibleCols.map(c => { if (c.key === 'stt') return ''; const v = cellSortVal_(l, c.key); return v == null ? '' : String(v) }).join('\t'))
      copyText([head].concat(rows).join('\n'))
      toast('Đã sao chép ' + rows.length + ' dòng')
    },
  }

  /* ---- Hạng mục (cây) + sheet Nhân công / Vật tư ---- */
  /* Thêm / xoá hạng mục tự tạo (ô cây bên dưới) chỉ đặt S.node như addCustomGroup / delCustomGroup app.js:1597-1612:
     không ghi qs_hm, không thêm chip gần đây -> dùng setState({node}) thay cho pickNode.
     fromTree: chọn trên ô Hạng mục -> đề mục có cấp phụ (Phần thô, Nhân công / Vật tư) giữ ô mở để chọn tiếp (mmPick_ app.js:1572-1578) */
  function pickNode(code, fromTree) {
    setNode(code); setHmNode(code, 'boc')
    const coPhu = code === '3.1' || tkSheetCo_(code)
    if (!(fromTree && coPhu)) setPop(null)
  }
  function setSheet(v, close) {
    const nv = close ? (v || '') : (sheetSel === v ? '' : (v || ''))
    setSheetSel(nv); lsSet('qs_sheet', nv)
    if (close) setPop(null)
  }
  /* Phần thô: chip Loại báo giá 1. Khái toán (1.1 · 1.2) · 2. Dự toán (2.1 · 2.2) (tkSheetChips_ boc.js:1752-1760) */
  const ptChips = isPT ? (
    <span className="qs-tk-sheets">
      {PT_LOAI_NHOM.map(g => (
        <Fragment key={g[0]}>
          <span className="qs-tk-shsep">{g[1] + '. ' + g[2]}</span>
          {g[3].map(x => (
            <button key={x[0]} className={`qs-tk-shchip${ptLoai === x[0] ? ' on' : ''}`} title={x[2] + ' — ' + x[3]} onClick={() => ptSheetPick_(x[0])}>
              <span className="qs-tk-shc">{x[1]}</span>{ptLoaiNgan(x[2])}
            </button>
          ))}
        </Fragment>
      ))}
    </span>
  ) : null
  const sheetChips = sheetCo ? (() => {
    const dem = { nc: 0, vt: 0, '': 0 }
    nodeLines.forEach(l => { dem[tkSheetOf_(l)] = (dem[tkSheetOf_(l)] || 0) + 1 })
    return (
      <span className="qs-tk-sheets">
        {TK_SHEETS.map((t, i) => (
          <button key={t[0]} className={`qs-tk-shchip${sheetSel === t[0] ? ' on' : ''}`} title={'Chỉ hiện các dòng ' + t[1] + ' của hạng mục này'} onClick={() => setSheet(t[0])}>
            <span className="qs-tk-shc">{node + '.' + (i + 1) + '.'}</span>{t[1]}<i className="qs-tk-shn">[{pad2(dem[t[0]] || 0)}]</i>
          </button>
        ))}
        {sheetSel && <button className="qs-tk-shchip clr" title="Bỏ lọc, xem tất cả" onClick={() => setSheet(sheetSel)}>✕ Tất cả</button>}
      </span>
    )
  })() : null
  /* Nhãn ô hạng mục (renderTree app.js:1337-1338): mã.tên; hạng mục tự tạo có mã = tên */
  const treeSel = TREE.some(t => t[0] === node && t[0] !== 'X') ? node + '.' + nodeName(node)
    : (customGroups(cur).indexOf(node) >= 0 ? node + '.' + node : 'Chọn hạng mục')

  /* ---- Cập nhật giá theo danh mục ---- */
  const giaLech = useMemo(() => giaLechList_(lines, products), [lines, products])
  function openGiaSync() {
    if (!cur) { toast('Chưa chọn dự án'); return }
    if (!giaLech.length) { toast('Mọi dòng trong dự án đã khớp giá danh mục'); return }
    setPop({ kind: 'gia', ds: giaLech })
  }
  const recentBtn = useRef(null)
  const recentTool = (
    <button ref={recentBtn} className={`qs-bd-tb-btn${pop && pop.kind === 'recent' ? ' on' : ''}`} title="Vừa thêm vào bảng — xem lại / thêm lại"
      onMouseDown={e => e.preventDefault()} onClick={() => setPop(p => (p && p.kind === 'recent' ? null : { kind: 'recent', anchor: recentBtn.current }))}>
      <Icon name="clock" size={18} />
    </button>
  )
  const giaTool = (
    <button className="qs-bd-tb-btn badged" title={giaLech.length ? (giaLech.length + ' dòng đang lệch giá so với Danh sách sản phẩm — bấm để cập nhật') : 'Cập nhật giá dòng theo Danh sách sản phẩm (đang khớp hết)'}
      onMouseDown={e => e.preventDefault()} onClick={openGiaSync}>
      <Icon name="refresh" size={18} />{giaLech.length ? <span className="qs-bd-tb-badge">{giaLech.length}</span> : null}
    </button>
  )
  const extraTools = <>{recentTool}{giaTool}</>
  /* Bảng thường: khối "Công cụ bảng" gọn (tkToolsSync_ boc.js:1632-1648) thay cho thanh công cụ bảng tính.
     Nút Bộ lọc / Yêu thích của bản gốc thuộc cột sản phẩm bên trái (CatalogPanel) nên không lặp lại ở đây. */
  const plainTools = (a, st) => (
    <div className="qs-tk-toolbox">
      <span className="qs-tk-toolh">Công cụ bảng</span>
      <span className="qs-tk-tgrp">
        {recentTool}
        <button className={`qs-bd-tb-btn${panel === 'find' ? ' on' : ''}`} title="Tìm & thay trong bảng (Ctrl+F)" onMouseDown={e => e.preventDefault()} onClick={() => a.togglePanel('find')}>
          <Icon name="search" size={18} />
        </button>
        {giaTool}
      </span>
      <span className="qs-tk-tsep" />
      <span className="qs-tk-tgrp">
        <button className={`qs-bd-tb-btn${st.zoom !== 100 ? ' on' : ''}`} onMouseDown={e => e.preventDefault()}
          title={st.zoom !== 100 ? 'Đang co cột vừa khung — bấm để trả về bề rộng đã đặt (có kéo ngang)' : 'Co cột cho vừa bề ngang khung, hết kéo ngang'}
          onClick={() => (st.zoom !== 100 ? a.setZoom(100) : a.fitWidth())}>
          <Icon name="fitWidth" size={18} />
        </button>
        <button className={`qs-bd-tb-btn${st.full ? ' on' : ''}`} title={st.full ? 'Thoát toàn màn hình (Esc)' : 'Chỉ còn bảng, chiếm cả màn hình'}
          onMouseDown={e => e.preventDefault()} onClick={a.toggleFull}>
          <Icon name="maximize" size={18} />
        </button>
      </span>
    </div>
  )
  /* Bảng thường: nút xoá dòng ở mép phải (renderActGutter boc.js:830-841), xoá 1 dòng không hỏi như delLine */
  const rowAction = e => (
    <button className="qs-tk-agx" title="Xoá dòng này" aria-label="Xoá dòng này" onMouseDown={ev => ev.stopPropagation()} onClick={() => mutate.deleteLines([e.r.lineId])}>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
    </button>
  )

  /* ---- Bảng tính / Bảng thường (nhớ theo máy, qs_bt_mode) ---- */
  function setView(v) {
    if (v === view) return
    setViewState(v); lsSet('qs_bt_mode', v === 'plain' ? 'cu' : 'moi')
    toast(v === 'plain' ? 'Đã chuyển sang Bảng thường' : 'Đã chuyển sang Bảng tính')
  }

  const colMarks = useMemo(() => { const m = {}; Object.keys(colFilter).forEach(k => { m[k] = 'flt' }); if (sort.key) m[sort.key] = 'sort'; return m }, [colFilter, sort.key])
  const bulkLines = barOn ? selShown.map(lineOf).filter(Boolean) : []
  /* Trống: Bảng tính thay cả lưới bằng hướng dẫn (tkSheetTrong_ bangtinh.js:665-671); Bảng thường / chưa có dự án
     giữ tiêu đề cột + 1 dòng chữ (renderTable boc.js:478, 523) */
  const emptyReplace = !plain && !!cur
  const empty = !cur
    ? <div className="qs-tk-emptyrow">Chưa chọn dự án.</div>
    : plain
      ? <div className="qs-tk-emptyrow">Chưa có tầng/hạng mục. Bấm “＋ Tầng”, rồi “＋ Hạng mục” — hoặc thêm sản phẩm từ danh mục bên trái.</div>
      : <div className="qs-tk-empty"><Icon name="layers" size={30} /><b>Hạng mục này chưa có sản phẩm</b><span>Kéo sản phẩm ở danh mục bên trái thả vào đây, bấm ＋ trên thẻ sản phẩm, hoặc bấm <b>Thêm hạng mục</b> bên dưới.</span></div>

  return (
    <>
      <div className="qs-bd-body">
        {catalogOpen && (
          <>
            <CatalogPanel
              width={catalogW}
              onAdd={(product, opts) => addProduct(product, opts || {})}
              onOpen={(product, opts) => { setDetail(product); setDetailSl((opts && opts.sl) || null) }}
              activeId={detail ? String(detail.recordId || detail.ma) : null}
              dragId={dragProduct ? String(dragProduct.recordId || dragProduct.ma) : null}
              onDragProduct={onDragProduct}
              onDragEnd={endDragProduct}
              ptCount={isPT ? ptCount : undefined}
              ptFilters={isPT ? <PtFilters /> : undefined}
              ptLib={isPT ? <PtLibrary /> : undefined}
            />
            <div
              className={`qs-bd-split${resizing ? ' dragging' : ''}`}
              title="Kéo để đổi bề rộng · bấm đúp để về mặc định"
              onPointerDown={startResize}
              onPointerMove={moveResize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onDoubleClick={() => setCatalogW(CATALOG_DEFAULT)}
            />
          </>
        )}
        {catalogOpen && detail && (
          <ProductInfo product={detail} addSl={detailSl} onClose={() => setDetail(null)} onAdd={(product, opts) => addProduct(product, opts || {})}
            onDragProduct={onDragProduct} onDragEnd={endDragProduct} />
        )}
        {/* #pdPanel của Phần thô vẫn hiện khi ẩn cột trái như bản gốc (#bocGrid.nocat.detail, PUB/index.html:5786) */}
        {isPT && <PtDetail />}
        <div className="qs-bd-right">
          <SheetHeader
            count={isPT ? ptTot.count : sheetLines.length} treeCount={isPT ? sheetLines.length : undefined} hideCols={isPT} nodeLabel={treeSel}
            onOpenTree={e => { const at = e.currentTarget; setPop(p => (p && p.kind === 'tree' ? null : { kind: 'tree', anchor: at })) }}
            treeOpen={!!pop && pop.kind === 'tree'} sheetChips={isPT ? ptChips : sheetChips}
            subtotal={isPT ? ptTot.grand : subtotal} vat={isPT ? ptTot.vatPct : (cur ? Number(cur.vat) || 0 : 0)} onVat={act.setVat}
            view={view} onView={setView}
            catalogOpen={catalogOpen} onToggleCatalog={() => setCatalogOpen(o => !o)}
            colsShown={visibleCols.length} colsTotal={columns.length}
            colsOpen={panel === 'cols'} onOpenCols={() => setPanel(p => (p === 'cols' ? null : 'cols'))}
            presetLabel={presetLabel(colState.cols)} presetOpen={!!pop && pop.kind === 'preset'}
            onOpenPreset={e => { const at = e.currentTarget; setPop(p => (p && p.kind === 'preset' ? null : { kind: 'preset', anchor: at })) }}
          />
          {isPT ? <PhanThoPanel tools={extraTools} /> : (
            <div
              className={`qs-card qs-bd-sheet${dragProduct ? ' drop-active' : ''}${full ? ' full' : ''}`}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrop(null) }}
            >
              <SheetBody
                sheet={facade}
                plain={plain}
                hiddenCols={hiddenCols} onHiddenCols={onHiddenCols}
                panel={panel} onPanel={setPanel}
                favorites={NO_FAVS}
                targetName={targetFloor} onTarget={id => setTargetId(id)}
                groupNames={floorNames}
                onAddGroup={addGroup} onAddRow={() => {}} onAddBlank={addBlank}
                full={full} onFull={() => setFull(f => !f)}
                dropMark={dropMark}
                flash={flash}
                onClearMark={() => setFlash(f => (f && f.mark ? { ...f, mark: false } : f))}
                dropHint={dragProduct ? `Thả để thêm vào ${dropGroup ? dropGroup.name : CHUA_PHAN_TANG}` : null}
                fileName={`boc-tach-${cur ? cur.maDA : ''}`}
                printTitle={((cur && cur.ten) || '') + ' — ' + (nodeName(node) || 'Bóc tách')}
                columns={columns} flatten={flatten} extraPred={basePred} initialSel={INITIAL_SEL} rowClass={rowClass}
                adapter={adapter} wrapKey="wrap" hideTools={['import', 'csv']} extraTools={extraTools}
                onRenameGroup={(g, name) => { if (g.id !== CHUA_PHAN_TANG) act.renameFloor(g.id, name) }}
                onInsertRow={e => (e.type === 'item' ? act.insertRowBelow(e.r.lineId, node, sheetF) : A.addToFloor(e.g))}
                onDuplicate={ids => act.dupRows(ids)}
                onSort={(key, dir, label) => { setSort({ key, dir }); toast('Sắp xếp ' + (dir === 'asc' ? 'A → Z' : 'Z → A') + ' theo "' + label + '"') }}
                onDownload={() => act.exportXlsx(tkXlsxBody(dispFlat, visibleCols, 'BÓC TÁCH — ' + (nodeName(node) || 'Bóc tách').toUpperCase() + ' — ' + ((cur && (cur.ten || cur.maDA)) || '')))}
                onReplaceAll={(q, rep) => act.replaceAll(q, rep, node)}
                onCellContext={ctx => setPop({ kind: 'ctx', at: { x: ctx.ev.clientX, y: ctx.ev.clientY }, entry: ctx.entry, col: ctx.col, ids: ctx.ids,
                  text: ctx.entry && ctx.col ? tkEntryText(ctx.entry, ctx.col.key) : '' })}
                onSelItems={onSheetSel} apiRef={sheetApi}
                onApplyEdits={applyCells} onDeleteRows={delSel} plainTools={plainTools} adderOpenKey={adderKey}
                onColResize={setColW} onColMove={moveCol} rowAction={plain ? rowAction : undefined} emptyReplace={emptyReplace} plainFmt={false}
                renderCell={renderCell}
                onColMenu={(key, ev) => setPop({ kind: 'flt', anchor: ev.currentTarget, key })} colMarks={colMarks}
                rowDrag={rowDrag} rowHeights={rowH} onRowHeight={onRowHeight} frozenRows={frzRows}
                datalists={TK_DATALISTS}
                gridClass={`qs-tk-grid${plain ? ' qs-tk-plain' : ''}`} emptyNode={empty}
                colsPanel={<ColsStrip columns={columns} cols={colState.cols} onToggle={k => { if (k === 'ten') { toast('Không thể ẩn cột Tên sản phẩm'); return } setColsMap({ ...colState.cols, [k]: !colState.cols[k] }) }} />}
              />
            </div>
          )}
        </div>
      </div>

      {visible && pop && pop.kind === 'tree' && (
        <TreePopover anchor={pop.anchor} node={node} cur={cur} lines={lines} sheet={sheetSel} ptLoai={ptLoai}
          onPick={code => pickNode(code, true)} onSheet={v => setSheet(v, true)}
          onLoai={v => { if (mmLoai_(v)) setPop(null) }}
          onAdd={async () => { setPop(null); const nm = await act.addCustomGroup(); if (nm) setState({ node: nm }) }}
          onDelete={async code => { setPop(null); if (await act.delCustomGroup(code) && node === code) setState({ node: DEFAULT_NODE }) }}
          onClose={() => setPop(null)} />
      )}
      {visible && pop && pop.kind === 'preset' && <PresetPopover anchor={pop.anchor} cols={colState.cols} onClose={() => setPop(null)} />}
      {visible && pop && pop.kind === 'ctx' && (
        <ContextMenu mode={plain ? 'plain' : 'sheet'} at={pop.at} entry={pop.entry} col={pop.col} text={pop.text} ids={pop.ids} cf={cfRules} sortKey={sort.key} freezeN={freezeN} frzRows={frzRows}
          act={A} onClose={() => setPop(null)} />
      )}
      {visible && pop && pop.kind === 'flt' && (
        <ColFilterPop anchor={pop.anchor} colKey={pop.key} label={(columns.filter(c => c.key === pop.key)[0] || {}).label || pop.key}
          lines={nodeLines} value={colFilter[pop.key]} sortKey={sort.key} freezeN={freezeN} act={A} onClose={() => setPop(null)} />
      )}
      {visible && pop && pop.kind === 'pick' && pop.line && <LinePicker anchor={pop.anchor} line={pop.line} products={products} onClose={() => setPop(null)} />}
      {visible && pop && pop.kind === 'lnupd' && <LineUpdatePop anchor={pop.anchor} line={lineOf(pop.line.lineId) || pop.line} products={products} onClose={() => setPop(null)} />}
      {visible && pop && pop.kind === 'lnpick' && <LnPickPop anchor={pop.anchor} line={pop.line} onPick={v => mutate.updateLine(pop.line.lineId, { lnPct: v })} onClose={() => setPop(null)} />}
      {visible && pop && pop.kind === 'gia' && <PriceSyncModal ds={pop.ds} onClose={() => setPop(null)} />}
      {visible && pop && pop.kind === 'docs' && <DocsPopover anchor={pop.anchor} title={pop.line.ten} docs={pop.docs} onClose={() => setPop(null)} />}
      {visible && pop && pop.kind === 'recent' && (
        <RecentPop anchor={pop.anchor} lines={lines} onClose={() => setPop(null)}
          onGo={l => { if (l.nhom && l.nhom !== node) pickNode(l.nhom); flashTo(l.lineId, false) }}
          onPlus={l => { mutate.updateLine(l.lineId, { soLuong: (Number(l.soLuong) || 0) + 1 }); toast('+1 số lượng: ' + l.ten) }} />
      )}
      {visible && imgView && <ImgViewer src={imgView} onClose={() => setImgView('')} />}
      {bulkLines.length > 0 && (
        <BulkBar lines={bulkLines} floors={floorNames} sheetCo={sheetCo} act={A} onClear={clearSel} />
      )}
    </>
  )
}

