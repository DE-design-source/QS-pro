/* Dữ liệu mẫu & tiện ích cho trang Sản xuất — xưởng mộc (san-xuat.html) */

export const SX_TABS = [
  { key: 'tongquan', label: 'Tổng quan' },
  { key: 'donsx', label: 'Đơn sản xuất' },
  { key: 'quytrinh', label: 'Quy trình' },
  { key: 'khovattu', label: 'Kho vật tư' },
  { key: 'nhancong', label: 'Nhân công' },
  { key: 'maymoc', label: 'Máy móc' },
]

export const STAGES = [
  { key: 'doVe', label: 'Đo vẽ hiện trạng', color: 'var(--primary)', tint: 'var(--primary-tint)' },
  { key: 'banVe', label: 'Lên bản vẽ sản xuất', color: 'var(--qs)', tint: 'var(--qs-tint)' },
  { key: 'catTam', label: 'Cắt tấm', color: 'var(--finance)', tint: 'var(--finance-tint)' },
  { key: 'lapDatXuong', label: 'Lắp đặt tại xưởng', color: 'var(--attendance)', tint: 'var(--attendance-tint)' },
  { key: 'qcXuong', label: 'QC xưởng', color: 'var(--wood)', tint: 'var(--wood-tint)' },
  { key: 'dongGoiGiao', label: 'Đóng gói & giao hàng', color: 'var(--success)', tint: 'var(--success-tint)' },
  { key: 'nhanHang', label: 'Nhận hàng', color: 'var(--danger)', tint: 'var(--danger-tint)' },
  { key: 'vanChuyen', label: 'Vận chuyển lên công trình', color: 'var(--primary)', tint: 'var(--primary-tint)' },
  { key: 'lapDatCT', label: 'Lắp đặt tại công trình', color: 'var(--qs)', tint: 'var(--qs-tint)' },
  { key: 'qcCT', label: 'QC công trình', color: 'var(--wood)', tint: 'var(--wood-tint)' },
  { key: 'defect', label: 'Defect', color: 'var(--danger)', tint: 'var(--danger-tint)' },
  { key: 'nghiemThu', label: 'Nghiệm thu', color: 'var(--success)', tint: 'var(--success-tint)' },
  { key: 'hoanThanh', label: 'Hoàn thành', color: 'var(--text-muted)', tint: 'var(--surface-alt)' },
]
export const stageOf = key => STAGES.find(s => s.key === key)

export const PRIO_LABEL = { high: 'Cao', med: 'TB', low: 'Thấp' }
export const PRIO_COLOR = { high: 'var(--danger)', med: 'var(--finance)', low: 'var(--text-muted)' }

export const INITIAL_ORDERS = [
  { code: 'SX-001', name: 'Tủ bếp gỗ óc chó', customer: 'KH: Nguyễn Văn A', qty: 1, stage: 'lapDatXuong', worker: 'Văn Thanh', due: '30/09', priority: 'high', progress: 65, late: false, comments: [] },
  { code: 'SX-002', name: 'Bộ bàn ghế ăn 6 ghế', customer: 'KH: Trần Thị B', qty: 1, stage: 'qcXuong', worker: 'Minh Hải', due: '22/09', priority: 'high', progress: 80, late: true, comments: [] },
  { code: 'SX-003', name: 'Cửa gỗ tự nhiên 2 cánh', customer: 'DA: Riverside GĐ2', qty: 4, stage: 'catTam', worker: 'Minh Hải', due: '28/09', priority: 'med', progress: 30, late: false, comments: [] },
  { code: 'SX-004', name: 'Kệ tivi phòng khách', customer: 'KH: Lê Văn C', qty: 1, stage: 'banVe', worker: 'Thành Huy', due: '05/10', priority: 'low', progress: 5, late: false, comments: [] },
  { code: 'SX-005', name: 'Giường ngủ gỗ sồi', customer: 'KH: Phạm D', qty: 1, stage: 'dongGoiGiao', worker: 'Văn Thanh', due: '25/09', priority: 'med', progress: 95, late: false, comments: [] },
  { code: 'SX-006', name: 'Tủ quần áo 4 cánh', customer: 'KH: Hoàng E', qty: 1, stage: 'lapDatXuong', worker: 'Thành Huy', due: '03/10', priority: 'med', progress: 55, late: false, comments: [] },
  { code: 'SX-007', name: 'Bàn trà mặt kính gỗ', customer: 'KH lẻ: Vũ F', qty: 2, stage: 'hoanThanh', worker: 'Minh Hải', due: '18/09', priority: 'low', progress: 100, late: false, comments: [] },
]

