/* Thao tác ghi của tab Xuất báo giá - port PUB/baogia.js, chạy trên store QS:
     bgOptSet_ 1055 · bgToggle 32 · bgMauDat_ 533-537 · bgNoiBoDat_ 1020 · coverTaySet_ 1063 · coverAutoFill 868-873
     coverEdit / coverDel / coverAddBig / coverAddSmall / coverReload / coverSave 48-62 · coverInfo 34
     areaLoad_ / areaSave_ / areaSet_ / areaApply_ 76-100 · bgChot_ 1203-1215 · printDoc 699-715 · doExport 884-925
     bgOrgEdit_ 1161-1176 · bgDotSet_ / bgDotAdd_ / bgDotDel_ 1127-1130 · bgColDrop 345-350 · bgHistDiff_ 1265-1287
   Dữ liệu ghi đúng khoá bản gốc (D8): projData bgCfg / bgHist / bgOrg / area, tờ bìa {stt, hangMuc, moTa, chiPhi}. */
import * as api from '../../api/qsApi'
import { saveBase64 } from '../../api/files'
import { getState, syncProj, updateProject as storeUpdateProject, isAdminRole_ } from '../../state/store'
import { projDataSet_ } from '../../state/projData'
import { qsToast as toast, qsConfirm, qsAsk } from '../common/dialogs'
import { money, esc, pctIn_ } from '../../lib/format.js'
import { donGiaCK_, ttBan_ } from '../../lib/calc.js'
import {
  bgOptSet_ as bgOptNew_, bgToggleAn_, bgMauDat_ as bgMauChon_, coverTayMap_, bgOpt_, coverEditVal_, coverAddBig_, coverAddSmall_,
  coverCosts, coverHasChild, areaSetVal_, areaCompute_, areaApplyFields_, bgChot_ as bgChotNew_, bgTong_, computeQuoteLocal,
  bgSelCodes_, bgPTSecs_, bgNoiBoXuat_, bgAn_, bgSub_, bgOrg_, bgHist_, bgTongKetData_,
} from '../../lib/quote.js'
import { exportBaoGiaOpts, logoXuat_ } from './quoteApi'
import { getQ, setQ, setCoverRows, coverLuu_, coverCancelPending, coverVeBanLuu_, setColOrder } from './quoteState'
import { freshModel } from './quoteModel'
import { bgDocCols_, bgExportCols_ } from './docModel'
import { bgDocCss_, printCss_ } from './docCss'

const curNow = () => getState().cur
const pdNow = () => getState().projData || {}

/* ---- Cấu hình báo giá theo dự án (projData.bgCfg) ---- */
export function bgOptSet(k, v) { projDataSet_('bgCfg', bgOptNew_(pdNow().bgCfg, k, v)) }
export function bgToggle(stt) { bgOptSet('an', bgToggleAn_(pdNow().bgCfg, stt)) }
/* trả false khi màu quá nhạt (ô chọn màu phải về lại màu cũ) */
export function bgMauDat(m) {
  const r = bgMauChon_(m)
  if (r.msg) { toast(r.msg); return false }
  bgOptSet('mau', r.value)
  return true
}
export function bgNoiBoDat(on) {
  bgOptSet('noiBo', !!on)
  toast(on ? 'Báo giá sẽ in kèm cột nội bộ (giá vốn / lợi nhuận)' : 'Đã ẩn cột nội bộ khỏi báo giá')
}
export function coverTaySet(stt, on) { bgOptSet('tay', coverTayMap_(pdNow().bgCfg, stt, on)) }
export function coverAutoFill() {
  const q = getQ()
  if (!q.cover.rows.length) { toast('Chưa có tờ bìa. Bấm ↻ Nạp mẫu trước.'); return }
  const n = Object.keys(bgOpt_(pdNow().bgCfg).tay).length
  bgOptSet('tay', {})
  toast(n ? ('Đã bỏ ' + n + ' số sửa tay — tờ bìa lấy lại số từ bóc tách') : 'Tờ bìa đang lấy đúng số từ bóc tách')
}
export function bgDotSet(i, j, v) {
  const d = bgOpt_(pdNow().bgCfg).dot.map(x => x.slice()); if (!d[i]) return
  d[i][j] = j === 1 ? (pctIn_(v) || 0) : String(v || '')
  bgOptSet('dot', d)
}
export function bgDotAdd() { const d = bgOpt_(pdNow().bgCfg).dot.map(x => x.slice()); d.push(['Đợt ' + (d.length + 1), 0]); bgOptSet('dot', d) }
export function bgDotDel(i) { const d = bgOpt_(pdNow().bgCfg).dot.map(x => x.slice()); d.splice(i, 1); bgOptSet('dot', d) }

