import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { useQs } from '../state/QsData'
import { useLinesSheet } from '../state/useLinesSheet'
import SheetBody from './breakdown/SheetBody'
import { useTkCols, setColW } from './breakdown/sheet/tkCols'
import { RecentPop, PriceSyncModal } from './breakdown/sheet/SyncPops'
import * as bocAct from './breakdown/sheet/bocActions'
import './breakdown/sheet/sheet.css'
import { useFold, foldToggle_, projCtx_, usePdState, pdRetry_ } from './project/projectShell'
import CostOverview from './cost/CostOverview'
import CompareDrafts from './cost/CompareDrafts'
import PageHead, { Stat, VatStat, PtNote, LacNote, PtErrNote } from './cost/PageHead'
import { ColFrame, ColChips, PresetPop } from './cost/ColTools'
import CpCtxMenu from './cost/CpCtxMenu'
import TickStt, { Signed } from './cost/TickStt'
import TickBar from './cost/TickBar'
import { useColSet, setColsMap, moveCol, toggleCol } from './cost/cpCols'
import { sheetColumns, lineAdapter, cpRows_, cpCounts_, cpFlatten, cpXlsxBody } from './cost/lineSheet'
import { applyCells, applyEditsRec, exportBang, dropRow, fillDown, replaceAll, copySel } from './cost/costActions'
import { useTicks, tickClick_ } from '../state/tickSel'
import './cost/cost.css'
import { CP_KEYS, TK_LN_QUICK, cpLabel_ } from '../lib/columns.js'
import { giaDaiLy_, tkFieldsFor_ } from '../lib/calc.js'
import { money, pctIn_ } from '../lib/format.js'
import { cpTong_, cpMinBien_, cpMinBienIn_, cpBienMTIn_, daScope_ } from '../lib/totals.js'
import { currentGroup } from '../lib/dashModel.js'
import { giaLechList_, spOfLine_ } from '../lib/bocSync.js'

const TAB = 'chiphi'
const INITIAL_SEL = { a: { r: 0, c: 0 }, f: { r: 0, c: 0 } }
const NO_FAVS = new Set()
const BY = [['hm', 'Hạng mục'], ['tang', 'Tầng'], ['ncc', 'NCC'], ['', 'Không gom']]
const dong = n => `${money(n)} đ`

