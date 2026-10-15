/* Bộ cột của bảng Chi phí ('cp') và Dự án ('da'), giữ ở cấp module để rời /qs rồi quay lại vẫn còn.
   Port: COLSET.cp / COLSET.da + csMy* PUB/app.js:1645-1731 (bộ "Của tôi" lưu users.ui_prefs.cpCols / daCols qua setMyPref,
   dự phòng localStorage qs_cols_<t>_<user>) · cpToggle chiphi.js:6 · cpOrder_ 64-67 (qs_cporder) · cpColAll_ dash.js:241 ·
   daColToggle / daColLuu_ / daColDoc_ / daColDrop duan.js:6-9, 36-38 (qs_dacols {on, ord}) · daColAll_ dash.js:248 ·
   btDoiCot_ bangtinh.js:286-293 (kéo đổi chỗ cột).
   Như bản gốc: đăng nhập (đổi tài khoản) thì cột về bộ "Của tôi" hoặc Mặc định (csMyApplyAll_ app.js:2476). */
import { useSyncExternalStore } from 'react'
import {
  COLSET, CP_KEYS, DA_KEYS, CP_COL_CB, DA_COL_CB, cpOrder_, csMyCols_, csMyApply_, csPresetCols_, csMyKey_, colAll_, csDangBat_,
} from '../../lib/columns.js'
import { getState, setState } from '../../state/store'
import * as api from '../../api/qsApi'
import { qsToast, qsConfirm } from '../common/dialogs'

function lsGet(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch (e) { /* bỏ qua */ } }
function lsJson(k) { try { return JSON.parse(lsGet(k) || 'null') } catch (e) { return null } }

const KEYS = { cp: CP_KEYS, da: DA_KEYS }
const CB = { cp: CP_COL_CB, da: DA_COL_CB }
const meNow = () => getState().me || null
const userOf = me => String((me && me.username) || '').toLowerCase()
function localMine(t, me) { return lsJson(csMyKey_(t, userOf(me))) }
export function myCols(t, me = meNow()) { return csMyCols_(COLSET[t], me && me.uiPrefs, localMine(t, me)) }

/* Thứ tự cột: Chi phí đọc qs_cporder; Dự án đọc ord trong qs_dacols (cột mới của DA_KEYS tự nối cuối) */
function readOrder(t) {
  if (t === 'cp') return cpOrder_(lsJson('qs_cporder'))
  const v = lsJson('qs_dacols')
  const o = (v && Array.isArray(v.ord) ? v.ord : DA_KEYS.slice()).filter(k => DA_KEYS.indexOf(k) >= 0)
  DA_KEYS.forEach(k => { if (o.indexOf(k) < 0) o.push(k) })
  return o
}

const S = { cp: null, da: null }
const subs = new Set()
const emit = () => subs.forEach(fn => fn())
function init(t) {
  const me = meNow()
  S[t] = { user: userOf(me), cols: csMyApply_(COLSET[t], myCols(t, me)), order: readOrder(t) }
}
function current(t) {
  if (!S[t]) init(t)
  const u = userOf(meNow())
  if (u && S[t].user !== u) init(t)
  return S[t]
}
function save(t) {
  const s = current(t)
  if (t === 'cp') lsSet('qs_cporder', JSON.stringify(s.order))
  else lsSet('qs_dacols', JSON.stringify({ on: s.cols, ord: s.order }))
}
function set(t, patch) { S[t] = { ...current(t), ...patch }; if (t === 'da') save('da'); emit() }

const getCp = () => current('cp')
const getDa = () => current('da')
function subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }
/* -> {cols: {key: bool}, order: [key]} */
export function useColSet(t) {
  return useSyncExternalStore(subscribe, t === 'cp' ? getCp : getDa, t === 'cp' ? getCp : getDa)
}

export function toggleCol(t, k) {
  set(t, { cols: { ...current(t).cols, [k]: !current(t).cols[k] } })
}
export function setColsMap(t, m) { set(t, { cols: { ...m } }) }
export function applyPreset(t, id, nhan) {
  const m = csPresetCols_(COLSET[t], id); if (!m) return
  set(t, { cols: m })
  if (nhan) qsToast('Đã bật bộ cột: ' + nhan)
}
/* "Hiện tất cả" (1) / "Cột cơ bản" (0) */
export function colAll(t, on) { set(t, { cols: colAll_(KEYS[t], CB[t], on) }) }
/* Kéo đổi chỗ cột: from đặt trước (truoc) / sau cột to */
export function moveCol(t, from, to, truoc) {
  const o = current(t).order.filter(x => x !== from)
  let i = o.indexOf(to); if (i < 0) i = o.length; else if (!truoc) i++
  o.splice(i, 0, from)
  set(t, { order: o })
  save(t)
}

/* Bộ "Của tôi" */
export function applyMine(t) {
  const v = myCols(t); if (!v) return
  set(t, { cols: csMyApply_(COLSET[t], v) })
  qsToast('Đã bật bộ cột của tôi')
}
function setMePrefs(uiPrefs) {
  const me = getState().me
  if (me) setState({ me: { ...me, uiPrefs: uiPrefs || {} } })
}
export async function saveMine(t) {
  const me = meNow()
  const tab = COLSET[t]
  const keys = csDangBat_(tab, current(t).cols)
  lsSet(csMyKey_(t, userOf(me)), JSON.stringify(keys))
  try {
    const r = await api.setMyPref(tab.pref, keys)
    const up = {}; up[tab.pref] = keys
    setMePrefs((r && r.uiPrefs) || { ...((me && me.uiPrefs) || {}), ...up })
    qsToast('Đã lưu ' + keys.length + ' cột làm mặc định của tài khoản ' + ((me && me.username) || ''))
  } catch (e) { qsToast('Đã lưu trên máy này. Lưu theo tài khoản lỗi: ' + e.message) }
  emit()
}
export async function clearMine(t) {
  const tab = COLSET[t]
  if (!await qsConfirm('Xoá bộ cột "Của tôi" của bảng ' + tab.ten + '? Lần sau đăng nhập sẽ dùng bộ Mặc định.')) return
  const me = meNow()
  lsSet(csMyKey_(t, userOf(me)), null)
  try { const r = await api.setMyPref(tab.pref, null); setMePrefs((r && r.uiPrefs) || {}) } catch (e) {
    if (me && me.uiPrefs) { const up = { ...me.uiPrefs }; delete up[tab.pref]; setMePrefs(up) }
  }
  emit()
  qsToast('Đã xoá bộ cột của tôi')
}
