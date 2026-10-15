import { useState } from 'react'
import { REWARDS, REWARD_RULES } from '../../../data/caiDatData'
import { cardStyle, listCardStyle, listHeadStyle, titleStyle, smallPrimaryBtnStyle } from './shared'

const gridCols = { display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 0.6fr', gap: 10 }

/* Tab "Đổi thưởng" — danh sách phần thưởng (thêm / ẩn-hiện / xoá, không lưu localStorage giống HTML) */
export default function RewardsTab() {
  const [rewards, setRewards] = useState(() => REWARDS.map(r => ({ ...r })))

  function toggleReward(idx) {
    setRewards(prev => prev.map((r, i) => i === idx ? { ...r, active: !r.active } : r))
  }

  function deleteReward(idx) {
    if (window.confirm('Xoá phần thưởng "' + rewards[idx].name + '"?')) {
      setRewards(prev => prev.filter((_, i) => i !== idx))
    }
  }

  function addReward() {
    const name = (window.prompt('Tên phần thưởng:') || '').trim()
    if (!name) return
    const costRaw = window.prompt('Điểm quy đổi:', '500') || '0'
    const cost = parseInt(costRaw.replace(/[^\d]/g, ''), 10) || 0
    setRewards(prev => [...prev, { name, cost, active: true }])
  }

  return (
    <>
      <div style={cardStyle}>
        <h3 style={titleStyle(4)}>Quản lý đổi thưởng</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Thiết lập sản phẩm nhân sự có thể đổi bằng điểm tích luỹ từ hoàn thành nhiệm vụ. Áp dụng cho ví điểm thưởng trên toàn hệ thống (Kinh doanh, Newsfeed…).</p>
      </div>
      <div style={listCardStyle}>
        <div style={listHeadStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 700 }}>Danh sách phần thưởng</h3>
          <button type="button" style={{ ...smallPrimaryBtnStyle, fontFamily: 'inherit' }} onClick={addReward}>+ Thêm phần thưởng</button>
        </div>
        <div style={{ ...gridCols, padding: '8px 4px', fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          <span>Phần thưởng</span><span>Điểm quy đổi</span><span>Trạng thái</span><span />
        </div>
        <div>
          {rewards.map((r, i) => (
            <div key={i} style={{ ...gridCols, alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, ...(r.active ? {} : { color: 'var(--text-muted)', textDecoration: 'line-through' }) }}>{r.name}</span>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--finance)' }}>{r.cost.toLocaleString('vi-VN')} điểm</span>
              <span>
                <button
                  type="button"
                  onClick={() => toggleReward(i)}
                  style={{ border: '1px solid var(--border)', background: r.active ? 'var(--success-tint)' : 'var(--surface-alt)', color: r.active ? 'var(--success)' : 'var(--text-muted)', padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >{r.active ? 'Hoạt động' : 'Tạm ẩn'}</button>
              </span>
              <button type="button" onClick={() => deleteReward(i)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, justifySelf: 'start' }} title="Xoá">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Quy định quy đổi điểm</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.9 }}>
          {REWARD_RULES.map(rule => <li key={rule}>{rule}</li>)}
        </ul>
      </div>
    </>
  )
}
