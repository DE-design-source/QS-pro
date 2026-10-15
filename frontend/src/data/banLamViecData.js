/* Dữ liệu trang Bàn làm việc — lấy nguyên từ ban-lam-viec.html */

/* Nhiệm vụ của tôi (tổng hợp từ các hạng mục khác, tích điểm) */
export const MISSIONS = [
  { title: 'Khảo sát địa chất & hiện trạng', meta: 'Quản lý dự án · Quy trình thi công Lô B12', points: '+20đ' },
  { title: 'Duyệt đơn mua hàng PO-003', meta: 'Mua hàng · Đã nhận hàng', points: '+15đ' },
  { title: 'Xác nhận chấm công tuần', meta: 'HR · Chấm công', points: '+10đ' },
]

/* Task hàng ngày ban đầu */
export const INITIAL_TASKS = [
  { id: 1, title: 'Hoàn thiện bóc tách vật tư GĐ2', meta: 'Chung cư Riverside GĐ2 · Hạn 24/09', prio: 'high', done: false },
  { id: 2, title: 'Duyệt đơn mua hàng PO-004', meta: 'Mua hàng · Hạn 25/09', prio: 'med', done: false },
  { id: 3, title: 'Review App tiến độ thi công', meta: 'Quản lý dự án · Hạn 23/09', prio: 'high', done: false },
  { id: 4, title: 'Gửi báo giá cho khách Lô B12', meta: 'Kinh doanh · Hoàn thành 21/09', prio: 'low', done: true },
  { id: 5, title: 'Chuẩn bị họp kinh doanh tổng', meta: 'Kinh doanh · Hạn 24/09', prio: 'med', done: false },
  { id: 6, title: 'Cập nhật Wiki quy trình thi công', meta: 'Wiki · Hạn 27/09', prio: 'low', done: false },
  { id: 7, title: 'Xác nhận nhân sự tăng ca cuối tuần', meta: 'HR · Hạn 26/09', prio: 'med', done: false },
]

export const PRIO_LABEL = { high: 'Cao', med: 'TB', low: 'Thấp' }


/* ---------- Dữ liệu bổ sung cho giao diện mới ---------- */
export const ME = { name: 'Trần Anh', role: 'PM công trường' }
export const TODAY_LABEL = 'Thứ Tư, 23/09/2026'

/* Nguồn của nhiệm vụ (icon/màu theo hạng mục) — khớp theo tiền tố của meta */
export const MISSION_SOURCES = {
  'Quản lý dự án': 'primary',
  'Mua hàng': 'qs',
  'HR': 'attendance',
}
export const MISSION_POINTS = { current: 330, target: 1450 }

/* Chấm công tuần này: ok = đúng giờ, late = đi trễ, off = nghỉ, today = hôm nay, future = chưa tới */
export const WEEK_ATTENDANCE = [
  { d: 'T2', date: '21', s: 'ok', inT: '07:52' },
  { d: 'T3', date: '22', s: 'late', inT: '08:14' },
  { d: 'T4', date: '23', s: 'today', inT: '07:48' },
  { d: 'T5', date: '24', s: 'future' },
  { d: 'T6', date: '25', s: 'future' },
  { d: 'T7', date: '26', s: 'future' },
]

/* Danh sách "Liên quan tới" trong modal thêm việc */
export const TASK_PROJECTS = ['Cá nhân', 'Quản lý dự án', 'Kinh doanh', 'Mua hàng', 'HR', 'Tài chính', 'Wiki']

/* ---------- Đơn từ ----------
   Người duyệt mặc định (gợi ý theo vai trò) */
const QL = { name: 'Nguyễn Đức Anh', role: 'Quản lý trực tiếp' }
const HR = { name: 'Ngô Mỹ Duyên', role: 'Nhân sự (HR)' }
const KT = { name: 'Phan Bảo Ngọc', role: 'Kế toán trưởng' }
const GD = { name: 'Cao Hưng (CEO)', role: 'Giám đốc' }
const MH = { name: 'Cao Nhật Tân', role: 'Trưởng phòng mua hàng' }
const IT = { name: 'Lê Trung Kiên', role: 'Phòng IT' }

