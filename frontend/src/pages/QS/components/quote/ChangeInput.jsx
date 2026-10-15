import { useEffect, useRef } from 'react'

/* Ô nhập ghi khi sự kiện "change" gốc của trình duyệt (rời ô / Enter / đóng bảng màu), như onchange="" của bản gốc —
   onChange của React chạy theo từng phím nên sẽ ghi lên máy chủ mỗi lần gõ. Giá trị mới từ ngoài vào thì ô vẽ lại (key).
   Props: value, onCommit(text, el) (trả false = bỏ, ô về giá trị cũ; trả Promise = chờ ghi xong mới vẽ lại, Promise lỗi = giữ chữ vừa gõ),
   as = 'input' | 'textarea', còn lại chuyển thẳng cho phần tử. */
export default function ChangeInput({ value, onCommit, as = 'input', ...rest }) {
  const ref = useRef(null)
  const cb = useRef(onCommit)
  cb.current = onCommit
  const v = value == null ? '' : String(value)
  const vNow = useRef(v)
  vNow.current = v
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const h = () => {
      const go = el.value
      const r = cb.current ? cb.current(go, el) : undefined
      // onCommit trả false = không nhận giá trị (vd màu quá nhạt): ô về lại giá trị cũ như bản gốc vẽ lại
      if (r === false) { el.value = v; return }
      /* Bản gốc vẽ lại sau mỗi lần sửa nên ô luôn hiện giá trị đã lưu (gõ "xyz" vào ô số -> hiện 0). Giá trị lưu trùng giá trị cũ
         thì key không đổi, ô không vẽ lại: tự gán lại sau khi ghi xong (nếu người dùng chưa gõ tiếp vào ô) */
      Promise.resolve(r).then(() => setTimeout(() => {
        if (ref.current === el && el.value === go && el.value !== vNow.current) el.value = vNow.current
      }, 0), () => { /* ghi lỗi (đã báo): giữ chữ vừa gõ như bản gốc */ })
    }
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  }, [v])
  const Tag = as
  return <Tag key={v} ref={ref} defaultValue={v} {...rest} />
}
