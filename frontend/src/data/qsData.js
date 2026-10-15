/* Dữ liệu mẫu & tiện ích cho trang QS — Bóc tách & Báo giá (qs.html) */

export const QS_TABS = [
  { key: 'overview', label: 'Bảng điều khiển', icon: 'grid' },
  { key: 'breakdown', label: 'Bóc tách', icon: 'layers' },
  { key: 'cost', label: 'Chi phí', icon: 'banknote' },
  { key: 'quote', label: 'Xuất báo giá', icon: 'fileText' },
  { key: 'po', label: 'Mua hàng', icon: 'cart' },
  { key: 'projects', label: 'Dự án', icon: 'scan' },
]

/* status: doing | draft | done */
export const QS_STATUS = {
  doing: { label: 'Đang bóc', bg: 'var(--finance-tint)', color: 'var(--finance)', bar: 'var(--qs)' },
  draft: { label: 'Bản nháp', bg: 'var(--surface-alt)', color: 'var(--text-muted)', bar: 'var(--text-muted)' },
  done: { label: 'Hoàn tất', bg: 'var(--success-tint)', color: 'var(--success)', bar: 'var(--success)' },
}

export const RECENT_PROJECTS = [
  { name: 'Căn hộ mẫu tầng 1', meta: 'BQL Riverside · 21/09', pct: 65, status: 'doing' },
  { name: 'Nhà mẫu Villa Số 3', meta: 'Anh Quang Huy · 18/09', pct: 40, status: 'doing' },
  { name: 'Căn hộ A1-05 (khách lẻ)', meta: 'Chị Minh Thư · 15/09', pct: 20, status: 'draft' },
  { name: 'Sảnh & hành lang chung', meta: 'BQL Riverside · 08/09', pct: 100, status: 'done' },
]

export const TOP_BRANDS = [
  { name: 'Rạng Đông', value: '1.98tr', pct: 70 },
  { name: 'Hồng Phúc', value: '4.80tr', pct: 95 },
  { name: 'MPE', value: '2.67tr', pct: 55 },
  { name: 'Philips', value: '1.92tr', pct: 40 },
  { name: 'Điện Quang', value: '0.57tr', pct: 15 },
]

export const QS_PROJECTS = [
  { code: 'QS-01', name: 'Căn hộ mẫu tầng 1', client: 'BQL Riverside', phone: '0909 123 456', address: 'Riverside GĐ2, Tòa A', date: '21/09', pct: 65, status: 'doing', goto: 'breakdown' },
  { code: 'QS-02', name: 'Căn hộ A1-05 (khách lẻ)', client: 'Chị Minh Thư', phone: '0912 887 234', address: 'Riverside GĐ2, A1-05', date: '15/09', pct: 20, status: 'draft' },
  { code: 'QS-03', name: 'Sảnh & hành lang chung', client: 'BQL Riverside', phone: '0909 123 456', address: 'Riverside GĐ2, khu chung', date: '08/09', pct: 100, status: 'done' },
  { code: 'QS-04', name: 'Nhà mẫu Villa Số 3', client: 'Anh Quang Huy', phone: '0938 456 789', address: 'Riverside GĐ2, Villa 3', date: '18/09', pct: 40, status: 'doing' },
]

/* ---------- Bóc tách chi phí ---------- */
export const ROOM_NAV = [
  { name: 'Phòng khách', total: '6.34tr' },
  { name: 'Phòng bếp', total: '2.49tr' },
  { name: 'Phòng ngủ master', total: '3.37tr' },
  { name: 'WC master', total: '0.66tr' },
  { name: 'Hành lang & cầu thang', total: '1.90tr' },
]
export const ROOM_BREAKDOWN = [
  { room: 'Phòng khách', total: '6.340.000 đ', highlight: true, items: [
    { name: 'Đèn chùm phòng khách', brand: 'Hồng Phúc', qty: '1', price: '4.800.000', amount: '4.800.000' },
    { name: 'Đèn âm trần Downlight 9W', brand: 'Rạng Đông', qty: '8', price: '145.000', amount: '1.160.000' },
    { name: 'Đèn hắt tủ LED thanh (m)', brand: 'Rạng Đông', qty: '4', price: '95.000', amount: '380.000' },
  ] },
  { room: 'Phòng bếp', total: '2.490.000 đ', items: [
    { name: 'Đèn LED âm trần Spotlight 12W', brand: 'Philips', qty: '6', price: '320.000', amount: '1.920.000' },
    { name: 'Đèn ốp trần nổi tròn 24W', brand: 'Điện Quang', qty: '2', price: '285.000', amount: '570.000' },
  ] },
  { room: 'Phòng ngủ master', total: '3.370.000 đ', items: [
    { name: 'Đèn thả bàn ăn Pendant', brand: 'MPE', qty: '2', price: '1.250.000', amount: '2.500.000' },
    { name: 'Đèn âm trần Downlight 9W', brand: 'Rạng Đông', qty: '6', price: '145.000', amount: '870.000' },
  ] },
]

