import { Section, Group, Check, Select } from './shared'

/* Tab "Hiệu suất" — thói quen dùng Chat, sửa lỗi, thuật ngữ Wiki, liên kết, trạng thái */
export default function EfficiencyTab() {
  return (
    <>
      <Section title="Chat">
        <Group label="Khi mở một cuộc trò chuyện, bắt đầu từ">
          <Select k="chatStart" options={[
            ['left-off', 'Vị trí tôi đọc lần trước'],
            ['first-unread', 'Tin chưa đọc đầu tiên'],
            ['latest', 'Tin nhắn mới nhất'],
          ]} />
        </Group>
        <Group label="Xử lý hội thoại">
          <Check k="autoNextChat" label={'Tự chuyển sang cuộc trò chuyện kế tiếp sau khi bấm "Xong"'} />
        </Group>
      </Section>

      <Section title="Soạn thảo">
        <Check k="smartFix" label="Sửa lỗi thông minh" desc="Tự gợi ý sửa lỗi chính tả và diễn đạt khi bạn gõ.">
          <Check k="smartFixMsg" label="Tin nhắn" />
          <Check k="smartFixWiki" label="Wiki" />
        </Check>
        <Check k="wikiTerms" label="Tra thuật ngữ từ Wiki" desc="Bấm vào thuật ngữ được gạch chân (BOQ, nghiệm thu, shop drawing…) để xem mục Wiki tương ứng.">
          <Check k="wikiTermsMsg" label="Tin nhắn" />
          <Check k="wikiTermsWiki" label="Wiki" />
        </Check>
      </Section>

      <Section title="Liên kết & trạng thái">
        <Group label="Mở liên kết">
          <Select k="openLinks" options={[['new-tab', 'Trong tab mới của trình duyệt'], ['in-app', 'Ngay trong SiteFlow']]} />
        </Group>
        <Group label="Trạng thái" desc="Hiển thị cạnh tên của bạn trong Chat và danh bạ.">
          <Select k="status" options={[
            ['working', 'Đang làm việc'],
            ['site', 'Đang ở công trường'],
            ['meeting', 'Đang họp'],
            ['busy', 'Đang bận — không làm phiền'],
            ['leave', 'Nghỉ phép'],
            ['none', 'Không hiển thị trạng thái'],
          ]} />
          <div style={{ marginTop: 6 }}>
            <Check k="statusSyncCalendar" label="Tự đồng bộ trạng thái theo Lịch" desc={'Chuyển sang "Đang họp" khi bạn có sự kiện đang diễn ra.'} />
          </div>
        </Group>
      </Section>
    </>
  )
}
