/* ═══ CÔNG TẮC - Ổ CẮM (đề mục 3.2.6.2) — BỘ THÔNG SỐ THEO TỪNG HẠNG MỤC (nguồn DUY NHẤT) ═══
   Cùng cách làm với public/vs-spec.js (thiết bị vệ sinh) và public/son-spec.js (sơn nước). Dùng chung cho:
     · Form Nhập dữ liệu / modal Sửa SP -> chỉ hiện thông số của hạng mục đang chọn
     · File mẫu nhập hàng loạt (server tạo động /mau-nhap-cong-tac-o-cam.xlsx)
     · Server (store_supa) -> map cột DB, lọc thông số khi nhập, ghép cột "Thông tin chính" / "Thông số thiết kế"
   Bộ trường lấy theo file "THIẾT_BỊ_Ổ_CẮM_CÔNG_TẮC.xlsx" của Dezon (sheet TỪ ĐIỂN TRƯỜNG + DANH MỤC):
   2 module Ổ CẮM và CÔNG TẮC, mỗi module 4 khối (Thông tin chính · Điện & an toàn · USB / Tín hiệu / Thông minh · Lắp đặt).
   Nhãn nào TRÙNG với ngành khác thì DÙNG CHUNG cột DB (MÀU SẮC · CHẤT LIỆU · CHỈ SỐ IP · KIỂU LẮP ĐẶT) — nhãn là khoá duy nhất toàn hệ thống.
   Cột DB mới: db/cong_tac_o_cam.sql                                                                  */
