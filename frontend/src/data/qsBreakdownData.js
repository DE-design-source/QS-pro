/* Dữ liệu mẫu cho tab "Bóc tách" của trang QS (chưa có API) */

/* Cột của bảng bóc tách; w: bề rộng (px); pin: cố định bên trái khi cuộn ngang */
export const SHEET_COLUMNS = [
  { key: 'stt', label: 'STT', w: 75, pin: true, align: 'center' },
  { key: 'room', label: 'Phòng', w: 134, pin: true },
  { key: 'name', label: 'Tên sản phẩm', w: 213, pin: true },
  { key: 'brand', label: 'Thương hiệu', w: 123 },
  { key: 'info', label: 'Thông tin chính', w: 209 },
  { key: 'features', label: 'Tính năng sản phẩm', w: 168 },
  { key: 'image', label: 'Hình ảnh', w: 117, align: 'center' },
  { key: 'docs', label: 'Tài liệu', w: 104, align: 'center' },
  { key: 'unit', label: 'Đơn vị tính', w: 94, align: 'center' },
  { key: 'qty', label: 'Số lượng', w: 95, align: 'right' },
  { key: 'retail', label: 'Giá bán lẻ', w: 120, align: 'right' },
  { key: 'discount', label: 'Chiết khấu của đại lý (%)', w: 112, align: 'right' },
  { key: 'dealer', label: 'Giá đại lý', w: 120, align: 'right' },
  { key: 'margin', label: 'Lợi nhuận dự kiến (%)', w: 112, align: 'right' },
  { key: 'price', label: 'Giá bán', w: 120, align: 'right' },
  { key: 'amount', label: 'Thành tiền', w: 130, align: 'right' },
  { key: 'note', label: 'Ghi chú', w: 170 },
]
export const ROW_NUM_WIDTH = 57

export const CATALOG_TOTAL = 146
export const FAVORITE_BASE = 10
export const ACTIVE_CATEGORY = { code: '3.2.2', name: 'Sơn nước' }

const p = (no, name, price, brand, combo, variants, tone, extra = {}) => ({
  id: `sp${no}`, no, name, price, brand, combo, variants, tone, unit: 'Kg', docs: 1, discount: 0, margin: 0, info: '', features: '', ...extra,
})

