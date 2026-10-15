/* Dữ liệu trang IT — lấy nguyên từ it.html */

export const TICKETS = [
  { requester: 'Trần Thị Hoa', issue: 'Wifi công trường chậm, hay rớt mạng', priority: 'high', status: 'moi', date: '25/09/2026' },
  { requester: 'Lê Thị Mai', issue: 'Laptop bị vỡ màn hình, cần thay linh kiện', priority: 'high', status: 'chodoi', date: '20/09/2026' },
  { requester: 'Nguyễn Văn Long', issue: 'Máy in phòng kế toán không in được', priority: 'medium', status: 'dangxuly', date: '24/09/2026' },
  { requester: 'Phạm Minh Tuấn', issue: 'Cài đặt AutoCAD 2026 bản quyền mới', priority: 'medium', status: 'dangxuly', date: '23/09/2026' },
  { requester: 'Đỗ Văn Khánh', issue: 'Lỗi kết nối VPN khi làm việc từ xa', priority: 'medium', status: 'hoanthanh', date: '18/09/2026' },
  { requester: 'Vũ Thị Ngọc', issue: 'Quên mật khẩu email công ty', priority: 'low', status: 'hoanthanh', date: '19/09/2026' },
]

export const PRIO_LABEL = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' }
export const PRIO_COLOR = { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--text-muted)' }

/* [nhãn, màu chữ, màu nền] */
export const TICKET_STATUS = {
  moi: ['Mới', 'var(--primary)', 'var(--primary-tint)'],
  dangxuly: ['Đang xử lý', 'var(--warn)', 'var(--warn-tint)'],
  chodoi: ['Chờ linh kiện', 'var(--danger)', 'var(--danger-tint)'],
  hoanthanh: ['Hoàn thành', 'var(--success)', 'var(--success-tint)'],
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

export const isOpenTicket = t => t.status !== 'hoanthanh'
