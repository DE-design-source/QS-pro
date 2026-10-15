import { STATUS_LABEL, STATUS_COLOR, STATUS_TINT, fmt, monthsBetween, campaignTotal } from '../../../data/marketingData'

export const MK_FONT = "var(--app-font, 'Montserrat'), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
export const kpiCard = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '17px 20px', display: 'flex', flexDirection: 'column', gap: 8 }
export const kpiLabel = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
export const kpiSub = { fontSize: 12, color: 'var(--text-muted)' }
export const kpiGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }
const kpiNum = { fontFamily: MK_FONT, fontWeight: 800, fontSize: 26 }

/* Tab "Chiến dịch": KPI + lưới thẻ chiến dịch (renderCampaigns) */
export default function CampaignsTab({ visible, catalog, campaigns, onOpenDetail }) {
  return (
    <div style={{ display: visible ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
      <div style={kpiGrid}>
        <div style={kpiCard}>
          <div style={kpiLabel}>Tổng chiến dịch</div>
          <div style={kpiNum}>{campaigns.length}</div>
          <div style={kpiSub}>Đã khởi tạo trong hệ thống</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Đang chạy</div>
          <div style={{ ...kpiNum, color: 'var(--success)' }}>{campaigns.filter(c => c.status === 'active').length}</div>
          <div style={kpiSub}>Trạng thái đã duyệt / đang triển khai</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Bản nháp</div>
          <div style={{ ...kpiNum, color: 'var(--finance)' }}>{campaigns.filter(c => c.status === 'draft').length}</div>
          <div style={kpiSub}>Chờ duyệt ngân sách</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Tổng ngân sách đã lập</div>
          <div className="mono" style={{ fontFamily: MK_FONT, fontWeight: 800, fontSize: 22, color: 'var(--marketing)' }}>{fmt(campaigns.reduce((s, c) => s + campaignTotal(catalog, c), 0))}</div>
          <div style={kpiSub}>Cộng dồn báo giá các chiến dịch</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {campaigns.map(c => {
          const total = campaignTotal(catalog, c)
          const months = monthsBetween(c.start, c.end)
          return (
            <div className="mk-camp-card" key={c.id} onClick={() => onOpenDetail(c.id)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{c.name}</div>
                <span style={{ flex: 'none', padding: '3px 9px', borderRadius: 999, background: STATUS_TINT[c.status], color: STATUS_COLOR[c.status], fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{STATUS_LABEL[c.status]}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.type} · {c.client}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.start || '—'} → {c.end || '—'} ({months} tháng) · {c.owner}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.items.filter(i => i.qty > 0).length} hạng mục</span>
                <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--marketing)' }}>{fmt(total)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: campaigns.length ? 'none' : 'block', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14, padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Chưa có chiến dịch nào — bấm "Tạo chiến dịch" để khởi tạo và lập báo giá.
      </div>
    </div>
  )
}
