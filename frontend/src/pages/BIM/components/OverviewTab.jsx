import { OV_PROJECTS, OV_ATTENTION, OV_ACTIVITY, nameInitials } from '../../../data/bimData'
import { Icon, ICONS } from './shared'

function Kpi({ label, value, color, note, noteColor }) {
  return (
    <div className="bim-card bim-kpi-card" style={{ textAlign: 'left', padding: '16px 18px' }}>
      <div className="bim-kpi-label">{label}</div>
      <div className="bim-kpi-num" style={color ? { color } : undefined}>{value}</div>
      <div style={{ fontSize: 11, color: noteColor || 'var(--text-muted)', ...(noteColor ? { fontWeight: 600 } : {}) }}>{note}</div>
    </div>
  )
}

export default function OverviewTab() {
  return (
    <>
      <div className="bim-eyebrow">Tổng quan</div>
      <div>
        <h2 className="bim-title">Chào buổi sáng, Trần Anh</h2>
        <p className="bim-desc">Theo dõi tiến độ dữ liệu BIM và công việc cần ưu tiên hôm nay.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Kpi label="Dự án đang hoạt động" value="03" note="3 dự án bạn có quyền xem" />
        <Kpi label="Objects đã quản lý" value="57.258" note="+8,4% · trên 17 model SketchUp" noteColor="var(--success)" />
        <Kpi label="Issues đang mở" value="38" color="var(--danger)" note="7 đến hạn · 9 việc ưu tiên cao" />
        <Kpi label="Giá trị BOQ tạm tính" value="18,09 tỷ" note="VND · đã áp dụng VAT 8%" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="bim-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 className="bim-card-title">Tiến độ dự án</h3>
            <span style={{ fontSize: 11.5, color: 'var(--bim)', fontWeight: 600, cursor: 'pointer' }}>Xem tất cả ›</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {OV_PROJECTS.map(p => (
              <div key={p.code} className="bim-data-row">
                <div className="bim-level-chip active" style={{ borderRadius: 8 }}>{p.code}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.meta}</div>
                  <div className="bim-track" style={{ height: 5, borderRadius: 3, marginTop: 6 }}><div style={{ width: `${p.pct}%` }} /></div>
                </div>
                <div className="mono" style={{ fontWeight: 800, fontSize: 13, flex: 'none' }}>{p.pct}%</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bim-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 className="bim-card-title">Cần chú ý <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 11.5 }}>· 48 giờ tới</span></h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OV_ATTENTION.map(a => (
              <div key={a.title} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `var(--${a.color}-tint)`, color: `var(--${a.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon html={ICONS[a.icon]} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.sub}</div>
                </div>
                <div className="mono" style={{ fontWeight: 800, fontSize: 13 }}>{a.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bim-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3 className="bim-card-title" style={{ marginBottom: 8 }}>Hoạt động gần đây</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {OV_ACTIVITY.map(a => (
            <div key={a.target} className="bim-data-row">
              <div className="bim-issue-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{nameInitials(a.who)}</div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}><strong>{a.who}</strong> {a.action} <strong>{a.target}</strong></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', flex: 'none' }}>{a.time}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
