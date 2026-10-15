import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from '../../../../components/ui/Icon'
import ProductThumb from '../common/ProductThumb'
import { ROW_NUM_WIDTH, colLetter as colLetterDefault, roman as romanDefault } from './sheet/tkModel'

const ACT_W = 30
const entryTextDefault = () => ''

/* Kiểu chữ / màu / căn lề đã định dạng của một ô. wrap = "Xuống dòng trong ô" của bản gốc (bảng Bóc tách), nowrap = của clone */
function fmtStyle(f) {
  if (!f) return undefined
  return {
    fontWeight: f.b ? 700 : undefined,
    fontStyle: f.i ? 'italic' : undefined,
    textDecoration: f.u ? 'underline' : undefined,
    color: f.color || undefined,
    backgroundColor: f.bg || undefined,
    textAlign: f.align || undefined,
    ...(f.nowrap ? { whiteSpace: 'nowrap', textOverflow: 'ellipsis' } : null),
    ...(f.wrap ? { whiteSpace: 'pre-wrap', textOverflow: 'clip' } : null),
  }
}

/* Lưới bảng bóc tách. flat: các dòng đang hiện (flattenSheet); cols: các cột đang hiện.
   plain = "Bảng thường": ẩn hàng chữ cái cột và cột số dòng. Toạ độ ô (r, c) là chỉ số trong flat / cols.
   Tuỳ chọn thêm (mọi prop đều không bắt buộc, bảng Chi phí / Dự án không truyền thì giữ nguyên như cũ):
     rowId(r)             khoá của dòng (mặc định r.id; bảng Bóc tách: r.lineId)
     entryText(e, key)    chữ của 1 ô · colLetter(i) chữ cái cột · rowNumWidth
     renderCell(e, col, info) -> node | undefined   vẽ riêng 1 ô (ảnh, tài liệu, nút trong ô...); undefined = mặc định
     onCellContext(r, c, ev)  chuột phải trên ô · onColMenu(key, ev) nút ▾ ở tiêu đề cột · colMarks {key: 'on'}
     rowDrag {canGroup(g), onDrop(src, dst, before)}  kéo ô số dòng để đổi chỗ dòng / tầng
     rowHeights {id: px}, onRowHeight(id, px, done)  kéo mép dưới ô số dòng đổi chiều cao hàng
     frozenRows (n) cố định n hàng sản phẩm đầu · gridClass · emptyNode (khi không có dòng nào)
     datalists {key: [giá trị]} ô sửa dùng input có gợi ý thay vì textarea
     roman(gi) nhãn số La Mã của nhóm
     onColResize(key, w, done) kéo mép phải ô tiêu đề đổi độ rộng cột (w = bề rộng gốc, chưa giãn theo khung)
     onColMove(from, to, before) kéo ô tiêu đề sang trái / phải đổi chỗ cột (cột STT đứng yên)
     rowAction(e) -> node  cột nút cuối mỗi dòng (Bảng thường: nút xoá dòng ở mép phải)
     emptyReplace         không có dòng nào: chỉ hiện emptyNode, bỏ cả tiêu đề cột (khung trống của Bảng tính)
     plainFmt = false     Bảng thường không tô định dạng ô (btFmt chỉ áp ở Bảng tính, btFmtAp_ bangtinh.js:179-188)
   Ở chế độ plain không có cột số dòng: kéo đổi chỗ dòng / tầng bằng ô STT. */
