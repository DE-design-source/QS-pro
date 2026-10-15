/* Phần dùng chung của tab Mua hàng (chỉ trong components/purchase + PurchaseTab).
   - MH_MEMO: trạng thái tạm cấp trang của bản gốc (S._mhInfo, S._mhSel, S._mhPayOpen): giữ khi đổi tab / quay lại /qs.
     Xoá như bản gốc: sel / payOpen mỗi lần nạp dự án (projDataLoad_, PUB/app.js:2402) -> ở đây khi đổi phiên hoặc dự án;
     cả info khi đăng xuất / đổi người dùng (bản gốc tải lại trang ở authLogout_, PUB/app.js:7-10).
   - fmtDateTime_ (PUB/sanpham.js:1988-1993), imgSrc1_ (PUB/nhap.js:350) bản React: ảnh qua mediaUrl.
   - foldGet_ / foldToggle_ (PUB/boc.js:1221-1225): khoá qs_fold dùng chung với các tab khác. */
import { useSyncExternalStore } from 'react'
import { mediaUrl } from '../../api/files'
import { getState, subscribe } from '../../state/store'

export const MH_MEMO = { info: {}, sel: {}, payOpen: {} }

const memoSubs = new Set()
let memoVer = 0
const memoEmit = () => { memoVer++; memoSubs.forEach(fn => fn()) }
const memoSub = fn => { memoSubs.add(fn); return () => memoSubs.delete(fn) }
export function mhMemoSet(k, v) { MH_MEMO[k] = v; memoEmit() }
export function useMhMemo() { useSyncExternalStore(memoSub, () => memoVer, () => memoVer); return MH_MEMO }

const memoUser_ = s => (s.me ? String(s.me.username || '') : '')
const memoProj_ = s => s.key + '|' + (s.cur ? s.cur.maDA : '')
let memoAt = { user: memoUser_(getState()), proj: memoProj_(getState()) }
subscribe(() => {
  const s = getState()
  const user = memoUser_(s), proj = memoProj_(s)
  if (user === memoAt.user && proj === memoAt.proj) return
  if (user !== memoAt.user) MH_MEMO.info = {}
  MH_MEMO.sel = {}
  MH_MEMO.payOpen = {}
  memoAt = { user, proj }
  memoEmit()
})

export function fmtDateTime_(v) {
  if (v == null || v === '') return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  const z = n => (n < 10 ? '0' : '') + n
  return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes())
}

export function imgSrc1_(v) { return mediaUrl(String(v || '').split('\n')[0].trim()) }

export function foldGet_() {
  try {
    const v = JSON.parse(localStorage.getItem('qs_fold') || 'null')
    if (v && typeof v === 'object') return v
  } catch (e) { /* bộ nhớ trình duyệt bị chặn: dùng mặc định */ }
  return { cols: true }
}
export function foldToggle_(k) {
  const v = foldGet_()
  v[k] = !v[k]
  delete v._all
  try { localStorage.setItem('qs_fold', JSON.stringify(v)) } catch (e) { /* không lưu được: chỉ đổi trong lượt này */ }
  return v
}

export function payLsGet_(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {} } catch (e) { return {} }
}
export function payLsSet_(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch (e) { /* bản lưu phụ trên máy, máy chủ vẫn có */ }
}
