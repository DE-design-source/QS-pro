/* Cột bảng + bộ cột - port nguyên văn từ bản QS gốc. S.* của bản gốc thành tham số.
   Nguồn: COLS app.js:109-120 · TK_MINW_/DEFW 171-173 · NUMSORT/FR_FIELDS 177-178 · cellSortVal_/sortLines_ 179-196
   initCols/colW/colPlain 270-286 · TK_PRESETS 1624-1631 · COLSET 1638-1665 · cs* 1666-1746 · TK_COL_CB 1835
   visCols 1844-1847 · cellVal 1878-1907 · TXT_COL/NUM_COL/MONEY_COL 1909-1912 · TK_RO_COL boc.js:951
   FLOOR/ROOM_PRESETS boc.js:157-160 · TK_LN_QUICK boc.js:1049 · TK_SHEETS boc.js:1729-1744
   CP_KEYS/cpOrder_/cpLabel_ chiphi.js:62-68 · cpAlign_ 276-280 · DA_KEYS duan.js:5 · CP_COL_CB/DA_COL_CB dash.js:240,247
   PHONG_LIST index.html:6810-6817 */
import { money, spNorm_ } from './format.js'
import { giaDaiLy_, donGiaCK_, ttBan_, lnVnd_, markup_, margin_ } from './calc.js'

/* cột bảng bóc: key,label,default */
export const COLS=[
  ['stt','STT',1],['khuVuc','Phòng',1],['maBanVe','Mã số bản vẽ',0],['nganh','Dòng sản phẩm',0],
  ['maSP','Mã sản phẩm',0],['ten','Tên sản phẩm',1],['thuongHieu','Thương hiệu',1],['ncc','Nhà cung cấp',0],
  ['moTa','Thông tin chính',1],['kichThuoc','Thông số thiết kế',1],['hinhAnh','Hình ảnh',1],['taiLieu','Tài liệu',1],['dvt','Đơn vị tính',1],
  ['soLuong','Số lượng',1],['giaNCC','Giá bán lẻ',1],['chietKhau','Chiết khấu của đại lý (%)',1],
  ['giaDaiLy','Giá đại lý',1],['lnPct','Lợi nhuận dự kiến (%)',1],['donGia','Giá bán',1],
  ['ckKhach','Chiết khấu cho khách hàng (%)',1],['donGiaCK','Đơn giá',1],
  ['markup','Markup (%) — LN/giá vốn',1],['margin','Margin (%) — LN/giá bán',1],['lnVnd','Lợi nhuận (VND)',1],
  ['thanhTien','Thành tiền',1],['trangThai','Trạng thái',1],['ghiChu','Ghi chú',1]
];
// S.cols mặc định (app.js:119)
export function defaultCols(){ var m={}; COLS.forEach(function(c){ m[c[0]]=!!c[2]; }); return m; }

/* Sàn bề rộng khi bật "Vừa 1 màn hình" */
export const TK_MINW_={stt:54,khuVuc:88,maBanVe:74,maSP:88,ten:150,thuongHieu:92,ncc:92,moTa:130,kichThuoc:120,
  hinhAnh:70,taiLieu:70,dvt:58,soLuong:62,trangThai:86,ghiChu:110};
export const DEFW={taiLieu:92,stt:66,khuVuc:120,maBanVe:92,nganh:120,maSP:110,ten:190,thuongHieu:110,ncc:120,moTa:186,kichThuoc:150,hinhAnh:104,dvt:84,soLuong:84,giaNCC:104,chietKhau:120,giaDaiLy:104,lnPct:96,donGia:104,ckKhach:130,donGiaCK:104,markup:130,margin:130,lnVnd:120,thanhTien:112,trangThai:104,ghiChu:150};
export const NUMSORT={stt:1,soLuong:1,giaNCC:1,giaDaiLy:1,donGia:1,donGiaCK:1,lnVnd:1,thanhTien:1,lnPct:1,chietKhau:1,ckKhach:1,markup:1,margin:1};
export const FR_FIELDS=['ten','thuongHieu','ncc','moTa','kichThuoc','maSP','khuVuc','maBanVe','ghiChu','trangThai','dvt'];

