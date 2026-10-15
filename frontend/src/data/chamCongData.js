/* Dữ liệu mẫu & tiện ích cho trang HR · Chấm công (cham-cong.html) */

/* ---------- Chấm công: theo ngày ---------- */
export const SITE_SUMMARY = [
  { name: 'Riverside — Tòa A', present: '62 / 70 có mặt', color: 'attendance' },
  { name: 'Riverside — Tòa B', present: '41 / 50 có mặt', color: 'attendance' },
  { name: 'Kho vật tư Bình Chánh', present: '25 / 30 có mặt', color: 'finance', outOfZone: '1 ngoài vùng' },
]

/* status: ok | late | none | outzone */
export const DAILY_ROWS = [
  { initials: 'LV', name: 'Lê Văn', color: '#0E8A82', fg: 'var(--attendance)', team: 'Đội thi công A', site: 'Riverside — Tòa A', in: '06:58', total: '8h12*', status: 'ok' },
  { initials: 'NH', name: 'Ngọc Hà', color: '#B7791F', fg: 'var(--finance)', team: 'Đội thi công B', site: 'Riverside — Tòa A', in: '07:02', total: '8h05*', status: 'ok' },
  { initials: 'PB', name: 'Phạm Quốc Bảo', color: '#2F5DA8', fg: 'var(--primary)', team: 'Đội thi công A', site: 'Riverside — Tòa A', in: '07:15', total: '7h50*', status: 'late', lateLabel: 'Trễ 15 phút' },
  { initials: 'HB', name: 'Hoàng Gia Bảo', color: '#7658C2', fg: '#7658C2', team: 'Đội hoàn thiện', site: 'Riverside — Tòa A', in: '07:20', total: '7h45*', status: 'late', lateLabel: 'Trễ 20 phút' },
  { initials: 'NL', name: 'Ngô Thị Lan', color: '#C2618F', fg: '#C2618F', team: 'Đội MEP', site: 'Riverside — Tòa A', in: '06:50', total: '8h15*', status: 'ok' },
  { initials: 'VN', name: 'Vũ Hải Nam', color: '#2F5DA8', fg: 'var(--primary)', team: 'Đội thi công B', site: 'Riverside — Tòa B', in: '06:55', total: '8h10*', status: 'ok' },
  { initials: 'TS', name: 'Trịnh Xuân Sơn', color: '#6B7280', fg: 'var(--text-muted)', team: 'Đội thi công C', site: 'Riverside — Tòa B', in: null, total: null, status: 'none' },
  { initials: 'DP', name: 'Đặng Hữu Phúc', color: '#0E8A82', fg: 'var(--attendance)', team: 'Nhân sự', site: 'Riverside — Tòa B', in: '08:00', total: '6h30*', status: 'ok' },
  { initials: 'CT', name: 'Cao Nhật Tân', color: '#C0392B', fg: 'var(--danger)', team: 'Mua hàng', site: 'Kho vật tư Bình Chánh', in: '07:10', total: '7h55*', status: 'outzone' },
  { initials: 'LT', name: 'Lý Thu Trang', color: '#C2618F', fg: '#C2618F', team: 'Cung ứng', site: 'Kho vật tư Bình Chánh', in: '07:05', total: '8h00*', status: 'ok' },
]

/* ---------- Chấm công: theo nhân viên ---------- */
export const STAFF_ROWS = [
  { initials: 'LV', name: 'Lê Văn', color: '#0E8A82', fg: 'var(--attendance)', team: 'Đội thi công A', days: 5, total: '41h00', avg: '8h12' },
  { initials: 'NH', name: 'Ngọc Hà', color: '#B7791F', fg: 'var(--finance)', team: 'Đội thi công B', days: 5, total: '40h30', avg: '8h06' },
  { initials: 'PB', name: 'Phạm Quốc Bảo', color: '#2F5DA8', fg: 'var(--primary)', team: 'Đội thi công A', days: 4, total: '32h10', avg: '8h02' },
  { initials: 'VN', name: 'Vũ Hải Nam', color: '#2F5DA8', fg: 'var(--primary)', team: 'Đội thi công B', days: 5, total: '40h45', avg: '8h09' },
  { initials: 'CT', name: 'Cao Nhật Tân', color: '#C0392B', fg: 'var(--danger)', team: 'Mua hàng', days: 5, total: '39h20', avg: '7h52' },
]

