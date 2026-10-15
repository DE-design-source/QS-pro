import Icon from '../../../../../components/ui/Icon'
import { money } from '../../../lib/format.js'
import { nodeName } from '../../../lib/tree.js'
import { ctLibDg_, ctDa_, ctProdOf_, ptLoaiNgan_ } from './catalogModel'
import { setF } from './filterStore'

/* Thư viện công tác của đề mục đang bóc (port renderCtLib_ / ctAddToBoc_ / ptLibToggle, PUB/phantho.js:583-610, 1651):
   Thạch cao / Sơn nước / Xây tô / Ốp lát / Cửa có công tác trong CSDL thì hiện trên đầu danh mục.
   Props: secs (ctSecsOfNode_), node, lines (dòng của dự án, để đánh dấu "đã thêm"), col (map nhóm đang gập), onAdd(prod),
          onOpenCt(sec, item, ii) (tuỳ chọn: bấm 1 công tác -> mở panel thông tin công tác, như ptShowDetail_ phantho.js:603),
          activeCt (khoá ctItemKey_ của công tác đang mở, để tô "on") */
const secKey = s => (s.loai || '') + '|' + s.t + '|' + (s.deMuc || '')
export const ctItemKey_ = (sec, ii) => secKey(sec) + '#' + ii

export default function CtLibrary({ secs, node, lines, col, onAdd, onOpenCt, activeCt }) {
  const n = secs.reduce((a, s) => a + s.items.length, 0)
  return (
    <div className="qs-bdc-ctlib">
      <div className="qs-bdc-ctlib-h"><Icon name="layers" size={13} /> Công tác {nodeName(node)}<span>{n}</span></div>
      {secs.map(sec => {
        const k = secKey(sec)
        const closed = !!col[k]
        return (
          <div key={k} className="qs-bdc-ctsec">
            <button className="qs-bdc-ctsec-h" onClick={() => setF(f => ({ ctCol: { ...f.ctCol, [k]: !f.ctCol[k] } }))}>
              <span className="qs-bdc-ctsec-caret">{closed ? '▸' : '▾'}</span>
              <span className="qs-bdc-ctsec-t">{String(sec.t).split('\n')[0]}</span>
              <span className="qs-bdc-ctsec-n">{sec.items.length}</span>
              <span className="qs-bdc-ctsec-lo">{ptLoaiNgan_(sec.loai)}</span>
            </button>
            {!closed && sec.items.map((a, ii) => {
              const dg = ctLibDg_(sec, a)
              const da = ctDa_(lines, node, a)
              const on = activeCt != null && activeCt === ctItemKey_(sec, ii)
              return (
                <div key={ii} className={`qs-bdc-ctit${on ? ' on' : ''}${da ? ' da' : ''}${onOpenCt ? ' qs-bdc-ctit-go' : ''}`}
                  title={onOpenCt ? 'Bấm để xem thông tin công tác' : undefined}
                  onClick={onOpenCt ? () => onOpenCt(sec, a, ii) : undefined}>
                  <div className="qs-bdc-ctit-nm" title={String(a[0]).replace(/\n/g, ' ')}>{String(a[0]).split('\n')[0]}</div>
                  <div className="qs-bdc-ctit-meta">
                    <span className="qs-bdc-ctit-dvt">{a[1] || ''}</span>
                    <span className="qs-bdc-ctit-dg">{dg ? money(dg) + ' đ' : '—'}</span>
                    {da && <span className="qs-bdc-ctit-da" title="Đã có trong bảng bóc tách">✓ đã thêm</span>}
                  </div>
                  <button className="qs-bd-add" title="Thêm vào bảng bóc tách" onClick={e => { e.stopPropagation(); onAdd(ctProdOf_(sec, a)) }}><Icon name="plus" size={14} /></button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
