import { TIME_ZONES } from '../../../data/caiDatData'
import { Section, Group, Check, Radios, Choices, Select, Bar, useSettings } from './shared'

const dot = { width: 12, height: 12, borderRadius: '50%', background: 'var(--surface-alt)', flex: 'none' }
const line = { display: 'flex', alignItems: 'center', gap: 8 }

/* Hình xem trước cách căn lề tin nhắn: both = tin của mình nằm bên phải */
function AlignPreview({ both }) {
  return (
    <>
      <div style={line}><span style={dot} /><Bar w={96} /></div>
      {both
        ? <div style={{ ...line, justifyContent: 'flex-end' }}><Bar w={120} color="var(--primary-tint)" /><span style={dot} /></div>
        : <div style={line}><span style={dot} /><Bar w={120} color="var(--primary-tint)" /></div>}
      <div style={line}><span style={dot} /><Bar w={64} /></div>
    </>
  )
}

function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'Asia/Ho_Chi_Minh' }
}

/* Tab "Chung" — căn lề tin nhắn, ngôn ngữ, định dạng giờ, múi giờ */
export default function GeneralTab() {
  const { s } = useSettings()
  return (
    <>
      <Section title="Tin nhắn" desc="Cách hiển thị tin nhắn trong Chat.">
        <Group label="Căn lề tin nhắn">
          <Choices k="msgAlign" options={[
            { value: 'left', label: 'Bên trái', preview: <AlignPreview /> },
            { value: 'both', label: 'Trái và phải', preview: <AlignPreview both /> },
          ]} />
        </Group>
      </Section>

      <Section title="Ngôn ngữ & thời gian">
        <Group label="Ngôn ngữ">
          <Select k="language" options={[['vi', 'Tiếng Việt'], ['en', 'English']]} />
        </Group>
        <Group label="Định dạng giờ">
          <Check k="time24h" label="Dùng định dạng 24 giờ" desc="Hiển thị 17:30 thay cho 5:30 CH trên toàn bộ SiteFlow." />
        </Group>
        <Group label="Múi giờ">
          <Radios k="tzMode" options={[
            { value: 'device', label: 'Theo múi giờ của thiết bị', desc: deviceTimeZone() },
            { value: 'custom', label: 'Chọn múi giờ' },
          ]} />
          {s.tzMode === 'custom' ? <div className="cd-sub"><Select k="tzCustom" options={TIME_ZONES} /></div> : null}
        </Group>
      </Section>
    </>
  )
}
