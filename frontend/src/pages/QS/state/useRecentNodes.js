/* Hạng mục gần đây (chip trên thanh công cụ nhanh) — port qbRecent_ / qbRecentPush_ (PUB/boc.js:1371-1377), khoá qs_hmRecent.
   useRecentNodes() -> mảng mã hạng mục, mới nhất trước (tối đa 6), tự vẽ lại khi có mã mới. */
import { useSyncExternalStore } from 'react'

export const QB_RECENT_N = 6
const subs = new Set()
let ver = 0
let cache = null

export function qbRecent_() {
  try { const v = JSON.parse(localStorage.getItem('qs_hmRecent') || '[]'); return Array.isArray(v) ? v : [] } catch (e) { return [] }
}
export function qbRecentPush_(code) {
  code = String(code || '')
  if (!code || code === 'X') return
  const v = [code, ...qbRecent_().filter(c => c !== code)].slice(0, QB_RECENT_N)
  try { localStorage.setItem('qs_hmRecent', JSON.stringify(v)) } catch (e) { /* bỏ qua */ }
  ver++; cache = null
  subs.forEach(fn => fn())
}

function snapshot() {
  if (!cache) cache = { ver, list: qbRecent_() }
  return cache.list
}
function subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }

export function useRecentNodes() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
