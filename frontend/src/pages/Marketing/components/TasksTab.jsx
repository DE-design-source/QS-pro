import { useState } from 'react'
import { M_LEADERBOARD, initialsOfM, medalM } from '../../../data/marketingData'
import { MK_FONT, kpiCard, kpiLabel, kpiSub, kpiGrid } from './CampaignsTab'
import MissionPanel from './MissionPanel'
import RewardsPanel from './RewardsPanel'

const TASK_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'mission', label: 'Nhiệm vụ' },
  { id: 'rewards', label: 'Đổi quà' },
  { id: 'leaderboard', label: 'Bảng xếp hạng' },
]
const kpiNum = { fontFamily: MK_FONT, fontWeight: 800, fontSize: 26 }
const megaphone = size => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
const LB_COLS = '0.6fr 2fr 1.4fr 1fr 1fr'

/* ---- Tổng quan ---- */
function OverviewPanel({ visible, steps, onGoto }) {
  const doneSteps = steps.filter(s => s.status === 'done').length
  return (
    <div style={{ display: visible ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
      <div style={kpiGrid}>
        <div style={kpiCard}>
          <div style={kpiLabel}>Nhân sự tham gia</div>
          <div style={kpiNum}>6</div>
          <div style={kpiSub}>Toàn bộ phòng Marketing</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Tổng điểm đã phát</div>
          <div className="mono" style={{ ...kpiNum, color: 'var(--gold)' }}>6.190</div>
          <div style={kpiSub}>Từ đầu chiến dịch đến nay</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Nhiệm vụ hoàn thành tuần này</div>
          <div style={{ ...kpiNum, color: 'var(--success)' }}>5</div>
          <div style={kpiSub}>+2 so với tuần trước</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Quà đã đổi</div>
          <div style={{ ...kpiNum, color: 'var(--marketing)' }}>3</div>
          <div style={kpiSub}>Xem lịch sử tại tab Đổi quà</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>Quy trình đang "chơi"</h3>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--marketing)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--marketing-tint)', color: 'var(--marketing)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{megaphone(19)}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Quy trình chiến dịch — Ra mắt Riverside Giai đoạn 3</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>5 bước · Phòng Marketing</div>
                </div>
              </div>
              <span onClick={() => onGoto('mission')} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--marketing)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Chơi tiếp</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--surface-alt)' }}><div style={{ width: Math.round(doneSteps / steps.length * 100) + '%', height: '100%', borderRadius: 4, background: 'var(--marketing)' }} /></div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{doneSteps}/{steps.length} bước</span>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.7 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-alt)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V8a5 5 0 0 1 10 0v3" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Quy trình Truyền thông thương hiệu Quý 4</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Sắp ra mắt — đang thiết kế nhiệm vụ &amp; mốc điểm</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>Bảng xếp hạng tuần này</h3>
            <span onClick={() => onGoto('leaderboard')} style={{ fontSize: 12, color: 'var(--marketing)', fontWeight: 600, cursor: 'pointer' }}>Xem tất cả ›</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {M_LEADERBOARD.slice(0, 5).map((p, i) => {
              const m = medalM(i + 1)
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flex: 'none' }}>{i + 1}</span>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: p.color + '22', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{initialsOfM(p.name)}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                  <span className="mono" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700 }}>{p.week}đ</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- Bảng xếp hạng ---- */
function LeaderboardPanel({ visible }) {
  return (
    <div style={{ display: visible ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '6px 20px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: LB_COLS, gap: 10, padding: '12px 4px', fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          <span>Hạng</span><span>Nhân sự</span><span>Vai trò</span><span>Điểm tuần này</span><span>Tổng điểm</span>
        </div>
        <div>
          {M_LEADERBOARD.map((p, i) => {
            const m = medalM(i + 1)
            return (
              <div key={p.name} style={{ display: 'grid', gridTemplateColumns: LB_COLS, gap: 10, alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}><span style={{ width: 26, height: 26, borderRadius: '50%', background: p.color + '22', color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{initialsOfM(p.name)}</span>{p.name}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{p.team}</span>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{p.week} đ</span>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>{p.total.toLocaleString('vi-VN')} đ</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* Tab "Nhiệm vụ" (nhiệm vụ & điểm thưởng) — 4 tab con, đều giữ mount và bật/tắt bằng display */
export default function TasksTab({ visible, steps, onCheckSubtask, onOpenCreateTask }) {
  const [sub, setSub] = useState('overview')
  return (
    <div style={{ display: visible ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {TASK_TABS.map(t => (
          <button key={t.id} className={`mk-task-tab${sub === t.id ? ' active' : ''}`} onClick={() => setSub(t.id)}>{t.label}</button>
        ))}
      </div>
      <OverviewPanel visible={sub === 'overview'} steps={steps} onGoto={setSub} />
      <MissionPanel visible={sub === 'mission'} steps={steps} onCheckSubtask={onCheckSubtask} onOpenCreateTask={onOpenCreateTask} />
      <RewardsPanel visible={sub === 'rewards'} />
      <LeaderboardPanel visible={sub === 'leaderboard'} />
    </div>
  )
}
