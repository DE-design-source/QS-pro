/* Dữ liệu mẫu & tiện ích cho trang BIM (bim.html) */

export const VALID_PAIR_CODE = '482913'
export const BIM_STORAGE = { linked: 'siteflow-bim-linked', project: 'siteflow-bim-project' }

export const INITIAL_PROJECTS = [
  { code: 'THD', name: 'Nhà ở Thảo Điền', projectCode: 'MOA-26-THD', client: 'Gia đình Anh Minh', models: 4, objects: 12846, pct: 92, primaryFile: 'Kiến trúc.skp', guid: '1c53e9d0-4a2f-4e91-8b3a-6f1d2c9bce92', lastSync: 'Hôm nay, 10:42' },
  { code: 'VPA', name: 'Văn phòng An Phú', projectCode: 'MOA-26-VPA', client: 'Công ty CP An Phú Invest', models: 3, objects: 8420, pct: 76, primaryFile: 'Kiến trúc VPA.skp', guid: '2d64f0e1-5b3a-4f92-9c4b-7f2d3a0bde03', lastSync: 'Hôm qua, 16:20' },
  { code: 'HBR', name: 'Hạ Long Boutique Resort', projectCode: 'MOA-25-HBR', client: 'Hạ Long Resort JSC', models: 6, objects: 21830, pct: 88, primaryFile: 'Resort Master.skp', guid: '3e75g1f2-6c4b-5g03-0d5c-8g3e4b1cef14', lastSync: '2 ngày trước' },
  { code: 'LBK', name: 'Lavie Bakery Flagship', projectCode: 'MOA-25-LBK', client: 'Lavie F&B Group', models: 2, objects: 4162, pct: 96, primaryFile: 'Lavie Flagship.skp', guid: '4f86h2g3-7d5c-6h14-1e6d-9h4f5c2dfg25', lastSync: '5 ngày trước' },
]

export const BIM_TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'issues', label: 'BCF Issues' },
  { key: 'objects', label: 'Objects' },
  { key: 'level', label: 'Level' },
  { key: 'roomspace', label: 'Room/Space' },
  { key: 'material', label: 'Material' },
  { key: 'filter', label: 'Filter' },
  { key: 'boq', label: 'BOQ' },
  { key: 'products', label: 'Sản phẩm' },
  { key: 'materialscat', label: 'Vật liệu' },
]

export const UNASSIGNED_PRODUCT = '— Chưa gán —'
export const BIM_OBJECTS = [
  { instance: '#18472', def: 'Door_D03_900x2400', ifc: 'IfcDoor', level: 'Tầng 01', product: 'Cửa gỗ công nghiệp phủ Laminate' },
  { instance: '#18201', def: 'Window_W02_1200x1500', ifc: 'IfcWindow', level: 'Tầng 01', product: 'Cửa sổ nhôm kính 2 lớp' },
  { instance: '#17988', def: 'Wall_Ext_200', ifc: 'IfcWall', level: 'Tầng 01', product: 'Tường gạch 200 hoàn thiện sơn' },
  { instance: '#17650', def: 'Column_C01_300x300', ifc: 'IfcColumn', level: 'Tầng 01', product: UNASSIGNED_PRODUCT },
  { instance: '#16920', def: 'Door_D07_800x2100', ifc: 'IfcDoor', level: 'Tầng 02', product: 'Cửa gỗ công nghiệp phủ Laminate' },
  { instance: '#16455', def: 'Slab_Roof_120', ifc: 'IfcSlab', level: 'Mái', product: 'Sàn mái BTCT chống thấm' },
]

export const INITIAL_LEVELS = [
  { code: 'L00', name: 'Sân vườn', elevation: -0.15, height: 0.15, status: 'recorded' },
  { code: 'L01', name: 'Tầng 01', elevation: 0, height: 3.6, status: 'selected' },
  { code: 'L02', name: 'Tầng 02', elevation: 3.6, height: 3.6, status: 'recorded' },
  { code: 'L03', name: 'Mái', elevation: 7.2, height: 2.1, status: 'recorded' },
]

