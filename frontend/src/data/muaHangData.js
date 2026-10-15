/* Dữ liệu mẫu cho trang Mua hàng (mua-hang.html) */

export const PO_STATUS = {
  'Chưa đặt': { bg: 'var(--surface-alt)', color: 'var(--text-muted)' },
  'Đã đặt': { bg: 'var(--primary-tint)', color: 'var(--primary)' },
  'Đã nhận': { bg: 'var(--success-tint)', color: 'var(--success)' },
}
export const PO_FILTERS = ['all', 'Chưa đặt', 'Đã đặt', 'Đã nhận']

export const PURCHASE_ORDERS = [
  { code: 'PO-001', supplier: 'Rạng Đông', items: '3', total: '1.975.000', date: '25/09', status: 'Chưa đặt' },
  { code: 'PO-002', supplier: 'MPE', items: '2', total: '2.665.000', date: '27/09', status: 'Đã đặt' },
  { code: 'PO-003', supplier: 'Philips', items: '1', total: '1.920.000', date: '18/09', status: 'Đã nhận' },
  { code: 'PO-004', supplier: 'Hồng Phúc', items: '1', total: '4.800.000', date: '02/10', status: 'Chưa đặt' },
  { code: 'PO-005', supplier: 'Điện Quang', items: '1', total: '570.000', date: '24/09', status: 'Đã đặt' },
]

export const KPIS = [
  { label: 'Tổng đơn mua hàng', value: '5', sub: 'Trên 5 nhà cung cấp' },
  { label: 'Chưa đặt', value: '2', color: 'var(--text-muted)', sub: 'Cần đặt hàng trong tuần' },
  { label: 'Đã đặt', value: '2', color: 'var(--primary)', sub: 'Đang chờ giao' },
  { label: 'Tổng giá trị', value: '11.93 triệu', color: 'var(--success)', sub: '5 đơn mua hàng', mono: true },
]

/* ---------- Dezbot ---------- */
export const AI_KB = {
  tiendo: 'Dự án "Chung cư Riverside GĐ2" đang hoàn thành 62% khối lượng — đúng tiến độ tổng thể. Hạng mục "Hoàn thiện" có 2 đầu việc đang trễ hạn, cần ưu tiên xử lý trong tuần này.',
  chamcong: 'Hôm nay có 18/21 nhân sự đã chấm công đúng giờ, 2 người chấm công trễ và 1 người xin nghỉ phép. Tỷ lệ chuyên cần tuần này đạt 94%.',
  dongtien: 'Dòng tiền tháng này: Thu về 1.85 tỷ, Chi ra 1.42 tỷ — dương 430 triệu. Có 3 hoá đơn nhà cung cấp sắp đến hạn thanh toán trong 7 ngày tới.',
  khachhang: 'Hiện có 12 khách hàng đang trong giai đoạn đàm phán, 4 khách vừa ký hợp đồng trong tuần này. Cơ hội "Nhà phố Lô B12" có giá trị lớn nhất, đang chờ chốt hợp đồng.',
  tinnhan: 'Bạn có 6 tin nhắn chưa đọc trong Chat, tập trung ở nhóm "Dự án Riverside" và "Ban giám đốc". Muốn mình tóm tắt nội dung chính không?',
  boctach: 'Bóc tách khối lượng mới nhất từ QS ghi nhận tổng giá trị vật tư khoảng 11.93 triệu trên 5 đơn mua hàng, trong đó 2 đơn chưa đặt hàng.',
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
export const AI_SUGGESTIONS = ['Tóm tắt tình hình dự án hôm nay', 'Đơn mua hàng nào chưa đặt?', 'Nhà cung cấp nào đang có đơn trễ?']
export function matchTopic(text) {
  const t = text.toLowerCase()
  const has = (...keys) => keys.some(k => t.indexOf(k) > -1)
  if (has('tiến độ', 'tien do', 'dự án')) return 'tiendo'
  if (has('chấm công', 'nhân công', 'nhân sự', 'nghỉ phép')) return 'chamcong'
  if (has('dòng tiền', 'hoá đơn', 'hóa đơn', 'thu', 'chi')) return 'dongtien'
  if (has('khách hàng', 'hợp đồng')) return 'khachhang'
  if (has('tin nhắn', 'chat')) return 'tinnhan'
  if (has('bóc tách', 'mua hàng', 'đơn', 'nhà cung cấp', 'vật tư')) return 'boctach'
  if (has('quy trình')) return 'quytrinh'
  return 'default'
}
