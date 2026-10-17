/* Dữ liệu trang IT — lấy nguyên từ it.html */

/* Yêu cầu hỗ trợ — id tăng dần theo thời gian tạo; status: dangxuly | moi | chodoi | hoanthanh | dong */
export const TICKETS = [
  { id: 1532, requester: 'Trần Thị Hoa', issue: 'Wifi công trường chậm, hay rớt mạng', priority: 'high', status: 'moi', date: '25/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1531, requester: 'Hoàng Yến Nhi', issue: 'Không đồng bộ được lịch Outlook trên điện thoại', priority: 'low', status: 'moi', date: '25/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1529, requester: 'Nguyễn Văn Long', issue: 'Máy in phòng kế toán không in được', priority: 'medium', status: 'dangxuly', date: '24/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1528, requester: 'Võ Hoàng Nam', issue: 'Revit báo lỗi license khi mở file mô hình tầng 5', priority: 'high', status: 'dangxuly', date: '24/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1526, requester: 'Phạm Minh Tuấn', issue: 'Cài đặt AutoCAD 2026 bản quyền mới', priority: 'medium', status: 'dangxuly', date: '23/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1525, requester: 'Cao Nhật Tân', issue: 'Cấp quyền truy cập thư mục báo giá nhà cung cấp', priority: 'low', status: 'hoanthanh', date: '23/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1523, requester: 'Ngô Mỹ Duyên', issue: 'Máy chấm công cổng Riverside không nhận vân tay', priority: 'high', status: 'chodoi', date: '22/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1522, requester: 'Đinh Khánh Linh', issue: 'Màn hình phụ nhấp nháy khi kết nối dock USB-C', priority: 'medium', status: 'chodoi', date: '22/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1520, requester: 'Lê Thị Mai', issue: 'Laptop bị vỡ màn hình, cần thay linh kiện', priority: 'high', status: 'chodoi', date: '20/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1519, requester: 'Vũ Thị Ngọc', issue: 'Quên mật khẩu email công ty', priority: 'low', status: 'hoanthanh', date: '19/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1518, requester: 'Đỗ Văn Khánh', issue: 'Lỗi kết nối VPN khi làm việc từ xa', priority: 'medium', status: 'hoanthanh', date: '18/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1516, requester: 'Phan Bảo Ngọc', issue: 'Phần mềm kế toán chạy chậm cuối tháng', priority: 'medium', status: 'hoanthanh', date: '17/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1515, requester: 'Nguyễn Đức Anh', issue: 'Camera công trường Quận 9 mất tín hiệu 2 mắt', priority: 'high', status: 'hoanthanh', date: '16/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1513, requester: 'Đỗ Thảo Vy', issue: 'Xin cấp thêm dung lượng Google Drive cho team Marketing', priority: 'low', status: 'dong', date: '15/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1511, requester: 'Lưu Minh Trí', issue: 'File dự toán Excel bị khoá không mở được', priority: 'medium', status: 'hoanthanh', date: '14/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1510, requester: 'Trịnh Anh Thư', issue: 'Cài chữ ký số cho hoá đơn điện tử', priority: 'high', status: 'hoanthanh', date: '13/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1508, requester: 'Mai Phương Thảo', issue: 'Tai nghe hội họp không nhận micro trên Teams', priority: 'low', status: 'dong', date: '12/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1506, requester: 'Lâm Thanh Tùng', issue: 'Thiết lập phòng họp trực tuyến cho giao ban tuần', priority: 'medium', status: 'hoanthanh', date: '11/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1503, requester: 'Tạ Quang Huy', issue: 'Máy tính R&D cần nâng RAM để chạy mô phỏng', priority: 'medium', status: 'dangxuly', date: '10/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1501, requester: 'Trần Anh', issue: 'Tài khoản SiteFlow bị khoá sau 5 lần nhập sai', priority: 'high', status: 'hoanthanh', date: '09/09/2026', assignee: 'Lê Trung Kiên' },
  { id: 1499, requester: 'Phùng Gia Hân', issue: 'Điện thoại công ty không nhận SIM mới', priority: 'low', status: 'dong', date: '08/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1497, requester: 'Đặng Quốc Cường', issue: 'Không gửi được email có file đính kèm trên 25MB', priority: 'low', status: 'hoanthanh', date: '07/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1494, requester: 'Quách Thu Hà', issue: 'Máy scan phòng kế toán bị kẹt giấy liên tục', priority: 'medium', status: 'dong', date: '05/09/2026', assignee: 'Đoàn Gia Bảo' },
  { id: 1490, requester: 'Huỳnh Tấn Phát', issue: 'Lắp wifi cho khu xưởng mộc Bình Chánh', priority: 'medium', status: 'hoanthanh', date: '03/09/2026', assignee: 'Lê Trung Kiên' },
]

/* Nhóm trạng thái hiển thị trên bộ lọc: [nhãn, màu chấm] — thứ tự như danh sách */
export const TICKET_GROUPS = [
  ['dangxuly', 'Đang làm', '#0E9F9A'],
  ['moi', 'Mở', '#16A34A'],
  ['chodoi', 'Chờ', '#E04848'],
  ['hoanthanh', 'Xong', '#8B3FD9'],
  ['dong', 'Đóng', '#8A8F98'],
]

/* Ghi chú cập nhật các hệ thống nội bộ do IT vận hành */
export const RELEASES = [
  { version: 'SiteFlow 2.4.1', date: '24/09/2026', improvements: [
    'Bảng mua hàng: giao nhiều người & phòng ban phụ trách mỗi bước, gửi thông báo khi chuyển bước.',
    'Sơ đồ tổ chức hiển thị theo tập đoàn — công ty thành viên — phòng ban.',
  ], fixes: [
    'Sửa lỗi thanh cuộn ngang của Pipeline khách hàng nằm khuất cuối trang.',
    'Sửa lỗi màu phân bổ kiêm nhiệm trùng nhau trong hồ sơ nhân sự.',
    'Sửa lỗi đồng bộ lịch Outlook bị lệch múi giờ.',
  ] },
  { version: 'VPN & Mạng nội bộ — bản vá 09/2026', date: '15/09/2026', improvements: [
    'Nâng cấp firmware router UniFi Dream Machine lên 4.0.6.',
    'Tách mạng khách (Guest) tại văn phòng HCM.',
  ], fixes: [
    'Sửa lỗi VPN ngắt kết nối sau 30 phút không hoạt động.',
    'Sửa lỗi camera công trường mất kết nối khi đổi IP động.',
  ] },
]

export const PRIO_LABEL = { urgent: 'Khẩn cấp', high: 'Quan trọng', medium: 'Bình thường', low: 'Thấp' }
export const PRIO_COLOR = { urgent: '#C2185B', high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--text-muted)' }
/* Hạng mục yêu cầu */
export const TICKET_CATEGORIES = [['hardware', 'Phần cứng'], ['software', 'Phần mềm'], ['network', 'Mạng & kết nối'], ['account', 'Tài khoản & quyền'], ['other', 'Khác']]

/* [nhãn, màu chữ, màu nền] */
export const TICKET_STATUS = {
  moi: ['Mới', 'var(--primary)', 'var(--primary-tint)'],
  dangxuly: ['Đang xử lý', 'var(--warn)', 'var(--warn-tint)'],
  chodoi: ['Chờ linh kiện', 'var(--danger)', 'var(--danger-tint)'],
  hoanthanh: ['Hoàn thành', 'var(--success)', 'var(--success-tint)'],
  dong: ['Đóng', 'var(--text-muted)', 'var(--surface-alt)'],
}

export const ASSETS = [
  { name: 'Dell Latitude 5420', type: 'Laptop', owner: 'Nguyễn Văn Long — Kế toán', status: 'active' },
  { name: 'HP ProBook 450 G9', type: 'Laptop', owner: 'Trần Thị Hoa — Kỹ sư công trường', status: 'active' },
  { name: 'Server Dell PowerEdge R440', type: 'Máy chủ', owner: 'Phòng server chính', status: 'active' },
  { name: 'Camera an ninh Hikvision (x12)', type: 'Camera công trường', owner: 'Công trường Quận 9', status: 'active' },
  { name: 'Router Ubiquiti UniFi Dream Machine', type: 'Thiết bị mạng', owner: 'Văn phòng HCM', status: 'maintenance' },
  { name: 'Máy in Canon LBP2900', type: 'Máy in', owner: 'Phòng kế toán', status: 'broken' },
]

export const ASSET_STATUS = {
  active: ['Đang hoạt động', 'var(--success)', 'var(--success-tint)'],
  maintenance: ['Cần bảo trì', 'var(--warn)', 'var(--warn-tint)'],
  broken: ['Hỏng, chờ sửa', 'var(--danger)', 'var(--danger-tint)'],
}

export const isOpenTicket = t => t.status !== 'hoanthanh' && t.status !== 'dong'

/* ---------- Trang yêu cầu (kanban quy trình xử lý) ---------- */
const st = (key, label, color, depts, owners, extra = {}) => ({ key, label, color, depts, owners, ...extra })
export const IT_STAGES = [
  st('tiepnhan', 'Tiếp nhận', '#8A8F98', ['IT'], ['Lê Trung Kiên']),
  st('chandoan', 'Chẩn đoán & phân loại', '#3B82F6', ['IT'], ['Lê Trung Kiên']),
  st('xuly', 'Đang xử lý', '#F59E0B', ['IT'], ['Đoàn Gia Bảo']),
  st('cho', 'Chờ linh kiện / phản hồi', '#E04848', ['Mua hàng'], ['Cao Nhật Tân']),
  st('kiemtra', 'Kiểm tra & bàn giao', '#8B5CF6', ['IT'], ['Lê Trung Kiên']),
  st('xong', 'Hoàn thành', '#16A34A', [], [], { done: true }),
  st('huy', 'Hủy', '#64748B', [], [], { closed: true }),
]
export const IT_FLOW_TEMPLATES = [
  { key: 'standard', label: 'Tiêu chuẩn', desc: 'Tiếp nhận → chẩn đoán → xử lý → chờ → kiểm tra → hoàn thành', stages: IT_STAGES },
  { key: 'quick', label: 'Xử lý nhanh', desc: 'Yêu cầu đơn giản (mật khẩu, quyền truy cập): bỏ chẩn đoán & chờ', stages: [
    st('tiepnhan', 'Tiếp nhận', '#8A8F98', ['IT'], ['Đoàn Gia Bảo']),
    st('xuly', 'Đang xử lý', '#F59E0B', ['IT'], ['Đoàn Gia Bảo']),
    st('xong', 'Hoàn thành', '#16A34A', [], [], { done: true }),
    st('huy', 'Hủy', '#64748B', [], [], { closed: true }),
  ] },
  { key: 'purchase', label: 'Cần mua thiết bị', desc: 'Có đề xuất mua: duyệt chi phí → mua hàng → lắp đặt', stages: [
    st('tiepnhan', 'Tiếp nhận', '#8A8F98', ['IT'], ['Lê Trung Kiên']),
    st('chandoan', 'Khảo sát & đề xuất', '#3B82F6', ['IT'], ['Lê Trung Kiên']),
    st('duyet', 'Duyệt chi phí', '#D9822B', ['Khối vận hành (COO)', 'Tài chính - Kế toán'], ['Lâm Thanh Tùng', 'Phan Bảo Ngọc']),
    st('cho', 'Mua hàng', '#E04848', ['Mua hàng'], ['Cao Nhật Tân']),
    st('xuly', 'Lắp đặt & cấu hình', '#F59E0B', ['IT'], ['Đoàn Gia Bảo']),
    st('kiemtra', 'Kiểm tra & bàn giao', '#8B5CF6', ['IT'], ['Lê Trung Kiên']),
    st('xong', 'Hoàn thành', '#16A34A', [], [], { done: true }),
    st('huy', 'Hủy', '#64748B', [], [], { closed: true }),
  ] },
]

/* Hạng mục của yêu cầu cũ (chưa có trường category) — suy ra từ nội dung */
export function categoryOf(t) {
  if (t.category) return t.category
  const x = t.issue.toLowerCase()
  if (/wifi|vpn|mạng|camera|tín hiệu|router/.test(x)) return 'network'
  if (/mật khẩu|tài khoản|quyền|chữ ký|dung lượng|khoá sau/.test(x)) return 'account'
  if (/cài|license|phần mềm|excel|outlook|teams|autocad|revit|chạy chậm|email/.test(x)) return 'software'
  return 'hardware'
}
const TASKS_BY_CATEGORY = {
  hardware: ['Kiểm tra hiện trạng thiết bị', 'Xác định linh kiện / nguyên nhân hỏng', 'Đặt linh kiện thay thế', 'Thay thế & cấu hình lại', 'Bàn giao & hướng dẫn người dùng'],
  software: ['Xác nhận lỗi / yêu cầu với người dùng', 'Kiểm tra bản quyền & cấu hình máy', 'Cài đặt / cập nhật phần mềm', 'Kiểm thử chức năng', 'Bàn giao & hướng dẫn sử dụng'],
  network: ['Khảo sát tín hiệu tại vị trí', 'Kiểm tra thiết bị mạng & cấu hình', 'Bổ sung / thay thiết bị phát', 'Đo kiểm tốc độ & độ ổn định', 'Bàn giao cho người dùng'],
  account: ['Xác minh danh tính người yêu cầu', 'Cấp / khôi phục tài khoản & quyền', 'Thông báo & hướng dẫn người dùng'],
  other: ['Tiếp nhận & làm rõ yêu cầu', 'Xử lý yêu cầu', 'Bàn giao kết quả'],
}
/* Công việc của 1 yêu cầu — sinh từ hạng mục & trạng thái hiện tại */
export function buildTicketTasks(t, executors = []) {
  const titles = TASKS_BY_CATEGORY[categoryOf(t)] || TASKS_BY_CATEGORY.other
  const n = titles.length
  const exec = executors.length ? executors : [t.assignee].filter(Boolean)
  const stageOf = i => {
    if (t.status === 'hoanthanh') return 'xong'
    if (t.status === 'dong') return i === 0 ? 'xong' : 'huy'
    if (t.status === 'moi') return 'tiepnhan'
    if (t.status === 'chodoi') return i < Math.ceil(n / 2) - 1 ? 'xong' : i === Math.ceil(n / 2) - 1 ? 'cho' : 'tiepnhan'
    return i < 1 ? 'xong' : i === 1 ? 'xuly' : i === 2 ? 'chandoan' : 'tiepnhan' // đang xử lý
  }
  return titles.map((title, i) => ({
    id: `${t.id}-${i + 1}`, code: `#${t.id}.${i + 1}`, title, sub: '', due: i === n - 1 ? (t.deadline || '') : '',
    assignees: i === 0 ? [t.assignee || 'Lê Trung Kiên'].filter(Boolean) : exec, dept: 'IT', stage: stageOf(i),
  }))
}
/* Trạng thái yêu cầu suy ra từ công việc trên bảng */
export function statusFromTasks(tasks, stages, fallback) {
  const k = Object.fromEntries(stages.map(x => [x.key, x]))
  const live = tasks.filter(x => !k[x.stage]?.closed)
  if (!tasks.length) return fallback
  if (!live.length) return 'dong'
  if (live.every(x => k[x.stage]?.done)) return 'hoanthanh'
  if (live.some(x => /cho/.test(x.stage) || /chờ|mua hàng|duyệt/i.test(k[x.stage]?.label || ''))) return 'chodoi'
  if (live.some(x => !k[x.stage]?.done && x.stage !== 'tiepnhan')) return 'dangxuly'
  return live.some(x => k[x.stage]?.done) ? 'dangxuly' : 'moi'
}