export const BIM_ROOMS = [
  { code: 'P.101', name: 'Phòng khách', level: 'Tầng 01', area: 34.82, color: '#D9A441' },
  { code: 'P.102', name: 'Bếp + Ăn', level: 'Tầng 01', area: 27.45, color: '#3FA66B' },
  { code: 'P.201', name: 'Phòng ngủ 01', level: 'Tầng 02', area: 18.20, color: '#4C7FD9' },
  { code: 'P.202', name: 'Phòng ngủ 02', level: 'Tầng 02', area: 16.75, color: '#B85C7A' },
  { code: 'P.203', name: 'Sảnh thang', level: 'Tầng 02', area: 8.60, color: '#7A8B6F' },
]

export const INITIAL_MATERIALS = [
  { code: 'MAT-005', name: 'Tường trắng mờ', area: 684.26, status: 'linked', swatch: '#EDEFF4', checked: true },
  { code: 'MAT-001', name: 'Gỗ veneer sồi', area: 126.40, status: 'linked', swatch: '#B08355', checked: false },
  { code: 'MAT-003', name: 'Kính trong 10mm', area: 86.40, status: 'linked', swatch: '#B9C7CC', checked: false },
  { code: '—', name: 'MDF lõi xanh', area: 42.18, status: 'unlinked', swatch: '#3E6B52', checked: false },
]

export function fmtNum(n, d = 2) {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d })
}
/* Hai chữ cái đầu của 2 từ cuối, giống bản HTML */
export function nameInitials(name) {
  return name.split(' ').map(w => w[0]).slice(-2).join('')
}

/* ---------- Tổng quan ---------- */
export const OV_PROJECTS = [
  { code: 'THD', name: 'Nhà ở Thảo Điền', meta: 'MOA-26-THD · Thiết kế kỹ thuật', pct: 68 },
  { code: 'VPA', name: 'Văn phòng An Phú', meta: 'MOA-26-VPA · Thiết kế cơ sở', pct: 42 },
  { code: 'HBR', name: 'Hạ Long Boutique Resort', meta: 'MOA-25-HBR · Phối hợp bộ môn', pct: 84 },
  { code: 'LBK', name: 'Lavie Bakery Flagship', meta: 'MOA-25-LBK · Hoàn tất hồ sơ', pct: 96 },
]
export const OV_ATTENTION = [
  { icon: 'alert', color: 'danger', title: '3 issues quá hạn', sub: 'Nhà ở Thảo Điền', count: 3 },
  { icon: 'clock', color: 'finance', title: '2 models chưa đồng bộ', sub: 'Lần cuối hơn 7 ngày', count: 2 },
  { icon: 'link', color: 'bim', title: '164 objects chưa gán', sub: 'Cần chọn Product phù hợp', count: 164 },
]
export const OV_ACTIVITY = [
  { who: 'Trần Quốc Bảo', action: 'đã đồng bộ model', target: 'Kết cấu.skp', time: '12 phút trước' },
  { who: 'Lê Thảo Nguyên', action: 'đã cập nhật', target: 'ISS-039', time: '38 phút trước' },
  { who: 'Phạm Hoàng Nam', action: 'đã gán 24 objects vào', target: 'Tủ bếp dưới phủ laminate', time: '1 giờ trước' },
]

