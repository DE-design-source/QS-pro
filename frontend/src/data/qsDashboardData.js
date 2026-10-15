/* Dữ liệu mẫu cho tab "Bảng điều khiển" của trang QS (chưa có API) */

/* Nhóm giá trị của bản nháp "test" — khớp số liệu trên giao diện mẫu */
const BASE_GROUPS = [
  { name: 'Thiết bị vệ sinh', value: 96447556 },
  { name: 'Thiết bị điện', value: 59780000 },
  { name: 'Phần thô', value: 41140000 },
  { name: 'Sơn nước', value: 14590000 },
]

/* Sinh số liệu cho các bản nháp còn lại từ một seed, để bấm "Dùng" là thấy số thay đổi */
function draft(name, code, date, seed) {
  const factor = 0.6 + ((seed * 37) % 100) / 50
  const groups = BASE_GROUPS.map((g, i) => ({
    name: g.name,
    value: Math.round((g.value * factor * (1 + ((seed + i * 3) % 5) / 10)) / 1000) * 1000,
  }))
  const sale = groups.reduce((s, g) => s + g.value, 0)
  return {
    id: code, name, code, date, status: 'Bản nháp', vat: 0,
    lines: 20 + ((seed * 13) % 60),
    cost: Math.round((sale * (0.78 + (seed % 7) / 100)) / 1000) * 1000,
    groups,
  }
}

function project(id, name, client, linked, drafts, phone) {
  return { id, name, client, phone, linked, drafts }
}

export const DASH_PROJECTS = [
  project('p01', 'test', 'test', false, [
    { id: 'DA-20261006-133953GZ', name: 'Bản nháp 1', code: 'DA-20261006-133953GZ', date: '06/10/2026', status: 'Bản nháp', vat: 0, lines: 52, cost: 179271780, groups: BASE_GROUPS },
  ], '0123456789'),
  project('p02', 'Hà Giang - Thảo Nguyên Homestay', 'Anh Hà', false, [draft('Bản nháp 1', 'DA-20261001-15413630', '01/10/2026', 2)]),
  project('p03', 'Đức Trọng Villa', null, true, [draft('Bản nháp 1', 'DA-20260929-173319T9', '29/09/2026', 3)]),
  project('p04', 'La Maison Douce', 'Chị Thuyền', true, [draft('Bản nháp 1', 'DA-20260929-172916ZY', '29/09/2026', 4)]),
  project('p05', 'Penthouse Hawaii Signature', null, true, [draft('Bản nháp 1', 'DA-20260929-1726342Z', '29/09/2026', 5)]),
  project('p06', 'Chị Hồng - Classia', 'Chị Hồng', false, [draft('Bản nháp 1', 'DA-20260928-093359', '28/09/2026', 6)]),
  project('p07', 'H&H Townhouse Thảo Điền', 'Anh Huy', true, [draft('Bản nháp 1', 'DA-20260926-082125', '26/09/2026', 7)]),
  project('p08', 'Anh Hùng - Himlam Riverside', 'Anh Hùng', false, [draft('Bản nháp 1', 'DA-20260926-075119', '26/09/2026', 8)]),
  project('p09', 'Ms An-Duplex Đà Lạt', 'Ms An', false, [draft('Bản nháp 1', 'DA-20260926-042844', '26/09/2026', 9)]),
  project('p10', 'Nhà mẫu Monrei Saigon', 'Mitsubishi Corporation', true, [draft('Bản nháp 1', 'DA-20260925-031631', '25/09/2026', 10)]),
  project('p11', 'Townhouse Phú Mỹ Hưng', 'Anh Đông Chị Hà', true, [draft('Bản nháp 1', 'DA-20260922-044614', '22/09/2026', 11)]),
  project('p12', 'Nhà ở Chị Tú Anh', 'Chị Tú Anh', false, [
    draft('Bản nháp 1', 'DA-20260910-074737', '10/09/2026', 12),
    draft('Bản nháp 2', 'DA-20260917-071809', '17/09/2026', 21),
    draft('Bản nháp 3', 'DA-20260917-071810', '17/09/2026', 22),
  ]),
  project('p13', 'Feliz EN Vista', 'Feliz EN Vista', false, [draft('Bản nháp 1', 'DA-20260904-074807', '04/09/2026', 13)]),
  project('p14', 'DSQUARED SG Center', 'DSQUARED SG Center', false, [draft('fsdhfsd', 'DA-20260904-070257', '04/09/2026', 14)]),
  project('p15', 'Nhà Anh Hưng', 'Anh Hưng', false, [draft('Bản nháp 1', 'DA-20260904-023048', '04/09/2026', 15)]),
  project('p16', 'Penthouse Sunny Residence', 'Penthouse Sunny', false, [draft('Bản nháp 1', 'DA-20260903-101840', '03/09/2026', 16)]),
  project('p17', 'Chị Hạnh INFINITI Riviera', 'Chị Hạnh', false, [draft('Bản nháp 1', 'DA-20260903-042308', '03/09/2026', 17)]),
  project('p18', 'Chú Hy Opera', 'Chú Hy', false, [draft('Bản nháp 1', 'DA-20260902-043809', '02/09/2026', 18)]),
  project('p19', 'Nhà phố chị Liên', 'chị Liên', false, [draft('Bản nháp 1', 'DA-20260831-034034', '31/08/2026', 19)], '89237482340'),
]

/* Bản nháp đang làm việc mặc định */
export const DASH_DEFAULT_ACTIVE = { projectId: 'p01', draftId: 'DA-20261006-133953GZ' }

/* tab: khoá tab trong trang QS sẽ mở khi bấm; chưa có màn tương ứng thì để null */
export const DASH_QUICK_ACTIONS = [
  { key: 'po', label: 'Mua hàng', icon: 'cart', tab: 'po' },
  { key: 'lines', label: 'SP trong dự án', icon: 'listLines', tab: 'breakdown' },
  { key: 'import', label: 'Nhập dữ liệu', icon: 'download', tab: null },
  { key: 'products', label: 'Danh sách SP', icon: 'tag', tab: 'catalog' },
]

/* Tiền kiểu VN: dấu chấm phân cách nghìn, hậu tố " đ" */
export const formatVnd = n => `${Math.round(n).toLocaleString('vi-VN')} đ`

/* Tổng hợp số liệu KPI từ một bản nháp */
export function draftTotals(d) {
  const sale = d.groups.reduce((s, g) => s + g.value, 0)
  const profit = sale - d.cost
  return {
    lines: d.lines, cost: d.cost, sale, profit,
    total: sale * (1 + d.vat / 100),
    margin: sale ? (profit / sale) * 100 : 0,
  }
}

/* Tạo dự án mới từ form "Tạo dự án mới", kèm sẵn một bản nháp trống */
export function createProject(form) {
  const now = new Date()
  const p = n => String(n).padStart(2, '0')
  const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
  const code = `DA-${ymd}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  return {
    id: `p-${now.getTime()}`,
    name: form.name.trim(),
    client: form.client.trim() || null,
    phone: form.phone.trim() || undefined,
    address: form.address.trim(),
    link: form.link.trim(),
    linked: Boolean(form.link.trim()),
    drafts: [{
      id: code, name: 'Bản nháp 1', code, status: 'Bản nháp',
      date: `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`,
      vat: Number(form.vat) || 0, lines: 0, cost: 0, groups: [],
    }],
  }
}
