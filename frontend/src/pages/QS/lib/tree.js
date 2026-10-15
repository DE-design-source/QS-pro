/* Cây hạng mục - port nguyên văn PUB/app.js:91-103 (TREE, nodeName), 1323-1327 (nodeCount, customGroups),
   sanpham.js:960 (spNodeCodeOf_). Đọc S.* của bản gốc thành tham số. */

/* cây hạng mục (mã, tên, cấp) */
export const TREE=[
  ['1','Tư vấn dự án',1],['1.1','Tư vấn quản lý dự án',2],
  ['2','Tư vấn thiết kế',1],['2.1','Tư vấn thiết kế kiến trúc',2],['2.2','Tư vấn thiết kế nội thất',2],
  ['2.3','Tư vấn thiết kế kết cấu',2],['2.4','Tư vấn thiết kế MEP',2],
  ['3','Xây dựng',1],['3.1','Phần thô',2],['3.2','Phần hoàn thiện cơ bản',2],
  ['3.2.1','Thạch cao',3],['3.2.2','Sơn nước',3],['3.2.3','Xây tô',3],['3.2.4','Ốp lát',3],
  ['3.2.5','Thiết bị vệ sinh',3],['3.2.6','Thiết bị điện',3],['3.2.6.1','Thiết bị đèn',4],
  ['3.2.6.2','Công tắc - ổ cắm',4],['3.2.7','Điện lạnh',3],['3.2.8','Cửa',3],
  ['3.2.8.1','Cửa ngoại thất',4],['3.2.8.2','Cửa nội thất',4],
  ['4','Hoàn thiện nội thất',1],['4.1','Nội thất liền tường',2],['4.2','Nội thất rời',2],
  ['4.3','Rèm cửa',2],['4.4','Đồ trang trí',2],['5','Bảo dưỡng',1],['X','Thêm hạng mục',1]
];
// Đề mục mặc định của Bóc tách (S.node, app.js:84)
export const DEFAULT_NODE='3.2.6.1';
export function nodeName(code){ for(var i=0;i<TREE.length;i++) if(TREE[i][0]===code) return TREE[i][1]; return code; }
// số dòng của 1 đề mục (kể cả đề mục con)
export function nodeCount(lines, code){
  return (lines||[]).filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; }).length;
}
// hạng mục tự tạo của dự án (cur.nhomTuTao = 'A|B')
export function customGroups(cur){ return (cur&&cur.nhomTuTao)?String(cur.nhomTuTao).split('|').map(function(s){return s.trim();}).filter(Boolean):[]; }
// sản phẩm -> node cây đề mục qua "muc" (vd "Thiết bị đèn" -> 3.2.6.1)
export function spNodeCodeOf_(p){ var muc=(p&&p.muc)||''; for(var i=0;i<TREE.length;i++){ if(TREE[i][1]===muc) return TREE[i][0]; } return ''; }
// dòng thuộc hạng mục code (code rỗng = tất cả) - điều kiện lọc dùng ở duan.js:59-60, chiphi, muahang.js:120, baogia.js:944
export function inNode_(l, code){ var c=String(l.nhom||''); return !code || c===code || c.indexOf(code+'.')===0; }
