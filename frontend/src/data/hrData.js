/* Dữ liệu mẫu cho phân hệ HR (bản dựng lại): hồ sơ nhân sự, sơ đồ tổ chức, chấm công & phép.
   Mọi số liệu là dữ liệu giả lập, sinh cố định (không ngẫu nhiên) để giao diện ổn định giữa các lần tải. */

export const HR_TODAY = '2026-09-23'
export const HR_TODAY_LABEL = 'Thứ Tư, 23/09/2026'

/* ---------- Cơ cấu tổ chức (theo sơ đồ "Cơ cấu tổ chức.pdf") ----------
   type: governance (Hội đồng quản trị) | board (ban trực thuộc CEO, vẽ bên cạnh) | exec (khối điều hành CEO/COO/CCO) | dept (phòng ban)
   label: tên hiển thị trên sơ đồ · name: tên đơn vị dùng trong hồ sơ, bộ lọc */
export const INITIAL_ORG_UNITS = [
  { key: 'hdqt', label: 'Hội đồng quản trị', name: 'Hội đồng quản trị', type: 'governance', parent: null, tone: 'qs', desc: 'Cơ quan quản trị cao nhất, quyết định chiến lược & bổ nhiệm CEO' },
  { key: 'ceo', label: 'CEO', name: 'Văn phòng CEO', type: 'exec', parent: 'hdqt', tone: 'qs', desc: 'Tổng Giám đốc điều hành toàn công ty' },
  { key: 'bod', label: 'BOD', name: 'Ban Giám đốc (BOD)', type: 'board', parent: 'ceo', tone: 'qs', desc: 'Ban Giám đốc — họp điều hành định kỳ' },
  { key: 'bks', label: 'Ban kiểm soát', name: 'Ban kiểm soát', type: 'board', parent: 'ceo', tone: 'qs', desc: 'Kiểm soát tài chính, tuân thủ & rủi ro' },
  { key: 'bcl', label: 'Ban chiến lược', name: 'Ban chiến lược', type: 'board', parent: 'ceo', tone: 'qs', desc: 'Hoạch định chiến lược & đầu tư' },
  { key: 'coo', label: 'COO', name: 'Khối vận hành (COO)', type: 'exec', parent: 'ceo', tone: 'primary', desc: 'Giám đốc vận hành — phụ trách khối văn phòng & hỗ trợ' },
  { key: 'kddd', label: 'Kinh doanh dân dụng', name: 'Kinh doanh dân dụng', type: 'dept', parent: 'ceo', tone: 'sales', desc: 'Kinh doanh nhà ở, nhà phố, biệt thự cho khách hàng cá nhân' },
  { key: 'marketing', label: 'Marketing', name: 'Marketing', type: 'dept', parent: 'ceo', tone: 'marketing', desc: 'Thương hiệu, truyền thông & tạo lead' },
  { key: 'rnd', label: 'R&D', name: 'R&D', type: 'dept', parent: 'ceo', tone: 'qs', desc: 'Nghiên cứu vật liệu, công nghệ & giải pháp thi công mới' },
  { key: 'cco', label: 'Chief Construction Officer (CCO)', name: 'Khối thi công (CCO)', type: 'exec', parent: 'ceo', tone: 'danger', desc: 'Giám đốc thi công — phụ trách công trường & hậu mãi' },
  { key: 'hcns', label: 'Hành chính nhân sự', name: 'Hành chính nhân sự', type: 'dept', parent: 'coo', tone: 'attendance', desc: 'Tuyển dụng, C&B, đào tạo, hành chính văn phòng' },
  { key: 'tckt', label: 'Tài chính - Kế toán', name: 'Tài chính - Kế toán', type: 'dept', parent: 'coo', tone: 'finance', desc: 'Kế toán, ngân sách, dòng tiền, thuế' },
  { key: 'thietke', label: 'Thiết kế', name: 'Thiết kế', type: 'dept', parent: 'coo', tone: 'primary', desc: 'Thiết kế kiến trúc, kết cấu, MEP & BIM' },
  { key: 'muahang', label: 'Mua hàng', name: 'Mua hàng', type: 'dept', parent: 'coo', tone: 'sales', desc: 'Mua sắm vật tư, cung ứng & quản lý kho' },
  { key: 'qs', label: 'QS', name: 'QS', type: 'dept', parent: 'coo', tone: 'qs', desc: 'Bóc tách khối lượng, dự toán, kiểm soát chi phí' },
  { key: 'it', label: 'IT', name: 'IT', type: 'dept', parent: 'coo', tone: 'muted', desc: 'Hạ tầng CNTT, phần mềm nội bộ, bảo mật' },
  { key: 'kdda', label: 'Kinh doanh dự án', name: 'Kinh doanh dự án', type: 'dept', parent: 'coo', tone: 'sales', desc: 'Đấu thầu & kinh doanh các dự án lớn (B2B)' },
  { key: 'thicong', label: 'Bộ phận thi công', name: 'Bộ phận thi công', type: 'dept', parent: 'cco', tone: 'danger', desc: 'Chỉ huy & các đội thi công tại công trường' },
  { key: 'haumai', label: 'Bộ phận hậu mãi', name: 'Bộ phận hậu mãi', type: 'dept', parent: 'cco', tone: 'success', desc: 'Bảo hành, bảo trì & chăm sóc sau bàn giao' },
]
/* Trưởng đơn vị mặc định (id nhân viên) */
export const INITIAL_UNIT_HEADS = { ceo: 1, coo: 22, cco: 2, kddd: 23, marketing: 5, rnd: 26, hcns: 4, tckt: 3, thietke: 24, muahang: 8, qs: 25, it: 17, kdda: 7, thicong: 6, haumai: 27, bod: 1, bks: 3, bcl: 1, hdqt: 1 }
export const UNIT_TYPE_LABEL = { governance: 'Quản trị', board: 'Ban trực thuộc CEO', exec: 'Khối điều hành', dept: 'Phòng ban' }

