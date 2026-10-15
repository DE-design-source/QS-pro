/* REST chỉ bản Go của Nhập dữ liệu · Phần thô (roadmap M5.1). Dùng request của api/http.js (token, công ty xem như, lỗi như qsApi).
   ctImportParse(base64, ext) -> {rows, loi}: máy chủ đọc file mẫu /mau-nhap-cong-tac.xlsx (hoặc CSV cùng tiêu đề), KHÔNG ghi gì;
   rows theo khoá ctSave, loi = [{dong, msg, ten, row}] (row = bản đọc được, nhãn lạ để trống). */
import { request } from '../../../api/http'

export const ctImportParse = (base64, ext, signal) =>
  request('POST', '/work-items/import/parse', { body: { base64, ext }, signal })
