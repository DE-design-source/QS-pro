import { Section, Group, Check, Radios, Select } from './shared'

/* Tab "Nhiệm vụ" — nhắc việc, tổng kết tuần, huy hiệu đếm, giờ nhắc mặc định */
export default function TasksTab() {
  return (
    <>
      <Section title="Nhắc việc">
        <Check k="taskDaily" label="Thông báo hằng ngày" desc="Mỗi sáng nhắc các nhiệm vụ bạn đang phụ trách." />
        <Check k="taskWeekly" label="Tiêu điểm tuần" desc="Dezbot tóm tắt các đầu việc trọng tâm trong tuần của bạn." />
        <Check k="taskBadge" label="Huy hiệu đếm nhiệm vụ" desc="Chọn con số trên huy hiệu thể hiện điều gì.">
          <Radios k="taskBadgeMode" options={[
            { value: 'overdue', label: 'Nhiệm vụ đã quá hạn' },
            { value: 'overdue-today', label: 'Nhiệm vụ quá hạn hoặc đến hạn hôm nay' },
          ]} />
        </Check>
      </Section>

      <Section title="Nhiệm vụ mới">
        <Group label="Thời điểm nhắc mặc định" desc="Áp dụng cho nhiệm vụ mới có hạn hoàn thành.">
          <Select k="taskAlert" options={[
            ['none', 'Không nhắc'], ['due-9', 'Lúc 9:00 ngày đến hạn'], ['prev-9', 'Lúc 9:00 trước hạn 1 ngày'],
            ['prev-17', 'Lúc 17:00 trước hạn 1 ngày'], ['prev2-9', 'Lúc 9:00 trước hạn 2 ngày'], ['week-9', 'Lúc 9:00 trước hạn 1 tuần'],
          ]} />
        </Group>
      </Section>
    </>
  )
}