/* Cấu hình từng loại đơn.
   fields: các ô nhập của form — type: select | date | time | amount | text (giá trị lưu theo key k).
   approvers: luồng duyệt mặc định (người dùng có thể thêm/bớt/đổi người khi tạo đơn). */
export const DONTU_CONFIG = {
  xinphep: {
    title: 'Xin nghỉ phép', desc: 'Nghỉ phép năm, nghỉ ốm, nghỉ không lương', icon: 'calendar', color: 'attendance',
    fields: [
      { k: 'kind', type: 'select', label: 'Loại nghỉ', options: ['Nghỉ phép năm', 'Nghỉ ốm', 'Nghỉ không lương', 'Nghỉ việc riêng có lương'] },
      { k: 'from', type: 'date', label: 'Từ ngày', def: '2026-09-24' },
      { k: 'to', type: 'date', label: 'Đến ngày', def: '2026-09-24' },
    ],
    reasonLabel: 'Lý do xin nghỉ', approvers: [QL, HR],
  },
  dimuon: {
    title: 'Đi muộn / về sớm', desc: 'Báo trước khi đến muộn hoặc về sớm', icon: 'logIn', color: 'attendance',
    fields: [
      { k: 'kind', type: 'select', label: 'Loại', options: ['Đi muộn', 'Về sớm'] },
      { k: 'from', type: 'date', label: 'Ngày', def: '2026-09-24' },
      { k: 'time', type: 'time', label: 'Giờ dự kiến', def: '09:30' },
    ],
    reasonLabel: 'Lý do', approvers: [QL],
  },
  tangca: {
    title: 'Đăng ký tăng ca', desc: 'Làm thêm giờ ngoài ca, cuối tuần, ngày lễ', icon: 'moon', color: 'qs',
    fields: [
      { k: 'from', type: 'date', label: 'Ngày tăng ca', def: '2026-09-26' },
      { k: 'start', type: 'time', label: 'Từ giờ', def: '17:30' },
      { k: 'end', type: 'time', label: 'Đến giờ', def: '20:30' },
      { k: 'project', type: 'text', label: 'Dự án / công việc', placeholder: 'VD: Đổ bê tông sàn tầng 3' },
    ],
    reasonLabel: 'Nội dung công việc', approvers: [QL, HR],
  },
  chamcong: {
    title: 'Giải trình chấm công', desc: 'Quên chấm công, máy chấm lỗi, làm ngoài công trường', icon: 'fingerprint', color: 'attendance',
    fields: [
      { k: 'from', type: 'date', label: 'Ngày cần giải trình', def: '2026-09-22' },
      { k: 'start', type: 'time', label: 'Giờ vào thực tế', def: '07:45' },
      { k: 'end', type: 'time', label: 'Giờ ra thực tế', def: '17:15' },
    ],
    reasonLabel: 'Nội dung giải trình', approvers: [QL, HR],
  },
  congtac: {
    title: 'Đi công tác', desc: 'Công tác công trường, khảo sát, làm việc với đối tác', icon: 'plane', color: 'primary',
    fields: [
      { k: 'place', type: 'text', label: 'Địa điểm công tác', placeholder: 'VD: Công trường Lô B12 — Bình Chánh' },
      { k: 'from', type: 'date', label: 'Từ ngày', def: '2026-09-28' },
      { k: 'to', type: 'date', label: 'Đến ngày', def: '2026-09-29' },
      { k: 'amount', type: 'amount', label: 'Dự trù chi phí (đ)' },
    ],
    reasonLabel: 'Mục đích công tác', approvers: [QL, GD],
  },
  tamung: {
    title: 'Tạm ứng', desc: 'Đề nghị tạm ứng lương / công tác phí', icon: 'wallet', color: 'finance',
    fields: [
      { k: 'from', type: 'date', label: 'Ngày cần nhận', def: '2026-09-25' },
      { k: 'amount', type: 'amount', label: 'Số tiền đề nghị tạm ứng (đ)' },
    ],
    reasonLabel: 'Lý do tạm ứng', approvers: [QL, KT],
  },
  hoanung: {
    title: 'Hoàn ứng', desc: 'Quyết toán khoản đã tạm ứng trước đó', icon: 'rotate', color: 'finance',
    fields: [
      { k: 'from', type: 'date', label: 'Ngày hoàn ứng', def: '2026-09-25' },
      { k: 'amount', type: 'amount', label: 'Số tiền hoàn (đ)' },
    ],
    reasonLabel: 'Nội dung quyết toán', approvers: [QL, KT],
  },
  thanhtoan: {
    title: 'Đề nghị thanh toán', desc: 'Thanh toán cho nhà cung cấp, thầu phụ, chi phí phát sinh', icon: 'receipt', color: 'finance',
    fields: [
      { k: 'payee', type: 'text', label: 'Thanh toán cho', placeholder: 'VD: Công ty Thép Hòa Phát' },
      { k: 'amount', type: 'amount', label: 'Số tiền (đ)' },
      { k: 'from', type: 'date', label: 'Hạn thanh toán', def: '2026-09-30' },
    ],
    reasonLabel: 'Nội dung thanh toán', approvers: [QL, KT, GD],
  },
  muasam: {
    title: 'Đề xuất mua sắm', desc: 'Mua vật tư, dụng cụ, văn phòng phẩm', icon: 'cart', color: 'qs',
    fields: [
      { k: 'item', type: 'text', label: 'Hàng hoá cần mua', placeholder: 'VD: Máy đo khoảng cách laser' },
      { k: 'qty', type: 'text', label: 'Số lượng', placeholder: 'VD: 2 cái' },
      { k: 'amount', type: 'amount', label: 'Dự toán (đ)' },
      { k: 'from', type: 'date', label: 'Cần trước ngày', def: '2026-10-05' },
    ],
    reasonLabel: 'Mục đích sử dụng', approvers: [QL, MH, KT],
  },
  capphat: {
    title: 'Cấp phát thiết bị', desc: 'Laptop, điện thoại, đồ bảo hộ, dụng cụ thi công', icon: 'laptop', color: 'primary',
    fields: [
      { k: 'kind', type: 'select', label: 'Loại thiết bị', options: ['Laptop', 'Màn hình', 'Điện thoại', 'Đồ bảo hộ lao động', 'Dụng cụ thi công', 'Khác'] },
      { k: 'item', type: 'text', label: 'Mô tả / cấu hình', placeholder: 'VD: Laptop chạy được Revit, RAM 32GB' },
      { k: 'from', type: 'date', label: 'Cần trước ngày', def: '2026-10-01' },
    ],
    reasonLabel: 'Lý do cấp phát', approvers: [QL, IT],
  },
}

