import { useSyncExternalStore } from 'react'
import { fltShowMapInit_, fltHien_ } from '../../../lib/catalogFilters.js'
import { getState, subscribe } from '../../../state/store'

/* Trạng thái bộ lọc danh mục bên trái (các trường S.f* của bản gốc, PUB/app.js:85) - giữ ở cấp module như S:
   đổi tab, ẩn panel hay rời /qs rồi quay lại vẫn còn. Tên trường đúng như tham số st của lib/catalogFilters.
   fsecOpen (qs_fsec) và fltShow (qs_fltshow) là tuỳ chọn giao diện của trình duyệt, đọc / ghi localStorage như bản gốc. */
function readJson(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } }
function writeJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { /* trình duyệt chặn lưu: chỉ mất phần nhớ giao diện */ }
}

export const EMPTY = {
  fWatt: {}, fKelvin: {}, fAngle: {}, fIP: {}, fCRI: {}, fVolt: {}, fBrand: '', fFav: false, fCombo: '',
  fNhomSet: {}, fVs: {}, inProjMa: '', inProjKeys: null, onlyProject: false, q: '', min: '', max: '',
}

let F = {
  ...EMPTY,
  fltNg: '',                 // S._fltNg: ngành của bộ lọc đang áp (đổi ngành -> bỏ lọc hạng mục / thông số)
  fsecOpen: (() => { const m = readJson('qs_fsec'); return m && typeof m === 'object' ? m : {} })(),
  fltShow: fltShowMapInit_(readJson('qs_fltshow'), readJson('qs_pinflt'), readJson('qs_fltoff')),
  cbOpen: {}, varOpen: {}, ctCol: {},
}
const subs = new Set()
const snap = () => F

/* Đổi tài khoản / đăng xuất / super đổi công ty xem (khoá phiên của store đổi): bỏ lọc như bản gốc nạp lại trang.
   Giữ fsecOpen / fltShow vì là tuỳ chọn của trình duyệt (qs_fsec, qs_fltshow). */
let lastKey = getState().key
subscribe(() => {
  const k = getState().key
  if (k === lastKey) return
  lastKey = k
  setF({ ...EMPTY, fltNg: '', cbOpen: {}, varOpen: {}, ctCol: {} })
})

export function getF() { return F }
export function setF(patch) {
  F = { ...F, ...(typeof patch === 'function' ? patch(F) : patch) }
  subs.forEach(fn => fn())
}
export function useFilters() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, snap, snap)
}

// gập / mở 1 khối lọc (toggleFsec, vsFltFold_): mặc định MỞ
export function toggleFsec(key) {
  const fsecOpen = { ...F.fsecOpen, [key]: F.fsecOpen[key] === false }
  writeJson('qs_fsec', fsecOpen)
  setF({ fsecOpen })
}
// hiện / ẩn 1 khối trên panel (fltToggle_)
export function fltToggle(k) {
  const fltShow = { ...F.fltShow, [k]: !fltHien_(F.fltShow, k) }
  writeJson('qs_fltshow', fltShow)
  setF({ fltShow })
}
// clearAllFilters (app.js:879-884): KHÔNG bỏ lọc hạng mục / dự án
export function clearAllFilters() {
  setF({ fWatt: {}, fKelvin: {}, fAngle: {}, fIP: {}, fCRI: {}, fVolt: {}, fBrand: '', fCombo: '', fFav: false, fVs: {}, min: '', max: '' })
}
// bấm ✕ trên 1 thẻ đang lọc (catClearF_ / vsFltClear_)
export function clearTag(k) {
  if (k === 'nhom') setF({ fNhomSet: {} })
  else if (k === 'inproj') setF({ inProjMa: '', inProjKeys: null, onlyProject: false })
  else if (k === 'brand') setF({ fBrand: '' })
  else if (k === 'fav') setF({ fFav: false })
  else if (k === 'combo') setF({ fCombo: '' })
  else if (k === 'gia') setF({ min: '', max: '' })
  else if (String(k).indexOf('vs:') === 0) {
    const col = k.slice(3)
    setF(s => { const fVs = { ...s.fVs }; delete fVs[col]; return { fVs } })
  } else setF({ [k]: {} })
}
// bật / tắt 1 giá trị trong map lọc (chip)
export function toggleIn(field, v) {
  setF(s => { const m = { ...s[field] }; if (m[v]) delete m[v]; else m[v] = 1; return { [field]: m } })
}