/* Danh sách sản phẩm ở cột trái (tone: màu thùng sơn minh hoạ) */
export const CATALOG = [
  p(1, 'Bột trét nội thất - Trắng - 20 Kg', 268000, 'Dulux', 2, 2, '#8FA3B8', {
    info: 'Độ phủ: 1-1,2 m2/kg/ 2 lớp với độ dày tiêu chuẩn 1mm/lớp\nThời gian khô: 1-2 giờ *tùy thuộc vào điều kiện thi công\nSố lớp: 2\nDòng sản phẩm: Bột trét\nHạng mục: Sơn nước\nKích thước: 20 Kg',
    features: 'Bề mặt nhẵn mịn\nĐộ bám dính cao\nDễ thi công, dễ xả nhám',
  }),
  p(3, 'Bột trét nội và ngoại thất - Trắng - 20 Kg', 358000, 'Dulux', 1, 2, '#6F8FB5', {
    info: 'Độ phủ: 1-1,2 m2/kg/ 2 lớp\nThời gian khô: 2-3 giờ\nSố lớp: 2\nDòng sản phẩm: Bột trét\nHạng mục: Sơn nước\nKích thước: 20 Kg',
    features: 'Chống nứt chân chim\nChịu thời tiết tốt\nĐộ bám dính cao',
  }),
  p(5, 'Bột trét tường Nội & Ngoại thất Maxilite từ Dulux - Trắng - 20 Kg', 210000, 'Maxilite', 1, 2, '#B5483E', {
    info: 'Độ phủ: 1 m2/kg/ 2 lớp\nThời gian khô: 2 giờ\nSố lớp: 2\nDòng sản phẩm: Bột trét\nHạng mục: Sơn nước\nKích thước: 20 Kg',
    features: 'Kinh tế\nBề mặt láng mịn\nDễ thi công',
  }),
  p(7, 'Chống thấm hiệu quả tường ngoại thất Dulux Aquatech - Trắng - 6 Kg', 929000, 'Dulux', 1, 2, '#2E7CC4', {
    info: 'Bề mặt hoàn thiện: Không phân loại\nĐộ phủ: 4 - 5 m2/kg/lớp (tùy thuộc độ dày màng sơn và bề mặt tường)\nThời gian khô: 6-8 giờ\nSố lớp: 2\nKích thước: 6 Kg\nDòng sản phẩm: Chất chống thấm cao cấp\nHạng mục: Sơn nước',
    features: 'Chống thấm hiệu quả, độ bám dính cao, bề mặt sáng đẹp.\nSản phẩm pha trộn với xi măng.\nĐộ phủ lý thuyết: 4-5m²/kg/lớp.',
  }),
  p(9, 'Chống thấm sàn Dulux Aquatech Max', 1355000, 'Dulux', 0, 1, '#1F8FD1', {
    info: 'Bề mặt hoàn thiện: Mờ\nĐộ phủ: 3 - 4 m2/kg/lớp (tùy thuộc vào điều kiện bề mặt sàn, phương pháp thi công và tỉ lệ pha loãng)\nThời gian khô: 1-2 giờ\nSố lớp: 3\nDòng sản phẩm: Chất chống thấm siêu cao cấp\nHạng mục: Sơn nước\nKích thước: 6 Kg',
    features: 'Chất chống thấm SÀN THẾ HỆ MỚI\nChống thấm gấp 2 lần\nMàng chống thấm dày với độ co giãn cao, che lấp khe nứt nhỏ\nSản phẩm không cần pha xi măng, dễ thi công\nĐộ phủ lý thuyết: 3-4m²/kg/lớp',
  }),
  p(11, 'Sơn lót nội thất Dulux Interior Primer - 18 L', 1450000, 'Dulux', 1, 2, '#3F6FB0', {
    unit: 'Thùng', info: 'Bề mặt hoàn thiện: Mờ\nĐộ phủ: 10 - 12 m2/lít/lớp\nThời gian khô: 1 giờ\nSố lớp: 1\nHạng mục: Sơn nước\nKích thước: 18 L',
    features: 'Kháng kiềm\nTăng độ bám dính cho lớp phủ\nChống nấm mốc',
  }),
  p(13, 'Sơn lót ngoại thất Dulux Weathershield Primer - 18 L', 1890000, 'Dulux', 2, 2, '#205C9E', {
    unit: 'Thùng', info: 'Bề mặt hoàn thiện: Mờ\nĐộ phủ: 10 - 12 m2/lít/lớp\nThời gian khô: 2 giờ\nSố lớp: 1\nHạng mục: Sơn nước\nKích thước: 18 L',
    features: 'Kháng kiềm, kháng muối\nChống thấm ngược\nBám dính vượt trội',
  }),
  p(15, 'Sơn nội thất Dulux EasyClean Lau chùi hiệu quả - Bóng - 15 L', 2150000, 'Dulux', 2, 3, '#4A90C8', {
    unit: 'Thùng', info: 'Bề mặt hoàn thiện: Bóng\nĐộ phủ: 12 - 14 m2/lít/lớp\nThời gian khô: 1 giờ\nSố lớp: 2\nHạng mục: Sơn nước\nKích thước: 15 L',
    features: 'Lau chùi vết bẩn dễ dàng\nKháng khuẩn\nMàu sắc bền đẹp',
  }),
  p(17, 'Sơn nội thất Maxilite Smooth - Mờ - 18 L', 760000, 'Maxilite', 1, 2, '#C0564B', {
    unit: 'Thùng', info: 'Bề mặt hoàn thiện: Mờ\nĐộ phủ: 9 - 11 m2/lít/lớp\nThời gian khô: 1 giờ\nSố lớp: 2\nHạng mục: Sơn nước\nKích thước: 18 L',
    features: 'Màng sơn mịn\nĐộ che phủ cao\nKinh tế',
  }),
  p(19, 'Sơn ngoại thất Maxilite Tough - Mờ - 18 L', 1240000, 'Maxilite', 1, 2, '#A9443A', {
    unit: 'Thùng', info: 'Bề mặt hoàn thiện: Mờ\nĐộ phủ: 9 - 11 m2/lít/lớp\nThời gian khô: 2 giờ\nSố lớp: 2\nHạng mục: Sơn nước\nKích thước: 18 L',
    features: 'Chống rêu mốc\nBền màu\nChịu thời tiết',
  }),
  p(21, 'Sơn chống thấm đa năng Dulux Aquatech Flex - 6 Kg', 985000, 'Dulux', 0, 1, '#2A86C9', {
    info: 'Độ phủ: 2 - 3 m2/kg/lớp\nThời gian khô: 2 giờ\nSố lớp: 2\nDòng sản phẩm: Chất chống thấm\nHạng mục: Sơn nước\nKích thước: 6 Kg',
    features: 'Co giãn 300%\nChống thấm tường, sàn, mái\nKhông cần pha xi măng',
  }),
  p(23, 'Sơn ngoại thất Dulux Weathershield Powerflexx - Bóng - 5 L', 1675000, 'Dulux', 2, 3, '#1D5FA8', {
    unit: 'Lon', info: 'Bề mặt hoàn thiện: Bóng\nĐộ phủ: 11 - 13 m2/lít/lớp\nThời gian khô: 2 giờ\nSố lớp: 2\nHạng mục: Sơn nước\nKích thước: 5 L',
    features: 'Che phủ vết nứt\nChống bám bụi\nBảo vệ 10 năm',
  }),
  p(25, 'Sơn nội thất Dulux Ambiance 5in1 Superflexx - Bóng mờ - 5 L', 1320000, 'Dulux', 1, 3, '#5B9BD5', {
    unit: 'Lon', info: 'Bề mặt hoàn thiện: Bóng mờ\nĐộ phủ: 13 - 15 m2/lít/lớp\nThời gian khô: 1 giờ\nSố lớp: 2\nHạng mục: Sơn nước\nKích thước: 5 L',
    features: 'Che phủ vết nứt nhỏ\nBề mặt sang trọng\nÍt mùi',
  }),
]

