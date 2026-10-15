/* Dữ liệu rời của dự án lưu trên server (du_an_data) — port nguyên văn projDataSet_ / projDataFlush_ / projDataLoad_
   (PUB/app.js:2360-2401): 1 bộ hẹn giờ 1,2 s cho cả trang, hàng đợi nhớ DỰ ÁN + giá trị ngay lúc sửa
   (ptInfo, bgOrg lưu theo công ty: '__cty'), chưa tải xong dữ liệu dự án thì KHÔNG lưu (báo 1 lần + tải lại),
   đổi dự án thì đẩy nốt hàng đợi của dự án cũ trước. Giá trị hiện hành nằm ở store.projData;
   pdSeq tăng mỗi lần nạp -> tab nào giữ bản dựng tạm (vd kế hoạch thanh toán Mua hàng) thì bỏ đi và đọc lại. */
import * as api from '../api/qsApi'
import { getState, setState, toast } from './store'
import { isAbort } from '../api/http'

export const PD_CTY_KEYS = { ptInfo: 1, bgOrg: 1 }

let pdQueue = {}
let pdTimer = null
let pdCanh = null
let pdDang = null
let pdLoi = 0

/* Đăng xuất / đổi công ty: bỏ trạng thái nạp (hàng đợi đã được flush trước đó) */
export function projDataReset_() {
  clearTimeout(pdTimer); pdTimer = null
  pdQueue = {}; pdCanh = null; pdDang = null; pdLoi = 0
}

export function projDataSet_(khoa, val) {
  const S = getState()
  setState(s => ({ projData: { ...s.projData, [khoa]: val } }))
  if (!S.cur || !S.cur.maDA) return
  /* Dữ liệu dự án CHƯA tải xong (hoặc lần tải bị lỗi): giá trị đang có dựng từ mặc định rỗng — lưu lúc này sẽ ĐÈ MẤT
     cấu hình thật trên máy chủ. Không lưu, báo 1 lần và tải lại. */
  if (S.pdOk !== S.cur.maDA) {
    if (pdCanh !== S.cur.maDA) { pdCanh = S.cur.maDA; toast('Dữ liệu dự án chưa tải xong — thay đổi vừa rồi CHƯA được lưu. Đang tải lại, vui lòng thao tác lại sau vài giây.') }
    if (!pdDang) projDataLoad_(S.cur.maDA)
    return
  }
  // Nhớ dự án + giá trị NGAY LÚC SỬA: đổi dự án trong 1,2 s không làm flush ghi sang dự án mới
  pdQueue[khoa] = { ma: PD_CTY_KEYS[khoa] ? '__cty' : S.cur.maDA, val }
  clearTimeout(pdTimer)
  pdTimer = setTimeout(projDataFlush_, 1200)
}

/* Lỗi từ máy chủ -> câu ngắn (loiServer_) */
function loiServer_(e) {
  let m = String((e && e.message) || e || '')
  if (/42501|permission denied|row-level security/i.test(m)) return 'Bảng du_an_data chưa được cấp quyền ghi (kiểm tra quyền của tài khoản database)'
  if (/42P01/.test(m)) return 'Chưa có bảng du_an_data (chạy npm run migrate)'
  if (/PGRST(20[0-9]|116)/.test(m)) return 'Máy chủ chưa nhận ra bảng du_an_data (chạy npm run migrate rồi khởi động lại server)'
  if (/\b401\b|JWT|apikey/i.test(m)) return 'Máy chủ từ chối quyền ghi (401)'
  if (/Failed to fetch|NetworkError|timeout|Không kết nối được/i.test(m)) return 'Mất kết nối tới máy chủ'
  m = m.replace(/\s+/g, ' ').trim()
  return 'Chưa lưu được lên máy chủ: ' + (m.length > 70 ? m.slice(0, 70) + '…' : m)
}

export async function projDataFlush_() {
  clearTimeout(pdTimer); pdTimer = null
  const q = pdQueue
  const ds = Object.keys(q)
  pdQueue = {}
  for (let i = 0; i < ds.length; i++) {
    const k = ds[i]
    try { await api.setProjData(q[k].ma, k, q[k].val); pdLoi = 0 } catch (e) {
      if (!pdLoi) {
        pdLoi = 1
        try { console.error('setProjData', k, e) } catch (x) { /* bỏ qua */ }
        toast(loiServer_(e) + ' — dữ liệu vẫn còn trên máy này')
      }
    }
  }
}

function docLs_(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } }

export async function projDataLoad_(maDA) {
  projDataFlush_()   // đẩy nốt thay đổi đang chờ của dự án cũ (đã nhớ đúng dự án)
  setState(s => ({ projData: {}, pdOk: null, pdErr: null, pdSeq: s.pdSeq + 1 }))
  if (!maDA) return
  pdDang = maDA
  try {
    const d = (await api.getProjData(maDA)) || {}
    const S = getState()
    if (!S.cur || S.cur.maDA !== maDA) return            // đã đổi sang dự án khác trong lúc chờ
    pdCanh = null
    setState(s => ({ projData: d, pdOk: maDA, pdSeq: s.pdSeq + 1 }))
    // Lần đầu chuyển từ localStorage lên server: máy nào còn dữ liệu cũ thì đẩy lên (cả 4 khoá).
    const day = []
    const loc = docLs_('pt_' + maDA)
    if (!Array.isArray(d.phanTho) && Array.isArray(loc) && loc.length) { projDataSet_('phanTho', loc); day.push('bảng phần thô') }
    let vat = NaN
    try { vat = Number(localStorage.getItem('pt_' + maDA + '_vat')) } catch (e) { vat = NaN }
    if (d.ptVat == null && isFinite(vat) && vat) projDataSet_('ptVat', vat)
    const ar = docLs_('qs_area_' + maDA)
    if (d.area == null && ar && typeof ar === 'object' && Object.keys(ar).length) { projDataSet_('area', ar); day.push('bảng diện tích') }
    const inf = docLs_('qs_ptinfo')
    if (d.ptInfo == null && inf && typeof inf === 'object' && Object.keys(inf).length) { projDataSet_('ptInfo', inf); day.push('thông tin công tác') }
    if (day.length) toast('Đã đưa ' + day.join(' · ') + ' lên máy chủ — từ giờ máy khác cũng xem được')
  } catch (e) {
    try { console.error('getProjData', e) } catch (x) { /* bỏ qua */ }   // tải lỗi: pdOk vẫn null -> không lưu đè
    // Báo lỗi cho giao diện (status.pdErr) thay vì để "Đang tải…" mãi; huỷ do rời trang thì không phải lỗi
    const S2 = getState()
    if (!isAbort(e) && S2.cur && S2.cur.maDA === maDA) setState({ pdErr: { maDA, msg: 'Không tải được dữ liệu dự án: ' + String((e && e.message) || e) } })
  } finally {
    if (pdDang === maDA) pdDang = null
  }
}
