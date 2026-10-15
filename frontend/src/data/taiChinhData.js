/* Dữ liệu mẫu & tiện ích cho trang Tài chính (tai-chinh.html) */

export const FIN_CATEGORIES = [
  { key: 'hanhchinh', label: 'Hành chính' },
  { key: 'nhansu', label: 'Nhân sự' },
  { key: 'duan', label: 'Dự án' },
  { key: 'kinhdoanh', label: 'Kinh doanh' },
  { key: 'marketing', label: 'Marketing' },
]

export const FIN_PROJECTS = ['Tất cả dự án', 'Chung cư Riverside GĐ2', 'Nhà phố Lô B12', 'Biệt thự Song lập Thảo Điền', 'Văn phòng cho thuê Q3']

export const FIN_RANGES = [
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: '3m', label: '3 tháng' },
  { key: '6m', label: '6 tháng' },
  { key: '1y', label: '1 năm' },
]

/* ---------- Biểu đồ dự báo dòng tiền ---------- */
const MONTH_LABELS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12']
const THU_MONTH = [4200, 4550, 3900, 4300, 4650, 4100, 4400, 4750, 4250, 4600, 4900, 4350]
const CHI_MONTH = [2700, 2900, 2650, 2750, 2850, 2800, 2950, 3000, 2820, 2900, 3050, 2880]