/* ---------- BCF Issues ---------- */
export const INITIAL_ISSUES = [
  { code: 'ISS-035', col: 'moi', title: 'Bổ sung khoảng bảo trì cho FCU-02', loc: 'Tầng 02 · Sảnh thang', prio: 'cao', due: '08/09/2026', assignee: 'Đặng Đức Huy', comments: 2, attach: 1 },
  { code: 'ISS-042', col: 'dangxuly', title: 'Xung đột cao độ cửa D03 và trần thạch cao', loc: 'Tầng 02 · Phòng ngủ 02', prio: 'cao', due: '09/09/2026', assignee: 'Trần Quốc Bảo', comments: 6, attach: 2 },
  { code: 'ISS-039', col: 'chophanhoi', title: 'Xác nhận vật liệu ốp tường phòng khách', loc: 'Tầng 01 · Phòng khách', prio: 'trung', due: '10/09/2026', assignee: 'Lê Thảo Nguyên', comments: 4, attach: 3 },
  { code: 'ISS-031', col: 'daigiaiquyet', title: 'Điều chỉnh kích thước hộc tủ bếp', loc: 'Tầng 01 · Bếp', prio: 'thap', due: '04/09/2026', assignee: 'Phạm Hoàng Nam', comments: 8, attach: 4 },
]
export const ISSUE_COLS = [
  { key: 'moi', label: 'Mới', color: 'primary' },
  { key: 'dangxuly', label: 'Đang xử lý', color: 'finance' },
  { key: 'chophanhoi', label: 'Chờ phản hồi', color: 'danger' },
  { key: 'daigiaiquyet', label: 'Đã giải quyết', color: 'success' },
]
export const PRIO_LABEL = { cao: 'Cao', trung: 'Trung bình', thap: 'Thấp' }
export const ISSUE_ASSIGNEES = ['Đặng Đức Huy', 'Trần Quốc Bảo', 'Lê Thảo Nguyên', 'Phạm Hoàng Nam']

/* ---------- Danh mục tổ chức ---------- */
export const INITIAL_PRODUCTS = [
  { code: 'PRD-DR-001', name: 'Cửa gỗ veneer sồi 900 × 2400', ifc: 'IfcDoor', method: 'Đếm đối tượng', unit: 'bộ', assigned: 18, scope: 'internal', status: 'active' },
  { code: 'PRD-WL-014', name: 'Tường gạch 200 hoàn thiện sơn', ifc: 'IfcWall', method: 'Thể tích / 200 mm', unit: 'm²', assigned: 126, scope: 'internal', status: 'active' },
  { code: 'PRD-GL-006', name: 'Vách kính cường lực 10 mm', ifc: 'IfcPlate', method: 'Diện tích mặt', unit: 'm²', assigned: 34, scope: 'public', status: 'active' },
  { code: 'PRD-FR-022', name: 'Tủ bếp dưới phủ laminate', ifc: 'IfcFurniture', method: 'Chiều dài', unit: 'm', assigned: 12, scope: 'internal', status: 'active' },
  { code: 'PRD-LT-009', name: 'Đèn downlight âm trần 9 W', ifc: 'IfcLightFixture', method: 'Đếm đối tượng', unit: 'cái', assigned: 76, scope: 'public', status: 'active' },
]
export const INITIAL_MATERIALS_CATALOG = [
  { code: 'MAT-001', name: 'Gỗ veneer sồi', category: 'Bề mặt hoàn thiện nội thất', desc: 'Bề mặt hoàn thiện nội thất', thickness: '3 mm' },
  { code: 'MAT-002', name: 'Gỗ MDF chống ẩm', category: 'Cốt gỗ công nghiệp', desc: 'Cốt xanh sử dụng cho nội thất', thickness: '18 mm' },
  { code: 'MAT-003', name: 'Kính cường lực', category: 'Vật liệu kính', desc: 'Kính trong, mài cạnh an toàn', thickness: '10 mm' },
  { code: 'MAT-004', name: 'Đá terrazzo trắng', category: 'Vật liệu đá', desc: 'Hạt đá tự nhiên, bề mặt honed', thickness: '20 mm' },
  { code: 'MAT-005', name: 'Sơn nội thất trắng mờ', category: 'Sơn - hoá chất', desc: 'Sơn nước hoàn thiện tường và trần', thickness: 'Không áp dụng' },
]

