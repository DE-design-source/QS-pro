import { useState } from 'react'
import QsIcon from './QsIcon'
import './common.css'

/* Ảnh sản phẩm thu nhỏ (thay breakdown/PaintThumb). Ảnh thật lấy qua mediaUrl, caller truyền vào src
   (component dùng chung không tự gọi API). Không có ảnh -> ô xám có icon ảnh (bản gốc: .noimg, PUB/boc.js:691).
   Ảnh lỗi -> ẩn ảnh, ô để trống như onerror="this.style.visibility='hidden'" của bản gốc (PUB/muahang.js:40).
   Props: product (để lấy alt = product.ten), size = 34 (px, ô vuông), src (URL ảnh đầu tiên, đã tuyệt đối),
          onClick (tuỳ chọn, vd. mở ImgViewer; có thì con trỏ là kính lúp), className, title. */
export default function ProductThumb({ product, size = 34, src, onClick, className = '', title }) {
  const [bad, setBad] = useState('')
  const broken = !!src && bad === src
  const ok = !!src && !broken
  const box = { width: size, height: size }
  const cls = `qsc-thumb${src ? '' : ' none'}${onClick && ok ? ' click' : ''}${className ? ' ' + className : ''}`

  return (
    <span className={cls} style={box} title={title} onClick={ok && onClick ? onClick : undefined}>
      {src
        ? <img src={src} alt={(product && product.ten) || ''} loading="lazy" draggable="false" onError={() => setBad(src)}
            style={broken ? { visibility: 'hidden' } : undefined} />
        : <QsIcon name="image" size={Math.max(12, Math.round(size * 0.5))} />}
    </span>
  )
}