/* ---- Tờ bìa ---- */
function coverRowsOfCur() {
  const q = getQ(); const c = curNow()
  return c && q.cover.maDA === c.maDA ? q.cover.rows : null
}
/* "Sửa tay" bật do sửa chi phí kể từ lần lưu tờ bìa có kết quả gần nhất: {maDA, cu: {stt: trạng thái trước khi sửa}}.
   Lưu lỗi -> ô quay về số đã lưu trên máy chủ (coverVeBanLuu_) và nhãn tay / tự cộng cũng trả về như trước khi sửa. */
let tayCu = { maDA: '', cu: {} }
function coverLuuXong_(ma, ok) {
  const t = tayCu; tayCu = { maDA: '', cu: {} }
  if (ok || t.maDA !== ma || !curNow() || curNow().maDA !== ma) return
  let tay = bgOpt_(pdNow().bgCfg).tay; let doi = false
  Object.keys(t.cu).forEach(stt => { if (!!tay[stt] !== t.cu[stt]) { tay = coverTayMap_({ tay }, stt, t.cu[stt]); doi = true } })
  if (doi) bgOptSet('tay', tay)
}
export function coverEdit(i, field, value) {
  const rows = coverRowsOfCur(); if (!rows || !rows[i]) return
  const ma = curNow().maDA
  const nr = rows.slice(); const c = { ...nr[i] }
  c[field] = coverEditVal_(field, value)
  nr[i] = c
  setCoverRows(ma, nr)
  if (field === 'chiPhi') {
    if (tayCu.maDA !== ma) tayCu = { maDA: ma, cu: {} }
    if (!Object.prototype.hasOwnProperty.call(tayCu.cu, c.stt)) tayCu.cu[c.stt] = !!bgOpt_(pdNow().bgCfg).tay[c.stt]
    coverTaySet(c.stt, true)
  }
  coverLuu_(coverLuuXong_)
}
export function coverDel(i) {
  const rows = coverRowsOfCur(); if (!rows) return
  const nr = rows.slice(); nr.splice(i, 1)
  setCoverRows(curNow().maDA, nr); coverLuu_(coverLuuXong_)
}
export function coverAddBig() {
  const rows = coverRowsOfCur(); if (!rows) return
  setCoverRows(curNow().maDA, rows.concat([coverAddBig_(rows)])); coverLuu_(coverLuuXong_)
}
export function coverAddSmall() {
  const rows = coverRowsOfCur(); if (!rows) return
  setCoverRows(curNow().maDA, rows.concat([coverAddSmall_(rows)])); coverLuu_(coverLuuXong_)
}
export async function coverReload() {
  const ma = curNow() && curNow().maDA; if (!ma) return
  try {
    const cv = (await api.buildCoverFromTemplate(ma)) || []
    if (!curNow() || curNow().maDA !== ma) return
    setCoverRows(ma, cv); toast('Đã nạp mẫu + tự cộng chi phí')
  } catch (e) { toast('Lỗi: ' + e.message) }
}
export async function coverSave() {
  const ma = curNow() && curNow().maDA; if (!ma) return
  const rows = coverRowsOfCur() || []
  try {
    coverCancelPending()
    const cv = await api.saveCover(ma, rows)
    coverLuuXong_(ma, true)
    if (!curNow() || curNow().maDA !== ma) return
    setCoverRows(ma, cv || rows); toast('Đã lưu tờ bìa')
  } catch (e) { toast('Lỗi: ' + e.message); coverLuuXong_(ma, false); coverVeBanLuu_(ma) }
}
/* Ô thông tin dự án trên tờ bìa (maBaoGia, khachHang, quyMo, tongDT, nhuCau, dtBaoGia, phanKhuc) */
export function coverInfo(field, value) {
  const c = curNow(); if (!c) return
  // lỗi: báo rồi ném tiếp để ô nhập giữ chữ vừa gõ (bản gốc không vẽ lại khi lỗi)
  return storeUpdateProject(c.maDA, { [field]: value }).catch(e => { toast('Lỗi: ' + e.message); throw e })
}