/* Nhóm loại đơn để hiển thị trong tab Đơn từ */
export const FORM_GROUPS = [
  { key: 'nghi', label: 'Nghỉ phép & chấm công', types: ['xinphep', 'dimuon', 'tangca', 'chamcong', 'congtac'] },
  { key: 'taichinh', label: 'Tài chính', types: ['tamung', 'hoanung', 'thanhtoan'] },
  { key: 'hanhchinh', label: 'Hành chính & tài sản', types: ['muasam', 'capphat'] },
]

/* Lịch sử đơn từ ban đầu.
   approvers[].state: done (đã duyệt) | active (đang chờ người này) | waiting (chưa tới lượt) | rejected (từ chối) */
export const INITIAL_REQUESTS = [
  {
    id: 3, type: 'tamung', title: 'Tạm ứng — 3.000.000đ', createdAt: '20/09/2026 · 10:05',
    fields: [['Ngày cần nhận', '22/09/2026'], ['Số tiền', '3.000.000đ']],
    reason: 'Công tác khảo sát Lô B12',
    approvers: [
      { ...QL, state: 'done', time: '20/09/2026 · 11:20', note: 'Đồng ý, chuyển Kế toán xử lý.' },
      { ...KT, state: 'active' },
    ],
  },
  {
    id: 2, type: 'xinphep', title: 'Xin nghỉ phép (Nghỉ ốm) — 18/09 đến 19/09', createdAt: '17/09/2026 · 07:45',
    fields: [['Loại nghỉ', 'Nghỉ ốm'], ['Từ ngày', '18/09/2026'], ['Đến ngày', '19/09/2026']],
    reason: 'Sốt siêu vi, có giấy khám bệnh',
    approvers: [
      { ...QL, state: 'done', time: '17/09/2026 · 09:12', note: 'Nghỉ ngơi cho khoẻ nhé.' },
      { ...HR, state: 'done', time: '17/09/2026 · 14:30' },
    ],
  },
  {
    id: 1, type: 'muasam', title: 'Đề xuất mua sắm — Máy đo khoảng cách laser', createdAt: '15/09/2026 · 16:20',
    fields: [['Hàng hoá cần mua', 'Máy đo khoảng cách laser Bosch GLM 50'], ['Số lượng', '2 cái'], ['Dự toán', '4.600.000đ'], ['Cần trước ngày', '20/09/2026']],
    reason: 'Phục vụ đo đạc hoàn thiện căn hộ mẫu',
    approvers: [
      { ...QL, state: 'done', time: '15/09/2026 · 17:02' },
      { ...MH, state: 'rejected', time: '16/09/2026 · 08:40', note: 'Kho công trường còn 1 máy, liên hệ thủ kho để mượn trước.' },
      { ...KT, state: 'waiting' },
    ],
  },
]

