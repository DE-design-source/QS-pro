import { GROUP_ORDER, fmt } from '../../../data/marketingData'

const COLS = '2.4fr 1fr 1.2fr'

/* Tab "Danh mục": danh mục hạng mục chi phí theo nhóm (renderCatalog) */
export default function CatalogTab({ visible, catalog, onAddItem }) {
  return (
    <div style={{ display: visible ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Danh mục hạng mục chi phí dùng để chọn vào gói khi tạo chiến dịch. Đơn giá nhân sự (nhóm A) đã bao gồm BH &amp; KPCĐ doanh nghiệp đóng (BHXH 17.5% + BHYT 3% + BHTN 1% trên lương Gross).</div>
        <span style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--marketing-tint)', color: 'var(--marketing)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{catalog.length} hạng mục</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {GROUP_ORDER.map(g => {
          const items = catalog.filter(c => c.group === g)
          return (
            <div className="mk-grp-card" key={g}>
              <div className="mk-grp-head" style={{ background: 'var(--surface-alt)' }}>
                <span>{g}. {items[0].groupLabel}</span>
                <span className="mono" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{items.length} hạng mục</span>
              </div>
              <div className="mk-grp-colhead" style={{ gridTemplateColumns: COLS }}>
                <span>Hạng mục</span><span>Đơn vị</span><span>Đơn giá</span>
              </div>
              {items.map(it => (
                <div className="mk-grp-row" style={{ gridTemplateColumns: COLS }} key={it.id}>
                  <span style={{ fontSize: 13 }}>{it.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{it.unit}</span>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--marketing)' }}>{fmt(it.price)}</span>
                </div>
              ))}
              {/* Bấm để thêm hạng mục vào nhóm — hỏi qua 3 hộp prompt như bản HTML */}
              <div onClick={() => onAddItem(g)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, borderTop: '1px solid var(--border)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Thêm hạng mục
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>* Chi phí phúc lợi &amp; chi phí nhân sự chung (nhóm B) không gắn theo từng chiến dịch nên không nằm trong danh mục lập báo giá — xem tại báo cáo phòng ban.</div>
    </div>
  )
}
