import { useEffect, useMemo, useRef, useState } from 'react'
import './importer.css'
import { useQs } from '../../state/QsData'
import { loadSpecs, specsNow } from '../../api/specs'
import NganhSel, { ptLibrary_, ctHangMucList_ } from './NganhSel'
import ProductForm from './ProductForm'
import RecentPanel from './RecentPanel'
import ImportPt from './pt/index'
import { useImp, impGet } from './importStore'
import { impSetLoai_ } from './importActions'

/* Tab Nhập dữ liệu (port renderImport / impStatBar / renderImportPT_ phần thanh số liệu, PUB/nhap.js:460-470, 808-870, 896-905).
   Props: {} (cố định từ Batch 0). Form, danh sách chờ và danh sách vừa nhập ở importStore: rời tab / rời /qs vẫn còn;
   hiện lại tab không vẽ lại form (PUB/app.js:359-360). Ngành "Xây dựng · công tác phần thô": thanh số liệu vẽ ở đây (để luôn đổi
   được ngành), phần form + danh sách chờ công tác là importer/pt/index.jsx (Batch 3B). */
function Stat({ label, val }) {
  return <div className="qsi-stat"><div className="qsi-stat-v">{val}</div><div className="qsi-stat-l">{label}</div></div>
}

export default function ImportTab() {
  const { congTac } = useQs()
  const loai = useImp(s => s.loai)
  const ps = useImp(s => s.sessionAdded)
  const [specs, setSpecs] = useState(specsNow)
  const [specErr, setSpecErr] = useState('')
  const [specTry, setSpecTry] = useState(0)
  const rootRef = useRef(null)

  useEffect(() => {
    if (specs) return undefined
    let on = true
    setSpecErr('')
    loadSpecs().then(s => { if (on) setSpecs(s) }, e => { if (on) setSpecErr(e.message || String(e)) })
    return () => { on = false }
  }, [specs, specTry])

  // Còn sản phẩm / công tác chưa lưu vào Database -> trình duyệt hỏi trước khi rời trang (nhap.js:584-586)
  useEffect(() => {
    const h = e => {
      const st = impGet()
      if ((st.pending || []).length || st.ctPendingN) { e.preventDefault(); e.returnValue = 'Còn dữ liệu chưa lưu vào Database'; return e.returnValue }
      return undefined
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  const pt = useMemo(() => {
    if (loai !== 'pt') return null
    const ds = congTac || []
    return { n: ds.length, chuaDuyet: ds.filter(c => !c.daDuyet).length, hm: ctHangMucList_(ptLibrary_(ds), ds).length }
  }, [loai, congTac])
  const brands = {}, nccs = {}
  ;(ps || []).forEach(p => { if (p.thuongHieu) brands[p.thuongHieu] = 1; if (p.ncc) nccs[p.ncc] = 1 })
  const sel = <NganhSel loai={loai} specs={specs} onPick={v => impSetLoai_(v, specs)} />
  const toTop = () => { const el = rootRef.current; if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <div className="qsi-root" ref={rootRef}>
      {pt ? (
        <>
          <div className="qsi-statbar">{sel}<Stat label="Công tác trong CSDL" val={pt.n} /><Stat label="Chờ duyệt" val={pt.chuaDuyet} /><Stat label="Hạng mục" val={pt.hm} /></div>
          <ImportPt />
        </>
      ) : (
        <>
          <div className="qsi-statbar">{sel}
            <Stat label="Số lượng SKU đã nhập" val={(ps || []).length} />
            <Stat label="Số lượng Brand" val={Object.keys(brands).length} />
            <Stat label="Số lượng nhà cung cấp" val={Object.keys(nccs).length} />
          </div>
          <div className="qsi-layout">
            <ProductForm specs={specs} specErr={specErr} onRetrySpecs={() => setSpecTry(t => t + 1)} />
            <RecentPanel specs={specs} onEditOpen={toTop} />
          </div>
        </>
      )}
    </div>
  )
}
