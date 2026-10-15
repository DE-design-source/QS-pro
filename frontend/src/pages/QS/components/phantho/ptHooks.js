/* Hook dữ liệu của Phần thô.
   usePtTemplate(): bộ mẫu thư viện như PT_TEMPLATE của bản gốc tại thời điểm đó: khái toán chi tiết + sơ bộ (PT_SOBO, phantho.js:288),
     các nhóm dự toán dựng từ số liệu đầu vào (dtSync_ 402-419), rồi công tác CSDL gắn vào và bản dựng sẵn bị ẩn (ctSyncTemplate_ 623-642).
   usePhanTho(): {maDA, phanTho, ptVat, comp (ptComputeAll), ready, err} của dự án đang mở (ptEnsure 1934-1948). */
import { useMemo } from 'react'
import { useQsStore } from '../../state/store'
import { ptTemplateNew_, dtSync_, ctSyncTemplate_, ptEnsureVals_, ptKey, ptComputeAll } from '../../lib/phantho.js'
import { usePtUi } from './ptState'
import { dtValsOf } from './ptActions'

function lsGet(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
function lsJson(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } }

export function usePtTemplate() {
  const congTac = useQsStore(s => s.congTac)
  const maDA = useQsStore(s => (s.cur ? s.cur.maDA : ''))
  const dtVer = usePtUi(s => s.dtVer)
  return useMemo(() => {
    const t = ptTemplateNew_()
    dtSync_(t, bo => dtValsOf(maDA, bo))
    return ctSyncTemplate_(t, congTac).tpl
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [congTac, maDA, dtVer])
}

export function usePhanTho() {
  const cur = useQsStore(s => s.cur)
  const projData = useQsStore(s => s.projData)
  const pdOk = useQsStore(s => s.pdOk)
  const pdErr = useQsStore(s => s.pdErr)
  const maDA = cur ? cur.maDA : ''
  return useMemo(() => {
    const k = ptKey(maDA)
    const v = ptEnsureVals_(projData, cur, lsJson(k), lsGet(k + '_vat'))
    let comp = null; let err = ''
    try { comp = ptComputeAll(v.phanTho, v.ptVat) } catch (e) { err = 'Bảng Phần thô lưu trên máy chủ bị hỏng: ' + String((e && e.message) || e) }
    return {
      maDA, phanTho: v.phanTho, ptVat: v.ptVat, comp, err,
      ready: !!maDA && pdOk === maDA, loadErr: pdErr && pdErr.maDA === maDA ? pdErr.msg : '',
    }
  }, [cur, projData, pdOk, pdErr, maDA])
}