/* Danh sách phòng ban dùng cho hồ sơ / bộ lọc (khối điều hành + phòng ban).
   Mảng được đồng bộ tại chỗ khi người dùng thiết lập lại cơ cấu (syncDepts) để mọi màn hình dùng cùng danh sách. */
const toDepts = units => units.filter(u => u.type === 'exec' || u.type === 'dept').map(u => ({ key: u.key, name: u.name, tone: u.tone }))
export const DEPTS = toDepts(INITIAL_ORG_UNITS)
export function syncDepts(units) { DEPTS.splice(0, DEPTS.length, ...toDepts(units)) }
export const deptOf = key => DEPTS.find(d => d.key === key) || { key, name: key || '—', tone: 'muted' }

export const STATUS = {
  probation: { label: 'Thử việc', tone: 'finance' },
  active: { label: 'Chính thức', tone: 'success' },
  left: { label: 'Đã nghỉ việc', tone: 'muted' },
}
/* Cấp bậc (từ thấp → cao) — dùng làm cấp hiển thị trên sơ đồ nhân sự */
export const LEVELS = ['Nhân viên', 'Chuyên viên', 'Điều phối', 'Trưởng nhóm', 'Quản lý', 'Phó phòng', 'Trưởng phòng', 'Giám đốc']
export const LEVEL_TONE = { 'Giám đốc': 'qs', 'Trưởng phòng': 'primary', 'Phó phòng': 'primary', 'Quản lý': 'attendance', 'Trưởng nhóm': 'attendance', 'Điều phối': 'finance', 'Chuyên viên': 'muted', 'Nhân viên': 'muted' }
export const CONTRACT_TYPES = ['Thử việc', 'Xác định thời hạn', 'Không xác định thời hạn', 'Thời vụ']
export const WORK_SITES = ['Văn phòng HCM', 'Riverside — Tòa A', 'Riverside — Tòa B', 'Kho vật tư Bình Chánh']

/* ---------- Nhân sự ----------
   managerId: người quản lý trực tiếp (dùng dựng sơ đồ tổ chức) */