/* ---- Bảng tính diện tích (projData.area, dự phòng localStorage qs_area_<maDA>) ---- */
export function areaLoad_(pd) {
  const c = curNow(); if (!c) return {}
  let d = (pd || pdNow()).area
  if (!d || typeof d !== 'object') { try { d = JSON.parse(localStorage.getItem('qs_area_' + c.maDA) || '{}') || {} } catch (e) { d = {} } }
  return d
}
export function areaSet(k, field, val) {
  const c = curNow(); if (!c) return
  const d = areaSetVal_(areaLoad_(), k, field, val)
  try { localStorage.setItem('qs_area_' + c.maDA, JSON.stringify(d)) } catch (e) { /* bỏ qua */ }
  projDataSet_('area', d)
}
export function areaApply() {
  const c = curNow(); if (!c) return
  const a = areaCompute_(areaLoad_()); const f = areaApplyFields_(a)
  syncProj({ ...c, ...f })
  api.updateProject(c.maDA, f).then(p => { if (p) syncProj(p) }).catch(e => toast('Lỗi: ' + e.message))
  toast('Đã áp DT báo giá ' + a.dtBaoGia + ' m² · DT sử dụng ' + a.dtSuDung + ' m² vào tờ bìa')
}

/* ---- Phiên bản ---- */
/* lyDo: 'chot' | 'pdf' | 'excel'. Trùng nội dung bản cuối thì không lưu thêm. */
export function bgChot(lyDo) {
  const m = freshModel()
  const c = m.ctx.cur; if (!c) return null
  const q = bgTong_(computeQuoteLocal(false, m.ctx).subtotal, m.ctx.bgCfg, c.vat)
  const me = getState().me
  const r = bgChotNew_(m.hist, m.sn, c, q, lyDo, (me && (me.hoTen || me.username)) || '')
  if (r.trung) {
    if (lyDo === 'chot') toast('Nội dung chưa đổi so với v' + r.v.ver + ' — không cần chốt thêm')
    return r.v
  }
  projDataSet_('bgHist', r.hist)
  if (lyDo === 'chot') toast('Đã chốt ' + r.v.ma + ' · v' + r.v.ver)
  return r.v
}

/* ---- In / PDF: cửa sổ riêng, CSS tài liệu đã đổi tên, ảnh URL tuyệt đối ---- */
export function printDoc(pages, css) {
  const c = curNow(); if (!c) { toast('Chưa chọn dự án'); return }
  if (!Array.isArray(pages)) {          // mỗi lần in nội dung mới = 1 phiên bản
    bgChot('pdf')
    const m = freshModel()
    pages = m.pages(); css = bgDocCss_(m.mau)
  }
  const html = pages.map(pg => pg.html).join('')
  const pcss = printCss_(css || bgDocCss_(freshModel().mau))
  const w = window.open('', '_blank'); if (!w) { toast('Cho phép popup để in/PDF'); return }
  w.document.write('<!doctype html><title>Báo giá — ' + esc(c.ten || '') + '</title><style>' + pcss + '</style><div class="qsd-doc">' + html + '</div>')
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 400)
}

