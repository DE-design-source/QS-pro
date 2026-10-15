import { DEPTS, DEPT_LABEL, TIME_FILTER_OPTIONS } from '../../../data/kinhDoanhData'

/* Bộ lọc phòng ban + mốc thời gian — xuất hiện ở cả tab Tổng quan và tab Pipeline,
   dùng chung một state (bản HTML đồng bộ 2 bộ điều khiển qua setDeptFilter / syncTimeFilterUI) */

const deptBtnStyle = active => ({
  border: 'none', cursor: 'pointer', padding: '7px 12px', fontSize: 12, fontWeight: 600,
  background: active ? 'var(--sales-tint)' : 'none', color: active ? 'var(--sales)' : 'var(--text-muted)', fontFamily: 'inherit',
})
const dateInputStyle = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }

export function DeptFilter({ dept, onChange }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {[['all', 'Tất cả'], ...DEPTS.map(d => [d, DEPT_LABEL[d]])].map(([key, label]) => (
        <button key={key} className={dept === key ? 'active' : undefined} style={deptBtnStyle(dept === key)} onClick={() => onChange(key)}>{label}</button>
      ))}
    </div>
  )
}

export function TimeFilter({ filter, onChange }) {
  return (
    <>
      <select
        value={filter.time}
        onChange={e => onChange({ ...filter, time: e.target.value })}
        style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' }}
      >
        {TIME_FILTER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <div style={{ display: filter.time === 'custom' ? 'flex' : 'none', alignItems: 'center', gap: 6 }}>
        <input type="date" value={filter.from} onChange={e => onChange({ ...filter, from: e.target.value })} style={dateInputStyle} />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
        <input type="date" value={filter.to} onChange={e => onChange({ ...filter, to: e.target.value })} style={dateInputStyle} />
      </div>
    </>
  )
}