/* ---------- Hồ sơ nhân sự ---------- */
export const HR_DEPTS = ['Quản lý dự án', 'Marketing', 'Kinh doanh', 'Thi công', 'Vận hành', 'Tài chính']
export const HR_DEPT_COLOR = {
  'Quản lý dự án': { c: '--primary', t: '--primary-tint' },
  Marketing: { c: '--marketing', t: '--marketing-tint' },
  'Kinh doanh': { c: '--sales', t: '--sales-tint' },
  'Thi công': { c: '--danger', t: '--danger-tint' },
  'Vận hành': { c: '--text-muted', t: '--surface-alt' },
  'Tài chính': { c: '--finance', t: '--finance-tint' },
}
export const HR_STATUS_LABEL = { active: 'Đang làm việc', probation: 'Thử việc', left: 'Đã nghỉ việc' }
export const HR_STATUS_COLOR = {
  active: { c: '--success', t: '--success-tint' },
  probation: { c: '--finance', t: '--finance-tint' },
  left: { c: '--danger', t: '--danger-tint' },
}
export const HR_CONTRACT_TYPES = [
  { value: 'Thử việc', label: 'Thử việc' },
  { value: 'Xác định thời hạn', label: 'Xác định thời hạn (1-3 năm)' },
  { value: 'Không xác định thời hạn', label: 'Không xác định thời hạn' },
  { value: 'Thời vụ', label: 'Thời vụ' },
]
export const HR_LEVELS = ['Nhân viên', 'Chuyên viên', 'Trưởng nhóm', 'Trưởng phòng', 'Giám đốc']