/* ---------- Filter ---------- */
export const FILTER_FIELDS = ['Level', 'Product group', 'Thuộc tính']
export const FILTER_OPS = { Level: ['bằng', 'khác'], 'Product group': ['bằng', 'khác'], 'Thuộc tính': ['chứa', 'không chứa'] }
export const INITIAL_FILTER_CONDITIONS = [
  { field: 'Level', op: 'bằng', value: 'Tầng 02' },
  { field: 'Product group', op: 'bằng', value: 'Cửa đi' },
  { field: 'Thuộc tính', op: 'chứa', value: 'Chống cháy' },
]
/* Số object phù hợp mô phỏng, giống updateMatchCount của bản HTML */
export function filterMatchCount(conditions) {
  const base = 8204
  if (!conditions.length) return base
  const filled = conditions.filter(c => c.value.trim()).length
  return Math.max(1, Math.round(base / Math.pow(4.2, filled)))
}

/* ---------- Dezbot ---------- */
export const AI_TOPICS = [
  { key: 'objects', label: 'Objects', prompt: 'Object nào chưa gán Product?' },
  { key: 'level', label: 'Level', prompt: 'Model có bao nhiêu Level?' },
  { key: 'material', label: 'Material', prompt: 'Vật liệu nào chưa liên kết?' },
  { key: 'boq', label: 'BOQ', prompt: 'Tình hình BOQ hiện tại?' },
  { key: 'filter', label: 'Filter model', prompt: 'Filter dùng chung cho những thao tác nào?', wide: true },
]
export function matchTopic(text) {
  const t = text.toLowerCase()
  const has = (...keys) => keys.some(k => t.indexOf(k) > -1)
  if (has('object', 'đối tượng')) return 'objects'
  if (has('level', 'tầng')) return 'level'
  if (has('vật liệu', 'material')) return 'material'
  if (has('boq', 'vat', 'giá')) return 'boq'
  if (has('filter', 'lọc')) return 'filter'
  return 'default'
}
/* Câu trả lời đọc trực tiếp dữ liệu hiện tại của trang (levels/materials có thể đã thay đổi) */
export function answerTopic(topic, { levels, materials }) {
  switch (topic) {
    case 'objects': {
      const unassigned = BIM_OBJECTS.filter(o => o.product === UNASSIGNED_PRODUCT)
      return `Model hiện có ${BIM_OBJECTS.length} object mẫu đang theo dõi. ` + (unassigned.length
        ? `${unassigned.length} object chưa gán Product: ${unassigned.map(o => o.instance).join(', ')}.`
        : 'Tất cả object đã có Product được gán.')
    }
    case 'level':
      return `Model có ${levels.length} Level: ${levels.map(l => l.name).join(', ')}. 98,6% object đã xác định tầng tự động, 14 quan hệ được khóa thủ công.`
    case 'material': {
      const unlinked = materials.filter(m => m.status === 'unlinked')
      return `Có ${materials.length} vật liệu SketchUp đang theo dõi. ` + (unlinked.length
        ? `${unlinked.map(m => m.name).join(', ')} chưa liên kết danh mục, cần gán thủ công.`
        : 'Tất cả vật liệu đã liên kết danh mục.')
    }
    case 'boq':
      return 'BOQ "thiết kế kỹ thuật" hiện có 126 dòng: trước VAT 16,75 tỷ, VAT 8% là 1,34 tỷ, sau VAT 18,09 tỷ. 74/81 product đã có đơn giá theo Pricing policy Q3/2026 Rev 04.'
    case 'filter':
      return 'Bộ lọc dùng chung 1 Query DSL cho Preview, Highlight, Safe Isolate và báo cáo — thay đổi điều kiện ở tab Filter sẽ áp dụng cho cả 3 thao tác này.'
    default:
      return 'Bạn có thể hỏi mình về Objects, Level, Material, Filter hoặc BOQ — mình đọc trực tiếp dữ liệu model đã liên kết SketchUp.'
  }
}
