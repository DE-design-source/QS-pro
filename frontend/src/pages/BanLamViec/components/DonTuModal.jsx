import { useEffect, useState } from 'react'
import { DONTU_CONFIG, APPROVER_SUGGESTIONS, ROLE_SUGGESTIONS, ME, shortDate } from '../../../data/banLamViecData'
import Icon from '../../../components/ui/Icon'

const MAX_APPROVERS = 6
const NOW_LABEL = '23/09/2026 · ' + new Date().toTimeString().slice(0, 5)

const fullDate = v => (v ? v.split('-').reverse().join('/') : '')
const fmtMoney = v => {
  const n = String(v).replace(/\D/g, '')
  return n ? Number(n).toLocaleString('vi-VN') : ''
}

/* Giá trị mặc định của các ô theo cấu hình loại đơn */
function defaultsFor(cfg) {
  const v = {}
  cfg.fields.forEach(f => { v[f.k] = f.def ?? (f.type === 'select' ? f.options[0] : '') })
  return v
}

/* Modal tạo đơn — form sinh theo DONTU_CONFIG[type].fields + thiết lập luồng duyệt nhiều cấp */
export default function DonTuModal({ open, type, onClose, onSubmit }) {
  const cfg = type ? DONTU_CONFIG[type] : null
  const [values, setValues] = useState({})
  const [reason, setReason] = useState('')
  const [approvers, setApprovers] = useState([])
  const [error, setError] = useState('')

  // Mỗi lần mở (hoặc đổi loại đơn) → nạp giá trị & luồng duyệt mặc định của loại đơn đó
  useEffect(() => {
    if (!open || !cfg) return
    setValues(defaultsFor(cfg))
    setReason('')
    setApprovers(cfg.approvers.map(a => ({ ...a })))
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const setVal = (k, v) => setValues(p => ({ ...p, [k]: v }))
  const setApprover = (i, patch) => setApprovers(list => list.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const moveApprover = (i, d) => setApprovers(list => {
    const next = [...list]
    const j = i + d
    if (j < 0 || j >= next.length) return list
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  function submit() {
    if (!cfg) return
    if (!reason.trim()) { setError('Vui lòng nhập ' + cfg.reasonLabel.toLowerCase() + '.'); return }
    const chain = approvers.filter(a => a.name.trim())
    if (!chain.length) { setError('Cần ít nhất 1 người duyệt.'); return }

    const fields = []
    cfg.fields.forEach(f => {
      const v = values[f.k]
      if (!v) return
      const label = f.label.replace(/\s*\(đ\)$/, '')
      fields.push([label, f.type === 'date' ? fullDate(v) : f.type === 'amount' ? fmtMoney(v) + 'đ' : v])
    })

    let title = cfg.title
    if (values.kind && type !== 'capphat') title += ' (' + values.kind + ')'
    const extra = values.item || values.place || values.payee
    if (values.from && values.to) title += ' — ' + shortDate(values.from) + (values.to !== values.from ? ' đến ' + shortDate(values.to) : '')
    else if (values.amount) title += ' — ' + fmtMoney(values.amount) + 'đ'
    else if (extra) title += ' — ' + extra
    else if (values.kind) title = cfg.title + ' — ' + values.kind
    else if (values.from) title += ' — ' + shortDate(values.from)

    onSubmit({
      type,
      title,
      createdAt: NOW_LABEL,
      fields,
      reason: reason.trim(),
      approvers: chain.map((a, i) => ({ name: a.name.trim(), role: a.role.trim() || 'Người duyệt ' + (i + 1), state: i === 0 ? 'active' : 'waiting' })),
    })
    onClose()
  }

  return (
    <div className={`blv-modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="blv-modal-box wide" role="dialog" aria-modal="true">
        {cfg && (
          <>
            <div className={`blv-modal-head tone-${cfg.color}`}>
              <span className="blv-ico"><Icon name={cfg.icon} size={16} stroke={1.9} /></span>
              <div className="blv-row-main">
                <h3>Tạo đơn — {cfg.title}</h3>
                <div className="blv-w-sub">{cfg.desc}</div>
              </div>
              <button className="blv-icon-btn" aria-label="Đóng" onClick={onClose}><Icon name="x" size={16} /></button>
            </div>

            <div className="blv-modal-fields">
              {cfg.fields.map(f => (
                <div key={f.k} className={`blv-modal-field${f.type === 'text' ? ' full' : ''}`}>
                  <label>{f.label}</label>
                  {f.type === 'select'
                    ? <select value={values[f.k] || ''} onChange={e => setVal(f.k, e.target.value)}>{f.options.map(o => <option key={o}>{o}</option>)}</select>
                    : <input
                        type={f.type === 'amount' || f.type === 'text' ? 'text' : f.type}
                        inputMode={f.type === 'amount' ? 'numeric' : undefined}
                        placeholder={f.placeholder || (f.type === 'amount' ? 'VD: 3.000.000' : '')}
                        value={f.type === 'amount' ? fmtMoney(values[f.k] || '') : (values[f.k] || '')}
                        onChange={e => setVal(f.k, f.type === 'amount' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                      />}
                </div>
              ))}
              <div className="blv-modal-field full">
                <label>{cfg.reasonLabel}</label>
                <textarea rows={3} placeholder="Nhập nội dung..." value={reason} onChange={e => { setReason(e.target.value); setError('') }} />
              </div>
            </div>

            <div className="blv-modal-field" style={{ marginBottom: 6 }}>
              <label>Luồng phê duyệt <span style={{ fontWeight: 400 }}>— đơn được chuyển lần lượt theo thứ tự</span></label>
              <ol className="blv-chain">
                <li className="blv-chain-step me">
                  <span className="blv-chain-dot"><Icon name="send" size={11} stroke={2.4} /></span>
                  <div className="blv-chain-me"><b>{ME.name}</b><span>Tạo đơn</span></div>
                </li>
                {approvers.map((a, i) => (
                  <li key={i} className="blv-chain-step">
                    <span className="blv-chain-dot">{i + 1}</span>
                    <div className="blv-approver-step">
                      <input className="blv-approver-input" list="blvApproverSuggestions" placeholder={`Người duyệt ${i + 1}`} value={a.name} onChange={e => setApprover(i, { name: e.target.value })} />
                      <input className="blv-approver-input role" list="blvRoleSuggestions" placeholder="Vai trò" value={a.role} onChange={e => setApprover(i, { role: e.target.value })} />
                      <div className="blv-approver-tools">
                        <button type="button" className="blv-icon-btn sm" title="Lên trên" disabled={i === 0} onClick={() => moveApprover(i, -1)}><Icon name="chevron" size={13} stroke={2.4} /></button>
                        <button type="button" className="blv-icon-btn sm down" title="Xuống dưới" disabled={i === approvers.length - 1} onClick={() => moveApprover(i, 1)}><Icon name="chevron" size={13} stroke={2.4} /></button>
                        <button type="button" className="blv-icon-btn sm danger" title="Bỏ người duyệt này" disabled={approvers.length === 1} onClick={() => setApprovers(list => list.filter((_, j) => j !== i))}><Icon name="x" size={13} stroke={2.4} /></button>
                      </div>
                    </div>
                  </li>
                ))}
                {approvers.length < MAX_APPROVERS && (
                  <li className="blv-chain-step add">
                    <span className="blv-chain-dot"><Icon name="plus" size={12} stroke={2.6} /></span>
                    <button type="button" className="blv-chain-add" onClick={() => setApprovers(list => [...list, { name: '', role: '' }])}>Thêm người duyệt</button>
                  </li>
                )}
              </ol>
              <datalist id="blvApproverSuggestions">{APPROVER_SUGGESTIONS.map(n => <option key={n} value={n} />)}</datalist>
              <datalist id="blvRoleSuggestions">{ROLE_SUGGESTIONS.map(n => <option key={n} value={n} />)}</datalist>
            </div>

            {error && <div className="blv-modal-error">{error}</div>}
            <div className="blv-modal-foot">
              <button className="blv-modal-btn cancel" onClick={onClose}>Hủy</button>
              <button className="blv-modal-btn submit" onClick={submit}><Icon name="send" size={13} stroke={2.2} />Gửi đơn</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