/* ---- Xuất Excel (doExport 'xlsx'); 'pdf' = printDoc. Trả 'gia' khi người dùng muốn cập nhật giá trước. ---- */
let dangXuat = false
export async function doExport(fmt, lech) {
  const c0 = curNow(); if (!c0) { toast('Chưa chọn dự án'); return null }
  /* File xuất lấy giá ĐANG LƯU TRÊN DÒNG: danh mục đã đổi giá mà dòng chưa cập nhật thì hỏi trước */
  if (lech && lech.length) {
    const tl = await qsConfirm({ title: lech.length + ' dòng đang dùng giá cũ', ok: 'Vẫn xuất', huy: 'Để tôi cập nhật trước',
      note: 'Danh mục sản phẩm đã đổi giá nhưng các dòng dưới đây trong dự án vẫn giữ giá lúc thêm. Xuất bây giờ thì file ra GIÁ CŨ.',
      dong: lech.slice(0, 30).map(x => (x.l.ten || '') + ': ' + money(x.cu) + ' → ' + money(x.von)) })
    if (!tl) return 'gia'
  }
  if (dangXuat) { toast('Đang xuất, vui lòng chờ…'); return null }
  if (fmt === 'pdf') { toast('Đang mở bản in…'); printDoc(); return null }
  const ma0 = c0.maDA
  dangXuat = true; setQ({ exporting: true })
  try {
    let m = freshModel()
    const cols = m.ctx && exportCols_(m)
    const nodes = bgSelCodes_(m.ctx)
    // Phần thô gửi kèm để file Excel có sheet "3.1 Phần thô"; giá nhà thầu chỉ gửi khi bật "xuất kèm cột nội bộ"
    let pt = bgPTSecs_(m.ctx)
    if (!bgNoiBoXuat_(m.ctx.bgCfg)) pt = pt.map(sec => ({ ...sec, items: sec.items.map(it => { const o = { ...it }; delete o.dgnt; delete o.ttnt; return o }) }))
    // file Excel đọc tờ bìa ĐÃ LƯU -> lưu đúng số đang hiện (kể cả số tự cộng từ bóc tách) trước khi xuất
    const rows = m.ctx.cover || []
    if (rows.length) {
      const cc = coverCosts(m.ctx)
      const nr = rows.map(r => (coverHasChild(rows, r.stt) ? r : { ...r, chiPhi: cc.cost[r.stt] }))
      coverCancelPending()
      const cv = await api.saveCover(ma0, nr)
      if (!curNow() || curNow().maDA !== ma0) { toast('Đã đổi dự án trong lúc xuất — huỷ lần xuất này'); return null }
      setCoverRows(ma0, cv || nr)
      m = freshModel()
    }
    const anMap = bgAn_(m.ctx.bgCfg)
    const an = Object.keys(anMap).filter(k => anMap[k])
    const o = bgOpt_(m.ctx.bgCfg)
    const t = bgTong_(bgSub_(m.ctx), m.ctx.bgCfg, m.ctx.cur.vat)
    const tong = [['Cộng (chưa VAT)', t.sub]]
    if (t.ck) tong.push(['Chiết khấu' + (o.ckKieu === 'pct' ? ' ' + o.ck + '%' : ''), -t.ck], ['Sau chiết khấu', t.sau])
    tong.push(['VAT ' + t.vatPct + '%', t.vat], ['TỔNG THANH TOÁN', t.total])
    /* opts (M8.1, M8.2, M8.3): bố cục tờ bìa, công ty, tổng kết lấy đúng từ các hàm của bản xem trước (bgOrg_, bgTongKetData_
       trên cùng tổng t) nên chữ / số trong Excel trùng trang in */
    const org = bgOrg_(m.ctx.congTy, m.ctx.bgOrg)
    const opts = {
      coverMau: m.ui.coverMau === 'm1' ? 'm1' : 'm2',
      org: { ten: org.ten, logo: logoXuat_(org.logo), lines: org.lines },
      tongKet: bgTongKetData_(t, m.ctx.bgCfg, getState().me),
    }
    const r = await exportBaoGiaOpts(ma0, cols, 'xlsx', nodes, pt, an, tong, org.ten, opts)
    saveBase64(r)
    if (curNow() && curNow().maDA === ma0) bgChot('excel')       // chỉ ghi phiên bản khi file đã xuất xong
    toast('Đã xuất Excel · ' + cols.length + ' cột' + (nodes.length ? (' · ' + nodes.length + ' hạng mục') : '') + (pt.length ? ' · kèm phần thô' : ''))
    return r
  } catch (e) {
    toast('Lỗi: ' + e.message)
    return null
  } finally { dangXuat = false; setQ({ exporting: false }) }
}
/* bgExportCols_: cột của file = chip cột đang bật của Bóc tách (bỏ cột nội bộ khi chưa bật "xuất kèm") */
function exportCols_(m) { return bgExportCols_(m.ctx, m.ui) }

