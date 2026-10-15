import Pop, { PopHead } from './Pop'
import Icon from '../../../../../components/ui/Icon'
import { COLSET, csPresetList_, csPresetKeys_, csPresetOn_, csMyOn_, csDangBat_, csQuickLabel_ } from '../../../lib/columns.js'
import { applyPreset, applyMine, saveMine, clearMine, myCols, colAll } from './tkCols'
import { getState } from '../../../state/store'

const TK = COLSET.tk

/* Nhãn nút "Chọn nhanh" (csQuickBtn_ PUB/app.js:1733-1740): "Của tôi" / tên bộ đang khớp / "Chọn nhanh" */
export function presetLabel(cols) { return csQuickLabel_(TK, cols, myCols()).nhan }

/* Bảng chọn nhanh bộ cột (csPresetPop_ PUB/app.js:1747-1782) */
export function PresetPopover({ anchor, cols, onClose }) {
  const me = getState().me
  const mine = myCols()
  const mineOn = csMyOn_(TK, mine, cols)
  const dem = csDangBat_(TK, cols).length
  const run = fn => () => { fn(); onClose() }
  return (
    <Pop anchor={anchor} width={300} className="qs-tk-preset" onClose={onClose}>
      <PopHead title="Chọn nhanh cột" onClose={onClose} />
      <div className="qs-tk-bgtb">
        {mine && (
          <div className={`qs-tk-bgti tkmine${mineOn ? ' on' : ''}`} onClick={run(applyMine)}>
            <span className="nm"><Icon name="check" size={13} /> Của tôi <i className="qs-tk-mineu">{(me && me.username) || ''}</i></span>
            <span className="cn">{mine.length} cột</span><span className={`rd${mineOn ? ' on' : ''}`} />
          </div>
        )}
        {csPresetList_(TK).map(ps => {
          const on = csPresetOn_(TK, ps, cols)
          return (
            <div key={ps[0]} className={`qs-tk-bgti${on ? ' on' : ''}`} onClick={run(() => applyPreset(ps[0]))}>
              <span className="nm">{ps[1]}</span><span className="cn">{csPresetKeys_(TK, ps).length} cột</span><span className={`rd${on ? ' on' : ''}`} />
            </div>
          )
        })}
      </div>
      <div className="qs-tk-minef">
        <button className="qsc-btn blue" disabled={mineOn} title={mineOn ? 'Bộ cột đang hiện đã là bộ của bạn' : undefined} onClick={run(saveMine)}>
          <Icon name="check" size={13} /> Lưu {dem} cột đang hiện làm mặc định của tôi
        </button>
        {mine && <button className="qsc-btn" onClick={() => { onClose(); clearMine() }}>Xoá bộ của tôi</button>}
        <div className="qs-tk-minen">Lưu theo tài khoản — lần sau đăng nhập (kể cả máy khác) tự hiện đúng các cột này.</div>
      </div>
    </Pop>
  )
}

/* Dải chip cột (renderColChips app.js:1791-1803) + "Hiện tất cả" / "Chỉ cột cơ bản" (tkColAll_ 1836) */
export function ColsStrip({ columns, cols, onToggle }) {
  const on = columns.filter(c => cols[c.key]).length
  return (
    <>
      <span className="qs-bd-strip-label">Cột hiển thị <span className="qs-bd-strip-note">{on}/{columns.length}</span></span>
      {columns.map(c => (
        <button key={c.key} className={`qs-bd-strip-chip${cols[c.key] ? ' on' : ''}`} onClick={() => onToggle(c.key)}>{c.label}</button>
      ))}
      <button className="qs-bd-strip-btn" onClick={() => colAll(1)}>Hiện tất cả</button>
      <button className="qs-bd-strip-btn" onClick={() => colAll(0)}>Chỉ cột cơ bản</button>
    </>
  )
}