/* ---------- Danh sách sản phẩm ---------- */
export const PRODUCTS = [
  { name: 'Đèn âm trần Downlight 9W', brand: 'Rạng Đông', cat: 'Đèn âm trần', power: '9W', cct: '4000K', angle: '90°', price: '145.000 đ' },
  { name: 'Đèn LED âm trần Spotlight 12W', brand: 'Philips', cat: 'Đèn spotlight', power: '12W', cct: '3000K', angle: '36°', price: '320.000 đ' },
  { name: 'Đèn thả bàn ăn Pendant', brand: 'MPE', cat: 'Đèn trang trí', power: '40W', cct: '3000K', angle: '120°', price: '1.250.000 đ' },
  { name: 'Đèn ốp trần nổi tròn 24W', brand: 'Điện Quang', cat: 'Đèn ốp trần', power: '24W', cct: '4000K', angle: '180°', price: '285.000 đ' },
  { name: 'Đèn hắt tủ LED thanh (m)', brand: 'Rạng Đông', cat: 'Đèn hắt', power: '5W/m', cct: '3000K', angle: '120°', price: '95.000 đ' },
  { name: 'Đèn cầu thang âm tường', brand: 'MPE', cat: 'Đèn âm tường', power: '3W', cct: '3000K', angle: '60°', price: '165.000 đ' },
  { name: 'Đèn chùm phòng khách', brand: 'Hồng Phúc', cat: 'Đèn chùm', power: '60W', cct: '3000K', angle: '360°', price: '4.800.000 đ' },
  { name: 'Đèn gương nhà tắm LED', brand: 'Rạng Đông', cat: 'Đèn gương', power: '15W', cct: '6500K', angle: '100°', price: '220.000 đ' },
]
export const PRODUCT_CATEGORIES = ['Đèn âm trần', 'Đèn spotlight', 'Đèn trang trí', 'Đèn ốp trần', 'Đèn hắt', 'Đèn âm tường', 'Đèn chùm', 'Đèn gương']
export const PRODUCT_BRANDS = ['Rạng Đông', 'Philips', 'MPE', 'Điện Quang', 'Hồng Phúc']
export const STATIC_FILTERS = [
  { title: 'Công suất', options: ['<10W', '10–20W', '20–40W', '>40W'] },
  { title: 'Nhiệt độ màu', options: ['3000K', '4000K', '6500K'] },
  { title: 'Góc chiếu sáng', options: ['<60°', '60–120°', '>120°'] },
]

const QS_COLORS = ['#6D4FC2', '#2F5DA8', '#0E8A82', '#B7791F', '#C0392B', '#1E8E5A']
export function qsColor(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % QS_COLORS.length
  return QS_COLORS[Math.abs(h)]
}

/* ---------- Xuất báo giá ---------- */
export const QUOTE_SECTIONS = [
  { title: 'Sảnh chính', items: [
    { name: 'Đèn chùm phòng khách', qty: '2', price: '4.800.000', amount: '9.600.000' },
    { name: 'Đèn âm trần Downlight 9W', qty: '20', price: '145.000', amount: '2.900.000' },
  ] },
  { title: 'Hành lang tầng 1–5', items: [
    { name: 'Đèn cầu thang âm tường', qty: '40', price: '165.000', amount: '6.600.000' },
  ] },
]