export const INITIAL_EMPLOYEES = [
  { id: 1, code: 'NV001', name: 'Trần Anh', position: 'Quản lý dự án', dept: 'Quản lý dự án', phone: '0909 111 222', email: 'tran.anh@siteflow.vn', joinDate: '2022-03-01', status: 'active',
    cccd: '079089001234', dob: '1990-04-12', hometown: 'Hà Nội', emergencyName: 'Trần Bình', emergencyPhone: '0909 111 000', bankName: 'Vietcombank', bankAccount: '0071001234567',
    contractType: 'Không xác định thời hạn', level: 'Trưởng phòng', salary: '35000000', lineManager: 'Ban Giám đốc',
    promotions: [{ date: '2022-03-01', note: 'Gia nhập — Kỹ sư dự án' }, { date: '2024-01-01', note: 'Thăng chức — Quản lý dự án' }],
    attachments: [{ name: 'Hợp đồng lao động.pdf' }, { name: 'CV_Tran_Anh.pdf' }] },
  { id: 2, code: 'NV002', name: 'Đỗ Thảo Vy', position: 'Head Marketing', dept: 'Marketing', phone: '0909 222 333', email: 'thao.vy@siteflow.vn', joinDate: '2023-06-15', status: 'active',
    cccd: '079089002345', dob: '1993-08-20', hometown: 'Hải Phòng', emergencyName: 'Đỗ Văn Hùng', emergencyPhone: '0909 222 000', bankName: 'Techcombank', bankAccount: '19071002345678',
    contractType: 'Không xác định thời hạn', level: 'Trưởng nhóm', salary: '25000000', lineManager: 'Trần Anh',
    promotions: [{ date: '2023-06-15', note: 'Gia nhập — Head Marketing' }],
    attachments: [{ name: 'Hợp đồng lao động.pdf' }] },
  { id: 3, code: 'NV003', name: 'Ngọc Hà', position: 'Graphic Designer', dept: 'Marketing', phone: '0909 333 444', email: 'ngoc.ha@siteflow.vn', joinDate: '2024-01-10', status: 'active',
    cccd: '079089003456', dob: '1998-02-14', hometown: 'Nam Định', emergencyName: 'Nguyễn Thu', emergencyPhone: '0909 333 000', bankName: 'ACB', bankAccount: '21903456789',
    contractType: 'Xác định thời hạn', level: 'Nhân viên', salary: '14000000', lineManager: 'Đỗ Thảo Vy',
    promotions: [{ date: '2024-01-10', note: 'Gia nhập — Graphic Designer' }],
    attachments: [] },
  { id: 4, code: 'NV004', name: 'Minh Quân', position: 'Media (quay, dựng video)', dept: 'Marketing', phone: '0909 444 555', email: 'minh.quan@siteflow.vn', joinDate: '2023-09-05', status: 'active',
    cccd: '079089004567', dob: '1996-11-02', hometown: 'Thanh Hóa', emergencyName: 'Lê Thị Mai', emergencyPhone: '0909 444 000', bankName: 'BIDV', bankAccount: '12104567890',
    contractType: 'Không xác định thời hạn', level: 'Chuyên viên', salary: '16000000', lineManager: 'Đỗ Thảo Vy',
    promotions: [{ date: '2023-09-05', note: 'Gia nhập — Media' }],
    attachments: [{ name: 'Bằng đại học.pdf' }] },
  { id: 5, code: 'NV005', name: 'Thuỳ Dương', position: 'Content Creator', dept: 'Marketing', phone: '0909 555 666', email: 'thuy.duong@siteflow.vn', joinDate: '2024-11-20', status: 'active',
    cccd: '079089005678', dob: '1999-05-30', hometown: 'Nghệ An', emergencyName: 'Phạm Văn Sơn', emergencyPhone: '0909 555 000', bankName: 'MB Bank', bankAccount: '03305678901',
    contractType: 'Thử việc', level: 'Nhân viên', salary: '10000000', lineManager: 'Đỗ Thảo Vy',
    promotions: [{ date: '2024-11-20', note: 'Gia nhập — Content Creator' }],
    attachments: [] },
  { id: 6, code: 'NV006', name: 'Hoàng Yến Nhi', position: 'Nhân viên KD — Phòng Dân dụng', dept: 'Kinh doanh', phone: '0909 666 777', email: 'yen.nhi@siteflow.vn', joinDate: '2024-02-12', status: 'active',
    cccd: '079089006789', dob: '1997-07-07', hometown: 'Bắc Ninh', emergencyName: 'Hoàng Văn Long', emergencyPhone: '0909 666 000', bankName: 'Vietinbank', bankAccount: '10206789012',
    contractType: 'Xác định thời hạn', level: 'Nhân viên', salary: '12000000', lineManager: 'Đặng Quốc Cường',
    promotions: [{ date: '2024-02-12', note: 'Gia nhập — Nhân viên KD' }],
    attachments: [] },
  { id: 7, code: 'NV007', name: 'Đặng Quốc Cường', position: 'Nhân viên KD — Phòng Dự án', dept: 'Kinh doanh', phone: '0909 777 888', email: 'quoc.cuong@siteflow.vn', joinDate: '2023-07-03', status: 'active',
    cccd: '079089007890', dob: '1992-09-18', hometown: 'Hà Nam', emergencyName: 'Đặng Thị Lan', emergencyPhone: '0909 777 000', bankName: 'Vietcombank', bankAccount: '0077890123',
    contractType: 'Không xác định thời hạn', level: 'Trưởng nhóm', salary: '20000000', lineManager: 'Trần Anh',
    promotions: [{ date: '2023-07-03', note: 'Gia nhập — Nhân viên KD' }, { date: '2025-01-01', note: 'Thăng chức — Trưởng nhóm KD Dự án' }],
    attachments: [{ name: 'Hợp đồng lao động.pdf' }] },
  { id: 8, code: 'NV008', name: 'Nguyễn Đức Anh', position: 'Chỉ huy trưởng công trường', dept: 'Thi công', phone: '0909 888 999', email: 'duc.anh@siteflow.vn', joinDate: '2022-04-18', status: 'active',
    cccd: '079089008901', dob: '1988-01-25', hometown: 'Ninh Bình', emergencyName: 'Nguyễn Thị Hoa', emergencyPhone: '0909 888 000', bankName: 'Agribank', bankAccount: '34018901234',
    contractType: 'Không xác định thời hạn', level: 'Trưởng phòng', salary: '28000000', lineManager: 'Trần Anh',
    promotions: [{ date: '2022-04-18', note: 'Gia nhập — Chỉ huy trưởng' }],
    attachments: [{ name: 'Chứng chỉ hành nghề xây dựng.pdf' }, { name: 'Hợp đồng lao động.pdf' }] },
  { id: 9, code: 'NV009', name: 'Đỗ Thành Long', position: 'Tư vấn giám sát', dept: 'Thi công', phone: '0909 999 000', email: 'thanh.long@siteflow.vn', joinDate: '2022-05-25', status: 'active',
    cccd: '079089009012', dob: '1991-12-03', hometown: 'Thái Bình', emergencyName: 'Đỗ Thị Nga', emergencyPhone: '0909 999 111', bankName: 'Techcombank', bankAccount: '19079012345',
    contractType: 'Không xác định thời hạn', level: 'Chuyên viên', salary: '18000000', lineManager: 'Nguyễn Đức Anh',
    promotions: [{ date: '2022-05-25', note: 'Gia nhập — Tư vấn giám sát' }],
    attachments: [] },
  { id: 10, code: 'NV010', name: 'Vũ Thị Diệu', position: 'Giám sát an toàn lao động', dept: 'Thi công', phone: '0912 111 222', email: 'thi.dieu@siteflow.vn', joinDate: '2024-08-14', status: 'probation',
    cccd: '079089010123', dob: '2000-03-09', hometown: 'Vĩnh Phúc', emergencyName: 'Vũ Văn Kiên', emergencyPhone: '0912 111 000', bankName: 'ACB', bankAccount: '21910123456',
    contractType: 'Thử việc', level: 'Nhân viên', salary: '9000000', lineManager: 'Nguyễn Đức Anh',
    promotions: [{ date: '2024-08-14', note: 'Gia nhập — Giám sát an toàn lao động' }],
    attachments: [] },
  { id: 11, code: 'NV011', name: 'Cao Nhật Tân', position: 'Mua hàng & cung ứng', dept: 'Vận hành', phone: '0912 222 333', email: 'nhat.tan@siteflow.vn', joinDate: '2023-10-09', status: 'active',
    cccd: '079089011234', dob: '1994-06-16', hometown: 'Hưng Yên', emergencyName: 'Cao Thị Hằng', emergencyPhone: '0912 222 000', bankName: 'BIDV', bankAccount: '12111234567',
    contractType: 'Xác định thời hạn', level: 'Chuyên viên', salary: '15000000', lineManager: 'Trần Anh',
    promotions: [{ date: '2023-10-09', note: 'Gia nhập — Mua hàng & cung ứng' }],
    attachments: [] },
  { id: 12, code: 'NV012', name: 'Lý Thu Trang', position: 'Kế toán', dept: 'Tài chính', phone: '0912 333 444', email: 'thu.trang@siteflow.vn', joinDate: '2023-01-01', status: 'left',
    cccd: '079089012345', dob: '1995-10-22', hometown: 'Hải Dương', emergencyName: 'Lý Văn Đức', emergencyPhone: '0912 333 000', bankName: 'MB Bank', bankAccount: '03312345678',
    contractType: 'Xác định thời hạn', level: 'Nhân viên', salary: '13000000', lineManager: 'Trần Anh',
    promotions: [{ date: '2023-01-01', note: 'Gia nhập — Kế toán' }],
    attachments: [{ name: 'Hợp đồng lao động.pdf' }] },
]

