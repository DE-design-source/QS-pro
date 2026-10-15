/* Dòng dự án -> nhóm theo tầng cho bảng Bóc tách / Dự án, phạm vi theo hạng mục, định dạng ô btFmt.
   Port nguyên văn: floorsList boc.js:141-148 · renderTable (lọc đề mục + sheet + lọc cột + gom tầng) boc.js:474-486
   duan.js:89-92 (gom tầng, bỏ tầng trống) · moveFloor/renameFloor dùng chung tangTuTao · tkMoveLine_ boc.js:803-820
   btFmtKey_ / BT_FMT_CLS bangtinh.js:176-178 (định dạng {b,i,u,wrap,c,bg,al} khoá theo lineId + cột). */
import { tkSheetCo_, tkSheetOf_, colPlain } from './columns.js'

export const CHUA_PHAN_TANG='CHƯA PHÂN TẦNG';

/* Danh sách tầng: tầng tự tạo của dự án (cur.tangTuTao 'A|B') rồi tầng xuất hiện trong dòng, cuối cùng "CHƯA PHÂN TẦNG" nếu có dòng chưa có tầng */
export function floorsList(cur, lines){
  var set=[], seen={};
  var custom=(cur&&cur.tangTuTao)?String(cur.tangTuTao).split('|'):[];
  custom.forEach(function(t){ t=t.trim(); if(t&&!seen[t]){seen[t]=1;set.push(t);} });
  (lines||[]).forEach(function(l){ var t=(l.tang||'').trim(); if(t&&!seen[t]){seen[t]=1;set.push(t);} });
  if((lines||[]).some(function(l){ return !(l.tang||'').trim(); }) && !seen[CHUA_PHAN_TANG]) set.push(CHUA_PHAN_TANG);
  return set;
}
/* Dòng của bảng Bóc tách: đúng đề mục node (kể cả con); đề mục có Nhân công / Vật tư thì lọc theo sheet đang chọn;
   colFilter = S.colFilter {cột: giá trị} */
export function bocLines_(lines, node, sheet, colFilter){
  var code=node;
  var ls=(lines||[]).filter(function(l){ return l.nhom===code || String(l.nhom||'').indexOf(code+'.')===0; });
  if(sheet && tkSheetCo_(node)) ls=ls.filter(function(l){ return tkSheetOf_(l)===sheet; });
  var flt=colFilter||{};
  Object.keys(flt).forEach(function(k){ ls=ls.filter(function(l){ return colPlain(l,k)===flt[k]; }); });
  return ls;
}
/* Gom theo tầng: order = floorsList (tính trên TOÀN BỘ dòng dự án, như bản gốc) + tầng lạ; groups[tầng] = dòng.
   Bóc tách giữ cả tầng chưa có dòng (vừa thêm tầng là thấy); dropEmpty = true như tab Dự án. */
export function groupByFloor_(scope, cur, allLines, dropEmpty){
  var groups={};
  scope.forEach(function(l){ var g=(l.tang||'').trim()||CHUA_PHAN_TANG; (groups[g]=groups[g]||[]).push(l); });
  var order=floorsList(cur, allLines).slice();
  Object.keys(groups).forEach(function(g){ if(order.indexOf(g)<0) order.push(g); });
  if(dropEmpty) order=order.filter(function(g){ return groups[g]&&groups[g].length; });
  return {order:order, groups:groups};
}
/* Kéo 1 dòng tới trước/sau dòng targetId (hoặc cuối tầng floor khi targetId rỗng) TRONG TOÀN BỘ dòng dự án,
   đánh số lại stt 1..n. Trả {lines (mảng mới, mọi dòng là BẢN SAO), changed:[{lineId, stt, tang}]} hoặc null.
   Không sửa object dòng của người gọi (bản gốc sửa thẳng S.lines): ảnh "trước" dùng cho diff / hoàn tác giữ nguyên.
   Dòng tạm 'tmp_…' -> {tam:true} (bản gốc báo "Dòng vừa thêm đang lưu - thử lại sau 1–2 giây"). */
