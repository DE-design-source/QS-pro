import { useRef, useState } from 'react'
import Pop from './Pop'
import Icon from '../../../../../components/ui/Icon'
import { MrootPortal } from '../../common/Mroot'
import { COLS, TK_RO_COL, TK_LN_QUICK } from '../../../lib/columns.js'
import { ttBan_ } from '../../../lib/calc.js'
import { money, pctIn_ } from '../../../lib/format.js'
import { qsToast as toast } from '../../common/dialogs'

const FIELDS = COLS.filter(c => !TK_RO_COL[c[0]]).map(c => [c[0], c[1]]).concat([['tang', 'Tầng / khu vực']])

/* Thanh thao tác hàng loạt (tkSelBar_ PUB/boc.js:1000-1017) + các bảng nổi: Chuyển tầng (1037-1048), Lợi nhuận (1050-1065),
   Sửa hàng loạt (1066-1092), "⋯" (1093-1107: sheet Nhân công / Vật tư, sao chép, nhân bản, chọn tất cả, xoá).
   Hiện khi vùng chọn có từ 2 dòng sản phẩm trở lên. Props: lines (dòng đã chọn), floors, sheetCo, act, onClear */
export default function BulkBar({ lines, floors, sheetCo, act, onClear }) {
  const [pop, setPop] = useState(null)
  const [lnVal, setLnVal] = useState('')
  const [field, setField] = useState(FIELDS[0][0])
  const [val, setVal] = useState('')
  const refs = { floor: useRef(null), ln: useRef(null), edit: useRef(null), more: useRef(null) }
  const n = lines.length
  const tien = lines.reduce((s, l) => s + ttBan_(l), 0)
  const open = k => setPop(p => (p === k ? null : k))
  const close = () => setPop(null)
  const ids = lines.map(l => l.lineId)
  function lnRun(v) {
    v = pctIn_(v)
    if (v == null) { toast('Chưa nhập % lợi nhuận'); return }
    close(); act.applyFields(ids.map(id => ({ id, fields: { lnPct: v } })), 'Đã đặt lợi nhuận ' + v + '%')
  }
  function editRun() {
    const nhan = (FIELDS.filter(f => f[0] === field)[0] || [field, field])[1]
    if (String(val).trim() === '' && field !== 'ghiChu' && field !== 'tang') { toast('Chưa nhập giá trị mới'); return }
    close(); act.bulkEdit(lines, field, val, nhan)
  }
  return (
    <MrootPortal>
      <div className="qs-tk-bbar">
        <div className="qs-tk-bbcount"><b>{n}</b><span>dòng đã chọn · {money(tien)} đ</span>
          <button className="qs-tk-bbx" title="Bỏ chọn (Esc)" onClick={onClear}>✕</button></div>
        <div className="qs-tk-bbsep" />
        <button ref={refs.floor} className="qs-tk-bbb" title="Chuyển các dòng đã chọn sang tầng khác" onClick={() => open('floor')}><Icon name="layers" size={15} /> Chuyển tầng <i>▾</i></button>
        <button ref={refs.ln} className="qs-tk-bbb" title="Đặt nhanh % lợi nhuận" onClick={() => open('ln')}><Icon name="gauge" size={15} /> Lợi nhuận <i>▾</i></button>
        <button ref={refs.edit} className="qs-tk-bbb" title="Đổi một cột cho mọi dòng đã chọn" onClick={() => open('edit')}><Icon name="edit" size={15} /> Sửa hàng loạt <i>▾</i></button>
        <div className="qs-tk-bbsep" />
        <button ref={refs.more} className="qs-tk-bbic" title="Thao tác khác" onClick={() => open('more')}>⋯</button>
      </div>
      {pop === 'floor' && (
        <Pop anchor={refs.floor.current} place="above" width={280} onClose={close} keepOpenOn=".qs-tk-bbar">
          <div className="qs-tk-bph">Chuyển sang tầng <span>{n} dòng</span></div>
          <div className="qs-tk-bmenu scroll">
            {floors.length ? floors.map(f => <button key={f} onClick={() => { close(); act.applyFields(ids.map(id => ({ id, fields: { tang: f } })), 'Đã chuyển sang ' + f) }}><Icon name="layers" size={15} />{f}</button>)
              : <div className="qs-tk-bnote">Chưa có tầng nào. Bấm “＋ Thêm tầng” ở cuối bảng.</div>}
            <div className="qs-tk-bmsep" />
            <button onClick={() => { close(); act.applyFields(ids.map(id => ({ id, fields: { tang: '' } })), 'Đã bỏ tầng') }}><Icon name="x" size={15} />Bỏ tầng (chưa phân tầng)</button>
          </div>
        </Pop>
      )}
      {pop === 'ln' && (
        <Pop anchor={refs.ln.current} place="above" width={280} onClose={close} keepOpenOn=".qs-tk-bbar">
          <div className="qs-tk-bph">Đặt nhanh lợi nhuận <span>{n} dòng</span></div>
          <div className="qs-tk-bpb">
            <label>% lợi nhuận trên giá vốn</label>
            <div className="qs-tk-lnq">{TK_LN_QUICK.map(v => <button key={v} onClick={() => lnRun(v)}>{v}%</button>)}</div>
            <label>Hoặc nhập % khác</label>
            <input type="number" step="any" placeholder="VD: 27" value={lnVal} onChange={e => setLnVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lnRun(lnVal) }} />
          </div>
          <div className="qs-tk-bpf"><button className="qsc-btn" onClick={close}>Huỷ</button><button className="qsc-btn blue" onClick={() => lnRun(lnVal)}><Icon name="check" size={14} /> Áp dụng</button></div>
        </Pop>
      )}
      {pop === 'edit' && (
        <Pop anchor={refs.edit.current} place="above" width={280} onClose={close} keepOpenOn=".qs-tk-bbar">
          <div className="qs-tk-bph">Sửa hàng loạt <span>{n} dòng</span></div>
          <div className="qs-tk-bpb">
            <label>Cột cần đổi</label>
            <select value={field} onChange={e => setField(e.target.value)}>{FIELDS.map(f => <option key={f[0]} value={f[0]}>{f[1]}</option>)}</select>
            <label>Giá trị mới</label>
            <input autoFocus placeholder="Nhập giá trị…" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') editRun() }} />
          </div>
          <div className="qs-tk-bpf"><button className="qsc-btn" onClick={close}>Huỷ</button><button className="qsc-btn blue" onClick={editRun}><Icon name="check" size={14} /> Áp dụng</button></div>
        </Pop>
      )}
      {pop === 'more' && (
        <Pop anchor={refs.more.current} place="above" width={290} onClose={close} keepOpenOn=".qs-tk-bbar">
          <div className="qs-tk-bmenu">
            {sheetCo && (
              <>
                <button onClick={() => { close(); act.bulkSheet(ids, 'nc') }}><Icon name="layers" size={15} /> Đưa vào sheet Nhân công</button>
                <button onClick={() => { close(); act.bulkSheet(ids, 'vt') }}><Icon name="layers" size={15} /> Đưa vào sheet Vật tư</button>
                <button onClick={() => { close(); act.bulkSheet(ids, '') }}><Icon name="x" size={15} /> Bỏ khỏi sheet (để chung)</button>
                <div className="qs-tk-bmsep" />
              </>
            )}
            <button onClick={() => { close(); act.bulkCopy(lines) }}><Icon name="copy" size={15} /> Sao chép {n} dòng (dán được vào Excel)</button>
            <button onClick={() => { close(); act.dupRows(ids) }}><Icon name="plus" size={15} /> Nhân bản {n} dòng</button>
            <button onClick={() => { close(); act.selectAll() }}><Icon name="list" size={15} /> Chọn tất cả dòng đang hiện</button>
            <div className="qs-tk-bmsep" />
            <button className="danger" onClick={() => { close(); act.delRows(ids) }}><Icon name="trash" size={15} /> Xoá {n} dòng</button>
          </div>
        </Pop>
      )}
    </MrootPortal>
  )
}