// Thứ tự cột từ qs_colcfg (initCols): đọc cấu hình đã lưu {order, w}
export function initColOrder(saved){
  var d=saved||{};
  var keys=COLS.map(function(c){return c[0];});
  var order=(d.order&&d.order.filter(function(k){return keys.indexOf(k)>=0;}))||keys.slice();
  keys.forEach(function(k){ if(order.indexOf(k)<0) order.push(k); });
  return order;
}
export function colW(k, colWMap){ return (colWMap||{})[k]||DEFW[k]||110; }
export function colPlain(l,key){
  if(key==='nganh') return (l.extra&&l.extra.nganh)||'';
  var m={khuVuc:'khuVuc',maBanVe:'maBanVe',maSP:'maSP',ten:'ten',thuongHieu:'thuongHieu',ncc:'ncc',moTa:'moTa',kichThuoc:'kichThuoc',dvt:'dvt',trangThai:'trangThai',ghiChu:'ghiChu'};
  if(m[key]) return String(l[m[key]]||'');
  if(key==='soLuong') return String(l.soLuong||0);
  if(key==='giaNCC') return String(l.donGiaVon||0);
  if(key==='donGia') return String(l.donGiaBan||0);
  if(key==='lnPct') return String(l.lnPct||0);
  return '';
}
export function cellSortVal_(l,k){ switch(k){
  case 'soLuong': return Number(l.soLuong)||0;
  case 'giaNCC': return Number(l.donGiaVon)||0;
  case 'giaDaiLy': return giaDaiLy_(l);
  case 'donGia': return Number(l.donGiaBan)||0;
  case 'donGiaCK': return donGiaCK_(l);
  case 'thanhTien': return ttBan_(l);
  case 'lnVnd': return lnVnd_(l);
  case 'markup': return markup_(l);
  case 'margin': return margin_(l);
  case 'lnPct': return Number(l.lnPct)||0;
  case 'chietKhau': return Number(l.chietKhau)||0;
  case 'ckKhach': return Number(l.ckKhach)||0;
  default: return colPlain(l,k); } }
// sortKey/sortDir = S.sortKey/S.sortDir
export function sortLines_(arr, sortKey, sortDir){ if(!sortKey) return arr; var k=sortKey, dir=sortDir==='desc'?-1:1;
  return arr.slice().sort(function(a,b){ var va=cellSortVal_(a,k), vb=cellSortVal_(b,k);
    if(NUMSORT[k]) return ((Number(va)||0)-(Number(vb)||0))*dir;
    return String(va).localeCompare(String(vb),'vi',{numeric:true})*dir; }); }

/* Cột đang hiện theo thứ tự: colOrder = S.colOrder, cols = S.cols, nganh = ngành bộ lọc của đề mục (vsFltNganh_) */
export function visCols(colOrder, cols, nganh){ var byK={}; COLS.forEach(function(c){ byK[c[0]]=c; });
  // đề mục Sơn nước: cột thứ 2 là "Tính năng sản phẩm"
  if(nganh==='son') byK.kichThuoc=['kichThuoc','Tính năng sản phẩm',byK.kichThuoc[2]];
  return (colOrder||COLS.map(function(c){return c[0];})).map(function(k){ return byK[k]; }).filter(function(c){ return c && (cols||{})[c[0]]; }); }

/* Chữ hiển thị của 1 ô chỉ-đọc - phần chữ của cellVal (app.js:1878-1907). hinhAnh / taiLieu là phần tử
   (ảnh / nút tài liệu) nên trả '' - người vẽ tự dựng. */