export const ORDER_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'chuanBi', label: 'Chuẩn bị' },
  { key: 'dangSanXuat', label: 'Đang sản xuất' },
  { key: 'hoanThanh', label: 'Hoàn thành' },
  { key: 'late', label: 'Trễ tiến độ' },
]
export function orderStatusGroup(o) {
  if (o.late) return 'late'
  if (o.stage === 'doVe' || o.stage === 'banVe') return 'chuanBi'
  if (o.stage === 'hoanThanh') return 'hoanThanh'
  return 'dangSanXuat'
}

export const INITIAL_MATERIALS = [
  { name: 'Gỗ óc chó (tấm)', type: 'Gỗ tấm', category: 'goTuNhien', qty: 4, minQty: 15, unit: 'tấm', supplier: 'Gỗ Tài Nguyên' },
  { name: 'Gỗ sồi (tấm)', type: 'Gỗ tấm', category: 'goTuNhien', qty: 18, minQty: 10, unit: 'tấm', supplier: 'Gỗ Tài Nguyên' },
  { name: 'Gỗ thông (thanh)', type: 'Gỗ thanh', category: 'goTuNhien', qty: 120, minQty: 50, unit: 'thanh', supplier: 'Lâm sản Miền Đông' },
  { name: 'Ván MDF phủ Melamine', type: 'Ván công nghiệp', category: 'goCN', qty: 32, minQty: 15, unit: 'tấm', supplier: 'An Cường' },
  { name: 'Sơn PU bóng (thùng 5L)', type: 'Sơn - hoá chất', category: 'vatTuPhu', qty: 3, minQty: 8, unit: 'thùng', supplier: 'Sơn Đức Việt' },
  { name: 'Keo dán gỗ Titebond', type: 'Sơn - hoá chất', category: 'vatTuPhu', qty: 6, minQty: 5, unit: 'thùng', supplier: 'Sơn Đức Việt' },
  { name: 'Bản lề giảm chấn', type: 'Phụ kiện', category: 'vatTuPhu', qty: 340, minQty: 100, unit: 'bộ', supplier: 'Hafele VN' },
  { name: 'Ray trượt ngăn kéo', type: 'Phụ kiện', category: 'vatTuPhu', qty: 85, minQty: 100, unit: 'bộ', supplier: 'Hafele VN' },
]
export const MATERIAL_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'goTuNhien', label: 'Gỗ tự nhiên' },
  { key: 'goCN', label: 'Gỗ CN' },
  { key: 'vatTuPhu', label: 'Vật tư phụ' },
]
export const materialStatus = m => (m.qty < m.minQty ? 'low' : 'ok')

export const WORKERS = [
  { name: 'Văn Thanh', team: 'Tổ lắp ráp', active: 2, done: 6, status: 'working' },
  { name: 'Minh Hải', team: 'Tổ cắt & gia công', active: 2, done: 5, status: 'working' },
  { name: 'Thành Huy', team: 'Tổ hoàn thiện', active: 2, done: 4, status: 'working' },
  { name: 'Quốc Bảo', team: 'Tổ sơn', active: 1, done: 7, status: 'working' },
  { name: 'Đình Phong', team: 'Tổ cắt & gia công', active: 0, done: 3, status: 'off' },
]

export const EQUIPMENT = [
  { name: 'Máy cưa CNC', status: 'ok', last: '01/09/2026', next: '01/12/2026' },
  { name: 'Máy bào 4 mặt', status: 'ok', last: '15/08/2026', next: '15/11/2026' },
  { name: 'Máy phun sơn', status: 'maintenance', last: '20/09/2026', next: 'Đang bảo trì' },
  { name: 'Máy chà nhám thùng', status: 'ok', last: '10/09/2026', next: '10/12/2026' },
  { name: 'Máy khoan ngang CNC', status: 'broken', last: '—', next: 'Cần sửa gấp' },
  { name: 'Máy nén khí', status: 'ok', last: '05/09/2026', next: '05/12/2026' },
]
export const EQUIPMENT_STATUS = {
  ok: ['Hoạt động tốt', 'var(--success)', 'var(--success-tint)'],
  maintenance: ['Đang bảo trì', 'var(--finance)', 'var(--finance-tint)'],
  broken: ['Hỏng — cần sửa', 'var(--danger)', 'var(--danger-tint)'],
}

export const ME = 'Trần Anh'
export const MENTION_NAMES = [...WORKERS.map(w => w.name), ME]

export function initialsOf(name) {
  return name.split(' ').map(w => w[0]).slice(-2).join('')
}
export const firstWorkerInitials = workerStr => initialsOf(workerStr.split(',')[0].trim())
export const workerExtraCount = workerStr => workerStr.split(',').length - 1
