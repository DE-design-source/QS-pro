/* Công thức giá của DÒNG bóc tách - port nguyên văn từ bản QS gốc (mirror calc_() ở server).
   Nguồn: giaDongTuSP_ app.js:1853-1860 · giaDaiLy_..margin_ 1861-1868 · recalcLine_ 1870-1877 · editProfit_ 1967-1987
   tkFieldsFor_ boc.js:953-972 · prodNode_ boc.js:285-290 · addProdObj (gộp dòng + dòng tạm + payload) boc.js:291-322
   S.products / S.node / S.sheet của bản gốc thành tham số. */
import { tkNum_ } from './format.js'
import { nodeName, spNodeCodeOf_ } from './tree.js'
import { TXT_COL, NUM_COL, TK_RO_COL, tkSheetCo_, tkSheetOf_ } from './columns.js'

/* Giá SP trong danh mục -> giá trên DÒNG bóc tách:
     Giá bán lẻ (donGiaVon) = GIÁ NIÊM YẾT · CK đại lý (chietKhau) = CK của SP -> giá đại lý = niêm yết × (1 − CK)
     Giá bán mặc định = giá niêm yết (LN 0%). SP chưa nhập giá niêm yết thì giữ cách cũ.
   products = S.products (để tra SP đầy đủ khi p là đối tượng rút gọn, vd SP đi kèm combo) */
export function giaDongTuSP_(p, products){
  var q=p;
  if(!(Number(p.giaBanLe)>0) && p.recordId!=null){
    q=(products||[]).filter(function(x){ return String(x.recordId)===String(p.recordId); })[0]||p; }
  var le=Number(q.giaBanLe)||0;
  if(le>0) return {donGiaVon:le, chietKhau:Number(q.ckDaiLy)||0, donGiaBan:le};
  var v=Number(p.donGiaVon)||0; return {donGiaVon:v, chietKhau:0, donGiaBan:Number(p.donGiaBan)||v};
}
// giá đại lý = giá bán lẻ (giá vốn NCC) sau chiết khấu đại lý | đơn giá = giá bán sau chiết khấu khách
export function giaDaiLy_(l){ return Math.round((Number(l.donGiaVon)||0)*(1-(Number(l.chietKhau)||0)/100)); }
export function donGiaCK_(l){ return Math.round((Number(l.donGiaBan)||0)*(1-(Number(l.ckKhach)||0)/100)); }
export function ttVon_(l){ return Math.round((Number(l.soLuong)||0)*giaDaiLy_(l)); }
export function ttBan_(l){ return Math.round((Number(l.soLuong)||0)*donGiaCK_(l)); }
export function lnVnd_(l){ return Math.round((donGiaCK_(l)-giaDaiLy_(l))*(Number(l.soLuong)||0)); }
export function markup_(l){ var g=giaDaiLy_(l); return g>0?Math.round((donGiaCK_(l)-g)/g*100):0; }
export function margin_(l){ var d=donGiaCK_(l); return d>0?Math.round((d-giaDaiLy_(l))/d*100):0; }
// Tính lại dòng khi sửa (SỬA TẠI CHỖ object l, như bản gốc). Chỉ đổi hướng giá bán khi trường liên quan bị sửa
export function recalcLine_(l, changed){
  changed=changed||{};
  var von=Number(l.donGiaVon)||0;
  if(Object.prototype.hasOwnProperty.call(changed,'donGiaBan')){ l.lnPct = von>0 ? Math.round(((Number(l.donGiaBan)||0)-von)/von*100) : 0; }
  else if(Object.prototype.hasOwnProperty.call(changed,'lnPct') || Object.prototype.hasOwnProperty.call(changed,'donGiaVon')){ l.donGiaBan = Math.round(von*(1+(Number(l.lnPct)||0)/100)); }
  l.thanhTienVon=ttVon_(l); l.thanhTienBan=ttBan_(l);
  l.lnVnd=lnVnd_(l); l.markup=markup_(l); l.margin=margin_(l);
}

/* Gõ lợi nhuận -> ra giá bán (editProfit_). Bản gốc toast + vẽ lại khi lỗi; ở đây trả về kết quả:
     {fields:{donGiaBan}}          -> gọi updateLine(id, fields)
     {msg:'…'}                     -> toast msg rồi vẽ lại ô (giữ giá trị cũ)
     {msg:null}                    -> ô trống: chỉ vẽ lại (KHÔNG đặt giá bán = giá vốn)
   giá đại lý (vốn thực) = giá bán lẻ NCC × (1 − CK đại lý) · đơn giá sau CK khách = giá bán × (1 − CK khách)
   Markup k : đơn giá = vốn × (1 + k/100) · Margin m : đơn giá = vốn / (1 − m/100) · Lợi nhuận L: đơn giá = vốn + L/SL */