export function cellText_(l,key){
  switch(key){
    case 'khuVuc': return String(l.khuVuc||'');
    case 'maBanVe': return String(l.maBanVe||'');
    case 'nganh': return String((l.extra&&l.extra.nganh)||'');
    case 'maSP': return String(l.maSP||'');
    case 'ten': return String(l.ten||'');
    case 'thuongHieu': return String(l.thuongHieu||'');
    case 'ncc': return String(l.ncc||'');
    case 'moTa': return String(l.moTa||'');
    case 'kichThuoc': return String(l.kichThuoc||'');
    case 'dvt': return String(l.dvt||'');
    case 'giaNCC': return money(l.donGiaVon);
    case 'chietKhau': return (Number(l.chietKhau)||0)+'%';
    case 'giaDaiLy': return money(giaDaiLy_(l));
    case 'lnPct': return (Number(l.lnPct)||0)+'%';
    case 'donGiaCK': return money(donGiaCK_(l));
    case 'markup': { var dl=giaDaiLy_(l),dg=donGiaCK_(l); return dl>0?Math.round((dg-dl)/dl*100)+'%':'—'; }
    case 'margin': { var dl2=giaDaiLy_(l),dg2=donGiaCK_(l); return dg2>0?Math.round((dg2-dl2)/dg2*100)+'%':'—'; }
    case 'lnVnd': return money((donGiaCK_(l)-giaDaiLy_(l))*(Number(l.soLuong)||0));
    case 'thanhTien': return money(ttBan_(l));
    case 'trangThai': return String(l.trangThai||'');
    case 'ghiChu': return String(l.ghiChu||'');
  }
  return '';
}

// Ô sửa được. Cột chỉ-đọc: stt, hình ảnh, ngành, giá đại lý, đơn giá, thành tiền.
export const TXT_COL={ khuVuc:'khuVuc', maBanVe:'maBanVe', ncc:'ncc', maSP:'maSP', thuongHieu:'thuongHieu',
  dvt:'dvt', trangThai:'trangThai', ghiChu:'ghiChu', kichThuoc:'kichThuoc', ten:'ten' };
export const NUM_COL={ soLuong:'soLuong', giaNCC:'donGiaVon', lnPct:'lnPct', chietKhau:'chietKhau', donGia:'donGiaBan', ckKhach:'ckKhach' };
export const MONEY_COL={ giaNCC:1, donGia:1 };
export const TK_RO_COL={stt:1,hinhAnh:1,nganh:1,giaDaiLy:1,donGiaCK:1,thanhTien:1};

/* ═══ CHỌN NHANH bộ cột ═══ */
export const TK_PRESETS=[
  ['all','Hiện tất cả cột',null],
  ['macdinh','Mặc định','default'],
  ['khach','Báo giá cho khách',['stt','khuVuc','ten','thuongHieu','moTa','kichThuoc','hinhAnh','dvt','soLuong','donGia','ckKhach','donGiaCK','thanhTien','ghiChu']],
  ['sp','Thông tin sản phẩm',['stt','khuVuc','maBanVe','maSP','ten','thuongHieu','ncc','moTa','kichThuoc','hinhAnh','dvt','soLuong']],
  ['gia','Giá & lợi nhuận',['stt','ten','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','ckKhach','donGiaCK','markup','margin','lnVnd','thanhTien']],
  ['gon','Tối giản',['stt','ten','soLuong','donGiaCK','thanhTien']]
];
export const TK_COL_CB=['stt','tang','ten','thuongHieu','soLuong','donGia','thanhTien','hinhAnh'];

// Bảng Chi phí dùng ĐÚNG key cột của Bóc tách
export const CP_KEYS=['ten','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','ckKhach','donGiaCK','markup','margin','lnVnd','thanhTien'];
export const DA_KEYS=['khuVuc','maBanVe','nganh','maSP','ten','thuongHieu','ncc','moTa','kichThuoc','hinhAnh','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','thanhTien'];
export const CP_COL_CB=['ten','soLuong','giaDaiLy','donGia','thanhTien','lnVnd'];
export const DA_COL_CB=['ten','soLuong','giaDaiLy','donGia','thanhTien','hinhAnh'];
// S._daCols khi chưa lưu (duan.js:52)
export const DA_COLS_DEFAULT={khuVuc:1,ten:1,thuongHieu:1,moTa:1,kichThuoc:1,hinhAnh:1,dvt:1,soLuong:1,donGia:1,thanhTien:1};
// thứ tự cột Chi phí: saved = JSON qs_cporder; cột mới thêm vào CP_KEYS tự nối cuối
export function cpOrder_(saved){
  var o=(Array.isArray(saved)?saved:[]).filter(function(k){ return CP_KEYS.indexOf(k)>=0; });
  CP_KEYS.forEach(function(k){ if(o.indexOf(k)<0) o.push(k); }); return o; }
