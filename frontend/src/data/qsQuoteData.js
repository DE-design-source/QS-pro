/* Dữ liệu mẫu & tiện ích cho tab "Xuất báo giá" của trang QS (chưa có API) */
import { CATALOG, productCode, rowValues } from './qsBreakdownData'

const money = n => Math.round(n).toLocaleString('vi-VN')

/* 27 cột có thể xuất trên bảng báo giá chi tiết. internal: cột nội bộ, không in trên bản gửi khách */
export const QUOTE_COLUMNS = [
  { key: 'stt', label: 'STT', w: 54, align: 'center' },
  { key: 'room', label: 'Phòng', w: 100 },
  { key: 'drawing', label: 'Mã số bản vẽ', w: 96 },
  { key: 'line', label: 'Dòng sản phẩm', w: 130 },
  { key: 'code', label: 'Mã sản phẩm', w: 90 },
  { key: 'name', label: 'Tên sản phẩm', w: 170 },
  { key: 'brand', label: 'Thương hiệu', w: 96 },
  { key: 'supplier', label: 'Nhà cung cấp', w: 100 },
  { key: 'info', label: 'Thông tin chính', w: 170 },
  { key: 'specs', label: 'Thông số thiết kế', w: 150 },
  { key: 'image', label: 'Hình ảnh', w: 90, align: 'center' },
  { key: 'docs', label: 'Tài liệu', w: 76, align: 'center' },
  { key: 'unit', label: 'Đơn vị tính', w: 72, align: 'center' },
  { key: 'qty', label: 'Số lượng', w: 72, align: 'right' },
  { key: 'retail', label: 'Giá bán lẻ', w: 100, align: 'right', internal: true },
  { key: 'discount', label: 'Chiết khấu của đại lý (%)', w: 104, align: 'right', internal: true },
  { key: 'dealer', label: 'Giá đại lý', w: 100, align: 'right', internal: true },
  { key: 'margin', label: 'Lợi nhuận dự kiến (%)', w: 92, align: 'right', internal: true },
  { key: 'price', label: 'Giá bán', w: 100, align: 'right' },
  { key: 'custDiscount', label: 'Chiết khấu cho khách hàng (%)', w: 104, align: 'right' },
  { key: 'unitPrice', label: 'Đơn giá', w: 100, align: 'right' },
  { key: 'markup', label: 'Markup (%) — LN/giá vốn', w: 96, align: 'right', internal: true },
  { key: 'marginPct', label: 'Margin (%) — LN/giá bán', w: 96, align: 'right', internal: true },
  { key: 'profit', label: 'Lợi nhuận (VND)', w: 104, align: 'right', internal: true },
  { key: 'amount', label: 'Thành tiền', w: 110, align: 'right' },
  { key: 'status', label: 'Trạng thái', w: 86, align: 'center' },
  { key: 'note', label: 'Ghi chú', w: 130 },
]
/* Mặc định tắt cột Markup như giao diện mẫu (26/27) */
export const QUOTE_DEFAULT_HIDDEN = ['markup']
const INTERNAL = QUOTE_COLUMNS.filter(c => c.internal).map(c => c.key)
const MINIMAL = ['stt', 'name', 'brand', 'unit', 'qty', 'unitPrice', 'amount']
export const QUOTE_COL_PRESETS = [
  { key: 'default', label: 'Mặc định', note: '26 cột, tắt Markup', hidden: QUOTE_DEFAULT_HIDDEN },
  { key: 'all', label: 'Đầy đủ', note: 'Bật cả 27 cột', hidden: [] },
  { key: 'client', label: 'Gửi khách', note: 'Tắt các cột giá nội bộ', hidden: INTERNAL },
  { key: 'minimal', label: 'Tối giản', note: 'Tên, thương hiệu, số lượng, đơn giá, thành tiền', hidden: QUOTE_COLUMNS.filter(c => !MINIMAL.includes(c.key)).map(c => c.key) },
]
export const QUOTE_INTERNAL_LABEL = 'Giá bán lẻ NCC, CK đại lý, Giá đại lý, % lợi nhuận, Margin, Lợi nhuận (VND)'

const field = (text, label) => {
  const m = (text || '').match(new RegExp(`${label}: ([^\\n]+)`))
  return m ? m[1].trim() : ''
}
/* Chữ của một ô trên bảng báo giá chi tiết (cột image / docs do nơi hiển thị tự vẽ) */
export function quoteCell(r, key, stt) {
  const v = rowValues(r)
  const has = r.retail > 0
  switch (key) {
    case 'stt': return stt
    case 'drawing': return ''
    case 'line': return field(r.info, 'Dòng sản phẩm')
    case 'code': { const p = CATALOG.find(c => c.id === r.productId); return p ? productCode(p) : '' }
    case 'supplier': return r.brand || ''
    case 'specs': return r.features || ''
    case 'image': return ''
    case 'docs': return r.docs ? String(r.docs) : '—'
    case 'qty': return r.qty ? String(r.qty) : ''
    case 'retail': return money(r.retail)
    case 'discount': return String(r.discount)
    case 'dealer': return money(v.dealer)
    case 'margin': return String(r.margin)
    case 'price': case 'unitPrice': return money(v.price)
    case 'custDiscount': return '0'
    case 'markup': return has && v.dealer ? String(Math.round(((v.price - v.dealer) / v.dealer) * 100)) : '0'
    case 'marginPct': return has && v.price ? String(Math.round(((v.price - v.dealer) / v.price) * 100)) : '0'
    case 'profit': return money(v.profit)
    case 'amount': return money(v.amount)
    case 'status': return ''
    default: return r[key] || ''
  }
}