export function hrFmtMoney(v) {
  const n = parseInt(v, 10)
  if (isNaN(n)) return '—'
  return n.toLocaleString('vi-VN') + ' đ'
}
export function hrFmtDate(iso) {
  const p = iso.split('-')
  return `${p[2]}/${p[1]}/${p[0]}`
}
/* Chữ cái đầu của tên (từ cuối cùng), giống bản HTML */
export function hrInitials(name) {
  const parts = name.trim().split(/\s+/)
  return (parts[parts.length - 1][0] || '').toUpperCase()
}
export function hrMatchesTimeFilter(iso, range) {
  if (range === 'all') return true
  const d = new Date(iso + 'T00:00:00')
  const now = new Date()
  if (range === 'week') {
    const day = (now.getDay() + 6) % 7
    const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(start.getDate() + 7)
    return d >= start && d < end
  }
  if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  if (range === 'quarter') return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3)
  if (range === 'year') return d.getFullYear() === now.getFullYear()
  return true
}

/* ---------- Bảng lương ---------- */
export const PAYROLL_ROWS = [
  { name: 'Trần Anh', position: 'Quản lý dự án', gross: '25.000.000', ins: '2.625.000', net: '22.375.000', paid: true },
  { name: 'Đỗ Thảo Vy', position: 'Head Marketing', gross: '18.000.000', ins: '1.890.000', net: '16.110.000', paid: true },
  { name: 'Nguyễn Đức Anh', position: 'Chỉ huy trưởng công trường', gross: '20.000.000', ins: '2.100.000', net: '17.900.000', paid: true },
  { name: 'Minh Quân', position: 'Media (quay, dựng video)', gross: '16.000.000', ins: '1.680.000', net: '14.320.000', paid: true },
  { name: 'Đỗ Thành Long', position: 'Tư vấn giám sát', gross: '16.000.000', ins: '1.680.000', net: '14.320.000', paid: false },
  { name: 'Ngọc Hà', position: 'Graphic Designer', gross: '15.000.000', ins: '1.575.000', net: '13.425.000', paid: true },
  { name: 'Thuỳ Dương', position: 'Content Creator', gross: '14.000.000', ins: '1.470.000', net: '12.530.000', paid: true },
  { name: 'Đặng Quốc Cường', position: 'Nhân viên KD — Phòng Dự án', gross: '13.000.000', ins: '1.365.000', net: '11.635.000', paid: true },
  { name: 'Cao Nhật Tân', position: 'Mua hàng & cung ứng', gross: '13.000.000', ins: '1.365.000', net: '11.635.000', paid: true },
  { name: 'Hoàng Yến Nhi', position: 'Nhân viên KD — Phòng Dân dụng', gross: '12.000.000', ins: '1.260.000', net: '10.740.000', paid: true },
  { name: 'Vũ Thị Diệu', position: 'Giám sát an toàn lao động', gross: '12.000.000', ins: '1.260.000', net: '10.740.000', paid: false },
]