const BASE = [
  // id, code, name, gender, dob, dept, position, level, status, joinDate, managerId, site, contract, salary
  [1, 'NV000', 'Cao Hưng', 'Nam', '1978-02-10', 'ceo', 'Tổng Giám đốc (CEO)', 'Giám đốc', 'active', '2019-01-02', null, 'Văn phòng HCM', 'Không xác định thời hạn', 80000000],
  [22, 'NV022', 'Lâm Thanh Tùng', 'Nam', '1982-07-19', 'coo', 'Giám đốc vận hành (COO)', 'Giám đốc', 'active', '2020-03-02', 1, 'Văn phòng HCM', 'Không xác định thời hạn', 60000000],
  [2, 'NV001', 'Trần Anh', 'Nam', '1990-04-12', 'cco', 'Giám đốc thi công (CCO)', 'Giám đốc', 'active', '2022-03-01', 1, 'Văn phòng HCM', 'Không xác định thời hạn', 45000000],
  [3, 'NV013', 'Phan Bảo Ngọc', 'Nữ', '1987-06-03', 'tckt', 'Kế toán trưởng', 'Trưởng phòng', 'active', '2020-08-17', 22, 'Văn phòng HCM', 'Không xác định thời hạn', 32000000],
  [4, 'NV014', 'Ngô Mỹ Duyên', 'Nữ', '1991-10-28', 'hcns', 'Trưởng phòng Hành chính nhân sự', 'Trưởng phòng', 'active', '2021-02-01', 22, 'Văn phòng HCM', 'Không xác định thời hạn', 26000000],
  [5, 'NV002', 'Đỗ Thảo Vy', 'Nữ', '1993-08-20', 'marketing', 'Trưởng phòng Marketing', 'Trưởng phòng', 'active', '2023-06-15', 1, 'Văn phòng HCM', 'Không xác định thời hạn', 25000000],
  [6, 'NV008', 'Nguyễn Đức Anh', 'Nam', '1988-01-25', 'thicong', 'Chỉ huy trưởng công trường', 'Trưởng phòng', 'active', '2022-04-18', 2, 'Riverside — Tòa A', 'Không xác định thời hạn', 28000000],
  [7, 'NV007', 'Đặng Quốc Cường', 'Nam', '1992-09-18', 'kdda', 'Trưởng phòng Kinh doanh dự án', 'Trưởng phòng', 'active', '2023-07-03', 22, 'Văn phòng HCM', 'Không xác định thời hạn', 22000000],
  [8, 'NV011', 'Cao Nhật Tân', 'Nam', '1994-06-16', 'muahang', 'Trưởng phòng Mua hàng', 'Trưởng phòng', 'active', '2023-10-09', 22, 'Kho vật tư Bình Chánh', 'Xác định thời hạn', 22000000],
  [23, 'NV023', 'Phùng Gia Hân', 'Nữ', '1990-12-05', 'kddd', 'Trưởng phòng Kinh doanh dân dụng', 'Trưởng phòng', 'active', '2021-09-13', 1, 'Văn phòng HCM', 'Không xác định thời hạn', 24000000],
  [24, 'NV024', 'Võ Hoàng Nam', 'Nam', '1989-03-27', 'thietke', 'Trưởng phòng Thiết kế', 'Trưởng phòng', 'active', '2021-05-17', 22, 'Văn phòng HCM', 'Không xác định thời hạn', 30000000],
  [25, 'NV025', 'Lưu Minh Trí', 'Nam', '1992-08-08', 'qs', 'Trưởng phòng QS', 'Trưởng phòng', 'active', '2022-01-10', 22, 'Văn phòng HCM', 'Không xác định thời hạn', 26000000],
  [26, 'NV026', 'Tạ Quang Huy', 'Nam', '1991-02-14', 'rnd', 'Trưởng nhóm R&D', 'Trưởng nhóm', 'active', '2023-04-03', 1, 'Văn phòng HCM', 'Không xác định thời hạn', 24000000],
  [27, 'NV027', 'Mai Phương Thảo', 'Nữ', '1993-06-21', 'haumai', 'Trưởng bộ phận Hậu mãi', 'Trưởng nhóm', 'active', '2023-11-06', 2, 'Văn phòng HCM', 'Không xác định thời hạn', 18000000],
  [9, 'NV009', 'Đỗ Thành Long', 'Nam', '1991-12-03', 'thicong', 'Điều phối giám sát công trường', 'Điều phối', 'active', '2022-05-25', 6, 'Riverside — Tòa A', 'Không xác định thời hạn', 18000000],
  [10, 'NV010', 'Vũ Thị Diệu', 'Nữ', '2000-03-09', 'thicong', 'Giám sát an toàn lao động', 'Nhân viên', 'probation', '2026-08-14', 9, 'Riverside — Tòa B', 'Thử việc', 9000000],
  [11, 'NV015', 'Phạm Quốc Bảo', 'Nam', '1995-03-21', 'thicong', 'Đội trưởng thi công A', 'Trưởng nhóm', 'active', '2023-02-13', 6, 'Riverside — Tòa A', 'Xác định thời hạn', 16000000],
  [12, 'NV016', 'Vũ Hải Nam', 'Nam', '1994-11-11', 'thicong', 'Đội trưởng thi công B', 'Trưởng nhóm', 'active', '2023-03-06', 6, 'Riverside — Tòa B', 'Xác định thời hạn', 16000000],
  [28, 'NV028', 'Bùi Văn Lực', 'Nam', '1996-10-30', 'haumai', 'Kỹ thuật viên bảo hành', 'Nhân viên', 'active', '2024-06-03', 27, 'Riverside — Tòa A', 'Xác định thời hạn', 12000000],
  [13, 'NV003', 'Ngọc Hà', 'Nữ', '1998-02-14', 'marketing', 'Graphic Designer', 'Nhân viên', 'active', '2024-01-10', 14, 'Văn phòng HCM', 'Xác định thời hạn', 14000000],
  [14, 'NV004', 'Minh Quân', 'Nam', '1996-11-02', 'marketing', 'Trưởng nhóm Sáng tạo (Media)', 'Trưởng nhóm', 'active', '2023-09-05', 5, 'Văn phòng HCM', 'Không xác định thời hạn', 16000000],
  [15, 'NV005', 'Thuỳ Dương', 'Nữ', '1999-05-30', 'marketing', 'Content Creator', 'Nhân viên', 'probation', '2026-08-20', 14, 'Văn phòng HCM', 'Thử việc', 10000000],
  [16, 'NV006', 'Hoàng Yến Nhi', 'Nữ', '1997-07-07', 'kddd', 'Nhân viên kinh doanh dân dụng', 'Nhân viên', 'active', '2024-02-12', 23, 'Văn phòng HCM', 'Xác định thời hạn', 12000000],
  [29, 'NV029', 'Đinh Khánh Linh', 'Nữ', '1997-04-17', 'thietke', 'Kiến trúc sư', 'Chuyên viên', 'active', '2023-08-07', 24, 'Văn phòng HCM', 'Xác định thời hạn', 20000000],
  [30, 'NV030', 'Hà Đức Thịnh', 'Nam', '1998-09-02', 'qs', 'Kỹ sư QS', 'Chuyên viên', 'active', '2024-03-04', 25, 'Văn phòng HCM', 'Xác định thời hạn', 17000000],
  [17, 'NV017', 'Lê Trung Kiên', 'Nam', '1996-04-04', 'it', 'Trưởng nhóm IT', 'Trưởng nhóm', 'active', '2024-05-02', 22, 'Văn phòng HCM', 'Xác định thời hạn', 20000000],
  [18, 'NV018', 'Lý Thu Trang', 'Nữ', '1995-10-22', 'muahang', 'Điều phối cung ứng vật tư', 'Điều phối', 'active', '2023-01-01', 8, 'Kho vật tư Bình Chánh', 'Xác định thời hạn', 13000000],
  [19, 'NV019', 'Trịnh Anh Thư', 'Nữ', '1997-01-30', 'tckt', 'Phó phòng Tài chính - Kế toán', 'Phó phòng', 'active', '2024-03-18', 3, 'Văn phòng HCM', 'Xác định thời hạn', 15000000],
  [20, 'NV020', 'Đặng Hữu Phúc', 'Nam', '1993-12-12', 'hcns', 'Quản lý C&B', 'Quản lý', 'active', '2023-08-21', 4, 'Văn phòng HCM', 'Không xác định thời hạn', 15000000],
  [31, 'NV031', 'Trần Văn Hậu', 'Nam', '1997-05-11', 'thicong', 'Công nhân kỹ thuật — Tổ A', 'Nhân viên', 'active', '2024-07-01', 11, 'Riverside — Tòa A', 'Xác định thời hạn', 11000000],
  [32, 'NV032', 'Lê Minh Tuấn', 'Nam', '1998-08-23', 'thicong', 'Công nhân kỹ thuật — Tổ B', 'Nhân viên', 'active', '2024-07-01', 12, 'Riverside — Tòa B', 'Xác định thời hạn', 11000000],
  [33, 'NV033', 'Nguyễn Thanh Mai', 'Nữ', '1998-01-19', 'hcns', 'Chuyên viên tuyển dụng', 'Chuyên viên', 'active', '2024-04-15', 20, 'Văn phòng HCM', 'Xác định thời hạn', 14000000],
  [34, 'NV034', 'Phạm Ngọc Ánh', 'Nữ', '1996-06-06', 'thietke', 'Kỹ sư kết cấu', 'Chuyên viên', 'active', '2023-12-04', 24, 'Văn phòng HCM', 'Xác định thời hạn', 19000000],
  [35, 'NV035', 'Trương Hoài Nam', 'Nam', '1997-11-28', 'kdda', 'Nhân viên kinh doanh dự án', 'Nhân viên', 'active', '2024-09-09', 7, 'Văn phòng HCM', 'Xác định thời hạn', 12000000],
  [36, 'NV036', 'Đoàn Gia Bảo', 'Nam', '1999-03-15', 'it', 'Kỹ thuật viên IT', 'Nhân viên', 'active', '2025-02-10', 17, 'Văn phòng HCM', 'Xác định thời hạn', 12000000],
  [37, 'NV037', 'Quách Thu Hà', 'Nữ', '1998-07-30', 'tckt', 'Kế toán công trình', 'Chuyên viên', 'active', '2024-08-19', 19, 'Văn phòng HCM', 'Xác định thời hạn', 14000000],
  [21, 'NV012', 'Lê Thị Kim', 'Nữ', '1996-09-09', 'tckt', 'Kế toán thanh toán', 'Nhân viên', 'left', '2023-01-01', 19, 'Văn phòng HCM', 'Xác định thời hạn', 13000000],
]