/* ---------- Mua hàng ---------- */
export const PO_STATUS = {
  pending: { label: 'Chưa đặt', bg: 'var(--surface-alt)', color: 'var(--text-muted)' },
  ordered: { label: 'Đã đặt', bg: 'var(--primary-tint)', color: 'var(--primary)' },
  received: { label: 'Đã nhận', bg: 'var(--success-tint)', color: 'var(--success)' },
}
export const PURCHASE_ORDERS = [
  { code: 'PO-001', supplier: 'Rạng Đông', items: '3', total: '1.975.000', date: '25/09', status: 'pending' },
  { code: 'PO-002', supplier: 'MPE', items: '2', total: '2.665.000', date: '27/09', status: 'ordered' },
  { code: 'PO-003', supplier: 'Philips', items: '1', total: '1.920.000', date: '18/09', status: 'received' },
  { code: 'PO-004', supplier: 'Hồng Phúc', items: '1', total: '4.800.000', date: '02/10', status: 'pending' },
  { code: 'PO-005', supplier: 'Điện Quang', items: '1', total: '570.000', date: '24/09', status: 'ordered' },
]

/* ---------- Dezbot ---------- */
export const AI_KB = {
  tiendo: 'Dự án "Chung cư Riverside GĐ2" đang hoàn thành 62% khối lượng — đúng tiến độ tổng thể. Hạng mục "Hoàn thiện" có 2 đầu việc đang trễ hạn, cần ưu tiên xử lý trong tuần này.',
  chamcong: 'Hôm nay có 18/21 nhân sự đã chấm công đúng giờ, 2 người chấm công trễ và 1 người xin nghỉ phép. Tỷ lệ chuyên cần tuần này đạt 94%.',
  dongtien: 'Dòng tiền tháng này: Thu về 1.85 tỷ, Chi ra 1.42 tỷ — dương 430 triệu. Có 3 hoá đơn nhà cung cấp sắp đến hạn thanh toán trong 7 ngày tới.',
  khachhang: 'Hiện có 12 khách hàng đang trong giai đoạn đàm phán, 4 khách vừa ký hợp đồng trong tuần này. Cơ hội "Nhà phố Lô B12" có giá trị lớn nhất, đang chờ chốt hợp đồng.',
  tinnhan: 'Bạn có 6 tin nhắn chưa đọc trong Chat, tập trung ở nhóm "Dự án Riverside" và "Ban giám đốc". Muốn mình tóm tắt nội dung chính không?',
  boctach: 'Bóc tách khối lượng mới nhất ghi nhận tổng giá trị vật tư khoảng 11.93 triệu trên 5 đơn mua hàng, trong đó 2 đơn chưa đặt hàng. Có 1 bóc tách đang chờ duyệt báo giá.',
  quytrinh: 'Quy trình thi công hiện tại gồm 5 bước: Khảo sát → Thiết kế → Xin phép → Thi công → Nghiệm thu. Bước "Thi công" đang được nhiều dự án thực hiện nhất.',
  default: 'Mình đã tra trong dữ liệu workspace nhưng chưa tìm thấy câu trả lời chính xác cho câu hỏi này — bạn thử hỏi cụ thể hơn về tiến độ, chấm công, dòng tiền, khách hàng, bóc tách hoặc quy trình nhé.',
}
export const AI_TOPIC_LABELS = {
  tiendo: 'Tiến độ dự án đang thế nào?',
  chamcong: 'Tình hình chấm công hôm nay?',
  dongtien: 'Dòng tiền tháng này ra sao?',
  khachhang: 'Khách hàng nào đang tiềm năng?',
  tinnhan: 'Tôi có tin nhắn nào chưa đọc?',
}
export const AI_SUGGESTIONS = ['Bóc tách nào chưa hoàn thành?', 'Đơn giá vật tư nào vừa thay đổi?', 'Tóm tắt báo giá gửi khách tuần này']
export function matchTopic(text) {
  const t = text.toLowerCase()
  const has = (...keys) => keys.some(k => t.indexOf(k) > -1)
  if (has('tiến độ', 'tien do', 'dự án')) return 'tiendo'
  if (has('chấm công', 'nhân công', 'nhân sự', 'nghỉ phép')) return 'chamcong'
  if (has('dòng tiền', 'hoá đơn', 'hóa đơn', 'thu', 'chi')) return 'dongtien'
  if (has('khách hàng', 'hợp đồng', 'báo giá')) return 'khachhang'
  if (has('tin nhắn', 'chat')) return 'tinnhan'
  if (has('bóc tách', 'mua hàng', 'vật tư', 'đơn giá')) return 'boctach'
  if (has('quy trình')) return 'quytrinh'
  return 'default'
}