export function editProfit_(l, key, val){
  var von=giaDaiLy_(l), sl=Number(l.soLuong)||0, ckK=(Number(l.ckKhach)||0)/100;
  if(String(val==null?'':val).trim()==='') return {msg:null};
  var v=tkNum_(val);
  if(!von) return {msg:'Nhập "Giá bán lẻ" (giá vốn nhà cung cấp) trước — chưa có giá vốn thì không tính ngược được lợi nhuận'};
  var dgCK;
  if(key==='markup') dgCK = von*(1+v/100);
  else if(key==='margin'){
    if(v>=100) return {msg:'Margin phải nhỏ hơn 100%'};
    dgCK = von/(1-v/100);
  }
  else {                                    // lnVnd: lợi nhuận cả dòng
    if(!sl) return {msg:'Nhập số lượng trước'};
    dgCK = von + v/sl;
  }
  if(ckK>=1) return {msg:'Chiết khấu khách hàng phải nhỏ hơn 100%'};
  var giaBan=Math.round(dgCK/(1-ckK));
  if(giaBan<0) return {msg:'Lợi nhuận âm quá mức — giá bán ra số âm'};
  return {fields:{donGiaBan:giaBan}};
}

// Trả về {fields} để cập nhật dòng l khi đặt giá trị raw vào cột k (null = cột chỉ đọc / không tính được)
export function tkFieldsFor_(l,k,raw){
  if(TK_RO_COL[k]) return null;
  if(k==='moTa'||k==='kichThuoc') { var o={}; o[k]=String(raw==null?'':raw); return o; }
  if(TXT_COL[k]){ var o2={}; o2[TXT_COL[k]]=String(raw==null?'':raw); return o2; }
  if(NUM_COL[k]){ var o3={}; o3[NUM_COL[k]]=tkNum_(raw); return o3; }
  if(k==='markup'||k==='margin'||k==='lnVnd'){
    if(String(raw==null?'':raw).trim()==='') return null;
    var von=giaDaiLy_(l), sl=Number(l.soLuong)||0, ckK=(Number(l.ckKhach)||0)/100, v=tkNum_(raw);
    if(!von||ckK>=1) return null;
    var dgCK;
    if(k==='markup') dgCK=von*(1+v/100);
    else if(k==='margin'){ if(v>=100) return null; dgCK=von/(1-v/100); }
    else { if(!sl) return null; dgCK=von+v/sl; }
    return {donGiaBan:Math.max(0,Math.round(dgCK/(1-ckK)))};
  }
  return null;
}

/* Đề mục nhận SP mới: Bóc tách theo đề mục đang chọn (onBoc = đang ở tab Bóc tách); tab khác theo ngành của SP */
export function prodNode_(p, node, onBoc){
  if(onBoc) return node;
  var nd=spNodeCodeOf_(p)||''; if(!nd) return node;
  var cur=String(node||'');
  return (cur===nd || cur.indexOf(nd+'.')===0) ? cur : nd;
}
/* Gộp SL chỉ khi: cùng hạng mục + tầng, TRÙNG CẢ THÔNG SỐ (biến thể khác = dòng riêng) VÀ dòng đó CHƯA điền PHÒNG.
   sheet = S.sheet đang chọn (Nhân công / Vật tư), node = S.node (để biết đề mục có chia sheet không) */
export function addProdSame_(lines, p, floor, nd, sheet, node){
  var cur=(tkSheetCo_(node)&&sheet)||'';
  return (lines||[]).filter(function(l){
    return !l._pending && l.nhom===nd && (l.tang||'')===floor
      && ((p.ma&&l.maSP&&l.maSP===p.ma)||l.ten===p.ten)
      && String(l.moTa||'').trim()===String(p.moTa||'').trim()
      && !String(l.khuVuc||'').trim()
      && tkSheetOf_(l)===cur;
  })[0];
}
/* Dữ liệu thêm dòng: prod = payload POST /projects/:id/lines, temp = dòng tạm hiện ngay (optimistic).
   floor đã qua chuẩn hoá ('CHƯA PHÂN TẦNG' -> ''), sl đã làm tròn >= 1, tmpId = 'tmp_<n>' */
export function addProdBuild_(p, products, nd, floor, sl, sheet, node, tmpId){
  var gia=giaDongTuSP_(p, products);
  var prod=Object.assign({},p,gia,{ nhom:nd, hangMuc:nodeName(nd), loai:nodeName(nd), tang:floor,
    extra:Object.assign({nganh:p.nhom||''}, (sheet&&tkSheetCo_(node))?{sheet:sheet}:{}) });
  var dgVon=gia.donGiaVon, dgBan=gia.donGiaBan;
  var temp={ lineId:tmpId, _pending:true,
    khuVuc:'', maBanVe:'', maSP:p.ma||'', ten:p.ten||'', thuongHieu:p.thuongHieu||'', ncc:p.ncc||'',
    moTa:p.moTa||'', kichThuoc:p.kichThuoc||p.size||'', dvt:p.dvt||'Cái', hinhAnh:p.hinhAnh||'',
    soLuong:sl, donGiaVon:dgVon, chietKhau:gia.chietKhau, donGiaBan:dgBan, thanhTienVon:Math.round(dgVon*(1-gia.chietKhau/100))*sl, thanhTienBan:dgBan*sl, lnPct:0,
    nhom:nd, hangMuc:nodeName(nd), tang:floor };
  return {prod:prod, temp:temp};
}
// Chuẩn hoá tham số addProdObj: SL nguyên >= 1, tầng 'CHƯA PHÂN TẦNG' = ''
export function addProdSl_(sl){ return Math.max(1, Math.round(Number(sl)||1)); }
export function addProdFloor_(floor, selFloor){ if(floor==null) floor=selFloor||''; if(floor==='CHƯA PHÂN TẦNG') floor=''; return floor; }
