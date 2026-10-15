/* Dữ liệu mẫu & tiện ích cho tab "Mua hàng" của trang QS (chưa có API) */

export const PO_OTHER = 'Khác'
/* Thương hiệu → nhà cung cấp nhận đơn (Maxilite là dòng sơn của Dulux); không có thương hiệu thì vào nhóm "Khác" */
const BRAND_SUPPLIER = { Maxilite: 'Dulux' }
export const supplierOf = brand => (brand ? BRAND_SUPPLIER[brand] || brand : PO_OTHER)

/* Các đơn đã gửi sẵn có trên giao diện mẫu */
export const PO_SEED_ORDERS = [
  { code: 'MH-MUXOU6JE-2906', status: 'Chờ duyệt', supplier: 'Enic', count: 1, total: 516800, date: '07/10/2026', lines: [['1', 'Bộ xả Lavabo', 'Cái', 2, '258.400', '516.800', '516.800']] },
  { code: 'MH-MUXOU6B3-3180', status: 'Chờ duyệt', supplier: 'Toto', count: 3, total: 86286000, date: '07/10/2026', lines: [] },
]

/* Các đợt thanh toán đề xuất: đơn từ 10 triệu chia 4 đợt, nhỏ hơn thì thanh toán một lần */
export function paymentPlan(total) {
  const steps = total >= 10000000
    ? [['Đặt cọc khi ký đơn', 30], ['Khi giao hàng đợt 1', 30], ['Khi giao đủ hàng', 30], ['Sau nghiệm thu', 10]]
    : [['Thanh toán khi nhận hàng', 100]]
  return steps.map(([label, pct]) => ({ label, pct, amount: (total * pct) / 100 }))
}
