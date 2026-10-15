/* Tổng tiền các tab - port nguyên văn bản QS gốc. S.* thành tham số.
   ctx của cpTong_ = { vat: cur.vat, phanTho, ptVat, bgCfg } (Phần thô + chiết khấu tổng báo giá của dự án)
   Nguồn: cpTotOf_ chiphi.js:281-284 · cpCfg_/cpMinBien_ 387-389 · cpWarn_ 394-400 · cpKeyOf_/cpKeyName_/cpGroupsOf_ 401-410
   cpTong_ 414-422 · biểu đồ hạng mục + tỷ trọng NCC 438-453 · so sánh bản nháp 483-500 · nhóm sai ngành 179-190
   dash.js:152-178 (renderDash) · duan.js:22-25 (Excel), 58-66 (tổng) · boc.js:583-587 (tkTongTien_) */
import { ttVon_, ttBan_, lnVnd_, donGiaCK_, giaDaiLy_ } from './calc.js'
import { nodeName, inNode_, spNodeCodeOf_ } from './tree.js'
import { ptComputeAll } from './phantho.js'
import { bgTong_ } from './quote.js'
import { pctIn_ } from './format.js'

export function cpTotOf_(list){
  var von=0,ban=0,sl=0; list.forEach(function(l){ von+=ttVon_(l); ban+=ttBan_(l); sl+=Number(l.soLuong)||0; });
  return {von:von,ban:ban,ln:ban-von,sl:sl,n:list.length};
}
/* Tổng của trang Chi phí = đúng số báo giá: dòng bóc tách trong phạm vi + PHẦN THÔ (khi xem tất cả / hạng mục 3.1)
   − chiết khấu tổng của báo giá (chỉ khi xem tất cả hạng mục) -> VAT -> tổng thanh toán. */
export function cpTong_(scope,hm,ctx){
  ctx=ctx||{};
  var t=cpTotOf_(scope), ptVon=0, ptBan=0, ck=0;
  var ptErr;
  // Như bản gốc (try/catch): Phần thô lỗi thì tính 0; thêm ptErr (chỉ khi lỗi) để người gọi báo cho người dùng
  if(!hm || hm==='3.1'){ try{
    if((ctx.phanTho||[]).length){ var c=ptComputeAll(ctx.phanTho, ctx.ptVat); ptBan=c.grand||0; ptVon=c.contractor||0; } }catch(e){ ptErr=String((e&&e.message)||e); } }
  var ban=t.ban+ptBan;
  if(!hm) ck=bgTong_(ban, ctx.bgCfg, ctx.vat).ck||0;
  var net=ban-ck, von=t.von+ptVon, ln=net-von, vp=Number(ctx.vat)||0, vat=Math.round(net*vp/100);
  var r={n:t.n, von:von, ban:ban, ck:ck, net:net, ln:ln, bien:net>0?ln/net*100:0, vatPct:vp, vat:vat, total:net+vat, ptBan:ptBan, ptVon:ptVon};
  if(ptErr) r.ptErr=ptErr;
  return r;
}
/* Cài đặt Chi phí theo dự án (projData.cpCfg): minBien = biên tối thiểu (%), bienMT = biên mục tiêu */
export function cpMinBien_(cpCfg){ var v=(cpCfg||{}).minBien; return (v==null||!isFinite(Number(v)))?15:Number(v); }
// cpSetMinBien: giá trị hợp lệ hoặc {msg}
export function cpMinBienIn_(v){ v=pctIn_(v); if(v==null||v<0||v>=100) return {msg:'Biên tối thiểu phải từ 0 đến dưới 100%'}; return {value:v}; }
// cpBienMucTieu_: biên mục tiêu hợp lệ hoặc {msg}
export function cpBienMTIn_(v){ v=pctIn_(v); if(v==null||v<0||v>=100) return {msg:'Biên phải từ 0 đến dưới 100%'}; return {value:v}; }
// Cảnh báo của 1 dòng: 'chuaGia' · 'chuaVon' · 'lo' (lợi nhuận âm) · 'thap' (biên trên giá bán < mức tối thiểu) · ''
export function cpWarn_(l,minBien){
  if(!(Number(l.donGiaBan)>0)) return 'chuaGia';
  if(!(Number(l.donGiaVon)>0)) return 'chuaVon';
  if(lnVnd_(l)<0) return 'lo';
  var d=donGiaCK_(l), bien=d>0?(d-giaDaiLy_(l))/d*100:0;    // so số CHÍNH XÁC (margin_ đã làm tròn)
  return bien<minBien ? 'thap' : '';
}
// Đếm cảnh báo của phạm vi (cpOverview_)
export function cpWarnCount_(scope,minBien){ var w={lo:0,thap:0,chuaGia:0,chuaVon:0}; scope.forEach(function(l){ var k=cpWarn_(l,minBien); if(k) w[k]++; }); return w; }
export function cpKeyOf_(l,by){ var v=String((by==='tang'?l.tang:(by==='ncc'?l.ncc:l.nhom))||'').trim(); return v||'__k'; }
export function cpKeyName_(k,by){
  if(k==='__k') return by==='ncc'?'Chưa có nhà cung cấp':(by==='tang'?'Chưa phân tầng':'Chưa xếp hạng mục');
  return by==='hm'?(nodeName(k)||k):k; }
