import { useSyncExternalStore } from 'react'
import * as api from '../../../api/qsApi'
import { getState, subscribe as storeSubscribe } from '../../../state/store'
import { setF } from './filterStore'

/* Bộ nhớ "Sản phẩm đi kèm" theo khoá SP (bản gốc S._catCb, boc.js:1656-1716): nạp 1 lần, lần sau mở thẻ là có ngay.
   Giá trị: undefined = chưa nạp · {loading} · {list} · {error}. Lỗi không bị nuốt: thẻ / panel hiện chữ lỗi và lần mở sau nạp lại. */
let cache = {}
const subs = new Set()
let inflight = {}
let gen = 0

function emit() { subs.forEach(fn => fn()) }
function subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }
const snap = () => cache

export function useComboCache() {
  return useSyncExternalStore(subscribe, snap, snap)
}

/* Nạp combo của khoá k (bỏ qua nếu đã có danh sách hoặc đang nạp). Trả Promise<list|null> */
export function loadCombo(k, force) {
  if (!k) return Promise.resolve(null)
  const cur = cache[k]
  if (!force && cur && cur.list) return Promise.resolve(cur.list)
  if (inflight[k]) return inflight[k]
  const g = gen
  cache = { ...cache, [k]: { loading: true } }
  emit()
  const pr = api.getCombo(k).then(list => {
    if (g === gen) cache = { ...cache, [k]: { list: list || [] } }
    return list || []
  }, e => {
    if (g === gen) cache = { ...cache, [k]: { error: (e && e.message) || 'lỗi' } }
    return null
  }).finally(() => { if (inflight[k] === pr) delete inflight[k]; emit() })
  inflight[k] = pr
  return pr
}

/* Panel chi tiết vừa nạp xong combo của SP này -> ghi bản SAO vào bộ nhớ (pdLoadCombo_: sửa SL tạm trong panel không đổi số trên thẻ) */
export function putCombo(k, list) {
  if (!k) return
  cache = { ...cache, [k]: { list: (list || []).map(x => ({ ...x })) } }
  emit()
}

/* Bỏ combo đã nhớ + gập các thẻ đang bung, như bản gốc sau setCombo (S._catCb={}; S._catCbOpen={}, sanpham.js:2489, nhap.js:622):
   không gập thì thẻ đang bung kẹt "Đang tải…". Gọi sau khi lưu / nhập combo (2D, 2E); kết quả nạp dở của lần trước bị bỏ. */
export function clearComboCache() {
  gen++
  inflight = {}
  cache = {}
  setF({ cbOpen: {} })
  emit()
}

/* Tự bỏ bộ nhớ khi: đổi phiên (tài khoản / công ty xem), hoặc danh mục SP được tải lại cả loạt từ máy chủ
   (reloadProducts sau khi sửa / nhập SP). Đổi tại chỗ vài SP (yêu thích, thêm 1 SP) giữ nguyên đối tượng cũ nên không tính. */
let lastKey = getState().key
let lastProducts = getState().products
storeSubscribe(() => {
  const s = getState()
  if (s.key !== lastKey) {
    lastKey = s.key; lastProducts = s.products
    clearComboCache()
    return
  }
  if (s.products === lastProducts) return
  const prev = lastProducts || []
  lastProducts = s.products
  const next = s.products || []
  if (!prev.length || !next.length) return
  const old = new Set(prev)
  if (!next.some(p => old.has(p))) clearComboCache()
})
