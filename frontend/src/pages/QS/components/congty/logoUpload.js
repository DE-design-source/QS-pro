/* Thu nhỏ ảnh + tải ảnh lên có thử lại — port nguyên văn readB64_ (PUB/nhap.js:1232), downscaleImage_ (1082-1105),
   uploadImg_ (1107-1114). Dùng cho logo công ty (ctLogoUpload_, PUB/congty.js:179-189: 512 px, chất lượng 0.9). */
import * as api from '../../api/qsApi'

export function readB64_(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)) }; r.onerror = rej; r.readAsDataURL(f) }) }

export function downscaleImage_(file, maxDim, quality) {
  return new Promise(function (resolve) {
    try {
      if (!file || !/^image\//.test(file.type || '')) { return readB64_(file).then(resolve, function () { resolve('') }) }
      var url = URL.createObjectURL(file), img = new Image()
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height
          var scale = Math.min(1, (maxDim || 1600) / Math.max(w, h || 1))
          var nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale))
          var c = document.createElement('canvas'); c.width = nw; c.height = nh
          c.getContext('2d').drawImage(img, 0, 0, nw, nh)
          URL.revokeObjectURL(url)
          var out = c.toDataURL('image/jpeg', quality || 0.82)
          // nếu vì lý do nào đó vẫn > ~4MB thì nén mạnh hơn
          if (out.length > 5.5e6) { out = c.toDataURL('image/jpeg', 0.6) }
          resolve(out)
        } catch (e) { URL.revokeObjectURL(url); readB64_(file).then(resolve, function () { resolve('') }) }
      }
      img.onerror = function () { URL.revokeObjectURL(url); resolve('__DECODE_FAIL__') }   // trình duyệt không giải mã được (vd HEIC iPhone)
      img.src = url
    } catch (e) { resolve('__DECODE_FAIL__') }
  })
}

// Gọi uploadImage có thử lại nhiều lần, backoff tăng dần (chịu được rớt mạng / máy chủ khởi động lại)
export async function uploadImg_(dataUrl, name) {
  var backoff = [1000, 2500, 5000, 8000], lastErr
  for (var k = 0; k <= backoff.length; k++) {
    try { var r = await api.uploadImage(dataUrl, name || 'image.jpg'); var tok = r && (r.token || r.url); if (tok) return tok; throw new Error('Không nhận được ảnh') }
    catch (e) {
      lastErr = e
      if (e && e.name === 'QsAuthError') throw e   // hết phiên: thử lại vô ích
      if (k < backoff.length) await new Promise(function (res) { setTimeout(res, backoff[k]) })
    }
  }
  throw lastErr
}