// Gom dòng theo hạng mục / tầng / NCC, giữ thứ tự xuất hiện; mỗi nhóm kèm tổng
export function cpGroupsOf_(list,by){
  var m={}, ord=[];
  list.forEach(function(l){ var k=cpKeyOf_(l,by); if(!m[k]){ m[k]=[]; ord.push(k); } m[k].push(l); });
  return ord.map(function(k){ return {k:k, ten:cpKeyName_(k,by), list:m[k], t:cpTotOf_(m[k])}; });
}
/* Thẻ Tổng quan chi phí: biểu đồ theo hạng mục (8 nhóm lớn nhất theo giá bán) + tỷ trọng giá vốn theo NCC (6 nhóm).
   T = cpTong_(scope, hm, ctx). Mỗi nhóm kèm b = biên % trên giá bán, cls = 'neg' | 'low' | '' ; NCC kèm p = % vốn. */
export function cpOvCharts_(scope,T,minBien){
  var gs=cpGroupsOf_(scope,'hm').sort(function(a,b){ return b.t.ban-a.t.ban; });
  var max=Math.max.apply(null,[1].concat(gs.map(function(g){ return Math.max(g.t.ban,g.t.von); })));
  var bars=gs.slice(0,8).map(function(g){
    var b=g.t.ban>0?g.t.ln/g.t.ban*100:0, cls=g.t.ln<0?'neg':(b<minBien?'low':'');
    return {g:g, b:b, cls:cls, wBan:g.t.ban/max*100, wVon:g.t.von/max*100}; });
  // tỷ trọng giữa các NCC: mẫu số là vốn của các DÒNG (không tính nhà thầu Phần thô) -> cộng đủ 100%
  var ns=cpGroupsOf_(scope,'ncc').sort(function(a,b){ return b.t.von-a.t.von; }), tv=(T.von-(T.ptVon||0))||1;
  var ncc=ns.slice(0,6).map(function(g){ return {g:g, p:g.t.von/tv*100}; });
  return {bars:bars, moreHm:Math.max(0,gs.length-8), ncc:ncc, moreNcc:Math.max(0,ns.length-6)};
}
/* So sánh bản nháp (cpSoSanh_): drafts = các bản nháp của nhóm; linesOf[i] = dòng của bản nháp i (null = tải lỗi) */
export function cpSoSanh_(drafts,linesOf){
  var R=drafts.map(function(d,i){
    if(!linesOf[i]) return {d:d,i:i,loi:1};
    var t=cpTotOf_(linesOf[i]), vat=Math.round(t.ban*(Number(d.vat)||0)/100);
    return {d:d,i:i,t:t,tong:t.ban+vat,bien:t.ban>0?t.ln/t.ban*100:0}; });
  var ok=R.filter(function(r){ return !r.loi; });
  var minT=Math.min.apply(null,ok.map(function(r){ return r.tong; })), maxB=Math.max.apply(null,ok.map(function(r){ return r.bien; }));
  return {rows:R, minT:minT, maxB:maxB, nhieu:ok.length>1};
}

/* Bảng điều khiển (renderDash): số TOÀN DỰ ÁN (không theo hmNode). Nhóm biểu đồ gom về cấp 3 (3.2.6.1 + 3.2.6.2 -> 3.2.6),
   Phần thô thành nhóm '3.1'. byG đã xếp giảm dần, kèm pct (độ dài thanh). */