/* Thứ tự 13 dòng đã bóc của hạng mục Sơn nước (tổng 14.590.000 đ) */
const SHEET_ORDER = [9, 1, 3, 5, 7, 11, 13, 15, 17, 19, 21, 23, 25]

let rowSeq = 0
/* Tạo một dòng bảng tính từ sản phẩm trong danh mục (hoặc dòng trống khi không truyền) */
/* id mới cho dòng nhân bản / dán */
export const nextRowId = () => { rowSeq += 1; return `r${rowSeq}` }
export function makeRow(product) {
  rowSeq += 1
  const base = product || { name: '', brand: '', info: '', features: '', unit: '', docs: 0, price: 0, discount: 0, margin: 0, tone: null }
  return {
    id: `r${rowSeq}`, room: '', name: base.name, brand: base.brand, info: base.info, features: base.features,
    tone: base.tone, docs: base.docs, unit: base.unit, qty: product ? 1 : 0,
    retail: base.price, discount: base.discount, margin: base.margin, note: '', productId: product ? product.id : null, fmt: {},
  }
}

export const INITIAL_GROUPS = [
  { id: 'g1', name: 'TẦNG 1', collapsed: false, rows: SHEET_ORDER.map(no => makeRow(CATALOG.find(c => c.no === no))) },
  { id: 'g2', name: 'CHƯA PHÂN TẦNG', collapsed: false, rows: [] },
]

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
export const roman = i => ROMAN[i] || String(i + 1)

/* Tên cột kiểu bảng tính: 0 → A, 1 → B… */
export const colLetter = i => String.fromCharCode(65 + i)

const money = n => Math.round(n).toLocaleString('vi-VN')
export const formatDong = n => `${money(n)} đ`