export function cpLabel_(k){ var c=COLS.filter(function(x){return x[0]===k;})[0]; return c?c[1]:k; }
export function cpAlign_(k){
  var numK=['soLuong','giaNCC','giaDaiLy','donGia','donGiaCK','lnVnd','thanhTien'];
  var ctK=['dvt','chietKhau','lnPct','ckKhach','markup','margin'];
  return numK.indexOf(k)>=0?'num':(ctK.indexOf(k)>=0?'ct':'');
}

/* ═══ BỘ CỘT DÙNG CHUNG (COLSET) ═══ - mô tả từng bảng: danh sách cột, bộ mặc định, cột luôn có.
   Bảng 'sp' phụ thuộc ngành đang xem của Danh sách SP -> người dùng truyền keys/macdinh riêng. */
export const COLSET={
  tk:{ ten:'Bóc tách', pref:'tkCols', luon:'ten',
    keys:function(){ return COLS.map(function(c){ return c[0]; }); },
    macdinh:function(){ return COLS.filter(function(c){ return c[2]; }).map(function(c){ return c[0]; }); } },
  cp:{ ten:'Chi phí', pref:'cpCols', luon:'ten',
    keys:function(){ return CP_KEYS.slice(); },
    macdinh:function(){ return ['ten','dvt','soLuong','giaNCC','chietKhau','giaDaiLy','lnPct','donGia','thanhTien','lnVnd']; } },
  da:{ ten:'Dự án', pref:'daCols', luon:'ten',
    keys:function(){ return DA_KEYS.slice(); },
    macdinh:function(){ return ['khuVuc','ten','thuongHieu','moTa','kichThuoc','hinhAnh','dvt','soLuong','donGia','thanhTien']; } },
  sp:{ ten:'Danh sách SP', pref:'spCols', luon:'ten' }
};
/* tab = COLSET[t] (hoặc {keys(),macdinh(),luon} của bảng sp); on = map cột đang bật */
export function csDangBat_(tab,on){ return tab.keys().filter(function(k){ return !!(on||{})[k]; }); }
/* Bộ dựng sẵn viết theo key cột của Bóc tách; bảng khác chỉ lấy phần key mình có. */
export function csPresetKeys_(tab,ps){
  var ks=tab.keys();
  if(ps[2]===null) return ks.slice();
  var ds=(ps[2]==='default')?tab.macdinh():ps[2];
  return ds.filter(function(k){ return ks.indexOf(k)>=0; });
}
export function csWant_(tab,list){
  var m={}; list.forEach(function(k){ m[k]=1; });
  var l=tab.luon; if(l) m[l]=1;                 // cột Tên sản phẩm luôn phải có
  return m;
}
// bộ nào đang khớp đúng với cột đang bật
export function csPresetOn_(tab,ps,on){
  var want=csWant_(tab,csPresetKeys_(tab,ps));
  return tab.keys().every(function(k){ return !!(on||{})[k]===!!want[k]; });
}
// map cột sau khi áp bộ id (csPresetApply_ -> set(csWant_(...)))
export function csPresetCols_(tab,id){
  var ps=TK_PRESETS.filter(function(x){ return x[0]===id; })[0]; if(!ps) return null;
  var want=csWant_(tab,csPresetKeys_(tab,ps)), m={};
  tab.keys().forEach(function(k){ m[k]=!!want[k]; });
  return m;
}
// khoá localStorage dự phòng của bộ "Của tôi" ('tk' giữ khoá cũ)
export function csMyKey_(t,username){ var u=String(username||'').toLowerCase();
  return t==='tk' ? ('qs_tkcols_'+u) : ('qs_cols_'+t+'_'+u); }
/* Bộ "Của tôi": ưu tiên me.uiPrefs[pref], dự phòng localStorage (localVal đã JSON.parse) */
export function csMyCols_(tab,uiPrefs,localVal){
  var v=uiPrefs&&uiPrefs[tab.pref];
  if(!Array.isArray(v)) v=localVal;
  if(!Array.isArray(v)) return null;
  var ks=tab.keys(); v=v.filter(function(k){ return ks.indexOf(k)>=0; });
  return v.length?v:null;
}
export function csMyOn_(tab,mine,on){ if(!mine) return false;
  var want=csWant_(tab,mine);
  return tab.keys().every(function(k){ return !!(on||{})[k]===!!want[k]; }); }