export default function SheetGrid({
  gridRef, flat, cols, plain, frozen, fontSize, compact, zoom, range, anchor, editing, hits, hitKey, dropMark, flashRowId,
  onCellDown, onCellEnter, onCellDouble, onEditChange, onEditKey, onEditBlur,
  onToggleGroup, onSelectRow, onSelectCol, onSelectAll, onKeyDown, onPaste, rowClass, letters = true,
  rowId = r => r.id, entryText = entryTextDefault, colLetter = colLetterDefault, rowNumWidth = ROW_NUM_WIDTH,
  renderCell, onCellContext, onColMenu, colMarks, rowDrag, rowHeights, onRowHeight, frozenRows = 0, gridClass = '', emptyNode = null, datalists = null,
  roman = romanDefault, onColResize, onColMove, rowAction, emptyReplace = false, plainFmt = true,
}) {
  /* Bề rộng khung lưới (px bố cục) để giãn các cột cho vừa khung khi tổng bề rộng cột nhỏ hơn khung */
  const [boxW, setBoxW] = useState(0)
  useEffect(() => {
    const el = gridRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth))
    ro.observe(el)
    setBoxW(el.clientWidth)
    return () => ro.disconnect()
  }, [gridRef])
  const numW = plain ? 0 : rowNumWidth
  const actW = rowAction ? ACT_W : 0
  const baseW = cols.reduce((s, c) => s + c.w, 0)
  const stretch = baseW > 0 ? Math.max(1, (boxW / zoom - numW - actW) / baseW) : 1
  const widths = cols.map(c => c.w * stretch)
  /* Vị trí left của các cột cố định (chỉ khi đang bật đóng băng cột) */
  let left = numW
  const pinLeft = cols.map((c, i) => { const l = left; const pin = frozen && c.pin; if (pin) left += widths[i]; return pin ? l : null })
  const lastPin = pinLeft.reduce((last, l, i) => (l === null ? last : i), -1)
  const pinStyle = i => (pinLeft[i] === null ? undefined : { left: pinLeft[i] })
  const pinClass = i => (pinLeft[i] === null ? '' : ` pin${i === lastPin ? ' pin-last' : ''}`)
  const inRange = (r, c) => r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1
  const multi = range.r0 !== range.r1 || range.c0 !== range.c1
  /* Tên nhóm đặt ở cột Phòng (hoặc Tên sản phẩm nếu Phòng đang ẩn) */
  const roomCol = cols.findIndex(c => c.key === 'room' || c.key === 'khuVuc')
  const nameCol = roomCol >= 0 ? roomCol : cols.findIndex(c => c.key === 'name' || c.key === 'ten')

  /* ---- Kéo ô số dòng để đổi chỗ dòng / tầng ---- */
  const dragRef = useRef(null)
  const [rowDrop, setRowDrop] = useState(null)
  const endRowDrag = () => { dragRef.current = null; setRowDrop(null) }
  const tgtOf = (e, isGroup, isItem) => (isGroup ? { kind: 'group', id: e.g.id, g: e.g } : isItem ? { kind: 'item', id: rowId(e.r), g: e.g } : null)
  const dragProps = (e, isGroup, isItem, id) => ({
    draggable: true,
    onDragStart: ev => {
      dragRef.current = tgtOf(e, isGroup, isItem)
      try { ev.dataTransfer.setData('text/plain', 'qs-row:' + (isItem ? id : e.g.id)); ev.dataTransfer.effectAllowed = 'move' } catch (x) { /* bỏ qua */ }
    },
    onDragEnd: endRowDrag,
  })

  /* ---- Cột: kéo mép phải đổi độ rộng (btKeoCot_ bangtinh.js:117-160), kéo ô tiêu đề đổi chỗ (btKeoDoiCot_ 262-286) ---- */
  const [colDrop, setColDrop] = useState(null)
  function startColResize(ev, key, i) {
    if (!onColResize || ev.button !== 0) return
    ev.preventDefault(); ev.stopPropagation()
    const th = ev.currentTarget.closest('th')
    const scale = (th.getBoundingClientRect().width / (th.offsetWidth || 1)) || 1
    const x0 = ev.clientX
    const w0 = th.offsetWidth
    const st = stretch
    let w = cols[i].w
    const mv = e2 => { w = Math.max(40, Math.round(Math.max(40, w0 + (e2.clientX - x0) / scale) / st)); onColResize(key, w, false) }
    const up = () => { document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true); onColResize(key, w, true) }
    document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true)
  }
  function startColMove(ev, key) {
    if (!onColMove || ev.button !== 0 || key === 'stt') return
    const x0 = ev.clientX
    let keo = false
    let dich = null
    const mv = e2 => {
      if (!keo) { if (Math.abs(e2.clientX - x0) < 6) return; keo = true }
      const el = document.elementFromPoint(e2.clientX, e2.clientY)
      const th = el && el.closest ? el.closest('th[data-ck]') : null
      dich = null
      if (th && gridRef.current && gridRef.current.contains(th) && th.dataset.ck !== key && th.dataset.ck !== 'stt') {
        const r = th.getBoundingClientRect()
        dich = { key: th.dataset.ck, before: e2.clientX - r.left < r.width / 2 }
      }
      setColDrop({ from: key, key: dich ? dich.key : '', before: dich ? dich.before : false })
    }
    const up = () => {
      document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true)
      setColDrop(null)
      if (keo && dich) onColMove(key, dich.key, dich.before)
    }
    document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true)
  }
  const colDropCls = k => (!colDrop ? '' : k === colDrop.from ? ' qs-tk-cotkeo' : k === colDrop.key ? (colDrop.before ? ' qs-tk-cotl' : ' qs-tk-cotr') : '')
  const rsz = (key, i) => onColResize && <span className="qs-tk-thrsz" title="Kéo để đổi độ rộng cột" onMouseDown={ev => startColResize(ev, key, i)} />

  /* ---- Cố định N hàng sản phẩm đầu (như Excel): dính dưới hàng tiêu đề ---- */
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    el.querySelectorAll('tr.qs-tk-frzrow').forEach(tr => {
      tr.classList.remove('qs-tk-frzrow')
      tr.querySelectorAll('td').forEach(td => { td.style.top = ''; td.style.zIndex = ''; if (td.dataset.frz) { td.style.position = ''; delete td.dataset.frz } })
    })
    const n = Math.min(Number(frozenRows) || 0, 12)
    if (!n) return
    const head = el.querySelector('thead')
    let off = head ? head.offsetHeight : 0
    const rows = el.querySelectorAll('tbody tr.qs-bd-row[data-row]')
    for (let i = 0; i < n && i < rows.length; i++) {
      const tr = rows[i]
      tr.classList.add('qs-tk-frzrow')
      tr.querySelectorAll('td').forEach(td => {
        if (!td.classList.contains('pin')) { td.style.position = 'sticky'; td.dataset.frz = '1' }
        td.style.top = off + 'px'; td.style.zIndex = td.classList.contains('pin') ? '4' : '3'
      })
      off += tr.offsetHeight
    }
  })

  function startRowResize(ev, id) {
    if (!onRowHeight) return
    ev.preventDefault(); ev.stopPropagation()
    const tr = ev.currentTarget.closest('tr')
    const y0 = ev.clientY
    const z = (tr.getBoundingClientRect().height / (tr.offsetHeight || 1)) || 1
    const h0 = tr.offsetHeight
    let h = h0
    const mv = e2 => { h = Math.max(24, Math.round(h0 + (e2.clientY - y0) / z)); onRowHeight(id, h, false) }
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); onRowHeight(id, h, true) }
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up)
  }

  return (
    <div
      ref={gridRef}
      className={`qs-bd-grid${compact ? ' compact' : ''}${plain || !letters ? ' plain' : ''}${gridClass ? ' ' + gridClass : ''}`}
      /* Cỡ chữ riêng của bảng nhân thêm hệ số cỡ chữ chung (Cài đặt ▸ Giao diện ▸ Cỡ chữ) */
      style={{ fontSize: `calc(${fontSize}px * var(--fs, 1))` }}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    >
      {!(emptyReplace && !flat.length && emptyNode) && <table style={{ width: numW + baseW * stretch + actW, minWidth: zoom === 1 ? '100%' : undefined, zoom: zoom === 1 ? undefined : zoom }}>
        <colgroup>
          {!plain && <col style={{ width: rowNumWidth }} />}
          {cols.map((c, i) => <col key={c.key} style={{ width: widths[i] }} />)}
          {rowAction && <col style={{ width: actW }} />}
        </colgroup>
        <thead>
          {!plain && letters && (
            <tr className="qs-bd-letters">
              <th className="pin corner" style={{ left: 0 }} title="Chọn tất cả" onMouseDown={onSelectAll} />
              {cols.map((c, i) => (
                <th key={c.key} className={`${pinClass(i)}${i >= range.c0 && i <= range.c1 ? ' on' : ''}`} style={pinStyle(i)} onMouseDown={e => onSelectCol(i, e)}>{colLetter(i)}{rsz(c.key, i)}</th>
              ))}
              {rowAction && <th className="qs-tk-actth" />}
            </tr>
          )}
          <tr className="qs-bd-labels">
            {!plain && <th className="pin" style={{ left: 0 }} />}
            {cols.map((c, i) => (
              <th key={c.key} data-ck={c.key} className={`${pinClass(i)}${colMarks && colMarks[c.key] ? ' qs-tk-thon' : ''}${colDropCls(c.key)}`} style={pinStyle(i)}
                onMouseDown={e => { onSelectCol(i, e); startColMove(e, c.key) }}>
                {c.label}
                {onColMenu && (
                  <span className="qs-tk-thmenu" title="Lọc / sắp xếp cột" onMouseDown={ev => ev.stopPropagation()} onClick={ev => onColMenu(c.key, ev)}>▾</span>
                )}
                {rsz(c.key, i)}
              </th>
            ))}
            {rowAction && <th className="qs-tk-actth" />}
          </tr>
        </thead>
        <tbody>
          {flat.map((e, r) => {
            const isGroup = e.type === 'group'
            const isItem = e.type === 'item'
            const id = isItem ? rowId(e.r) : null
            const rowKey = isGroup ? `g:${e.g.id}` : isItem ? id : 'total'
            const canDrag = !!rowDrag && (isItem || (isGroup && (!rowDrag.canGroup || rowDrag.canGroup(e.g))))
            const rd = rowDrop && rowDrop.key === rowKey ? ` drop-${rowDrop.pos}` : ''
            const h = isItem && rowHeights ? rowHeights[id] : null
            return (
              <tr
                key={isItem ? id : e.g.id}
                data-group={e.g.id}
                data-row={isItem ? id : undefined}
                style={h ? { height: h } : undefined}
                className={`${isGroup ? 'qs-bd-group' : isItem ? 'qs-bd-row' : 'qs-bd-row qs-bd-total'}${dropMark && dropMark.key === rowKey ? ` drop-${dropMark.pos}` : ''}${rd}${isItem && id === flashRowId ? ' flash' : ''}${rowClass ? rowClass(e) : ''}`}
                onDragOver={rowDrag ? ev => {
                  if (!dragRef.current) return
                  ev.preventDefault(); ev.stopPropagation()
                  const box = ev.currentTarget.getBoundingClientRect()
                  const pos = isItem && ev.clientY > box.top + box.height / 2 ? 'after' : 'before'
                  if (!rowDrop || rowDrop.key !== rowKey || rowDrop.pos !== pos) setRowDrop({ key: rowKey, pos })
                } : undefined}
                onDrop={rowDrag ? ev => {
                  const src = dragRef.current
                  if (!src) return
                  ev.preventDefault(); ev.stopPropagation()
                  const box = ev.currentTarget.getBoundingClientRect()
                  const before = !isItem || ev.clientY < box.top + box.height / 2
                  endRowDrag()
                  const dst = tgtOf(e, isGroup, isItem)
                  if (dst) rowDrag.onDrop(src, dst, before)
                } : undefined}
              >
                {!plain && (
                  <td
                    className={`qs-bd-rownum pin${r >= range.r0 && r <= range.r1 ? ' on' : ''}${canDrag ? ' qs-tk-drag' : ''}`}
                    style={{ left: 0 }}
                    {...(canDrag ? dragProps(e, isGroup, isItem, id) : null)}
                    title={canDrag ? (isItem ? 'Kéo để đổi chỗ dòng · bấm để chọn cả dòng' : 'Kéo để đổi thứ tự tầng / phòng') : undefined}
                    onMouseDown={ev => onSelectRow(r, ev)}
                  >
                    {e.n}
                    {isItem && onRowHeight && <span className="qs-tk-rgrip" title="Kéo để đổi chiều cao hàng" onMouseDown={ev => startRowResize(ev, id)} />}
                  </td>
                )}
                {cols.map((c, i) => {
                  const selected = inRange(r, i)
                  const isAnchor = anchor.r === r && anchor.c === i
                  const isEditing = editing && !editing.bar && editing.r === r && editing.c === i
                  const key = `${r}:${i}`
                  const cls = `c-${c.key}${c.align ? ` a-${c.align}` : ''}${pinClass(i)}${selected && multi ? ' in-range' : ''}${isAnchor ? ' anchor' : ''}${hits.has(key) ? (key === hitKey ? ' hit cur' : ' hit') : ''}${isGroup && i === nameCol ? ' qs-bd-group-name' : ''}`
                  const live = editing && editing.bar && editing.r === r && editing.c === i ? editing.value : null
                  let content
                  const custom = !isEditing && renderCell ? renderCell(e, c, { r, i, isAnchor, live }) : undefined
                  const dl = isEditing && datalists && datalists[c.key]
                  if (dl) {
                    /* Ô có danh sách gợi ý (Phòng: datalist #phongList của bản gốc, PUB/index.html:6810-6817) */
                    content = (
                      <input
                        className="qs-bd-editor"
                        autoFocus
                        list={'qs-tk-dl-' + c.key}
                        value={editing.value}
                        onChange={ev => onEditChange(ev.target.value)}
                        onKeyDown={onEditKey}
                        onBlur={onEditBlur}
                        onMouseDown={ev => ev.stopPropagation()}
                      />
                    )
                  } else if (isEditing) {
                    content = (
                      <textarea
                        className="qs-bd-editor"
                        autoFocus
                        rows={Math.max(1, editing.value.split('\n').length)}
                        value={editing.value}
                        onChange={ev => onEditChange(ev.target.value)}
                        onKeyDown={onEditKey}
                        onBlur={onEditBlur}
                        onMouseDown={ev => ev.stopPropagation()}
                        onFocus={ev => { const n = ev.target.value.length; ev.target.setSelectionRange(n, n) }}
                      />
                    )
                  } else if (custom !== undefined) content = custom
                  else if (isGroup) {
                    content = c.key === 'stt'
                      ? (
                        <button className="qs-bd-group-toggle" onMouseDown={ev => ev.stopPropagation()} onClick={() => onToggleGroup(e.g.id)}>
                          <span className={`qs-bd-tri${e.g.collapsed ? ' closed' : ''}`} />{roman(e.gi)}
                        </button>
                      )
                      : i === nameCol ? (live ?? e.g.name) : (e.cells && e.cells[c.key]) || null
                  } else if (!isItem) content = entryText(e, c.key)
                  else if (c.key === 'image') content = e.r.tone && <ProductThumb product={{ ten: e.r.name }} size={62} />
                  else if (c.key === 'docs') content = e.r.docs > 0 && <span className="qs-bd-doc"><Icon name="fileText" size={13} />{e.r.docs}</span>
                  else content = live ?? entryText(e, c.key)
                  const plainDrag = plain && canDrag && c.key === 'stt'
                  return (
                    <td
                      key={c.key}
                      data-r={r}
                      data-c={i}
                      {...(plainDrag ? dragProps(e, isGroup, isItem, id) : null)}
                      className={cls + (plainDrag ? ' qs-tk-drag' : '')}
                      style={{ ...pinStyle(i), ...(isItem && (plainFmt || !plain) ? fmtStyle(e.r.fmt && e.r.fmt[c.key]) : null) }}
                      onMouseDown={ev => onCellDown(r, i, ev)}
                      onMouseEnter={ev => onCellEnter(r, i, ev)}
                      onDoubleClick={() => onCellDouble(r, i)}
                      onContextMenu={onCellContext ? ev => onCellContext(r, i, ev) : undefined}
                    >
                      {content}
                    </td>
                  )
                })}
                {rowAction && <td className="qs-tk-actcell">{isItem ? rowAction(e) : null}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>}
      {!flat.length && emptyNode}
      {datalists && Object.keys(datalists).map(k => <datalist key={k} id={'qs-tk-dl-' + k}>{datalists[k].map(v => <option key={v} value={v} />)}</datalist>)}
    </div>
  )
}
