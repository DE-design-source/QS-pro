/* Thao tác trên bảng công tác của Danh sách SP (port PUB/phantho.js:663-719 ctFav_ / ctFavBulk_ / ctDuyet_ / ctDelete_ / ctDuyetBulk_ /
   ctBulkEditRun_ / ctDeleteBulk_; PUB/sanpham.js:1209-1254 ptOvrSave / ptResetOvr_ / ptBulkAdd_, 1309-1323 ptExportXlsx).
   Ghi CSDL qua useCongTac (congTacActions: gọi API, kiểm kết quả, nạp lại cache); chữ thông báo giữ như bản gốc. */
import { congTacActions } from '../../../state/useCongTac'
import { ctOf_, ptBase_, ptOvrSet_ } from '../../../lib/phantho.js'
import { ptN, ptMoneyN_ } from '../../../lib/format.js'
import { downloadPost } from '../../../api/files'
import { qsToast, qsConfirm } from '../../common/dialogs'
import { setU } from '../list/spStore'
import { ctPatchOf_, CT_BULK_F, ptOvrAll_, ptOvrSave_, ptOvrClear_, ptAddFromLib_ } from './ptCore'
import { ptXlsRows_ } from './ptModel'
import { setP } from './ptStore'

const msg = e => String((e && e.message) || e)
const isAuth = e => !!(e && e.name === 'QsAuthError')
const clearSel = () => setU({ sel: {} })
const ctIds = rows => rows.map(r => { const c = ctOf_(r.a); return c && c.id }).filter(Boolean)

export async function ctFav_(id, on) {
  try { await congTacActions.ctFav([id], !!on); qsToast(on ? 'Đã thêm vào công tác yêu thích' : 'Đã bỏ khỏi công tác yêu thích') }
  catch (e) { if (!isAuth(e)) qsToast('Lỗi: ' + msg(e)) }
}
export async function ctFavBulk_(rows, on) {
  const ids = ctIds(rows)
  if (!ids.length) { qsToast('Chỉ đánh dấu được công tác đã lưu trong cơ sở dữ liệu'); return }
  // ctFav nhiều dòng đã tự nạp lại danh sách; 1 dòng thì nạp lại ở đây cho giống bản gốc
  try { await congTacActions.ctFav(ids, !!on); clearSel(); if (ids.length < 2) await congTacActions.ctReload(); qsToast((on ? 'Đã thêm ' : 'Đã bỏ ') + ids.length + ' công tác yêu thích') }
  catch (e) { if (!isAuth(e)) qsToast('Lỗi: ' + msg(e)) }
}
export async function ctDuyet_(id, on) {
  try { await congTacActions.ctDuyet([id], !!on); qsToast(on ? 'Đã duyệt công tác' : 'Đã bỏ duyệt') }
  catch (e) { if (!isAuth(e)) qsToast('Lỗi: ' + msg(e)) }
}
export async function ctDelete_(id, ten) {
  if (!await qsConfirm('Xoá công tác "' + ten + '" khỏi cơ sở dữ liệu?')) return
  try { await congTacActions.ctDelete([id]); qsToast('Đã xoá công tác') }
  catch (e) { if (!isAuth(e)) qsToast('Lỗi: ' + msg(e)) }
}
export async function ctDuyetBulk_(rows, on) {
  const ids = ctIds(rows)
  if (!ids.length) { qsToast('Chỉ duyệt được công tác đã lưu trong cơ sở dữ liệu'); return }
  try { const nD = await congTacActions.ctDuyet(ids, !!on); clearSel(); qsToast((on ? 'Đã duyệt ' : 'Đã bỏ duyệt ') + (nD || ids.length) + ' công tác') }
  catch (e) { if (!isAuth(e)) qsToast('Lỗi: ' + msg(e)) }
}
export async function ctBulkEditRun_(rows, f, val) {
  rows = rows.filter(r => ctOf_(r.a))
  if (!rows.length) { qsToast('Chỉ sửa được công tác đã lưu trong cơ sở dữ liệu'); return }
  const def = CT_BULK_F.filter(x => x[0] === f)[0]; if (!def) return
  val = String(val == null ? '' : val).trim()
  if (val === '') { qsToast('Nhập giá trị mới'); return }
  const v = def[2] === 'money' ? ptMoneyN_(val) : val
  if (!await qsConfirm('Đặt "' + def[1] + '" = "' + val + '" cho ' + rows.length + ' công tác đã chọn?')) return
  let ok = 0, err = ''
  for (let i = 0; i < rows.length; i++) {
    const c = ctOf_(rows[i].a)
    try { const patch = ctPatchOf_(c); patch[f] = v; await congTacActions.ctUpdate(c.id, patch); ok++ }
    catch (e) { if (isAuth(e)) return; err = msg(e) }
  }
  clearSel(); await congTacActions.ctReload()
  qsToast(ok ? ('Đã sửa ' + ok + ' công tác' + (err ? (' · lỗi: ' + err) : '')) : ('Lỗi: ' + err))
}
export async function ctDeleteBulk_(rows) {
  const ids = ctIds(rows)
  if (!ids.length) { qsToast('Chỉ xoá được công tác đã lưu trong cơ sở dữ liệu'); return }
  if (!await qsConfirm('Xoá ' + ids.length + ' công tác khỏi cơ sở dữ liệu?')) return
  try { const nX = await congTacActions.ctDelete(ids); clearSel(); qsToast('Đã xoá ' + (nX || ids.length) + ' công tác') }
  catch (e) { if (!isAuth(e)) qsToast('Lỗi: ' + msg(e)) }
}