const HOMETOWNS = ['Hà Nội', 'Hải Phòng', 'Nam Định', 'Thanh Hóa', 'Nghệ An', 'Bắc Ninh', 'Hà Nam', 'Ninh Bình', 'Thái Bình', 'Vĩnh Phúc', 'Hưng Yên', 'Hải Dương', 'Đà Nẵng', 'TP. HCM', 'Cần Thơ']
const BANKS = ['Vietcombank', 'Techcombank', 'ACB', 'BIDV', 'MB Bank', 'Vietinbank', 'Agribank', 'TPBank']
const SCHOOLS = {
  thicong: ['ĐH Xây dựng Hà Nội', 'Kỹ thuật Xây dựng'], haumai: ['CĐ Xây dựng TP.HCM', 'Kỹ thuật công trình'], cco: ['ĐH Bách khoa TP.HCM', 'Quản lý xây dựng'],
  ceo: ['ĐH Kinh tế TP.HCM', 'Quản trị kinh doanh'], coo: ['ĐH Kinh tế TP.HCM', 'Quản trị vận hành'],
  tckt: ['ĐH Kinh tế Quốc dân', 'Kế toán — Kiểm toán'], hcns: ['ĐH Lao động — Xã hội', 'Quản trị nhân lực'], marketing: ['ĐH RMIT Việt Nam', 'Truyền thông số'],
  kdda: ['ĐH Ngoại thương', 'Kinh doanh quốc tế'], kddd: ['ĐH Kinh tế TP.HCM', 'Marketing'], muahang: ['ĐH Giao thông Vận tải', 'Logistics & chuỗi cung ứng'],
  it: ['ĐH Công nghệ Thông tin', 'Hệ thống thông tin'], thietke: ['ĐH Kiến trúc TP.HCM', 'Kiến trúc'], qs: ['ĐH Xây dựng Hà Nội', 'Kinh tế xây dựng'], rnd: ['ĐH Bách khoa TP.HCM', 'Vật liệu xây dựng'],
}
const CERTS = {
  thicong: [['Chứng chỉ hành nghề giám sát xây dựng hạng II', 'Bộ Xây dựng'], ['Chứng chỉ an toàn lao động nhóm 3', 'Trung tâm HL ATLĐ']],
  cco: [['PMP — Project Management Professional', 'PMI'], ['Chứng chỉ quản lý dự án hạng I', 'Bộ Xây dựng']],
  tckt: [['Chứng chỉ Kế toán trưởng', 'Bộ Tài chính']], hcns: [['Chứng chỉ C&B chuyên nghiệp', 'PACE']],
  marketing: [['Google Ads Certification', 'Google']], kddd: [['Chứng chỉ môi giới BĐS', 'Sở Xây dựng']], kdda: [['Chứng chỉ đấu thầu cơ bản', 'Bộ KH&ĐT']],
  it: [['CCNA', 'Cisco']], thietke: [['Chứng chỉ hành nghề thiết kế kiến trúc hạng II', 'Bộ Xây dựng'], ['Autodesk Revit Certified Professional', 'Autodesk']],
  qs: [['Chứng chỉ định giá xây dựng hạng II', 'Bộ Xây dựng']], muahang: [['CIPS Level 4', 'CIPS']], haumai: [['Chứng chỉ an toàn lao động nhóm 3', 'Trung tâm HL ATLĐ']],
}
const pad = n => String(n).padStart(2, '0')
const addYears = (iso, y) => { const [a, b, c] = iso.split('-'); return `${Number(a) + y}-${b}-${c}` }
const addMonths = (iso, m) => {
  const [a, b, c] = iso.split('-').map(Number)
  const t = a * 12 + (b - 1) + m
  return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}-${pad(c)}`
}

function buildEmployee(row) {
  const [id, code, name, gender, dob, dept, position, level, status, joinDate, managerId, site, contractType, salary] = row
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().split(' ')
  const email = `${slug[slug.length - 1]}.${slug.slice(0, -1).map(s => s[0]).join('')}@siteflow.vn`
  const [school, major] = SCHOOLS[dept] || SCHOOLS.ceo
  const gradYear = Number(dob.slice(0, 4)) + 22
  const contracts = []
  if (status === 'probation') {
    contracts.push({ no: `HĐTV-${code}`, type: 'Thử việc', start: joinDate, end: addMonths(joinDate, 2), salary: Math.round(salary * 0.85), status: 'active' })
  } else {
    contracts.push({ no: `HĐTV-${code}`, type: 'Thử việc', start: joinDate, end: addMonths(joinDate, 2), salary: Math.round(salary * 0.85), status: 'expired' })
    const s2 = addMonths(joinDate, 2)
    if (contractType === 'Không xác định thời hạn') {
      contracts.push({ no: `HĐLĐ-${code}-01`, type: 'Xác định thời hạn', start: s2, end: addYears(s2, 1), salary: Math.round(salary * 0.9), status: 'expired' })
      contracts.push({ no: `HĐLĐ-${code}-02`, type: 'Không xác định thời hạn', start: addYears(s2, 1), end: null, salary, status: status === 'left' ? 'expired' : 'active' })
    } else {
      // HĐ xác định thời hạn 2 năm, gia hạn liên tiếp tới khi còn hiệu lực ở ngày hôm nay
      let start = s2, n = 1
      for (;;) {
        const end = id === 8 && n === 2 ? '2026-10-09' : addYears(start, 2)
        const current = end >= HR_TODAY || status === 'left'
        contracts.push({ no: `HĐLĐ-${code}-${pad(n)}`, type: 'Xác định thời hạn', start, end, salary: current ? salary : Math.round(salary * 0.92), status: current && status !== 'left' ? 'active' : 'expired' })
        if (current) break
        start = end; n++
      }
    }
  }
  return {
    id, code, name, gender, dob, dept, position, level, status, joinDate, managerId, site, contractType, salary, contracts,
    leaveDate: status === 'left' ? '2026-06-30' : null,
    phone: `09${pad(id + 10)} ${100 + id * 7} ${200 + id * 13}`.slice(0, 13),
    email,
    hometown: HOMETOWNS[id % HOMETOWNS.length],
    address: `${12 + id * 3} Đường số ${id + 2}, P. Tân Phú, TP. Thủ Đức, TP. HCM`,
    marital: id % 3 === 0 ? 'Độc thân' : 'Đã kết hôn',
    cccd: `0790${dob.slice(2, 4)}00${pad(id)}${pad(id * 3 % 100)}`,
    cccdDate: addYears(dob, 20).slice(0, 4) + '-05-12', cccdPlace: 'Cục CS QLHC về TTXH',
    emergencyName: (gender === 'Nam' ? 'Nguyễn Thị ' : 'Trần Văn ') + ['Hoa', 'Bình', 'Lan', 'Minh', 'Thu'][id % 5],
    emergencyPhone: `0908 ${300 + id} ${400 + id * 2}`,
    bankName: BANKS[id % BANKS.length], bankAccount: `00${71000 + id * 137}${pad(id)}${id * 9}`,
    education: [{ school, major, degree: level === 'Giám đốc' ? 'Thạc sĩ' : 'Cử nhân / Kỹ sư', from: String(gradYear - 4), to: String(gradYear) }],
    experience: id > 2 ? [{ company: ['Coteccons', 'Hòa Bình Corp', 'Ricons', 'Newtecons', 'FPT Software', 'Deloitte VN'][id % 6], role: position.replace(/Trưởng phòng|Head|Trưởng nhóm/, 'Nhân viên'), from: String(gradYear), to: joinDate.slice(0, 4) }] : [],
    certificates: (CERTS[dept] || []).map(([n, issuer], i) => ({ name: n, issuer, date: `${gradYear + 2 + i}-06-15`, expiry: i === 0 && dept === 'thicong' ? '2027-06-15' : null })),
    tax: { mst: `83${pad(id)}${dob.replace(/-/g, '').slice(2)}`, dependents: id % 3, taxOffice: 'Chi cục Thuế TP. Thủ Đức' },
    insurance: { bhxhNo: `79${dob.slice(2, 4)}${pad(id)}0${id * 7 % 10}${pad(id + 31)}`, hospital: ['BV Quận 2', 'BV Lê Văn Thịnh', 'BV Đa khoa Tâm Anh'][id % 3], base: Math.min(salary, 46800000), since: status === 'probation' ? null : addMonths(joinDate, 2) },
    promotions: [{ date: joinDate, note: 'Gia nhập — ' + position }],
    attachments: [{ name: 'CV_' + slug.join('_') + '.pdf' }, ...(status !== 'probation' ? [{ name: 'Hop_dong_lao_dong.pdf' }] : [])],
  }
}
export const INITIAL_HR_EMPLOYEES = BASE.map(buildEmployee)
export const EMPTY_EMPLOYEE = {
  code: '', name: '', gender: 'Nam', dob: '', dept: 'thicong', position: '', level: 'Nhân viên', status: 'probation', joinDate: HR_TODAY, managerId: null,
  site: 'Văn phòng HCM', contractType: 'Thử việc', salary: '', phone: '', email: '', hometown: '', address: '', marital: 'Độc thân',
  cccd: '', cccdDate: '', cccdPlace: '', emergencyName: '', emergencyPhone: '', bankName: '', bankAccount: '',
  education: [], experience: [], contracts: [], certificates: [], tax: { mst: '', dependents: 0, taxOffice: '' },
  insurance: { bhxhNo: '', hospital: '', base: '', since: null }, promotions: [], attachments: [],
}

/* ---------- Tiện ích ---------- */
export const fmtDate = iso => (iso ? iso.split('-').reverse().join('/') : '—')
export const fmtMoney = v => (v === '' || v == null || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('vi-VN') + ' đ')
export function initials(name) {
  const p = name.trim().split(/\s+/)
  return ((p.length > 1 ? p[p.length - 2][0] : '') + p[p.length - 1][0]).toUpperCase()
}
const AVATAR = ['#2F5DA8', '#0E8A82', '#B7791F', '#7658C2', '#C23B78', '#C2621A', '#1E8E5A', '#C0392B']
export const avatarColor = id => AVATAR[id % AVATAR.length]
export function yearsBetween(a, b = HR_TODAY) {
  const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number)
  return y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0)
}
export function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000) }

/* ---------- Chấm công: ca, lịch, điểm chấm công ---------- */
export const SITES = [
  { name: 'Văn phòng HCM', lat: 10.8411, lng: 106.8099, radius: 150 },
  { name: 'Riverside — Tòa A', lat: 10.8023, lng: 106.7425, radius: 250 },
  { name: 'Riverside — Tòa B', lat: 10.8031, lng: 106.7441, radius: 250 },
  { name: 'Kho vật tư Bình Chánh', lat: 10.6869, lng: 106.5938, radius: 300 },
]
export const INITIAL_SHIFTS = [
  { id: 'HC', name: 'Hành chính', start: '08:00', end: '17:00', breakMin: 60, tone: 'primary', note: 'Văn phòng, T2–T6' },
  { id: 'CT', name: 'Công trường', start: '07:00', end: '16:30', breakMin: 90, tone: 'attendance', note: 'Thi công, T2–T7' },
  { id: 'SA', name: 'Ca sáng', start: '06:00', end: '14:00', breakMin: 30, tone: 'finance', note: 'Đổ bê tông / bảo vệ' },
  { id: 'TO', name: 'Ca tối', start: '18:00', end: '22:00', breakMin: 0, tone: 'qs', note: 'Tăng ca theo kế hoạch' },
]
export const WEEK_DAYS = [
  { key: 'T2', date: '21/09' }, { key: 'T3', date: '22/09' }, { key: 'T4', date: '23/09' }, { key: 'T5', date: '24/09' },
  { key: 'T6', date: '25/09' }, { key: 'T7', date: '26/09' }, { key: 'CN', date: '27/09' },
]
export function initialSchedule(employees) {
  const s = {}
  employees.filter(e => e.status !== 'left').forEach(e => {
    const site = e.site !== 'Văn phòng HCM'
    s[e.id] = WEEK_DAYS.map((d, i) => {
      if (i === 6) return 'off'
      if (site) return e.id === 10 && i === 3 ? 'SA' : (e.id === 11 && i === 4 ? 'TO' : 'CT')
      return i === 5 ? (['kddd', 'kdda'].includes(e.dept) ? 'HC' : 'off') : 'HC'
    })
  })
  return s
}

/* Nhật ký chấm công hôm nay — source: machine (máy chấm công) | gps | import | manual */
export const TODAY_LOGS = [
  { empId: 1, in: '07:58', out: null, source: 'machine', gps: null },
  { empId: 2, in: '07:52', out: null, source: 'gps', gps: 'in', dist: 42 },
  { empId: 3, in: '08:05', out: null, source: 'machine', gps: null },
  { empId: 4, in: '07:55', out: null, source: 'machine', gps: null },
  { empId: 5, in: '08:21', out: null, source: 'machine', gps: null },
  { empId: 6, in: '06:48', out: null, source: 'gps', gps: 'in', dist: 61 },
  { empId: 7, in: '08:02', out: null, source: 'gps', gps: 'in', dist: 23 },
  { empId: 8, in: '07:10', out: null, source: 'gps', gps: 'out', dist: 1240 },
  { empId: 9, in: '06:55', out: null, source: 'gps', gps: 'in', dist: 88 },
  { empId: 10, in: '06:05', out: null, source: 'gps', gps: 'in', dist: 110 },
  { empId: 11, in: '07:15', out: null, source: 'import', gps: null },
  { empId: 12, in: '06:57', out: null, source: 'import', gps: null },
  { empId: 13, in: null, out: null, source: null, gps: null, leave: 'Nghỉ phép năm' },
  { empId: 14, in: '08:00', out: null, source: 'machine', gps: null },
  { empId: 15, in: '08:34', out: null, source: 'machine', gps: null },
  { empId: 16, in: null, out: null, source: null, gps: null },
  { empId: 17, in: '07:49', out: null, source: 'machine', gps: null },
  { empId: 18, in: '07:05', out: null, source: 'gps', gps: 'in', dist: 140 },
  { empId: 19, in: '07:59', out: null, source: 'machine', gps: null },
  { empId: 20, in: '08:00', out: null, source: 'manual', gps: null, note: 'Quên chấm — HR bổ sung' },
  { empId: 22, in: '07:45', out: null, source: 'machine', gps: null },
  { empId: 23, in: '08:03', out: null, source: 'machine', gps: null },
  { empId: 24, in: '07:58', out: null, source: 'machine', gps: null },
  { empId: 25, in: '08:12', out: null, source: 'machine', gps: null },
  { empId: 26, in: '08:00', out: null, source: 'machine', gps: null },
  { empId: 27, in: '07:56', out: null, source: 'gps', gps: 'in', dist: 35 },
  { empId: 28, in: '06:59', out: null, source: 'gps', gps: 'in', dist: 72 },
  { empId: 29, in: '07:52', out: null, source: 'machine', gps: null },
  { empId: 30, in: null, out: null, source: null, gps: null },
  { empId: 31, in: '06:52', out: null, source: 'import', gps: null },
  { empId: 32, in: '07:03', out: null, source: 'import', gps: null },
  { empId: 33, in: '07:57', out: null, source: 'machine', gps: null },
  { empId: 34, in: '08:01', out: null, source: 'machine', gps: null },
  { empId: 35, in: '08:09', out: null, source: 'gps', gps: 'in', dist: 18 },
  { empId: 36, in: '07:41', out: null, source: 'machine', gps: null },
  { empId: 37, in: '07:59', out: null, source: 'machine', gps: null },
]

/* ---------- Đơn từ cần duyệt (phía HR / quản lý) ----------
   steps[].state: done | active | waiting | rejected */
export const REQUEST_TYPES = {
  leave: { label: 'Nghỉ phép', icon: 'calendar', tone: 'attendance' },
  late: { label: 'Đi muộn / về sớm', icon: 'logIn', tone: 'finance' },
  ot: { label: 'Làm thêm giờ (OT)', icon: 'moon', tone: 'qs' },
}
export const INITIAL_HR_REQUESTS = [
  { id: 1, empId: 13, type: 'leave', title: 'Nghỉ phép năm — 23/09 đến 24/09', days: 2, createdAt: '20/09/2026 · 09:10', reason: 'Về quê dự đám cưới người thân',
    steps: [{ name: 'Đỗ Thảo Vy', role: 'Quản lý trực tiếp', state: 'done', time: '20/09/2026 · 10:02' }, { name: 'Ngô Mỹ Duyên', role: 'Nhân sự (HR)', state: 'done', time: '20/09/2026 · 14:15' }] },
  { id: 2, empId: 11, type: 'ot', title: 'OT — 25/09, 18:00–22:00 (4 giờ)', hours: 4, createdAt: '22/09/2026 · 16:40', reason: 'Đổ bê tông sàn tầng 3 Tòa A, cần hoàn thành trước mưa',
    steps: [{ name: 'Nguyễn Đức Anh', role: 'Quản lý trực tiếp', state: 'done', time: '22/09/2026 · 17:05', note: 'Đồng ý, đăng ký thêm 6 công nhân.' }, { name: 'Ngô Mỹ Duyên', role: 'Nhân sự (HR)', state: 'active' }] },
  { id: 3, empId: 15, type: 'late', title: 'Đi muộn — 23/09, dự kiến 08:30', createdAt: '23/09/2026 · 07:12', reason: 'Xe hỏng giữa đường',
    steps: [{ name: 'Đỗ Thảo Vy', role: 'Quản lý trực tiếp', state: 'active' }] },
  { id: 4, empId: 16, type: 'leave', title: 'Nghỉ ốm — 23/09', days: 1, createdAt: '23/09/2026 · 06:30', reason: 'Sốt cao, có giấy khám bệnh',
    steps: [{ name: 'Đặng Quốc Cường', role: 'Quản lý trực tiếp', state: 'active' }, { name: 'Ngô Mỹ Duyên', role: 'Nhân sự (HR)', state: 'waiting' }] },
  { id: 5, empId: 9, type: 'ot', title: 'OT — 20/09 (Chủ nhật), 07:00–12:00 (5 giờ)', hours: 5, createdAt: '19/09/2026 · 15:20', reason: 'Nghiệm thu cốt thép cùng tư vấn',
    steps: [{ name: 'Nguyễn Đức Anh', role: 'Quản lý trực tiếp', state: 'done', time: '19/09/2026 · 16:00' }, { name: 'Ngô Mỹ Duyên', role: 'Nhân sự (HR)', state: 'done', time: '19/09/2026 · 17:30' }] },
  { id: 6, empId: 17, type: 'leave', title: 'Nghỉ không lương — 30/09 đến 02/10', days: 3, createdAt: '18/09/2026 · 11:00', reason: 'Việc gia đình',
    steps: [{ name: 'Cao Nhật Tân', role: 'Quản lý trực tiếp', state: 'rejected', time: '18/09/2026 · 13:45', note: 'Trùng đợt triển khai phần mềm kho, dời sang tuần sau nhé.' }, { name: 'Ngô Mỹ Duyên', role: 'Nhân sự (HR)', state: 'waiting' }] },
]

/* ---------- Tổng hợp công & phép theo tháng ----------
   Sinh số liệu cố định theo id nhân viên. Phép năm: 12 ngày/năm (+1 ngày mỗi 5 năm thâm niên), cộng dồn theo tháng. */
export const MONTHS = [{ key: '2026-09', label: 'Tháng 9/2026', std: 26 }, { key: '2026-08', label: 'Tháng 8/2026', std: 26 }, { key: '2026-07', label: 'Tháng 7/2026', std: 27 }]
export function monthlySummary(employees, monthKey) {
  const m = MONTHS.find(x => x.key === monthKey) || MONTHS[0]
  const month = Number(monthKey.slice(5))
  const mi = MONTHS.indexOf(m)
  return employees.filter(e => e.status !== 'left' && e.joinDate <= monthKey + '-31').map(e => {
    const seed = (e.id * 7 + mi * 3) % 11
    const joinedThisMonth = e.joinDate.slice(0, 7) === monthKey
    const std = joinedThisMonth ? Math.max(1, m.std - Number(e.joinDate.slice(8)) + 1) : m.std
    const paidLeave = seed % 4 === 0 ? 2 : seed % 5 === 0 ? 1 : 0
    const unpaid = seed === 7 ? 1 : 0
    const late = seed % 3
    const early = seed % 5 === 1 ? 1 : 0
    const ot = e.site !== 'Văn phòng HCM' ? 8 + seed * 2 : seed % 2 * 4
    const worked = Math.max(0, std - paidLeave - unpaid - (seed === 9 ? 0.5 : 0))
    const seniority = Math.floor(yearsBetween(e.joinDate) / 5)
    const yearQuota = 12 + seniority
    const accrued = e.status === 'probation' ? 0 : Math.min(yearQuota, Math.round(yearQuota / 12 * month * 10) / 10)
    const used = Math.min(accrued, (e.id % 4) + paidLeave)
    return { emp: e, std, worked, paidLeave, unpaid, late, early, ot, total: worked + paidLeave, yearQuota, accrued, used, remain: Math.round((accrued - used) * 10) / 10 }
  })
}

/* ---------- Ghi chú chấm công ---------- */
export function attendanceStatus(log, shift) {
  if (!log) return 'absent'
  if (log.leave) return 'leave'
  if (!log.in) return 'absent'
  if (shift && log.in > shift.start) {
    const [h1, m1] = log.in.split(':').map(Number); const [h2, m2] = shift.start.split(':').map(Number)
    const late = h1 * 60 + m1 - (h2 * 60 + m2)
    if (late > 5) return 'late'
  }
  return 'ok'
}
export function lateMinutes(inT, start) {
  const [h1, m1] = inT.split(':').map(Number); const [h2, m2] = start.split(':').map(Number)
  return h1 * 60 + m1 - (h2 * 60 + m2)
}