export function dashTotals_(lines,ctx){
  var groups={}; (lines||[]).forEach(function(l){
    var k=String(l.nhom||'').split('.').slice(0,3).join('.')||'Khác'; (groups[k]=groups[k]||{ban:0}).ban+=ttBan_(l); });
  var TT=cpTong_(lines||[],'',ctx), von=TT.von, ban=TT.net; if(TT.ptBan) groups['3.1']={ban:TT.ptBan};
  var byG=Object.keys(groups).map(function(k){return {k:k,ban:groups[k].ban};}).sort(function(a,b){return b.ban-a.ban;});
  var max=byG.reduce(function(m,g){return Math.max(m,g.ban);},1);
  byG.forEach(function(g){ g.pct=Math.round(g.ban/max*100); g.ten=nodeName(g.k); });
  return {n:(lines||[]).length, von:von, ban:ban, vatPct:TT.vatPct, vat:TT.vat, total:ban+TT.vat, ln:TT.ln, bien:TT.bien, groups:byG};
}

/* Dự án (renderDuAn): scope = dòng của hạng mục hm ('' = tất cả); visible = dòng đang hiện sau ô tìm.
   Dải tổng = cpTong_ (gồm Phần thô / trừ CK báo giá như Chi phí); chân bảng = đúng các dòng đang hiện. */
export function daScope_(lines,hm){ return hm?(lines||[]).filter(function(l){ return inNode_(l,hm); }):(lines||[]); }
export function daTotals_(scope,visible,hm,ctx){
  var TT=cpTong_(scope, hm||'', ctx);
  return { ban:TT.net, vat:TT.vat, total:TT.net+TT.vat, n:scope.length,
    sl:scope.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0),
    banLoc:visible.reduce(function(s,l){ return s+ttBan_(l); },0),
    nLoc:visible.length, slLoc:visible.reduce(function(s,l){return s+(Number(l.soLuong)||0);},0) };
}
// Dòng tổng của file Excel Dự án (daXuatExcel_): [['Chưa VAT',ban],['VAT x%',vat],['Tổng',ban+vat]]
export function daExcelTong_(lines,vat){
  var ban=lines.reduce(function(s,l){ return s+ttBan_(l); },0), vp=Number(vat)||0, v=Math.round(ban*vp/100);
  return [['Chưa VAT',ban],['VAT '+vp+'%',v],['Tổng',ban+v]];
}
/* Tổng tiền bảng Bóc tách (tkTongTien_): chưa VAT -> VAT dự án -> tổng */
export function tkTongTien_(lines,vat){
  var sub=lines.reduce(function(s,l){ return s+ttBan_(l); },0);
  var vatPct=Number(vat)||0;
  var v=Math.round(sub*vatPct/100);
  return {sub:sub, vatPct:vatPct, vat:v, total:sub+v};
}

/* ═══ DÒNG NẰM SAI NGÀNH (chiphi.js:179-198) - chỉ xét các đề mục ngành hàng chuẩn ═══ */
export const NGANH_NODES=['3.2.5','3.2.6','3.2.6.1'];
export function spByMa_(products){ var m={}; (products||[]).forEach(function(p){
    var k=String(p.ma||'').trim().toLowerCase(); if(k&&!m[k]) m[k]=p; }); return m; }
export function hmSaiNganh_(lines,products){
  if(!(products||[]).length) return [];
  var byMa=spByMa_(products);
  return (lines||[]).filter(function(l){
    if(NGANH_NODES.indexOf(String(l.nhom||''))<0) return false;
    var p=byMa[String(l.maSP||'').trim().toLowerCase()]; if(!p) return false;
    var nd=spNodeCodeOf_(p); return !!nd && nd!==String(l.nhom||'');
  });
}
// trường PATCH để chuyển 1 dòng sai ngành về đúng hạng mục (hmSaiFix_); null = không rõ ngành
export function hmSaiFields_(l,products){
  var p=spByMa_(products)[String(l.maSP||'').trim().toLowerCase()], nd=p?spNodeCodeOf_(p):'';
  return nd?{ nhom:nd, loai:nodeName(nd) }:null;
}
/* Lọc 1 hạng mục mà bảng trống trong khi dự án vẫn có dòng ở hạng mục khác (hmLacNote_): null = không nhắc */
export function hmLac_(lines,hm,soHien){
  if(!hm || soHien || hm==='3.1') return null;
  var all=(lines||[]); if(!all.length) return null;
  var dem={}; all.forEach(function(l){ var c=String(l.nhom||'')||'(chưa rõ)'; dem[c]=(dem[c]||0)+1; });
  var ds=Object.keys(dem).sort(function(a,b){ return dem[b]-dem[a]; });
  return {n:all.length, dem:dem, ds:ds};
}