/* Giá trị các ô tính toán của một dòng */
/* price: giá bán = giá bán lẻ cộng % lợi nhuận dự kiến; dealer: giá đại lý (giá vốn) sau chiết khấu.
   amount / costAmount / profit: thành tiền bán, thành tiền vốn và lợi nhuận của cả dòng */
export function rowValues(r) {
  const dealer = r.retail * (1 - r.discount / 100)
  const price = r.retail * (1 + r.margin / 100)
  return { dealer, price, amount: price * r.qty, costAmount: dealer * r.qty, profit: (price - dealer) * r.qty }
}

/* Chuỗi hiển thị của một ô (dùng cho cả ô lẫn thanh công thức) */
export function cellText(r, key, stt) {
  const v = rowValues(r)
  switch (key) {
    case 'stt': return stt
    case 'qty': return r.qty ? String(r.qty) : ''
    case 'retail': return r.retail ? money(r.retail) : ''
    case 'dealer': return r.retail ? money(v.dealer) : ''
    case 'price': return r.retail ? money(v.price) : ''
    case 'amount': return v.amount ? money(v.amount) : ''
    case 'costAmount': return v.costAmount ? money(v.costAmount) : ''
    case 'profit': return v.profit ? money(v.profit) : ''
    case 'floor': return ''
    case 'discount': return `${r.discount}%`
    case 'margin': return `${r.margin}%`
    case 'docs': return r.docs ? String(r.docs) : ''
    case 'image': return ''
    default: return r[key] || ''
  }
}

/* ---------- Bộ lọc của cột sản phẩm ----------
   options: [nhãn, số sản phẩm] — số đếm lấy theo giao diện mẫu (danh mục thật có 146+ SP), không tính từ CATALOG mẫu */
export const FILTER_DEFS = [
  { key: 'cat', label: 'Hạng mục', type: 'chips', options: [['Sơn nội thất', 56], ['Sơn ngoại thất', 50], ['Sơn lót', 20], ['Sơn chống thấm', 10], ['Bả matit', 6], ['Phụ gia', 4]] },
  { key: 'finish', label: 'Bề mặt hoàn thiện', type: 'chips', options: [['Bóng', 38], ['Bóng mờ', 16], ['Bóng trung bình', 3], ['Độ Bóng thấp', 2], ['Không phân loại', 30], ['Mờ', 48], ['Siêu bóng', 9]] },
  { key: 'size', label: 'Kích thước', type: 'chips', options: [['0.75L', 1], ['0.8L', 1], ['15L', 39], ['17L', 3], ['18L', 10], ['1L', 23], ['2.5L', 1], ['20 Kg', 9], ['3L', 1], ['40 Kg', 2], ['4.5L', 2], ['5L', 46], ['6 Kg', 8]] },
  { key: 'fav', label: 'Yêu thích', type: 'fav' },
  { key: 'combo', label: 'Combo', type: 'chips', single: true, options: [['Có', 101], ['Không có', 845]] },
  { key: 'brand', label: 'Thương hiệu', type: 'brand' },
  { key: 'price', label: 'Khoảng giá', type: 'price' },
]
export const CATALOG_BRANDS = [...new Set(CATALOG.map(c => c.brand))]
export const EMPTY_FILTERS = { cat: [], finish: [], size: [], fav: false, combo: [], brand: '', priceFrom: '', priceTo: '' }