/* ---------- Hành chính ---------- */
export const DOCUMENTS = [
  { code: 'CV-2026/041', title: 'Quy định giờ làm việc mùa mưa công trường', type: 'Nội bộ', typeColor: 'primary', issuer: 'Phòng HC-NS', date: '20/09/2026', status: 'Đã ban hành', statusColor: 'success' },
  { code: 'CV-2026/040', title: 'Thông báo nghỉ lễ Quốc khánh 2/9', type: 'Thông báo', typeColor: 'primary', issuer: 'Ban giám đốc', date: '28/08/2026', status: 'Đã ban hành', statusColor: 'success' },
  { code: 'CV-2026/039', title: 'Đề xuất mua sắm thiết bị bảo hộ lao động Q4', type: 'Đề xuất', typeColor: 'finance', issuer: 'Phòng HC-NS', date: '15/09/2026', status: 'Chờ duyệt', statusColor: 'finance' },
  { code: 'CV-2026/038', title: 'Quy chế khen thưởng nhân sự xuất sắc quý 3', type: 'Nội bộ', typeColor: 'primary', issuer: 'Ban giám đốc', date: '10/09/2026', status: 'Đã ban hành', statusColor: 'success' },
]
export const EXPIRING_CONTRACTS = [
  { name: 'Vũ Thị Diệu', position: 'Giám sát an toàn lao động', type: 'Thử việc (2 tháng)', date: '14/10/2026', color: 'danger', status: 'Cần gia hạn' },
  { name: 'Cao Nhật Tân', position: 'Mua hàng & cung ứng', type: 'Xác định thời hạn (1 năm)', date: '09/10/2026', color: 'finance', status: 'Sắp hết hạn' },
]