/* ---- Thông tin công ty trên báo giá (projData.bgOrg, lưu theo công ty) ---- */
export async function bgOrgEdit() {
  const S = getState()
  if (!isAdminRole_(S.me)) { toast('Chỉ Admin sửa được thông tin công ty trên báo giá'); return }
  const o = (S.projData && S.projData.bgOrg) || {}; const ct = S.congTy || {}
  const r = await qsAsk({ title: 'Thông tin công ty trên báo giá', ok: 'Lưu', required: false,
    note: 'Áp dụng cho mọi báo giá của công ty. Ô nào để trống thì không in.', fields: [
      { key: 'ten', label: 'Tên hiển thị', value: o.ten || ct.ten || '' },
      { key: 'logo', label: 'Link logo (để trống = logo của công ty)', value: o.logo || '', placeholder: ct.logoUrl || 'https://…' },
      { key: 'diaChi', label: 'Địa chỉ', value: o.diaChi || '' },
      { key: 'sdt', label: 'Điện thoại', value: o.sdt || ct.sdt || '' },
      { key: 'email', label: 'Email', value: o.email || ct.email || '' },
      { key: 'web', label: 'Website', value: o.web || '' },
      { key: 'xuong', label: 'Dòng thêm (xưởng, MST…)', value: o.xuong || '' }] })
  if (!r) return
  const v = {}
  ;['ten', 'logo', 'diaChi', 'sdt', 'email', 'web', 'xuong'].forEach(k => { const x = String(r[k] == null ? '' : r[k]).trim(); if (x) v[k] = x })
  projDataSet_('bgOrg', v); toast('Đã lưu — áp dụng cho mọi báo giá của công ty')
}

/* ---- Kéo đổi chỗ cột trên trang xem trước (bgColDrop) ---- */
export function bgColDrop(from, k) {
  if (!from || from === k) return
  const m = freshModel()
  const ord = bgDocCols_(m.ctx, m.ui).map(c => c[0]).filter(x => x !== from)
  let i = ord.indexOf(k); if (i < 0) i = ord.length
  ord.splice(i, 0, from)
  setColOrder(ord)
}

/* ---- So sánh 1 phiên bản với hiện tại (bgHistDiff_) ---- */
export function bgHistDiff(ver) {
  const S = getState()
  const v = bgHist_(S.projData).filter(x => x.ver === ver)[0]; if (!v || !v.snap) return
  const m = freshModel()
  const cu = m.sn
  const cq = bgTong_(computeQuoteLocal(false, m.ctx).subtotal, m.ctx.bgCfg, m.ctx.cur.vat)
  const key = l => l.lineId || ((l.maSP || '') + '|' + (l.ten || '') + '|' + (l.tang || ''))
  const A = {}; const B = {}
  v.snap.lines.forEach(l => { A[key(l)] = l }); cu.lines.forEach(l => { B[key(l)] = l })
  const them = []; const bo = []; const doi = []
  Object.keys(B).forEach(k => {
    if (!A[k]) them.push(B[k])
    else {
      const a = A[k]; const b = B[k]; const ds = []
      if ((Number(a.soLuong) || 0) !== (Number(b.soLuong) || 0)) ds.push('SL ' + (a.soLuong || 0) + ' → ' + (b.soLuong || 0))
      if (donGiaCK_(a) !== donGiaCK_(b)) ds.push('đơn giá ' + money(donGiaCK_(a)) + ' → ' + money(donGiaCK_(b)))
      if (ds.length) doi.push({ l: b, ds, tien: ttBan_(b) - ttBan_(a) })
    }
  })
  Object.keys(A).forEach(k => { if (!B[k]) bo.push(A[k]) })
  const dong = [].concat(
    them.map(l => '＋ ' + (l.ten || '') + ' — ' + money(ttBan_(l)) + ' đ'),
    bo.map(l => '－ ' + (l.ten || '') + ' — ' + money(ttBan_(l)) + ' đ'),
    doi.map(x => '± ' + (x.l.ten || '') + ': ' + x.ds.join(', ') + ' (' + (x.tien > 0 ? '+' : '') + money(x.tien) + ' đ)'))
  const d = cq.total - v.tong
  qsConfirm({ chiBao: true, nguyHiem: false, title: 'v' + v.ver + ' → hiện tại: ' + (d > 0 ? '+' : '') + money(d) + ' đ',
    note: 'Tổng v' + v.ver + ': ' + money(v.tong) + ' đ · hiện tại: ' + money(cq.total) + ' đ\n'
      + them.length + ' dòng thêm · ' + bo.length + ' dòng bỏ · ' + doi.length + ' dòng đổi số lượng / giá'
      + (dong.length ? '' : '\nKhông khác nhau về dòng hàng (có thể khác tờ bìa / điều khoản).'),
    dong })
}

