import { useRef, useState } from 'react'
import { FILTER_FIELDS, FILTER_OPS, INITIAL_FILTER_CONDITIONS, filterMatchCount } from '../../../data/bimData'
import { Icon, useFlash } from './shared'

const ACTIONS = [
  { key: 'preview', label: 'Preview', busy: 'Đang preview...', dark: false, icon: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
  { key: 'highlight', label: 'Highlight', busy: 'Đang highlight...', dark: false, icon: '<circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>' },
  { key: 'isolate', label: 'Safe Isolate', busy: 'Đang isolate...', dark: true, icon: '<polygon points="3 6 9 6 9 20 3 20 3 6"/><polygon points="15 4 21 4 21 20 15 20 15 4"/>' },
]

function ActionButton({ action }) {
  const [busy, run] = useFlash(700)
  return (
    <button className={action.dark ? 'bim-btn-dark' : 'bim-btn-ghost'} onClick={() => run()}>
      {busy ? action.busy : <><Icon html={action.icon} stroke={action.dark ? '#fff' : 'currentColor'} />{action.label}</>}
    </button>
  )
}

export default function FilterTab() {
  const seq = useRef(INITIAL_FILTER_CONDITIONS.length)
  const [conditions, setConditions] = useState(() => INITIAL_FILTER_CONDITIONS.map((c, i) => ({ ...c, id: i })))
  const [mode, setMode] = useState('all')

  const update = (id, patch) => setConditions(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  const remove = id => setConditions(prev => prev.filter(c => c.id !== id))
  const add = () => setConditions(prev => [...prev, { id: seq.current++, field: 'Level', op: 'bằng', value: '' }])

  return (
    <>
      <div className="bim-eyebrow">Filter</div>
      <div>
        <h2 className="bim-title">Bộ lọc model</h2>
        <p className="bim-desc" style={{ maxWidth: 560 }}>Cùng một Query DSL dùng cho Preview, Highlight, Safe Isolate và báo cáo.</p>
      </div>
      <div className="bim-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="bim-seg-toggle">
          <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>Tất cả điều kiện</button>
          <button className={mode === 'any' ? 'active' : ''} onClick={() => setMode('any')}>Một trong các điều kiện</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {conditions.map((c, i) => (
            <div key={c.id} className="bim-filter-cond-row">
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</div>
              <select value={c.field} onChange={e => update(c.id, { field: e.target.value, op: FILTER_OPS[e.target.value][0] })}>
                {FILTER_FIELDS.map(f => <option key={f}>{f}</option>)}
              </select>
              <select value={c.op} onChange={e => update(c.id, { op: e.target.value })}>
                {FILTER_OPS[c.field].map(o => <option key={o}>{o}</option>)}
              </select>
              <input type="text" value={c.value} onChange={e => update(c.id, { value: e.target.value })} />
              <button className="bim-cond-remove" onClick={() => remove(c.id)}><Icon name="close" sw={2.4} /></button>
            </div>
          ))}
        </div>
        <button className="bim-btn-ghost" style={{ alignSelf: 'flex-start', padding: '8px 14px' }} onClick={add}><Icon name="plus" size={13} sw={2.6} />Thêm điều kiện</button>
      </div>
      <div className="bim-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="bim-kpi-num" style={{ fontSize: 30 }}>{filterMatchCount(conditions).toLocaleString('vi-VN')}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>objects phù hợp</span>
            <span style={{ fontSize: 11.5, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="check" size={11} sw={3} />Chỉ isolate objects trong phạm vi model hiện tại
            </span>
          </div>
        </div>
        {ACTIONS.map(a => <ActionButton key={a.key} action={a} />)}
      </div>
    </>
  )
}
