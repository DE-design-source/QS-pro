/* Trạng thái tab Nhập dữ liệu, giữ ở cấp module (như S._pending / S._sessionAdded / S._impLoai của bản gốc, PUB/nhap.js).
   Rời /qs rồi quay lại vẫn còn form đang gõ, danh sách chờ và danh sách "vừa nhập" (PLAN 1.5: tab này giữ form chưa lưu).
   Đổi tài khoản / công ty đang xem hoặc đăng xuất thì xoá sạch, như tải lại trang ở bản gốc. */
import { useSyncExternalStore } from 'react'
import { getState as qsGet, subscribe as qsSub } from '../../state/store'

const VARS0 = { varKelvin: '', varWatt: '', varAngle: '', varColor: '', varSize: '' }
let formSeq = 0
export function emptyForm_() {
  // ghi.maDA = null: theo dự án đang mở (bản gốc chọn sẵn S.cur lúc vẽ form)
  return { seq: ++formSeq, vals: {}, imgMain: '', imgList: [], combo: [], vars: { ...VARS0 }, ghi: { on: false, maDA: null, qty: '1' } }
}
function initial(key) {
  return {
    key,
    loai: 'sp',
    form: emptyForm_(),
    pending: [],
    sessionAdded: [],
    pendEdit: null,
    committing: false,
    commitText: '',
    imgUploading: 0,
    bulk: { products: [], headers: [], nganh: '', res: null, msg: null, ver: 0, fileSeq: 0 },
    // Số công tác đang chờ lưu của form Phần thô (importer/pt, Batch 3B ghi vào đây) -> cảnh báo rời trang như S._ctPending
    ctPendingN: 0,
  }
}

let S = initial('')
const subs = new Set()
export function impGet() { return S }
export function impSet(patch) {
  S = { ...S, ...(typeof patch === 'function' ? patch(S) : patch) }
  subs.forEach(fn => fn())
}
export function impForm(fn) { impSet(s => ({ form: { ...s.form, ...fn(s.form) } })) }
function subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }
export function useImp(sel) {
  return useSyncExternalStore(subscribe, () => sel(S), () => sel(S))
}
/* Khoá phiên = tài khoản + công ty đang xem; khác khoá cũ thì làm mới toàn bộ */
export function impEnsureKey(key) {
  if (S.key !== key) { S = initial(key); subs.forEach(fn => fn()) }
}
/* Theo id người dùng, không theo token: hết phiên rồi đăng nhập lại đúng người đó thì bản gốc chỉ hiện màn đăng nhập
   (showLogin_, PUB/app.js:2456), form + danh sách chờ còn nguyên. Đăng xuất (me = null) = tải lại trang ở bản gốc -> xoá. */
const sessKey_ = q => (q.me ? String(q.me.id || q.me.username || '') + '|' + (q.viewAs || '') : '')
impEnsureKey(sessKey_(qsGet()))
qsSub(() => impEnsureKey(sessKey_(qsGet())))

/* renderImport của bản gốc dựng lại cả thẻ "Nhập hàng loạt": bảng xem trước mất, ô chọn file trống (PUB/nhap.js:851-862) */
export function bulkCleared_(b) {
  return { ...b, products: [], headers: [], nganh: '', res: null, msg: null, fileSeq: ((b && b.fileSeq) || 0) + 1 }
}

/* upBusy_ / waitUploads_ (PUB/nhap.js:1115-1117): đếm ảnh / file đang tải để nút Lưu đợi xong */
export function upBusy_(d) { impSet(s => ({ imgUploading: Math.max(0, (s.imgUploading || 0) + d) })) }
export async function waitUploads_(timeout) {
  const t0 = Date.now()
  while ((S.imgUploading || 0) > 0 && Date.now() - t0 < (timeout || 15000)) await new Promise(r => setTimeout(r, 250))
}

let pendSeq = 0
export function pendUid_() { return 'p' + (++pendSeq) }
export function pendingAdd_(items) {
  (items || []).forEach(x => { if (!x.uid) x.uid = pendUid_() })
  impSet(s => ({ pending: (items || []).concat(s.pending || []) }))
}
export function nowIsoClient_() { try { return new Date().toISOString() } catch (e) { return '' } }
export function sessionAdd_(o) {
  impSet(s => ({
    sessionAdded: [{ ten: o.ten || '', ma: o.ma || '', thuongHieu: o.thuongHieu || '', ncc: o.ncc || '',
      hinhAnh: o.hinhAnh || '', capNhat: o.capNhat || nowIsoClient_(), nhieuBienThe: !!o.nhieuBienThe }].concat(s.sessionAdded || []),
  }))
}
