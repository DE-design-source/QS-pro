import Kpi from './Kpi'

/* Các danh mục đơn giản: Hành chính, Nhân sự, Kinh doanh, Marketing */

function LineList({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {items.map(([name, val]) => (
        <div key={name} className="tc-line-item"><span className="name">{name}</span><span className="mono val">{val}</span></div>
      ))}
    </div>
  )
}

function NoteCard({ title, text, children }) {
  return (
    <div className="tc-card tc-pad">
      <h3 className="tc-card-title" style={{ marginBottom: 4 }}>{title}</h3>
      {text && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{text}</p>}
      {children}
    </div>
  )
}

export function HanhChinhPanel() {
  return (
    <>
      <div className="tc-kpi-grid">
        <Kpi label="Thuê mặt bằng & văn phòng" value="120tr" sub="Tháng 9/2026" />
        <Kpi label="Điện, nước, internet" value="28tr" sub="Tháng 9/2026" />
        <Kpi label="Văn phòng phẩm & khác" value="15tr" sub="Tháng 9/2026" />
      </div>
      <NoteCard title="Chi phí hành chính — 6 tháng gần nhất" text="Tổng chi phí vận hành văn phòng đang ở mức ổn định, trung bình 163tr/tháng." />
    </>
  )
}

export function NhanSuPanel() {
  return (
    <>
      <div className="tc-kpi-grid">
        <Kpi label="Tổng quỹ lương tháng 9" value="1.42 tỷ" sub="42 nhân sự" />
        <Kpi label="Đã chi trả" value="1.42 tỷ" color="var(--success)" sub="Đã tất toán kỳ lương T9" />
        <Kpi label="Bảo hiểm & phúc lợi" value="186tr" color="var(--finance)" sub="BHXH, BHYT, BHTN" />
        <Kpi label="Thưởng & phụ cấp" value="64tr" sub="Thưởng hiệu suất Q3" />
      </div>
      <NoteCard title="Quỹ lương theo bộ phận">
        <LineList items={[
          ['Đội thi công', '720tr'],
          ['Quản lý dự án & kỹ thuật', '380tr'],
          ['Kinh doanh & Marketing', '210tr'],
          ['Hành chính & kế toán', '110tr'],
        ]} />
      </NoteCard>
    </>
  )
}

export function KinhDoanhPanel() {
  return (
    <>
      <div className="tc-kpi-grid">
        <Kpi label="Doanh thu ký mới T9" value="2.30 tỷ" color="var(--success)" sub="4 hợp đồng ký mới" />
        <Kpi label="Giá trị pipeline" value="6.80 tỷ" sub="12 cơ hội đang đàm phán" />
        <Kpi label="Hoa hồng bán hàng" value="92tr" color="var(--finance)" sub="Đã trích T9/2026" />
        <Kpi label="Tỷ lệ chốt đơn" value="33%" sub="Quý 3/2026" />
      </div>
      <NoteCard title="Cơ hội giá trị lớn đang chờ chốt" text={'Cơ hội "Nhà phố Lô B12" có giá trị lớn nhất, đang trong giai đoạn đàm phán hợp đồng.'} />
    </>
  )
}

export function MarketingPanel() {
  return (
    <>
      <div className="tc-kpi-grid">
        <Kpi label="Ngân sách marketing T9" value="450tr" sub="Chiến dịch mở bán Riverside GĐ2" />
        <Kpi label="Đã chi" value="306tr" color="var(--finance)" badge={{ text: '68% ngân sách', color: 'finance' }} />
        <Kpi label="Còn lại" value="144tr" color="var(--success)" sub="32% ngân sách" />
      </div>
      <NoteCard title="Hiệu quả chi phí theo kênh">
        <LineList items={[
          ['Facebook Ads', '168tr · CPL giảm 12%'],
          ['Google Ads', '98tr'],
          ['Sự kiện mở bán', '40tr'],
        ]} />
      </NoteCard>
    </>
  )
}