function lsGet(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
function lsSet(k, v) { try { localStorage.setItem(k, v) } catch (e) { /* bỏ qua */ } }
const btMode = () => (lsGet('qs_bt_mode') === 'cu' ? 'plain' : 'sheet')

/* Tab "Chi phí" (port PUB/chiphi.js, bangtinh.js:688-708): dòng bóc tách của hạng mục dùng chung (hmNode, '' = tất cả).
   Dải tổng + Tổng quan theo cpTong_ (gồm Phần thô khi xem tất cả / 3.1, trừ CK báo giá khi xem tất cả). Bảng dùng chung
   ô sửa với Bóc tách (useLinesSheet({hm}) -> updateLine), cột CP_KEYS + bộ cột "Của tôi" (cpCols), gom theo hạng mục / tầng / NCC,
   chip lọc cảnh báo, sắp xếp, đặt nhanh % lợi nhuận, biên mục tiêu (projData.cpCfg), so sánh bản nháp, Excel chi-phi-<maDA>.xlsx. */
export default function CostTab() {
  const qs = useQs()
  const { cur, lines, products, projects, projData, setProjData, hmNode, setHmNode, mutate, toast, confirm, ask, navigate, selectProject, status } = qs
  const visible = qs.panelVisible(TAB)
  const seq = qs.visibleSeq(TAB)
  const facade = useLinesSheet({ hm: hmNode })
  const colSet = useColSet('cp')
  const tkCols = useTkCols()
  const pd = usePdState(cur, status)
  const foldCols = useFold('cols')
  const foldTools = useFold('tools')
  const ticks = useTicks(cur && cur.maDA)
  const sheetBox = useRef(null)

  const [view, setViewState] = useState(btMode)
  const [q, setQ] = useState('')
  const [flt, setFlt] = useState('')
  const [sort, setSort] = useState({ key: '', dir: 'asc' })
  const [by, setByState] = useState(() => { const v = lsGet('qs_cpBy'); return v == null ? 'hm' : v })
  const [ovHide, setOvHide] = useState(() => lsGet('qs_cpOvHide') === '1')
  const [closed, setClosed] = useState(() => new Set())
  const [panel, setPanel] = useState(null)
  const [full, setFull] = useState(false)
  const [pop, setPop] = useState(null)
  const [selIds, setSelIds] = useState([])
  const [cmp, setCmp] = useState(false)
  const [xls, setXls] = useState(false)
  const [flash, setFlash] = useState(null)

  /* Kiểu bảng chung mọi bảng (qs_bt_mode): đọc lại mỗi lần tab hiện */
  useEffect(() => { if (visible) setViewState(btMode()) }, [visible, seq])
  function setView(v) {
    if (v === view) return
    setViewState(v); lsSet('qs_bt_mode', v === 'plain' ? 'cu' : 'moi')
    toast(v === 'plain' ? 'Đã chuyển sang Bảng thường' : 'Đã chuyển sang Bảng tính')
  }
  function setBy(v) { setByState(v); lsSet('qs_cpBy', v) }
  function ovToggle() { const v = !ovHide; setOvHide(v); lsSet('qs_cpOvHide', v ? '1' : '') }
  const setFltToggle = v => setFlt(f => (f === v ? '' : v))

  /* ---- Số liệu: tính trên ĐÚNG hạng mục đang chọn (ô tìm / chip lọc chỉ lọc bảng) ---- */
  const cpCfg = (projData && projData.cpCfg) || {}
  const minBien = cpMinBien_(cpCfg)
  const ctx = projCtx_(cur, projData)
  const scope = useMemo(() => daScope_(lines, hmNode), [lines, hmNode])
  const T = cpTong_(scope, hmNode, ctx)
  const rows = useMemo(() => cpRows_(scope, q, flt, minBien, sort.key, sort.dir), [scope, q, flt, minBien, sort])
  const counts = useMemo(() => cpCounts_(scope, minBien), [scope, minBien])
  const loc = !!(q || flt)
  const plain = view === 'plain'
  const lnCls = T.ln < 0 ? ' red' : (T.ln > 0 ? ' green' : '')
  const pending = pd.err
    ? <button type="button" className="qs-cp-retry" title={pd.err} onClick={() => pdRetry_(cur.maDA)}>Lỗi tải dữ liệu · Thử lại</button>
    : <span className="qs-cp-wait">{pd.slow ? 'Đang tải… (lâu hơn thường lệ)' : 'Đang tải…'}</span>
  const vOf = x => (pd.ready ? dong(x) : pending)

  /* ---- Cột ---- */
  const keys = colSet.order.filter(k => colSet.cols[k])
  const firstKey = keys[0] || 'ten'
  const columns = useMemo(() => sheetColumns(colSet.order, colSet.cols, tkCols.w, sort.key, sort.dir), [colSet, tkCols.w, sort])
  const hiddenCols = useMemo(() => new Set(CP_KEYS.filter(k => !colSet.cols[k])), [colSet.cols])
  const onHiddenCols = useCallback(set => { const m = {}; CP_KEYS.forEach(k => { m[k] = !set.has(k) }); setColsMap('cp', m) }, [])
  const adapter = useMemo(() => lineAdapter(r => { const p = spOfLine_(r, products); return !!(p && p.yeuThich) }), [products])
  const flatOf = useCallback(pred => (rows.length ? cpFlatten(pred ? rows.filter(l => pred(l, '')) : rows, by, firstKey, closed, minBien, plain) : []), [rows, by, firstKey, closed, minBien, plain])
  const flatten = useCallback((gs, pred) => flatOf(pred), [flatOf])
  const tickSet = useMemo(() => new Set(ticks), [ticks])
  const tickLines = useMemo(() => (ticks.length ? lines.filter(l => tickSet.has(l.lineId)) : []), [lines, ticks, tickSet])
  const shownIds = useMemo(() => (plain ? flatOf(null).filter(e => e.type === 'item').map(e => e.r.lineId) : []), [plain, flatOf])
  const rowClass = e => (e.type === 'item'
    ? (e.w === 'lo' ? ' qs-cp-lo' : e.w === 'thap' ? ' warn' : '') + (plain && tickSet.has(e.r.lineId) ? ' qs-tk-rowsel' : '')
    : e.sub ? ' qs-cp-sub' : '')
  const toggleGroup = useCallback(id => setClosed(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }), [])
  /* Tên nhóm / dòng TỔNG nằm ở cột dữ liệu đầu tiên (r[1] của cpSheetGrid_). Bảng thường (cpTableHtml_ / cpRowHtml_):
     ô STT có ô tick dòng (cpSttCell_), dòng nhóm "tên · N dòng · Vốn · Bán · LN", ô Lợi nhuận của dòng cộng tô màu (cpSigned_) */
  const renderCell = (e, c, info) => {
    if (e.type === 'group') {
      if (info.i === 1) {
        if (!plain || !e.t) return e.cells[firstKey]
        return (
          <span className="qs-cp-gh"><b>{e.g.name}</b><span className="qs-cp-gn">{e.count} dòng</span>
            <span className="qs-cp-gsum">Vốn <b>{money(e.t.von)}</b> · Bán <b>{money(e.t.ban)}</b> · LN <Signed v={e.t.ln} /></span></span>
        )
      }
      if (c.key === 'khuVuc' || c.key === 'ten') return (e.cells && e.cells[c.key]) || null
      return undefined
    }
    if (!plain) return undefined
    if (e.type === 'total' && c.key === 'lnVnd' && e.t) return <Signed v={e.t.ln} />
    if (e.type === 'item' && c.key === 'stt') return <TickStt stt={e.stt} on={tickSet.has(e.r.lineId)} onTick={ev => tickClick_(ev, cur.maDA, e.r.lineId, shownIds)} />
    return undefined
  }

  /* ---- Phạm vi đặt nhanh % LN / biên mục tiêu (cpLnBulkHien_ / cpLnRows_ / cpLnScopeLbl_ chiphi.js:343-372):
     vùng ô nhiều dòng của Bảng thường (S._rng chỉ có ở bảng .cpflat, Bảng tính không đặt) > dòng đã tick > các dòng đang hiện ---- */
  const rngLines = plain && selIds.length > 1 ? selIds.map(id => rows.filter(l => l.lineId === id)[0]).filter(Boolean) : []
  const lnBulkOn = rngLines.length > 1 || tickLines.length > 0
  const lnRows = () => (rngLines.length > 1 ? rngLines : tickLines.length ? tickLines : rows)
  const lnScopeLbl = () => {
    if (rngLines.length > 1) return 'áp cho ' + rngLines.length + ' dòng đang chọn'
    if (tickLines.length) return 'áp cho ' + tickLines.length + ' dòng đã tick bên Bóc tách'
    return loc ? ('áp cho ' + rows.length + ' dòng đang hiện') : ('áp cho tất cả ' + rows.length + ' dòng — chọn vùng ô để thu hẹp')
  }
  async function quickLn(v) {
    const ls = lnRows(); if (!ls.length) { toast('Chưa có dòng nào'); return }
    if (ls.length > 1 && !await confirm('Đặt lợi nhuận ' + v + '% cho ' + ls.length + ' dòng?')) return
    applyEditsRec(ls.map(l => ({ id: l.lineId, fields: { lnPct: Number(v) } })), 'Đã đặt lợi nhuận ' + v + '%')
  }
  async function quickLnAsk() {
    let v = await ask({ title: 'Đặt % lợi nhuận', label: '% lợi nhuận trên giá vốn', value: '', placeholder: 'VD: 20', ok: 'Áp dụng' })
    if (v == null) return
    v = pctIn_(v); if (v == null) { toast('% không hợp lệ'); return }
    quickLn(v)
  }
  const cfgSet = (k, v) => setProjData('cpCfg', { ...((qs.projData && qs.projData.cpCfg) || {}), [k]: v })
  function setMinBien(v) {
    const r = cpMinBienIn_(v)
    if (r.msg) { toast(r.msg); return false }
    cfgSet('minBien', r.value)
    return pd.ready ? r.value : false   // dữ liệu dự án chưa tải: projDataSet_ không lưu (toast + tải lại) -> ô trả về số đang có
  }
  async function bienMucTieu() {
    const ls = lnRows(); const co = ls.filter(l => giaDaiLy_(l) > 0)
    if (!co.length) { toast('Các dòng đang chọn chưa có giá vốn — nhập giá vốn trước'); return }
    let v = await ask({ title: 'Biên lợi nhuận mục tiêu', label: 'Biên % trên giá bán — ' + lnScopeLbl(),
      value: String(cpCfg.bienMT == null ? '' : cpCfg.bienMT), placeholder: 'VD: 25', ok: 'Tính giá bán' })
    if (v == null) return
    const r = cpBienMTIn_(v)
    if (r.msg) { toast(r.msg); return }
    v = r.value
    cfgSet('bienMT', v)
    const edits = co.map(l => ({ id: l.lineId, fields: tkFieldsFor_(l, 'margin', v) })).filter(e => e.fields)
    if (!edits.length) { toast('Không tính được giá bán cho dòng nào'); return }
    if (edits.length > 1 && !await confirm({ title: 'Đặt biên ' + v + '% cho ' + edits.length + ' dòng?',
      note: 'Giá bán từng dòng được tính lại để lợi nhuận bằng ' + v + '% giá bán (sau chiết khấu khách).'
        + (ls.length > co.length ? '\n' + (ls.length - co.length) + ' dòng chưa có giá vốn được bỏ qua.' : '') })) return
    applyEditsRec(edits, 'Đã đặt biên ' + v + '%')
  }

  /* ---- So sánh bản nháp · Excel ---- */
  const group = currentGroup(projects, cur)
  const soNhap = group ? group.drafts.length : 0
  function openCmp() {
    if (!group || group.drafts.length < 2) { toast('Dự án này mới có 1 bản nháp'); return }
    setCmp(true)
  }
  async function xuatExcel() {
    if (!cur || xls) return
    if (!rows.length) { toast('Không có dòng nào để xuất'); return }
    setXls(true)
    const ok = await exportBang(cpXlsxBody(cur, keys, rows, by, loc, hmNode, ctx), 'chi-phi-' + cur.maDA + '.xlsx')
    setXls(false)
    if (ok) toast('Đã xuất ' + rows.length + ' dòng ra Excel')
  }

  /* ---- Cập nhật giá theo danh mục · Vừa thêm (2 nút công cụ bảng, pgToolsHtml_) ---- */
  const giaLech = useMemo(() => giaLechList_(lines, products), [lines, products])
  function openGiaSync() {
    if (!cur) { toast('Chưa chọn dự án'); return }
    if (!giaLech.length) { toast('Mọi dòng trong dự án đã khớp giá danh mục'); return }
    setPop({ kind: 'gia', ds: giaLech })
  }
  const recentBtn = useRef(null)
  const extraTools = (
    <>
      <button ref={recentBtn} className={`qs-bd-tb-btn${pop && pop.kind === 'recent' ? ' on' : ''}`} title="Vừa thêm vào bảng — xem lại / thêm lại"
        onMouseDown={e => e.preventDefault()} onClick={() => setPop(p => (p && p.kind === 'recent' ? null : { kind: 'recent', anchor: recentBtn.current }))}>
        <Icon name="clock" size={18} />
      </button>
      <button className="qs-bd-tb-btn badged" title={giaLech.length ? (giaLech.length + ' dòng đang lệch giá so với Danh sách sản phẩm — bấm để cập nhật') : 'Cập nhật giá dòng theo Danh sách sản phẩm (đang khớp hết)'}
        onMouseDown={e => e.preventDefault()} onClick={openGiaSync}>
        <Icon name="refresh" size={18} />{giaLech.length ? <span className="qs-bd-tb-badge">{giaLech.length}</span> : null}
      </button>
    </>
  )
  const flashTo = id => setFlash(f => ({ rowId: id, text: null, mark: true, n: (f ? f.n : 0) + 1 }))
  /* Bảng thường: hàng đầu khối công cụ "Công cụ bảng" (pgColFrame_ chiphi.js:47-61: 2 nút pgToolsHtml_ + nút gập qs_fold.tools;
     gập thì chỉ còn hàng này, index.html:6260-6264). Bảng tính không có hàng này: 2 nút nằm trên thanh bảng tính */
  const toolHr = () => (
    <div className="qs-tk-toolbox qs-cp-toolhr">
      <span className="qs-tk-toolh">Công cụ bảng</span>
      <span className="qs-tk-tgrp">{extraTools}</span>
      <button type="button" className={`qs-bd-round-btn accent qs-cp-fold${foldTools ? ' on' : ''}`} title={(foldTools ? 'Mở lại ' : 'Thu gọn ') + 'khối công cụ'}
        onClick={() => foldToggle_('tools')}><Icon name="chevronDown" size={14} /></button>
    </div>
  )
  /* Menu chuột phải ở Bảng tính (btMenuChung_ bangtinh.js:765-787) */
  const ctxAct = {
    insertRow: ids => { const id = ids[ids.length - 1]; if (!id) { toast('Chọn 1 ô ở dòng sản phẩm trước'); return } bocAct.insertRowBelow(id, hmNode || qs.node, '') },
    dupRows: ids => (ids.length ? bocAct.dupRows(ids) : toast('Chọn ô ở các dòng cần nhân bản')),
    delRows: ids => (ids.length ? mutate.deleteLines(ids, { confirm: true }) : toast('Chọn ô ở các dòng cần xoá')),
    sort: (key, dir) => { setSort({ key, dir }); toast('Sắp xếp ' + (dir === 'asc' ? 'A → Z' : 'Z → A') + ' theo "' + cpLabel_(key) + '"') },
    resetSort: () => setSort({ key: '', dir: 'asc' }),
    fillDown,
    hideCol: k => { if (colSet.cols[k]) toggleCol('cp', k) },
    copy: () => copySel(sheetBox.current),
    find: () => setPanel('find'),
  }

  /* Bỏ vùng chọn khi đổi dự án / hạng mục */
  useEffect(() => { setSelIds([]) }, [cur && cur.maDA, hmNode])

  const rowDrag = useMemo(() => ({
    canGroup: () => false,
    onDrop: (src, dst, before) => {
      if (sort.key) { toast('Đang sắp xếp theo cột — bỏ sắp xếp rồi kéo'); return }
      dropRow('cp', by, src, dst, before)
    },
  }), [sort.key, by, toast])

  const cycleSort = k => setSort(s => (s.key !== k ? { key: k, dir: 'asc' } : s.dir === 'asc' ? { key: k, dir: 'desc' } : { key: '', dir: 'asc' }))
  const colMarks = useMemo(() => (sort.key ? { [sort.key]: 'sort' } : {}), [sort.key])

  if (!cur) {
    return (
      <div className="qs-card qs-cp-empty">
        <Icon name="banknote" size={30} />
        <b>Chưa chọn dự án</b>
        <span>Vào <b>Bảng điều khiển</b> chọn hoặc tạo một dự án để xem bảng chi phí.</span>
      </div>
    )
  }

  const stats = (
    <>
      <Stat label="Vốn" value={vOf(T.von)} />
      <Stat label="Giá bán" value={vOf(T.ban)} />
      {pd.ready && T.ck ? <Stat label="CK báo giá" value={'−' + dong(T.ck)} /> : null}
      <Stat label="Lợi nhuận" value={vOf(T.ln)} cls={'qs-cp-ln' + lnCls} />
      <Stat label="Biên" value={pd.ready ? T.bien.toFixed(1) + '%' : '…'} cls={'qs-cp-ln' + lnCls} />
      <VatStat vatPct={Number(cur.vat) || 0} amount={T.vat} amountNode={pd.ready ? null : pending} onVat={bocAct.setVat} />
      <Stat label="Tổng" value={vOf(T.total)} cls="grand" />
    </>
  )
  const chip = (k, nhan, n, warn) => (!n && k ? null : (
    <button key={k || 'all'} className={`qs-ct-chip${flt === k ? ' on' : ''}${warn ? ' red' : ''}`} onClick={() => setFltToggle(k)}>{nhan}<span>{n}</span></button>
  ))
  const emptyNode = !lines.length
    ? <div className="qs-tk-emptyrow">Chưa có hạng mục nào. Vào tab <b>Bóc tách</b> để thêm sản phẩm.</div>
    : <div className="qs-tk-emptyrow">Không có dòng nào khớp bộ lọc. <button type="button" className="qs-qt-btn qs-cp-inl" onClick={() => { setQ(''); setFlt('') }}>Xoá lọc</button></div>

  return (
    <>
      <PageHead n={scope.length} hm={hmNode} lines={lines} onHm={code => setHmNode(code)} view={view} onView={setView} stats={stats} />
      <PtNote hm={hmNode} onBoc={() => navigate('boc')} />
      {pd.ready && <PtErrNote msg={T.ptErr} />}
      <LacNote lines={lines} hm={hmNode} soHien={scope.length} onHm={code => setHmNode(code)} />

      {!ovHide && (
        <CostOverview T={T} scope={scope} minBien={minBien} onMinBien={setMinBien} onFilter={setFltToggle}
          onHm={code => setHmNode(code)} onCollapse={ovToggle} ready={pd.ready} pending={pending} />
      )}

      <div className={`qs-card qs-ct-filters qs-cp-tools${plain && foldTools ? ' folded' : ''}`}>
        {plain && toolHr()}
        {!(plain && foldTools) && <>
        <div className="qs-ct-filters-main">
          <div className={`qs-ct-search qs-cp-search${q ? ' has-q' : ''}`}>
            <Icon name="search" size={15} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên · mã · thương hiệu · phòng…" />
            {q && <button type="button" className="qs-cp-x" title="Xoá tìm kiếm" onClick={() => setQ('')}>✕</button>}
          </div>
          <button className={`qs-ct-chip${!flt ? ' on' : ''}`} onClick={() => setFlt('')}>Tất cả<span>{scope.length}</span></button>
          {chip('lo', 'Đang lỗ', counts.lo, true)}
          {chip('thap', 'Biên < ' + minBien + '%', counts.thap, true)}
          {chip('chuaGia', 'Chưa có giá bán', counts.chuaGia)}
          {chip('chuaVon', 'Chưa có giá vốn', counts.chuaVon)}
          {loc && <span className="qs-cp-found">{rows.length} / {scope.length} dòng</span>}
          <span style={{ flex: 1 }} />
          <div className="qs-bd-seg qs-cp-seg" title="Gom các dòng và cộng tổng từng nhóm">
            <span className="qs-cp-seg-l">Gom theo</span>
            {BY.map(x => <button key={x[0] || 'none'} className={by === x[0] ? 'on' : ''} onClick={() => setBy(x[0])}>{x[1]}</button>)}
          </div>
          <button className={`qs-ct-btn outline${ovHide ? '' : ' on'}`} title={(ovHide ? 'Hiện' : 'Ẩn') + ' thẻ Tổng quan chi phí (vốn · giá bán · lợi nhuận · biểu đồ)'} onClick={ovToggle}><Icon name="gauge" size={14} />Tổng quan</button>
          <button className="qs-ct-btn outline" title="Tính lại giá bán để đạt biên lợi nhuận mong muốn" onClick={bienMucTieu}><Icon name="target" size={14} />Biên mục tiêu…</button>
          {soNhap > 1 && <button className="qs-ct-btn outline" title="So tổng tiền các bản nháp của dự án này" onClick={openCmp}><Icon name="layers" size={14} />So sánh {soNhap} bản nháp</button>}
          <button className="qs-ct-btn" disabled={xls} title="Bảng đang xem (đúng cột, lọc, cách gom) ra file Excel" onClick={xuatExcel}><Icon name="download" size={14} />Xuất Excel</button>
        </div>
        <div className="qs-ct-filters-cols">
          <ColFrame t="cp" cols={colSet.cols} foldCols={foldCols} onFoldCols={() => foldToggle_('cols')}
            presetOpen={!!pop && pop.kind === 'preset'} onPreset={e => { const at = e.currentTarget; setPop(p => (p && p.kind === 'preset' ? null : { kind: 'preset', anchor: at })) }} />
        </div>
        {!foldCols && <ColChips t="cp" cols={colSet.cols} />}
        </>}
      </div>

      {lnBulkOn && (
        <div className="qs-card qs-cp-lnq">
          <span className="qs-cp-lnq-l"><Icon name="gauge" size={13} /> Đặt nhanh lợi nhuận</span>
          <div className="qs-cp-lnq-b">
            {TK_LN_QUICK.map(v => <button key={v} title={'Đặt lợi nhuận ' + v + '% trên giá vốn'} onClick={() => quickLn(v)}>{v}%</button>)}
            <button className="khac" title="Nhập % khác" onClick={quickLnAsk}>Khác…</button>
          </div>
          <span className="qs-cp-lnq-sc">{lnScopeLbl()}</span>
        </div>
      )}

      <div ref={sheetBox} className={`qs-card qs-bd-sheet qs-ct-sheet${full ? ' full' : ''}`}>
        <SheetBody
          sheet={facade}
          plain={plain}
          hiddenCols={hiddenCols} onHiddenCols={onHiddenCols}
          panel={panel} onPanel={setPanel}
          favorites={NO_FAVS}
          onTarget={() => {}}
          onAddRow={() => {}}
          full={full} onFull={() => setFull(f => !f)}
          flash={flash} onClearMark={() => setFlash(f => (f && f.mark ? { ...f, mark: false } : f))}
          fileName={'chi-phi-' + cur.maDA}
          printTitle={(cur.ten || cur.maDA) + ' — Chi phí'}
          columns={columns} flatten={flatten} initialSel={INITIAL_SEL} rowClass={rowClass} onToggleGroupOverride={toggleGroup}
          footer={false}
          adapter={adapter} wrapKey="wrap" hideTools={['import', 'csv']} extraTools={extraTools}
          onInsertRow={e => (e.type === 'item' ? bocAct.insertRowBelow(e.r.lineId, e.r.nhom || hmNode || qs.node, '') : null)}
          onDuplicate={ids => bocAct.dupRows(ids)}
          onSort={(key, dir, label) => { setSort({ key, dir }); toast('Sắp xếp ' + (dir === 'asc' ? 'A → Z' : 'Z → A') + ' theo "' + label + '"') }}
          onDownload={xuatExcel}
          onSelItems={ids => setSelIds(ids)}
          onApplyEdits={(info, cells) => applyCells(info, cells, plain)}
          onReplaceAll={(fq, rep) => replaceAll(fq, rep, rows, keys)}
          onCellContext={plain ? null : ctx => setPop({ kind: 'ctx', at: { x: ctx.ev.clientX, y: ctx.ev.clientY }, entry: ctx.entry, col: ctx.col, ids: ctx.ids, keys: ctx.keys })}
          plainTools={() => null}
          onDeleteRows={ids => (ids.length ? mutate.deleteLines(ids, { confirm: true }) : toast('Chọn ô ở các dòng cần xoá'))}
          onColResize={setColW} onColMove={(from, to, before) => { if (from !== 'stt' && to !== 'stt') moveCol('cp', from, to, before) }}
          onColMenu={key => { if (key !== 'stt') cycleSort(key) }} colMarks={colMarks}
          rowDrag={rowDrag} plainFmt={false}
          renderCell={renderCell}
          gridClass={`qs-tk-grid qs-cp-grid${plain ? ' qs-tk-plain' : ''}`} emptyNode={emptyNode}
          colCount={{ shown: keys.length, total: CP_KEYS.length }}
          colsPanel={<ColChips t="cp" cols={colSet.cols} />}
        />
      </div>

      {visible && cmp && group && (
        <CompareDrafts group={group} curMa={cur.maDA} curLines={lines} onOpen={ma => selectProject(ma)} onClose={() => setCmp(false)} />
      )}
      {visible && <TickBar maDA={cur.maDA} lines={tickLines} keys={keys} shownIds={shownIds} />}
      {visible && pop && pop.kind === 'preset' && <PresetPop t="cp" anchor={pop.anchor} cols={colSet.cols} onClose={() => setPop(null)} />}
      {visible && pop && pop.kind === 'gia' && <PriceSyncModal ds={pop.ds} onClose={() => setPop(null)} />}
      {visible && pop && pop.kind === 'ctx' && (
        <CpCtxMenu at={pop.at} entry={pop.entry} col={pop.col} ids={pop.ids} keys={pop.keys} sortKey={sort.key} act={ctxAct} onClose={() => setPop(null)} />
      )}
      {visible && pop && pop.kind === 'recent' && (
        <RecentPop anchor={pop.anchor} lines={lines} onClose={() => setPop(null)}
          onGo={l => { if (hmNode && !daScope_([l], hmNode).length) setHmNode(''); setQ(''); setFlt(''); flashTo(l.lineId) }}
          onPlus={l => { mutate.updateLine(l.lineId, { soLuong: (Number(l.soLuong) || 0) + 1 }); toast('+1 số lượng: ' + l.ten) }} />
      )}
    </>
  )
}

