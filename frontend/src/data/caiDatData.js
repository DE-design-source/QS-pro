/* Dữ liệu trang Cài đặt — lấy nguyên từ cai-dat.html */

/* ---------- Giao diện ---------- */
export const ACCENTS = [
  { key: 'blue', color: '#2F5DA8', title: 'Xanh dương' },
  { key: 'purple', color: '#6D4FC2', title: 'Tím' },
  { key: 'green', color: '#1E8E5A', title: 'Xanh lá' },
  { key: 'orange', color: '#B7791F', title: 'Cam' },
  { key: 'red', color: '#C0392B', title: 'Đỏ' },
  { key: 'teal', color: '#0E8A82', title: 'Ngọc lam' },
]

/* font: giá trị lưu vào siteflow-customize.fontFamily ('' = Montserrat mặc định) */
export const FONTS = [
  { font: '', preview: "'Montserrat', sans-serif", label: 'Montserrat', note: 'Mặc định' },
  { font: "'Be Vietnam Pro', sans-serif", preview: "'Be Vietnam Pro', sans-serif", label: 'Be Vietnam Pro', note: 'Tối ưu tiếng Việt' },
  { font: "'Inter', sans-serif", preview: "'Inter', sans-serif", label: 'Inter', note: 'Gọn, hiện đại' },
  { font: "'Roboto', sans-serif", preview: "'Roboto', sans-serif", label: 'Roboto', note: 'Quen thuộc' },
  { font: "'Nunito', sans-serif", preview: "'Nunito', sans-serif", label: 'Nunito', note: 'Bo tròn, thân thiện' },
  { font: "'Open Sans', sans-serif", preview: "'Open Sans', sans-serif", label: 'Open Sans', note: 'Dễ đọc' },
  { font: "'Lexend', sans-serif", preview: "'Lexend', sans-serif", label: 'Lexend', note: 'Rộng, thoáng' },
  { font: 'Arial, sans-serif', preview: 'Arial, sans-serif', label: 'Arial', note: 'Font hệ thống' },
]

/* percent: mức phóng tương ứng trên thanh chỉnh cỡ chữ */
export const FONT_SIZES = [
  { key: 'small', previewSize: 13, label: 'Nhỏ', note: '92%', percent: 92 },
  { key: 'medium', previewSize: 17, label: 'Vừa', note: '100%', percent: 100 },
  { key: 'large', previewSize: 21, label: 'Lớn', note: '112%', percent: 112 },
  { key: 'xlarge', previewSize: 25, label: 'Rất lớn', note: '124%', percent: 124 },
]

/* Nền hệ thống: key khớp với html[data-wallpaper="..."] trong liquid-glass.css; preview dùng cho thẻ xem trước */
export const WALLPAPERS = [
  { key: 'none', label: 'Không dùng', sub: 'Nền một màu theo chế độ sáng/tối', preview: 'var(--bg)' },
  {
    key: 'ios26', label: 'iOS 26 Liquid', sub: 'Xanh dương, tím, hồng san hô',
    preview: 'radial-gradient(60% 55% at 0% 0%, #A9CDEF 0%, transparent 60%), radial-gradient(55% 70% at 0% 78%, #2458C9 0%, transparent 65%), radial-gradient(60% 60% at 55% 4%, #8E4DEB 0%, transparent 65%), radial-gradient(50% 55% at 100% 18%, #B257E0 0%, transparent 60%), radial-gradient(55% 60% at 100% 100%, #F78F96 0%, transparent 62%), linear-gradient(120deg, #4C6FDC 0%, #7C4EDB 50%, #D873B4 100%)',
  },
]

/* Màu gợi ý thêm — áp dụng qua cơ chế "màu tự chọn" (accent = 'custom') */
export const EXTRA_ACCENTS = [
  { color: '#C2377A', title: 'Hồng' },
  { color: '#3D4FC4', title: 'Chàm' },
  { color: '#0B7FBF', title: 'Xanh trời' },
  { color: '#5C7A1F', title: 'Ô liu' },
  { color: '#8A5A2B', title: 'Nâu' },
  { color: '#475569', title: 'Xám đá' },
]

/* Độ trong suốt của bề mặt khi dùng bộ giao diện kính */
export const GLASS_LEVELS = [
  { key: 'soft', label: 'Đục', note: 'Dễ đọc nhất' },
  { key: 'medium', label: 'Vừa', note: 'Cân bằng' },
  { key: 'strong', label: 'Trong', note: 'Thấy rõ nền' },
]

/* ---------- Thông báo ---------- */
export const NOTIFY_CHANNELS = [
  { title: 'Tin nhắn Chat', desc: 'Thông báo khi có tin nhắn mới', on: true },
  { title: 'Cảnh báo tiến độ trễ hạn', desc: 'Từ module Quản lý dự án', on: true },
  { title: 'Đơn mua hàng cần duyệt', desc: 'Từ module Mua hàng', on: false },
  { title: 'Bản tin tổng hợp email hàng tuần', desc: 'Gửi mỗi thứ Hai lúc 8:00', on: false },
]

