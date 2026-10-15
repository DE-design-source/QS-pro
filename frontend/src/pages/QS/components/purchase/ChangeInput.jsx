import { useEffect, useLayoutEffect, useRef } from 'react'

/* Ô nhập lưu theo sự kiện "change" của trình duyệt như onchange="..." của bản gốc (rời ô, Enter, bấm mũi tên số),
   không lưu theo từng phím. Sau mỗi lần lưu, ô hiện lại đúng giá trị đang có (bản gốc vẽ lại cả bảng).
   Props: value (giá trị hiển thị), onCommit(chuỗi vừa nhập), textarea (bool), còn lại chuyển thẳng cho thẻ. */
export default function ChangeInput({ value, onCommit, textarea, ...rest }) {
  const ref = useRef(null)
  const cb = useRef(onCommit)
  cb.current = onCommit
  const vua = useRef(false)
  const shown = value == null ? '' : String(value)

  useEffect(() => {
    const el = ref.current
    const h = e => { vua.current = true; cb.current(e.target.value) }
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (el.value !== shown && (vua.current || document.activeElement !== el)) el.value = shown
    vua.current = false
  })

  return textarea ? <textarea ref={ref} defaultValue={shown} {...rest} /> : <input ref={ref} defaultValue={shown} {...rest} />
}
