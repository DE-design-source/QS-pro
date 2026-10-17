import { TIME_ZONES } from '../../../data/caiDatData'
import { Section, Group, Check, Choices, Select, useSettings } from './shared'

const hours = { fontSize: 9.5, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 'none' }

/* Hình xem trước màu sự kiện: classic = tô kín cả khối */
function EventPreview({ classic }) {
  return (
    <div style={{ display: 'flex', gap: 6, height: '100%' }}>
      <div style={hours}><span>10:00</span><span>11:00</span><span>12:00</span></div>
      <div style={{ flex: 1, borderRadius: 4, borderLeft: '3px solid var(--primary)', padding: '5px 8px', fontSize: 10.5, fontWeight: 700, lineHeight: 1.4, background: classic ? 'var(--primary)' : 'var(--primary-tint)', color: classic ? '#fff' : 'var(--primary)' }}>
        Họp giao ban<br />10:00–12:00
      </div>
    </div>
  )
}

/* Tab "Lịch" — nhắc sự kiện, hiển thị lịch, giờ làm việc, múi giờ phụ, âm lịch */
export default function CalendarTab() {
  const { s, update } = useSettings()
  return (
    <>
      <Section title="Sự kiện mới" desc="Giá trị mặc định khi bạn tạo sự kiện trên Lịch.">
        <Group label="Nhắc trước sự kiện">
          <Select k="eventAlert" options={[
            ['none', 'Không nhắc'], ['0', 'Đúng giờ bắt đầu'], ['5', 'Trước 5 phút'], ['15', 'Trước 15 phút'],
            ['30', 'Trước 30 phút'], ['60', 'Trước 1 giờ'], ['1440', 'Trước 1 ngày'],
          ]} />
        </Group>
        <Group label="Nhắc sự kiện cả ngày">
          <Select k="allDayAlert" options={[
            ['none', 'Không nhắc'], ['day-8', 'Lúc 8:00 trong ngày diễn ra'], ['day-9', 'Lúc 9:00 trong ngày diễn ra'],
            ['prev-8', 'Lúc 8:00 trước đó 1 ngày'], ['prev-17', 'Lúc 17:00 trước đó 1 ngày'],
          ]} />
        </Group>
        <Group label="Thời lượng mặc định">
          <Select k="eventDuration" options={[['15', '15 phút'], ['30', '30 phút'], ['45', '45 phút'], ['60', '1 giờ'], ['90', '1 giờ 30 phút'], ['120', '2 giờ']]} />
        </Group>
      </Section>

      <Section title="Hiển thị lịch">
        <Group label="Màu sự kiện">
          <Choices k="eventColor" options={[
            { value: 'modern', label: 'Hiện đại (chữ màu)', preview: <EventPreview /> },
            { value: 'classic', label: 'Cổ điển (khối màu)', preview: <EventPreview classic /> },
          ]} />
        </Group>
        <Group label="Tuần bắt đầu từ">
          <Select k="weekStart" options={[['mon', 'Thứ Hai'], ['sun', 'Chủ nhật'], ['sat', 'Thứ Bảy']]} />
        </Group>
        <Group label="Tuỳ chọn">
          <Check k="weekNumbers" label="Hiện số thứ tự tuần" />
          <Check k="lunar" label="Hiện âm lịch" desc="Thêm ngày âm lịch bên cạnh ngày dương trên Lịch." />
          <Check k="dimPast" label="Làm mờ các sự kiện đã qua" />
          <Check k="showDeclined" label="Hiện sự kiện tôi đã từ chối" />
          <Check k="upcomingInFeed" label="Hiện sự kiện sắp tới trên Bàn làm việc" />
        </Group>
      </Section>

      <Section title="Giờ làm việc & lời mời">
        <Check k="workHours" label="Bật giờ làm việc" desc="Người khác sẽ được nhắc khi mời bạn vào sự kiện ngoài giờ làm việc.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px', fontSize: 12.5, color: 'var(--text-muted)' }}>
            <input type="time" className="cd-select narrow" value={s.workStart} onChange={e => update({ workStart: e.target.value })} />
            đến
            <input type="time" className="cd-select narrow" value={s.workEnd} onChange={e => update({ workEnd: e.target.value })} />
          </div>
        </Check>
        <Check k="muteDeclined" label="Không gửi thông báo cho sự kiện tôi đã từ chối" />
        <Check k="notifyDecline" label="Báo cho tôi khi có người từ chối lời mời của tôi" />
      </Section>

      <Section title="Múi giờ phụ" desc="Hiện thêm một cột giờ trên Lịch — tiện khi làm việc với đối tác, nhà cung cấp ở nước ngoài.">
        <Select k="tzExtra" options={[['none', 'Không dùng'], ...TIME_ZONES]} />
      </Section>
    </>
  )
}
