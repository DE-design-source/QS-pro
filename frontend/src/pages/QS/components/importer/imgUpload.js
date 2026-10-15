/* Tải ảnh lên (port PUB/nhap.js:1066-1146, 1232-1242): nén ở trình duyệt, gọi uploadImage có thử lại, ảnh tạm data: trong lúc tải.
   Ảnh được giữ qua 2 hàm truy cập: get() -> {main, list}; put(fn) với fn({main, list}) -> {main, list}.
   Nhờ vậy khối ảnh dùng được cho form sản phẩm (2E) và form công tác (3B) mà không đụng trạng thái của nhau. */
import * as api from '../../api/qsApi'
import { qsToast } from '../common/dialogs'
import { upBusy_ } from './importStore'

const toast = qsToast

export function readB64_(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })
}

/* Nén + thu nhỏ ảnh ở client trước khi upload (tránh payload quá lớn -> "Failed to fetch") */
export function downscaleImage_(file, maxDim, quality) {
  return new Promise(resolve => {
    try {
      if (!file || !/^image\//.test(file.type || '')) { readB64_(file).then(resolve, () => resolve('')); return }
      const url = URL.createObjectURL(file), img = new Image()
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height
          const scale = Math.min(1, (maxDim || 1600) / Math.max(w, h || 1))
          const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale))
          const c = document.createElement('canvas'); c.width = nw; c.height = nh
          c.getContext('2d').drawImage(img, 0, 0, nw, nh)
          URL.revokeObjectURL(url)
          let out = c.toDataURL('image/jpeg', quality || 0.82)
          if (out.length > 5.5e6) out = c.toDataURL('image/jpeg', 0.6)
          resolve(out)
        } catch (e) { URL.revokeObjectURL(url); readB64_(file).then(resolve, () => resolve('')) }
      }
      // trình duyệt không giải mã được (vd HEIC iPhone)
      img.onerror = () => { URL.revokeObjectURL(url); resolve('__DECODE_FAIL__') }
      img.src = url
    } catch (e) { resolve('__DECODE_FAIL__') }
  })
}

/* uploadImage có thử lại, chờ 1 / 2,5 / 5 / 8 giây giữa các lần (rớt mạng, máy chủ khởi động lại) */
export async function uploadImg_(dataUrl, name) {
  const backoff = [1000, 2500, 5000, 8000]
  let lastErr
  for (let k = 0; k <= backoff.length; k++) {
    try {
      const r = await api.uploadImage(dataUrl, name || 'image.jpg')
      const tok = r && (r.token || r.url)
      if (tok) return tok
      throw new Error('Không nhận được ảnh')
    } catch (e) {
      // hết phiên: dừng ngay, không thử lại
      if (e && e.name === 'QsAuthError') throw e
      lastErr = e
      if (k < backoff.length) await new Promise(res => setTimeout(res, backoff[k]))
    }
  }
  throw lastErr
}

/* upFile: 1 ảnh vào ô 'main' (đại diện) hoặc 'more' (chi tiết) */
export function upFile(zone, file, acc) {
  upBusy_(1)
  return downscaleImage_(file, 1600, 0.82).then(async dataUrl => {
    try {
      if (dataUrl === '__DECODE_FAIL__') { toast('Không đọc được ảnh — có thể ảnh iPhone (.HEIC). Hãy đổi sang JPG/PNG hoặc dán URL ảnh.'); return }
      if (!dataUrl) { toast('Không đọc được ảnh — hãy thử ảnh khác hoặc dán URL.'); return }
      // xem trước bằng chính dataURL (dataURL làm khoá để không lẫn khi tải nhiều ảnh cùng lúc)
      acc.put(s => (zone === 'main' ? { ...s, main: dataUrl } : { ...s, list: s.list.concat(dataUrl) }))
      toast('Đang tải ảnh lên…')
      try {
        const tok = await uploadImg_(dataUrl, file.name)
        acc.put(s => {
          if (zone === 'main') return s.main === dataUrl ? { ...s, main: tok } : s
          const ix = s.list.indexOf(dataUrl)
          if (ix < 0) return s
          const l = s.list.slice(); l[ix] = tok
          return { ...s, list: l }
        })
        toast('Đã tải ảnh lên')
      } catch (e) {
        // lỗi -> gỡ đúng ảnh tạm này, gợi ý dán URL
        acc.put(s => {
          if (zone === 'main') return s.main === dataUrl ? { ...s, main: '' } : s
          return { ...s, list: s.list.filter(x => x !== dataUrl) }
        })
        toast('Tải ảnh lỗi: ' + (/fetch/i.test(e.message) ? 'mất kết nối, thử lại' : e.message) + ' — hoặc dán URL ảnh.')
      }
    } finally { upBusy_(-1) }
  })
}

/* Tải TUẦN TỰ; hình đại diện chỉ 1 ảnh */
export async function upFilesSeq_(zone, fs, acc) {
  if (zone === 'main') { if (fs.length > 1) toast('Hình đại diện chỉ 1 ảnh — lấy ảnh đầu.'); fs = fs.slice(0, 1) }
  for (let i = 0; i < fs.length; i++) { try { await upFile(zone, fs[i], acc) } catch (e) { /* đã báo trong upFile */ } }
}

/* Bảng xem trước nhập file: tải nhiều ảnh, trả mảng token (impUploadFiles_) */
export async function impUploadFiles_(fs) {
  upBusy_(1)
  try {
    const toks = []
    for (let k = 0; k < fs.length; k++) {
      try {
        const b = await downscaleImage_(fs[k], 1600, 0.82)
        if (b === '__DECODE_FAIL__') { toast('Ảnh "' + (fs[k].name || '') + '" không đọc được (có thể .HEIC) — đổi JPG/PNG.'); continue }
        if (!b) continue
        const tok = await uploadImg_(b, fs[k].name)
        if (tok) toks.push(tok)
      } catch (e) { toast('Tải ảnh lỗi: ' + (/fetch/i.test(e.message) ? 'mất kết nối' : e.message)) }
    }
    return toks
  } finally { upBusy_(-1) }
}

/* Mở hộp chọn file ảnh của trình duyệt */
export function pickFiles_(multiple, accept, onFiles) {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = accept || 'image/*'; if (multiple) inp.multiple = true
  inp.onchange = () => onFiles(Array.prototype.slice.call(inp.files || []))
  inp.click()
}
