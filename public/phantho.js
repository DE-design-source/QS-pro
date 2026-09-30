/* ═══ PHẦN THÔ (đề mục 3.1) + CÔNG TÁC XÂY DỰNG — mẫu khái toán, dự toán định mức, thư viện công tác,
   bảng phần thô (sửa, lọc, chọn, kéo dòng), form nhập / sửa công tác. Dữ liệu dự án: projData* ở app.js. ═══ */
'use strict';

/* ===================================================================
 * PHẦN THÔ — Bảng ước tính chi phí xây dựng thô (theo mẫu Excel)
 * mode: 'item'  -> đơn giá theo dòng, TT = KL × ĐG
 *       'area'  -> đơn giá theo cả mục (up); KL = DT × HS; TT mục = ΣKL × up
 *       'area0' -> KL = DT × HS nhưng "Chưa bao gồm" (TT = 0)
 *       'none'  -> gói, "Chưa bao gồm" (TT = 0)
 * =================================================================== */
/* Thư viện công tác PHẦN THÔ — sinh từ file báo giá Excel (Book1.xlsx), 15 nhóm / 156 công tác.
   Cột "Đơn giá cost" của file dùng cho CẢ đơn giá lẫn giá nhà thầu (file chưa có cột đề xuất). */
var PT_TEMPLATE=[
  {r:"I",t:"CÔNG TÁC CHUẨN BỊ",loai:'kt_chitiet',mode:'item',items:[
    ["Xin phép xây dựng","gói",1,0,"Phụ thuộc vào quy mô, vị trí xây dựng",0],
    ["Định vị ranh đất","điểm",1,1200000,"Dịch vụ",1200000],
    ["Xin cấp đồng hồ điện","gói",1,10000000,"Dịch vụ",10000000],
    ["Xin cấp đồng hồ nước","gói",1,5000000,"Dịch vụ",5000000],
    ["Tháo dỡ, múc móng nhà cũ, hút hầm phân","gói",1,0,"",0],
    ["Hàng rào tạm","m",1,80000,"Hàng rào tole phẳng",80000],
    ["Cổng công trình","cái",1,3000000,"Cửa cổng sắt ốp tole, xếp trượt",3000000],
    ["Nhà vệ sinh tạm","cái",1,18000000,"Nhà vệ sinh di động + bồn cầu + vòi nước",18000000],
    ["Tủ điện tạm","cái",1,1500000,"Tủ điện, MCB chống giật, ổ cắm",1500000],
    ["Khoan khảo sát địa chất","m",1,350000,"Đất cấp I-II-III, độ sâu hố khoan 30-40m, bao gồm thí nghiệm xuyên tiêu chuẩn SPT Không bao gồm thí nghiệm 9 chỉ tiêu cơ lý đất và thí nghiệm nén 3 trục",350000]
  ]},
  {r:"II",t:"Ép cọc",loai:'kt_chitiet',mode:'item',items:[
    ["Ép cọc BTCT 250x250, m300, tải 70T","m",1,260000,"",260000],
    ["Nhân công ép cọc BTCT tải 70T","m",1,70000,"Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)",70000],
    ["Nhân công ép cọc BTCT","tim",1,1200000,"Đơn giá cho dưới 20m/tim cọc (tùy địa chất khu vực)",1200000],
    ["Vận chuyển cọc trong hẻm nhỏ, hoặc hẻm cấm tải","m",1,40000,"Tăng bo, đẩy tay vào công trình (tùy thuộc vào chiều dài tuyến đường)",40000],
    ["Ép cọc ly tâm A300, PHC, tải 100T","m",1,360000,"",360000],
    ["Nhân công ép cọc ly tâm","m",1,80000,"Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)",80000],
    ["Nhân công ép cọc ly tâm","tim",1,1300000,"Đơn giá cho dưới 20m/tim cọc (tùy địa chất khu vực)",1300000]
  ]},
  {r:"III",t:"Biện pháp thi công hầm",loai:'kt_chitiet',mode:'item',items:[
    ["Ép cừ C200, cừ dài 4,5m (1 hệ shoring)","m",1,2800000,"Khối lượng tính theo chu vi hầm",2800000],
    ["Đào đất hầm","m3",1,0,"Nằm trong đơn giá thi công thô, không tính riêng",0],
    ["Cọc vây biện pháp D300 (cọc khoan nhồi)","m",1,480000,"Thi công trong trường hợp không ép cừ C, khoan cọc theo chu vi hầm",480000],
    ["Vận chuyển bùn đất đi đổ","m3",1,180000,"Bùn đất trong quá trình khoan cọc nhồi",180000]
  ]},
  {r:"IV",t:"Đơn giá xây dựng thô",loai:'kt_chitiet',mode:'item',items:[
    ["Xây dựng thô","m2",1,3050000,"Nhà phố chiều ngang 4m - 6m, hoàn thiện 2 mặt trước sau, đường trên 3m",3050000],
    ["Xây dựng thô","m2",1,3150000,"Nhà phố chiều ngang 6m - 8m, hoàn thiện 2 mặt trước sau, đường trên 3m",3150000],
    ["Xây dựng thô","m2",1,3200000,"Nhà phố chiều ngang 4m - 6m, hoàn thiện 3 - 4 mặt, đường trên 3m",3200000],
    ["Xây dựng thô","m2",1,3350000,"Nhà phố chiều ngang 6m - 8m, hoàn thiện 3- 4 mặt, đường trên 3m",3350000],
    ["Xây dựng trong hẻm nhỏ","m2",1,450000,"Hẻm nhỏ 2m - 2,5m, vận chuyển bằng xe ba gác hoặc hẻm cấm tải",450000],
    ["Nhân công hoàn thiện","m2",1,450000,"",450000]
  ]},
  {r:"V",t:"Đơn giá MEP âm",loai:'kt_chitiet',mode:'item',items:[
    ["Thi công MEP phần âm","m2",1,450000,"Không bao gồm hệ thống camera, điện lạnh, mạng Lan văn phòng, chống sét, đấu nối hệ thống thoát nước ra cống chung",450000],
    ["Nhân công hoàn thiện MEP","m2",1,200000,"Nhân công lắp đặt thiết bị điện, đèn chiếu sáng, thiết bị nước, thiết bị vệ sinh",200000]
  ]},
  {r:"VI",t:"Hệ số tính diện tích",loai:'kt_chitiet',mode:'area',up:3050000,items:[
    ["Móng đơn + đà kiềng","m2",0,0.3,""],
    ["Móng cọc + giằng móng","m2",0,0.5,""],
    ["Móng băng 1 phương","m2",0,0.5,""],
    ["Móng băng 2 phương","m2",0,0.7,""],
    ["Móng bè","m2",0,1,""],
    ["Hố pit thang máy","m2",0,1,""],
    ["Hầm sâu 1 - 1,3m tính từ vỉa hè","m2",0,1.5,""],
    ["Hầm sâu 1.3m - 1,7m tính từ vỉa hè","m2",0,1.7,""],
    ["Hầm sâu 1.7m - 2m tính từ vỉa hè","m2",0,2,""],
    ["Hầm sâu 2m - 2,5m tính từ vỉa hè","m2",0,2.5,""],
    ["Tầng 1","m2",0,1,""],
    ["Sân trước, sân sau","m2",0,0.5,""],
    ["Sân vườn","m2",0,0.5,""],
    ["Tầng lửng","m2",0,1,"Diện tích không tính ô thông tầng lửng"],
    ["Ô thông tầng lửng","m2",0,0.5,"Tính 0,5 do xung quanh ô thông tầng vẫn phải đổ dầm, xây tường, trát tường"],
    ["Tầng 2 ... (bao gồm ban công)","m2",0,1,""],
    ["Sân thượng có mái che","m2",0,1,""],
    ["Sân thượng không mái che","m2",0,0.5,""],
    ["Mái Tole","m2",0,0.3,"Tính theo diện tích mặt nghiêng"],
    ["Mái BTCT","m2",0,0.5,""],
    ["Mái ngói kèo sắt (hệ xà gồ, ngói lợp)","m2",0,0.7,"Tính theo diện tích mặt nghiêng"],
    ["Mái BTCT dán ngói","m2",0,1,"Tính theo diện tích mặt nghiêng"]
  ]},
  {r:"VII",t:"Xây tường, trát tường",loai:'kt_chitiet',mode:'item',items:[
    ["Tường xây 100mm, tường gạch ống, vữa xây M75","m2",1,310000,"",310000],
    ["Tường xây 200mm, tường gạch ống 5 lớp câu gạch đinh, vữa xây M75","m2",1,590000,"",590000],
    ["Đà lanh tô cửa đi 1 cánh (tường 100)","cái",1,300000,"Đà lanh tô đúc sẵn 1100mm",300000],
    ["Nẹp V góc tường, cạnh tường","md",1,30000,"Nẹp nhựa",30000],
    ["Đóng lưới thép đường điện, giáp mí bê tông - gạch","m",1,22000,"Lưới mắt cáo",22000],
    ["Trát tường ngoài vữa xi măng M75","m2",1,160000,"",160000],
    ["Trát tường trong vữa xi măng M75","m2",1,150000,"",150000],
    ["Trát cạnh tường / má cửa, bề rộng tường 100, vữa xi măng M75","m",1,76000,"",76000],
    ["Trát cạnh tường / má cửa, bề rộng tường 200, vữa xi măng M75","m",1,120000,"",120000]
  ]},
  {r:"VIII",t:"Chống thấm, cán nền",loai:'kt_chitiet',mode:'item',items:[
    ["Cán nền 3-5cm, vữa xi măng M75","m2",1,135000,"",135000],
    ["Chống thấm sàn, tường","m2",1,225000,"Chống thấm SIKA topseal 109 / Kova CT11A quét 2 lớp",225000]
  ]},
  {r:"IX",t:"Ốp lát gạch",loai:'kt_chitiet',mode:'item',items:[
    ["Nhân công lát gạch","m2",1,150000,"Gạch 300x600, 600x600",150000],
    ["Nhân công lát gạch","m2",1,180000,"Gạch 600x1200, 800x800, 900x900",180000],
    ["Nhân công ốp gạch","m2",1,160000,"Gạch 300x600, 600x600",160000],
    ["Nhân công ốp gạch","m2",1,190000,"Gạch 600x1200, 800x800, 900x900",190000],
    ["Keo dán gạch ngoại thất","m2",1,100000,"Webertai gres / Đơn giá vật tư",100000],
    ["Keo dán gạch nội thất","m2",1,70000,"Webertai vis, Webertai fix / Đơn giá vật tư",70000],
    ["Chà ron gạch khổ lớn","m2",1,120000,"Keo ron epoxy 2 thành phần Cetex / Saveto",120000],
    ["Chà ron gạch khổ nhỏ","m2",1,230000,"Keo ron epoxy 2 thành phần Cetex / Saveto",230000]
  ]},
  {r:"X",t:"Thạch cao",loai:'kt_chitiet',mode:'item',items:[
    ["Trần thạch cao khung chìm","m2",1,165000,"Khung xương Vĩnh Tường M29 ,tấm thạch cao Gyproc 9mm",165000],
    ["Trần thạch cao khung chìm chống ẩm","m2",1,175000,"Khung xương Vĩnh Tường M29 ,tấm thạch cao Gyproc 9mm chống ẩm",175000],
    ["Trần thạch cao khung chìm","m2",1,190000,"Khung xương Vĩnh Tường Tika ,tấm thạch cao Gyproc 9mm",190000],
    ["Trần thạch cao khung chìm chống ẩm","m2",1,200000,"Khung xương Vĩnh Tường Tika ,tấm thạch cao Gyproc 9mm chống ẩm",200000],
    ["Trần thạch cao khung chìm","m2",1,230000,"Khung xương Vĩnh Tường Alpha ,tấm thạch cao Gyproc 9mm",230000],
    ["Trần thạch cao khung chìm chống ẩm","m2",1,240000,"Khung xương Vĩnh Tường Alpha ,tấm thạch cao Gyproc 9mm chống ẩm",240000],
    ["Trần thạch cao khung chìm","m2",1,315000,"Khung xương Vĩnh Tường Basi ,tấm thạch cao Gyproc 9mm",315000],
    ["Trần thạch cao khung chìm chống ẩm","m2",1,325000,"Khung xương Vĩnh Tường Basi ,tấm thạch cao Gyproc 9mm chống ẩm",325000],
    ["Thanh shadowline","md",1,75000,"",75000],
    ["Vách thạch cao 1 mặt","m2",1,220000,"Xương U Vĩnh Tường ,tấm thạch cao Gyproc 9mm ốp 1 mặt",220000],
    ["Vách thạch cao 2 mặt","m2",1,320000,"Xương U Vĩnh Tường ,tấm thạch cao Gyproc 9mm ốp 2 mặt",320000],
    ["Vách thạch cao 2 mặt cách âm","m2",1,410000,"Xương U Vĩnh Tường ,tấm thạch cao Gyproc 9mm ốp 2 mặt, bông thủy tinh cách âm, cách nhiệt",410000],
    ["Nắp thăm trần 450x450","cái",1,350000,"Vĩnh Tường",350000],
    ["Nắp thăm trần 600x600","cái",1,450000,"Vĩnh Tường",450000]
  ]},
  {r:"XI",t:"Sơn nước",loai:'kt_chitiet',mode:'item',items:[
    ["Bả matit ngoại thất, bả 2 lớp","m2",1,50000,"Dulux / Jotun ngoại thất",50000],
    ["Bả matit nội thất, bả 2 lớp","m2",1,40000,"Dulux / Jotun nội thất",40000],
    ["Sơn ngoại thất, 1 lớp lót 2 lớp phủ","m2",1,90000,"Dulux weathershield / Jotun Jotashield",90000],
    ["Sơn nội thất, 1 lớp lót 2 lớp phủ","m2",1,80000,"Dulux easyclean / Jotun essence",80000],
    ["Sơn hiệu ứng","m2",1,350000,"Pukaco / Conpa",350000],
    ["Sơn giả đá","m2",1,500000,"Kova / Hòa Bình",500000]
  ]},
  {r:"XII",t:"Đá",loai:'kt_chitiet',mode:'item',items:[
    ["Đá nung kết 12mm","m2",1,4000000,"Vasta khổ lớn chuẩn Châu Âu",4000000],
    ["Đá nung kết 9mm","m2",1,1600000,"Vasta",1600000],
    ["Đá granite 16mm -20mm","m2",1,1700000,"Đen kim sa / đen Ấn Độ",1700000],
    ["Đá marble trắng Ý","m2",1,0,"",0],
    ["Đá marble đen tia chớp","m2",1,0,"",0],
    ["Đá marble Cream Marfil","m2",1,0,"",0],
    ["Đá marble Emperador","m2",1,0,"",0],
    ["Đá xuyên sáng Onyx","m2",1,0,"Bán theo tấm - tùy nhà cung cấp",0],
    ["Đá Vicostone 20mm","m2",1,3250000,"Vicostone nhóm P",3250000],
    ["Đá Vicostone 20mm","m2",1,4800000,"Vicostone nhóm A",4800000],
    ["Đá Vicostone 20mm","m2",1,6000000,"Vicostone nhóm B",6000000],
    ["Đá Vicostone 20mm","m2",1,7700000,"Vicostone nhóm C",7700000],
    ["Đá Vicostone 20mm","m2",1,9400000,"Vicostone nhóm D",9400000],
    ["Đá Vicostone 20mm","m2",1,11100000,"Vicostone nhóm E",11100000],
    ["Đá ngạch cửa rộng 100","m2",1,350000,"Đen kim sa / đen Ấn Độ",350000],
    ["Đá ngạch cửa rộng 200","m2",1,500000,"Đen kim sa / đen Ấn Độ",500000]
  ]},
  {r:"XIII",t:"Sàn gỗ",loai:'kt_chitiet',mode:'item',items:[
    ["Sàn gỗ công nghiệp 8mm","m2",1,395000,"An Cường, cốt gỗ HDF, lớp foam 3mm",395000],
    ["Sàn gỗ công nghiệp 12mm lát thẳng","m2",1,475000,"An Cường, cốt gỗ HDF, lớp foam 3mm",475000],
    ["Sàn gỗ công nghiệp 12mm xương cá","m2",1,505000,"An Cường, cốt gỗ HDF, lớp foam 3mm",505000],
    ["Sàn gỗ kỹ thuật 15mm","m2",1,1100000,"Bề mặt gỗ tự nhiên, lớp lõi Plywood/HDF",1100000],
    ["Sàn gỗ tự nhiên 15mm","m2",1,1255000,"Gỗ sồi",1255000],
    ["Sàn gỗ tự nhiên 15mm","m2",1,1505000,"Walnut",1505000],
    ["Sàn gỗ biến tính 26mm","m2",1,2430000,"Themor thông, bao gồm khung xương sắt",2430000],
    ["Sàn gỗ biến tính 20mm","m2",1,3230000,"Themor tần bì, bao gồm khung xương sắt",3230000],
    ["Len gỗ tự nhiên","m",1,250000,"",250000],
    ["Len nhựa","m",1,75000,"",75000],
    ["Nẹp nhôm kết thúc","m",1,80000,"",80000]
  ]},
  {r:"XIV",t:"Nhôm, kính, sắt",loai:'kt_chitiet',mode:'item',items:[
    ["Xingfa Việt Nam","",1,0,"",0],
    ["Cửa đi / cửa sổ mở quay","m2",1,2100000,"Nhôm Xingfa Việt Nam hệ 55 dày1.4ly, kính trắng 08mm cường lực, phụ kiện Kinlong loại 1",2100000],
    ["Cửa đi / cửa sổ lùa","m2",1,1900000,"Nhôm Xingfa Việt Nam hệ 55 dày 1.4ly, kính trắng 08mm cường lực, phụ kiện Kinlong loại 1",1900000],
    ["Cửa sổ bật","m2",1,1950000,"Nhôm Xingfa Việt Nam hệ 55 dày 1.4ly, kính trắng 08mm cường lực, phụ kiện Kinlong loại 1",1950000],
    ["Vách kính cố định","m2",1,1200000,"Nhôm Xingfa Việt Nam hệ 55 dày 1.4ly, kính trắng 08mm cường lực",1200000],
    ["Xingfa Quảng Đông hệ 55","",1,0,"",0],
    ["Cửa đi / cửa sổ mở quay","m2",1,2600000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2600000],
    ["Cửa đi / cửa sổ lùa","m2",1,2400000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2.0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2400000],
    ["Cửa sổ bật","m2",1,2500000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2500000],
    ["Vách kính cố định","m2",1,1500000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 1.4ly, kính trắng 10mm cường lực",1500000],
    ["Xingfa Quảng Đông hệ 93","",1,0,"",0],
    ["Cửa đi / cửa sổ mở quay","m2",1,2800000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2800000],
    ["Cửa đi / cửa sổ lùa","m2",1,2600000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2.0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2600000],
    ["Cửa sổ bật","m2",1,2700000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực, phụ kiện Kinlong chính hãng",2700000],
    ["Vách kính cố định","m2",1,1700000,"Nhôm Xingfa Việt Nam Quảng Đông hệ 55 dày 2,0ly, kính trắng 10mm cường lực",1700000],
    ["Vách kính tắm","",1,0,"",0],
    ["Vách kính WC","m2",1,800000,"Kính trắng 10mm cường lực, vách kính thẳng",800000],
    ["Vách kính WC","m2",1,1200000,"Kính màu 10mm cường lực, vách kính thẳng",1200000],
    ["Vách kính WC","m2",1,1800000,"Kính sọc 10mm cường lực, vách kính thẳng",1800000],
    ["Bộ phụ kiện vách kính tắm (bản lề, tay nắm, kẹp kính)","bộ",1,2400000,"VVP chính hãng",2400000],
    ["Bộ phụ kiện vách kính tắm (bản lề, tay nắm, kẹp kính)","bộ",1,3800000,"Hafele chính hãng",3800000],
    ["Bộ phụ kiện cửa kính (bản lề sàn 150kg, kẹp kính, khóa sàn)","bộ",1,3900000,"VVP chính hãng",3900000],
    ["Bộ phụ kiện cửa kính (bản lề sàn 150kg, kẹp kính, khóa sàn)","bộ",1,5500000,"Hafele chính hãng",5500000],
    ["Lan can cầu thang / ban công","",1,0,"",0],
    ["Lan can kính bắt hông (cầu thang)","m",1,850000,"Kính trắng 10mm cường lực, vách kính thẳng, không tay vịn",850000],
    ["Lan can kính bắt hông (cầu thang)","m",1,1300000,"Kính dán an toàn 2 lớp 10,38mm, vách kính thẳng, không tay vịn",1300000],
    ["Lan can kính âm (chôn ray U)","m",1,1200000,"Kính màu 10mm cường lực, vách kính thẳng, không tay vịn",1200000],
    ["Lan can kính âm (chôn ray U)","m",1,1750000,"Kính dán an toàn 2 lớp 10,38mm, vách kính thẳng, không tay vịn",1750000],
    ["Lan can sắt đơn giản","m",1,1200000,"Cây đứng sắt hộp / sắt la, tay vịn sắt sắt hộp / sắt la, sơn 2 thành phần",1200000],
    ["Lan can sắt cổ điển","m",1,0,"Tùy theo thiết kế",0],
    ["Tay vịn gỗ sơn Pu","m",1,550000,"Gỗ thông / gỗ sồi",550000],
    ["Tay vịn nhôm vuông 20x20","m",1,380000,"",380000]
  ]},
  {r:"XV",t:"Cửa cuốn",loai:'kt_chitiet',mode:'item',items:[
    ["Cửa cuốn trượt trần overhead","m2",1,4300000,"Austdoor",4300000],
    ["Cửa cuốn khe thoáng","m2",1,2550000,"Austdoor S7",2550000],
    ["Cửa cuốn khe thoáng","m2",1,1980000,"Mitadoor X50R",1980000],
    ["Motor cửa cuốn 300kg","cái",1,9200000,"Austdoor AH300A",9200000],
    ["Motor cửa cuốn 300kg","cái",1,5500000,"YH Đài Loan",5500000],
    ["Bình lưu điện","cái",1,4375000,"Austdoor E1000",4375000],
    ["Bình lưu điện","cái",1,4000000,"YH Power Y1000",4000000]
  ]}
];
/* ═══ KHÁI TOÁN SƠ BỘ — bộ mẫu theo báo giá thật của Decox ═══
   Nguồn: "20260805 Decox - BG Building — XD-THÔ" (Tòa nhà văn phòng, B123 The Galleria
   Residence, Metropole Thủ Thiêm; 981m² sàn, 1 bán hầm + 5 tầng + sân thượng + mái).
   Sơ bộ chạy theo NHÓM: bấm + ở tên nhóm để lấy cả nhóm, diện tích/hệ số/đơn giá sửa lại
   theo từng dự án. Nhóm nào chủ đầu tư chưa chốt thì để "chưa bao gồm" (mode none/area0). */
var PT_MAU=[{
  id:'bg_building_2026',
  ten:'Tòa nhà văn phòng 981m² — 1 bán hầm, 5 tầng, sân thượng, mái',
  mo:'Metropole Thủ Thiêm · đất trống, xây mới · phong cách hiện đại',
  tong:8881778400
}];
var PT_SOBO=[
  {r:"I",t:"CÔNG TÁC CHUẨN BỊ",loai:'kt_sobo',mode:'none',note:'Nhóm này thường do chủ đầu tư tự làm — báo giá mẫu để "chưa bao gồm"',items:[
    ["Xin phép xây dựng","gói","Chưa bao gồm"],
    ["Đập phá, tháo dỡ nhà hiện trạng","gói","Chưa bao gồm"],
    ["Khoan khảo sát địa chất","gói","Chưa bao gồm"],
    ["Cắm mốc định vị ranh xây dựng","gói","Chưa bao gồm"],
    ["Xin cấp đồng hồ điện, nước","gói","Chưa bao gồm"]
  ]},
  {r:"II",t:"CÔNG TÁC ÉP CỌC",loai:'kt_sobo',mode:'item',items:[
    ["Giàn tải, máy ép cọc Pmax 90T","gói",1,28000000,"Huy động, dựng và tháo giàn ép",28000000],
    ["Nhân công ép cọc PHC D300 lực ép P(max) 90 tấn","tim",56,2250000,"Số tim cọc tạm tính",2250000],
    ["Cọc ly tâm D300 PHC lực ép P(max) 90 tấn","md",1120,414000,"56 tim × 20m/tim — số tim, số m tạm tính",414000]
  ]},
  {r:"III",t:"BIỆN PHÁP THI CÔNG HẦM",loai:'kt_sobo',mode:'item',items:[
    ["Ép cừ C200 chu vi hầm, cừ C dài 4,5m","md",62,4436000,"Khối lượng theo chu vi hầm",4436000],
    ["Hệ Shoring","hệ",1,30000000,"",30000000],
    ["Đào đất, vận chuyển đi đổ","m3",388.65,185000,"",185000]
  ]},
  {r:"IV",t:"THI CÔNG XÂY THÔ",loai:'kt_sobo',mode:'area',up:4200000,
   note:'Không bao gồm nhân công hoàn thiện, MEP âm tường, bể PCCC. Đơn giá tính trên khối lượng quy đổi (diện tích × hệ số)',items:[
    ["Móng (diện tích bao ngoài toàn bộ móng, dầm móng)","m2",278.00,0.5,""],
    ["Hầm + ram dốc","m2",178.56,1.7,""],
    ["Tầng 1","m2",156.00,1.0,""],
    ["Sân vườn ngoài trời","m2",104.39,0.5,""],
    ["Tầng 2-4 (bao gồm ban công)","m2",178.78,3.0,"Hệ số 3 = 3 tầng giống nhau"],
    ["Tầng 5 (bao gồm ban công)","m2",185.92,1.0,""],
    ["Tầng thượng có mái che","m2",50.63,1.0,""],
    ["Tầng thượng không mái che","m2",82.37,0.5,""],
    ["Mái bê tông cốt thép","m2",50.63,0.5,""],
    ["Tum thang máy","m2",5.17,0.5,""]
  ]},
  {r:"V",t:"HỆ THỐNG MEP (điện · cấp thoát nước · data)",loai:'kt_sobo',mode:'area',up:750000,
   note:'Không bao gồm nhân công lắp đặt và thiết bị đầu cuối',items:[
    ["Hầm","m2",178.56,1.0,""],
    ["Tầng 1 (bao gồm diện tích sân vườn)","m2",260.39,1.0,""],
    ["Tầng 2-4","m2",178.78,3.0,""],
    ["Tầng 5","m2",185.92,1.0,""],
    ["Sân thượng","m2",133.00,1.0,""],
    ["Mái","m2",50.63,0.5,""]
  ]},
  {r:"VI",t:"CHỐNG THẤM",loai:'kt_sobo',mode:'area0',note:'Chưa bao gồm trong báo giá mẫu — có khối lượng để chốt đơn giá sau',items:[
    ["Hầm (sàn + vách hầm + hố pit)","m2",250.01,1.0,"Chưa bao gồm"],
    ["Nhà vệ sinh","m2",83.97,1.0,"Chưa bao gồm"],
    ["Ban công tầng 2-5","m2",195.67,1.0,"Chưa bao gồm"],
    ["Sân thượng ngoài trời","m2",121.85,1.0,"Chưa bao gồm"],
    ["Mái","m2",70.75,1.0,"Chưa bao gồm"]
  ]},
  {r:"VII",t:"HỆ THỐNG PCCC",loai:'kt_sobo',mode:'none',note:'Chưa bao gồm — báo giá riêng theo hồ sơ thẩm duyệt PCCC',items:[
    ["Bể chứa nước PCCC theo quy định","gói","Chưa bao gồm"],
    ["Hệ thống báo cháy","gói","Chưa bao gồm"],
    ["Hệ thống chữa cháy","gói","Chưa bao gồm"],
    ["Hệ thống thoát hiểm và hỗ trợ","gói","Chưa bao gồm"]
  ]},
  {r:"VIII",t:"CHI PHÍ KHÁC",loai:'kt_sobo',mode:'item',items:[
    ["Dọn dẹp mặt bằng","gói",1,30000000,"Phát quang cây cỏ, thu gom xà bần, rác thải hiện trạng, san đất tạo mặt bằng",30000000],
    ["Phun thuốc chống mối","gói",1,63690000,"Cho tầng hầm và tầng 1",63690000],
    ["Bao che công trình (giàn giáo, lưới, bạt…)","gói",1,140000000,"",140000000],
    ["Hàng rào bao quanh công trình, cổng công trình","gói",1,75000000,"",75000000],
    ["Camera quan sát công trình","cái",3,1200000,"",1200000],
    ["Mạng internet trong quá trình thi công","tháng",6,350000,"",350000],
    ["Nhà vệ sinh di động","cái",1,20000000,"",20000000],
    ["Thùng rác","cái",1,900000,"",900000],
    ["Thiết bị PCCC (bình chữa cháy 4kg)","cái",8,600000,"",600000],
    ["Vệ sinh công trình hằng ngày (xây dựng thô)","gói",1,45000000,"",45000000],
    ["Vận chuyển xà bần, rác thải trong quá trình thi công","tháng",6,7500000,"",7500000],
    ["Văn phòng tạm tại công trình trong quá trình thi công","tháng",6,8000000,"",8000000],
    ["Công tác an toàn lao động","gói",1,28000000,"Nội quy, biển báo, đồ bảo hộ, lan can chắn, lưới hứng các khu vực mép sàn",28000000],
    ["Chi phí thẩm tra biện pháp thi công hầm","gói",1,20000000,"Theo quy định",20000000],
    ["Chi phí thanh tra xây dựng kiểm tra trong quá trình thi công phần thô","gói",5,5000000,"",5000000],
    ["Chi phí trắc đạc","tầng",8,7000000,"",7000000],
    ["Chi phí điện nước thi công 6 tháng (phần thô)","gói",6,3500000,"",3500000],
    ["Chi phí thang vận","gói",1,0,"Chưa bao gồm",0],
    ["Đấu nối hệ thống thoát nước thải vào cống chung","gói",1,0,"Chưa bao gồm",0]
  ]}
];
PT_TEMPLATE=PT_TEMPLATE.concat(PT_SOBO);
var PT_ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI'];
function ptN(v){ return typeof v==='number' ? v : tkNum_(v); }
function ptR0(x){ return Math.round(x||0); }
function ptR2(x){ return Math.round((x||0)*100)/100; }
function ptQty(x){ x=Number(x)||0; return x.toLocaleString('vi-VN',{maximumFractionDigits:2}); }
// Thư viện nội dung công việc (Phần thô) — hiện ở panel trái, bấm + để thêm vào bảng ước tính
/* ═══ PHÂN LOẠI BÁO GIÁ PHẦN THÔ (theo sơ đồ nghiệp vụ) ═══
   DỰ TOÁN   ├─ Nhân công  -> ra báo giá theo m2/md/cái
             └─ Vật tư     -> ra báo giá vật tư
   KHÁI TOÁN ├─ Chi tiết   -> chọn nhà thầu -> ra báo giá theo m2/md/cái
             └─ Sơ bộ      -> chọn nhà thầu -> chọn dự án mẫu -> ra đơn giá trọn gói
   Khái toán: thư viện 156 công tác (bảng giá cố định).
   Dự toán : nhập SỐ LIỆU ĐẦU VÀO -> tự tính khối lượng -> áp ĐỊNH MỨC hao phí (xem DT_BO). */
var PT_LOAI=[
  ['kt_chitiet','Khái toán chi tiết','Khái toán','Chọn nhà thầu → ra báo giá theo m2 / md / cái'],
  ['kt_sobo',   'Khái toán sơ bộ',   'Khái toán','Chọn nhà thầu → chọn dự án mẫu → ra đơn giá trọn gói'],
  ['dt_nhancong','Dự toán · Nhân công','Dự toán','Nhập số liệu đầu vào → tính khối lượng → nhân công và ca máy theo định mức'],
  ['dt_vattu',   'Dự toán · Vật tư',  'Dự toán','Nhập số liệu đầu vào → khối lượng vật tư × đơn giá nhà cung cấp']
];
function ptCfLoad_(){ if(S.ptCf) return; try{ S.ptCf=JSON.parse(localStorage.getItem('qs_ptcf')||'{}')||{}; }catch(e){ S.ptCf={}; } }
ptCfLoad_();
function ptLoai_(){
  if(S._ptLoai===undefined){ try{ S._ptLoai=localStorage.getItem('qs_ptLoai')||'kt_chitiet'; }catch(e){ S._ptLoai='kt_chitiet'; } }
  return ptLoaiGop_(S._ptLoai||'kt_chitiet');
}
function ptSetLoai(v){ S._ptLoai=v; try{ localStorage.setItem('qs_ptLoai',v); }catch(e){} renderPTLibrary();
  if(typeof renderMM_==='function') renderMM_();
  // bảng trống: lời nhắc trong bảng khác nhau giữa Khái toán và Dự toán -> vẽ lại cho khớp
  if(Array.isArray(S.phanTho)&&!S.phanTho.length) renderPhanTho(); }
function ptSecsOfLoai_(v){ v=ptLoaiGop_(v); return PT_TEMPLATE.filter(function(s){ return !s.an && ptLoaiGop_(s.loai)===v; }); }
function ptLoaiCount_(v){ return ptSecsOfLoai_(v).reduce(function(a,s){ return a+s.items.length; },0); }

/* ═══════════════ DỰ TOÁN THEO ĐỊNH MỨC ═══════════════
   Khác Khái toán: người dùng nhập SỐ LIỆU ĐẦU VÀO (ô vàng trong file Excel)
   -> hệ thống tự tính KHỐI LƯỢNG -> nhân với ĐỊNH MỨC HAO PHÍ (nhân công / ca máy)
   -> ra bảng công tác + thành tiền.  (nguồn: file du_toan_ep_coc_D300)
   Mỗi "bộ dự toán" sinh ra 2 nhóm trong thư viện: Nhân công & máy  +  Vật tư.       */
var DT_BO=[{
  id:'ep_coc_d300',
  ten:'Ép cọc ly tâm PHC/PC D300 — máy ép robot 860T',
  nguon:'Định mức 12/2021/TT-BXD · mã AC.26300 / AC.29400 / AC.21500',
  dinhMuc:'100m',
  ghiChu:'Định mức đóng/ép tính cho đoạn cọc ngập đất; đoạn không ngập đất × 0,75 · ép cọc xiên × 1,22. '
        +'Chưa gồm: đào phá đầu cọc, thí nghiệm nén tĩnh/PDA, vận chuyển cọc ngoài phạm vi.',
  inputs:[
    ['dk',   'Đường kính cọc',            'mm',    300,     0],
    ['sl',   'Số lượng cọc',              'cây',   56,      0],
    ['dai',  'Chiều dài mỗi cọc',         'm',     18,      0],
    ['doan', 'Số đoạn cọc / 1 cọc',       'đoạn',  2,       0],
    ['dgcoc','Đơn giá cọc (nguyên cây)',  'đ/cọc', 4050000, 1],
    ['khoan','Chiều dài khoan dẫn',       'm',     0,       0]
  ],
  // [nhãn, công thức (chữ), hàm tính, đvt]
  kl:[
    ['Tổng chiều dài cọc ép',        'Số cọc × Chiều dài mỗi cọc',    function(v){ return v.sl*v.dai; },        'm'],
    ['Tổng số đoạn cọc',             'Số cọc × Số đoạn/cọc',          function(v){ return v.sl*v.doan; },       'đoạn'],
    ['Số mối nối cọc (hàn)',         'Số cọc × (Số đoạn/cọc − 1)',    function(v){ return v.sl*(v.doan-1); },   'mối nối'],
    ['Khối lượng ép cọc theo định mức','Tổng chiều dài ÷ 100',        function(v){ return v.sl*v.dai/100; },    '100m'],
    ['Chi phí vật liệu cọc',         'Số cọc × Đơn giá cọc',          function(v){ return v.sl*v.dgcoc; },      'đồng']
  ],
  // NHÂN CÔNG & MÁY: hao phí cho 1 đơn vị định mức (100m) × khối lượng định mức
  hp:[
    ['AC.26300','Nhân công ép cọc (bậc 3,5/7)',                'công', 5.5,  350000,  'Hao phí 5,5 công/100m'],
    ['AC.26300','Máy ép cọc robot thủy lực tự hành 860T',      'ca',   0.97, 9000000, 'Hao phí 0,97 ca/100m'],
    ['AC.26300','Cần cẩu 50T (phục vụ cẩu, dựng cọc)',         'ca',   0.24, 4500000, 'Hao phí 0,24 ca/100m']
  ],
  // CÔNG TÁC khác tính theo khối lượng riêng (đơn giá tự nhập theo hợp đồng)
  ct:[
    ['AC.29400','Nối cọc ống BTCT (hàn nối các đoạn cọc)','mối nối', function(v){ return v.sl*(v.doan-1); }, 0, 'Chỉ tính khi cọc > 1 đoạn — đơn giá theo báo giá nhà thầu'],
    ['AC.21500','Khoan dẫn phục vụ ép cọc (máy khoan xoay)','m',     function(v){ return v.khoan; },         0, 'Chỉ khi thiết kế/biện pháp thi công yêu cầu khoan dẫn']
  ],
  // VẬT TƯ: đơn giá quy về đơn vị đo
  vt:[
    ['Cọc bê tông ly tâm PHC/PC D300 (thân cọc, chưa gồm mũ + đệm đầu cọc)','m',
      function(v){ return v.sl*v.dai; },
      function(v){ return v.dai?(v.dgcoc/v.dai):0; },
      'Giá cọc theo báo giá nhà cung cấp thực tế']
  ]
}];
function dtKey_(id){ return 'qs_dt_'+((S.cur&&S.cur.maDA)||'')+'_'+id; }   // theo dự án (trước dùng chung mọi dự án)
function dtVals_(bo){
  S._dtIn=S._dtIn||{};
  if(!S._dtIn[bo.id]){
    var saved=null; try{ saved=JSON.parse(localStorage.getItem(dtKey_(bo.id))||'null'); }catch(e){}
    var v={}; bo.inputs.forEach(function(a){ v[a[0]]=a[3]; });
    if(saved&&typeof saved==='object') Object.keys(saved).forEach(function(k){ if(v[k]!==undefined) v[k]=ptN(saved[k]); });
    S._dtIn[bo.id]=v;
  }
  return S._dtIn[bo.id];
}
function dtSetIn(id,k,val){
  var bo=DT_BO.filter(function(b){ return b.id===id; })[0]; if(!bo) return;
  var def=bo.inputs.filter(function(a){ return a[0]===k; })[0];
  var v=dtVals_(bo);
  v[k]=def&&def[4]?ptMoneyN_(val):ptN(val);
  try{ localStorage.setItem(dtKey_(id),JSON.stringify(v)); }catch(e){}
  dtSync_(); dtApplyToTable_(); renderPTLibrary(); if(S.phanTho) renderPhanTho();
}
function dtResetIn(id){
  var bo=DT_BO.filter(function(b){ return b.id===id; })[0]; if(!bo) return;
  var v={}; bo.inputs.forEach(function(a){ v[a[0]]=a[3]; });
  S._dtIn=S._dtIn||{}; S._dtIn[bo.id]=v;
  try{ localStorage.removeItem(dtKey_(id)); }catch(e){}
  dtSync_(); dtApplyToTable_(); renderPTLibrary(); if(S.phanTho) renderPhanTho();
  toast('Đã trả số liệu đầu vào về mặc định');
}
// tính toàn bộ khối lượng của 1 bộ dự toán
function dtCalc_(bo){
  var v=dtVals_(bo);
  var dm=v.dai?(v.sl*v.dai/100):0;                       // khối lượng theo đơn vị định mức (100m)
  return {v:v, dm:dm, kl:bo.kl.map(function(a){ return {t:a[0],ct:a[1],r:a[2](v),dvt:a[3]}; })};
}
// sinh 2 nhóm (Nhân công & máy / Vật tư) cho mỗi bộ — GIỮ NGUYÊN object để index thư viện không đổi
function dtSync_(){
  DT_BO.forEach(function(bo,bi){
    var c=dtCalc_(bo), v=c.v;
    var nc=[], vt=[];
    bo.hp.forEach(function(a){
      var kl=ptR4_(a[3]*c.dm);
      nc.push([a[1]+'\n('+a[0]+' · '+ptQty(a[3])+' '+a[2]+'/'+bo.dinhMuc+')', a[2], kl, a[4], a[5], a[4]]);
    });
    bo.ct.forEach(function(a){
      nc.push([a[1]+'\n('+a[0]+')', a[2], ptR4_(a[3](v)), a[4], a[5], a[4]]);
    });
    bo.vt.forEach(function(a){
      vt.push([a[0], a[1], ptR4_(a[2](v)), ptR0(a[3](v)), a[4], ptR0(a[3](v))]);
    });
    dtPut_(bo,'dt_nhancong','NHÂN CÔNG & MÁY THI CÔNG — '+bo.ten.toUpperCase(), bi+1, nc);
    dtPut_(bo,'dt_vattu',   'VẬT TƯ — '+bo.ten.toUpperCase(),                   bi+1, vt);
  });
}
function ptR4_(x){ return Math.round((x||0)*10000)/10000; }
function dtPut_(bo,loai,ten,r,items){
  var sec=PT_TEMPLATE.filter(function(s){ return s.dtId===bo.id && s.loai===loai; })[0];
  if(!sec){ sec={r:String(r),t:ten,loai:loai,mode:'item',note:bo.nguon,up:0,dtId:bo.id,items:[]}; PT_TEMPLATE.push(sec); }
  sec.t=ten; sec.note=bo.nguon; sec.items=items;
}
// số liệu đầu vào đổi -> cập nhật luôn KHỐI LƯỢNG các dòng đã thêm vào bảng ước tính
function dtApplyToTable_(){
  if(!Array.isArray(S.phanTho)) return; var n=0;
  PT_TEMPLATE.filter(function(s){ return s.dtId; }).forEach(function(tsec){
    var sec=S.phanTho.filter(function(s){ return s.t===tsec.t; })[0]; if(!sec) return;
    tsec.items.forEach(function(a){
      sec.items.forEach(function(it){ if(String(it.n||'')===String(a[0])){ it.kl=a[2]; n++; } });
    });
  });
  if(n) ptPersist();
}
// bảng "Số liệu đầu vào + Khối lượng tính toán" — hiện ngay dưới bộ lọc khi chọn loại Dự toán
// các nhóm (nhân công / vật tư) do 1 bộ dự toán sinh ra
function dtSecs_(bo){ return PT_TEMPLATE.filter(function(s){ return s.dtId===bo.id; }); }
// đã đưa bộ này vào bảng ước tính chưa
function dtApplied_(bo){
  if(!Array.isArray(S.phanTho)) return false;
  return dtSecs_(bo).every(function(t){ return S.phanTho.some(function(s){ return s.t===t.t; }); });
}
// tiền của bộ: [nhân công & máy, vật tư, tổng trực tiếp]
function dtTien_(bo){
  var nc=0, vt=0;
  dtSecs_(bo).forEach(function(t){
    var s=t.items.reduce(function(a,x){ return a+ptR0(ptN(x[2])*ptN(x[3])); },0);
    if(t.loai==='dt_vattu') vt+=s; else nc+=s;
  });
  return {nc:nc, vt:vt, tong:nc+vt};
}
// MỘT NÚT = đưa CẢ bộ dự toán (nhân công & máy + vật tư) vào bảng — dự toán là 1 khối, không lượm từng dòng
function dtApply(id){
  var bo=DT_BO.filter(function(b){ return b.id===id; })[0]; if(!bo) return;
  ptEnsure();
  dtSecs_(bo).forEach(function(t){ ptAddToSec_(PT_TEMPLATE.indexOf(t), true); });
  ptPersist(); renderPhanTho(); renderPTLibrary();
  toast('Đã đưa bộ dự toán vào bảng — sửa số liệu đầu vào là bảng tự cập nhật');
}
function dtRemove(id){
  var bo=DT_BO.filter(function(b){ return b.id===id; })[0]; if(!bo) return;
  var ten={}; dtSecs_(bo).forEach(function(t){ ten[t.t]=1; });
  S.phanTho=(S.phanTho||[]).filter(function(s){ return !ten[s.t]; });
  ptPersist(); renderPhanTho(); renderPTLibrary();
  toast('Đã gỡ bộ dự toán khỏi bảng');
}
function dtPanel_(loai){
  return DT_BO.map(function(bo){
    var c=dtCalc_(bo), v=c.v, on=dtApplied_(bo), t=dtTien_(bo);
    return '<div class="dt-panel'+(on?' on':'')+'">'
      +'<div class="dt-hd"><span class="dt-tag">Bộ dự toán</span>'
        +(on?'<span class="dt-on">✓ đang dùng</span>':'')
        +'<b>'+esc(bo.ten)+'</b>'
        +'<span class="dt-src">'+esc(bo.nguon)+'</span>'
        +'<button class="dt-rs" onclick="dtResetIn(\''+bo.id+'\')" title="Trả số liệu đầu vào về mặc định">Mặc định</button></div>'
      +'<div class="dt-act">'
        +(on
          ? '<button class="dt-btn off" onclick="dtRemove(\''+bo.id+'\')">Gỡ khỏi bảng</button>'
          : '<button class="dt-btn" onclick="dtApply(\''+bo.id+'\')">'+icon('plus',14)+' Dùng bộ dự toán này</button>')
        +'<span class="dt-actn">Đưa cả nhân công · máy · vật tư vào bảng trong 1 lần</span></div>'
      +'<div class="dt-sec">I. Số liệu đầu vào</div>'
      +'<div class="dt-ins">'+bo.inputs.map(function(a){
          var val=v[a[0]];
          var inp=a[4]
            ? '<input class="dt-in" type="text" inputmode="numeric" value="'+esc(val?money(val):'')+'" onchange="dtSetIn(\''+bo.id+'\',\''+a[0]+'\',this.value)">'
            : '<input class="dt-in" type="number" step="any" value="'+(val===''||val==null?'':val)+'" onchange="dtSetIn(\''+bo.id+'\',\''+a[0]+'\',this.value)">';
          return '<label class="dt-fld"><span class="dt-lb">'+esc(a[1])+'</span>'+inp+'<span class="dt-dv">'+esc(a[2])+'</span></label>';
        }).join('')+'</div>'
      +'<div class="dt-sec">II. Khối lượng tính toán</div>'
      +'<table class="dt-kl"><thead><tr><th>Nội dung · công thức</th><th class="n">Kết quả</th><th>ĐVT</th></tr></thead><tbody>'
        +c.kl.map(function(k){
          var isMoney=k.dvt==='đồng';
          return '<tr><td><span class="dt-knm">'+esc(k.t)+'</span><span class="dt-ct">'+esc(k.ct)+'</span></td>'
            +'<td class="n b">'+(isMoney?money(ptR0(k.r)):ptQty(k.r))+'</td><td class="dt-dvt">'+esc(k.dvt)+'</td></tr>';
        }).join('')+'</tbody></table>'
      +'<div class="dt-sec">III. Chi phí trực tiếp</div>'
      +'<div class="dt-sum">'
        +'<div class="dt-srow"><span>Nhân công &amp; máy thi công</span><b>'+money(t.nc)+'</b></div>'
        +'<div class="dt-srow"><span>Vật tư</span><b>'+money(t.vt)+'</b></div>'
        +'<div class="dt-srow tot"><span>Tổng chi phí trực tiếp</span><b>'+money(t.tong)+'</b></div>'
      +'</div>'
      +'<p class="dt-note">'+esc(bo.ghiChu)+'</p>'
    +'</div>';
  }).join('');
}

dtSync_();   // nạp sẵn các bộ dự toán vào thư viện

var PT_CONTRACTORS=['H77','Decox','TTP','Unicons'];
/* ═══ CÔNG TÁC XÂY DỰNG LƯU TRÊN CSDL ═══
   Thư viện mẫu (PT_TEMPLATE) vẫn dùng được ngay; công tác do người dùng nhập nằm ở bảng
   cong_tac, có ảnh · duyệt · sửa · xoá giống hệt sản phẩm đèn. Các công tác của CSDL được
   gắn thêm vào PT_TEMPLATE dưới dạng hạng mục thật (đánh dấu sec.db) nên mọi chỗ đang dùng
   (thư viện trái, bảng Danh sách sản phẩm, panel thông tin, thêm vào bảng khái toán) chạy
   như cũ, không phải sửa lại đường đi dữ liệu.                                            */
function ctOf_(a){ return (a && a.ct) || null; }
/* ═══ PHÂN LỚP CÔNG TÁC THEO ĐỀ MỤC CÂY ═══
   Thư viện công tác (Phần thô) có cả nhóm hoàn thiện. Mỗi nhóm được xếp thêm vào đúng đề mục
   để khi bóc tách Thạch cao / Sơn nước / Xây tô / Ốp lát / Cửa thì panel trái có công tác để chọn.
   Công tác VẪN hiện ở 3.1 Phần thô như cũ (khái toán trọn gói vẫn chọn được).
   Xếp theo tên nhóm (hạng mục của công tác) — thêm quy tắc ở đây khi có nhóm mới.      */
var CT_DEMUC_RULES=[
  [/thach cao/,'3.2.1'],
  [/son nuoc|\bson\b/,'3.2.2'],
  [/xay tuong|trat tuong|xay to/,'3.2.3'],
  [/op lat|\bda\b|san go/,'3.2.4'],
  [/nhom|kinh|\bsat\b|cua cuon|\bcua\b/,'3.2.8']
];
function ctDeMucOf_(hangMuc){
  var t=String(hangMuc||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  for(var i=0;i<CT_DEMUC_RULES.length;i++) if(CT_DEMUC_RULES[i][0].test(t)) return CT_DEMUC_RULES[i][1];
  return '';
}
/* ═══ CHỌN ĐỀ MỤC (PHÂN LOẠI) NGAY KHI NHẬP CÔNG TÁC ═══
   Đoán theo tên hạng mục chỉ đúng với vài tên quen (sơn, thạch cao, ốp lát…). Nay form
   Nhập dữ liệu có ô chọn thẳng đề mục con, lưu ở cột cong_tac.de_muc:
     rỗng = vẫn tự nhận theo tên  ·  '0' = chỉ nằm ở 3.1 Phần thô  ·  mã đề mục = ghim vào đó.
   Công tác LUÔN hiện ở 3.1 Phần thô; có đề mục thì hiện thêm ở đúng đề mục khi bóc tách. */
var CT_DEMUC_CHON=['3.2.1','3.2.2','3.2.3','3.2.4','3.2.5','3.2.6','3.2.6.1','3.2.6.2','3.2.7','3.2.8','3.2.8.1','3.2.8.2'];
function ctDeMucNhan_(hangMuc){ var c=ctDeMucOf_(hangMuc); return c?(c+' '+nodeName(c)):''; }
function ctDeMucOpts_(cur, hangMuc){
  cur=String(cur==null?'':cur);
  var tu=ctDeMucNhan_(hangMuc);
  return '<option value=""'+(cur?'':' selected')+'>— Tự nhận theo tên hạng mục'+(tu?(': '+tu):': chưa nhận ra')+' —</option>'
    +'<option value="0"'+(cur==='0'?' selected':'')+'>Chỉ nằm ở 3.1 Phần thô</option>'
    +CT_DEMUC_CHON.map(function(cd){
      return '<option value="'+cd+'"'+(cur===cd?' selected':'')+'>'+cd+' · '+esc(nodeName(cd))+'</option>'; }).join('');
}
// đổi tên hạng mục -> cập nhật lại nhãn "tự nhận" của ô chọn đề mục
function ctDeMucSync_(pre){
  var sel=document.getElementById(pre+'DeMuc'), hm=document.getElementById(pre+'HangMuc');
  if(!sel||!sel.options.length) return;
  var tu=ctDeMucNhan_(hm?hm.value:'');
  sel.options[0].textContent='— Tự nhận theo tên hạng mục'+(tu?(': '+tu):': chưa nhận ra')+' —';
}
// đề mục thật sự của 1 công tác trong CSDL
function ctDeMucCua_(c){
  var v=String((c&&c.deMuc)||'').trim();
  if(v==='0') return '';                                  // người dùng chọn: chỉ ở Phần thô
  if(v) return v;
  return ctDeMucOf_((c&&c.hangMuc)||'');
}
// đề mục của 1 hạng mục công tác (nhóm trong thư viện Phần thô)
function ctSecDeMuc_(sec){
  if(!sec) return '';
  var v=String(sec.deMuc||'').trim();
  if(v==='0') return '';
  if(v) return v;
  return ctDeMucOf_(String(sec.t||'').split('\n')[0]);
}
// Các nhóm công tác (trong CSDL) thuộc đề mục đang chọn (kể cả khi chọn cấp con, vd 3.2.8.1 -> nhóm 3.2.8)
function ctSecsOfNode_(node){
  node=String(node||''); if(!node || node==='3.1') return [];
  return PT_TEMPLATE.filter(function(sec){
    if(!sec.db || !(sec.items||[]).length) return false;
    var dm=ctSecDeMuc_(sec); if(!dm) return false;
    return node===dm || node.indexOf(dm+'.')===0;
  });
}
// Thêm 1 công tác vào bảng bóc tách của đề mục đang chọn (dòng thường: ĐVT · đơn giá · SL)
function ctAddToBoc_(si,ii){
  var sec=PT_TEMPLATE[si], a=sec&&sec.items[ii]; if(!a) return;
  var c=ctOf_(a)||{}, dg=Number(c.dg)||ptLibDg_(sec,a)||0, von=Number(c.dgnt)||dg;
  var anh=String(c.hinhAnh||'').split('\n')[0];
  Promise.resolve(addProdObj({ ten:String(a[0]).split('\n')[0], ma:'', thuongHieu:'', ncc:c.ncc||'', moTa:String(c.gc||c.thongSo||'').trim(),
    kichThuoc:'', dvt:a[1]||c.dvt||'', hinhAnh:anh, donGiaVon:von, donGiaBan:dg, nhom:String(sec.t).split('\n')[0] }))
    .then(function(){ try{ renderCatalog(); }catch(e){} });      // cập nhật dấu "✓ đã thêm" trên thẻ
}
function renderCtLib_(secs){
  return '<div class="ptlib ctlib"><div class="ctlib-h">'+icon('layers',13)+' Công tác '+esc(nodeName(S.node))
      +'<span>'+secs.reduce(function(n,s){ return n+s.items.length; },0)+'</span></div>'
    +secs.map(function(sec){
    var si=PT_TEMPLATE.indexOf(sec), col=S._ptLibCol&&S._ptLibCol[si];
    return '<div class="ptlib-sec"><div class="ptlib-h" onclick="ptLibToggle('+si+')">'
        +'<span class="ptlib-caret">'+(col?'▸':'▾')+'</span><span class="ptlib-htt">'+esc(String(sec.t).split('\n')[0])+'</span>'
        +'<span class="ptlib-hn">'+sec.items.length+'</span>'
        +'<span class="ptlib-lo">'+esc(ptLoaiNgan_(sec.loai))+'</span></div>'
      +(col?'':'<div class="ptlib-items">'+sec.items.map(function(a,ii){
        var dg=ptLibDg_(sec,a), dt=S._ptDetail, on=(dt&&dt.si===si&&dt.ii===ii);
        var da=(S.lines||[]).some(function(l){ return l.nhom===S.node && l.ten===String(a[0]).split('\n')[0]; });
        return '<div class="ptlib-item'+(on?' on':'')+(da?' da':'')+'" title="Bấm để xem thông tin công tác" onclick="ptShowDetail_('+si+','+ii+')">'
          +'<div class="ptlib-nm" title="'+esc(String(a[0]).replace(/\n/g,' '))+'">'+esc(String(a[0]).split('\n')[0])+'</div>'
          +'<div class="ptlib-meta"><span class="ptlib-dvt">'+esc(a[1]||'')+'</span><span class="ptlib-dg">'+(dg?(money(dg)+' đ'):'—')+'</span>'
            +(da?'<span class="ptlib-da" title="Đã có trong bảng bóc tách">✓ đã thêm</span>':'')+'</div>'
          +'<button class="ptlib-add" title="Thêm vào bảng bóc tách" onclick="event.stopPropagation();ctAddToBoc_('+si+','+ii+')">'+icon('plus',14)+'</button></div>';
      }).join('')+'</div>')+'</div>';
  }).join('')+'</div>';
}
function ctSecOf_(sec){ return !!(sec && sec.db); }
function ctItemArr_(c){
  var a;
  if(c.mode==='item') a=[c.ten, c.dvt, (c.kl===''||c.kl==null)?1:c.kl, c.dg, c.gc, c.dgnt];
  else if(c.mode==='area'||c.mode==='area0') a=[c.ten, c.dvt, c.dt===''?0:c.dt, c.hs===''?1:c.hs, c.gc];
  else a=[c.ten, c.dvt, c.gc];
  a.ct=c; return a;
}
/* Gom công tác CSDL thành các hạng mục, nối vào PT_TEMPLATE.
   Loại báo giá nào ĐÃ có dữ liệu trong CSDL thì bản dựng sẵn của loại đó bị ẩn đi —
   để mỗi công tác chỉ xuất hiện MỘT lần và luôn là bản ghi thật (có ★ · duyệt · sửa · xoá),
   đúng như sản phẩm đèn.                                                                */
function ctSyncTemplate_(){
  PT_TEMPLATE=PT_TEMPLATE.filter(function(s){ return !s.db; });
  var list=S.congTac||[], secs={}, order=[];
  list.forEach(function(c){
    var loai=c.loai||'kt_chitiet', t=c.hangMuc||'CHƯA PHÂN NHÓM';
    var dm=String(c.deMuc||'').trim(), k=loai+'|'+t+'|'+dm;   // khác đề mục = nhóm khác (mỗi nhóm 1 đề mục)
    if(!secs[k]){ secs[k]={r:c.maNhom||'', t:t, loai:loai, mode:c.mode||'item', db:true, up:0, deMuc:dm, items:[]}; order.push(k); }
    var sec=secs[k];
    if(!sec.r && c.maNhom) sec.r=c.maNhom;
    if(sec.mode==='area' && !sec.up && c.dg) sec.up=c.dg;      // đơn giá chung của nhóm
    sec.items.push(ctItemArr_(c));
  });
  order.forEach(function(k){ PT_TEMPLATE.push(secs[k]); });
  // loại nào đã có trong CSDL -> ẩn bản dựng sẵn của loại đó
  var dbLoai={}; list.forEach(function(c){ dbLoai[c.loai||'kt_chitiet']=1; });
  S._ptDbLoai=dbLoai;
  PT_TEMPLATE.forEach(function(sc){ sc.an = !sc.db && !!dbLoai[ptSecLoai_(sc)]; });
  _ptColCache=null;                                            // nhãn cột không đổi nhưng cho chắc
  if(!PT_ROMAN_EXT_){ PT_ROMAN_EXT_=1; }
}
var PT_ROMAN_EXT_=0;
async function ctLoad_(quiet){
  try{
    S.congTac=await api('ctList')||[];
    ctSyncTemplate_();
    return S.congTac;
  }catch(e){
    S.congTac=S.congTac||[];
    if(!quiet) toast('Không tải được công tác: '+e.message);
    return S.congTac;
  }
}
function ctReload_(){
  return ctLoad_(true).then(function(){
    if(S.node==='3.1'){ renderPTLibrary(); renderPhanTho(); }
    if(spPTMode_()){ spViewTabs_(); renderSpChips_(); spFilter(); }
  });
}
// Nạp thư viện mẫu vào CSDL để công tác có đủ ảnh / duyệt / sửa như sản phẩm
/* --- Duyệt / xoá / sửa 1 công tác của CSDL --- */
async function ctFav_(id, on){
  var c=(S.congTac||[]).filter(function(x){ return x.id===id; })[0];
  if(c) c.yeuThich=!!on;                       // đổi trước cho nhanh tay
  ctSyncTemplate_(); if(spPTMode_()) spFilter(); if(S.node==='3.1') renderPTLibrary();
  try{ batKq_(await api('ctFav',[id],!!on), 1, 'đánh dấu yêu thích'); toast(on?'Đã thêm vào công tác yêu thích':'Đã bỏ khỏi công tác yêu thích'); }
  catch(e){ if(c) c.yeuThich=!on; ctSyncTemplate_(); if(spPTMode_()) spFilter(); toast('Lỗi: '+e.message); }
}
async function ctFavBulk_(on){
  var ids=ptSelRows_().map(function(r){ var c=ctOf_(r.a); return c&&c.id; }).filter(Boolean);
  if(!ids.length){ toast('Chỉ đánh dấu được công tác đã lưu trong cơ sở dữ liệu'); return; }
  try{ batKq_(await api('ctFav',ids,!!on), ids.length, 'đánh dấu yêu thích'); S._spSel={}; await ctReload_(); toast((on?'Đã thêm ':'Đã bỏ ')+ids.length+' công tác yêu thích'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
async function ctDuyet_(id, on){
  try{ batKq_(await api('ctDuyet',[id], !!on), 1, 'đổi trạng thái duyệt'); await ctReload_(); toast(on?'Đã duyệt công tác':'Đã bỏ duyệt'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
async function ctDelete_(id, ten){
  if(!await xacNhan_('Xoá công tác "'+ten+'" khỏi cơ sở dữ liệu?')) return;
  try{ batKq_(await api('ctDelete',[id]), 1, 'xoá'); await ctReload_(); toast('Đã xoá công tác'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
async function ctDuyetBulk_(on){
  var ids=ptSelRows_().map(function(r){ var c=ctOf_(r.a); return c&&c.id; }).filter(Boolean);
  if(!ids.length){ toast('Chỉ duyệt được công tác đã lưu trong cơ sở dữ liệu'); return; }
  try{ var nD=batKq_(await api('ctDuyet',ids,!!on), ids.length, 'đổi trạng thái duyệt'); S._spSel={}; await ctReload_(); toast((on?'Đã duyệt ':'Đã bỏ duyệt ')+(nD||ids.length)+' công tác'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
// Sửa hàng loạt: đổi 1 trường cho mọi công tác đang chọn (giống bảng sản phẩm)
var CT_BULK_F=[['dg','Giá bán lẻ (đ)','money'],['dgnt','Đơn giá nhà thầu (đ)','money'],['dvt','Đơn vị tính','text'],
  ['ncc','Nhà thầu · nhà cung cấp','text'],['hangMuc','Hạng mục','text'],['maNhom','Số hạng mục','text'],
  ['loai','Loại báo giá','loai'],['gc','Ghi chú','text']];
async function ctBulkEditRun_(f, val){
  var rows=ptSelRows_().filter(function(r){ return ctOf_(r.a); });
  if(!rows.length){ toast('Chỉ sửa được công tác đã lưu trong cơ sở dữ liệu'); return; }
  var def=CT_BULK_F.filter(function(x){ return x[0]===f; })[0]; if(!def) return;
  val=String(val==null?'':val).trim();
  if(val===''){ toast('Nhập giá trị mới'); return; }
  var v = def[2]==='money' ? ptMoneyN_(val) : val;
  if(!await xacNhan_('Đặt "'+def[1]+'" = "'+val+'" cho '+rows.length+' công tác đã chọn?')) return;
  var btn=document.getElementById('ctbApply'); if(btn) btn.disabled=true;
  var ok=0, err='';
  for(var i=0;i<rows.length;i++){
    var c=ctOf_(rows[i].a);
    try{ var patch=ctPatchOf_(c); patch[f]=v; var out=await api('ctUpdate', c.id, patch); Object.assign(c,out); ok++; }
    catch(e){ err=e.message; }
  }
  S._spSel={}; await ctReload_();
  toast(ok?('Đã sửa '+ok+' công tác'+(err?(' · lỗi: '+err):'')):('Lỗi: '+err));
}
async function ctDeleteBulk_(){
  var ids=ptSelRows_().map(function(r){ var c=ctOf_(r.a); return c&&c.id; }).filter(Boolean);
  if(!ids.length){ toast('Chỉ xoá được công tác đã lưu trong cơ sở dữ liệu'); return; }
  if(!await xacNhan_('Xoá '+ids.length+' công tác khỏi cơ sở dữ liệu?')) return;
  try{ var nX=batKq_(await api('ctDelete',ids), ids.length, 'xoá'); S._spSel={}; await ctReload_(); toast('Đã xoá '+(nX||ids.length)+' công tác'); }
  catch(e){ toast('Lỗi: '+e.message); }
}
/* ═══ FORM NHẬP / SỬA CÔNG TÁC (dùng chung cho popup Sửa và tab Nhập dữ liệu) ═══ */
function ctHangMucList_(){
  var m={};
  PT_TEMPLATE.forEach(function(s){ if(!s.an) m[String(s.t).split('\n')[0]]=1; });
  (S.congTac||[]).forEach(function(c){ if(c.hangMuc) m[c.hangMuc]=1; });
  return Object.keys(m).sort(function(a,b){ return a.localeCompare(b,'vi'); });
}
var CT_MODE_LBL={item:'Khối lượng × đơn giá',area:'Diện tích × hệ số (đơn giá chung của nhóm)',
  area0:'Chỉ tính khối lượng (chưa có đơn giá)',none:'Chỉ liệt kê (chưa bao gồm)'};
function ctFormHtml_(c, pre){
  c=c||{}; pre=pre||'ct';
  var mode=c.mode||'item';
  function fld(span,id,lbl,val,ph,req,list,type){
    return '<div class="f f-'+span+'"><label for="'+pre+id+'">'+esc(lbl)+(req?'<b class="req">*</b>':'')+'</label>'
      +'<input id="'+pre+id+'" type="'+(type||'text')+'"'+(list?' list="'+list+'"':'')
      +' value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'"></div>';
  }
  function num(span,id,lbl,val,ph,cls){
    return '<div class="f f-'+span+(cls?' '+cls:'')+'"><label for="'+pre+id+'">'+esc(lbl)+'</label>'
      +'<input id="'+pre+id+'" type="number" step="any" value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'"></div>';
  }
  function ta(span,id,lbl,val,ph,rows){
    return '<div class="f f-'+span+'"><label for="'+pre+id+'">'+esc(lbl)+'</label>'
      +'<textarea id="'+pre+id+'" rows="'+(rows||2)+'" placeholder="'+esc(ph||'')+'">'+esc(val==null?'':val)+'</textarea></div>';
  }
  var dg=Number(c.dg)||0, dgnt=Number(c.dgnt)||0;
  var ck=(dg&&dgnt)?ptR2((1-dgnt/dg)*100):'';
  var MODES=[['item','Khối lượng × đơn giá','Đa số công tác: 1 tim cọc, 1 m3 đất…'],
             ['area','Diện tích × hệ số','Sàn, tầng — đơn giá chung cho cả hạng mục'],
             ['area0','Chỉ tính khối lượng','Có khối lượng, đơn giá chốt sau'],
             ['none','Chỉ liệt kê','Hạng mục "chưa bao gồm"']];
  return '<div class="ctf" id="'+pre+'Form">'

    /* ── Bước 1 ── */
    +'<section class="ctf-step"><header><span class="ctf-no">1</span>'
      +'<div><h4>Công tác này là gì?</h4><p>Tên và chỗ đứng của nó trong bảng khái toán</p></div></header>'
      +'<div class="ctf-grid">'
        +fld(12,'Ten','Nội dung công việc',c.ten,'VD: Giàn tải, máy ép cọc Pmax 90T',1)
        +fld(5,'HangMuc','Hạng mục',c.hangMuc,'VD: Công tác ép cọc',1,'ctHangMucDL')
        +'<div class="f f-5"><label for="'+pre+'DeMuc">Phân loại (đề mục bóc tách)</label>'
          +'<select id="'+pre+'DeMuc">'+ctDeMucOpts_(c.deMuc,c.hangMuc)+'</select></div>'
        +fld(2,'MaNhom','Số hạng mục',c.maNhom,'II')
        +'<div class="f f-5"><label for="'+pre+'Loai">Loại báo giá<b class="req">*</b></label>'
          +'<select id="'+pre+'Loai">'+PT_LOAI.map(function(x){
              return '<option value="'+x[0]+'"'+(ptLoaiGop_(c.loai)===x[0]?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('')
        +'</select></div>'
        +fld(6,'Ncc','Nhà thầu · nhà cung cấp',c.ncc,'VD: H77',0,'ctNccDL')
        +fld(6,'Dvt','Đơn vị tính',c.dvt,'VD: m · m2 · tim · gói',1,'ctDvtDL')
      +'</div>'
      +'<datalist id="ctHangMucDL">'+ctHangMucList_().map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
      +'<datalist id="ctNccDL">'+PT_CONTRACTORS.map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
      +'<datalist id="ctDvtDL">'+['m','m2','m3','md','tim','cái','bộ','gói','tấn','ngày','tháng','tầng','hệ','điểm','công','ca']
          .map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
    +'</section>'

    /* ── Bước 2 ── */
    +'<section class="ctf-step"><header><span class="ctf-no">2</span>'
      +'<div><h4>Tính tiền thế nào?</h4><p>Chọn cách tính rồi nhập giá — hệ thống tự ra phần còn lại</p></div></header>'
      +'<div class="ctf-seg" id="'+pre+'Seg">'+MODES.map(function(m){
          return '<button type="button" class="segb'+(mode===m[0]?' on':'')+'" data-m="'+m[0]+'" onclick="ctModePick_(\''+pre+'\',\''+m[0]+'\')">'
            +'<b>'+esc(m[1])+'</b><i>'+esc(m[2])+'</i></button>'; }).join('')
      +'<input type="hidden" id="'+pre+'Mode" value="'+esc(mode)+'"></div>'
      +'<div class="ctf-grid">'
        +num(4,'Kl','Khối lượng mẫu',c.kl,'1','ct-f-kl')
        +num(4,'Dt','Diện tích mẫu (m²)',c.dt,'0','ct-f-dt')
        +num(4,'Hs','Hệ số',c.hs,'1','ct-f-hs')
        +'<div class="f f-4 ct-f-dg"><label for="'+pre+'Dg">Giá bán lẻ (đ)<b class="req">*</b></label>'
          +'<input id="'+pre+'Dg" class="ct-money" inputmode="numeric" value="'+esc(dg?money(dg):'')+'" placeholder="0" oninput="ctGiaSync_(\''+pre+'\',\'dg\')"></div>'
        +'<div class="f f-4 ct-f-ck"><label for="'+pre+'Ck">%Chiết khấu</label>'
          +'<input id="'+pre+'Ck" class="ct-pct" inputmode="decimal" value="'+esc(ck===''?'':ck)+'" placeholder="0" oninput="ctGiaSync_(\''+pre+'\',\'ck\')"></div>'
        +'<div class="f f-4 ct-f-dgnt"><label for="'+pre+'Dgnt">Giá đại lý · giá vốn (đ)</label>'
          +'<input id="'+pre+'Dgnt" class="ct-money" inputmode="numeric" value="'+esc(dgnt?money(dgnt):'')+'" placeholder="0" oninput="ctGiaSync_(\''+pre+'\',\'dgnt\')"></div>'
        +'<div class="f f-12"><div class="ctf-prev" id="'+pre+'Prev"></div></div>'
      +'</div>'
    +'</section>'

    /* ── Bước 3 ── */
    +'<section class="ctf-step"><header><span class="ctf-no">3</span>'
      +'<div><h4>Mô tả thêm <span class="opt">Không bắt buộc</span></h4><p>Ghi chú, thông số, ảnh — hiện ở panel thông tin công tác</p></div></header>'
      +'<div class="ctf-grid">'
        +ta(6,'Gc','Ghi chú · điều kiện áp dụng',c.gc,'VD: Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)',3)
        +ta(6,'PhamVi','Phạm vi ứng dụng — mỗi dòng 1 ý',c.phamVi,'Nhà phố, biệt thự có tầng hầm\nMặt bằng đủ rộng cho xe cẩu',3)
      +'</div>'
      +'<div class="ctf-sub"><span>Thông số kỹ thuật</span>'
        +'<button type="button" class="ct-addbig" onclick="ctGrpAdd_(\''+pre+'\')">'+icon('plus',13)+' Thêm đề mục lớn</button></div>'
      +'<div class="ct-grps" id="'+pre+'Grps"></div>'
      +'<input type="hidden" id="'+pre+'ThongSo" value="'+esc(c.thongSo||'')+'">'
      +'<div class="ctf-grid" style="margin-top:14px">'
        +'<div class="f f-6"><label>Ảnh công tác</label>'
          +'<div class="ct-imgrow" id="'+pre+'ImgRow"></div>'
          +'<button type="button" class="btn ghost sm" onclick="ctPickImg_(\''+pre+'\')">'+icon('plus',14)+' Thêm ảnh</button>'
          +'<input type="hidden" id="'+pre+'HinhAnh" value="'+esc(c.hinhAnh||'')+'"></div>'
        +fld(6,'LinkTaiLieu','Link tài liệu kỹ thuật',c.linkTaiLieu,'https://…')
      +'</div>'
    +'</section>'
  +'</div>';
}
/* ═══ FORM NHẬP CÔNG TÁC PHẦN THÔ — bố cục theo bản vẽ ═══
   Thông tin cơ bản (3 cột) → Thông tin giá bán → các khối "Đề mục lớn", mỗi khối là lưới
   thẻ "Đề mục nhỏ" (ô nhập + nút Lưu) → Thông tin khác (loại báo giá, cách tính, ảnh…).
   Dùng lại ĐÚNG các id của form cũ nên đọc/lưu (ctFormRead_, ctImpSave) không đổi gì. */
function ctFormHtml2_(c, pre){
  c=c||{}; pre=pre||'imp';
  var mode=c.mode||'item';
  var PLUS='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';
  var IMP=(pre==='imp');       // trang Nhập dữ liệu: cùng quy ước với form Thiết bị đèn / vệ sinh
  function lbl(id,t,req){ return '<label for="'+pre+id+'">'+esc(t)+(req?(IMP?' <span style="color:#c33">*</span>':'<b class="req">✱</b>'):'')+'</label>'; }
  function note(t){ return IMP?'<p class="dbnote c2note">'+esc(t)+'</p>':''; }
  function inp(id,t,val,ph,req,list,extra){
    return '<div class="c2f">'+lbl(id,t,req)+'<div class="c2i">'
      +'<input id="'+pre+id+'"'+(list?' list="'+list+'"':'')+' value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'"'+(extra||'')+'>'
      +(list?'<button type="button" class="c2i-b" tabindex="-1" title="Chọn từ danh sách" onclick="ctListOpen_(\''+pre+id+'\')">'+PLUS+'</button>':'')
      +'</div></div>';
  }
  var dg=Number(c.dg)||0, dgnt=Number(c.dgnt)||0, ck=(dg&&dgnt)?ptR2((1-dgnt/dg)*100):'';
  var MODES=[['item','Khối lượng × đơn giá'],['area','Diện tích × hệ số'],['area0','Chỉ tính khối lượng'],['none','Chỉ liệt kê']];
  return '<div class="ctf ctx2" id="'+pre+'Form">'
    +'<section class="c2s"><h3 class="c2h"><span class="c2hic">'+icon('tag',18)+'</span>Thông tin cơ bản</h3><div class="c2g">'
      +inp('Ten','Tên hạng mục',c.ten,'VD: Giàn tải, máy ép cọc Pmax 90T',1)
      +inp('Ncc','Nhà cung cấp (Nếu có)',c.ncc,'VD: H77',0,'ctNccDL')
      +inp('HangMuc','Hạng mục',c.hangMuc,'VD: Công tác ép cọc',1,'ctHangMucDL')
      +'<div class="c2f">'+lbl('DeMuc','Phân loại (đề mục bóc tách)',0)
        +'<div class="c2i"><select id="'+pre+'DeMuc">'+ctDeMucOpts_(c.deMuc,c.hangMuc)+'</select></div>'
        +'<p class="dbnote c2note">Công tác luôn có ở <b>3.1 Phần thô</b>. Chọn thêm đề mục (VD 3.2.2 Sơn nước) để khi bóc tách đề mục đó cũng chọn được công tác này.</p>'
      +'</div>'
    +'</div></section>'
    +'<section class="c2s"><h3 class="c2h"><span class="c2hic">'+icon('money',18)+'</span>Thông tin giá bán</h3>'
      +note('Giá đại lý tự tính = Giá bán lẻ × (1 − %Chiết khấu). Nhập giá đại lý thì %Chiết khấu tự tính ngược lại.')+'<div class="c2g">'
      +'<div class="c2f ct-f-dg">'+lbl('Dg','Giá bán lẻ',1)+'<div class="c2i"><input id="'+pre+'Dg" class="ct-money" inputmode="numeric" value="'+esc(dg?money(dg):'')+'" placeholder="VD: 450.000" oninput="ctGiaSync_(\''+pre+'\',\'dg\')"><span class="c2u">VND</span></div></div>'
      +'<div class="c2f ct-f-ck">'+lbl('Ck','%Chiết khấu',1)+'<div class="c2i"><input id="'+pre+'Ck" class="ct-pct" inputmode="decimal" value="'+esc(ck===''?'':ck)+'" placeholder="VD: 10" oninput="ctGiaSync_(\''+pre+'\',\'ck\')"><span class="c2u">%</span></div></div>'
      +'<div class="c2f ct-f-dgnt">'+lbl('Dgnt','Giá đại lý',1)+'<div class="c2i"><input id="'+pre+'Dgnt" class="ct-money" inputmode="numeric" value="'+esc(dgnt?money(dgnt):'')+'" placeholder="Tự tính" oninput="ctGiaSync_(\''+pre+'\',\'dgnt\')"><span class="c2u">VND</span></div></div>'
      +inp('Dvt','Đơn vị tính',c.dvt,'VD: gói · m · m2 · tim',1,'ctDvtDL')
      +'<div class="c2f c2-span2"><label>&nbsp;</label><div class="ctf-prev" id="'+pre+'Prev"></div></div>'
    +'</div></section>'
    +'<div id="'+pre+'Grps"></div>'
    +'<input type="hidden" id="'+pre+'ThongSo" value="'+esc(c.thongSo||'')+'">'
    +'<section class="c2s"><h3 class="c2h"><span class="c2hic">'+icon('sliders',18)+'</span>Thông tin khác'+(IMP?'':' <span class="c2opt">loại báo giá · cách tính · ảnh</span>')+'</h3>'
      +note('Loại báo giá, cách tính khối lượng và tài liệu kỹ thuật đi kèm công tác.')+'<div class="c2g">'
      +'<div class="c2f">'+lbl('Loai','Loại báo giá',1)+'<div class="c2i"><select id="'+pre+'Loai">'+PT_LOAI.map(function(x){
          return '<option value="'+x[0]+'"'+(ptLoaiGop_(c.loai)===x[0]?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('')+'</select></div>'
        +'<input type="hidden" id="'+pre+'LoaiGoc" value="'+esc(c.loai||'')+'"></div>'
      +'<div class="c2f">'+lbl('ModeSel','Cách tính',0)+'<div class="c2i"><select id="'+pre+'ModeSel" onchange="ctModePick_(\''+pre+'\',this.value)">'
          +MODES.map(function(m){ return '<option value="'+m[0]+'"'+(mode===m[0]?' selected':'')+'>'+esc(m[1])+'</option>'; }).join('')
        +'</select></div><input type="hidden" id="'+pre+'Mode" value="'+esc(mode)+'"><div id="'+pre+'Seg" style="display:none"></div></div>'
      +inp('MaNhom','Số hạng mục',c.maNhom,'VD: II')
      +'<div class="c2f ct-f-kl">'+lbl('Kl','Khối lượng mẫu',0)+'<div class="c2i"><input id="'+pre+'Kl" type="number" step="any" value="'+esc(c.kl==null?'':c.kl)+'" placeholder="1"></div></div>'
      +'<div class="c2f ct-f-dt">'+lbl('Dt','Diện tích mẫu (m²)',0)+'<div class="c2i"><input id="'+pre+'Dt" type="number" step="any" value="'+esc(c.dt==null?'':c.dt)+'" placeholder="0"></div></div>'
      +'<div class="c2f ct-f-hs">'+lbl('Hs','Hệ số',0)+'<div class="c2i"><input id="'+pre+'Hs" type="number" step="any" value="'+esc(c.hs==null?'':c.hs)+'" placeholder="1"></div></div>'
      +'<div class="c2f">'+lbl('Gc','Ghi chú · điều kiện áp dụng',0)+'<div class="c2i"><textarea id="'+pre+'Gc" rows="2" placeholder="VD: Đơn giá cho trên 20m/tim cọc">'+esc(c.gc||'')+'</textarea></div></div>'
      +'<div class="c2f">'+lbl('PhamVi','Phạm vi ứng dụng',0)+'<div class="c2i"><textarea id="'+pre+'PhamVi" rows="2" placeholder="Mỗi dòng 1 ý">'+esc(c.phamVi||'')+'</textarea></div></div>'
      +inp('LinkTaiLieu','Link tài liệu kỹ thuật',c.linkTaiLieu,'https://…')
      +(IMP?'<input type="hidden" id="'+pre+'HinhAnh" value="'+esc(c.hinhAnh||'')+'">'      // ảnh: khối Ảnh dùng chung ở đầu trang
        :('<div class="c2f c2-span3 ct-f-img"><label>Ảnh công tác</label><div class="ct-imgrow" id="'+pre+'ImgRow"></div>'
        +'<button type="button" class="btn ghost sm" onclick="ctPickImg_(\''+pre+'\')">'+icon('plus',14)+' Thêm ảnh</button>'
        +'<input type="hidden" id="'+pre+'HinhAnh" value="'+esc(c.hinhAnh||'')+'"></div>'))
    +'</div></section>'
    +'<datalist id="ctHangMucDL">'+ctHangMucList_().map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
    +'<datalist id="ctNccDL">'+PT_CONTRACTORS.map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
    +'<datalist id="ctDvtDL">'+['m','m2','m3','md','tim','cái','bộ','gói','tấn','ngày','tháng','tầng','hệ','điểm','công','ca']
        .map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>'
  +'</div>';
}
// nút ＋ trong ô có danh sách gợi ý: mở danh sách chọn
function ctListOpen_(id){ var e=document.getElementById(id); if(!e) return; e.focus(); try{ if(e.showPicker) e.showPicker(); }catch(x){} }
/* Đề mục lớn / nhỏ dạng THẺ: mỗi đề mục lớn là 1 khối, mỗi đề mục nhỏ là 1 thẻ nhập + Lưu */
function ctGrpRenderCards_(pre){
  var box=document.getElementById(pre+'Grps'); if(!box) return;
  var grps=ctGrpsGet_(pre);
  if(!grps.length){ grps.push({t:'',rows:[{k:'',v:''},{k:'',v:''},{k:'',v:''}]}); }
  var PLUS='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';
  var IMP=(pre==='imp');
  box.innerHTML=grps.map(function(g,gi){
    return '<section class="c2s c2grp">'
      +'<div class="c2gh"><span class="c2hic">'+icon('doc',18)+'</span><input class="c2gt" id="'+pre+'GT'+gi+'" value="'+esc(g.t||'')+'" placeholder="Đề mục lớn — VD: Thông số kỹ thuật tham khảo">'
        +'<button type="button" class="c2plus" title="Thêm đề mục lớn" onclick="ctGrpAddCard_(\''+pre+'\','+gi+')">'+PLUS+'</button>'
        +(grps.length>1?'<button type="button" class="c2del" title="Xoá đề mục lớn này" onclick="ctGrpDel_(\''+pre+'\','+gi+')">Xoá</button>':'')
      +'</div>'
      +((IMP&&gi===0)?'<p class="dbnote c2note">Thông số kỹ thuật của công tác — đặt tên đề mục lớn, mỗi ô đề mục nhỏ 1 thông tin (VD Lực ép tối đa: 90 tấn). Bấm + để thêm.</p>':'')
      +'<div class="c2g">'+g.rows.map(function(r,ri){
          var txt=(r.k&&String(r.k).trim())?(String(r.k).trim()+': '+(r.v||'')):(r.v||'');
          return '<div class="c2card'+(r._ok?' ok':'')+'">'
            +'<div class="c2ch"><b>Đề mục nhỏ</b>'
              +'<button type="button" class="c2plus sm" title="Thêm đề mục nhỏ" onclick="ctCardAdd_(\''+pre+'\','+gi+','+ri+')">'+PLUS+'</button>'
              +'<button type="button" class="c2x" title="Xoá đề mục nhỏ" onclick="ctRowDel_(\''+pre+'\','+gi+','+ri+')">✕</button></div>'
            +'<div class="c2cb"><textarea id="'+pre+'GV'+gi+'_'+ri+'" placeholder="Nhập thông tin đề mục nhỏ — VD: Lực ép tối đa: 90 tấn" oninput="this.closest(\'.c2card\').classList.remove(\'ok\')">'+esc(txt)+'</textarea>'
              +'<button type="button" class="c2save" onclick="ctCardSave_(\''+pre+'\','+gi+','+ri+')">'+(r._ok?'Đã lưu ✓':'Lưu')+'</button></div>'
          +'</div>';
        }).join('')+'</div>'
    +'</section>';
  }).join('');
}
function ctGrpAddCard_(pre,gi){ var g=ctGrpRead_(pre); g.splice(gi+1,0,{t:'',rows:[{k:'',v:''},{k:'',v:''},{k:'',v:''}]}); ctGrpSet_(pre,g); }
function ctCardAdd_(pre,gi,ri){ var g=ctGrpRead_(pre); g[gi].rows.splice(ri+1,0,{k:'',v:''}); ctGrpSet_(pre,g); }
function ctCardSave_(pre,gi,ri){
  var g=ctGrpRead_(pre), r=g[gi]&&g[gi].rows[ri]; if(!r) return;
  if(!String(r.v||'').trim()){ toast('Nhập thông tin đề mục nhỏ trước'); return; }
  r._ok=true; ctGrpSet_(pre,g);
  toast('Đã lưu đề mục nhỏ — bấm "Đưa vào danh sách chờ" để ghi cả công tác');
}
function ctModePick_(pre,m){
  var h=document.getElementById(pre+'Mode'); if(h) h.value=m;
  var seg=document.getElementById(pre+'Seg');
  if(seg) seg.querySelectorAll('.segb').forEach(function(b){ b.classList.toggle('on', b.dataset.m===m); });
  ctModeSync_(pre);
}
/* Giá bán lẻ ⟷ %Chiết khấu ⟷ Giá đại lý: gõ ô nào cũng tự tính 2 ô còn lại */
function ctGiaSync_(pre,src){
  var eDg=document.getElementById(pre+'Dg'), eCk=document.getElementById(pre+'Ck'), eNt=document.getElementById(pre+'Dgnt');
  if(!eDg||!eCk||!eNt) return;
  var dg=ptMoneyN_(eDg.value), nt=ptMoneyN_(eNt.value), ck=ptN(String(eCk.value).replace(',','.'));
  if(src==='dg'||src==='ck'){
    if(dg&&ck) nt=Math.round(dg*(1-ck/100));
    else if(dg&&!ck&&src==='dg'&&nt) ck=ptR2((1-nt/dg)*100);
  }else if(src==='dgnt'){
    if(dg&&nt) ck=ptR2((1-nt/dg)*100);
  }
  if(src!=='dgnt') eNt.value=nt?money(nt):'';
  if(src!=='ck')   eCk.value=(ck||ck===0)?ck:'';
  if(src!=='dg')   eDg.value=dg?money(dg):'';
  ctPrev_(pre);
}
/* ── Đề mục lớn / đề mục nhỏ ──
   Lưu vào 1 ô text: "## Tên đề mục lớn" rồi các dòng "Tên: giá trị" — dễ đọc, dễ sửa tay,
   và panel thông tin hiện đúng từng nhóm.                                              */
function ctGrpParse_(txt){
  var out=[], cur=null;
  String(txt||'').split(/\r?\n/).forEach(function(raw){
    var l=raw.trim(); if(!l) return;
    // dòng thụt vào = dòng tiếp theo của CÙNG một đề mục nhỏ (thẻ nhập nhiều dòng)
    if(/^\s+/.test(raw) && cur && cur.rows.length){ var last=cur.rows[cur.rows.length-1]; last.v=(last.v?last.v+'\n':'')+l; return; }
    var m=l.match(/^##\s*(.*)$/);
    if(m){ cur={t:m[1].trim(),rows:[]}; out.push(cur); return; }
    if(!cur){ cur={t:'Thông số kỹ thuật',rows:[]}; out.push(cur); }
    var kv=l.match(/^([^:：]{1,60})[:：]\s*(.*)$/);
    cur.rows.push(kv?{k:kv[1].trim(),v:kv[2].trim()}:{k:'',v:l});
  });
  return out;
}
function ctGrpText_(grps){
  grps=(grps||[]).filter(function(g){ return String(g.t||'').trim() || (g.rows||[]).some(function(r){ return String(r.k||'').trim()||String(r.v||'').trim(); }); });
  return grps.map(function(g){
    return '## '+(g.t||'Thông số kỹ thuật')+'\n'
      +g.rows.filter(function(r){ return (r.k||'').trim()||(r.v||'').trim(); })
             .map(function(r){ var t=(r.k||'').trim()?((r.k).trim()+': '+(r.v||'').trim()):(r.v||'').trim();
               return t.split(/\r?\n/).map(function(x,i){ return i?('  '+x.trim()):x; }).join('\n'); }).join('\n');
  }).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function ctGrpsGet_(pre){
  S._ctGrp=S._ctGrp||{};
  if(!S._ctGrp[pre]) S._ctGrp[pre]=ctGrpParse_((document.getElementById(pre+'ThongSo')||{}).value||'');
  return S._ctGrp[pre];
}
function ctGrpSet_(pre,g){ S._ctGrp=S._ctGrp||{}; S._ctGrp[pre]=g; ctGrpRender_(pre); }
function ctGrpSave_(pre){
  var el=document.getElementById(pre+'ThongSo'); if(el) el.value=ctGrpText_(ctGrpsGet_(pre));
}
function ctGrpRead_(pre){                     // đọc lại từ DOM trước khi lưu
  var grps=ctGrpsGet_(pre);
  grps.forEach(function(g,gi){
    var t=document.getElementById(pre+'GT'+gi); if(t) g.t=t.value;
    g.rows.forEach(function(r,ri){
      var k=document.getElementById(pre+'GK'+gi+'_'+ri), v=document.getElementById(pre+'GV'+gi+'_'+ri);
      if(k) r.k=k.value;
      if(v){ if(!k && v.tagName==='TEXTAREA') r.k=''; r.v=v.value; }   // thẻ đề mục nhỏ: cả nội dung trong 1 ô
    });
  });
  ctGrpSave_(pre);
  return grps;
}
function ctGrpAdd_(pre){ var g=ctGrpRead_(pre); g.push({t:'',rows:[{k:'',v:''}]}); ctGrpSet_(pre,g); }
function ctGrpDel_(pre,gi){ var g=ctGrpRead_(pre); g.splice(gi,1); ctGrpSet_(pre,g); }
function ctRowAdd_(pre,gi){ var g=ctGrpRead_(pre); g[gi].rows.push({k:'',v:''}); ctGrpSet_(pre,g); }
function ctRowDel_(pre,gi,ri){ var g=ctGrpRead_(pre); g[gi].rows.splice(ri,1); if(!g[gi].rows.length) g[gi].rows.push({k:'',v:''}); ctGrpSet_(pre,g); }
function ctGrpRender_(pre){
  var f=document.getElementById(pre+'Form');
  if(f && f.classList.contains('ctx2')) return ctGrpRenderCards_(pre);
  var box=document.getElementById(pre+'Grps'); if(!box) return;
  var grps=ctGrpsGet_(pre);
  if(!grps.length){
    box.innerHTML='<div class="ct-grp-empty">Chưa có đề mục nào. Bấm <b>Thêm đề mục lớn</b> để mô tả thông số kỹ thuật '
      +'(VD: <i>Thông số kỹ thuật tham khảo</i> → <i>Lực ép tối đa (Pmax): 90 tấn</i>).</div>';
    return;
  }
  box.innerHTML=grps.map(function(g,gi){
    return '<div class="ct-grp">'
      +'<div class="ct-grp-h">'
        +'<input class="ct-grp-t" id="'+pre+'GT'+gi+'" value="'+esc(g.t||'')+'" placeholder="Tên đề mục lớn — VD: Thông số kỹ thuật tham khảo">'
        +'<button type="button" class="ct-grp-x" title="Xoá đề mục lớn" onclick="ctGrpDel_(\''+pre+'\','+gi+')">✕</button>'
      +'</div>'
      +'<div class="ct-grp-b">'+g.rows.map(function(r,ri){
        return '<div class="ct-kv">'
          +'<input class="ct-kv-k" id="'+pre+'GK'+gi+'_'+ri+'" value="'+esc(r.k||'')+'" placeholder="Tên đề mục nhỏ">'
          +'<input class="ct-kv-v" id="'+pre+'GV'+gi+'_'+ri+'" value="'+esc(r.v||'')+'" placeholder="Giá trị / mô tả">'
          +'<button type="button" class="ct-kv-x" title="Xoá dòng" onclick="ctRowDel_(\''+pre+'\','+gi+','+ri+')">✕</button>'
        +'</div>';
      }).join('')+'</div>'
      +'<button type="button" class="ct-addsmall" onclick="ctRowAdd_(\''+pre+'\','+gi+')">'+icon('plus',12)+' Thêm đề mục nhỏ</button>'
    +'</div>';
  }).join('');
}
function ctModeSync_(pre){
  var m=(document.getElementById(pre+'Mode')||{}).value||'item';
  var box=document.getElementById(pre+'Form'); if(!box) return;
  function show(cls,on){ box.querySelectorAll('.'+cls).forEach(function(e){ e.style.display=on?'':'none'; }); }
  show('ct-f-kl', m==='item');
  show('ct-f-dt', m==='area'||m==='area0');
  show('ct-f-hs', m==='area'||m==='area0');
  show('ct-f-dgnt', m==='item');
  show('ct-f-ck', m==='item');
  show('ct-f-dg', m==='item'||m==='area');
  ctGiaSync_(pre,'');
}
// Dòng xem trước: đúng như dòng sẽ nằm trong bảng khái toán
function ctPrev_(pre){
  var box=document.getElementById(pre+'Prev'); if(!box) return;
  function v(id){ var e=document.getElementById(pre+id); return e?String(e.value||'').trim():''; }
  var m=v('Mode')||'item', dvt=v('Dvt')||'—';
  var dg=ptMoneyN_(v('Dg')), nt=ptMoneyN_(v('Dgnt'));
  var kl = m==='item' ? (ptN(v('Kl'))||0) : (ptN(v('Dt'))*(ptN(v('Hs'))||0));
  if(m==='none'){ box.innerHTML='<span class="pv-l">Dòng trong bảng</span><b>Chỉ liệt kê, không tính tiền</b>'; return; }
  var tt=Math.round(kl*dg), ln=Math.round(kl*(dg-nt)), pct=dg?((dg-nt)/dg*100):0;
  box.innerHTML='<span class="pv-l">Dòng trong bảng</span>'
    +'<b>'+ptQty(kl||0)+' '+esc(dvt)+' × '+money(dg)+' đ = '+money(tt)+' đ</b>'
    +(nt?'<i class="'+(ln<0?'neg':'')+'">Lợi nhuận '+money(ln)+' đ · '+pct.toFixed(1)+'%</i>':'<i>Chưa nhập giá vốn</i>');
}
function ctFormInit_(pre){
  ctImgRender_(pre); ctGrpRender_(pre); ctModeSync_(pre); ctGiaSync_(pre,'');
  var f=document.getElementById(pre+'Form');
  if(f) f.addEventListener('input',function(e){
    if(/^(.*)(Kl|Dt|Hs|Dvt)$/.test(e.target.id)) ctPrev_(pre);
    if(/HangMuc$/.test(e.target.id)) ctDeMucSync_(pre);
  });
  ctDeMucSync_(pre);
}
function ctImgRender_(pre){
  var box=document.getElementById(pre+'ImgRow'); if(!box) return;
  var v=(document.getElementById(pre+'HinhAnh')||{}).value||'';
  var arr=String(v).split('\n').map(function(x){return x.trim();}).filter(Boolean);
  box.innerHTML=arr.length?arr.map(function(u,i){
    return '<div class="ct-img"><img src="'+esc(imgUrlOf(u))+'" onerror="this.style.visibility=\'hidden\'">'
      +'<button type="button" class="ct-imgx" title="Bỏ ảnh này" onclick="ctImgDel_(\''+pre+'\','+i+')">✕</button></div>';
  }).join(''):'<span class="ct-noimg">Chưa có ảnh — bấm "Thêm ảnh" để tải lên</span>';
}
function ctImgDel_(pre,i){
  var el=document.getElementById(pre+'HinhAnh'); if(!el) return;
  var arr=String(el.value||'').split('\n').map(function(x){return x.trim();}).filter(Boolean);
  arr.splice(i,1); el.value=arr.join('\n'); ctImgRender_(pre);
}
async function ctPickImg_(pre){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
  inp.onchange=async function(){
    var fs=Array.prototype.slice.call(inp.files||[]); if(!fs.length) return;
    var el=document.getElementById(pre+'HinhAnh'); if(!el) return;
    toast('Đang tải '+fs.length+' ảnh…');
    for(var i=0;i<fs.length;i++){
      try{
        var d=await downscaleImage_(fs[i],1600,0.82);
        if(!d||d==='__DECODE_FAIL__'){ toast('Không đọc được ảnh '+fs[i].name); continue; }
        var tok=await uploadImg_(d, fs[i].name||'cong-tac.jpg');
        el.value=(el.value?el.value+'\n':'')+tok; ctImgRender_(pre);
      }catch(e){ toast('Lỗi tải ảnh: '+e.message); }
    }
    toast('Đã tải xong ảnh');
  };
  inp.click();
}
function ctFormRead_(pre){
  function v(id){ var e=document.getElementById(pre+id); return e?String(e.value||'').trim():''; }
  function num(id){ var t=v(id); return t===''?'':ptN(t); }
  ctGrpRead_(pre);
  var anh=v('HinhAnh');
  // Trang Nhập dữ liệu: ảnh lấy từ khối Ảnh dùng chung (bỏ ảnh xem trước chưa tải xong)
  if(pre==='imp' && document.getElementById('upMain'))
    anh=[S._imgMain].concat(S._imgList||[]).filter(function(x){ return x && String(x).indexOf('data:')!==0; }).join('\n');
  var loai=v('Loai'), goc=v('LoaiGoc');
  if(goc && ptLoaiGop_(goc)===loai) loai=goc;                  // vẫn là Khái toán -> giữ giá trị gốc (vd kt_sobo của báo giá mẫu)
  return {loai:loai, mode:v('Mode')||'item', maNhom:v('MaNhom'), hangMuc:v('HangMuc'), deMuc:v('DeMuc'), ten:v('Ten'),
    ncc:v('Ncc'), dvt:v('Dvt'), kl:num('Kl'), dt:num('Dt'), hs:num('Hs'),
    dgnt:ptMoneyN_(v('Dgnt')), dg:ptMoneyN_(v('Dg')),
    gc:v('Gc'), thongSo:v('ThongSo'), phamVi:v('PhamVi'), linkTaiLieu:v('LinkTaiLieu'), hinhAnh:anh};
}
function ctEditModal_(id){
  var c=(S.congTac||[]).filter(function(x){ return x.id===id; })[0]; if(!c) return;
  spClose();
  var ov=document.createElement('div'); ov.className='sp-modal-ov'; ov.id='spModalOv';
  ov.onclick=function(e){ if(e.target===ov) spClose(); };
  ov.innerHTML='<div class="sp-modal sp-modal-wide pd ctmodal"><div class="pd-head"><h3>Cập nhật công tác</h3>'
      +'<span class="spduyet'+(c.daDuyet?' on':'')+'">'+(c.daDuyet?'Đã duyệt':'Chưa duyệt')+'</span>'
      +'<button class="pd-x" onclick="spClose()">✕</button></div>'
    +'<div class="spe-2col ct-2col"><div class="spe-body">'+ctFormHtml_(c,'ctm')
      +'<div class="pd-actions">'
        +'<button class="btn ghost sm" onclick="spClose()">Đóng</button>'
        +(spCanDuyet_()?'<button class="btn ghost sm" onclick="ctDuyet_(\''+c.id+'\','+(c.daDuyet?0:1)+');spClose()">'+icon('check',14)+' '+(c.daDuyet?'Bỏ duyệt':'Duyệt')+'</button>':'')
        +'<button class="btn blue" onclick="ctSaveModal_(\''+c.id+'\')">'+icon('check',15)+' Lưu thay đổi</button>'
      +'</div></div>'
      +'<aside class="spe-side" id="ctSide">'+ctSideHtml_(c,null)+'</aside></div>'
    +'</div>';
  document.body.appendChild(ov);
  document.addEventListener('keydown',spModalKey_);
  S._ctGrp={}; ctFormInit_('ctm');
  ctLoadHistory_(id);
}
/* Cột phải form công tác: người tạo · người sửa · trạng thái duyệt · lịch sử cập nhật
   (dựng đúng khối của form sản phẩm đèn để 2 hạng mục giống nhau) */
function ctSideHtml_(c,hist){
  var histHtml;
  if(hist==null) histHtml='<div class="empty" style="padding:14px;font-size:12.5px">Đang tải…</div>';
  else if(!hist.length) histHtml='<div class="empty" style="padding:14px;font-size:12.5px">Chưa có lịch sử cập nhật.</div>';
  else histHtml=hist.map(function(h){
    return '<div class="spe-h"><div class="spe-h-top"><b>'+esc(h.field)+'</b>'
        +'<span class="spe-h-by">'+icon('clock',11)+' '+esc(h.by||'?')+' · '+fmtDateTime_(h.at)+'</span></div>'
      +'<div class="spe-h-diff"><span class="old">'+esc(h.old||'—')+'</span><span class="arr">→</span>'
        +'<span class="new">'+esc(h.new||'—')+'</span></div></div>';
  }).join('');
  return '<div class="spe-who">'
      +'<span>'+icon('plus',13)+' Tạo bởi <b>'+esc(c.nguoiTao||'—')+'</b>'+(c.ngayTao?' · '+esc(fmtDate(c.ngayTao)):'')+'</span>'
      +'<span>'+icon('edit',13)+' Sửa cuối bởi <b>'+esc(c.nguoiSua||'—')+'</b>'+(c.ngayCapNhat?' · '+esc(fmtDateTime_(c.ngayCapNhat)):'')+'</span>'
      +(c.daDuyet?'<span class="ok">'+icon('check',13)+' Duyệt bởi <b>'+esc(c.nguoiDuyet||'—')+'</b>'+(c.ngayDuyet?' · '+esc(fmtDateTime_(c.ngayDuyet)):'')+'</span>'
                : '<span class="warn">'+icon('clock',13)+' Chưa duyệt</span>')
    +'</div>'
    +'<div class="spe-hist"><div class="spe-hist-h">'+icon('clock',15)+' Lịch sử cập nhật '
      +'<span class="spe-hist-n">'+(hist?hist.length:'…')+'</span></div>'
    +'<div class="spe-hist-list">'+histHtml+'</div></div>';
}
async function ctLoadHistory_(id){
  var hist=[]; S._ctHistId=id;
  try{ hist=await api('ctHistory', id)||[]; }catch(e){ hist=[]; }
  var c=(S.congTac||[]).filter(function(x){ return x.id===id; })[0];
  var side=document.getElementById('ctSide');
  if(side&&c&&S._ctHistId===id) side.innerHTML=ctSideHtml_(c,hist);   // đã mở công tác khác -> bỏ
}
async function ctSaveModal_(id){
  var d=ctFormRead_('ctm');
  if(!d.ten){ toast('Nhập nội dung công việc'); return; }
  if(!d.hangMuc){ toast('Nhập hạng mục'); return; }
  try{
    var out=await api('ctUpdate', id, d);
    var i=(S.congTac||[]).findIndex(function(x){ return x.id===id; });
    if(i>=0) S.congTac[i]=out;
    ctSyncTemplate_(); spClose();
    if(spPTMode_()) spFilter(); if(S.node==='3.1'){ renderPTLibrary(); }
    toast('Đã lưu công tác');
  }catch(e){ toast('Lỗi lưu: '+e.message); }
}
/* ═══ SỬA GIÁ / THÔNG SỐ CÔNG TÁC NGAY TRÊN BẢNG ═══
   Thư viện công tác nằm trong code (PT_TEMPLATE) nên phần người dùng sửa được lưu riêng
   ở localStorage 'qs_ptovr', khoá theo loại báo giá + hạng mục + tên + ĐVT để không lệch
   khi thư viện thêm/bớt dòng. Giá đã sửa dùng chung cho: thư viện trái, bảng Danh sách
   sản phẩm, panel thông tin và cả lúc thêm công tác vào bảng khái toán.                  */
function ptOvrAll_(){
  if(!S._ptOvr){ try{ S._ptOvr=JSON.parse(localStorage.getItem('qs_ptovr')||'{}')||{}; }catch(e){ S._ptOvr={}; } }
  return S._ptOvr;
}
function ptOvrKey_(sec,a){ return [ptSecLoai_(sec),String(sec.t).split('\n')[0],String(a[0]).split('\n')[0],String(a[1]||'')].join('|'); }
function ptOvrOf_(sec,a){ return ptOvrAll_()[ptOvrKey_(sec,a)]||null; }
function ptOvrSet_(sec,a,f,v){
  var U=ptOvrAll_(), k=ptOvrKey_(sec,a), o=U[k]||{};
  if(v===''||v==null) delete o[f]; else o[f]=v;
  if(Object.keys(o).length) U[k]=o; else delete U[k];
  try{ localStorage.setItem('qs_ptovr',JSON.stringify(U)); }catch(e){ toast('Không lưu được (bộ nhớ trình duyệt đầy)'); }
}
function ptOvrDaSua_(sec,a){ return ctOf_(a)?false:!!ptOvrOf_(sec,a); }
// Giá trị gốc của 1 trường theo kiểu hạng mục
function ptBase_(sec,a,f){
  var c=ctOf_(a);
  if(c){ var v=c[f]; if(f==='dg'&&sec.mode==='area'&&!v) v=Number(sec.up)||0; return (v==null?'':v); }
  if(f==='dvt') return a[1]||'';
  if(sec.mode==='item'){ if(f==='kl') return Number(a[2])||0; if(f==='dg') return Number(a[3])||0; if(f==='gc') return a[4]||''; if(f==='dgnt') return Number(a[5])||0; return ''; }
  if(sec.mode==='area'||sec.mode==='area0'){ if(f==='dt') return Number(a[2])||0; if(f==='hs') return Number(a[3])||0; if(f==='gc') return a[4]||'';
    if(f==='dg') return (sec.mode==='area')?(Number(sec.up)||0):0; return ''; }
  if(f==='gc') return a[2]||'';
  return '';
}
// Giá trị đang dùng (đã áp phần sửa của người dùng)
function ptVal_(sec,a,f){
  if(ctOf_(a)) return ptBase_(sec,a,f);          // dòng CSDL: sửa thẳng vào bản ghi, không cần lớp đè
  var o=ptOvrOf_(sec,a);
  if(o && o[f]!=null && o[f]!=='') return (['kl','dt','hs','dg','dgnt'].indexOf(f)>=0)?(Number(o[f])||0):o[f];
  return ptBase_(sec,a,f);
}
// Trường nào sửa được ở hạng mục này (đơn giá của nhóm 'area' là giá chung -> không sửa lẻ)
function ptCanEditF_(sec,f){
  if(ctSecOf_(sec)){
    if(f==='dvt'||f==='gc') return true;
    if(sec.mode==='item') return ['kl','dt','hs','dg','dgnt'].indexOf(f)>=0;
    if(sec.mode==='area'||sec.mode==='area0') return ['dt','hs','dg'].indexOf(f)>=0;
    return false;
  }
  if(f==='dvt'||f==='gc') return true;
  if(sec.mode==='item') return ['kl','dt','hs','dg','dgnt'].indexOf(f)>=0;
  if(sec.mode==='area'||sec.mode==='area0') return ['dt','hs'].indexOf(f)>=0;
  return false;
}
// Dựng 1 dòng item để thêm vào bảng khái toán — luôn lấy giá ĐANG dùng
function ptMakeItem_(sec,a){
  if(sec.mode==='item') return {n:a[0],dvt:ptVal_(sec,a,'dvt'),kl:ptVal_(sec,a,'kl'),dg:ptVal_(sec,a,'dg'),gc:ptVal_(sec,a,'gc'),dgnt:ptVal_(sec,a,'dgnt')};
  if(sec.mode==='area'||sec.mode==='area0') return {n:a[0],dvt:ptVal_(sec,a,'dvt'),dt:ptVal_(sec,a,'dt'),hs:ptVal_(sec,a,'hs'),gc:ptVal_(sec,a,'gc')};
  return {n:a[0],dvt:ptVal_(sec,a,'dvt'),gc:ptVal_(sec,a,'gc')};
}
// công tác đã có trong bảng của dự án đang mở chưa (so theo tên + đúng hạng mục/loại)
function ptDaCo_(sec,a){
  var ten=String(a[0]);
  var s=(S.phanTho||[]).filter(function(x){ return x.t===sec.t && ptSecLoai_(x)===ptSecLoai_(sec); })[0];
  return !!(s && (s.items||[]).some(function(it){ return String(it.n||'')===ten; }));
}
function ptLibDg_(sec,a){ if(sec.mode==='item') return ptVal_(sec,a,'dg'); if(sec.mode==='area') return Number(sec.up)||0; return 0; }
function renderPTLibrary(){
  var el=document.getElementById('catList'); if(!el) return;
  var loai=ptLoai_(), secs=ptSecsOfLoai_(loai);
  var cc=document.getElementById('catCount');
  if(cc) cc.textContent=secs.reduce(function(s,se){return s+se.items.length;},0)+' công việc';
  var cur=S._ptContractor||'';
  var meta=PT_LOAI.filter(function(x){ return x[0]===loai; })[0]||PT_LOAI[0];
  // Bộ lọc PHÂN LOẠI + Nhà thầu + Báo giá mẫu (theo sơ đồ nghiệp vụ)
  /* Theo sơ đồ nghiệp vụ: ① Hạng mục sản phẩm (loại báo giá) → ② Tên nhà thầu → ③ Dự án mẫu (chỉ Khái toán sơ bộ)
     → kết quả (báo giá theo m2/md/cái · đơn giá trọn gói · báo giá vật tư). */
  var nh=PT_LOAI_NHOM.filter(function(g){ return g[3].some(function(x){ return x[0]===loai; }); })[0]||PT_LOAI_NHOM[0];
  var lx=nh[3].filter(function(x){ return x[0]===loai; })[0]||nh[3][0];
  var buoc=0;
  function msel(lb, val, js, on, sub){ buoc++;
    return '<div class="pt-step"><span class="pt-sn">'+buoc+'</span><div class="pt-sb"><div class="pt-sl">'+esc(lb)+'</div>'
      +'<div class="msel pt-msel'+(on?' active':'')+'" onclick="'+js+'"><span class="mlabel">'+val+'</span>'
      +'<span class="mplus">'+SVG_PLUS+'</span></div>'+(sub?'<div class="pt-shint">'+sub+'</div>':'')+'</div></div>'; }
  var top='<div class="ptlib-top pt-flow">'
    +msel('Hạng mục sản phẩm', '<b>'+esc(nh[2])+'</b> · '+esc(lx[2].replace(/^Khái toán (\S)/,function(m,c){ return c.toUpperCase(); })), 'ptMselPop_(event,\'loai\')', true)
    +msel('Tên nhà thầu', cur?('<b>'+esc(cur)+'</b>'):'Chọn nhà thầu', 'ptMselPop_(event,\'ncc\')', !!cur)
    +(loai==='kt_sobo'?msel('Dự án mẫu','Chọn dự án mẫu → lấy cả bộ đơn giá','ptMselPop_(event,\'mau\')',false):'')
    +'<div class="pt-out">'+icon('check',13)+' '+esc({kt_chitiet:'Ra báo giá theo m2 / md / cái',kt_sobo:'Ra đơn giá theo đơn gói',
        dt_nhancong:'Ra báo giá theo m2 / md / cái',dt_vattu:'Ra báo giá vật tư'}[loai]||'')+'</div>'
    +'</div>';
  if(loai.indexOf('dt_')===0) top+=dtPanel_(loai);           // Dự toán: thêm bảng số liệu đầu vào + khối lượng
  var fw=document.getElementById('ptFilters'); if(fw) fw.innerHTML=top;   // khối lọc nằm ngay dưới ô Đề mục
  if(!secs.length){
    el.innerHTML='<div class="ptlib-empty">'+icon('layers',22)
      +'<b>Chưa có bảng giá cho "'+esc(meta[1])+'"</b>'
      +'<span>Gửi file Excel bảng giá của mục này để nạp vào thư viện, hoặc chọn loại khác ở ô trên.</span></div>';
    return;
  }
  // Dự toán: danh sách dưới đây chỉ để thêm LẺ khi thiếu — đường đi chính là nút "Dùng bộ dự toán này" ở trên
  var dtHint=(loai.indexOf('dt_')===0)
    ? '<p class="ptlib-dthint">Danh sách dưới đây là các công tác <b>trong bộ dự toán</b> — chỉ dùng khi cần thêm lẻ một dòng bị xoá.</p>' : '';
  el.innerHTML=dtHint+'<div class="ptlib">'+secs.map(function(sec){
    var si=PT_TEMPLATE.indexOf(sec);                    // giữ chỉ số THẬT để thêm đúng nhóm
    var col=S._ptLibCol&&S._ptLibCol[si];
    var nDaCo=sec.items.filter(function(a){ return ptDaCo_(sec,a); }).length;
    return '<div class="ptlib-sec"><div class="ptlib-h" onclick="ptLibToggle('+si+')">'
        +'<span class="ptlib-caret">'+(col?'▸':'▾')+'</span><span class="ptlib-htt">'+esc(sec.r)+'. '+esc(String(sec.t).split('\n')[0])+'</span>'
        +(function(){ var dm=ctSecDeMuc_(sec); return dm
            ?'<span class="ptlib-dm" title="Nhóm này còn hiện ở đề mục '+esc(dm+' '+nodeName(dm))+' khi bóc tách">'+esc(dm)+'</span>':''; })()
        +'<span class="ptlib-hn'+(nDaCo?' on':'')+'" title="'+(nDaCo?('Đã thêm '+nDaCo+'/'+sec.items.length+' công tác'):(sec.items.length+' công tác'))+'">'
          +(nDaCo?(nDaCo+'/'+sec.items.length):sec.items.length)+'</span>'
        +'<button class="ptlib-secadd" title="Thêm cả nhóm vào bảng" onclick="event.stopPropagation();ptAddToSec_('+si+')">+</button></div>'
      +(col?'':'<div class="ptlib-items">'+sec.items.map(function(a,ii){
        var dg=ptLibDg_(sec,a);
        var dt=S._ptDetail, on=(dt&&dt.si===si&&dt.ii===ii);
        var inf=ptInfo_(String(a[0])), coTL=!!(inf.anh||inf.ts||inf.pv||inf.tl||inf.model);
        var da=ptDaCo_(sec,a);
        var gc=(sec.mode==='none')?(a[2]||''):(a[4]||'');
        var ctr=ctOf_(a);
        return '<div class="ptlib-item'+(on?' on':'')+(da?' da':'')+'" title="Bấm để xem thông tin công tác · kéo để thả vào bảng"'
          +' draggable="true" ondragstart="ptLibDragStart_(event,'+si+','+ii+')" ondragend="ptLibDragEnd_()"'
          +' onclick="ptShowDetail_('+si+','+ii+')">'
          +'<div class="ptlib-nm" title="'+esc(String(a[0]).replace(/\n/g,' ')+(gc?(' — '+gc):''))+'">'+esc(String(a[0]).split('\n')[0])
            +(coTL?'<span class="ptlib-info" title="Đã có ảnh / thông số kỹ thuật">'+icon('doc',11)+'</span>':'')+'</div>'
          +'<div class="ptlib-meta">'
            +'<span class="ptlib-dvt">'+esc(a[1]||'')+'</span>'
            +'<span class="ptlib-dg">'+(dg?(money(dg)+' đ'):'—')+'</span>'
            +(da?'<span class="ptlib-da" title="Công tác này đã có trong bảng">✓ đã thêm</span>':'')
          +'</div>'
          +'<div class="ptlib-act">'
            +(ctr?'<button class="ptlib-fav'+(ctr.yeuThich?' on':'')+'" title="'+(ctr.yeuThich?'Bỏ khỏi công tác yêu thích':'Thêm vào công tác yêu thích')+'" onclick="event.stopPropagation();ctFav_(\''+ctr.id+'\','+(ctr.yeuThich?0:1)+')">'+icon('heart',13)+'</button>':'')
            +'<button class="ptlib-add" title="Thêm vào bảng ước tính" onclick="event.stopPropagation();ptAddFromLib('+si+','+ii+')">'+icon('plus',14)+'</button>'
          +'</div></div>';
      }).join('')+'</div>')+'</div>';
  }).join('')+'</div>';
}

/* ═══════════ BẢNG KHÁI TOÁN: các thao tác kiểu bảng tính, GIỐNG bảng Bóc tách ═══════════
   Bảng đèn có sẵn: chuột phải ra menu, lọc theo cột, cố định cột, thanh kéo ngang.
   Ở đây dựng đúng bộ đó cho bảng Phần thô / khái toán.                                  */
function ptKeyLabel_(k){ var c=PT_COLS.filter(function(x){return x[0]===k;})[0]; return c?c[1]:k; }
// giá trị 1 ô theo khoá cột (để lọc & sao chép)
function ptCellVal_(sec,it,k){
  switch(k){
    case 'noidung': return String(it.n||'');
    case 'dvt':     return String(it.dvt||'');
    case 'ghichu':  return String(it.gc||'');
    case 'dientich':return it.dt==null?'':String(it.dt);
    case 'heso':    return it.hs==null?'':String(it.hs);
    case 'khoiluong':return it._kl==null?'':String(it._kl);
    case 'dgnt':    return it.dgnt==null?'':String(it.dgnt);
    case 'dg':      return it.dg==null?'':String(it.dg);
    default: return '';
  }
}
/* ---- Lọc theo cột ---- */
function ptOpenFilter(e,key){
  e.stopPropagation(); e.preventDefault(); closePop();
  var vals={}, tong=0;
  (S.phanTho||[]).forEach(function(sec){ ptSecTotals(sec); sec.items.forEach(function(it){
    var v=ptCellVal_(sec,it,key).trim(); tong++; if(v) vals[v]=(vals[v]||0)+1; }); });
  var ds=Object.keys(vals).sort(function(a,b){ return a.localeCompare(b,'vi',{numeric:true}); });
  var cur=(S._ptFilter||{})[key];
  var pop=document.createElement('div'); pop.className='fltpop'; pop.id='qs_pop';
  pop.innerHTML='<div class="fltpop-h">Lọc: '+esc(ptKeyLabel_(key))+'</div>'
    +'<div class="fltpop-b">'
      +'<div class="fpi'+(cur==null?' on':'')+'" onclick="ptSetFilter(\''+key+'\',null)">Tất cả <i>'+tong+'</i></div>'
      +(ds.length?ds.map(function(v){
          return '<div class="fpi'+(cur===v?' on':'')+'" onclick="ptSetFilter(\''+key+'\',\''+escJs_(v)+'\')">'
            +esc(v)+' <i>'+vals[v]+'</i></div>'; }).join('')
        :'<div class="fpi dis">Cột này chưa có dữ liệu</div>')
    +'</div>'
    +((S._ptFilter&&Object.keys(S._ptFilter).length)?'<div class="fpa" onclick="ptClearFilter()">✕ Bỏ mọi bộ lọc cột</div>':'');
  document.body.appendChild(pop);
  var r=e.target.getBoundingClientRect();
  pop.style.left=Math.max(8,Math.min(r.left, window.innerWidth-pop.offsetWidth-12))+'px';
  pop.style.top=Math.min(r.bottom+4, window.innerHeight-pop.offsetHeight-12)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function ptSetFilter(key,v){
  S._ptFilter=S._ptFilter||{};
  if(v==null) delete S._ptFilter[key]; else S._ptFilter[key]=v;
  closePop(); renderPhanTho();
}
function ptClearFilter(){ S._ptFilter={}; closePop(); renderPhanTho(); }
function ptRowPass_(sec,it){
  var f=S._ptFilter||{}; var ks=Object.keys(f); if(!ks.length) return true;
  return ks.every(function(k){ return ptCellVal_(sec,it,k).trim()===f[k]; });
}
/* ---- Chuột phải: menu kiểu Excel ---- */
/* ═══ Thao tác Ô / CỘT cho bảng PHẦN THÔ — dùng CHUNG cách làm với bảng Bóc tách ═══
   Trước đây menu chuột phải của Phần thô chỉ có vài mục về DÒNG và BẢNG, trong khi
   bảng Thiết bị đèn có đủ nhóm Ô / Dòng / Cột / Tô màu / Tìm & thay thế -> mỗi bảng
   một kiểu. Các hàm dưới đây bù cho Phần thô đúng những việc đó.                     */
/* --- Chọn dòng: khoá theo vị trí (si|ii), dọn lại sau mỗi lần vẽ vì thêm/xoá dòng làm đổi chỉ số --- */
function ptFreezeRowTo(si,ii){
  var rows=document.querySelectorAll('#ptWrap table.pt tr.pt-row'), n=0;
  for(var i=0;i<rows.length;i++){ n=i+1;
    if(+rows[i].getAttribute('data-si')===si && +rows[i].getAttribute('data-ii')===ii) break; }
  S._ptFrzRows=Math.min(n,12); closePop(); renderPhanTho();
  toast('Đã cố định '+S._ptFrzRows+' hàng đầu — cuộn xuống vẫn thấy');
}
function ptUnfreezeRows(){ S._ptFrzRows=0; closePop(); renderPhanTho(); toast('Đã bỏ cố định hàng'); }
function ptFreezeRows_(){
  var t=document.querySelector('#ptWrap table.pt'); if(!t) return;
  t.querySelectorAll('tr.frzrow').forEach(function(tr){ tr.classList.remove('frzrow');
    tr.querySelectorAll('td').forEach(function(td){ td.style.position=''; td.style.top=''; td.style.zIndex=''; }); });
  var n=Math.min(Number(S._ptFrzRows)||0,12); if(!n) return;
  var head=t.tHead, off=(head?head.offsetHeight:0)||40;
  var rows=t.querySelectorAll('tr.pt-row');
  for(var i=0;i<n && i<rows.length;i++){
    var tr=rows[i]; tr.classList.add('frzrow');
    (function(top){ tr.querySelectorAll('td').forEach(function(td){
      td.style.position='sticky'; td.style.top=top+'px'; td.style.zIndex='3'; }); })(off);
    off+=tr.offsetHeight;
  }
}
function ptRowKey_(si,ii){ return si+'|'+ii; }
function ptSelIds_(){ var o=S._ptSel||{}; return Object.keys(o).filter(function(k){ return o[k]; }); }
function ptSelHas_(si,ii){ return !!(S._ptSel && S._ptSel[ptRowKey_(si,ii)]); }
function ptRowKeysOnScreen_(){
  return Array.prototype.map.call(document.querySelectorAll('#ptWrap tr.pt-row'), function(tr){
    return ptRowKey_(tr.getAttribute('data-si'), tr.getAttribute('data-ii')); });
}
function ptSelClick_(e,si,ii){
  if(e&&e.stopPropagation) e.stopPropagation();
  S._ptSel=S._ptSel||{};
  var k=ptRowKey_(si,ii), ids=ptRowKeysOnScreen_(), i=ids.indexOf(k);
  if(e&&e.shiftKey && S._ptAnchor!=null){                  // Shift = chọn cả vùng từ dòng neo
    var a=ids.indexOf(S._ptAnchor); if(a<0) a=i;
    for(var x=Math.min(a,i);x<=Math.max(a,i);x++) S._ptSel[ids[x]]=1;
  } else {
    if(S._ptSel[k]) delete S._ptSel[k]; else S._ptSel[k]=1;
    S._ptAnchor=k;
  }
  renderPhanTho();
}
function ptSelAllVisible_(){ S._ptSel=S._ptSel||{}; ptRowKeysOnScreen_().forEach(function(k){ S._ptSel[k]=1; }); renderPhanTho(); }
function ptClearSel_(){ S._ptSel={}; S._ptAnchor=null; renderPhanTho(); }
function ptSelPrune_(){                                     // bỏ khoá của dòng không còn trên bảng
  if(!S._ptSel) return; var con={}; ptRowKeysOnScreen_().forEach(function(k){ con[k]=1; });
  Object.keys(S._ptSel).forEach(function(k){ if(!con[k]) delete S._ptSel[k]; });
}
async function ptSelDel_(){
  var ids=ptSelIds_(); if(!ids.length) return;
  if(!await xacNhan_('Xoá '+ids.length+' dòng đã chọn?')) return;
  // xoá từ dưới lên để chỉ số không trượt
  ids.map(function(k){ var a=k.split('|'); return [+a[0],+a[1]]; })
     .sort(function(x,y){ return (y[0]-x[0])||(y[1]-x[1]); })
     .forEach(function(x){ var sec=(S.phanTho||[])[x[0]]; if(sec&&sec.items) sec.items.splice(x[1],1); });
  S._ptSel={}; S._ptAnchor=null; ptPersist(); renderPhanTho(); toast('Đã xoá '+ids.length+' dòng');
}
function ptSelBar_(){
  var w=document.getElementById('ptBulkWrap');
  if(!w){ w=document.createElement('div'); w.id='ptBulkWrap'; document.body.appendChild(w); }
  var ids=ptSelIds_(), n=ids.length;
  var hien=n && bocVisible_() && (document.getElementById('ptWrap')||{}).style.display!=='none';
  if(!hien){ w.innerHTML=''; return; }
  var tien=0;
  ids.forEach(function(k){ var a=k.split('|'), sec=(S.phanTho||[])[+a[0]];
    var it=sec&&sec.items&&sec.items[+a[1]]; if(it) tien+=ptN(it._tt); });
  w.innerHTML='<div class="bbar" id="ptBulkBar">'
    +'<div class="bb-count"><b>'+n+'</b><span>dòng đã chọn · '+money(tien)+' đ</span>'
      +'<button class="bb-x" title="Bỏ chọn" onclick="ptClearSel_()">✕</button></div>'
    +'<div class="bb-sep"></div>'
    +'<button class="bb-b" onclick="ptSelAllVisible_()" title="Chọn tất cả dòng đang hiện">'+icon('list',15)+' Chọn tất cả</button>'
    +'<button class="bb-b" id="ptbEditBtn" onclick="ptBulkEditPop_(event)" title="Đổi một cột cho mọi dòng đã chọn">'
      +icon('edit',15)+' Sửa hàng loạt <i class="bb-car">▾</i></button>'
    +'<button class="bb-b" onclick="ptSelDel_()" title="Xoá các dòng đã chọn">'+icon('trash',15)+' Xoá dòng</button>'
  +'</div>';
}
/* ═══ SỬA HÀNG LOẠT CHO BẢNG PHẦN THÔ ═══
   Cùng cách dùng với bảng Bóc tách: tích nhiều dòng -> chọn 1 cột -> đặt chung một giá trị.
   Chỉ cho sửa các cột NHẬP ĐƯỢC (cột tính toán như Thành tiền, Markup thì không). */
var PT_BULK_F=[['noidung','Nội dung công việc'],['dvt','Đơn vị tính'],['dientich','Diện tích'],
  ['heso','Hệ số'],['khoiluong','Khối lượng'],['dgnt','Đơn giá (nhà thầu)'],
  ['margin','% Lợi nhuận / giá bán'],['dg','Đơn giá bán'],['ghichu','Ghi chú']];
function ptBulkEditPop_(e){
  if(e&&e.stopPropagation) e.stopPropagation();
  if(document.getElementById('ptbEditPop')){ ptBulkPopClose_(); return; }
  var n=ptSelIds_().length;
  var pop=document.createElement('div'); pop.className='bb-pop'; pop.id='ptbEditPop';
  pop.innerHTML='<div class="bb-pop-h">Sửa hàng loạt <span>'+n+' dòng</span></div>'
    +'<div class="bb-pop-b"><label>Cột cần đổi</label>'
      +'<select id="ptbField">'+PT_BULK_F.map(function(f){ return '<option value="'+esc(f[0])+'">'+esc(f[1])+'</option>'; }).join('')+'</select>'
      +'<label>Giá trị mới</label>'
      +'<input id="ptbValue" placeholder="Nhập giá trị…" onkeydown="if(event.key===\'Enter\')ptBulkEditRun_()">'
    +'</div>'
    +'<div class="bb-pop-f"><button class="btn ghost sm" onclick="ptBulkPopClose_()">Huỷ</button>'
      +'<button class="btn blue sm" onclick="ptBulkEditRun_()">'+icon('check',14)+' Áp dụng</button></div>';
  document.body.appendChild(pop);
  var b=document.getElementById('ptbEditBtn');
  if(b){ var r=b.getBoundingClientRect(), w=pop.offsetWidth||280;
    pop.style.left=Math.max(10,Math.min(r.left+r.width/2-w/2, window.innerWidth-w-10))+'px';
    pop.style.top=Math.max(10,r.top-pop.offsetHeight-10)+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',ptBulkPopOutside_); var v=document.getElementById('ptbValue'); if(v) v.focus(); },0);
}
function ptBulkPopClose_(){ var e=document.getElementById('ptbEditPop'); if(e) e.remove();
  document.removeEventListener('mousedown',ptBulkPopOutside_); }
function ptBulkPopOutside_(e){ if(e.target.closest('#ptbEditPop')||e.target.closest('#ptBulkBar')) return; ptBulkPopClose_(); }
function ptBulkEditRun_(){
  var f=document.getElementById('ptbField'), v=document.getElementById('ptbValue'); if(!f||!v) return;
  var key=f.value, val=v.value, nhan=f.options[f.selectedIndex].text;
  if(String(val).trim()==='' && key!=='ghichu'){ toast('Chưa nhập giá trị mới'); v.focus(); return; }
  var fld=PT_CELL_F[key]; if(!fld){ toast('Cột này không sửa được'); return; }
  ptBulkPopClose_();
  var ids=ptSelIds_(), ok=0;
  ids.forEach(function(k){
    var a=k.split('|'), si=+a[0], ii=+a[1];
    if(!ptCellEditable_(si,key)) return;                       // cột không áp dụng cho kiểu tính của nhóm
    ptEdit(si,ii,fld,val,1); ok++;
  });
  if(!ok){ toast('Không dòng nào sửa được cột "'+nhan+'"'); return; }
  ptPersist(); renderPhanTho();
  toast('Đã đặt '+nhan+' cho '+ok+' dòng');
}
var PT_CELL_F={ noidung:'n', dvt:'dvt', dientich:'dt', heso:'hs', khoiluong:'kl',
                dgnt:'dgnt', margin:'lnPct', dg:'dg', ghichu:'gc' };
var PT_NUM_K={ dientich:1, heso:1, khoiluong:1, dgnt:1, ttnt:1, lnvnd:1, dg:1, tt:1, margin:1, markup:1 };
// Ô vừa bấm chuột phải: dòng nào, cột nào, đang mang giá trị gì
function ptCtxCell_(e){
  var td=e.target.closest('td'), tr=e.target.closest('tr.pt-row');
  if(!td||!tr) return null;
  var vis=ptVisCols_(), idx=Array.prototype.indexOf.call(tr.children, td);
  var col=vis[idx]; if(!col) return null;                 // cột nút thao tác ở cuối bảng
  var inp=td.querySelector('input,textarea');
  return { si:+tr.getAttribute('data-si'), ii:+tr.getAttribute('data-ii'), key:col[0],
           lbl:col[1], text: inp?String(inp.value||''):String(td.textContent||'').trim() };
}
function ptCellEditable_(si,key){
  var f=PT_CELL_F[key]; if(!f) return false;
  var sec=(S.phanTho||[])[si]; if(!sec) return false;
  if(key==='khoiluong'){ var it=sec.items&&sec.items[0]; }
  return true;
}
function ptCopyCell_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  ctxCopy_(String(c.text||'')); toast('Đã sao chép: '+String(c.text||'').slice(0,40)); }
function ptCopyRow_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  var tr=document.querySelector('#ptWrap tr.pt-row[data-si="'+c.si+'"][data-ii="'+c.ii+'"]'); if(!tr) return;
  var n=ptVisCols_().length, vals=[];
  Array.prototype.slice.call(tr.children,0,n).forEach(function(td){
    var i=td.querySelector('input,textarea'); vals.push(i?String(i.value||''):String(td.textContent||'').trim()); });
  ctxCopy_(vals.join('\t')); toast('Đã sao chép cả dòng — dán được thẳng vào Excel'); }
async function ptPasteCell_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  var f=PT_CELL_F[c.key];
  if(!f){ toast('Cột "'+c.lbl+'" là cột tự tính — không dán vào được'); return; }
  var txt='';
  try{ txt=await navigator.clipboard.readText(); }
  catch(e){ toast('Trình duyệt chặn đọc clipboard — bấm vào ô rồi nhấn Ctrl+V'); return; }
  if(!txt) return;
  ptEdit(c.si, c.ii, f, String(txt).split('\t')[0].split('\n')[0].trim()); toast('Đã dán vào ô'); }
function ptClearCell_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  var f=PT_CELL_F[c.key];
  if(!f){ toast('Cột "'+c.lbl+'" là cột tự tính — không có nội dung để xoá'); return; }
  ptEdit(c.si, c.ii, f, ''); toast('Đã xoá nội dung ô'); }
// Điền giá trị ô này xuống cả cột (mọi dòng của mọi hạng mục trong bảng)
async function ptFillDown_(){ var c=S._ptCtxCell; closePop(); if(!c) return;
  var f=PT_CELL_F[c.key];
  if(!f){ toast('Cột "'+c.lbl+'" là cột tự tính — không điền xuống được'); return; }
  var dich=[];
  (S.phanTho||[]).forEach(function(sec,si){ (sec.items||[]).forEach(function(it,ii){
    if(si===c.si && ii===c.ii) return; dich.push([si,ii]); }); });
  if(!dich.length){ toast('Bảng chưa có dòng nào khác'); return; }
  if(!await xacNhan_('Điền "'+String(c.text||'').slice(0,30)+'" cho '+dich.length+' dòng còn lại trong cột "'+c.lbl+'"?')) return;
  dich.forEach(function(x){ ptEdit(x[0], x[1], f, c.text); });
  toast('Đã điền xuống '+dich.length+' dòng'); }
function ptSumCol_(k){ closePop();
  var tong=0, n=0;
  (S.phanTho||[]).forEach(function(sec){ (sec.items||[]).forEach(function(it){
    var v;
    if(k==='ttnt') v=it._ttnt; else if(k==='tt') v=it._tt;
    else if(k==='lnvnd') v=(ptN(it._tt)-ptN(it._ttnt));
    else v=ptCellVal_(sec,it,k);
    v=ptN(v); if(v){ tong+=v; n++; } }); });
  toast('Tổng cột "'+ptKeyLabel_(k)+'" ('+n+' dòng có số): '+money(tong)); }
/* ---- Tô màu điều kiện cho Phần thô (cùng 3 luật với bảng Bóc tách) ---- */
function ptCfRules_(){ S.ptCf=S.ptCf||{}; return S.ptCf; }
function ptCfToggle_(rule){ var r=ptCfRules_(); if(r[rule]) delete r[rule]; else r[rule]=1;
  try{ localStorage.setItem('qs_ptcf', JSON.stringify(r)); }catch(e){}
  closePop(); renderPhanTho(); }
function ptCfClass_(sec,it){
  var r=S.ptCf||{}, c='';
  if(sec.mode!=='item') return '';
  var tt=ptN(it._tt), ttnt=ptN(it._ttnt), dg=ptN(it.dg), kl=ptN(it._kl);
  if(r.ln0 && (tt-ttnt)<0) c+=' cf-red';
  if(r.noPrice && !dg) c+=' cf-yellow';
  if(r.kl0 && !kl) c+=' cf-grey';
  return c; }
function ptCtx(e){
  var th=e.target.closest('th.thk'); var tr=e.target.closest('tr.pt-row');
  var trs=tr?null:e.target.closest('tr.pt-sec,tr.pt-add');
  var cell=tr?ptCtxCell_(e):null; S._ptCtxCell=cell;
  var key = th ? th.getAttribute('data-k') : (cell?cell.key:'');
  e.preventDefault(); closePop();
  var si=tr?+tr.getAttribute('data-si'):-1, ii=tr?+tr.getAttribute('data-ii'):-1;
  var ssi=trs?+trs.getAttribute('data-si'):-1;
  var pop=document.createElement('div'); pop.className='fltpop ctxmenu'; pop.id='qs_pop';
  function mi(ic,label,fn,hint,cls){
    return '<div class="cmi '+(cls||'')+'" onclick="'+fn+'">'+icon(ic,14)+'<span>'+label+'</span>'
      +(hint?'<i class="cmi-k">'+hint+'</i>':'')+'</div>'; }
  function sec(t){ return '<div class="cmh">'+esc(t)+'</div>'; }
  var html='';
  if(cell){
    html+=sec('Ô đang chọn')
      +mi('copy','Sao chép ô','ptCopyCell_()','Ctrl+C')
      +mi('copy','Sao chép cả dòng','ptCopyRow_()')
      +mi('edit','Dán vào ô','ptPasteCell_()','Ctrl+V')
      +mi('trash','Xoá nội dung ô','ptClearCell_()','Del')
      +'<div class="cmsep"></div>';
  }
  if(tr && si>=0 && ii>=0){
    html+=sec('Dòng')
      +mi('check','Chọn dòng này','closePop();ptSelClick_(null,'+si+','+ii+')')
      +mi('list','Chọn tất cả dòng đang hiện','closePop();ptSelAllVisible_()')
      +mi('copy','Nhân bản dòng','closePop();ptDupItem('+si+','+ii+')')
      +mi('plus','Chèn dòng trống bên dưới','closePop();ptInsertItem('+si+','+ii+')')
      +mi('trash','Xoá dòng này','closePop();ptDelItem('+si+','+ii+')','','danger')
      +'<div class="cmsep"></div>';
  }
  if(trs && ssi>=0){
    html+=sec('Hạng mục: '+esc(String((S.phanTho[ssi]||{}).t||'').split('\n')[0]))
      +mi('edit','Đổi tên hạng mục','closePop();ptRenameSec('+ssi+')')
      +mi('plus','Thêm dòng vào hạng mục','closePop();ptAddItem('+ssi+')')
      +mi('trash','Xoá cả hạng mục','closePop();ptDelSection('+ssi+')','','danger')
      +'<div class="cmsep"></div>';
  }
  if(key){
    html+=sec('Cột: '+esc(ptKeyLabel_(key)))
      +mi('up','Sắp xếp tăng dần','closePop();ptSortSet_(\''+key+'\',\'asc\')')
      +mi('down','Sắp xếp giảm dần','closePop();ptSortSet_(\''+key+'\',\'desc\')')
      +(S._ptSort?mi('close','Bỏ sắp xếp','closePop();ptSortSet_(\'\')'):'')
      +((cell&&PT_CELL_F[key])?mi('down','Điền giá trị ô này xuống cả cột','ptFillDown_()'):'')
      +(PT_NUM_K[key]?mi('gauge','Tính tổng cột','ptSumCol_(\''+key+'\')'):'')
      +mi('lock','Cố định đến cột này','closePop();ptFreezeTo(\''+key+'\')')
      +((S._ptFreeze||0)>0?mi('close','Bỏ cố định cột','closePop();ptUnfreeze()'):'')
      +(tr?mi('lock','Cố định đến hàng này','ptFreezeRowTo('+si+','+ii+')'):'')
      +((S._ptFrzRows||0)>0?mi('close','Bỏ cố định hàng','ptUnfreezeRows()'):'')
      +mi('eye','Ẩn cột này','closePop();ptColToggle(\''+key+'\')')
      +mi('list','Hiện lại tất cả cột','closePop();ptShowAllCols_()')
      +'<div class="cmsep"></div>';
  }
  var cf=S.ptCf||{};
  html+=sec('Tô màu điều kiện')
    +'<div class="cmi cmck'+(cf.ln0?' on':'')+'" onclick="ptCfToggle_(\'ln0\')"><span class="bx">'+(cf.ln0?'✓':'')+'</span><span class="cfdot cf-red"></span><span>Lợi nhuận &lt; 0</span></div>'
    +'<div class="cmi cmck'+(cf.noPrice?' on':'')+'" onclick="ptCfToggle_(\'noPrice\')"><span class="bx">'+(cf.noPrice?'✓':'')+'</span><span class="cfdot cf-yellow"></span><span>Chưa có đơn giá</span></div>'
    +'<div class="cmi cmck'+(cf.kl0?' on':'')+'" onclick="ptCfToggle_(\'kl0\')"><span class="bx">'+(cf.kl0?'✓':'')+'</span><span class="cfdot cf-grey"></span><span>Khối lượng = 0</span></div>'
    +'<div class="cmsep"></div>'
    +sec('Bảng')
    +mi('search','Tìm & thay thế','closePop();openFindReplace()','Ctrl+F')
    +mi('download','Xuất bảng ra Excel','closePop();ptExportXlsx(false)')
    +mi('plus','Thêm hạng mục','closePop();ptAddSection()')
    +((S._ptFilter&&Object.keys(S._ptFilter).length)?mi('close','Bỏ mọi bộ lọc cột','ptClearFilter()'):'')
    +mi('trash','Xoá hết bảng','closePop();ptReset()','','danger');
  pop.innerHTML=html; document.body.appendChild(pop);
  var L=Math.min(e.clientX, window.innerWidth-pop.offsetWidth-12), T=Math.min(e.clientY, window.innerHeight-pop.offsetHeight-12);
  pop.style.left=Math.max(8,L)+'px'; pop.style.top=Math.max(8,T)+'px';
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function ptSortSet_(k,dir){ S._ptSort=k||''; S._ptSortDir=dir||'asc'; renderPhanTho(); }
function ptShowAllCols_(){ S._ptCols={}; PT_COLS.forEach(function(c){ S._ptCols[c[0]]=true; }); renderPhanTho(); }
function ptHBarSync_(){ hbarSync_('#ptWrap .pt-scroll','ptHBar','ptHThumb'); }
function ptHBarInit_(){ hbarBind_('#ptWrap .pt-scroll','ptHBar','ptHThumb'); }
/* Ô chọn ở panel trái Phần thô: loại báo giá (nhóm Khái toán / Dự toán) · nhà thầu · dự án mẫu */
function ptMselPop_(e, kind){
  if(e&&e.stopPropagation) e.stopPropagation();
  var old=document.getElementById('qs_pop'); if(old){ var k0=old.getAttribute('data-k'); closePop(); if(k0===kind) return; }
  var lo=ptLoai_(), cur=S._ptContractor||'', html='';
  function it(on, js, nm, cn, sub){ return '<div class="bgt-i lvl2'+(on?' on':'')+'" onclick="'+js+'"><span class="nm">'+nm+(sub?'<i class="pt-isub">'+esc(sub)+'</i>':'')+'</span>'
    +'<span class="cn">'+(cn||'')+'</span><span class="rd'+(on?' on':'')+'"></span></div>'; }
  if(kind==='loai'){
    html='<div class="bgt-h"><b>Hạng mục sản phẩm</b></div><div class="bgt-b">'+PT_LOAI_NHOM.map(function(g){
      return '<div class="bgt-i lvl1 pt-ig"><span class="nm">'+esc(g[1]+'. '+g[2])+'</span></div>'+g[3].map(function(x){
        var n=ptLoaiCount_(x[0]);
        return it(lo===x[0],'closePop();ptSetLoai(\''+x[0]+'\');renderTable()',esc(x[1]+' '+x[2]),n?(n+' công tác'):'chưa có',x[3]); }).join('');
    }).join('')+'</div>';
  } else if(kind==='ncc'){
    html='<div class="bgt-h"><b>Tên nhà thầu</b></div><div class="bgt-b">'
      +it(!cur,'closePop();ptSetContractor(\'\');renderPTLibrary()','Tất cả nhà thầu','','')
      +PT_CONTRACTORS.map(function(c){ return it(cur===c,'closePop();ptSetContractor(\''+escJs_(c)+'\');renderPTLibrary()',esc(c),'',''); }).join('')+'</div>';
  } else {
    html='<div class="bgt-h"><b>Dự án mẫu</b></div><div class="bgt-b">'+PT_MAU.map(function(m){
      return it(false,'closePop();ptApplyMau(\''+escJs_(m.id)+'\')',esc(m.ten),'',m.mo||''); }).join('')
      +'<p class="ptlib-hint" style="padding:6px 12px">Chọn 1 mẫu để đưa cả bộ hạng mục vào bảng → ra đơn giá trọn gói; sửa diện tích · hệ số · đơn giá theo dự án đang làm.</p></div>';
  }
  var pop=document.createElement('div'); pop.className='fltpop bgtree'; pop.id='qs_pop'; pop.setAttribute('data-k',kind); pop.innerHTML=html;
  document.body.appendChild(pop);
  var b=e&&e.currentTarget; if(b&&b.getBoundingClientRect){ var r=b.getBoundingClientRect();
    pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.max(8,r.left)+'px'; pop.style.minWidth=Math.max(260,r.width)+'px'; }
  setTimeout(function(){ document.addEventListener('mousedown',popOutside); },0);
}
function ptSetContractor(v){ S._ptContractor=v||''; toast(v?('Đơn giá theo nhà thầu: '+v):'Bỏ chọn nhà thầu'); }
function ptLibToggle(si){ S._ptLibCol=S._ptLibCol||{}; S._ptLibCol[si]=!S._ptLibCol[si]; renderPTLibrary(); }
// nút + ĐỎ ở section = CHỌN TẤT CẢ: thêm toàn bộ công tác của nhóm vào bảng ước tính
// Hạng mục trong bảng được nhận diện theo TÊN + LOẠI báo giá: "CÔNG TÁC CHUẨN BỊ" của
// khái toán chi tiết và của khái toán sơ bộ là 2 hạng mục khác nhau, không được gộp chung.
function ptSecLoai_(x){ return (x&&x.loai)||'kt_chitiet'; }
function ptFindSec_(tsec){
  return (S.phanTho||[]).filter(function(s){ return s.t===tsec.t && ptSecLoai_(s)===ptSecLoai_(tsec); })[0];
}
function ptNewSec_(tsec){
  return {t:tsec.t,mode:tsec.mode,loai:ptSecLoai_(tsec),note:tsec.note||'',up:tsec.up||0,items:[]};
}
function ptAddToSec_(si,quiet){
  var tsec=PT_TEMPLATE[si]; if(!tsec) return;
  if(!S.cur){ toast('Chọn dự án trước khi thêm công tác vào bảng'); return; }
  ptEnsure();
  var sec=ptFindSec_(tsec);
  if(!sec){ sec=ptNewSec_(tsec); S.phanTho.push(sec); }
  var added=0;
  tsec.items.forEach(function(a){
    var ten=String(a[0]);
    if(sec.items.some(function(x){ return String(x.n||'')===ten; })) return;   // bỏ qua dòng đã có
    sec.items.push(ptMakeItem_(tsec,a)); added++;
  });
  if(quiet) return;                                  // gọi từ dtApply: gộp 1 lần vẽ + 1 toast cho cả bộ
  ptPersist(); renderPhanTho();
  toast(added?('Đã thêm '+added+' công tác của "'+String(tsec.t).split('\n')[0]+'"'):'Nhóm này đã có đủ trong bảng');
}
// Lấy nguyên 1 bộ báo giá mẫu (khái toán sơ bộ) vào bảng
async function ptApplyMau(id){
  if(!id) return;
  var m=PT_MAU.filter(function(x){ return x.id===id; })[0]; if(!m) return;
  var secs=PT_TEMPLATE.filter(function(s){ return (s.loai||'')==='kt_sobo'; });
  if((S.phanTho||[]).length && !await xacNhan_('Đưa bộ "'+m.ten+'" vào bảng?\nCác hạng mục đang có vẫn giữ nguyên, hạng mục trùng tên sẽ được bổ sung dòng còn thiếu.')) return;
  ptEnsure();
  secs.forEach(function(sc){ ptAddToSec_(PT_TEMPLATE.indexOf(sc), true); });
  ptPersist(); renderPhanTho(); renderPTLibrary();
  var n=(S.phanTho||[]).reduce(function(a,x){ return a+((x.items||[]).length); },0);
  toast('Đã lấy bộ báo giá mẫu — bảng đang có '+n+' dòng');
}
function ptAddFromLib(si,ii,quiet,dich){
  var tsec=PT_TEMPLATE[si]; if(!tsec) return; var a=tsec.items[ii]; if(!a) return;
  if(!S.cur){ toast('Chọn dự án trước khi thêm công tác vào bảng'); return; }
  ptEnsure();
  var item=ptMakeItem_(tsec,a), sec, at, lechKieu=false;
  // Chỉ chèn vào hạng mục đích khi CÙNG KIỂU nhập (item / area): dòng dựng theo kiểu
  // của mẫu, thả vào hạng mục chạy kiểu khác thì các ô không khớp cột -> khối lượng,
  // thành tiền đều rỗng. Khác kiểu -> về đúng hạng mục theo mẫu và báo cho người dùng.
  if(dich && (S.phanTho||[])[dich.si] && String((S.phanTho[dich.si]||{}).mode||'')!==String(tsec.mode||'')){
    lechKieu=true; dich=null;
  }
  if(dich && (S.phanTho||[])[dich.si]){            // kéo thả: chèn vào đúng hạng mục + đúng vị trí
    sec=S.phanTho[dich.si];
    at=Math.max(0, Math.min((sec.items||[]).length, Number(dich.at)||0));
    sec.items.splice(at,0,item);
  } else {                                          // bấm ＋ ở thư viện: về đúng hạng mục theo mẫu
    sec=ptFindSec_(tsec);
    if(!sec){ sec=ptNewSec_(tsec); S.phanTho.push(sec); }
    sec.items.push(item); at=sec.items.length-1;
  }
  if(quiet) return;
  S._ptNew={si:S.phanTho.indexOf(sec), ii:at, t:Date.now()};   // cuộn tới + nháy như bảng đèn
  ptPersist(); renderPhanTho(); ptGotoNewRow_();
  toast(lechKieu
    ? ('Đã thêm vào "'+String(sec.t).split('\n')[0]+'" — hạng mục bạn thả vào nhập theo kiểu khác nên không chèn vào đó được')
    : ('Đã thêm: '+String(a[0]).split('\n')[0]));
}
/* Cuộn tới dòng vừa thêm ở bảng Phần thô + nháy nhẹ — dùng chung cách làm với bảng Bóc tách */
var PT_NEW_MS=1350;
function ptGotoNewRow_(){
  var n=S._ptNew; if(!n) return;
  if(Date.now()-(n.t||0)>PT_NEW_MS){ S._ptNew=null; return; }
  var tr=document.querySelector('#ptWrap tr.pt-row[data-si="'+n.si+'"][data-ii="'+n.ii+'"]'); if(!tr) return;
  tr.style.setProperty('--fdl','-'+(Date.now()-n.t)+'ms');
  tr.classList.add('rownew');
  var w=tr.closest('.pt-scroll'); if(!w) return;
  var wr=w.getBoundingClientRect(), rr=tr.getBoundingClientRect();
  var duoi=rr.bottom-(wr.bottom-10), tren=(wr.top+46)-rr.top;
  var d=(duoi>0)?duoi:((tren>0)?-tren:0);
  if(Math.abs(d)<2) return;
  w.scrollTo({top:Math.max(0, Math.min(w.scrollHeight-w.clientHeight, w.scrollTop+d)), behavior:tkSmooth_()});
}
/* ═══ THÔNG TIN CÔNG TÁC (Phần thô) — panel chi tiết giống thiết bị đèn ═══
   Bấm 1 công tác ở thư viện trái -> mở panel giữa: ảnh, thông tin chính, đơn giá,
   thông số kỹ thuật, phạm vi ứng dụng, tài liệu — đúng bố cục panel SP đèn.
   Nguồn dữ liệu:
     PT_INFO   : thông tin dựng sẵn trong code (khoá = tên công tác, chữ thường)
     localStorage 'qs_ptinfo' : phần người dùng tự nhập/sửa ngay trên panel (đè lên PT_INFO)
   Mỗi mục: {anh:'url\nurl', model:'', ts:'Tên: giá trị\n…', pv:'dòng\ndòng', tl:'link tài liệu'} */
var PT_INFO={};
function ptInfoKey_(ten){ return String(ten||'').split('\n')[0].trim().toLowerCase(); }
function ptInfoUser_(){
  if(!S._ptInfoU){
    var d=(S._projData&&S._projData.ptInfo);                   // bản trên server (dùng chung cả công ty)
    if(!d||typeof d!=='object'){ try{ d=JSON.parse(localStorage.getItem('qs_ptinfo')||'{}')||{}; }catch(e){ d={}; } }
    S._ptInfoU=d;
  }
  return S._ptInfoU;
}
function ptInfo_(ten){
  var k=ptInfoKey_(ten), a=PT_INFO[k]||{}, b=ptInfoUser_()[k]||{}, o={};
  ['anh','model','ts','gc','pv','tl'].forEach(function(f){ o[f]=(b[f]!=null&&b[f]!=='')?b[f]:(a[f]||''); });
  return o;
}
function ptInfoImgs_(inf){
  return String(inf.anh||'').split(/[\n,]/).map(function(s){return s.trim();}).filter(Boolean).map(function(v){ return imgUrlOf(v); });
}
// gallery dùng đúng markup/id của panel SP đèn -> nút ‹ › và dải ảnh nhỏ chạy sẵn
function ptMedia_(imgs){
  S._pdImgs=imgs; S._pdIdx=0;
  var nav = imgs.length>1
    ? '<button class="pd-nav prev" title="Ảnh trước (←)" onclick="event.stopPropagation();pdGoImg_(-1)">'+icon('left',18)+'</button>'
      +'<button class="pd-nav next" title="Ảnh sau (→)" onclick="event.stopPropagation();pdGoImg_(1)">'
      +'<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>'
      +'<span class="pd-count" id="pdCount">1/'+imgs.length+'</span>'
    : '';
  var main = imgs[0]
    ? '<img id="pdMainImg" src="'+esc(imgs[0])+'" onclick="imgPop_(this.src)" title="Bấm để xem ảnh lớn" onerror="this.style.visibility=\'hidden\'">'
    : '<span class="pd-noimg">'+icon('image',26)+'<i>Chưa có ảnh</i></span>';
  var dl = imgs[0] ? '<a class="pd-imgdl" href="'+esc(safeUrl_(imgs[0]))+'" target="_blank" rel="noopener" title="Mở ảnh gốc">'+icon('download',14)+'</a>' : '';
  var thumbs = imgs.length>1
    ? '<div class="pd-thumbs" id="pdThumbs">'+imgs.map(function(v,i){
        return '<button class="pd-thumb'+(i===0?' on':'')+'" title="Ảnh '+(i+1)+'" onclick="pdSetImg_('+i+')"><img src="'+esc(v)+'" onerror="this.style.visibility=\'hidden\'"></button>';
      }).join('')+'</div>' : '';
  return '<div class="pd-gal"><div class="imgbox">'+main+nav+dl+'</div>'+thumbs+'</div>';
}
// Ghi chú viết thành từng khối chữ đọc được (không nhét vào dòng "tên: giá trị")
function ptKV_(k,v){
  if(v==null||v==='') return '';
  var dai=String(v).length>20 || String(k).length>14;
  return '<div class="spec'+(dai?' stack':'')+'"><span class="k">'+esc(k)+'</span><span class="v">'+esc(v)+'</span></div>';
}
function ptNotes_(text){
  var ls=String(text||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
  if(!ls.length) return '';
  return '<div class="pd-notes">'+ls.map(function(l){ return '<div class="pd-note">'+esc(l)+'</div>'; }).join('')+'</div>';
}
function ptBullets_(text){
  var ls=String(text||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
  if(!ls.length) return '';
  return '<ul class="pd-uls">'+ls.map(function(l){ return '<li>'+esc(l)+'</li>'; }).join('')+'</ul>';
}
// Thông số: dòng "Tên: giá trị" -> hàng 2 cột; dòng còn lại -> khối chữ
function ptSpecRows_(text){
  var ls=String(text||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
  var out='', buf=[];
  function flushG(){ if(buf.length){ out+=ptNotes_(buf.join('\n')); buf=[]; } }
  function flush(){ if(buf.length){ out+=ptNotes_(buf.join('\n')); buf=[]; } }
  ls.forEach(function(l){
    var g=l.match(/^##\s*(.*)$/);
    if(g){ flushG(); out+='<div class="pd-grp">'+esc(g[1]||'Thông số kỹ thuật')+'</div>'; return; }
    var m=l.match(/^([^:：]{2,40})[:：]\s*(.+)$/);
    if(m){ flush(); out+=ptKV_(m[1].trim(),m[2].trim()); }
    else buf.push(l);
  });
  flush();
  return out;
}
/* Các mảnh nội dung của 1 công tác — dùng chung:
   panel bên (xếp dọc)  và  popup (2 cột giống popup Thông tin sản phẩm của đèn).  */
function ptDetailParts_(si,ii){
  var sec=PT_TEMPLATE[si], a=sec.items[ii];
  var ten=String(a[0]), dvt=ptVal_(sec,a,'dvt'), gc=ptVal_(sec,a,'gc');
  var dgBan=(sec.mode==='area')?(Number(sec.up)||0):ptVal_(sec,a,'dg'), dgNT=ptVal_(sec,a,'dgnt');
  var ctr=ctOf_(a);
  var inf= ctr ? {anh:ctr.hinhAnh||'', model:'', ts:ctr.thongSo||'', gc:'', pv:ctr.phamVi||'', tl:ctr.linkTaiLieu||''}
               : ptInfo_(ten);
  var imgs=ptInfoImgs_(inf);
  var gcGoc=gc; if(inf.gc) gc=inf.gc;
  var loai=PT_LOAI.filter(function(x){ return x[0]===ptLoaiGop_(sec.loai); })[0]||PT_LOAI[0];
  var ln=dgBan-dgNT, lnPct=dgBan?(ln/dgBan*100):0;
  var P={};
  P.coAnh = imgs.length>0;
  // Không có ảnh thì KHÔNG vẽ khung xám rỗng — chỉ hiện mã + tên
  P.media = (imgs.length?ptMedia_(imgs):'')
    +'<div class="pcode">'+esc(sec.r)+'.'+(ii+1)+' · '+esc(String(sec.t).split('\n')[0])+'</div>'
    +'<div class="pd-name">'+esc(ten)+'</div>';
  // Khối giá nổi bật: đơn giá bán là số to, giá vốn + lợi nhuận là 2 dòng nhỏ bên dưới
  P.hero = '<div class="pt-hero">'
      +'<div class="pt-hero-t">Đơn giá bán</div>'
      +'<div class="pt-hero-v">'+money(dgBan)+'<i>đ'+(dvt?(' / '+esc(dvt)):'')+'</i></div>'
      +((dgNT||ln)?('<div class="pt-hero-r">'
        +(dgNT?'<span><em>Giá nhà thầu</em><b>'+money(dgNT)+' đ</b></span>':'')
        +((dgBan&&dgNT)?'<span><em>Lợi nhuận</em><b class="'+(ln<0?'neg':'ok')+'">'+money(ln)+' đ · '+lnPct.toFixed(1)+'%</b></span>':'')
      +'</div>'):'')
    +'</div>';
  P.chinh = (function(){
      var rows=[['Tên / model', inf.model||''],['Hạng mục', String(sec.t).split('\n')[0]],
        ['Nhà thầu · nhà cung cấp', (ctr&&ctr.ncc)||''],
        ['Đơn vị tính', dvt],['Loại báo giá', loai[1]],['Nhà thầu đang chọn', S._ptContractor||'']]
        .map(function(r){ return ptKV_(r[0],r[1]); }).join('');
      return rows?'<div class="pd-block"><div class="pd-sec">Thông tin chính</div>'+rows+'</div>':'';
    })();
  P.gia = (dgBan||dgNT)
    ? '<div class="pd-block"><div class="pd-sec">Đơn giá <i>(theo bảng giá thư viện)</i></div>'
      +(dgNT?'<div class="spec"><span class="k">Đơn giá nhà thầu</span><span class="v">'+money(dgNT)+' đ/'+esc(dvt)+'</span></div>':'')
      +(dgBan?'<div class="spec hi"><span class="k">Đơn giá bán</span><span class="v">'+money(dgBan)+' đ/'+esc(dvt)+'</span></div>':'')
      +((dgBan&&dgNT)?'<div class="spec"><span class="k">Lợi nhuận</span><span class="v">'+money(ln)+' đ ('+lnPct.toFixed(1)+'%)</span></div>':'')
      +'</div>' : '';
  P.thongSo = inf.ts?'<div class="pd-block"><div class="pd-sec">Thông số kỹ thuật tham khảo</div>'+ptSpecRows_(inf.ts)+'</div>':'';
  P.ghiChu  = gc?'<div class="pd-block"><div class="pd-sec">Ghi chú · điều kiện áp dụng</div>'+ptNotes_(gc)
      +(inf.gc&&gcGoc&&inf.gc!==gcGoc?'<div class="pd-goc">Ghi chú gốc trong bảng giá: '+esc(gcGoc)+'</div>':'')+'</div>':'';
  P.phamVi  = inf.pv?'<div class="pd-block"><div class="pd-sec">Phạm vi ứng dụng</div>'+ptBullets_(inf.pv)+'</div>':'';
  P.thieu   = (function(){
      var t=[]; if(!imgs.length) t.push('ảnh'); if(!inf.ts) t.push('thông số kỹ thuật');
      if(!gc) t.push('ghi chú'); if(!inf.pv) t.push('phạm vi ứng dụng');
      if(t.length<2) return '';
      return '<div class="pt-thieu">Chưa có '+esc(t.join(' · '))+'</div>';
    })();
  P.foot = inf.tl
    ? ('<div class="pd-foot2">'
        +'<a class="pd-fbtn" href="'+esc(safeUrl_(inf.tl))+'" target="_blank" rel="noopener">'+icon('doc',14)+' Tài liệu kỹ thuật</a>'
        +'<a class="pd-fbtn" href="'+esc(safeUrl_(inf.tl))+'" download target="_blank" rel="noopener">'+icon('download',14)+' Tải về</a>'
      +'</div>')
    : '';
  P.ctr=ctr;
  return P;
}
function ptInfoForm_(si,ii){
  var sec=PT_TEMPLATE[si], a=sec.items[ii], inf=ptInfo_(String(a[0]));
  var gcGoc=(sec.mode==='none')?(a[2]||''):(a[4]||'');
  function fld(id,lbl,hint,val,rows,note){
    return '<div class="ptinf-f"><label>'+esc(lbl)+'</label>'
      +'<textarea id="'+id+'" rows="'+(rows||2)+'" placeholder="'+esc(hint)+'">'+esc(val||'')+'</textarea>'
      +(note?'<i class="ptinf-h">'+esc(note)+'</i>':'')+'</div>';
  }
  return '<div class="ptinf-form">'
    +'<div class="pd-sec">Sửa thông tin công tác</div>'
    +fld('ptInfModel','Tên / model','VD: Giàn tải, máy ép cọc Pmax 90T',inf.model,1)
    +fld('ptInfAnh','Ảnh (mỗi dòng 1 link)','https://… (dán link ảnh, mỗi dòng một ảnh)',inf.anh,2)
    +fld('ptInfTs','Thông số kỹ thuật (mỗi dòng "Tên: giá trị")','Lực ép tối đa (Pmax): 90 tấn\nLoại cọc phù hợp: vuông 250×250, tròn ly tâm D300',inf.ts,5)
    +fld('ptInfGc','Ghi chú · điều kiện áp dụng',gcGoc||'VD: Đơn giá cho trên 20m/tim cọc (tùy địa chất khu vực)',inf.gc,3,
         gcGoc?'Để trống = dùng ghi chú gốc trong bảng giá thư viện.':'Công tác này chưa có ghi chú gốc — nhập ở đây để hiện trên panel.')
    +fld('ptInfPv','Phạm vi ứng dụng (mỗi dòng 1 ý)','Nhà phố, biệt thự, công trình tải trung bình\nYêu cầu mặt bằng thi công',inf.pv,3)
    +fld('ptInfTl','Link tài liệu kỹ thuật','https://…',inf.tl,1)
    +'<div class="ptinf-act">'
      +'<button class="btn ghost sm" onclick="ptInfoEdit_('+si+','+ii+',0)">Huỷ</button>'
      +'<button class="btn blue sm" onclick="ptInfoSave_('+si+','+ii+')">'+icon('check',14)+' Lưu thông tin</button>'
    +'</div></div>';
}
function ptInfoEdit_(si,ii,on){ S._ptInfoEdit=!!on; ptShowDetail_(si,ii); }
function ptInfoSave_(si,ii){
  var a=PT_TEMPLATE[si].items[ii], k=ptInfoKey_(String(a[0]));
  function v(id){ var e=document.getElementById(id); return e?String(e.value||'').replace(/\s+$/,''):''; }
  var o={model:v('ptInfModel'),anh:v('ptInfAnh'),ts:v('ptInfTs'),gc:v('ptInfGc'),pv:v('ptInfPv'),tl:v('ptInfTl')};
  var U=ptInfoUser_();
  if(!o.model&&!o.anh&&!o.ts&&!o.gc&&!o.pv&&!o.tl) delete U[k]; else U[k]=o;
  try{ localStorage.setItem('qs_ptinfo',JSON.stringify(U)); }catch(e){}
  projDataSet_('ptInfo', U);
  S._ptInfoEdit=false; ptShowDetail_(si,ii); toast('Đã lưu thông tin công tác');
}
function ptHideDetail_(){
  S._ptDetail=null; S._ptInfoEdit=false;
  var el=document.getElementById('pdPanel'); if(el){ el.style.display='none'; el.innerHTML=''; el.classList.remove('ptdetail'); }
  var g=document.getElementById('bocGrid'); if(g) g.classList.remove('detail');
  document.removeEventListener('keydown',pdPanelKey_);
  if(S.node==='3.1') renderPTLibrary();
}
function ptShowDetail_(si,ii){
  var sec=PT_TEMPLATE[si]; if(!sec||!sec.items[ii]) return;
  var el=document.getElementById('pdPanel'); if(!el) return;
  S._ptDetail={si:si,ii:ii};
  var g=document.getElementById('bocGrid'); if(g) g.classList.add('detail');
  el.style.display='block'; el.classList.add('ptdetail');
  var P=S._ptInfoEdit?null:ptDetailParts_(si,ii);
  var ctr0=ctOf_(sec.items[ii]);
  el.innerHTML='<div class="pd-head"><h3>Thông tin công tác</h3>'
      +(P?(ctr0?('<span class="spduyet'+(ctr0.daDuyet?' on':'')+'">'+(ctr0.daDuyet?'Đã duyệt':'Chưa duyệt')+'</span>')
                :'<span class="spduyet mau">Thư viện mẫu</span>'):'')
      +'<button class="pd-x" title="Đóng" onclick="ptHideDetail_()">✕</button></div>'
    +(S._ptInfoEdit?ptInfoForm_(si,ii)
       :(P.media+P.hero+P.chinh+P.thongSo+P.ghiChu+P.phamVi+P.thieu+P.foot))
    +(S._ptInfoEdit?''
      :'<div class="pd-actions">'
        +(ctOf_(sec.items[ii])
          ?'<button class="btn ghost sm" onclick="ctEditModal_(\''+ctOf_(sec.items[ii]).id+'\')">'+icon('edit',14)+' Sửa công tác</button>'
          :'<button class="btn ghost sm" onclick="ptInfoEdit_('+si+','+ii+',1)">'+icon('edit',14)+' Sửa thông tin</button>')
        +'<button class="btn blue sm" onclick="'+(S.node==='3.1'?'ptAddFromLib':'ctAddToBoc_')+'('+si+','+ii+')">'+icon('plus',14)+' Thêm vào bảng</button>'
      +'</div>');
  document.addEventListener('keydown',pdPanelKey_);
  el.scrollTop=0;
  if(S.node==='3.1') renderPTLibrary();
}
function ptKey(){ return 'pt_'+((S.cur&&S.cur.maDA)||'x'); }
function ptEnsure(){
  var key=ptKey();
  if(S._ptKey===key && S.phanTho) return;
  S._ptKey=key;
  // Ưu tiên bản ĐÃ NẠP TỪ SERVER (projDataLoad_ chạy khi mở dự án); chưa có thì lấy bản
  // dự phòng trong máy để không mất dữ liệu cũ của những máy đã dùng trước đây.
  var saved=(S._projData&&S._projData.phanTho);
  if(!Array.isArray(saved)){ try{ saved=JSON.parse(localStorage.getItem(key)||'null'); }catch(e){ saved=null; } }
  S.phanTho = Array.isArray(saved) ? saved : [];
  var v=(S._projData&&S._projData.ptVat);
  if(v==null||v===''){ try{ v=localStorage.getItem(key+'_vat'); }catch(e){ v=null; } }
  var nv=Number(v);
  // VAT phần thô mặc định LẤY THEO VAT CỦA DỰ ÁN — trước đây cứng 8 nên 1 dự án ra 2 số VAT
  S.ptVat = (v!=null&&v!==''&&isFinite(nv))?nv:(Number(S.cur&&S.cur.vat)||0);
}
function ptPersist(){
  var k=ptKey(), v=Number(S.ptVat); if(!isFinite(v)) v=0; S.ptVat=v;
  try{ localStorage.setItem(k,JSON.stringify(S.phanTho)); localStorage.setItem(k+'_vat',String(v)); }catch(e){}
  projDataSet_('phanTho', S.phanTho); projDataSet_('ptVat', v);
}

// Dòng 'item' nhập được Diện tích + Hệ số: có diện tích là Khối lượng = DT × HS (khoá ô khối lượng).
// BỎ TRỐNG hệ số thì hiểu là 1 — gõ hẳn số 0 thì vẫn là 0.
function ptHs_(it){ var v=it&&it.hs; return (v===''||v==null)?1:ptN(v); }
function ptAutoKL_(it){ return ptN(it&&it.dt)>0; }
function ptSecTotals(sec){
  var sumKL=0, tt=0, ttnt=0;
  sec.items.forEach(function(it){
    var kl;
    if(sec.mode==='area'||sec.mode==='area0'){ kl=ptR2(ptN(it.dt)*ptHs_(it)); }
    else if(ptAutoKL_(it)){ kl=ptR2(ptN(it.dt)*ptHs_(it)); }    // dòng item: có diện tích -> khối lượng tự tính
    else { kl=ptN(it.kl); }
    it._kl=kl; sumKL+=kl;
    if(sec.mode==='item'){ it._tt=ptR0(kl*ptN(it.dg)); tt+=it._tt; it._ttnt=ptR0(kl*ptN(it.dgnt)); ttnt+=it._ttnt; }
    else { it._tt=null; it._ttnt=null; }
  });
  if(sec.mode==='area'){ tt=ptR0(sumKL*ptN(sec.up)); ttnt=0; }
  else if(sec.mode==='area0'||sec.mode==='none'){ tt=0; ttnt=0; }
  return {sumKL:sumKL,tt:tt,ttnt:ttnt};
}
function ptComputeAll(){
  var sections=[],grand=0,contractor=0;
  S.phanTho.forEach(function(sec){ var s=ptSecTotals(sec); sections.push(s); grand+=s.tt; contractor+=s.ttnt; });
  var profit=grand-contractor;
  var vatPct=ptN(S.ptVat);
  var vat=ptR0(grand*vatPct/100);
  return {sections:sections,grand:grand,contractor:contractor,profit:profit,
    vatPct:vatPct,vat:vat,afterTax:grand+vat,profitPct:grand?(profit/grand*100):0};
}
/* ô nhập */
// Ô tiền hiện có dấu chấm ("10.000.000") cho dễ đọc, gõ kiểu nào cũng nhận;
// các ô số khác (diện tích, hệ số, %) giữ nguyên ô number để còn nhập thập phân.
function ptMoneyN_(v){ if(typeof v==='number') return v; var x=parseInt(String(v==null?'':v).replace(/[^\d-]/g,''),10); return isNaN(x)?0:x; }
function ptInp(si,ii,f,v,cls,goiY){
  cls=cls||'';
  var isMoney=cls.indexOf('pt-money')>=0;
  if(isMoney){
    var t=(v===''||v==null||!Number(v))?'':money(v);
    return '<input class="pt-in '+cls+'" type="text" inputmode="numeric" value="'+esc(t)+'" onchange="ptEdit('+si+','+ii+',\''+f+'\',this.value)">';
  }
  return '<input class="pt-in '+cls+'" type="number" step="any" value="'+(v===''||v==null?'':v)+'"'
    +(goiY?' placeholder="'+esc(goiY)+'" title="Bỏ trống = '+esc(goiY)+'"':'')
    +' onchange="ptEdit('+si+','+ii+',\''+f+'\',this.value)">';
}
function ptTxt(si,ii,f,v){ return '<textarea class="pt-in pt-area" rows="1" oninput="autoGrow(this)" onchange="ptEdit('+si+','+ii+',\''+f+'\',this.value)">'+esc(v||'')+'</textarea>'; }
/* ═══ CÔNG THỨC GIÁ — lấy đúng theo file báo giá (sheet "mai coi công thức ở đây") ═══
   Khối lượng     I = G × H                  (diện tích × hệ số)
   TT nhà thầu    K = I × J                  (khối lượng × đơn giá nhà thầu)
   Đơn giá bán    O = MROUND(J/(1−M), 1000)  (M = %LN trên GIÁ BÁN, làm tròn nghìn)
   TT bán         P = I × O
   Lợi nhuận      L = P − K
   %LN/giá bán    M = L/P      ·   %LN/giá vốn  N = L/K
   Trong app: gõ %LN -> tự ra đơn giá bán; gõ đơn giá bán -> tự ra %LN (2 chiều). */
function ptMround_(v,b){ b=b||1000; return Math.round((Number(v)||0)/b)*b; }
function ptDgTuLn_(dgnt,lnPct){
  dgnt=ptN(dgnt); var m=ptN(lnPct)/100;
  if(!dgnt) return 0;
  if(m>=1) m=0.99;                       // chặn chia cho 0
  return ptMround_(dgnt/(1-m),1000);
}
function ptLnTuDg_(dgnt,dg){ dg=ptN(dg); return dg?((dg-ptN(dgnt))/dg*100):0; }
// imLang = đang sửa hàng loạt: chưa lưu / chưa vẽ lại, người gọi tự làm 1 lần ở cuối
function ptEdit(si,ii,f,val,imLang){
  var sec=S.phanTho[si]; if(!sec) return;
  var numF={dt:1,hs:1,kl:1,dg:1,dgnt:1,up:1,lnPct:1}, moneyF={dg:1,dgnt:1,up:1};
  var v = moneyF[f]?ptMoneyN_(val):(numF[f]?ptN(val):val);
  if(ii<0){ sec[f]=v; }
  else {
    var it=sec.items[ii]; if(!it) return;
    it[f]=v;
    // dòng item có DT+HS -> khối lượng bám theo tích 2 ô (bỏ trống 1 ô là trả lại nhập tay)
    if((f==='dt'||f==='hs') && sec.mode==='item'){ if(ptAutoKL_(it)) it.kl=ptR2(ptN(it.dt)*ptHs_(it)); }
    // giữ 3 đại lượng luôn khớp nhau: giá vốn ↔ %LN ↔ giá bán
    if(f==='lnPct')      it.dg=ptDgTuLn_(it.dgnt,v);
    else if(f==='dg')    it.lnPct=ptR2(ptLnTuDg_(it.dgnt,v));
    else if(f==='dgnt'){ if(ptN(it.lnPct)) it.dg=ptDgTuLn_(v,it.lnPct); else it.lnPct=ptR2(ptLnTuDg_(v,it.dg)); }
  }
  if(imLang) return;                 // sửa hàng loạt: người gọi tự lưu + vẽ lại 1 lần ở cuối
  ptPersist(); renderPhanTho();
}
/* VAT của bảng phần thô = VAT của DỰ ÁN (một dự án chỉ một con số VAT) — sửa ở đây là
   mọi tab và file báo giá đổi theo, không còn cảnh phần thô 8% mà báo giá 10%. */
function ptSetVat(val){
  var n=ptN(val); S.ptVat=isFinite(n)?n:0; ptPersist();
  if(S.cur && Number(S.cur.vat)!==S.ptVat){
    S.cur.vat=S.ptVat;
    api('updateProject', S.cur.maDA, {vat:S.ptVat}).then(function(p){ if(p) syncProj(p); }).catch(function(e){ toast('Chưa lưu được VAT: '+e.message.slice(0,80)); });
    try{ refreshActiveTab_(); }catch(e){}
  }
  renderPhanTho();
}
function ptAddItem(si){
  var sec=S.phanTho[si]; if(!sec) return;
  if(sec.mode==='item') sec.items.push({n:'',dvt:'',kl:1,dg:0,gc:'',dgnt:0});
  else if(sec.mode==='area'||sec.mode==='area0') sec.items.push({n:'',dvt:'m2',dt:0,hs:1,gc:''});
  else sec.items.push({n:'',dvt:'gói',gc:''});
  ptPersist(); renderPhanTho();
}
function ptBlankItem_(sec){
  if(sec.mode==='item') return {n:'',dvt:'',kl:1,dg:0,gc:'',dgnt:0};
  if(sec.mode==='area'||sec.mode==='area0') return {n:'',dvt:'m2',dt:0,hs:1,gc:''};
  return {n:'',dvt:'gói',gc:''};
}
// Nhân bản dòng (giữ nguyên mọi giá trị) — đặt ngay dưới dòng gốc
function ptDupItem(si,ii){
  var sec=S.phanTho[si]; if(!sec||!sec.items[ii]) return;
  var ban=JSON.parse(JSON.stringify(sec.items[ii]));
  ['_kl','_tt','_ttnt'].forEach(function(k){ delete ban[k]; });     // bỏ giá trị tính tạm
  sec.items.splice(ii+1,0,ban); ptPersist(); renderPhanTho();
  toast('Đã nhân bản dòng');
}
// Chèn 1 dòng trống ngay dưới dòng đang chọn
function ptInsertItem(si,ii){
  var sec=S.phanTho[si]; if(!sec) return;
  sec.items.splice(ii+1,0,ptBlankItem_(sec)); ptPersist(); renderPhanTho();
}
function ptDelItem(si,ii){ var sec=S.phanTho[si]; if(!sec) return; sec.items.splice(ii,1); ptPersist(); renderPhanTho(); }
function ptAddSection(){ S.phanTho.push({t:'HẠNG MỤC MỚI',mode:'item',note:'',up:0,items:[]}); ptPersist(); renderPhanTho(); }
async function ptDelSection(si){ if(!await xacNhan_('Xoá cả hạng mục "'+((S.phanTho[si]||{}).t||'')+'" ?')) return; S.phanTho.splice(si,1); ptPersist(); renderPhanTho(); }
// Xoá hết bảng -> chỉ còn tên cột; user tự chọn lại hạng mục từ thư viện bên trái
async function ptReset(){
  var n=(S.phanTho||[]).reduce(function(s,x){ return s+((x.items||[]).length); },0);
  if(n && !await xacNhan_('Xoá toàn bộ '+n+' dòng trong bảng? Bạn sẽ chọn lại hạng mục từ danh sách bên trái.')) return;
  S.phanTho=[]; ptPersist(); renderPhanTho(); renderCatalog();
  toast('Đã xoá bảng — chọn hạng mục từ danh sách bên trái');
}
/* Khối header giống Excel */
function ptInfo(k,v){ return '<div class="pt-inf"><span class="k">'+esc(k)+'</span><span class="v">'+esc(v||'—')+'</span></div>'; }
// Cột bảng Phần thô: [key, nhãn, canh, rộng]
// Nhãn cột viết thường như bảng Bóc tách (trước đây viết hoa cứng nên nhìn khác hẳn)
var PT_COLS=[
  ['stt','STT','c',52],['noidung','Nội dung công việc','l',300],['dvt','ĐVT','c',74],
  ['dientich','Diện tích','n',92],['heso','Hệ số','n',72],['khoiluong','Khối lượng','n',104],
  ['dgnt','Đơn giá (nhà thầu)','n',136],['ttnt','Thành tiền (nhà thầu)','n',148],
  ['lnvnd','Lợi nhuận (VND)','n',124],['margin','Lợi nhuận/giá bán (%)','n',148],
  ['markup','Lợi nhuận/giá vốn (%)','n',148],['dg','Đơn giá','n',134],
  ['tt','Thành tiền','n',140],['ghichu','Ghi chú','l',210]
];
/* Cố định cột trái — bảng khái toán rất rộng (14 cột), cuộn ngang là mất cột
   Nội dung công việc. Dùng lại đúng cách làm của bảng Bóc tách (class frz + biến CSS). */
function ptFreezeTo(k){
  var vis=ptVisCols_(); var i=vis.map(function(c){return c[0];}).indexOf(k);
  S._ptFreeze = i>=0 ? i+1 : 0; renderPhanTho();
}
function ptUnfreeze(){ S._ptFreeze=0; renderPhanTho(); }
function ptColToggle(k){ S._ptCols=S._ptCols||{}; S._ptCols[k]=!S._ptCols[k]; renderPhanTho(); }
// ===== Chức năng bảng (giống Bóc tách): rộng cột · đổi vị trí cột · sắp xếp =====
function ptW_(c){ return (S._ptColW&&S._ptColW[c[0]])||c[3]; }
function ptVisCols_(){
  if(!S._ptOrder) S._ptOrder=PT_COLS.map(function(c){return c[0];});
  var by={}; PT_COLS.forEach(function(c){ by[c[0]]=c; });
  return S._ptOrder.map(function(k){ return by[k]; })
    .filter(function(c){ return c && (!S._ptCols || S._ptCols[c[0]]); });
}
function ptColDragStart(e,k){ if(e.target&&e.target.closest&&e.target.closest('.ptrsz')){ e.preventDefault(); return; }
  S._ptDragK=k; try{ e.dataTransfer.setData('text/plain',k); }catch(x){} }
function ptColDrop(e,k){ e.preventDefault(); var from=S._ptDragK; S._ptDragK=null; if(!from||from===k) return;
  var ord=(S._ptOrder||PT_COLS.map(function(c){return c[0];})).filter(function(x){ return x!==from; });
  var i=ord.indexOf(k); if(i<0) i=ord.length; ord.splice(i,0,from); S._ptOrder=ord; renderPhanTho(); }
// sắp xếp các dòng TRONG TỪNG hạng mục (giữ nguyên cấu trúc nhóm)
function ptToggleSort(k){
  if(S._ptSort!==k){ S._ptSort=k; S._ptSortDir='asc'; }
  else if(S._ptSortDir==='asc'){ S._ptSortDir='desc'; }
  else { S._ptSort=''; S._ptSortDir='asc'; }
  renderPhanTho();
}
var PT_SORTKEY={noidung:'n',dvt:'dvt',dientich:'dt',heso:'hs',khoiluong:'kl',dgnt:'dgnt',dg:'dg',ghichu:'gc'};
// trả [{it, oi}] — oi = index GỐC trong sec.items để sửa ô ghi đúng dòng dù đang sắp xếp
function ptSortItems_(items){
  var arr=items.map(function(it,i){ return {it:it, oi:i}; });
  if(!S._ptSort) return arr;
  var f=PT_SORTKEY[S._ptSort]; if(!f) return arr;             // cột tính toán -> bỏ qua
  var dir=S._ptSortDir==='desc'?-1:1, num=['dt','hs','kl','dgnt','dg'].indexOf(f)>=0;
  return arr.sort(function(a,b){
    var va=a.it[f], vb=b.it[f];
    if(num) return ((Number(va)||0)-(Number(vb)||0))*dir;
    return String(va||'').localeCompare(String(vb||''),'vi',{numeric:true})*dir;
  });
}
// kéo mép chỉnh rộng cột bảng Phần thô
document.addEventListener('mousedown',function(e){
  var rs=e.target.closest&&e.target.closest('.ptrsz'); if(!rs) return;
  e.preventDefault(); e.stopPropagation();
  var k=rs.dataset.k, sx=e.clientX;
  var col=PT_COLS.filter(function(c){return c[0]===k;})[0]; if(!col) return;
  var sw=ptW_(col);
  S._ptColW=S._ptColW||{};
  var tb=document.querySelector('#ptWrap table.pt');
  var ths=tb?[].slice.call(tb.querySelectorAll('thead th')):[];
  var idx=ths.map(function(t){return t.getAttribute('data-k');}).indexOf(k);
  var colEl=(tb&&idx>=0)?tb.querySelectorAll('colgroup col')[idx]:null;
  function mv(ev){ var w=Math.max(44, sw+(ev.clientX-sx)); S._ptColW[k]=w; if(colEl) colEl.style.width=w+'px'; }
  function up(){ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); renderPhanTho(); }
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
});
// ghép ô theo đúng danh sách cột đang hiện (ô nào không có -> ô trống)
function ptCells_(vis,map){ return vis.map(function(c){ return map[c[0]]||'<td class="'+(c[2]==='n'?'n':(c[2]==='c'?'c':''))+'"></td>'; }).join(''); }
// vị trí (1-based) của 1 cột trong danh sách đang hiện; 0 nếu đang ẩn
function ptIdx_(vis,key){ for(var i=0;i<vis.length;i++) if(vis[i][0]===key) return i+1; return 0; }
function renderPhanTho(){
  var pw=document.getElementById('ptWrap'); if(!pw) return;
  if(!S.cur){ pw.innerHTML='<div class="empty" style="padding:24px;text-align:center">Chưa chọn dự án.</div>'; return; }
  ptEnsure();
  if(!S._ptCols){ S._ptCols={}; PT_COLS.forEach(function(c){ S._ptCols[c[0]]=true; }); }
  var comp=ptComputeAll();
  // Thứ tự + tên cột ĐÚNG như hình mẫu Phần thô
  var COLS=PT_COLS.map(function(c){return c[1];});
  // thứ tự cột tuỳ biến (kéo th để đổi) + lọc theo chip đang bật
  PT_COLS.forEach(function(c){ if(S._ptOrder && S._ptOrder.indexOf(c[0])<0) S._ptOrder.push(c[0]); });
  var ptVis=ptVisCols_();          // dùng CHUNG với ptFreezeTo để chỉ số cột cố định không lệch
  function ptPct(v){ v=Number(v)||0; return v?(v.toFixed(1)+'%'):''; }
  var body='';
  if(!S.phanTho.length){
    var isDT=ptLoai_().indexOf('dt_')===0;
    body+='<tr class="pt-empty"><td colspan="'+(ptVis.length+1)+'">'
      +'<div class="pt-empty-b">'+icon('layers',30)
      +'<h4>Bảng đang trống</h4>'
      +(isDT
        ? '<p>Dự toán chạy theo <b>bộ</b>: nhập số liệu đầu vào ở panel bên trái, rồi bấm <b class="pe-t">Dùng bộ dự toán này</b> — hệ thống đưa cả nhân công · máy · vật tư vào bảng.<br>Sửa số liệu đầu vào lúc nào, bảng <b>tự tính lại</b> lúc đó.</p>'
        : '<p>Chọn hạng mục từ danh sách bên trái — bấm <b class="pe-b">＋</b> để thêm từng công tác, hoặc <b class="pe-r">＋</b> ở tên nhóm để thêm cả nhóm.<br>Mọi lựa chọn được <b>lưu tự động</b>.</p>')
      +'</div></td></tr>';
  }
  S.phanTho.forEach(function(sec,si){
    var st=comp.sections[si];
    var isSecArea = sec.mode==='area';
    var sumDG = sec.items.reduce(function(s,it){ return s+ptN(it.dg); },0);
    // cộng khối lượng chỉ có nghĩa khi cả nhóm dùng CHUNG 1 đơn vị tính (dự toán trộn công/ca/m thì bỏ trống)
    var dvtSet={}; sec.items.forEach(function(it){ dvtSet[String(it.dvt||'').trim()]=1; });
    var klCell = (st.sumKL && Object.keys(dvtSet).length<=1) ? ptQty(st.sumKL) : '';
    var oneDvt = Object.keys(dvtSet).length<=1;                 // cộng đơn giá cũng chỉ có nghĩa khi chung 1 ĐVT
    var upCell = isSecArea ? ptInp(si,-1,'up',sec.up,'pt-money') : ((sumDG&&oneDvt)?money(sumDG):'');
    // ---- dòng tiêu đề hạng mục (đơn giá + thành tiền ở 2 cột cuối) ----
    var secLn=st.tt-st.ttnt;                       // lợi nhuận cả nhóm  (L = P − K)
    var secMargin=st.tt?(secLn/st.tt*100):0;       // M = L/P
    var secMarkup=st.ttnt?(secLn/st.ttnt*100):0;   // N = L/K
    // đơn giá nhà thầu của nhóm: chỉ hiện khi cả nhóm dùng CHUNG 1 đơn giá (như sheet)
    var dgntSet={}; sec.items.forEach(function(it){ dgntSet[ptN(it.dgnt)]=1; });
    var dgntKeys=Object.keys(dgntSet);
    var secDgnt=(dgntKeys.length===1&&ptN(dgntKeys[0]))?ptN(dgntKeys[0]):0;
    var secCells={
      stt:'<td class="c">'+PT_ROMAN[si]+'</td>',
      noidung:'<td class="pt-secname"><textarea class="pt-secttl-in" rows="1" spellcheck="false" title="Bấm để sửa tên hạng mục" placeholder="Tên hạng mục" oninput="autoGrow(this)" onchange="ptEditSec_('+si+',\'t\',this.value)">'+esc(sec.t)+'</textarea>'+(sec.note?'<span class="pt-note">'+esc(sec.note)+'</span>':'')+'<span class="pt-secdel" title="Xoá hạng mục" onclick="ptDelSection('+si+')">'+icon('trash',13)+'</span></td>',
      khoiluong:'<td class="n">'+klCell+'</td>',
      dgnt:'<td class="n b">'+(secDgnt?money(secDgnt):'')+'</td>',
      ttnt:'<td class="n b">'+(st.ttnt?money(st.ttnt):'')+'</td>',
      lnvnd:'<td class="n b">'+(secLn?money(secLn):'')+'</td>',
      margin:'<td class="n b pt-pctc">'+(secMargin?ptPct(secMargin):'')+'</td>',
      markup:'<td class="n b pt-pctc">'+(secMarkup?ptPct(secMarkup):'')+'</td>',
      dg:'<td class="n pt-upcell b">'+upCell+'</td>',
      tt:'<td class="n b">'+(st.tt?money(st.tt):'-')+'</td>'
    };
    body+='<tr class="pt-sec" data-si="'+si+'">'+ptCells_(ptVis,secCells)+'<td></td></tr>';
    body+='<tr class="pt-spacer"><td colspan="'+(ptVis.length+1)+'"></td></tr>';
    // ---- các dòng chi tiết ----
    ptSortItems_(sec.items).filter(function(_r){ return ptRowPass_(sec,_r.it); }).forEach(function(_r,_pos){
      var it=_r.it, ii=_r.oi;          // ii = index GỐC (sửa ô đúng dòng), _pos = vị trí hiển thị
      var kl=it._kl, tt=it._tt, ttnt=it._ttnt;
      var isArea=(sec.mode==='area'||sec.mode==='area0'), isItem=sec.mode==='item';
      var lnVnd = isItem?(tt-ttnt):0;
      var margin = (isItem&&tt)?(lnVnd/tt*100):0;   // lợi nhuận / giá bán
      var markup = (isItem&&ttnt)?(lnVnd/ttnt*100):0; // lợi nhuận / giá vốn
      var rowCells={
        stt:'<td class="c pt-grip" title="Kéo để đổi chỗ dòng hoặc chuyển sang hạng mục khác">'
             +'<input type="checkbox" class="tkck" '+(ptSelHas_(si,ii)?'checked':'')
             +' onclick="ptSelClick_(event,'+si+','+ii+')" title="Chọn dòng (giữ Shift để chọn cả vùng)">'
             +'<span class="sttn">'+(_pos+1)+'</span></td>',
        noidung:'<td>'+ptTxt(si,ii,'n',it.n)+'</td>',
        dvt:'<td class="c dvt-cell">'+ptTxt(si,ii,'dvt',it.dvt)+'</td>',
        dientich:'<td class="n">'+((isArea||isItem)?ptInp(si,ii,'dt',it.dt):'')+'</td>',
        heso:'<td class="n">'+((isArea||isItem)?ptInp(si,ii,'hs',it.hs,'',(ptN(it.dt)>0?'1':'')):'')+'</td>',
        khoiluong:'<td class="n">'+(isArea?'<span class="pt-ro">'+ptQty(kl)+'</span>'
           :(isItem?(ptAutoKL_(it)?'<span class="pt-ro" title="Khối lượng = Diện tích × Hệ số">'+ptQty(kl)+'</span>':ptInp(si,ii,'kl',it.kl)):''))+'</td>',
        dgnt:'<td class="n">'+(isItem?ptInp(si,ii,'dgnt',it.dgnt,'pt-money'):'')+'</td>',
        ttnt:'<td class="n">'+(isItem?'<span class="pt-ro">'+money(ttnt)+'</span>':'')+'</td>',
        lnvnd:'<td class="n">'+(isItem?'<span class="pt-ro">'+money(lnVnd)+'</span>':'')+'</td>',
        margin:'<td class="n">'+(isItem?ptInp(si,ii,'lnPct',(it.lnPct!=null&&it.lnPct!=='')?it.lnPct:ptR2(margin),'pt-pct-in'):'')+'</td>',
        markup:'<td class="n">'+(isItem?'<span class="pt-ro pt-pctc">'+ptPct(markup)+'</span>':'')+'</td>',
        dg:'<td class="n">'+(isItem?ptInp(si,ii,'dg',it.dg,'pt-money'):'')+'</td>',
        tt:'<td class="n">'+(isItem?'<span class="pt-ro b">'+money(tt)+'</span>':'<span class="pt-dash">-</span>')+'</td>',
        ghichu:'<td class="pt-gc">'+ptTxt(si,ii,'gc',it.gc)+'</td>'
      };
      body+='<tr class="pt-row'+ptCfClass_(sec,it)+(ptSelHas_(si,ii)?' rowsel':'')+'" draggable="true" data-si="'+si+'" data-ii="'+ii+'">'+ptCells_(ptVis,rowCells)
        +'<td class="pt-del">'
          +'<button title="Nhân bản dòng" onclick="ptDupItem('+si+','+ii+')">'+icon('copy',13)+'</button>'
          +'<button title="Chèn dòng trống bên dưới" onclick="ptInsertItem('+si+','+ii+')">'+icon('plus',13)+'</button>'
          +'<button class="x" title="Xoá dòng" onclick="ptDelItem('+si+','+ii+')">'+icon('trash',13)+'</button>'
        +'</td></tr>';
    });
    body+='<tr class="pt-add" data-si="'+si+'"><td></td><td colspan="'+Math.max(1,ptVis.length-1)+'"><span onclick="ptAddItem('+si+')">＋ Thêm dòng</span></td><td></td></tr>';
    body+='<tr class="pt-spacer"><td colspan="'+(ptVis.length+1)+'"></td></tr>';
  });
  // ---- tổng cộng / VAT / sau thuế ----  (cột 8=TT nhà thầu, 9=lợi nhuận, 13=thành tiền)
  // các dòng tổng: colspan tính theo vị trí cột đang hiện
  var iTT=ptIdx_(ptVis,'tt')||ptVis.length;
  body+='<tr class="pt-spacer pt-spacer-tot"><td colspan="'+(ptVis.length+1)+'"></td></tr>';
  body+='<tr class="pt-total">'+ptCells_(ptVis,{
      stt:'<td class="c"></td>',
      noidung:'<td class="pt-tlbl">TỔNG CỘNG</td>',
      ttnt:'<td class="n b">'+money(comp.contractor)+'</td>',
      lnvnd:'<td class="n b">'+money(comp.profit)+' <span class="pt-pct">('+comp.profitPct.toFixed(1)+'%)</span></td>',
      tt:'<td class="n b">'+money(comp.grand)+'</td>'
    })+'<td></td></tr>';
  // (VAT + Thành tiền sau thuế đã hiển thị ở thanh tổng phía trên -> bỏ khỏi bảng cho gọn)

  // cố định tối đa 2 cột đầu (giống bảng Bóc tách)
  var frz=Math.min(S._ptFreeze||0, 2, ptVis.length);
  var frzVar=frz?(' style="--frz1w:'+ptW_(ptVis[0])+'px"'):'';
  var colg='<colgroup>'+ptVis.map(function(c){ return '<col style="width:'+ptW_(c)+'px">'; }).join('')+'<col style="width:74px"></colgroup>';
  // header: bấm nhãn = sắp xếp · kéo th = đổi vị trí cột · kéo mép = chỉnh rộng (giống bảng Bóc tách)
  var thead='<tr>'+ptVis.map(function(c){
      var cls=c[2]==='n'?'n':(c[2]==='c'?'c':'');
      var on=S._ptSort===c[0], ar=on?(S._ptSortDir==='desc'?' ▼':' ▲'):'';
      var loc=!!(S._ptFilter&&S._ptFilter[c[0]]);
      return '<th class="thk '+cls+(on?' sortOn':'')+(loc?' fltOn':'')+'" data-k="'+c[0]+'" draggable="true" title="Bấm nhãn để sắp xếp · kéo để đổi vị trí · kéo mép phải để chỉnh rộng"'
        +' ondragstart="ptColDragStart(event,\''+c[0]+'\')" ondragover="event.preventDefault()" ondrop="ptColDrop(event,\''+c[0]+'\')">'
        +'<span class="thl" onclick="ptToggleSort(\''+c[0]+'\')">'+esc(c[1])+ar+'</span>'
        +'<span class="thflt" title="Lọc cột" onclick="ptOpenFilter(event,\''+c[0]+'\')">▾</span>'
        +'<span class="ptrsz" data-k="'+c[0]+'"></span></th>';
    }).join('')+'<th></th></tr>';
  // hàng CHIP chọn cột (giống Bóc tách)
  var frzLbl=frz?('Bỏ cố định ('+frz+' cột)'):'Cố định cột';
  var soLoc=Object.keys(S._ptFilter||{}).length;
  var ptOn=PT_COLS.filter(function(c){ return S._ptCols[c[0]]; }).length;
  var ptChips='<div class="colchips pt-colchips">'
    +'<span class="cp-collbl">Cột hiển thị</span>'
    +'<button class="btn ghost sm'+(frz?' on':'')+'" title="Cố định cột trái khi cuộn ngang" onclick="'
      +(frz?'ptUnfreeze()':'ptFreezeTo(\''+(ptVis[1]?ptVis[1][0]:ptVis[0][0])+'\')')+'">'+icon('lock',14)+' '+esc(frzLbl)+'</button>'
    +(soLoc?'<button class="btn ghost sm on" title="Bỏ mọi bộ lọc cột" onclick="ptClearFilter()">Đang lọc '+soLoc+' cột ✕</button>':'')
    +PT_COLS.map(function(c){ return '<span class="chip'+(S._ptCols[c[0]]?' on':'')+'" onclick="ptColToggle(\''+c[0]+'\')">'+esc(c[1])+'</span>'; }).join('')
    +'</div>';

  ptTotalsBar_(comp);
  var tcP=document.getElementById('tkCount'); if(tcP){ var nItems=(S.phanTho||[]).reduce(function(s,se){return s+((se.items||[]).length);},0); tcP.textContent='['+pad2(nItems)+']'; }
  // giữ nguyên vị trí đang cuộn (thêm/sửa dòng không được nhảy về đầu bảng)
  var _sc=pw.querySelector('.pt-scroll'), _sT=_sc?_sc.scrollTop:0, _sL=_sc?_sc.scrollLeft:0;
  var _winY=window.pageYOffset||document.documentElement.scrollTop||0;
  var ptHead='<div class="pt-toolbar">'
      + '<div class="pt-tt">Bảng ước tính chi phí — <b>Xây dựng thô</b></div>'
      + '<div class="sp"></div>'
      + (btSan_()&&!btOn_('pt')&&S.phanTho.length?'<button class="btn ghost sm" onclick="ptSheetToggle_()" title="Xem dạng bảng tính (như Google Sheets)">'+icon('layers',14)+' Bảng tính</button>':'')
      + '<button class="btn ghost sm" onclick="ptReset()">'+icon('trash',14)+' Xoá hết</button>'
      + '<button class="btn blue sm" onclick="ptAddSection()">'+icon('plus',14)+' Thêm hạng mục</button>'
    + '</div>';
  // Chế độ BẢNG TÍNH (mặc định khi thư viện nạp được và bảng có dữ liệu); bảng cũ ở dưới là dự phòng
  if(btSan_() && btOn_('pt') && S.phanTho.length){
    pw.innerHTML=ptHead+ptChips+ptSheetFrame_();
    try{ renderPTSheet_(document.getElementById('ptSheet'), ptVis, comp); }
    catch(e){ console.error('bảng tính', e); btSet_('pt',false); toast('Chế độ bảng tính lỗi — đã chuyển về bảng cũ'); renderPhanTho(); }
    if(_winY) window.scrollTo(0,_winY);
    return;
  }
  pw.innerHTML =
    '<div class="pt-toolbar">'
      + '<div class="pt-tt">Bảng ước tính chi phí — <b>Xây dựng thô</b></div>'
      + '<div class="sp"></div>'
      + (btSan_()&&S.phanTho.length?'<button class="btn ghost sm" onclick="ptSheetToggle_()" title="Xem dạng bảng tính (như Google Sheets)">'+icon('layers',14)+' Bảng tính</button>':'')
      + '<button class="btn ghost sm" onclick="ptReset()">'+icon('trash',14)+' Xoá hết</button>'
      + '<button class="btn blue sm" onclick="ptAddSection()">'+icon('plus',14)+' Thêm hạng mục</button>'
    + '</div>'
    + ptChips
    + '<div class="pt-scroll"><table class="pt'+(frz?(' frz'+frz):'')+'"'+frzVar+' oncontextmenu="ptCtx(event)">'+colg+'<thead>'+thead+'</thead><tbody>'+body+'</tbody></table></div>'
    + '<div class="tk-hbar pt-hbar" id="ptHBar" style="display:none"><div class="tk-hthumb" id="ptHThumb"></div></div>';
  // giãn sẵn các ô chữ để hiện ĐỦ nội dung, không bị cắt (giống bảng Bóc tách)
  pw.querySelectorAll('textarea.pt-area').forEach(autoGrow);
  pw.querySelectorAll('textarea.pt-secttl-in').forEach(autoGrow);
  // trả lại đúng chỗ đang xem trước khi vẽ lại
  var _sc2=pw.querySelector('.pt-scroll');
  if(_sc2){ _sc2.scrollTop=_sT; _sc2.scrollLeft=_sL; }
  if(_winY) window.scrollTo(0,_winY);
  ptDragBind_(pw.querySelector('table.pt'));   // kéo dòng sang hạng mục khác
  markBlocks_('#ptWrap table.pt');             // kẻ dọc liền trong 1 hạng mục
  ptHBarInit_(); ptHBarSync_();          // thanh kéo ngang giống bảng Bóc tách
  ptSelPrune_(); ptSelBar_();            // vùng chọn dòng + thanh thao tác hàng loạt (như Bóc tách)
  ptFreezeRows_();                       // cố định N hàng đầu (như Excel)
  ptGotoNewRow_();                       // giữ vệt nháy dòng vừa thêm qua các lần vẽ lại
}

// Thanh tổng dùng chung (giống các hạng mục SP khác) — hiện cho cả Phần thô (bảng cũ lẫn bảng tính)
function ptTotalsBar_(comp){
  var teP=document.getElementById('tkTotals');
  if(teP){ teP.innerHTML='<div class="tkt-row">'           // cùng kiểu dòng số liệu gọn với bảng bóc tách
    +'<span class="tkt-i"><i>Chưa VAT</i><b>'+money(comp.grand)+' đ</b></span>'
    +'<span class="tkt-i"><i>VAT <input class="tkt-vat" type="number" step="any" min="0" value="'+comp.vatPct+'" onchange="ptSetVat(this.value)" title="Thuế VAT (%)">%</i><b>'+money(comp.vat)+' đ</b></span>'
    +'<span class="tkt-i grand"><i>Tổng</i><b>'+money(comp.afterTax)+' đ</b></span>'
    +'</div>'; }
}
/* ===== Sửa tên hạng mục + KÉO DÒNG giữa các hạng mục (giống bảng Bóc tách) ===== */
function ptEditSec_(si,f,val){
  var sec=S.phanTho[si]; if(!sec) return;
  var v=String(val==null?'':val).replace(/\s+$/,'');
  if(f==='t' && !v.trim()){ toast('Tên hạng mục không được để trống'); renderPhanTho(); return; }
  if(sec[f]===v) return;
  sec[f]=v; ptPersist(); renderPhanTho();
}
function ptRenameSec(si){
  var sec=S.phanTho[si]; if(!sec) return;
  renderPhanTho();
  var ta=document.querySelector('#ptWrap tr.pt-sec[data-si="'+si+'"] .pt-secttl-in');
  if(ta){ ta.focus(); ta.select(); ta.scrollIntoView({block:'center'}); }
}
// chuyển 1 dòng sang vị trí khác (cùng hạng mục hoặc sang hạng mục khác)
function ptMoveItem_(fs,fi,ts,ti,before){
  var A=S.phanTho[fs], B=S.phanTho[ts]; if(!A||!B) return;
  var it=A.items[fi]; if(!it) return;
  if(fs===ts && (ti===fi || (before?ti:ti+1)===fi)) return;      // không đổi gì
  A.items.splice(fi,1);
  if(fs===ts && ti>fi) ti--;
  if(ti==null||ti<0||ti>B.items.length) ti=B.items.length;
  // sang hạng mục khác kiểu -> bù các trường còn thiếu để không mất ô nhập
  if(A.mode!==B.mode){ var d=ptBlankItem_(B); Object.keys(d).forEach(function(k){ if(it[k]==null||it[k]==='') it[k]=d[k]; }); }
  ['_kl','_tt','_ttnt'].forEach(function(k){ delete it[k]; });
  B.items.splice(before?ti:ti+1,0,it);
  ptPersist(); renderPhanTho();
  if(fs!==ts) toast('Đã chuyển sang "'+String(B.t||'').split('\n')[0]+'"');
}
// Kéo 1 công tác từ thư viện trái thả thẳng vào bảng khái toán (giống kéo SP đèn vào bảng bóc tách)
function ptLibDragStart_(e,si,ii){
  if(e.target.closest('button')){ e.preventDefault(); return; }
  S._ptLibDrag={si:si,ii:ii};
  var tsec=PT_TEMPLATE[si], a=tsec&&tsec.items[ii];
  try{
    e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('text/plain','ptlib');
    // thẻ ma khi kéo — dùng CHUNG mẫu với bên Thiết bị đèn cho thống nhất
    if(a){
      var ten=String(a[0]).split('\n')[0], dvt=ptVal_(tsec,a,'dvt')||'', dg=ptN(ptLibDg_(tsec,a));
      var g=document.createElement('div'); g.className='drag-ghost';
      g.innerHTML='<span class="dg-img"></span><span class="dg-b"><span class="dg-nm">'+esc(ten)+'</span>'
        +'<span class="dg-pr">'+esc(dvt)+(dg?(' · '+money(dg)+' đ'):'')+'</span></span>'
        +'<span class="dg-add">'+icon('plus',14)+'Thả vào bảng</span>';
      document.body.appendChild(g); S._ptLibGhost=g;
      e.dataTransfer.setDragImage(g, 24, 28);
    }
  }catch(x){}
  var el=e.currentTarget; if(el) el.classList.add('dragging');
}
function ptLibDragEnd_(){
  S._ptLibDrag=null;
  if(S._ptLibGhost){ S._ptLibGhost.remove(); S._ptLibGhost=null; }
  document.querySelectorAll('#catList .ptlib-item.dragging').forEach(function(x){ x.classList.remove('dragging'); });
  document.querySelectorAll('#ptWrap .dropInto,#ptWrap .dropTop,#ptWrap .dropBot').forEach(function(x){ x.classList.remove('dropInto','dropTop','dropBot'); });
}
function ptDragBind_(tb){
  if(!tb || tb._ptdrag) return; tb._ptdrag=1;
  function clr(){ tb.querySelectorAll('.dropTop,.dropBot,.dropInto').forEach(function(x){ x.classList.remove('dropTop','dropBot','dropInto'); }); }
  // gõ trong ô nhập thì tắt kéo (để còn bôi đen chữ), bấm chỗ khác thì bật lại
  tb.addEventListener('mousedown',function(e){
    var tr=e.target.closest('tr.pt-row'); if(!tr) return;
    tr.draggable = !e.target.closest('input,textarea,button,select');
  });
  tb.addEventListener('dragstart',function(e){
    if(e.target.closest('th.thk')) return;                 // kéo cột: đã có ptColDragStart
    var tr=e.target.closest('tr.pt-row'); if(!tr) return;
    if(e.target.closest('input,textarea,button,select')){ e.preventDefault(); return; }
    S._ptDrag={si:+tr.getAttribute('data-si'), ii:+tr.getAttribute('data-ii')};
    tr.classList.add('dragging');
    try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','pt-row'); }catch(x){}
  });
  tb.addEventListener('dragend',function(){ S._ptDrag=null; tb.querySelectorAll('tr.dragging').forEach(function(x){x.classList.remove('dragging');}); clr(); });
  tb.addEventListener('dragover',function(e){
    if(S._ptLibDrag){                                   // đang kéo công tác từ thư viện
      e.preventDefault(); try{ e.dataTransfer.dropEffect='copy'; }catch(x){}
      clr();
      var rw=e.target.closest('tr.pt-row');
      if(rw){                                          // rê lên 1 dòng -> vạch chèn trên/dưới (giống bảng đèn)
        var rr=rw.getBoundingClientRect();
        rw.classList.add(e.clientY<rr.top+rr.height/2?'dropTop':'dropBot');
        return;
      }
      var t=e.target.closest('tr.pt-sec,tr.pt-add,tr.pt-empty');
      if(t) t.classList.add('dropInto');               // rê lên tên hạng mục -> thêm vào cuối hạng mục đó
      return;
    }
    if(!S._ptDrag) return; e.preventDefault();
    try{ e.dataTransfer.dropEffect='move'; }catch(x){}
    clr();
    var tr=e.target.closest('tr'); if(!tr) return;
    if(tr.classList.contains('pt-row')){
      var r=tr.getBoundingClientRect();
      tr.classList.add(e.clientY<r.top+r.height/2?'dropTop':'dropBot');
    } else if(tr.classList.contains('pt-sec')||tr.classList.contains('pt-add')) tr.classList.add('dropInto');
  });
  tb.addEventListener('drop',function(e){
    if(S._ptLibDrag){
      e.preventDefault();
      var d=S._ptLibDrag; S._ptLibDrag=null; ptLibDragEnd_();
      // thả ở đâu thì chèn vào ĐÚNG ĐÓ (trước đây luôn đẩy xuống cuối hạng mục theo mẫu)
      var dich=null, rw=e.target.closest('tr.pt-row');
      if(rw){
        var rr=rw.getBoundingClientRect(), ii=+rw.getAttribute('data-ii');
        dich={si:+rw.getAttribute('data-si'), at:(e.clientY<rr.top+rr.height/2?ii:ii+1)};
      } else {
        var sc=e.target.closest('tr.pt-sec,tr.pt-add');
        if(sc){ var s2=+sc.getAttribute('data-si');
          var sec2=(S.phanTho||[])[s2];
          if(sec2) dich={si:s2, at:(sec2.items||[]).length}; }
      }
      clr();
      ptAddFromLib(d.si,d.ii,false,dich);
      return;
    }
    if(!S._ptDrag) return; e.preventDefault();
    var d=S._ptDrag; S._ptDrag=null; clr();
    tb.querySelectorAll('tr.dragging').forEach(function(x){x.classList.remove('dragging');});
    var tr=e.target.closest('tr'); if(!tr) return;
    if(tr.classList.contains('pt-row')){
      var ts=+tr.getAttribute('data-si'), ti=+tr.getAttribute('data-ii');
      if(ts===d.si && S._ptSort){ toast('Đang sắp xếp theo cột — bỏ sắp xếp rồi mới đổi chỗ dòng'); return; }
      var r=tr.getBoundingClientRect();
      ptMoveItem_(d.si,d.ii,ts,ti,e.clientY<r.top+r.height/2);
    } else if(tr.classList.contains('pt-sec')||tr.classList.contains('pt-add')){
      var s2=+tr.getAttribute('data-si'); if(isNaN(s2)) return;
      ptMoveItem_(d.si,d.ii,s2,null,true);
    }
  });
}
