/* Thông báo mẫu cho chuông thông báo (đầu trang) — module quyết định biểu tượng & màu, `to` là trang mở khi bấm */
export const NOTIFICATIONS = [
  { id: 'n1', module: 'it', title: 'Yêu cầu hỗ trợ mới #1532', text: 'Trần Thị Hoa: Wifi công trường chậm, hay rớt mạng', time: '5 phút trước', to: '/it', unread: true },
  { id: 'n2', module: 'hr', title: '3 đơn nghỉ phép chờ bạn duyệt', text: 'Chấm công & phép — hạn duyệt trước 17:00 hôm nay', time: '20 phút trước', to: '/cham-cong#attendance', unread: true },
  { id: 'n3', module: 'mua', title: 'PO-0953 chuyển sang "Quản lý duyệt"', text: 'Coupler nối thép Φ32 · 96 triệu — cần bạn xử lý', time: '1 giờ trước', to: '/quan-ly-thiet-ke#tiendo', unread: true },
  { id: 'n4', module: 'chat', title: 'Nguyễn Đức Anh nhắc đến bạn', text: 'Riverside — Giai đoạn 2: "Đang khoảng 45% anh ơi, chắc mai xong"', time: '2 giờ trước', to: '/chat', unread: true },
  { id: 'n5', module: 'kd', title: 'Khách hàng mới: Chị Bích Ngọc', text: 'Biệt thự · 6 tỷ — đã chuyển sang Tư vấn (Concept)', time: '3 giờ trước', to: '/kinh-doanh', unread: false },
  { id: 'n6', module: 'qs', title: 'Bóc tách "Đức Trọng Villa" đã cập nhật', text: 'Giá bán 218.321.000 đ · biên lợi nhuận 19%', time: 'Hôm qua', to: '/qs', unread: false },
  { id: 'n7', module: 'tc', title: '620 triệu công nợ quá hạn', text: 'Chung cư Riverside GĐ2 — cần nhắc khách hàng thanh toán', time: 'Hôm qua', to: '/tai-chinh', unread: false },
  { id: 'n8', module: 'lich', title: 'Họp giao ban tuần · 08:30 sáng mai', text: 'Phòng họp tầng 3 · 12 người tham dự', time: 'Hôm qua', to: '/lich', unread: false },
]

export const NOTIF_MODULES = {
  it: { label: 'IT', color: 'var(--primary)', icon: 'M2 4h20v14H2zM8 21h8M12 18v3' },
  hr: { label: 'Nhân sự', color: 'var(--attendance)', icon: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' },
  mua: { label: 'Mua hàng', color: 'var(--finance)', icon: 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6M9 21h.01M20 21h.01' },
  chat: { label: 'Chat', color: 'var(--primary)', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  kd: { label: 'Kinh doanh', color: 'var(--sales)', icon: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6' },
  qs: { label: 'QS', color: 'var(--qs)', icon: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  tc: { label: 'Tài chính', color: 'var(--finance)', icon: 'M2 5h20v14H2zM2 10h20' },
  lich: { label: 'Lịch', color: 'var(--success)', icon: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18' },
}
