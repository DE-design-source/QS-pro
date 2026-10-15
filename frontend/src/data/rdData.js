/* Dữ liệu trang R&D — lấy nguyên từ rd.html */

export const PROJECTS = [
  { name: 'Bê tông tự liền vết nứt', owner: 'TS. Nguyễn Bảo Châu', stage: 'thunghiem', progress: 55 },
  { name: 'Vật liệu cách nhiệt tái chế', owner: 'Đặng Quốc Huy', stage: 'trienkhai', progress: 70 },
  { name: 'Drone khảo sát công trường tự động', owner: 'Lâm Thanh Sơn', stage: 'trienkhai', progress: 80 },
  { name: 'Ứng dụng BIM 4D cho tiến độ', owner: 'Vũ Ngọc Anh', stage: 'hoanthanh', progress: 100 },
  { name: 'Sơn chống thấm nano', owner: 'Trịnh Minh Đức', stage: 'ytuong', progress: 15 },
  { name: 'Ván sàn composite chịu ẩm', owner: 'Nguyễn Thu Trang', stage: 'thunghiem', progress: 40 },
]

/* [nhãn, màu chữ] */
export const STAGE_LABEL = {
  ytuong: ['Ý tưởng', 'var(--text-muted)'],
  thunghiem: ['Thử nghiệm', 'var(--warn)'],
  trienkhai: ['Triển khai thí điểm', 'var(--primary)'],
  hoanthanh: ['Hoàn thành', 'var(--success)'],
}

export const IDEAS = [
  { author: 'Nguyễn Thu Trang', text: 'Dùng ván sàn composite chịu ẩm cho khu vực tầng hầm để giảm bảo trì.', status: 'duyet' },
  { author: 'Đặng Quốc Huy', text: 'Đề xuất chuẩn hoá quy trình đóng gói vật liệu cách nhiệt để giảm hao hụt vận chuyển.', status: 'xet' },
  { author: 'Lâm Thanh Sơn', text: 'Tích hợp dữ liệu drone khảo sát trực tiếp vào phần mềm Gantt để cập nhật tiến độ tự động.', status: 'xet' },
  { author: 'Trịnh Minh Đức', text: 'Thử nghiệm sơn chống thấm nano trên hạng mục tầng mái thay vì chỉ tường ngoài.', status: 'xet' },
  { author: 'Vũ Ngọc Anh', text: 'Mở rộng ứng dụng BIM 4D sang quản lý vật tư thay vì chỉ tiến độ thi công.', status: 'tuchoi' },
]

/* [nhãn, màu chữ, màu nền] */
export const IDEA_STATUS = {
  duyet: ['Đã duyệt', 'var(--success)', 'var(--success-tint)'],
  xet: ['Đang xét duyệt', 'var(--warn)', 'var(--warn-tint)'],
  tuchoi: ['Từ chối', 'var(--danger)', 'var(--danger-tint)'],
}

export const isActiveProject = p => p.stage !== 'hoanthanh'

/* Hai chữ cái đầu của hai từ cuối trong tên (giống initialsOf của bản HTML) */
export function initialsOf(name) {
  const parts = name.trim().split(/\s+/)
  return (parts[parts.length - (parts.length > 1 ? 2 : 1)][0] + parts[parts.length - 1][0]).toUpperCase()
}