let seq = 0
export const quoteId = () => { seq += 1; return `q${seq}` }
/* src: 'sheet' = lấy số tự động từ bảng Bóc tách (hạng mục Sơn nước); agg: dòng tổng của các mục inAgg cùng mục lớn */
const item = (name, desc, extra = {}) => ({ id: quoteId(), name, desc, amount: null, ...extra })
const fitout = (name, desc, extra = {}) => item(name, desc, { inAgg: true, ...extra })

/* Mẫu tờ bìa "Ước tính chi phí dự án" */
export function coverTemplate() {
  return [
    { id: quoteId(), no: 1, name: 'TƯ VẤN DỰ ÁN', on: false, items: [
      item('Khảo sát hiện trạng', 'Khảo sát, đo đạc và lập hồ sơ hiện trạng'),
      item('Lập dự toán sơ bộ', 'Ước tính chi phí theo quy mô và phân khúc'),
    ] },
    { id: quoteId(), no: 2, name: 'TƯ VẤN THIẾT KẾ', on: false, items: [
      item('Thiết kế kiến trúc', 'Mặt bằng, mặt đứng, mặt cắt, phối cảnh'),
      item('Thiết kế nội thất', 'Concept, bản vẽ 3D và hồ sơ thi công nội thất'),
    ] },
    { id: quoteId(), no: 3, name: 'XÂY DỰNG', on: true, items: [
      item('Phần thô', 'Chuẩn bị mặt bằng, thi công móng và nền, thi công cột, dầm, sàn, thi công tường bao, tường ngăn, tô trát, hoàn thiện phần thô, kiểm tra và nghiệm thu phần thô'),
      item('Phần hoàn thiện cơ bản', 'Thi công hoàn thiện trần, tường, sàn, lắp đặt TBVS, thiết bị điện lạnh, lắp đặt cửa nội thất, tay vịn cầu thang...', { agg: true }),
      fitout('Trần thạch cao', 'Nhân công và vật tư'),
      fitout('Sơn nước', 'Nhân công và vật tư', { src: 'sheet' }),
      fitout('Xây tô', 'Nhân công và vật tư'),
      fitout('Ốp lát', 'Nhân công và vật tư'),
      fitout('Thiết bị vệ sinh', 'Cung cấp thiết bị và nhân công lắp đặt'),
      fitout('Thiết bị điện', 'Đèn, công tắc - ổ cắm: cung cấp thiết bị và nhân công lắp đặt'),
      fitout('Thiết bị điện lạnh', 'Cung cấp thiết bị và nhân công lắp đặt'),
      fitout('Cửa', 'Sản xuất và nhân công lắp đặt'),
    ] },
    { id: quoteId(), no: 4, name: 'HOÀN THIỆN NỘI THẤT', on: false, items: [
      item('Nội thất liền tường', 'Tủ bếp, tủ áo, kệ, vách ốp'),
      item('Nội thất rời', 'Sofa, bàn ghế, giường, đèn trang trí'),
    ] },
    { id: quoteId(), no: 5, name: 'BẢO DƯỠNG', on: true, items: [
      item('Bảo dưỡng định kỳ', 'Cung cấp các gói bảo dưỡng định kỳ cho các thiết bị như máy lạnh, bình nước nóng....'),
      item('Bảo hiểm', 'Cung cấp các gói bảo hiểm thay thế, sửa chữa cho các thiết bị như đèn, thiết bị vệ sinh, sơn nước, sàn gỗ...v.....'),
    ] },
  ]
}

/* Số tiền của một dòng tờ bìa. sheetTotal: tạm tính của bảng Bóc tách */
export function coverAmount(it, section, sheetTotal) {
  if (it.agg) return section.items.filter(x => x.inAgg).reduce((s, x) => s + coverAmount(x, section, sheetTotal), 0)
  if (it.amount !== null) return it.amount
  return it.src === 'sheet' ? sheetTotal : 0
}
/* Tổng tờ bìa: cộng các mục đang bật, bỏ qua dòng tổng (agg) để không cộng trùng */
export const coverTotal = (sections, sheetTotal) => sections.filter(s => s.on).reduce((sum, s) => sum + s.items.filter(it => !it.agg).reduce((a, it) => a + coverAmount(it, s, sheetTotal), 0), 0)

export const EMPTY_INFO = { client: 'test', project: 'test', status: '', scale: '', areaTotal: '', need: '', style: '', segment: '' }
export const DEFAULT_TERMS = 'Báo giá có hiệu lực 30 ngày kể từ ngày phát hành.\nĐơn giá đã bao gồm vận chuyển trong nội thành, chưa bao gồm VAT nếu không ghi rõ.\nTạm ứng 50% khi ký hợp đồng, thanh toán phần còn lại khi nghiệm thu bàn giao.'
export const ROWS_PER_PAGE = [['auto', 'Tự động'], ['6', '6 dòng'], ['10', '10 dòng'], ['15', '15 dòng'], ['20', '20 dòng']]
export const ZOOMS = [['fit', 'Vừa khung'], ['75', '75%'], ['100', '100%'], ['125', '125%']]
export const AUTO_ROWS = 8
export const quoteMoney = money