(function (root) {
  'use strict';
  // Nhãn cột (cũng là tiêu đề cột trong file Excel) -> [cột DB, nhãn hiển thị, kiểu, gợi ý nhập]
  var METRIC = {
    // ----- Thông tin chính -----
    'LOẠI CẤU KIỆN':        ['thanh_phan', 'Loại cấu kiện', 'sel', 'Nguyên bộ / hạt / mặt / đế'],
    'SỐ Ổ CẮM (ổ)':         ['so_o_cam', 'Số ổ cắm', 'text', 'VD: 2'],
    'KIỂU CHẤU CẮM':        ['kieu_chau', 'Kiểu chấu cắm', 'sel', ''],
    'SỐ NÚT (gang)':        ['so_nut', 'Số nút', 'text', 'VD: 2'],
    'KIỂU MẠCH / CHỨC NĂNG': ['kieu_mach', 'Kiểu mạch / chức năng', 'sel', ''],
    'KIỂU THAO TÁC':        ['kieu_thao_tac', 'Kiểu thao tác', 'sel', ''],
    'MÀU SẮC':              ['mau_sac', 'Màu sắc', 'sel', 'VD: Trắng'],
    'CHẤT LIỆU':            ['chat_lieu', 'Chất liệu', 'sel', ''],
    'ĐÈN BÁO':              ['den_bao', 'Đèn báo', 'sel', ''],
    'CHỈ SỐ IP':            ['chi_so_ip', 'Chỉ số IP (chống bụi, nước)', 'sel', ''],
    'CÓ MÀN CHE AN TOÀN':   ['man_che', 'Màn che an toàn (shutter)', 'sel', 'Chống giật cho trẻ em'],
    'QUY CÁCH ĐÓNG GÓI (cái/hộp)': ['quy_cach', 'Quy cách đóng gói (cái/hộp)', 'text', 'VD: 10'],
    // ----- Thông số điện & an toàn -----
    'DÒNG ĐIỆN ĐỊNH MỨC (A)': ['dong_dm_a', 'Dòng điện định mức (A)', 'text', 'VD: 16'],
    'ĐIỆN ÁP ĐỊNH MỨC (V)': ['dien_ap_v', 'Điện áp định mức (V)', 'text', 'VD: 250'],
    'CÔNG SUẤT TỐI ĐA (W)': ['cong_suat_max_w', 'Công suất tối đa (W)', 'text', 'VD: 4000'],
    'CÔNG SUẤT TẢI TỐI ĐA (W)': ['cong_suat_tai_max_w', 'Công suất tải tối đa (W)', 'text', 'VD: 1000'],
    'CÔNG SUẤT TẢI TỐI THIỂU (W)': ['cong_suat_tai_min_w', 'Công suất tải tối thiểu (W)', 'text', 'Dimmer / công tắc thông minh'],
    'LOẠI TẢI PHÙ HỢP':     ['loai_tai', 'Loại tải phù hợp', 'text', 'VD: Đèn LED, đèn sợi đốt, quạt'],
    'TUỔI THỌ (lần thao tác)': ['tuoi_tho_lan', 'Tuổi thọ (lần thao tác)', 'text', 'VD: 40000'],
    'TẦN SỐ (Hz)':          ['tan_so_hz', 'Tần số (Hz)', 'text', 'VD: 50/60'],
    'VẬT LIỆU TIẾP ĐIỂM':   ['vat_lieu_tiep_diem', 'Vật liệu tiếp điểm', 'sel', ''],
    'KHẢ NĂNG CHỐNG CHÁY':  ['chong_chay', 'Khả năng chống cháy', 'text', 'VD: Nhựa PC chống cháy (UL94-V0)'],
    'TIÊU CHUẨN ÁP DỤNG':   ['tieu_chuan', 'Tiêu chuẩn áp dụng', 'text', 'VD: IEC 60669-1'],
    'CHỨNG NHẬN':           ['chung_nhan', 'Chứng nhận', 'text', 'VD: CE; RoHS'],
    // ----- USB / Tín hiệu (ổ cắm) -----
    'SỐ CỔNG USB-A':        ['so_usb_a', 'Số cổng USB-A', 'text', 'VD: 1'],
    'SỐ CỔNG USB-C':        ['so_usb_c', 'Số cổng USB-C', 'text', 'VD: 1'],
    'CÔNG SUẤT SẠC USB (W)': ['cong_suat_sac_w', 'Công suất sạc USB (W)', 'text', 'VD: 20'],
    'ĐIỆN ÁP / DÒNG RA USB': ['usb_ra', 'Điện áp / dòng ra USB', 'text', 'VD: USB-A 5V/2.4A; USB-C PD 20W'],
    'LOẠI ĐẦU TÍN HIỆU':    ['loai_tin_hieu', 'Loại đầu tín hiệu', 'sel', 'Ổ TV / LAN / Tel / HDMI'],
    // ----- Thông minh / điều khiển -----
    'TÍCH HỢP THÔNG MINH':  ['thong_minh', 'Tích hợp thông minh', 'sel', ''],
    'GIAO THỨC KẾT NỐI':    ['giao_thuc', 'Giao thức kết nối', 'sel', ''],
    'HỆ SINH THÁI TƯƠNG THÍCH': ['he_sinh_thai', 'Hệ sinh thái tương thích', 'text', 'VD: Tuya; Google Home; Alexa'],
    'DÂY TRUNG TÍNH (N)':   ['day_trung_tinh', 'Dây trung tính (N)', 'sel', ''],
    'LOẠI CẢM BIẾN':        ['loai_cam_bien', 'Loại cảm biến', 'sel', ''],
    'TÍNH NĂNG THÔNG MINH': ['tinh_nang_tm', 'Tính năng thông minh', 'text', 'VD: Hẹn giờ, kịch bản, điều khiển từ xa'],
    // ----- Lắp đặt -----
    'KIỂU LẮP ĐẶT':         ['kieu_lap_dat', 'Kiểu lắp đặt', 'sel', ''],
    'SỐ MODULE CHIẾM (ô)':  ['so_module', 'Số module chiếm (ô)', 'text', 'VD: 1'],
    'CHIỀU RỘNG MẶT (mm)':  ['rong_mm', 'Chiều rộng mặt (mm)', 'text', 'VD: 86'],
    'CHIỀU CAO MẶT (mm)':   ['cao_mm', 'Chiều cao mặt (mm)', 'text', 'VD: 86'],
    'ĐỘ DÀY / ĐỘ NHÔ MẶT (mm)': ['sau_mm', 'Độ dày / độ nhô mặt (mm)', 'text', 'VD: 9'],
    'LOẠI ĐẾ TƯƠNG THÍCH':  ['loai_de', 'Loại đế tương thích', 'text', 'VD: Đế âm vuông 86 x 86'],
    'ĐỘ SÂU HỘP ÂM TỐI THIỂU (mm)': ['sau_hop_am_mm', 'Độ sâu hộp âm tối thiểu (mm)', 'text', 'VD: 35'],
    'TIẾT DIỆN DÂY TỐI ĐA (mm²)': ['tiet_dien_day', 'Tiết diện dây tối đa (mm²)', 'text', 'VD: 2.5']
  };

  // ---- Danh sách chọn (sheet DANH MỤC) ----
  var CO_KHONG = ['Có', 'Không'];
  var OPT = {
    'LOẠI CẤU KIỆN': ['Thiết bị liền mặt (nguyên bộ)', 'Hạt / nhân thiết bị', 'Mặt che (faceplate)', 'Đế âm', 'Đế nổi', 'Phụ kiện khác'],
    'MÀU SẮC': ['Trắng', 'Trắng sữa', 'Kem / ngà', 'Vàng champagne', 'Vàng đồng', 'Bạc / inox', 'Xám', 'Đen', 'Đen nhám', 'Nâu', 'Khác'],
    'CHẤT LIỆU': ['Nhựa PC chống cháy', 'Nhựa ABS', 'Kính cường lực', 'Nhôm', 'Inox', 'Hợp kim kẽm', 'Khác'],
    'KIỂU CHẤU CẮM': ['2 chấu dẹt', '2 chấu tròn', '3 chấu (có tiếp địa)', 'Đa năng 2 & 3 chấu', 'Đa chuẩn (Universal)', 'Không áp dụng'],
    'CHỈ SỐ IP': ['IP20', 'IP44', 'IP54', 'IP55', 'IP66'],
    'VẬT LIỆU TIẾP ĐIỂM': ['Đồng thau', 'Đồng đỏ', 'Đồng mạ bạc', 'Hợp kim bạc', 'Khác'],
    'KIỂU LẮP ĐẶT': ['Âm tường', 'Nổi', 'Âm sàn', 'Âm bàn / mặt bàn', 'Khác'],
    'LOẠI ĐẦU TÍN HIỆU': ['Không', 'TV (đồng trục)', 'LAN Cat5e', 'LAN Cat6', 'Điện thoại RJ11', 'HDMI', 'VGA', 'Audio', 'Khác'],
    'GIAO THỨC KẾT NỐI': ['Không', 'Wi-Fi', 'Zigbee', 'Bluetooth Mesh', 'Matter', 'Z-Wave', 'RF 433MHz', 'Khác'],
    'KIỂU MẠCH / CHỨC NĂNG': ['1 chiều (1-way)', '2 chiều (2-way)', 'Trung gian (intermediate)', '2 cực (DP)', 'Nút nhấn (thường mở)', 'Điều chỉnh độ sáng (dimmer)', 'Điều tốc quạt', 'Khác'],
    'KIỂU THAO TÁC': ['Nút gạt (rocker)', 'Nút nhấn (push)', 'Cảm ứng (touch)', 'Xoay (rotary)', 'Cảm biến', 'Thẻ từ / chìa khoá phòng'],
    'ĐÈN BÁO': ['Không', 'Đèn báo xanh', 'Đèn báo đỏ', 'Đèn dạ quang (định vị)', 'Đèn nền LED'],
    'DÂY TRUNG TÍNH (N)': ['Cần dây N', 'Không cần dây N (2 dây)'],
    'LOẠI CẢM BIẾN': ['Không', 'PIR (hồng ngoại)', 'Radar vi sóng', 'Cảm biến ánh sáng', 'Hiện diện (mmWave)'],
    'CÓ MÀN CHE AN TOÀN': CO_KHONG, 'TÍCH HỢP THÔNG MINH': CO_KHONG
  };
  // gợi ý cho ô "Dòng sản phẩm" (gõ tự do được)
  var DONG_OC = ['Ổ cắm đơn 2 chấu', 'Ổ cắm đơn 3 chấu', 'Ổ cắm đôi 2 chấu', 'Ổ cắm đôi 3 chấu', 'Ổ cắm ba 3 chấu', 'Ổ cắm đa năng', 'Ổ cắm điện + USB',
    'Ổ cắm USB sạc', 'Ổ cắm TV', 'Ổ cắm mạng LAN', 'Ổ cắm điện thoại', 'Ổ cắm HDMI', 'Ổ cắm âm sàn / âm bàn', 'Ổ cắm thông minh'];
  var DONG_CT = ['Công tắc 1 nút 1 chiều', 'Công tắc 2 nút 1 chiều', 'Công tắc 3 nút 1 chiều', 'Công tắc 4 nút 1 chiều', 'Công tắc 1 nút 2 chiều', 'Công tắc 2 nút 2 chiều',
    'Công tắc trung gian', 'Công tắc 2 cực (DP) 20A', 'Công tắc thông minh', 'Công tắc cảm ứng', 'Dimmer đèn', 'Điều tốc quạt', 'Công tắc cảm biến', 'Nút nhấn chuông', 'Công tắc thẻ từ'];

  /* 4 khối của mỗi module — đúng thứ tự trong file (cột I · K · M · O của sheet Ổ CẮM / CÔNG TẮC) */
  var LAP = ['KIỂU LẮP ĐẶT', 'SỐ MODULE CHIẾM (ô)', 'CHIỀU RỘNG MẶT (mm)', 'CHIỀU CAO MẶT (mm)', 'ĐỘ DÀY / ĐỘ NHÔ MẶT (mm)', 'LOẠI ĐẾ TƯƠNG THÍCH',
    'ĐỘ SÂU HỘP ÂM TỐI THIỂU (mm)', 'TIẾT DIỆN DÂY TỐI ĐA (mm²)'];
  var OC = {      // Ổ CẮM
    chinh: ['LOẠI CẤU KIỆN', 'SỐ Ổ CẮM (ổ)', 'KIỂU CHẤU CẮM', 'MÀU SẮC', 'CHẤT LIỆU', 'CHỈ SỐ IP', 'CÓ MÀN CHE AN TOÀN', 'QUY CÁCH ĐÓNG GÓI (cái/hộp)'],
    dien: ['DÒNG ĐIỆN ĐỊNH MỨC (A)', 'ĐIỆN ÁP ĐỊNH MỨC (V)', 'CÔNG SUẤT TỐI ĐA (W)', 'TẦN SỐ (Hz)', 'VẬT LIỆU TIẾP ĐIỂM', 'KHẢ NĂNG CHỐNG CHÁY', 'TIÊU CHUẨN ÁP DỤNG', 'CHỨNG NHẬN'],
    tm: ['SỐ CỔNG USB-A', 'SỐ CỔNG USB-C', 'CÔNG SUẤT SẠC USB (W)', 'ĐIỆN ÁP / DÒNG RA USB', 'LOẠI ĐẦU TÍN HIỆU', 'TÍCH HỢP THÔNG MINH', 'GIAO THỨC KẾT NỐI'],
    lap: LAP, tenTm: 'USB / Tín hiệu / Thông minh',
    // 2 cột của bảng bóc tách / báo giá (cột Q:R và S:T trong sheet Ổ CẮM). '@BH' = bảo hành, '@KT' = kích thước mặt R x C x D
    ttc: ['LOẠI CẤU KIỆN', 'SỐ Ổ CẮM (ổ)', 'KIỂU CHẤU CẮM', 'MÀU SẮC', 'CHẤT LIỆU', '@BH'],
    tsk: ['DÒNG ĐIỆN ĐỊNH MỨC (A)', 'ĐIỆN ÁP ĐỊNH MỨC (V)', 'CÔNG SUẤT TỐI ĐA (W)', 'CHỈ SỐ IP', '@KT', 'LOẠI ĐẾ TƯƠNG THÍCH']
  };
  var CT = {      // CÔNG TẮC
    chinh: ['LOẠI CẤU KIỆN', 'SỐ NÚT (gang)', 'KIỂU MẠCH / CHỨC NĂNG', 'KIỂU THAO TÁC', 'MÀU SẮC', 'CHẤT LIỆU', 'ĐÈN BÁO', 'CHỈ SỐ IP', 'QUY CÁCH ĐÓNG GÓI (cái/hộp)'],
    dien: ['DÒNG ĐIỆN ĐỊNH MỨC (A)', 'ĐIỆN ÁP ĐỊNH MỨC (V)', 'CÔNG SUẤT TẢI TỐI ĐA (W)', 'CÔNG SUẤT TẢI TỐI THIỂU (W)', 'LOẠI TẢI PHÙ HỢP', 'TUỔI THỌ (lần thao tác)',
      'VẬT LIỆU TIẾP ĐIỂM', 'KHẢ NĂNG CHỐNG CHÁY', 'TIÊU CHUẨN ÁP DỤNG', 'CHỨNG NHẬN'],
    tm: ['TÍCH HỢP THÔNG MINH', 'GIAO THỨC KẾT NỐI', 'HỆ SINH THÁI TƯƠNG THÍCH', 'DÂY TRUNG TÍNH (N)', 'LOẠI CẢM BIẾN', 'TÍNH NĂNG THÔNG MINH'],
    lap: LAP, tenTm: 'Thông minh / điều khiển',
    ttc: ['LOẠI CẤU KIỆN', 'SỐ NÚT (gang)', 'KIỂU MẠCH / CHỨC NĂNG', 'KIỂU THAO TÁC', 'MÀU SẮC', '@BH'],
    tsk: ['DÒNG ĐIỆN ĐỊNH MỨC (A)', 'ĐIỆN ÁP ĐỊNH MỨC (V)', 'CÔNG SUẤT TẢI TỐI ĐA (W)', 'CHỈ SỐ IP', '@KT', 'GIAO THỨC KẾT NỐI']
  };

  function hm(M, dong, mau) {
    // chinh = khối "Thông tin chính"; tk = 3 khối còn lại (điện · thông minh · lắp đặt) — cùng tên trường với vs-spec / son-spec
    return { kem: [], loai: M === OC ? 'oc' : 'ct', nhom: M, dong: dong,
      chinh: M.chinh, tk: M.dien.concat(M.tm, M.lap),
      req: ['LOẠI CẤU KIỆN', 'MÀU SẮC'], opt: OPT, mau: mau };
  }
  function mauOC(dong, ten, ma, them) {
    return Object.assign({ 'DÒNG SẢN PHẨM': dong, 'TÊN SẢN PHẨM': ten, 'MÃ SẢN PHẨM': ma, 'LOẠI CẤU KIỆN': 'Thiết bị liền mặt (nguyên bộ)',
      'MÀU SẮC': 'Trắng', 'CHẤT LIỆU': 'Nhựa PC chống cháy', 'KIỂU LẮP ĐẶT': 'Âm tường', 'GIÁ BÁN LẺ': 185000, 'ĐƠN VỊ TÍNH': 'Cái' }, them || {});
  }
  /* Mỗi hạng mục: bộ thông số của module tương ứng + 1 dòng ví dụ cho file mẫu.
     ("Khác" có ở cả 2 module trong file gốc -> đặt tên riêng để hạng mục không trùng nhau giữa các ngành.) */
  var HM = {
    'Ổ cắm điện': hm(OC, DONG_OC, mauOC('Ổ cắm đôi 3 chấu', 'Ổ cắm đôi 3 chấu 16A', 'DEMO-OC2-3C-16A-W',
      { 'SỐ Ổ CẮM (ổ)': '2', 'KIỂU CHẤU CẮM': '3 chấu (có tiếp địa)', 'DÒNG ĐIỆN ĐỊNH MỨC (A)': '16', 'ĐIỆN ÁP ĐỊNH MỨC (V)': '250', 'CÓ MÀN CHE AN TOÀN': 'Có' })),
    'Ổ cắm sạc USB': hm(OC, DONG_OC, mauOC('Ổ cắm điện + USB', 'Ổ cắm đơn kèm USB-A + USB-C', 'DEMO-OC1-USB-W',
      { 'SỐ Ổ CẮM (ổ)': '1', 'KIỂU CHẤU CẮM': 'Đa năng 2 & 3 chấu', 'SỐ CỔNG USB-A': '1', 'SỐ CỔNG USB-C': '1', 'CÔNG SUẤT SẠC USB (W)': '20', 'GIÁ BÁN LẺ': 420000 })),
    'Ổ cắm tín hiệu (TV / LAN / Tel / HDMI)': hm(OC, DONG_OC, mauOC('Ổ cắm mạng LAN', 'Ổ cắm mạng LAN Cat6', 'DEMO-OC-LAN6-W',
      { 'KIỂU CHẤU CẮM': 'Không áp dụng', 'LOẠI ĐẦU TÍN HIỆU': 'LAN Cat6', 'GIÁ BÁN LẺ': 160000 })),
    'Ổ cắm âm sàn / âm bàn': hm(OC, DONG_OC, mauOC('Ổ cắm âm sàn / âm bàn', 'Ổ cắm âm sàn 3 module', 'DEMO-OC-AS3',
      { 'MÀU SẮC': 'Vàng đồng', 'CHẤT LIỆU': 'Hợp kim kẽm', 'KIỂU LẮP ĐẶT': 'Âm sàn', 'SỐ MODULE CHIẾM (ô)': '3', 'GIÁ BÁN LẺ': 950000 })),
    'Ổ cắm thông minh': hm(OC, DONG_OC, mauOC('Ổ cắm thông minh', 'Ổ cắm thông minh Zigbee 16A', 'DEMO-OC-ZB-W',
      { 'SỐ Ổ CẮM (ổ)': '1', 'KIỂU CHẤU CẮM': 'Đa năng 2 & 3 chấu', 'TÍCH HỢP THÔNG MINH': 'Có', 'GIAO THỨC KẾT NỐI': 'Zigbee', 'GIÁ BÁN LẺ': 690000 })),
    'Ổ cắm khác': hm(OC, DONG_OC, mauOC('Ổ cắm đa năng', 'Ổ cắm đa năng', 'DEMO-OC-K')),
    'Công tắc cơ': hm(CT, DONG_CT, mauOC('Công tắc 2 nút 1 chiều', 'Công tắc 2 nút 1 chiều 16A', 'DEMO-CT2-1C-16A-W',
      { 'SỐ NÚT (gang)': '2', 'KIỂU MẠCH / CHỨC NĂNG': '1 chiều (1-way)', 'KIỂU THAO TÁC': 'Nút gạt (rocker)', 'DÒNG ĐIỆN ĐỊNH MỨC (A)': '16', 'ĐIỆN ÁP ĐỊNH MỨC (V)': '250', 'GIÁ BÁN LẺ': 95000 })),
    'Công tắc cảm ứng': hm(CT, DONG_CT, mauOC('Công tắc cảm ứng', 'Công tắc cảm ứng 3 nút mặt kính', 'DEMO-CT3-CU-B',
      { 'SỐ NÚT (gang)': '3', 'KIỂU THAO TÁC': 'Cảm ứng (touch)', 'MÀU SẮC': 'Đen', 'CHẤT LIỆU': 'Kính cường lực', 'ĐÈN BÁO': 'Đèn nền LED', 'GIÁ BÁN LẺ': 780000 })),
    'Công tắc thông minh': hm(CT, DONG_CT, mauOC('Công tắc thông minh', 'Công tắc thông minh 3 nút Zigbee', 'DEMO-CT3-ZB-B',
      { 'SỐ NÚT (gang)': '3', 'KIỂU THAO TÁC': 'Cảm ứng (touch)', 'TÍCH HỢP THÔNG MINH': 'Có', 'GIAO THỨC KẾT NỐI': 'Zigbee', 'DÂY TRUNG TÍNH (N)': 'Cần dây N', 'GIÁ BÁN LẺ': 1250000 })),
    'Dimmer / điều tốc quạt': hm(CT, DONG_CT, mauOC('Dimmer đèn', 'Dimmer đèn LED 300W', 'DEMO-DIM-300-W',
      { 'KIỂU MẠCH / CHỨC NĂNG': 'Điều chỉnh độ sáng (dimmer)', 'KIỂU THAO TÁC': 'Xoay (rotary)', 'CÔNG SUẤT TẢI TỐI ĐA (W)': '300', 'CÔNG SUẤT TẢI TỐI THIỂU (W)': '5', 'GIÁ BÁN LẺ': 520000 })),
    'Công tắc cảm biến': hm(CT, DONG_CT, mauOC('Công tắc cảm biến', 'Công tắc cảm biến chuyển động PIR', 'DEMO-CT-PIR-W',
      { 'KIỂU THAO TÁC': 'Cảm biến', 'LOẠI CẢM BIẾN': 'PIR (hồng ngoại)', 'GIÁ BÁN LẺ': 480000 })),
    'Nút nhấn / chuông': hm(CT, DONG_CT, mauOC('Nút nhấn chuông', 'Nút nhấn chuông', 'DEMO-NN-CHUONG-W',
      { 'SỐ NÚT (gang)': '1', 'KIỂU MẠCH / CHỨC NĂNG': 'Nút nhấn (thường mở)', 'KIỂU THAO TÁC': 'Nút nhấn (push)', 'GIÁ BÁN LẺ': 85000 })),
    'Công tắc thẻ từ / chìa khoá phòng': hm(CT, DONG_CT, mauOC('Công tắc thẻ từ', 'Công tắc thẻ từ 30A', 'DEMO-CT-THE-W',
      { 'KIỂU THAO TÁC': 'Thẻ từ / chìa khoá phòng', 'DÒNG ĐIỆN ĐỊNH MỨC (A)': '30', 'GIÁ BÁN LẺ': 650000 })),
    'Công tắc khác': hm(CT, DONG_CT, mauOC('Công tắc 1 nút 1 chiều', 'Công tắc 1 nút 1 chiều', 'DEMO-CT-K', { 'SỐ NÚT (gang)': '1', 'GIÁ BÁN LẺ': 60000 }))
  };
  var HANG_MUC = Object.keys(HM);
  // Trường CHUNG của mọi SP công tắc - ổ cắm — cột nào ngoài CHUNG + thông số của hạng mục đều bị bỏ khi nhập
  var CHUNG = ['THƯƠNG HIỆU', 'NHÀ CUNG CẤP', 'HẠNG MỤC', 'DÒNG SẢN PHẨM', 'NHÓM SẢN PHẨM', 'TÊN SẢN PHẨM', 'MÃ SẢN PHẨM',
    'GIÁ BÁN LẺ', 'CHIẾT KHẤU ĐẠI LÝ (%)', 'TÍNH NĂNG', 'BẢO HÀNH (năm)', 'ĐƠN VỊ TÍNH', 'TRẠNG THÁI',
    'LINK DATASHEET', 'THÔNG SỐ KỸ THUẬT', 'HƯỚNG DẪN CÀI ĐẶT', 'FILE BẢN VẼ', 'GHI CHÚ', 'ẢNH SẢN PHẨM', 'NGÀNH HÀNG'];

  function bo_dau(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function chuanHM(v) {
    var k = bo_dau(v); if (!k) return '';
    for (var i = 0; i < HANG_MUC.length; i++) if (bo_dau(HANG_MUC[i]) === k) return HANG_MUC[i];
    return '';
  }
  // Hạng mục ghi CHUNG ("Công tắc - ổ cắm", "Ổ cắm", "Công tắc"…) chứ không phải 1 trong 14 hạng mục con -> vẫn là ngành ct
  function laChung(v) { var k = bo_dau(v); return !!k && !chuanHM(v) && /(cong tac|o cam|dimmer)/.test(k) && !/den|phu kien/.test(k); }
  // Đoán hạng mục con theo TÊN SP khi hạng mục chỉ ghi chung (thứ tự quy tắc: cụ thể trước, chung sau)
  var DOAN = [
    [/the tu|chia khoa|khoa the|the phong|ngat dien bang the/, 'Công tắc thẻ từ / chìa khoá phòng'],
    [/dimmer|chiet ap|dieu toc|dieu chinh do sang/, 'Dimmer / điều tốc quạt'],
    [/cam bien|hong ngoai|radar|chuyen dong/, 'Công tắc cảm biến'],
    [/chuong|nut nhan|khong lam phien|don phong/, 'Nút nhấn / chuông'],
    [/am san|am ban/, 'Ổ cắm âm sàn / âm bàn'],
    [/o cam.*(thong minh|wifi|zigbee|smart)|(thong minh|wifi|zigbee|smart).*o cam/, 'Ổ cắm thông minh'],
    [/thong minh|wifi|zigbee|smart/, 'Công tắc thông minh'],
    [/cam ung|touch/, 'Công tắc cảm ứng'],
    [/o cam.*(usb|sac)|(usb|sac).*o cam|\busb\b/, 'Ổ cắm sạc USB'],
    [/o cam.*(tv|lan|mang|dien thoai|tel|hdmi|rj45|tin hieu|data)|o (tv|mang|dien thoai|hdmi|data)/, 'Ổ cắm tín hiệu (TV / LAN / Tel / HDMI)'],
    [/o cam/, 'Ổ cắm điện'],
    [/cong tac/, 'Công tắc cơ']
  ];
  function doanHM(hm, ten) {
    var c = chuanHM(hm); if (c) return c;
    var t = bo_dau(ten);
    for (var i = 0; i < DOAN.length; i++) if (DOAN[i][0].test(t)) return DOAN[i][1];
    return /o cam/.test(bo_dau(hm)) && !/cong tac/.test(bo_dau(hm)) ? 'Ổ cắm khác' : 'Công tắc khác';
  }
  function hmOf(v) { return HM[chuanHM(v)] || null; }
  var ALL = Object.keys(METRIC);
  function labelsOf(v) { var h = hmOf(v); return h ? h.chinh.concat(h.tk) : ALL.slice(); }
  function gom(k) {
    var out = [];
    HANG_MUC.forEach(function (x) { HM[x][k].forEach(function (lb) { if (out.indexOf(lb) < 0) out.push(lb); }); });
    return out;
  }
  var CHINH_ALL = gom('chinh'), TK_ALL = gom('tk').filter(function (lb) { return CHINH_ALL.indexOf(lb) < 0; });
  function optsOf(v, lb) { var h = hmOf(v); return (h && h.opt[lb]) || OPT[lb] || []; }
  function isReq(v, lb) { var h = hmOf(v); return !!(h && h.req.indexOf(lb) >= 0); }
  /* Giá trị 1 dòng "nhãn: giá trị" cho bảng / panel. get(col) trả giá trị thô của cột DB.
     '@BH' = Thời gian bảo hành · '@KT' = Kích thước mặt R x C x D (ghép 3 cột). */
  function dong(lb, get) {
    if (lb === '@BH') { var bh = String(get('bao_hanh_nam') || '').trim(); return bh && bh !== '0' ? ['Bảo hành', bh + ' năm'] : null; }
    if (lb === '@KT') {
      var kt = ['rong_mm', 'cao_mm', 'sau_mm'].map(function (c) { return String(get(c) == null ? '' : get(c)).trim(); });
      return kt.some(Boolean) ? ['Kích thước mặt (R x C x D)', kt.map(function (x) { return x || '—'; }).join(' x ') + ' mm'] : null;
    }
    var m = METRIC[lb]; if (!m) return null;
    var v = String(get(m[0]) == null ? '' : get(m[0])).trim();
    return v ? [m[1], v] : null;
  }

  var api = { METRIC: METRIC, HM: HM, HANG_MUC: HANG_MUC, ALL: ALL, CHUNG: CHUNG, OPT: OPT,
    gom: gom, CHINH_ALL: CHINH_ALL, TK_ALL: TK_ALL,
    chuanHM: chuanHM, laChung: laChung, doanHM: doanHM, hmOf: hmOf, labelsOf: labelsOf, optsOf: optsOf, isReq: isReq, dong: dong,
    MUC: 'Công tắc - ổ cắm',                      // tên đề mục 3.2.6.2 trên cây
    VD: '[VÍ DỤ]' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CT_SPEC = api;
})(typeof window !== 'undefined' ? window : this);
