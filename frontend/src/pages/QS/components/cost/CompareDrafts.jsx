import { useEffect, useRef, useState } from 'react'
import Icon from '../../../../components/ui/Icon'
import { MrootPortal } from '../common/Mroot'
import * as api from '../../api/qsApi'
import { isAbort } from '../../api/http'
import { money } from '../../lib/format.js'
import { cpSoSanh_ } from '../../lib/totals.js'
import { draftName_ } from '../../lib/dashModel.js'

const Signed = ({ v }) => { v = Math.round(Number(v) || 0); return <span className={v < 0 ? 'qs-cp-neg' : (v > 0 ? 'qs-cp-pos' : '')}>{money(v)}</span> }

/* Hộp "So sánh bản nháp" (port cpSoSanh_ PUB/chiphi.js:483-513): tải dòng của từng bản nháp trong nhóm (bản đang mở dùng
   dòng đang có), tổng vốn / bán / lợi nhuận / biên / tổng gồm VAT của bản nháp; tô xanh tổng thấp nhất và biên cao nhất.
   Props: group ({name, drafts}), curMa, curLines, onOpen(maDA), onClose() */
export default function CompareDrafts({ group, curMa, curLines, onOpen, onClose }) {
  const [data, setData] = useState(null)
  const ovRef = useRef(null)

  useEffect(() => {
    const ctl = new AbortController()
    Promise.all(group.drafts.map(d => (d.maDA === curMa ? Promise.resolve(curLines)
      : api.getLines(d.maDA, ctl.signal).catch(e => { if (isAbort(e)) throw e; return null }))))
      .then(ds => setData(cpSoSanh_(group.drafts, ds)))
      .catch(e => { if (!isAbort(e)) setData({ err: String((e && e.message) || e) }) })
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const key = e => {
      if (e.key !== 'Escape') return
      const all = document.querySelectorAll('.qsc-ov, .qs-modal-backdrop')
      if (all[all.length - 1] === ovRef.current) onClose()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <MrootPortal>
      <div ref={ovRef} className="qsc-ov" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="qsc-dlg qs-cp-cmp" role="dialog" aria-modal="true">
          <div className="qs-cp-cmp-h">
            <h3><Icon name="layers" size={16} />So sánh bản nháp — {group.name}</h3>
            <button type="button" className="qsc-x" onClick={onClose}>✕</button>
          </div>
          <div className="qs-cp-cmp-b">
            {!data && <div className="qs-cp-cmp-empty">Đang tải các bản nháp…</div>}
            {data && data.err && <div className="qs-cp-cmp-empty qs-cp-neg">Không tải được: {data.err}</div>}
            {data && data.rows && (
              <>
                <table className="qs-cp-cmp-t">
                  <thead>
                    <tr><th>Bản nháp</th><th className="num">Số dòng</th><th className="num">Giá vốn</th><th className="num">Giá bán</th>
                      <th className="num">Lợi nhuận</th><th className="num">Biên</th><th className="num">Tổng gồm VAT</th><th /></tr>
                  </thead>
                  <tbody>
                    {data.rows.map(r => {
                      const cur = r.d.maDA === curMa
                      if (r.loi) return <tr key={r.d.maDA}><td>{draftName_(r.d, r.i)}</td><td colSpan={7} className="muted">Không tải được bản nháp này</td></tr>
                      return (
                        <tr key={r.d.maDA} className={cur ? 'on' : ''}>
                          <td><b>{draftName_(r.d, r.i)}</b>{cur && <span className="qs-cp-cmp-cur">đang mở</span>}</td>
                          <td className="num">{r.t.n}</td><td className="num">{money(r.t.von)}</td><td className="num">{money(r.t.ban)}</td>
                          <td className="num"><Signed v={r.t.ln} /></td>
                          <td className={`num${data.nhieu && r.bien === data.maxB ? ' best' : ''}`}>{r.bien.toFixed(1)}%</td>
                          <td className={`num${data.nhieu && r.tong === data.minT ? ' best' : ''}`}><b>{money(r.tong)}</b></td>
                          <td>{!cur && <button type="button" className="qs-qt-btn" onClick={() => { onClose(); onOpen(r.d.maDA) }}>Mở</button>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="qs-cp-cmp-note">Tô xanh: tổng thấp nhất và biên cao nhất giữa các bản nháp.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </MrootPortal>
  )
}
