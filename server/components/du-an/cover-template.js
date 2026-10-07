'use strict';
/************************************************************
 * Mẫu tờ bìa + NCC phần 3.2 (hằng số + hàm thuần, không chạm dữ liệu).
 * Mã tờ bìa (STT) TRÙNG mã cây hạng mục Bóc tách (TREE trong public/app.js):
 * dòng bóc tách có nhom '3.2.6.1' được cộng vào mục tờ bìa '3.2.6'.
 ************************************************************/

const S32_SUPPLIERS = {
  '3.2.1': [['Thạch cao', 'Boral'], ['Phụ kiện', 'Vĩnh Tường']],
  '3.2.2': [['Bột trét', 'Dulux'], ['Sơn nước', 'Dulux']],
  '3.2.4': [['Sàn gỗ', 'Boen'], ['Đá', 'Eurostone'], ['Sàn gạch', 'Vietceramics'], ['Keo dán gạch', 'Weber']],
  '3.2.5': [['Bồn cầu', 'Mamma Mia'], ['Bồn tắm', 'Hansgrohe'], ['Sen', 'Bravat'], ['Lavabo', 'Kohler'], ['Phụ kiện', 'Mamma Mia']],
  '3.2.6': [['Công tắc', 'Etron'], ['Ổ cắm', 'Etron'], ['Đèn trong nhà', 'Ades Lighting'], ['Đèn ngoài trời', 'Croled']],
  '3.2.7': [['Ống đồng', 'LHCT / Luvata'], ['Ống ngưng', 'PPR'], ['Cục nóng', 'Daikin'], ['Máy lạnh', 'Daikin']],
  '3.2.8': [['Cửa ngoại thất', 'YKK AP'], ['Cửa nội thất', 'An Cường']]
};
const S32_SUBS = ['3.2.1', '3.2.2', '3.2.3', '3.2.4', '3.2.5', '3.2.6', '3.2.7', '3.2.8'];
// [stt, hạng mục, mô tả]
const COVER_TEMPLATE = [
  ['1', 'TƯ VẤN DỰ ÁN', ''],
  ['1.1', 'Tư vấn QLDA', 'Bao gồm tư vấn tài chính dự án, tư vấn pháp lý dự án, tư vấn quản lý dự án, tư vấn mua hàng, đặt hàng, mở thầu, chọn thầu....'],
  ['2', 'TƯ VẤN THIẾT KẾ', ''],
  ['2.1', 'Tư vấn thiết kế kiến trúc', 'Tư vấn thiết kế kiến trúc, mặt tiền công trình, mặt bằng bố trí kiến trúc...'],
  ['2.2', 'Tư vấn thiết kế nội thất', 'Tư vấn thiết kế mặt bằng công năng nội thất, thiết kế 3D, tư vấn chọn vật liệu, màu sắc, ánh sáng. Triển khai bản vẽ thi công nội thất'],
  ['2.3', 'Tư vấn thiết kế kết cấu', ''],
  ['2.4', 'Tư vấn thiết kế MEP (Mechanical, Electrical, Plumbing)', 'Tư vấn thiết kế hệ thống điện (Electrical), Hệ thống Thông gió & Điều hòa không khí (Mechanical / HVAC), hệ thống Cấp thoát nước (Plumbing & Sanitary), hệ thống Phòng cháy chữa cháy'],
  ['3', 'XÂY DỰNG', ''],
  ['3.1', 'Phần thô', 'Chuẩn bị mặt bằng, thi công móng và nền, thi công cột, dầm, sàn, thi công tường bao, tường ngăn, tô trát, hoàn thiện phần thô, kiểm tra và nghiệm thu phần thô'],
  ['3.2', 'Phần hoàn thiện cơ bản', 'Thi công hoàn thiện trần, tường, sàn, lắp đặt TBVS, thiết bị điện lạnh, lắp đặt cửa nội thất, tay vịn cầu thang...'],
  ['3.2.1', 'Trần thạch cao', 'Nhân công và vật tư'],
  ['3.2.2', 'Sơn nước', 'Nhân công và vật tư'],
  ['3.2.3', 'Xây tô', 'Nhân công và vật tư'],
  ['3.2.4', 'Ốp lát', 'Nhân công và vật tư'],
  ['3.2.5', 'Thiết bị vệ sinh', 'Cung cấp thiết bị và nhân công lắp đặt'],
  ['3.2.6', 'Thiết bị điện', 'Đèn, công tắc - ổ cắm: cung cấp thiết bị và nhân công lắp đặt'],
  ['3.2.7', 'Thiết bị điện lạnh', 'Cung cấp thiết bị và nhân công lắp đặt'],
  ['3.2.8', 'Cửa', 'Sản xuất và nhân công lắp đặt'],
  ['4', 'HOÀN THIỆN NỘI THẤT', ''],
  ['4.1', 'Nội thất liền tường', 'Thi công lắp đặt nội thất liền tường, tủ bếp, tủ trang trí, vách liền tường'],
  ['4.2', 'Đồ rời (Loose furniture)', 'Sản xuất, cung cấp nội thất đồ rời, kệ, tủ rời, giường, ghế sofa, bàn, tủ lavabo....'],
  ['4.3', 'Rèm cửa', 'Sản xuất, cung cấp, lắp đặt rèm cửa'],
  ['4.4', 'Đồ trang trí', 'Sản xuất, cung cấp đồ trang trí nội thất: thảm, đồ decor, tranh treo tường v.v....'],
  ['5', 'BẢO DƯỠNG', ''],
  ['5.1', 'Bảo dưỡng định kỳ', 'Cung cấp các gói bảo dưỡng định kỳ cho các thiết bị như máy lạnh, bình nước nóng.....'],
  ['5.2', 'Bảo hiểm', 'Cung cấp các gói bảo hiểm thay thế, sửa chữa cho các thiết bị như đèn, thiết bị vệ sinh, sơn nước, sàn gỗ...v.....']
];
// Dòng bóc tách thuộc mục tờ bìa stt: nhom = stt hoặc mã con (3.2.6 ⊃ 3.2.6.1)
function inCode(nhom, stt) { nhom = String(nhom || '').trim(); return nhom === stt || nhom.indexOf(stt + '.') === 0; }

/* Chi phí từng mục tờ bìa: mục có con = tổng các mục LÁ bên dưới (giống coverCosts ở client),
   tổng = cộng các mục cấp 1. */
function coverComputed_(cover) {
  const cost = {};
  const hasChild = function (st) { return cover.some(function (d) { return d.stt !== st && String(d.stt).indexOf(st + '.') === 0; }); };
  cover.forEach(function (c) {
    if (!hasChild(c.stt)) { cost[c.stt] = Number(c.chiPhi) || 0; return; }
    let s = 0;
    cover.forEach(function (d) { if (d.stt !== c.stt && String(d.stt).indexOf(c.stt + '.') === 0 && !hasChild(d.stt)) s += Number(d.chiPhi) || 0; });
    cost[c.stt] = s;
  });
  let total = 0;
  cover.forEach(function (c) { if (String(c.stt).split('.').length === 1) total += cost[c.stt]; });
  return { cost: cost, total: total };
}

module.exports = { S32_SUPPLIERS, S32_SUBS, COVER_TEMPLATE, inCode, coverComputed_ };
