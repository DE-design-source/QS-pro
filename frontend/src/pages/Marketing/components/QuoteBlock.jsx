import { GROUP_ORDER, catalogItem, fmt, monthsBetween, lineTotal, unitScales, campaignTotal, campaignGroupTotals } from '../../../data/marketingData'

const COLS = '2.2fr 0.8fr 1fr 1fr 1.2fr'

/* Khối bảng hạng mục + tổng cộng (quoteBlockHTML của bản HTML) —
   dùng ở trang chi tiết chiến dịch và bước 3 của modal tạo chiến dịch.
   Trả về fragment để các thẻ con nằm trực tiếp trong container flex/gap của nơi gọi. */
export default function QuoteBlock({ catalog, camp, vat: vatOn = false }) {
  const months = monthsBetween(camp.start, camp.end)
  const groupTotals = campaignGroupTotals(catalog, camp)
  const grandTotal = campaignTotal(catalog, camp)
  const vat = vatOn ? grandTotal * 0.08 : 0

  const groups = GROUP_ORDER.map(g => {
    const lines = camp.items.filter(li => li.qty > 0 && catalogItem(catalog, li.id) && catalogItem(catalog, li.id).group === g)
    if (!lines.length) return null
    const first = catalogItem(catalog, lines[0].id)
    return (
      <div className="mk-grp-card" key={g}>
        <div className="mk-grp-head" style={{ background: 'var(--surface-alt)' }}>
          <span>{g}. {first.groupLabel}</span>
          <span className="mono" style={{ color: 'var(--marketing)', fontWeight: 700 }}>{fmt(groupTotals[g] || 0)}</span>
        </div>
        <div className="mk-grp-colhead" style={{ gridTemplateColumns: COLS }}>
          <span>Hạng mục</span><span>SL</span><span>Đơn giá</span><span>Nhân tháng</span><span>Thành tiền</span>
        </div>
        {lines.map(li => {
          const it = catalogItem(catalog, li.id)
          return (
            <div className="mk-grp-row" style={{ gridTemplateColumns: COLS }} key={li.id}>
              <span style={{ fontSize: 13 }}>{it.name}</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{li.qty} {it.unit}</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{fmt(it.price)}</span>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{unitScales(it.unit) ? (months + ' th') : '—'}</span>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmt(lineTotal(it, li.qty, months))}</span>
            </div>
          )
        })}
      </div>
    )
  }).filter(Boolean)

  return (
    <>
      {groups.length
        ? groups
        : <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 2px' }}>Chiến dịch chưa chọn hạng mục chi phí nào.</div>}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Tạm tính ({camp.items.filter(i => i.qty > 0).length} hạng mục · {months} tháng)</span>
          <span className="mono">{fmt(grandTotal)}</span>
        </div>
        {vatOn && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>VAT (8%)</span><span className="mono">{fmt(vat)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
          <span>Tổng cộng{vatOn ? ' (đã gồm VAT)' : ''}</span>
          <span className="mono" style={{ color: 'var(--marketing)' }}>{fmt(grandTotal + vat)}</span>
        </div>
      </div>
    </>
  )
}