export function tkMoveLine_(allLines, dragId, floor, targetId, before){
  var ls=(allLines||[]).map(function(l){ return Object.assign({}, l); });
  var di=ls.findIndex(function(l){return l.lineId===dragId;}); if(di<0) return null;
  if(String(dragId||'').indexOf('tmp_')===0) return {tam:true};
  var dragged=ls[di];
  if(floor===CHUA_PHAN_TANG) floor='';
  if(targetId===dragId) return null;
  var oldTang=dragged.tang||'';
  ls.splice(di,1); dragged.tang=floor;
  var idx;
  if(targetId){ var ti=ls.findIndex(function(l){return l.lineId===targetId;}); idx=ti<0?ls.length:(before?ti:ti+1); }
  else { var last=-1; ls.forEach(function(l,i){ if((l.tang||'')===floor) last=i; }); idx=last>=0?last+1:ls.length; }
  ls.splice(idx,0,dragged);
  var changed=[];
  ls.forEach(function(l,i){ if(l.stt!==i+1){ l.stt=i+1; if(changed.indexOf(l)<0) changed.push(l); } });
  if(dragged.tang!==oldTang && changed.indexOf(dragged)<0) changed.push(dragged);
  return {lines:ls, changed:changed.map(function(l){ return {lineId:l.lineId, stt:l.stt, tang:l.tang}; })};
}

/* ═══ ĐỊNH DẠNG Ô (projData.btFmt) ═══
   Bản gốc: btFmt[khoá dòng][cột] = {b,i,u,wrap,c,bg,al}; khoá dòng = lineId (bảng Phần thô: 'pt:<si>:<ii>').
   Clone: fmt[cột] = {b,i,u,color,bg,align,nowrap}. Ghép 1-1: c<->color, al l|c|r <-> align left|center|right.
   'wrap' của bản gốc (bật xuống dòng, mặc định TẮT) KHÔNG cùng nghĩa với 'nowrap' của clone (mặc định xuống dòng):
   giữ nguyên khoá 'wrap' khi đổi qua lại để không mất dữ liệu, 'nowrap' không bao giờ lưu. Đề xuất (requests/0-F-B.txt R2):
   bảng chỉ xuống dòng khi fmt.wrap (mặc định như bản gốc), nút 'Xuống dòng' bật / tắt fmt.wrap. */
export const BT_FMT_CLS={b:'f-b', i:'f-i', u:'f-u', wrap:'f-wrap'};
export function btFmtKey_(k,m){ return (!m||m.k!=='it')?'':(k==='pt'?('pt:'+m.si+':'+m.ii):String(m.id)); }
var AL2ALIGN={l:'left',c:'center',r:'right'}, ALIGN2AL={left:'l',center:'c',right:'r'};
export function btToFmt_(o){
  if(!o) return undefined;
  var f={};
  if(o.b) f.b=true; if(o.i) f.i=true; if(o.u) f.u=true; if(o.wrap) f.wrap=true;
  if(o.c) f.color=o.c; if(o.bg) f.bg=o.bg; if(AL2ALIGN[o.al]) f.align=AL2ALIGN[o.al];
  return f;
}
export function fmtToBt_(f){
  var o={};
  if(!f) return o;
  if(f.b) o.b=1; if(f.i) o.i=1; if(f.u) o.u=1; if(f.wrap) o.wrap=1;
  if(f.color) o.c=f.color; if(f.bg) o.bg=f.bg; if(ALIGN2AL[f.align]) o.al=ALIGN2AL[f.align];
  return o;
}
// Định dạng của 1 dòng (lineId) dạng clone {cột: fmt}
export function lineFmt_(btFmt, lineId){
  var f=(btFmt||{})[String(lineId)]; if(!f) return undefined;
  var out={}; Object.keys(f).forEach(function(k){ var x=btToFmt_(f[k]); if(x&&Object.keys(x).length) out[k]=x; });
  return Object.keys(out).length?out:undefined;
}
/* Ghi định dạng clone của 1 dòng vào btFmt (bản sao mới): cột không còn định dạng thì xoá, dòng rỗng thì xoá - như btFmtSet_ */
export function setLineFmt_(btFmt, lineId, fmt){
  var all=JSON.parse(JSON.stringify(btFmt||{})), key=String(lineId), f={};
  Object.keys(fmt||{}).forEach(function(k){ var o=fmtToBt_(fmt[k]); if(Object.keys(o).length) f[k]=o; });
  if(Object.keys(f).length) all[key]=f; else delete all[key];
  return all;
}