const infoField = (c, label) => {
  const m = c.info.match(new RegExp(`${label}: ([^\n]+)`))
  return m ? m[1].trim() : ''
}
/* Thuộc tính dùng để lọc của một sản phẩm */
export function productFacets(c) {
  const n = c.name.toLowerCase()
  const cat = n.startsWith('bột trét') ? 'Bả matit'
    : n.includes('chống thấm') ? 'Sơn chống thấm'
      : n.startsWith('sơn lót') ? 'Sơn lót'
        : n.startsWith('sơn ngoại thất') ? 'Sơn ngoại thất' : 'Sơn nội thất'
  return {
    cat,
    finish: infoField(c, 'Bề mặt hoàn thiện') || 'Không phân loại',
    size: infoField(c, 'Kích thước').replace(/ L$/, 'L'),
    combo: c.combo > 0 ? 'Có' : 'Không có',
  }
}
/* Sản phẩm có khớp bộ lọc đang chọn không (bỏ trống một mục = không lọc theo mục đó) */
export function matchFilters(c, f, isFavorite) {
  const x = productFacets(c)
  if (f.cat.length && !f.cat.includes(x.cat)) return false
  if (f.finish.length && !f.finish.includes(x.finish)) return false
  if (f.size.length && !f.size.includes(x.size)) return false
  if (f.combo.length && !f.combo.includes(x.combo)) return false
  if (f.fav && !isFavorite) return false
  if (f.brand && c.brand !== f.brand) return false
  if (f.priceFrom !== '' && c.price < Number(f.priceFrom)) return false
  if (f.priceTo !== '' && c.price > Number(f.priceTo)) return false
  return true
}

/* ---------- Thao tác trên ô của bảng tính ---------- */
export const EDITABLE_KEYS = new Set(['room', 'name', 'brand', 'info', 'features', 'unit', 'qty', 'retail', 'discount', 'margin', 'note'])
export const NUMERIC_KEYS = new Set(['qty', 'retail', 'discount', 'dealer', 'margin', 'price', 'amount', 'costAmount', 'profit'])
/* 5 cột giá bật/tắt chung bằng nút "Giá" */
export const PRICE_KEYS = ['retail', 'discount', 'dealer', 'margin', 'price']

