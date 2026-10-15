import Icon from '../../../../components/ui/Icon'
import { money } from '../../lib/format.js'

/* Giá trị theo nhóm của bản nháp đang mở (port biểu đồ nhóm của renderDash, PUB/dash.js:180-184).
   groups: [{key, name, value, pct}] đã xếp giảm dần; pct = độ dài thanh (% so với nhóm lớn nhất, lib/totals dashTotals_).
   groups = null: dữ liệu dự án chưa tải xong / lỗi (thiếu Phần thô) -> chỉ hiện chữ wait. */
export default function GroupValueCard({ groups, wait }) {
  return (
    <div className="qs-card">
      <div className="qs-dash-side-head"><Icon name="gauge" size={18} className="qs-dash-accent" /><h3 className="qs-dash-title">Giá trị theo nhóm</h3></div>
      <div className="qs-dash-groups">
        {!groups && <div className="qs-dash-empty" style={{ padding: 8 }}>{wait || 'Đang tải…'}</div>}
        {groups && !groups.length && <div className="qs-dash-empty" style={{ padding: 8 }}>Chưa có hạng mục nào trong bản nháp này.</div>}
        {(groups || []).map(g => (
          <div key={g.key}>
            <div className="qs-dash-group-row"><span>{g.name}</span><b>{money(g.value)} đ</b></div>
            <div className="qs-dash-bar"><div style={{ width: `${g.pct}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