export const CASHFLOW_RANGE_DATA = {
  week: { labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'], thu: [950, 1100, 800, 950, 1050, 900, 1150, 980], chi: [620, 700, 640, 600, 680, 650, 720, 690], maxVal: 1200, title: 'Dự báo dòng tiền — 8 tuần tới' },
  month: { labels: MONTH_LABELS.slice(0, 6), thu: THU_MONTH.slice(0, 6), chi: CHI_MONTH.slice(0, 6), maxVal: 5500, title: 'Dự báo dòng tiền — 6 tháng tới' },
  '3m': { labels: MONTH_LABELS.slice(0, 3), thu: THU_MONTH.slice(0, 3), chi: CHI_MONTH.slice(0, 3), maxVal: 5500, title: 'Dự báo dòng tiền — 3 tháng tới (theo quý)' },
  '6m': { labels: MONTH_LABELS.slice(0, 6), thu: THU_MONTH.slice(0, 6), chi: CHI_MONTH.slice(0, 6), maxVal: 5500, title: 'Dự báo dòng tiền — 6 tháng tới' },
  '1y': { labels: MONTH_LABELS, thu: THU_MONTH, chi: CHI_MONTH, maxVal: 5500, title: 'Dự báo dòng tiền — 12 tháng tới (theo năm)' },
}

export const CHART_TYPES = [
  { value: 'grouped', label: 'Cột nhóm' },
  { value: 'stacked', label: 'Cột chồng' },
  { value: 'line', label: 'Đường' },
  { value: 'area', label: 'Vùng (Area)' },
  { value: 'combo', label: 'Kết hợp (Cột + Đường)' },
]
export const DEFAULT_THU_COLOR = '#1E8E5A'
export const DEFAULT_CHI_COLOR = '#C2711A'
export const CHART_STORAGE = {
  type: 'siteflow-cashflow-chart-type',
  thu: 'siteflow-cashflow-color-thu',
  chi: 'siteflow-cashflow-color-chi',
}

/* ---------- Danh mục "Dự án" ---------- */
export const PROJECT_FINANCE = [
  { name: 'Chung cư Riverside GĐ2', planIn: '8.50 tỷ', actualIn: '6.80 tỷ', planOut: '8.50 tỷ', actualOut: '5.20 tỷ' },
  { name: 'Nhà phố Lô B12', planIn: '4.20 tỷ', actualIn: '2.10 tỷ', planOut: '3.60 tỷ', actualOut: '1.85 tỷ' },
  { name: 'Biệt thự Song lập Thảo Điền', planIn: '12.00 tỷ', actualIn: '3.50 tỷ', planOut: '9.80 tỷ', actualOut: '2.40 tỷ' },
  { name: 'Văn phòng cho thuê Q3', planIn: '6.00 tỷ', actualIn: '6.00 tỷ', planOut: '4.50 tỷ', actualOut: '4.50 tỷ' },
]
export const PROJECT_FINANCE_TOTAL = { planIn: '30.70 tỷ', actualIn: '18.40 tỷ', planOut: '26.40 tỷ', actualOut: '13.95 tỷ' }

export const BUDGET_CATEGORIES = [
  { name: 'Nhân công', value: '1.74 / 3.00 tỷ', pct: 58, color: 'primary' },
  { name: 'Vật tư', value: '2.58 / 2.80 tỷ', pct: 92, color: 'finance' },
  { name: 'Thầu phụ', value: '1.58 / 1.50 tỷ', pct: 100, color: 'danger', over: 'Vượt ngân sách 80 triệu' },
  { name: 'Thiết bị', value: '0.48 / 1.20 tỷ', pct: 40, color: 'primary' },
]

/* dir: down (phải thu) | up (phải trả) | done */
export const INVOICE_SUMMARY = [
  { label: 'INV-0142 · Khách hàng ABC', amount: '620 triệu đ', status: 'Quá hạn 5 ngày', color: 'danger', dir: 'down' },
  { label: 'INV-0143 · Khách hàng ABC', amount: '480 triệu đ', status: 'Chờ thu', color: 'primary', dir: 'down' },
  { label: 'BILL-0087 · Thầu phụ Nam Á', amount: '310 triệu đ', status: 'Chờ thanh toán', color: 'finance', dir: 'up' },
  { label: 'INV-0144 · Khách hàng XYZ', amount: '700 triệu đ', status: 'Đã thu', color: 'success', dir: 'done' },
  { label: 'BILL-0088 · Vật tư Hòa Phát', amount: '195 triệu đ', status: 'Đã thanh toán', color: 'success', dir: 'done' },
]

/* ---------- Dezbot ---------- */
export const AI_KB = {
  tiendo: 'Dự án "Chung cư Riverside GĐ2" đang hoàn thành 62% khối lượng — đúng tiến độ tổng thể. Hạng mục "Hoàn thiện" có 2 đầu việc đang trễ hạn, cần ưu tiên xử lý trong tuần này.',
  chamcong: 'Hôm nay có 18/21 nhân sự đã chấm công đúng giờ, 2 người chấm công trễ và 1 người xin nghỉ phép. Tỷ lệ chuyên cần tuần này đạt 94%.',
  dongtien: 'Dòng tiền tuần này: Thu 1.15 tỷ, Chi 720 triệu — dương 430 triệu, luỹ kế 6.49 tỷ. Có 3 hoá đơn nhà cung cấp sắp đến hạn thanh toán trong 7 ngày tới.',
  khachhang: 'Hiện có 12 khách hàng đang trong giai đoạn đàm phán, 4 khách vừa ký hợp đồng trong tuần này. Công nợ phải thu lớn nhất là hoá đơn INV-0142, đã quá hạn 5 ngày.',
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
export const AI_SUGGESTIONS = ['Hoá đơn nào quá hạn?', 'Tóm tắt dòng tiền tuần này', 'Công nợ khách hàng còn bao nhiêu?']
export function matchTopic(text) {
  const t = text.toLowerCase()
  const has = (...keys) => keys.some(k => t.indexOf(k) > -1)
  if (has('tiến độ', 'tien do', 'dự án')) return 'tiendo'
  if (has('chấm công', 'nhân công', 'nhân sự', 'nghỉ phép')) return 'chamcong'
  if (has('dòng tiền', 'hoá đơn', 'hóa đơn', 'thu', 'chi', 'công nợ')) return 'dongtien'
  if (has('khách hàng', 'hợp đồng')) return 'khachhang'
  if (has('tin nhắn', 'chat')) return 'tinnhan'
  if (has('bóc tách', 'mua hàng', 'vật tư')) return 'boctach'
  if (has('quy trình')) return 'quytrinh'
  return 'default'
}
