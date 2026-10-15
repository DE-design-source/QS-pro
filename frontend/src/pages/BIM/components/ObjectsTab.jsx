import { useState } from 'react'
import { BIM_OBJECTS, UNASSIGNED_PRODUCT } from '../../../data/bimData'
import { Icon, SectionHead, StatusBadge, useFlash } from './shared'

const SELECTED = { name: 'Cửa đi phòng khách D03', def: 'Door_D03_900x2400', ifc: 'IfcDoor', tag: 'A-DOOR', instance: '#18472', width: '0,90', height: '2,40', instances: '2' }

export default function ObjectsTab() {
  const [total, setTotal] = useState('12')
  const [merging, setMerging] = useState(2)
  const [scanning, scan] = useFlash(900)
  const [spinning, spin] = useFlash(400)
  const [spunOnce, setSpunOnce] = useState(false)

  return (
    <>
      <SectionHead eyebrow="Objects" title="Đối tượng trong model" desc="Scan đối chiếu Group/Component đang tồn tại và giữ nguyên BIM data của object còn sống.">
        {/* "Làm mới" ở bản HTML vẽ lại bảng từ cùng dữ liệu — không có thay đổi hiển thị */}
        <button className="bim-btn-ghost"><Icon name="refresh" />Làm mới</button>
      </SectionHead>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="bim-btn-dark" style={{ flex: 1, minWidth: 220 }} onClick={() => scan(() => setTotal(String(BIM_OBJECTS.length)))}>
          {scanning ? 'Đang scan model...' : <><Icon name="scan" size={15} stroke="#fff" />Scan / Đồng bộ</>}
        </button>
        <button className="bim-btn-ghost" onClick={() => setMerging(n => n + 1)}>
          <Icon html={'<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>'} size={15} />Gộp nhóm
        </button>
        <button className="bim-btn-ghost" onClick={() => setMerging(n => Math.max(0, n - 1))}>
          <Icon html={'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'} size={15} />Hủy gộp
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div className="bim-card bim-kpi-card"><div className="bim-kpi-num">{total}</div><div className="bim-kpi-label">objects đã ghi</div></div>
        <div className="bim-card bim-kpi-card"><div className="bim-kpi-num" style={{ color: 'var(--finance)' }}>{merging}</div><div className="bim-kpi-label">object đang bị gộp</div></div>
        <div className="bim-card bim-kpi-card"><div className="bim-kpi-num">3</div><div className="bim-kpi-label">containers</div></div>
      </div>

      <div className="bim-card" style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10, background: scanning ? 'var(--bim-tint)' : 'var(--success-tint)', borderColor: 'var(--success-tint)' }}>
        <Icon name="check" size={16} stroke="var(--success)" sw={3} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: scanning ? 'var(--bim)' : 'var(--success)' }}>
          {scanning ? 'Đang đối chiếu Group/Component với model...' : 'Scan hoàn tất · không có object bị xóa'}
        </span>
      </div>

      <div className="bim-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="bim-eyebrow">Đối tượng đang chọn</div>
          <button
            className="bim-btn-ghost"
            style={{ padding: '7px 9px', ...(spunOnce ? { transition: 'transform .4s ease' } : {}), transform: spinning ? 'rotate(360deg)' : '' }}
            onClick={() => { setSpunOnce(true); spin() }}
          >
            <Icon name="refresh" />
          </button>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 800 }}>{SELECTED.name}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          {[['Definition', SELECTED.def], ['IFC Class', SELECTED.ifc], ['Tag', SELECTED.tag], ['Instance', SELECTED.instance, true]].map(([k, v, mono]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k}</div>
              <div className={mono ? 'mono' : undefined} style={{ fontSize: 13, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: 'var(--surface-alt)', borderRadius: 10, padding: 12 }}>
          {[[SELECTED.width, 'm rộng'], [SELECTED.height, 'm cao'], [SELECTED.instances, 'instances']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bim-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="bim-eyebrow">Product</div>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Sản phẩm được gán</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Cửa gỗ công nghiệp phủ Laminate · SUP-014</div>
        </div>
        <StatusBadge color="success">● Đã Inspect</StatusBadge>
      </div>

      <div className="bim-card" style={{ padding: '6px 4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Instance', 'Definition', 'IFC Class', 'Level', 'Product'].map(h => <th key={h} className="bim-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {BIM_OBJECTS.map(o => (
              <tr key={o.instance}>
                <td className="bim-td mono" style={{ fontWeight: 700 }}>{o.instance}</td>
                <td className="bim-td">{o.def}</td>
                <td className="bim-td"><StatusBadge color="bim">{o.ifc}</StatusBadge></td>
                <td className="bim-td" style={{ color: 'var(--text-muted)' }}>{o.level}</td>
                <td className="bim-td" style={o.product === UNASSIGNED_PRODUCT ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{o.product}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