/* Sửa 1 ô của bảng ở chế độ Edit (ptOvrSave): công tác CSDL -> lưu thẳng; bản dựng sẵn -> giá sửa tay qs_ptovr.
   Trả true nếu đã lưu, false nếu lỗi (ô trả lại giá trị cũ). */
export async function ptOvrSave(r, e, raw) {
  const f = e.f
  raw = String(raw || '').trim()
  const v = e.money ? (raw === '' ? '' : ptMoneyN_(raw)) : (['kl', 'dt', 'hs'].indexOf(f) >= 0 ? (raw === '' ? '' : ptN(raw)) : raw)
  const c = ctOf_(r.a)
  if (c) {                                   // công tác trong CSDL -> lưu thẳng
    const patch = ctPatchOf_(c); patch[f] = v
    try { await congTacActions.ctUpdate(c.id, patch) }
    catch (x) { if (!isAuth(x)) qsToast('Lỗi lưu: ' + msg(x)); return false }
    qsToast('Đã lưu vào cơ sở dữ liệu')
    return true
  }
  const U = ptOvrAll_()
  const base = ptBase_(r.sec, r.a, f)
  if (v === '' || String(v) === String(base)) ptOvrSet_(U, r.sec, r.a, f, '')   // trùng giá gốc -> bỏ phần sửa
  else ptOvrSet_(U, r.sec, r.a, f, v)
  ptOvrSave_(U)
  setP(s => ({ ovrVer: s.ovrVer + 1 }))
  qsToast('Đã lưu — giá này dùng cho cả thư viện và khi thêm vào bảng')
  return true
}
export async function ptResetOvr_() {
  const n = Object.keys(ptOvrAll_()).length
  if (!n) { qsToast('Chưa có công tác nào bị sửa'); return }
  if (!await qsConfirm('Trả ' + n + ' công tác đã sửa về đúng bảng giá gốc?')) return
  ptOvrClear_()
  setP(s => ({ ovrVer: s.ovrVer + 1 }))
  qsToast('Đã trả về bảng giá gốc')
}
/* ＋ trên 1 dòng / nút "Thêm vào bảng khái toán" của popup (ptAddFromLib không quiet) */
export function ptAddOne_(tpl, r) {
  if (ptAddFromLib_(tpl, [[r.si, r.ii]]) > 0) qsToast('Đã thêm: ' + String(r.a[0]).split('\n')[0])
}
export function ptBulkAdd_(tpl, rows) {
  if (!rows.length) return
  if (ptAddFromLib_(tpl, rows.map(r => [r.si, r.ii])) < 0) return
  clearSel()
  qsToast('Đã thêm ' + rows.length + ' công tác vào bảng khái toán')
}
/* Tải Excel công tác: có chọn -> chỉ dòng đã chọn, không -> cả danh sách đang lọc */
export async function ptExportXlsx(rowsIn) {
  const rows = ptXlsRows_(rowsIn)
  if (!rows.length) { qsToast('Không có công tác nào để tải'); return }
  try {
    await downloadPost('/export/cong-tac', { rows }, 'cong-tac-xay-dung.xlsx')
    qsToast('Đã tải ' + rows.length + ' công tác ra Excel')
  } catch (e) { if (!isAuth(e)) qsToast('Không tải được Excel: ' + msg(e)) }
}
