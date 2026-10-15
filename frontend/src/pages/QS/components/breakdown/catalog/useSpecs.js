import { useEffect, useState } from 'react'
import { loadSpecs, specsNow } from '../../../api/specs'

/* Thông số ngành (VS / Sơn / CT) cho panel danh mục và panel chi tiết.
   Trả {specs, error}: specs = null khi chưa tải xong hoặc tải lỗi; error = chữ lỗi (hiện "Không tải được thông số ngành") */
export function useSpecs() {
  const [st, setSt] = useState(() => ({ specs: specsNow(), error: '' }))
  useEffect(() => {
    if (st.specs) return undefined
    let live = true
    loadSpecs()
      .then(specs => { if (live) setSt({ specs, error: '' }) })
      .catch(e => { if (live) setSt({ specs: null, error: (e && e.message) || 'Không tải được thông số ngành' }) })
    return () => { live = false }
  }, [st.specs])
  return st
}
