/* REST riêng của tab Xuất báo giá (route của bản Go). Hàm cũ của api/qsApi.js giữ nguyên; hàm ở đây gửi thêm tham số chỉ bản Go.
   exportBaoGia + opts (M8.1, M8.2, M8.3): POST /projects/:id/quotation/export {cols, format, nodes, phanTho, anMuc, tong, org, opts}
     opts = { coverMau: 'm1'|'m2', org: {ten, logo, lines}, tongKet: {ngay, hieuLuc, dot: [{noiDung, pct, soTien}], ghiChu, nguoi} }
   (backend/internal/modules/quotations/service_export_opts.go). Tham số cuối là AbortSignal. */
import { request, enc } from '../../api/http'

export const exportBaoGiaOpts = (maDA, cols, format, nodes, phanTho, anMuc, tong, org, opts, signal) =>
  request('POST', '/projects/' + enc(maDA) + '/quotation/export', { body: { cols, format, nodes, phanTho, anMuc, tong, org, opts }, signal })

/* Logo gửi cho máy chủ tải (best-effort): URL http(s) và đường dẫn trên máy chủ ("/media?token=…") giữ nguyên; mã ảnh trần
   thành /media?token=…; data: / blob: / giao thức khác thì bỏ (máy chủ không tải được). */
export function logoXuat_(v) {
  v = String(v || '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v) || (v.charAt(0) === '/' && v.charAt(1) !== '/')) return v
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.indexOf('//') === 0) return ''
  return '/media?token=' + encodeURIComponent(v)
}