/* ---------- Workspace ---------- */
export const WORKSPACE_MEMBERS = [
  { name: 'Trần Anh', role: 'Quản lý dự án', perm: 'Quản trị', admin: true },
  { name: 'Đỗ Thảo Vy', role: 'Head Marketing', perm: 'Thành viên', admin: false },
  { name: 'Nguyễn Đức Anh', role: 'Chỉ huy trưởng', perm: 'Thành viên', admin: false },
]

/* ---------- Đổi thưởng ---------- */
export const REWARDS = [
  { name: 'Phiếu ăn trưa miễn phí (1 tuần)', cost: 300, active: true },
  { name: 'Voucher nhà hàng 500.000đ', cost: 500, active: true },
  { name: 'Áo thun đồng phục cao cấp', cost: 400, active: true },
  { name: 'Khoá học kỹ năng đàm phán', cost: 700, active: true },
  { name: 'Ngày nghỉ phép thêm (1 ngày)', cost: 1000, active: true },
  { name: 'iPad Gen 10', cost: 1800, active: true },
  { name: 'Vé máy bay khứ hồi nội địa', cost: 2200, active: true },
  { name: 'Chuyến du lịch team quý (2 ngày 1 đêm)', cost: 2500, active: true },
  { name: 'iPhone 15', cost: 5000, active: true },
  { name: 'Thưởng tiền mặt 1.000.000đ', cost: 3000, active: false },
]

export const REWARD_RULES = [
  'Nhân sự tích điểm khi hoàn thành nhiệm vụ được gắn điểm thưởng tại các phòng ban (Kinh doanh, Dự án…).',
  'Điểm được cộng vào ví điểm cá nhân ngay khi nhiệm vụ được xác nhận hoàn thành.',
  'Phần thưởng ở trạng thái "Tạm ẩn" sẽ không hiển thị trong ví đổi thưởng của nhân sự.',
]

/* ---------- Phân quyền theo nhóm chức vụ ---------- */
export const PERM_MODULES = [
  { key: 'newsfeed', label: 'Newsfeed' },
  { key: 'chat', label: 'Chat' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'kinhdoanh', label: 'Kinh doanh' },
  { key: 'thietke', label: 'Q.lý thiết kế' },
  { key: 'duan', label: 'Q.lý dự án' },
  { key: 'hr', label: 'HR' },
  { key: 'taichinh', label: 'Tài chính' },
  { key: 'qs', label: 'QS' },
  { key: 'bim', label: 'BIM' },
  { key: 'muahang', label: 'Mua hàng' },
  { key: 'sanxuat', label: 'Sản xuất' },
  { key: 'it', label: 'IT' },
  { key: 'rd', label: 'R&D' },
  { key: 'wiki', label: 'Wiki' },
]

export function permAllTrue() {
  const o = {}
  PERM_MODULES.forEach(m => { o[m.key] = true })
  return o
}
export function permOnly(keys) {
  const o = {}
  PERM_MODULES.forEach(m => { o[m.key] = keys.indexOf(m.key) !== -1 })
  return o
}

/* Tạo mới mỗi lần gọi để state của trang không dùng chung object */
export function createRoleGroups() {
  return [
    { name: 'BOD (Ban giám đốc)', members: 3, canAssign: true, canApprove: true, perms: permAllTrue() },
    { name: 'Kế toán', members: 4, canAssign: false, canApprove: true, perms: permOnly(['newsfeed', 'chat', 'taichinh', 'muahang', 'wiki']) },
    { name: 'Quản lý dự án', members: 6, canAssign: true, canApprove: true, perms: permOnly(['newsfeed', 'chat', 'kinhdoanh', 'thietke', 'duan', 'qs', 'bim', 'muahang', 'sanxuat', 'wiki']) },
    { name: 'Nhân viên', members: 38, canAssign: false, canApprove: false, perms: permOnly(['newsfeed', 'chat', 'wiki']) },
  ]
}

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

export const AI_SUGGESTIONS = ['Tóm tắt tình hình dự án hôm nay', 'Hoá đơn nào quá hạn?', 'Ai chưa chấm công hôm nay?']

export function matchTopic(text) {
  const t = text.toLowerCase()
  if (t.indexOf('tiến độ') > -1 || t.indexOf('tien do') > -1 || t.indexOf('dự án') > -1) return 'tiendo'
  if (t.indexOf('chấm công') > -1 || t.indexOf('nhân công') > -1 || t.indexOf('nhân sự') > -1 || t.indexOf('nghỉ phép') > -1) return 'chamcong'
  if (t.indexOf('dòng tiền') > -1 || t.indexOf('hoá đơn') > -1 || t.indexOf('hóa đơn') > -1 || t.indexOf('thu') > -1 || t.indexOf('chi') > -1) return 'dongtien'
  if (t.indexOf('khách hàng') > -1 || t.indexOf('hợp đồng') > -1) return 'khachhang'
  if (t.indexOf('tin nhắn') > -1 || t.indexOf('chat') > -1) return 'tinnhan'
  if (t.indexOf('bóc tách') > -1 || t.indexOf('mua hàng') > -1 || t.indexOf('vật tư') > -1) return 'boctach'
  if (t.indexOf('quy trình') > -1) return 'quytrinh'
  return 'default'
}