export const APPROVER_SUGGESTIONS = [
  'Nguyễn Đức Anh', 'Cao Hưng (CEO)', 'Đỗ Thành Long', 'Phan Bảo Ngọc', 'Cao Nhật Tân',
  'Ngọc Hà', 'Lê Trung Kiên', 'Nguyễn Trung Thành', 'Ngô Mỹ Duyên',
]
export const ROLE_SUGGESTIONS = ['Quản lý trực tiếp', 'Nhân sự (HR)', 'Kế toán trưởng', 'Trưởng phòng mua hàng', 'Phòng IT', 'Chỉ huy trưởng', 'Giám đốc']

/* Viết tắt vai trò để hiện trên tiến trình duyệt thu gọn */
const ROLE_SHORT = { 'Quản lý trực tiếp': 'QL', 'Nhân sự (HR)': 'HR', 'Kế toán trưởng': 'KT', 'Giám đốc': 'GĐ', 'Trưởng phòng mua hàng': 'MH', 'Phòng IT': 'IT', 'Chỉ huy trưởng': 'CHT' }
export function roleShort(role) {
  if (!role) return '?'
  return ROLE_SHORT[role] || role.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

/* Trạng thái tổng của đơn */
export function requestStatus(r) {
  if (r.cancelled) return 'cancelled'
  if (r.approvers.some(a => a.state === 'rejected')) return 'rejected'
  if (r.approvers.every(a => a.state === 'done')) return 'approved'
  return 'pending'
}
export const REQUEST_STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã huỷ' }

/* "2026-09-26" -> "26/09" (giống split('-').reverse().slice(0,2).join('/')) */
export const shortDate = v => (v ? v.split('-').reverse().slice(0, 2).join('/') : '')

/* ---------- Dezbot ---------- */
export const AI_KB = {
  tiendo: 'Dự án "Chung cư Riverside GĐ2" đang hoàn thành 62% khối lượng — đúng tiến độ tổng thể. Hạng mục "Hoàn thiện" có 2 đầu việc đang trễ hạn, cần ưu tiên xử lý trong tuần này.',
  chamcong: 'Bạn có 18/20 ngày công đủ giờ tháng này, 1 lần đi trễ, còn 8/12 ngày phép năm. Đơn xin nghỉ ốm gần nhất đã được duyệt.',
  dongtien: 'Dòng tiền tháng này: Thu về 1.85 tỷ, Chi ra 1.42 tỷ — dương 430 triệu. Có 3 hoá đơn nhà cung cấp sắp đến hạn thanh toán trong 7 ngày tới.',
  khachhang: 'Hiện có 12 khách hàng đang trong giai đoạn đàm phán, 4 khách vừa ký hợp đồng trong tuần này. Cơ hội "Nhà phố Lô B12" có giá trị lớn nhất, đang chờ chốt hợp đồng.',
  tinnhan: 'Bạn có 6 tin nhắn chưa đọc trong Chat, tập trung ở nhóm "Dự án Riverside" và "Ban giám đốc". Muốn mình tóm tắt nội dung chính không?',
  boctach: 'Bóc tách khối lượng mới nhất từ QS ghi nhận tổng giá trị vật tư khoảng 11.93 triệu trên 5 đơn mua hàng, trong đó 2 đơn chưa đặt hàng.',
  quytrinh: 'Quy trình thi công hiện tại gồm 5 bước: Khảo sát → Thiết kế → Xin phép → Thi công → Nghiệm thu. Bước "Thi công" đang được nhiều dự án thực hiện nhất.',
  nhiemvu: 'Bạn đang có 7 nhiệm vụ, 2 việc sắp đến hạn: "Hoàn thiện bóc tách vật tư GĐ2" (24/09) và "Chuẩn bị họp kinh doanh tổng" (24/09). Tuần này đã hoàn thành 12 việc.',
  dontu: 'Bạn có 1 đơn tạm ứng công tác phí 3.000.000đ đang chờ duyệt (gửi 20/09), và 1 đơn xin nghỉ ốm đã được duyệt.',
  default: 'Mình đã tra trong dữ liệu workspace nhưng chưa tìm thấy câu trả lời chính xác cho câu hỏi này — bạn thử hỏi cụ thể hơn về nhiệm vụ, chấm công, đơn từ, dòng tiền, khách hàng, bóc tách hoặc quy trình nhé.',
}

export function matchTopic(text) {
  const t = text.toLowerCase()
  const has = s => t.indexOf(s) > -1
  if (has('đơn từ') || has('tạm ứng') || has('hoàn ứng') || has('chờ duyệt')) return 'dontu'
  if (has('nhiệm vụ') || has('task')) return 'nhiemvu'
  if (has('tiến độ') || has('tien do') || has('dự án')) return 'tiendo'
  if (has('chấm công') || has('nhân công') || has('nhân sự') || has('nghỉ phép') || has('ngày phép')) return 'chamcong'
  if (has('dòng tiền') || has('hoá đơn') || has('hóa đơn') || has('thu') || has('chi')) return 'dongtien'
  if (has('khách hàng') || has('hợp đồng')) return 'khachhang'
  if (has('tin nhắn') || has('chat')) return 'tinnhan'
  if (has('bóc tách') || has('mua hàng') || has('vật tư')) return 'boctach'
  if (has('quy trình')) return 'quytrinh'
  return 'default'
}

/* Câu hỏi gửi đi khi bấm chip chủ đề */
export const AI_TOPIC_LABELS = {
  tiendo: 'Tiến độ dự án đang thế nào?',
  chamcong: 'Tình hình chấm công hôm nay?',
  dongtien: 'Dòng tiền tháng này ra sao?',
  khachhang: 'Khách hàng nào đang tiềm năng?',
  tinnhan: 'Tôi có tin nhắn nào chưa đọc?',
}

export const AI_SUGGESTIONS = [
  'Tôi còn bao nhiêu ngày phép?',
  'Đơn từ nào đang chờ duyệt?',
  'Tóm tắt nhiệm vụ của tôi tuần này',
]
