import { NOTIFY_CHANNELS } from '../../../data/caiDatData'
import { cardStyle, titleStyle, RowText, ToggleSwitch } from './shared'

/* Tab "Thông báo" — các công tắc chỉ đổi trạng thái hiển thị (không lưu, giống HTML) */
export default function NotifyTab() {
  return (
    <div style={cardStyle}>
      <h3 style={titleStyle(14)}>Kênh thông báo</h3>
      {NOTIFY_CHANNELS.map(c => (
        <div key={c.title} className="cd-settings-row">
          <RowText title={c.title} desc={c.desc} />
          <ToggleSwitch defaultOn={c.on} />
        </div>
      ))}
    </div>
  )
}
