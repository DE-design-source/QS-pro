import Icon from '../../../../components/ui/Icon'
import Pop, { PopHead } from '../breakdown/sheet/Pop'
import { COLSET, csPresetList_, csPresetKeys_, csPresetOn_, csMyOn_, csDangBat_, csQuickLabel_, cpLabel_ } from '../../lib/columns.js'
import { getState } from '../../state/store'
import { applyPreset, applyMine, saveMine, clearMine, myCols, colAll, toggleCol } from './cpCols'

/* Hàng "Cột hiển thị" của Chi phí / Dự án (pgColFrame_ PUB/chiphi.js:50-60, cpColBar_ / daColBar_ dash.js:235-248):
   nút gập chip cột (qs_fold.cols) · nút "Chọn nhanh" (csQuickBtn_ app.js:1733-1740) · Hiện tất cả · Cột cơ bản,
   rồi hàng chip bật / tắt từng cột khi không gập.
   Props: t ('cp' | 'da'), cols (map cột đang bật), foldCols (bool), onFoldCols(), presetOpen, onPreset(ev) */
export function ColFrame({ t, cols, foldCols, onFoldCols, presetOpen, onPreset }) {
  const tab = COLSET[t]
  const q = csQuickLabel_(tab, cols, myCols(t))
  return (
    <>
      <button className={`qs-bd-cols-label${foldCols ? '' : ' on'}`} title="Ẩn / hiện các chip cột" onClick={onFoldCols}>
        Cột hiển thị <span>{q.on}/{q.total}</span><Icon name={foldCols ? 'chevronDown' : 'chevronUp'} size={15} />
      </button>
      <button className={`qs-bd-preset${presetOpen ? ' on' : ''}`} title="Bật cả một bộ cột theo mục đích / bộ cột của tôi" onClick={onPreset}>
        <Icon name="sliders" size={13} />{q.nhan} {q.on}/{q.total}<span className="qs-bd-caret" />
      </button>
      <button className="qs-cp-q" onClick={() => colAll(t, 1)}>Hiện tất cả</button>
      <button className="qs-cp-q" onClick={() => colAll(t, 0)}>Cột cơ bản</button>
    </>
  )
}

/* Hàng chip cột (colchips) */
export function ColChips({ t, cols }) {
  return (
    <div className="qs-cp-colchips">
      {COLSET[t].keys().map(k => (
        <button key={k} className={`qs-bd-strip-chip${cols[k] ? ' on' : ''}`} onClick={() => toggleCol(t, k)}>{cpLabel_(k)}</button>
      ))}
    </div>
  )
}

/* Bảng chọn nhanh bộ cột (csPresetPop_ PUB/app.js:1747-1782) cho bảng t */
export function PresetPop({ t, anchor, cols, onClose }) {
  const tab = COLSET[t]
  const me = getState().me
  const mine = myCols(t)
  const mineOn = csMyOn_(tab, mine, cols)
  const dem = csDangBat_(tab, cols).length
  const run = fn => () => { fn(); onClose() }
  return (
    <Pop anchor={anchor} width={300} className="qs-tk-preset" onClose={onClose}>
      <PopHead title="Chọn nhanh cột" onClose={onClose} />
      <div className="qs-tk-bgtb">
        {mine && (
          <div className={`qs-tk-bgti tkmine${mineOn ? ' on' : ''}`} onClick={run(() => applyMine(t))}>
            <span className="nm"><Icon name="check" size={13} /> Của tôi <i className="qs-tk-mineu">{(me && me.username) || ''}</i></span>
            <span className="cn">{mine.length} cột</span><span className={`rd${mineOn ? ' on' : ''}`} />
          </div>
        )}
        {csPresetList_(tab).map(ps => {
          const on = csPresetOn_(tab, ps, cols)
          return (
            <div key={ps[0]} className={`qs-tk-bgti${on ? ' on' : ''}`} onClick={run(() => applyPreset(t, ps[0], ps[1]))}>
              <span className="nm">{ps[1]}</span><span className="cn">{csPresetKeys_(tab, ps).length} cột</span><span className={`rd${on ? ' on' : ''}`} />
            </div>
          )
        })}
      </div>
      <div className="qs-tk-minef">
        <button className="qsc-btn blue" disabled={mineOn} title={mineOn ? 'Bộ cột đang hiện đã là bộ của bạn' : undefined} onClick={run(() => saveMine(t))}>
          <Icon name="check" size={13} /> Lưu {dem} cột đang hiện làm mặc định của tôi
        </button>
        {mine && <button className="qsc-btn" onClick={() => { onClose(); clearMine(t) }}>Xoá bộ của tôi</button>}
        <div className="qs-tk-minen">Lưu theo tài khoản — lần sau đăng nhập (kể cả máy khác) tự hiện đúng các cột này.</div>
      </div>
    </Pop>
  )
}
