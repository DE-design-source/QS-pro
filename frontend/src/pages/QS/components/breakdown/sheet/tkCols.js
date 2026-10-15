/* Cột của bảng Bóc tách (S.cols / S.colOrder / S.colW của bản gốc), giữ ở cấp module để rời /qs rồi quay lại vẫn còn.
   Port: initCols / saveCols PUB/app.js:270-276 (qs_colcfg {order, w}) · COLSET.tk + csMy* 1638-1731 (bộ "Của tôi" lưu
   users.ui_prefs.tkCols qua setMyPref, dự phòng localStorage qs_tkcols_<user>) · toggleCol 1841 · tkColAll_ 1836 ·
   ctxHideCol / ctxShowAllCols boc.js:59-66 · moveCol boc.js:656.
   Như bản gốc: bật / tắt từng cột chỉ trong phiên; đăng nhập (đổi tài khoản) thì về bộ "Của tôi" hoặc Mặc định. */
import { useSyncExternalStore } from 'react'
import { COLS, COLSET, TK_COL_CB, initColOrder, csMyCols_, csMyApply_, csPresetCols_, csMyKey_, colAll_, csDangBat_ } from '../../../lib/columns.js'
import { getState, setState } from '../../../state/store'
import * as api from '../../../api/qsApi'
import { qsToast, qsConfirm } from '../../common/dialogs'

const TK = COLSET.tk
function lsGet(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch (e) { /* bỏ qua */ } }
function readCfg() { try { return JSON.parse(lsGet('qs_colcfg') || '{}') || {} } catch (e) { return {} } }

let S = null
const subs = new Set()
const emit = () => subs.forEach(fn => fn())
function set(patch) { S = { ...S, ...patch }; emit() }

function meNow() { return getState().me || null }
function userOf(me) { return String((me && me.username) || '').toLowerCase() }
function localMine(me) { try { return JSON.parse(lsGet(csMyKey_('tk', userOf(me))) || 'null') } catch (e) { return null } }
export function myCols(me = meNow()) { return csMyCols_(TK, me && me.uiPrefs, localMine(me)) }

function init() {
  const me = meNow()
  const cfg = readCfg()
  S = { user: userOf(me), cols: csMyApply_(TK, myCols(me)), order: initColOrder(cfg), w: cfg.w || {} }
}
/* Đổi tài khoản -> áp lại bộ cột của tài khoản mới (csMyApplyAll_ lúc đăng nhập) */
function current() {
  if (!S) init()
  const u = userOf(meNow())
  if (u && S.user !== u) init()
  return S
}
function subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }
export function useTkCols() {
  return useSyncExternalStore(subscribe, current, current)
}
export const getTkCols = current

function saveCfg() { const s = current(); lsSet('qs_colcfg', JSON.stringify({ order: s.order, w: s.w })) }

export function toggleCol(k) {
  const s = current()
  const cols = { ...s.cols, [k]: !s.cols[k] }
  set({ cols })
}
export function setColsMap(m) { set({ cols: { ...m } }) }
export function applyPreset(id) {
  const m = csPresetCols_(TK, id); if (!m) return
  set({ cols: m })
}
export function colAll(on) {
  const m = colAll_(TK.keys(), TK_COL_CB, on)
  set({ cols: m })
  saveCfg()
}
export function hideCol(key) {
  if (key === 'ten') { qsToast('Không thể ẩn cột Tên sản phẩm'); return }
  set({ cols: { ...current().cols, [key]: false } })
  const lbl = (COLS.filter(c => c[0] === key)[0] || [key, key])[1]
  qsToast('Đã ẩn cột "' + lbl + '" — bật lại ở hàng chip phía trên')
}
export function showAllCols() {
  const m = {}; COLS.forEach(c => { m[c[0]] = true })
  set({ cols: m })
  qsToast('Đã hiện lại tất cả cột')
}
export function moveCol(from, to, before) {
  const o = current().order.slice(); const fi = o.indexOf(from); if (fi < 0) return
  o.splice(fi, 1); let ti = o.indexOf(to); if (ti < 0) ti = o.length
  o.splice(before ? ti : ti + 1, 0, from)
  set({ order: o }); saveCfg()
}
/* save = false: đang kéo (vẽ lại ngay), chỉ ghi qs_colcfg khi thả chuột như btKeoCot_ */
export function setColW(k, w, save = true) { set({ w: { ...current().w, [k]: w } }); if (save) saveCfg() }

/* Bộ "Của tôi" */
export function applyMine() {
  const v = myCols(); if (!v) return
  set({ cols: csMyApply_(TK, v) })
  qsToast('Đã bật bộ cột của tôi')
}
function setMePrefs(uiPrefs) {
  const me = getState().me
  if (me) setState({ me: { ...me, uiPrefs: uiPrefs || {} } })
}
export async function saveMine() {
  const me = meNow()
  const keys = csDangBat_(TK, current().cols)
  lsSet(csMyKey_('tk', userOf(me)), JSON.stringify(keys))
  try {
    const r = await api.setMyPref(TK.pref, keys)
    const up = {}; up[TK.pref] = keys
    setMePrefs((r && r.uiPrefs) || { ...((me && me.uiPrefs) || {}), ...up })
    qsToast('Đã lưu ' + keys.length + ' cột làm mặc định của tài khoản ' + ((me && me.username) || ''))
  } catch (e) { qsToast('Đã lưu trên máy này. Lưu theo tài khoản lỗi: ' + e.message) }
  emit()
}
export async function clearMine() {
  if (!await qsConfirm('Xoá bộ cột "Của tôi" của bảng ' + TK.ten + '? Lần sau đăng nhập sẽ dùng bộ Mặc định.')) return
  const me = meNow()
  lsSet(csMyKey_('tk', userOf(me)), null)
  try { const r = await api.setMyPref(TK.pref, null); setMePrefs((r && r.uiPrefs) || {}) } catch (e) {
    if (me && me.uiPrefs) { const up = { ...me.uiPrefs }; delete up[TK.pref]; setMePrefs(up) }
  }
  emit()
  qsToast('Đã xoá bộ cột của tôi')
}

