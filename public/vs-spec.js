/* ═══ THIẾT BỊ VỆ SINH — BỘ THÔNG SỐ THEO TỪNG HẠNG MỤC (nguồn DUY NHẤT) ═══
   Dùng chung cho:
     · Form Nhập dữ liệu / modal Sửa SP (public/app.js)  -> chỉ hiện thông số của hạng mục đang chọn
     · File mẫu nhập hàng loạt (server tạo động /mau-nhap-thiet-bi-ve-sinh.xlsx) -> 1 sheet / hạng mục
     · Server (store_supa) -> map cột DB, lọc thông số khi nhập, ghép cột "Thông tin chính" /
       "Thông số thiết kế" cho bảng bóc tách & báo giá
   Sửa danh sách ở ĐÂY là cả 3 nơi đổi theo -> không còn lệch nhau.
   Cột DB mới: db/thiet_bi_ve_sinh_v2.sql                                                  */
(function (root) {
  'use strict';
  // Nhãn cột (cũng là tiêu đề cột trong file Excel) -> [cột DB, nhãn hiển thị, kiểu, gợi ý nhập]
  // kiểu: 'text' | 'sel' (có danh sách chọn — danh sách đặt theo từng hạng mục bên dưới) | 'area'
  var METRIC = {
    'MÀU SẮC':              ['mau_sac', 'Màu sắc', 'sel', 'VD: Trắng mờ'],
    'KIỂU LẮP ĐẶT':         ['kieu_lap_dat', 'Kiểu lắp đặt', 'sel', ''],
    'CHẤT LIỆU':            ['chat_lieu', 'Chất liệu', 'sel', ''],
    'THIẾT KẾ':             ['thiet_ke', 'Thiết kế', 'text', 'VD: Thân kín, dáng chữ D'],
    'HỆ THỐNG XẢ':          ['he_thong_xa', 'Hệ thống xả', 'sel', ''],
    'LOẠI NẮP':             ['loai_nap', 'Loại nắp', 'sel', ''],
    'LOẠI VÒI':             ['loai_voi', 'Loại vòi', 'sel', ''],
    'LOẠI SEN':             ['loai_sen', 'Loại sen', 'sel', ''],
    'KIỂU ĐIỀU KHIỂN':      ['kieu_dieu_khien', 'Kiểu điều khiển', 'sel', ''],
    'CHỨC NĂNG MASSAGE':    ['massage', 'Chức năng massage', 'sel', ''],
    'SỐ HỐ':                ['so_ho', 'Số hố', 'sel', ''],
    'KÍCH THƯỚC':           ['kich_thuoc', 'Kích thước', 'text', 'VD: L580 x W380 x H335 (mm)'],
    'LƯỢNG NƯỚC XẢ':        ['luong_nuoc_xa', 'Lượng nước xả', 'text', 'VD: 4.5/3L'],
    'TÂM XẢ':               ['tam_xa', 'Tâm xả', 'text', 'VD: 305 mm'],
    'ÁP LỰC NƯỚC':          ['ap_luc_nuoc', 'Áp lực nước', 'text', 'VD: 0.05 ~ 0.75 MPa'],
    'LƯU LƯỢNG NƯỚC':       ['luu_luong', 'Lưu lượng nước', 'text', 'VD: 6 L/phút'],
    'LÕI VAN':              ['loi_van', 'Lõi van', 'text', 'VD: Lõi đĩa sứ 35mm'],
    'KÍCH THƯỚC BÁT SEN':   ['bat_sen', 'Kích thước bát sen', 'text', 'VD: Ø250 mm'],
    'CHẾ ĐỘ PHUN':          ['che_do_phun', 'Chế độ phun', 'text', 'VD: 3 chế độ'],
    'SỐ LỖ VÒI':            ['so_lo_voi', 'Số lỗ vòi', 'sel', ''],
    'XẢ TRÀN':              ['xa_tran', 'Lỗ xả tràn', 'sel', ''],
    'DUNG TÍCH':            ['dung_tich', 'Dung tích', 'text', 'VD: 220 L'],
    'NGUỒN ĐIỆN':           ['nguon_dien', 'Nguồn điện', 'text', 'VD: 220V/50Hz – 1.200W'],
    'BỒN CẦU TƯƠNG THÍCH':  ['bon_cau_tuong_thich', 'Bồn cầu tương thích', 'text', 'VD: Bồn cầu 1 khối, dáng D, dài 480–520mm'],
    'ĐỘ DÀY':               ['do_day', 'Độ dày', 'text', 'VD: 1.2 mm'],
    'BỀ MẶT HOÀN THIỆN':    ['be_mat', 'Bề mặt hoàn thiện', 'sel', ''],
    'LƯU Ý':                ['luu_y', 'Lưu ý', 'text', 'VD: Không kết hợp với van xả trực tiếp']
  };

  var MAU = ['Trắng', 'Trắng mờ', 'Đen', 'Đen mờ', 'Xám', 'Be'];
  var MAU_KL = ['Chrome', 'Vàng', 'Vàng hồng', 'Đen mờ', 'Nickel xước', 'Trắng'];
  var BM_SU = ['Men sứ thường', 'Men sứ chống bám bẩn', 'Men sứ kháng khuẩn'];
  var BM_KL = ['Xi mạ Chrome', 'PVD vàng', 'PVD vàng hồng', 'Sơn tĩnh điện đen', 'Nickel xước', 'Inox xước'];
  var CL_KL = ['Đồng thau', 'Inox 304', 'Hợp kim kẽm', 'Nhựa ABS'];
  var CO_KHONG = ['Có', 'Không'];

  /* Mỗi hạng mục: chinh = khối "Key Product Info (Thông tin chính)", tk = "Thông số thiết kế",
     req = thông số BẮT BUỘC, opt = danh sách chọn riêng của hạng mục, mau = 1 dòng ví dụ trong file mẫu,
     kem = hạng mục thường bán/lắp CÙNG (gợi ý sản phẩm đi kèm - combo). */
  var HM = {
    'Bồn cầu': {
      kem: ['Nắp rửa điện tử', 'Phụ kiện vệ sinh'],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'HỆ THỐNG XẢ', 'LOẠI NẮP', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'LƯỢNG NƯỚC XẢ', 'TÂM XẢ', 'ÁP LỰC NƯỚC', 'BỀ MẶT HOÀN THIỆN', 'LƯU Ý'],
      req: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'KÍCH THƯỚC', 'LƯỢNG NƯỚC XẢ'],
      opt: { 'MÀU SẮC': MAU, 'KIỂU LẮP ĐẶT': ['Một khối', 'Hai khối', 'Treo tường', 'Đặt sàn'],
             'HỆ THỐNG XẢ': ['Tornado', 'Xoáy', 'Xả thẳng', 'Washdown', 'Siphon'],
             'LOẠI NẮP': ['Nắp đóng êm', 'Nắp thường', 'Nắp rửa điện tử', 'Không kèm nắp'], 'BỀ MẶT HOÀN THIỆN': BM_SU },
      mau: { 'DÒNG SẢN PHẨM': 'Bồn cầu một khối', 'TÊN SẢN PHẨM': 'Bồn cầu một khối nắp đóng êm', 'MÃ SẢN PHẨM': 'MS885DT8',
             'MÀU SẮC': 'Trắng', 'KIỂU LẮP ĐẶT': 'Một khối', 'HỆ THỐNG XẢ': 'Tornado', 'LOẠI NẮP': 'Nắp đóng êm', 'THIẾT KẾ': 'Thân kín, dáng chữ D',
             'KÍCH THƯỚC': 'L710 x W400 x H700 (mm)', 'LƯỢNG NƯỚC XẢ': '4.8/3L', 'TÂM XẢ': '305 mm', 'ÁP LỰC NƯỚC': '0.05 ~ 0.75 MPa',
             'BỀ MẶT HOÀN THIỆN': 'Men sứ chống bám bẩn', 'GIÁ BÁN LẺ': 12500000, 'ĐƠN VỊ TÍNH': 'Bộ' }
    },
    'Nắp rửa điện tử': {
      kem: ['Bồn cầu'],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'KIỂU ĐIỀU KHIỂN', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'NGUỒN ĐIỆN', 'ÁP LỰC NƯỚC', 'BỒN CẦU TƯƠNG THÍCH', 'LƯU Ý'],
      req: ['MÀU SẮC', 'KÍCH THƯỚC', 'NGUỒN ĐIỆN'],
      opt: { 'MÀU SẮC': MAU, 'KIỂU ĐIỀU KHIỂN': ['Remote', 'Bảng điều khiển bên hông', 'Remote + ứng dụng điện thoại'] },
      mau: { 'DÒNG SẢN PHẨM': 'Nắp rửa điện tử Washlet', 'TÊN SẢN PHẨM': 'Nắp rửa điện tử Washlet C2', 'MÃ SẢN PHẨM': 'TCF23410AAA',
             'MÀU SẮC': 'Trắng', 'KIỂU ĐIỀU KHIỂN': 'Bảng điều khiển bên hông', 'KÍCH THƯỚC': 'L520 x W470 x H136 (mm)',
             'NGUỒN ĐIỆN': '220V/50Hz – 1.200W', 'ÁP LỰC NƯỚC': '0.07 ~ 0.75 MPa', 'TÍNH NĂNG': '• Rửa vệ sinh\n• Sấy khô\n• Sưởi ấm bệ ngồi',
             'GIÁ BÁN LẺ': 9800000, 'ĐƠN VỊ TÍNH': 'Cái' }
    },
    'Lavabo': {
      kem: ['Vòi lavabo', 'Phụ kiện vệ sinh'],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'CHẤT LIỆU', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'SỐ LỖ VÒI', 'XẢ TRÀN', 'BỀ MẶT HOÀN THIỆN', 'LƯU Ý'],
      req: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'KÍCH THƯỚC'],
      opt: { 'MÀU SẮC': MAU, 'KIỂU LẮP ĐẶT': ['Đặt bàn', 'Âm bàn', 'Bán âm', 'Treo tường', 'Chân đứng', 'Chân lửng'],
             'CHẤT LIỆU': ['Sứ', 'Đá nhân tạo', 'Đá tự nhiên', 'Kính'], 'SỐ LỖ VÒI': ['0 lỗ', '1 lỗ', '3 lỗ'], 'XẢ TRÀN': CO_KHONG, 'BỀ MẶT HOÀN THIỆN': BM_SU },
      mau: { 'DÒNG SẢN PHẨM': 'Lavabo đặt bàn', 'TÊN SẢN PHẨM': 'Lavabo đặt bàn dáng tròn', 'MÃ SẢN PHẨM': 'LW895JW',
             'MÀU SẮC': 'Trắng', 'KIỂU LẮP ĐẶT': 'Đặt bàn', 'CHẤT LIỆU': 'Sứ', 'KÍCH THƯỚC': 'Ø420 x H155 (mm)',
             'SỐ LỖ VÒI': '0 lỗ', 'XẢ TRÀN': 'Không', 'GIÁ BÁN LẺ': 3200000, 'ĐƠN VỊ TÍNH': 'Cái' }
    },
    'Vòi lavabo': {
      kem: ['Lavabo'],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'LOẠI VÒI', 'KIỂU LẮP ĐẶT', 'CHẤT LIỆU', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'LƯU LƯỢNG NƯỚC', 'ÁP LỰC NƯỚC', 'LÕI VAN', 'BỀ MẶT HOÀN THIỆN', 'LƯU Ý'],
      req: ['MÀU SẮC', 'LOẠI VÒI', 'KIỂU LẮP ĐẶT'],
      opt: { 'MÀU SẮC': MAU_KL, 'LOẠI VÒI': ['Nóng lạnh', 'Chỉ lạnh', 'Cảm ứng', 'Ổn định nhiệt'],
             'KIỂU LẮP ĐẶT': ['Gắn chậu', 'Gắn tường', 'Gắn bàn'], 'CHẤT LIỆU': CL_KL, 'BỀ MẶT HOÀN THIỆN': BM_KL },
      mau: { 'DÒNG SẢN PHẨM': 'Vòi lavabo nóng lạnh', 'TÊN SẢN PHẨM': 'Vòi lavabo nóng lạnh thân cao', 'MÃ SẢN PHẨM': 'TLG02307B',
             'MÀU SẮC': 'Chrome', 'LOẠI VÒI': 'Nóng lạnh', 'KIỂU LẮP ĐẶT': 'Gắn chậu', 'CHẤT LIỆU': 'Đồng thau',
             'KÍCH THƯỚC': 'H305 x L150 (mm)', 'LƯU LƯỢNG NƯỚC': '5 L/phút', 'LÕI VAN': 'Lõi đĩa sứ 35mm',
             'BỀ MẶT HOÀN THIỆN': 'Xi mạ Chrome', 'GIÁ BÁN LẺ': 4100000, 'ĐƠN VỊ TÍNH': 'Bộ' }
    },
    'Sen tắm': {
      kem: ['Bồn tắm', 'Phụ kiện vệ sinh'],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'LOẠI SEN', 'KIỂU LẮP ĐẶT', 'CHẤT LIỆU', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'KÍCH THƯỚC BÁT SEN', 'CHẾ ĐỘ PHUN', 'LƯU LƯỢNG NƯỚC', 'ÁP LỰC NƯỚC', 'LÕI VAN', 'BỀ MẶT HOÀN THIỆN', 'LƯU Ý'],
      req: ['MÀU SẮC', 'LOẠI SEN', 'KÍCH THƯỚC BÁT SEN'],
      opt: { 'MÀU SẮC': MAU_KL, 'LOẠI SEN': ['Sen cây nóng lạnh', 'Sen cây ổn định nhiệt', 'Sen tắm nóng lạnh', 'Sen âm tường', 'Tay sen', 'Bát sen gắn trần'],
             'KIỂU LẮP ĐẶT': ['Gắn tường', 'Âm tường', 'Gắn trần'], 'CHẤT LIỆU': CL_KL, 'BỀ MẶT HOÀN THIỆN': BM_KL },
      mau: { 'DÒNG SẢN PHẨM': 'Sen cây', 'TÊN SẢN PHẨM': 'Sen cây nóng lạnh bát tròn', 'MÃ SẢN PHẨM': 'TBW01010B',
             'MÀU SẮC': 'Chrome', 'LOẠI SEN': 'Sen cây nóng lạnh', 'KIỂU LẮP ĐẶT': 'Gắn tường', 'CHẤT LIỆU': 'Đồng thau',
             'KÍCH THƯỚC': 'H1.150 x L480 (mm)', 'KÍCH THƯỚC BÁT SEN': 'Ø250 mm', 'CHẾ ĐỘ PHUN': '1 chế độ bát + 3 chế độ tay sen',
             'LƯU LƯỢNG NƯỚC': '9 L/phút', 'BỀ MẶT HOÀN THIỆN': 'Xi mạ Chrome', 'GIÁ BÁN LẺ': 15600000, 'ĐƠN VỊ TÍNH': 'Bộ' }
    },
    'Bồn tắm': {
      kem: ['Sen tắm', 'Phụ kiện vệ sinh'],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'CHẤT LIỆU', 'CHỨC NĂNG MASSAGE', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'DUNG TÍCH', 'XẢ TRÀN', 'NGUỒN ĐIỆN', 'LƯU Ý'],
      req: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'CHẤT LIỆU', 'KÍCH THƯỚC'],
      opt: { 'MÀU SẮC': MAU, 'KIỂU LẮP ĐẶT': ['Đặt sàn độc lập', 'Xây âm', 'Có yếm', 'Góc'],
             'CHẤT LIỆU': ['Acrylic', 'Gang tráng men', 'Đá nhân tạo', 'Composite'],
             'CHỨC NĂNG MASSAGE': ['Không', 'Sục khí', 'Sục nước', 'Sục khí + nước'], 'XẢ TRÀN': CO_KHONG },
      mau: { 'DÒNG SẢN PHẨM': 'Bồn tắm đặt sàn', 'TÊN SẢN PHẨM': 'Bồn tắm acrylic đặt sàn 1m7', 'MÃ SẢN PHẨM': 'PAY1770HPW',
             'MÀU SẮC': 'Trắng', 'KIỂU LẮP ĐẶT': 'Đặt sàn độc lập', 'CHẤT LIỆU': 'Acrylic', 'CHỨC NĂNG MASSAGE': 'Không',
             'KÍCH THƯỚC': 'L1.700 x W800 x H600 (mm)', 'DUNG TÍCH': '230 L', 'XẢ TRÀN': 'Có', 'GIÁ BÁN LẺ': 28000000, 'ĐƠN VỊ TÍNH': 'Cái' }
    },
    'Bồn tiểu': {
      kem: ['Phụ kiện vệ sinh'],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'HỆ THỐNG XẢ', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'LƯỢNG NƯỚC XẢ', 'ÁP LỰC NƯỚC', 'NGUỒN ĐIỆN', 'LƯU Ý'],
      req: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'HỆ THỐNG XẢ', 'KÍCH THƯỚC'],
      opt: { 'MÀU SẮC': MAU, 'KIỂU LẮP ĐẶT': ['Treo tường', 'Đặt sàn'],
             'HỆ THỐNG XẢ': ['Van cảm ứng', 'Van nhấn', 'Không dùng nước'] },
      mau: { 'DÒNG SẢN PHẨM': 'Bồn tiểu treo tường', 'TÊN SẢN PHẨM': 'Bồn tiểu nam treo tường cảm ứng', 'MÃ SẢN PHẨM': 'UWN924RB',
             'MÀU SẮC': 'Trắng', 'KIỂU LẮP ĐẶT': 'Treo tường', 'HỆ THỐNG XẢ': 'Van cảm ứng', 'KÍCH THƯỚC': 'L340 x W360 x H625 (mm)',
             'LƯỢNG NƯỚC XẢ': '0.8 L', 'NGUỒN ĐIỆN': 'Pin 6V', 'GIÁ BÁN LẺ': 8900000, 'ĐƠN VỊ TÍNH': 'Bộ' }
    },
    'Chậu rửa': {
      kem: ['Phụ kiện vệ sinh'],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'KIỂU LẮP ĐẶT', 'CHẤT LIỆU', 'SỐ HỐ', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'ĐỘ DÀY', 'SỐ LỖ VÒI', 'BỀ MẶT HOÀN THIỆN', 'LƯU Ý'],
      req: ['KIỂU LẮP ĐẶT', 'CHẤT LIỆU', 'SỐ HỐ', 'KÍCH THƯỚC'],
      opt: { 'MÀU SẮC': ['Inox', 'Đen', 'Xám', 'Trắng', 'Be'], 'KIỂU LẮP ĐẶT': ['Âm bàn', 'Dương bàn', 'Bán âm'],
             'CHẤT LIỆU': ['Inox 304', 'Đá granite', 'Sứ'], 'SỐ HỐ': ['1 hố', '2 hố', '1 hố + bàn chờ', '2 hố + bàn chờ'],
             'SỐ LỖ VÒI': ['0 lỗ', '1 lỗ', '2 lỗ'], 'BỀ MẶT HOÀN THIỆN': ['Inox xước', 'Inox bóng', 'Phủ nano', 'Men sứ'] },
      mau: { 'DÒNG SẢN PHẨM': 'Chậu rửa bát inox', 'TÊN SẢN PHẨM': 'Chậu rửa bát inox 2 hố âm bàn', 'MÃ SẢN PHẨM': 'CR-8245',
             'MÀU SẮC': 'Inox', 'KIỂU LẮP ĐẶT': 'Âm bàn', 'CHẤT LIỆU': 'Inox 304', 'SỐ HỐ': '2 hố',
             'KÍCH THƯỚC': 'L820 x W450 x H220 (mm)', 'ĐỘ DÀY': '1.2 mm', 'SỐ LỖ VÒI': '1 lỗ', 'GIÁ BÁN LẺ': 5400000, 'ĐƠN VỊ TÍNH': 'Cái' }
    },
    'Phụ kiện vệ sinh': {
      kem: [],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'CHẤT LIỆU', 'KIỂU LẮP ĐẶT', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'BỀ MẶT HOÀN THIỆN', 'LƯU Ý'],
      req: ['MÀU SẮC', 'CHẤT LIỆU'],
      opt: { 'MÀU SẮC': MAU_KL, 'CHẤT LIỆU': CL_KL.concat(['Kính cường lực', 'Sứ']), 'KIỂU LẮP ĐẶT': ['Gắn tường', 'Đặt bàn', 'Âm tường'], 'BỀ MẶT HOÀN THIỆN': BM_KL },
      mau: { 'DÒNG SẢN PHẨM': 'Thanh treo khăn', 'TÊN SẢN PHẨM': 'Thanh treo khăn đơn 600mm', 'MÃ SẢN PHẨM': 'YTT406BV',
             'MÀU SẮC': 'Chrome', 'CHẤT LIỆU': 'Đồng thau', 'KIỂU LẮP ĐẶT': 'Gắn tường', 'KÍCH THƯỚC': 'L600 (mm)',
             'BỀ MẶT HOÀN THIỆN': 'Xi mạ Chrome', 'GIÁ BÁN LẺ': 1250000, 'ĐƠN VỊ TÍNH': 'Cái' }
    },
    'Thiết bị khác': {
      kem: [],   // hạng mục gợi ý khi chọn SP đi kèm (combo)
      chinh: ['MÀU SẮC', 'CHẤT LIỆU', 'KIỂU LẮP ĐẶT', 'THIẾT KẾ'],
      tk: ['KÍCH THƯỚC', 'NGUỒN ĐIỆN', 'ÁP LỰC NƯỚC', 'LƯU Ý'],
      req: [],
      opt: {},
      mau: { 'DÒNG SẢN PHẨM': 'Máy sấy tay', 'TÊN SẢN PHẨM': 'Máy sấy tay tự động', 'MÃ SẢN PHẨM': 'TYC322W',
             'MÀU SẮC': 'Trắng', 'KIỂU LẮP ĐẶT': 'Gắn tường', 'KÍCH THƯỚC': 'L260 x W155 x H380 (mm)',
             'NGUỒN ĐIỆN': '220V/50Hz – 1.000W', 'GIÁ BÁN LẺ': 6900000, 'ĐƠN VỊ TÍNH': 'Cái' }
    }
  };
  var HANG_MUC = Object.keys(HM);

  // Hạng mục người dùng gõ (không dấu / hoa thường / thừa khoảng trắng) -> tên chuẩn; không khớp -> ''
  function bo_dau(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function chuanHM(v) {
    var k = bo_dau(v); if (!k) return '';
    for (var i = 0; i < HANG_MUC.length; i++) if (bo_dau(HANG_MUC[i]) === k) return HANG_MUC[i];
    return '';
  }
  function hmOf(v) { return HM[chuanHM(v)] || null; }
  // Toàn bộ nhãn thông số (theo thứ tự khai báo) — cho form/bảng khi CHƯA chọn hạng mục
  var ALL = Object.keys(METRIC);
  // Nhãn thông số áp dụng cho 1 hạng mục (chinh + tk), không khớp hạng mục -> tất cả
  function labelsOf(v) { var h = hmOf(v); return h ? h.chinh.concat(h.tk) : ALL.slice(); }
  function optsOf(v, lb) { var h = hmOf(v); return (h && h.opt[lb]) || []; }
  function isReq(v, lb) { var h = hmOf(v); return !!(h && h.req.indexOf(lb) >= 0); }

  var api = { METRIC: METRIC, HM: HM, HANG_MUC: HANG_MUC, ALL: ALL,
    chuanHM: chuanHM, hmOf: hmOf, labelsOf: labelsOf, optsOf: optsOf, isReq: isReq,
    // Tiền tố đánh dấu dòng ví dụ trong file mẫu — dòng có tên bắt đầu bằng chuỗi này bị bỏ qua khi nhập
    VD: '[VÍ DỤ]' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VS_SPEC = api;
})(typeof window !== 'undefined' ? window : this);