// Đăng nhập xong: bộ của tài khoản, chưa lưu thì Mặc định -> map cột
export function csMyApply_(tab,mine){ var want=csWant_(tab, mine||tab.macdinh()), m={};
  tab.keys().forEach(function(k){ m[k]=!!want[k]; }); return m; }
// Nhãn nút "Chọn nhanh": "Của tôi" / tên bộ đang khớp / "Chọn nhanh" + số cột đang bật / tổng
export function csQuickLabel_(tab,on,mine){
  var ks=tab.keys(), n=csDangBat_(tab,on).length;
  var cur=TK_PRESETS.filter(function(ps){ return csPresetOn_(tab,ps,on); })[0];
  return { nhan: csMyOn_(tab,mine,on)?'Của tôi':(cur?cur[1]:'Chọn nhanh'), on:n, total:ks.length };
}
// Bảng ít cột hơn Bóc tách có thể khiến 2 bộ ra CÙNG một danh sách -> chỉ giữ bộ đầu tiên
export function csPresetList_(tab){ var da={};
  return TK_PRESETS.filter(function(ps){
    if(ps[2]!==null && ps[2]!=='default' && csPresetKeys_(tab,ps).length<2) return false;
    var sig=csPresetKeys_(tab,ps).slice().sort().join('|');
    if(da[sig]) return false; da[sig]=1; return true; }); }
// "Hiện tất cả" / "Chỉ cột cơ bản" (tkColAll_ · cpColAll_ · daColAll_)
export function colAll_(keys,cb,on){ var m={}; keys.forEach(function(k){ m[k]= on ? true : (cb.indexOf(k)>=0); }); return m; }
// Tìm cột trong bảng chọn cột (tkColPopRender_)
export function colSearch_(q){ q=spNorm_(q||''); return COLS.filter(function(c){ return !q || spNorm_(c[1]).indexOf(q)>=0; }); }

/* Tầng / phòng gợi ý */
export const FLOOR_PRESETS=['TẦNG HẦM','TẦNG LỬNG','TẦNG TRỆT','TẦNG 1','TẦNG 2','TẦNG 3','TẦNG 4','TẦNG 5','SÂN THƯỢNG','TẦNG MÁI','TUM THANG'];
export const ROOM_PRESETS=['PHÒNG KHÁCH','PHÒNG BẾP','PHÒNG ĂN','PHÒNG NGỦ MASTER','PHÒNG NGỦ 1','PHÒNG NGỦ 2','PHÒNG NGỦ 3',
  'PHÒNG VỆ SINH','WC CHUNG','WC MASTER','PHÒNG LÀM VIỆC','PHÒNG THỜ','SẢNH','HÀNH LANG','CẦU THANG',
  'BAN CÔNG','PHÒNG GIẶT','KHO','PHÒNG ĐỂ XE','SÂN VƯỜN'];
// datalist #phongList của ô Phòng (index.html:6810-6817), đúng thứ tự
export const PHONG_LIST=['Phòng khách','Phòng bếp','Phòng ăn','Phòng ngủ master','Phòng ngủ 1','Phòng ngủ 2','Phòng ngủ 3',
  'Phòng vệ sinh','WC chung','WC master','Phòng để xe','Sảnh','Hành lang','Cầu thang',
  'Ban công','Sân thượng','Phòng làm việc','Phòng thờ','Phòng giặt','Kho','Sân vườn'];
export const TK_LN_QUICK=[5,10,15,20,30,35,40,45];

/* Nhân công / Vật tư CHỈ có ở: Phần thô · Thạch cao · Xây tô · Ốp lát */
export const TK_SHEETS=[['nc','Nhân công'],['vt','Vật tư']];
export const TK_SHEET_NODES=['3.1','3.2.1','3.2.3','3.2.4'];
export const PT_SHEET_LOAI={nc:'dt_nhancong', vt:'dt_vattu'};
// code = đề mục cần hỏi (bản gốc mặc định S.node)
export function tkSheetCo_(code){
  var c=String(code||'');
  return TK_SHEET_NODES.some(function(n){ return c===n || c.indexOf(n+'.')===0; });
}
export function tkSheetOf_(l){ return String((l&&l.extra&&l.extra.sheet)||''); }
export function tkSheetLbl_(v){ var x=TK_SHEETS.filter(function(t){ return t[0]===v; })[0]; return x?x[1]:''; }