/* Đọc số người dùng gõ: "1.355.000", "1355000", "30%", "0,5" hoặc "0.5" */
export function parseNumber(text) {
  const s = String(text).replace(/[^\d,.-]/g, '')
  if (!s) return 0
  const n = /^-?\d+\.\d{1,2}$/.test(s) ? Number(s) : Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
/* Giá trị số của một ô (null nếu ô không phải số hoặc đang trống) */
export function cellNumber(r, key) {
  if (!NUMERIC_KEYS.has(key)) return null
  if (key === 'qty') return r.qty || null
  if (!r.retail) return null
  if (key === 'retail' || key === 'discount' || key === 'margin') return r[key]
  return rowValues(r)[key]
}
/* Chuỗi đưa vào ô nhập khi sửa */
export const editText = (r, key) => (NUMERIC_KEYS.has(key) ? (r[key] ? String(r[key]) : '') : (r[key] || ''))
/* Trả về dòng mới sau khi gõ text vào ô key */
export function applyEdit(r, key, text) {
  if (!EDITABLE_KEYS.has(key)) return r
  if (!NUMERIC_KEYS.has(key)) return r[key] === text ? r : { ...r, [key]: text }
  let n = parseNumber(text)
  if (key === 'discount' || key === 'margin') n = Math.max(0, Math.min(100, n))
  if (n < 0) n = 0
  return r[key] === n ? r : { ...r, [key]: n }
}

/* Trải các nhóm thành danh sách dòng đang hiện. n: số dòng tuyệt đối (đếm cả dòng bị ẩn);
   pred(r, stt): bộ lọc dòng sản phẩm, bỏ trống = hiện hết */
export function flattenSheet(groups, pred) {
  let n = 0
  const out = []
  groups.forEach((g, gi) => {
    n += 1
    out.push({ type: 'group', g, gi, n })
    g.rows.forEach((r, ri) => {
      n += 1
      const stt = `${gi + 1}.${ri + 1}`
      if (!g.collapsed && (!pred || pred(r, stt))) out.push({ type: 'item', g, gi, r, ri, n, stt })
    })
  })
  return out
}
/* Chữ hiển thị của một ô bất kỳ (dòng nhóm: số La Mã ở cột STT, tên nhóm ở cột Phòng/Tên) */
export function entryText(e, key) {
  if (e.type === 'total') return e.cells[key] || ''
  if (e.type === 'item') return key === 'floor' ? e.g.name : cellText(e.r, key, e.stt)
  if (key === 'stt') return roman(e.gi)
  return key === 'room' || key === 'name' ? e.g.name : ''
}

/* Tách văn bản dạng bảng (TSV/CSV, có hỗ trợ ô trong dấu ngoặc kép chứa xuống dòng) thành ma trận */
export function parseTable(text, delim = '\t') {
  const rows = [[]]
  let cell = ''
  let quoted = false
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delim) { rows[rows.length - 1].push(cell); cell = '' } else if (ch === '\n') { rows[rows.length - 1].push(cell); cell = ''; rows.push([]) } else cell += ch
  }
  rows[rows.length - 1].push(cell)
  if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop()
  return rows
}
/* Ghép ma trận thành văn bản dạng bảng, tự bọc ngoặc kép khi ô có ký tự đặc biệt */
export function formatTable(matrix, delim = '\t') {
  const q = v => (new RegExp(`["\n${delim === '\t' ? '\t' : delim}]`).test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return matrix.map(row => row.map(v => q(String(v))).join(delim)).join('\n')
}

/* ---------- Cột "Thông tin sản phẩm" ---------- */
/* Mã sản phẩm hiển thị (ví dụ sản phẩm số 7 → C8033 như giao diện mẫu) */
export const productCode = c => `C80${String(c.no + 26).padStart(2, '0')}`
/* Mục IX của tài liệu an toàn — dữ liệu mẫu dùng chung cho mọi sản phẩm */
export const PHYSICAL_PROPS = [
  ['Trạng thái vật lý', 'Chất lỏng'],
  ['Màu sắc', 'Trắng'],
  ['Mùi', 'Đặc tính'],
  ['Ngưỡng về mùi', 'Không có sẵn'],
  ['pH', '9'],
  ['Điểm chảy/điểm đông', 'Không có sẵn'],
  ['Điểm sôi, điểm sôi ban đầu, và dải sôi', '100°C (212°F)'],
  ['Điểm bùng cháy', 'Cốc đậy kín: Không áp dụng.'],
  ['Khả năng cháy', 'Không có sẵn'],
  ['Giới hạn nổ dưới và trên', 'Không có sẵn'],
  ['Áp suất hóa hơi', 'Không có sẵn'],
  ['Mật độ hơi tương đối', 'Không có sẵn'],
  ['Mật độ tương đối', '1.403'],
  ['Độ hòa tan trong nước', 'Dễ dàng hòa tan bằng nước lạnh'],
  ['Tính dẻo', '3.56 cm2 ở nhiệt độ phòng'],
  ['Lưu ý', 'Không thi công khi trời mưa hoặc trong môi trường ẩm ướt để đạt tính thẩm mỹ của bề mặt sau khi hoàn thiện và kết quả chống thấm tốt nhất.'],
]

/* ---------- Hộp "Thêm tầng / phòng" ---------- */
export const FLOOR_PRESETS = ['TẦNG HẦM', 'TẦNG LỬNG', 'TẦNG TRỆT', 'TẦNG 1', 'TẦNG 2', 'TẦNG 3', 'TẦNG 4', 'TẦNG 5', 'SÂN THƯỢNG', 'TẦNG MÁI', 'TUM THANG']
export const ROOM_PRESETS = ['PHÒNG KHÁCH', 'PHÒNG BẾP', 'PHÒNG ĂN', 'PHÒNG NGỦ MASTER', 'PHÒNG NGỦ 1', 'PHÒNG NGỦ 2', 'PHÒNG NGỦ 3', 'PHÒNG VỆ SINH', 'WC CHUNG', 'WC MASTER']

/* ---------- Tab "Chi phí" ---------- */
/* Cột của bảng chi phí (cột STT luôn hiện và không tính vào số đếm cột) */
export const COST_COLUMNS = [
  { key: 'stt', label: 'STT', w: 52, pin: true, align: 'center' },
  { key: 'name', label: 'Tên sản phẩm', w: 300, pin: true },
  { key: 'brand', label: 'Thương hiệu', w: 130 },
  { key: 'floor', label: 'Tầng / phòng', w: 150 },
  { key: 'unit', label: 'Đơn vị tính', w: 130, align: 'center' },
  { key: 'qty', label: 'Số lượng', w: 130, align: 'right' },
  { key: 'retail', label: 'Giá bán lẻ', w: 160, align: 'right' },
  { key: 'discount', label: 'Chiết khấu của đại lý (%)', w: 190, align: 'right' },
  { key: 'dealer', label: 'Giá đại lý', w: 160, align: 'right' },
  { key: 'margin', label: 'Lợi nhuận dự kiến (%)', w: 150, align: 'right' },
  { key: 'price', label: 'Giá bán', w: 160, align: 'right' },
  { key: 'profit', label: 'Lợi nhuận (VND)', w: 190, align: 'right' },
  { key: 'amount', label: 'Thành tiền', w: 170, align: 'right' },
  { key: 'costAmount', label: 'Thành tiền vốn', w: 170, align: 'right' },
  { key: 'note', label: 'Ghi chú', w: 180 },
]
/* Cấu hình cột "Mặc định" (ẩn 4 cột) và "Cột cơ bản" (chỉ giữ các cột này) */
export const COST_DEFAULT_HIDDEN = ['brand', 'floor', 'costAmount', 'note']
export const COST_BASIC_KEYS = ['stt', 'name', 'unit', 'qty', 'price', 'amount']
/* Các hạng mục trên thanh đầu tab Chi phí; chỉ Sơn nước có dữ liệu mẫu */
export const COST_CATEGORIES = [
  { code: '3.2.2', name: 'Sơn nước', live: true },
  { code: '3.2.6.2', name: 'Công tắc - ổ cắm' },
  { code: '4.3', name: 'Rèm cửa' },
  { code: '4.1', name: 'Nội thất liền tường' },
  { code: '3.2.8.1', name: 'Cửa ngoại thất' },
  { code: '3.2.6.1', name: 'Thiết bị đèn', count: 28 },
]
export const NO_SUPPLIER = 'Chưa có nhà cung cấp'
export const formatMoney = money

/* ---------- Tab "Dự án" ---------- */
/* Cột của bảng tổng hợp dự án (cột STT luôn hiện và không tính vào số đếm cột) */
export const PROJECT_COLUMNS = [
  { key: 'stt', label: 'STT', w: 52, pin: true, align: 'center' },
  { key: 'room', label: 'Phòng', w: 172, pin: true },
  { key: 'name', label: 'Tên sản phẩm', w: 272, pin: true },
  { key: 'brand', label: 'Thương hiệu', w: 156 },
  { key: 'info', label: 'Thông tin chính', w: 266 },
  { key: 'features', label: 'Thông số thiết kế', w: 214 },
  { key: 'image', label: 'Hình ảnh', w: 148, align: 'center' },
  { key: 'unit', label: 'Đơn vị tính', w: 120, align: 'center' },
  { key: 'qty', label: 'Số lượng', w: 120, align: 'right' },
  { key: 'retail', label: 'Giá bán lẻ', w: 140, align: 'right' },
  { key: 'discount', label: 'Chiết khấu của đại lý (%)', w: 150, align: 'right' },
  { key: 'dealer', label: 'Giá đại lý', w: 140, align: 'right' },
  { key: 'margin', label: 'Lợi nhuận dự kiến (%)', w: 140, align: 'right' },
  { key: 'price', label: 'Giá bán', w: 148, align: 'right' },
  { key: 'profit', label: 'Lợi nhuận (VND)', w: 150, align: 'right' },
  { key: 'amount', label: 'Thành tiền', w: 160, align: 'right' },
  { key: 'costAmount', label: 'Thành tiền vốn', w: 150, align: 'right' },
  { key: 'note', label: 'Ghi chú', w: 180 },
]
/* "Mặc định" ẩn các cột giá nội bộ (còn 10/17); "Cột cơ bản" chỉ giữ các cột này */
export const PROJECT_DEFAULT_HIDDEN = ['retail', 'discount', 'dealer', 'margin', 'profit', 'costAmount', 'note']
export const PROJECT_BASIC_KEYS = ['stt', 'name', 'unit', 'qty', 'price', 'amount']