/* ---------- Tuyển dụng ---------- */
export const OPEN_JOBS = [
  { title: 'Kỹ sư giám sát công trình', dept: 'Phòng Thi công · 2 vị trí', apps: '5 hồ sơ ứng tuyển' },
  { title: 'Kiến trúc sư thiết kế', dept: 'Phòng Thiết kế · 1 vị trí', apps: '4 hồ sơ ứng tuyển' },
  { title: 'Nhân viên kinh doanh dự án', dept: 'Phòng Kinh doanh · 2 vị trí', apps: '3 hồ sơ ứng tuyển' },
  { title: 'Kế toán nội bộ', dept: 'Phòng Tài chính · 1 vị trí', apps: '2 hồ sơ ứng tuyển' },
]
export const CANDIDATES = [
  { name: 'Lê Hoàng Phúc', position: 'Kỹ sư giám sát công trình', source: 'LinkedIn', stage: 'Phỏng vấn vòng 2', stageColor: 'finance', date: '12/09/2026', owner: 'Trịnh Minh Tâm' },
  { name: 'Phạm Thu Uyên', position: 'Kiến trúc sư thiết kế', source: 'Giới thiệu nội bộ', stage: 'Phỏng vấn vòng 1', stageColor: 'finance', date: '18/09/2026', owner: 'Trịnh Minh Tâm' },
  { name: 'Ngô Bảo Châu', position: 'Nhân viên kinh doanh dự án', source: 'TopCV', stage: 'Sàng lọc CV', stageColor: 'primary', date: '22/09/2026', owner: 'Lý Ngọc Diệp' },
  { name: 'Đinh Gia Huy', position: 'Kế toán nội bộ', source: 'VietnamWorks', stage: 'Đề nghị offer', stageColor: 'success', date: '05/09/2026', owner: 'Lý Ngọc Diệp' },
  { name: 'Trần Bảo Long', position: 'Kỹ sư giám sát công trình', source: 'LinkedIn', stage: 'Đã từ chối', stageColor: 'danger', date: '28/08/2026', owner: 'Trịnh Minh Tâm', rejected: true },
]

/* ---------- Dezbot ---------- */
export const AI_KB = {
  tiendo: 'Dự án "Chung cư Riverside GĐ2" đang hoàn thành 62% khối lượng — đúng tiến độ tổng thể. Hạng mục "Hoàn thiện" có 2 đầu việc đang trễ hạn, cần ưu tiên xử lý trong tuần này.',
  chamcong: 'Tháng này có 18/20 ngày công đủ giờ, 1 lần đi trễ, 0 lần nghỉ không phép. Toàn công ty: 18/21 nhân sự chấm công đúng giờ hôm nay, tỷ lệ chuyên cần 94%.',
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
export const AI_SUGGESTIONS = ['Hôm nay ai đi trễ hoặc vắng?', 'Ai đang xin nghỉ phép tuần này?', 'Tóm tắt bảng lương tháng này']
export function matchTopic(text) {
  const t = text.toLowerCase()
  const has = (...keys) => keys.some(k => t.indexOf(k) > -1)
  if (has('tiến độ', 'tien do', 'dự án')) return 'tiendo'
  if (has('chấm công', 'nhân công', 'nhân sự', 'nghỉ phép', 'đi trễ', 'vắng', 'lương')) return 'chamcong'
  if (has('dòng tiền', 'hoá đơn', 'hóa đơn', 'thu', 'chi')) return 'dongtien'
  if (has('khách hàng', 'hợp đồng')) return 'khachhang'
  if (has('tin nhắn', 'chat')) return 'tinnhan'
  if (has('bóc tách', 'mua hàng', 'vật tư')) return 'boctach'
  if (has('quy trình')) return 'quytrinh'
  return 'default'
}
