/* ═══ CHẾ ĐỘ BẢNG TÍNH (Jspreadsheet CE, MIT) — giao diện kiểu Google Sheets cho bảng Phần thô.
   Chỉ là LỚP HIỂN THỊ: đọc S.phanTho, tính bằng ptComputeAll(), ghi bằng ptEdit / ptEditSec_ đang có,
   nên mọi quy tắc tính & lưu giữ nguyên. Bảng cũ vẫn còn (nút "Bảng cũ") để dự phòng. ═══ */
'use strict';

function btOn_(k){ try{ return localStorage.getItem('qs_bt_'+k)!=='0'; }catch(e){ return true; } }
function btSet_(k,on){ try{ localStorage.setItem('qs_bt_'+k,on?'1':'0'); }catch(e){} }
function btSan_(){ return typeof jspreadsheet==='function'; }            // thư viện nạp được chưa
function ptSheetToggle_(){ btSet_('pt',!btOn_('pt')); renderPhanTho(); }

// Số hiển thị trong ô: 1.234.567 (kiểu VN, như cả app) · % một số lẻ · trống khi 0
function btMoney_(v){ v=Math.round(Number(v)||0); return v?money(v):''; }
function btPct_(v){ v=Number(v)||0; return v?(v.toFixed(1).replace('.',',')+'%'):''; }
function btQty_(v){ v=Number(v)||0; return v?ptQty(v):''; }

/* Dựng lưới cho bảng Phần thô: mỗi dòng mang meta {k:'sec'|'it', si, ii} để biết ô sửa thuộc đâu */
function ptSheetGrid_(cols, comp){
  var rows=[], meta=[];
  (S.phanTho||[]).forEach(function(sec,si){
    var st=comp.sections[si];
    var ln=st.tt-st.ttnt, dvtSet={};
    sec.items.forEach(function(it){ dvtSet[String(it.dvt||'').trim()]=1; });
    var mot=Object.keys(dvtSet).length<=1;
    var sumDG=sec.items.reduce(function(s,it){ return s+ptN(it.dg); },0);
    var dgntSet={}; sec.items.forEach(function(it){ dgntSet[ptN(it.dgnt)]=1; });
    var dk=Object.keys(dgntSet), secDgnt=(dk.length===1&&ptN(dk[0]))?ptN(dk[0]):0;
    var sv={ stt:PT_ROMAN[si], noidung:String(sec.t||''), khoiluong:(st.sumKL&&mot)?btQty_(st.sumKL):'',
      dgnt:btMoney_(secDgnt), ttnt:btMoney_(st.ttnt), lnvnd:btMoney_(ln),
      margin:st.tt?btPct_(ln/st.tt*100):'', markup:st.ttnt?btPct_(ln/st.ttnt*100):'',
      dg:sec.mode==='area'?btMoney_(sec.up):((sumDG&&mot)?btMoney_(sumDG):''), tt:btMoney_(st.tt) };
    rows.push(cols.map(function(c){ return sv[c[0]]==null?'':sv[c[0]]; })); meta.push({k:'sec', si:si});
    ptSortItems_(sec.items).filter(function(r){ return ptRowPass_(sec,r.it); }).forEach(function(r,pos){
      var it=r.it, isItem=sec.mode==='item', tt=it._tt, ttnt=it._ttnt, l=isItem?(tt-ttnt):0;
      var v={ stt:String(pos+1), noidung:String(it.n||''), dvt:String(it.dvt||''),
        dientich:it.dt==null||it.dt===''?'':btQty_(ptN(it.dt)), heso:it.hs==null||it.hs===''?'':String(it.hs).replace('.',','),
        khoiluong:btQty_(it._kl), dgnt:btMoney_(it.dgnt), ttnt:isItem?btMoney_(ttnt):'', lnvnd:isItem?btMoney_(l):'',
        margin:(isItem&&tt)?btPct_(l/tt*100):'', markup:(isItem&&ttnt)?btPct_(l/ttnt*100):'',
        dg:btMoney_(it.dg), tt:isItem?btMoney_(tt):'', ghichu:String(it.gc||'') };
      rows.push(cols.map(function(c){ return v[c[0]]==null?'':v[c[0]]; })); meta.push({k:'it', si:si, ii:r.oi});
    });
  });
  return {rows:rows, meta:meta};
}
// Ô này sửa được không (cùng quy tắc bảng cũ: ptCanEditF_ theo chế độ nhóm)
function ptSheetSua_(m,key){
  var sec=(S.phanTho||[])[m.si]; if(!sec) return null;
  if(m.k==='sec'){ if(key==='noidung') return 't'; if(key==='dg'&&sec.mode==='area') return 'up'; return null; }
  var f=PT_CELL_F[key]; if(!f) return null;
  if(f==='n') return f;
  if(f==='lnPct') return sec.mode==='item'?f:null;
  return ptCanEditF_(sec,f)?f:null;
}
var PT_NOI_BO={dgnt:1, ttnt:1, lnvnd:1, margin:1, markup:1};
function btColLetter_(i){ var s=''; i++; while(i>0){ var r=(i-1)%26; s=String.fromCharCode(65+r)+s; i=Math.floor((i-1)/26); } return s; }

function renderPTSheet_(host, cols, comp){
  var g=ptSheetGrid_(cols, comp);
  var st={}, ro=[];
  g.meta.forEach(function(m,y){
    cols.forEach(function(c,x){
      var ten=btColLetter_(x)+(y+1);
      if(m.k==='sec') st[ten]='background-color:#e8eaed;font-weight:700;';
      else if(c[0]==='dvt'||c[0]==='ghichu') st[ten]='font-style:italic;';      // như mẫu: ĐVT, Ghi chú in nghiêng
      if(!ptSheetSua_(m,c[0])) ro.push(ten);
    });
  });
  host.innerHTML='';
  S._ptSheetMeta=g.meta; S._ptSheetCols=cols;
  var ws=jspreadsheet(host,{
    tabs:false, toolbar:false,
    worksheets:[{
      data:g.rows, style:st, wordWrap:true, tableOverflow:true, tableHeight:'calc(100vh - 290px)', tableWidth:'100%',
      freezeColumns:S._ptSheetFrz===false?0:Math.min(2,cols.length), allowInsertRow:false, allowInsertColumn:false, allowDeleteRow:false,
      allowDeleteColumn:false, allowRenameColumn:false, columnSorting:false, filters:!!S._ptSheetLoc,
      nestedHeaders:[cols.map(function(c,i){ return {title:btColLetter_(i)}; })],
      columns:cols.map(function(c){ return {title:c[1], width:c[3]||100, type:'text',
        align:c[2]==='n'?'right':(c[2]==='c'?'center':'left'), wordWrap:c[0]==='noidung'||c[0]==='ghichu'}; })
    }],
    onchange:function(inst,cell,x,y,val,old){
      if(S._ptSheetBusy || String(val)===String(old)) return;
      ptSheetGhi_(+x,+y,val);
    },
    // Hoàn tác / làm lại: thư viện đổi ô nhưng không gọi onchange -> tự ghi giá trị cũ / mới vào dữ liệu
    onundo:function(inst,h){ ((h&&h.records)||[]).forEach(function(r){ ptSheetGhi_(r.x,r.y,r.oldValue); }); },
    onredo:function(inst,h){ ((h&&h.records)||[]).forEach(function(r){ ptSheetGhi_(r.x,r.y,r.value); }); },
    onselection:function(inst,x1,y1,x2,y2){ ptSheetSum_(inst,x1,y1,x2,y2); }
  })[0];
  S._ptSheet=ws;
  ro.forEach(function(ten){ try{ ws.setReadOnly(ten,true); }catch(e){} });
  // cột nội bộ (giá nhà thầu, lợi nhuận) tiêu đề xám đậm — tách khỏi cột báo khách (navy), như mẫu
  cols.forEach(function(c,x){ if(PT_NOI_BO[c[0]] && ws.headers && ws.headers[x]) ws.headers[x].classList.add('gs-int'); });
  return ws;
}
// Ghi 1 ô người dùng sửa vào S.phanTho (đúng hàm của bảng cũ), gom nhiều ô liền nhau -> tính + lưu + vẽ lại 1 lần
function ptSheetGhi_(x,y,val){
  var m=S._ptSheetMeta[y], col=S._ptSheetCols[x], f=m&&col&&ptSheetSua_(m,col[0]); if(!f) return;
  clearTimeout(S._ptSheetT);
  if(m.k==='sec' && f==='t'){                     // tên nhóm: ghi thẳng (ptEditSec_ vẽ lại cả bảng -> mất ô chọn + lịch sử)
    var v=String(val==null?'':val).trim(); if(!v){ toast('Tên hạng mục không được để trống'); ptSheetRefresh_(); return; }
    S.phanTho[m.si].t=v; }
  else if(m.k==='sec') ptEdit(m.si,-1,f,val,true);
  else ptEdit(m.si,m.ii,f,val,true);
  S._ptSheetT=setTimeout(function(){ ptPersist(); ptSheetRefresh_(); },60);
}
// Sau khi sửa: tính lại, ghi giá trị mới vào lưới (không dựng lại -> giữ ô đang chọn, vị trí cuộn)
function ptSheetRefresh_(){
  var ws=S._ptSheet; if(!ws || !document.body.contains(ws.element)){ renderPhanTho(); return; }
  var comp=ptComputeAll(), g=ptSheetGrid_(S._ptSheetCols, comp);
  if(g.rows.length!==S._ptSheetMeta.length){ renderPhanTho(); return; }     // thêm/bớt dòng -> vẽ lại cả bảng
  // ghi ô tự tính KHÔNG vào lịch sử: Ctrl+Z chỉ lùi thao tác của người dùng (lùi ô gõ -> onchange -> tính lại)
  S._ptSheetBusy=true; var ih=ws.ignoreHistory; ws.ignoreHistory=true;
  try{ g.rows.forEach(function(r,y){ r.forEach(function(v,x){
    if(String(ws.getValueFromCoords(x,y))!==String(v)) ws.setValueFromCoords(x,y,v,true); }); }); }
  finally{ S._ptSheetBusy=false; ws.ignoreHistory=ih; }
  S._ptSheetMeta=g.meta; ptTotalsBar_(comp);
}
// Khung kiểu GOOGLE SHEETS (theo mẫu): 1 hàng công cụ gọn · lưới · dòng trạng thái Σ. Chỉ đặt nút CHẠY THẬT.
var BT_SVG={
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  print:'<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M7 14h10v7H7z"/>',
  filter:'<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  freeze:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M3 9h18"/>',
  sum:'<path d="M18 4H6l6 8-6 8h12"/>'
};
function btI_(k){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+BT_SVG[k]+'</svg>'; }
function ptSheetFrame_(){
  var z=S._ptZoom||100, fs=S._ptFont||13;
  function b(html,tip,fn,on){ return '<button class="gs-b'+(on?' on':'')+'" title="'+tip+'" onclick="'+fn+'">'+html+'</button>'; }
  var sep='<span class="gs-sep"></span>';
  return '<div class="gs">'
    +'<div class="gs-bar">'
      +b(icon('search',17),'Tìm trong bảng','ptSheetFind_()')
      +b(btI_('undo'),'Hoàn tác (Ctrl+Z)','S._ptSheet&&S._ptSheet.undo()')+b(btI_('redo'),'Làm lại (Ctrl+Y)','S._ptSheet&&S._ptSheet.redo()')
      +b(btI_('print'),'In bảng','ptSheetPrint_()')
      +'<select class="gs-zoom" title="Thu phóng" onchange="ptSheetZoom_(0,this.value)">'
        +[50,75,90,100,125,150,200].map(function(v){ return '<option value="'+v+'"'+(v===z?' selected':'')+'>'+v+'%</option>'; }).join('')+'</select>'
      +sep+'<span class="gs-font">Montserrat</span>'+sep
      +b('−','Giảm cỡ chữ','ptSheetFont_(-1)')+'<span class="gs-fs">'+fs+'</span>'+b('+','Tăng cỡ chữ','ptSheetFont_(1)')
      +sep+b(btI_('filter'),'Bật / tắt ô lọc cột','ptSheetFilter_()',S._ptSheetLoc)
      +b(btI_('freeze'),'Cố định cột STT + Nội dung khi cuộn ngang','ptSheetFreeze_()',S._ptSheetFrz!==false)
      +b(icon('download',17),'Xuất Excel','ptExportXlsx()')
      +sep+'<span class="gs-sumic" title="Chọn nhiều ô để xem tổng">'+btI_('sum')+'</span><span class="gs-sum" id="ptSheetSum"></span>'
      +'<span style="flex:1"></span>'
      +'<button class="btn ghost sm" onclick="ptSheetToggle_()" title="Quay lại bảng cũ">Bảng cũ</button>'
    +'</div>'
    +'<div id="ptSheet" class="gs-grid" style="--gsfs:'+fs+'px'+(z!==100?';zoom:'+(z/100):'')+'"></div>'
  +'</div>';
}
// Chọn vùng ô: Σ Tổng · TB · Đếm ngay trên hàng công cụ
function ptSheetSum_(inst,x1,y1,x2,y2){
  S._ptSel=[Math.min(x1,x2),Math.min(y1,y2)];
  var el=document.getElementById('ptSheetSum'); if(!el) return;
  var s=0, n=0, so=0;
  for(var y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) for(var x=Math.min(x1,x2); x<=Math.max(x1,x2); x++){
    var v=String(inst.getValueFromCoords(x,y)||'').trim(); if(!v) continue; n++;
    if(/^-?[\d.,]+%?$/.test(v)){ s+=tkNum_(v); so++; } }
  function f(v){ return v.toLocaleString('vi-VN',{maximumFractionDigits:2}); }   // giữ số lẻ (khối lượng 3,5)
  el.innerHTML = n<2 ? '' : ((so?('<span>Tổng: <b>'+f(s)+'</b></span><span>TB: <b>'+f(s/so)+'</b></span>'):'')+'<span>Đếm: <b>'+n+'</b></span>');
}
function ptSheetFreeze_(){ S._ptSheetFrz=(S._ptSheetFrz===false); renderPhanTho(); }
function ptSheetZoom_(d,v){ S._ptZoom=v?Number(v):Math.max(50,Math.min(200,(S._ptZoom||100)+d));
  var h=document.getElementById('ptSheet'); if(h) h.style.zoom=(S._ptZoom/100); }
function ptSheetFont_(d){ S._ptFont=Math.max(10,Math.min(20,(S._ptFont||13)+d));
  var h=document.getElementById('ptSheet'); if(h) h.style.setProperty('--gsfs',S._ptFont+'px');
  var f=document.querySelector('.gs-fs'); if(f) f.textContent=S._ptFont; }
// Tìm: ô kế tiếp (sau ô đang chọn) có chứa chữ cần tìm -> chọn + cuộn tới
async function ptSheetFind_(){
  var ws=S._ptSheet; if(!ws) return;
  var q=await askInput_({ title:'Tìm trong bảng', label:'Chữ cần tìm', value:S._ptFindQ||'', ok:'Tìm' }); if(q==null) return;
  q=String(q).trim(); S._ptFindQ=q; if(!q) return;
  var d=ws.getData(), nx=(d[0]||[]).length, cur=S._ptSel?(S._ptSel[1]*nx+S._ptSel[0]):-1, k=spNorm_(q);
  for(var i=1;i<=d.length*nx;i++){ var p=(cur+i)%(d.length*nx), y=Math.floor(p/nx), x=p%nx;
    if(spNorm_(String(d[y][x]||'')).indexOf(k)>=0){ ws.updateSelectionFromCoords(x,y,x,y);
      var c=ws.getCellFromCoords(x,y); if(c&&c.scrollIntoView) c.scrollIntoView({block:'center',inline:'nearest'}); return; } }
  toast('Không thấy "'+q+'" trong bảng');
}
// In: dựng bảng HTML gọn từ đúng dữ liệu đang hiện (tên cột + nhóm + dòng)
function ptSheetPrint_(){
  var ws=S._ptSheet; if(!ws) return;
  var cols=S._ptSheetCols, meta=S._ptSheetMeta, d=ws.getData();
  var th='<tr>'+cols.map(function(c){ return '<th>'+esc(c[1])+'</th>'; }).join('')+'</tr>';
  var tb=d.map(function(r,y){ return '<tr'+(meta[y]&&meta[y].k==='sec'?' class="s"':'')+'>'+r.map(function(v,x){
      return '<td class="'+(cols[x][2]==='n'?'n':(cols[x][2]==='c'?'c':''))+'">'+esc(v)+'</td>'; }).join('')+'</tr>'; }).join('');
  var w=window.open('','_blank'); if(!w){ toast('Cho phép popup để in'); return; }
  w.document.write('<!doctype html><title>Phần thô — '+esc((S.cur&&S.cur.ten)||'')+'</title><style>@page{size:A4 landscape;margin:10mm}'
    +'body{font:11px Montserrat,Arial,sans-serif}table{border-collapse:collapse;width:100%}th{background:#1f3a5f;color:#fff;font-size:10px;padding:6px 4px;border:1px solid #2d4a6e}'
    +'td{padding:4px;border:1px solid #dadce0;vertical-align:top}td.n{text-align:right}td.c{text-align:center}tr.s td{background:#e8eaed;font-weight:700}</style>'
    +'<h3>'+esc((S.cur&&S.cur.ten)||'')+' — Phần thô</h3><table>'+th+tb+'</table>');
  w.document.close(); setTimeout(function(){ w.focus(); w.print(); },300);
}
// Bật/tắt hàng lọc dưới tiêu đề cột (dựng lại lưới; dữ liệu không đổi)
function ptSheetFilter_(){ S._ptSheetLoc=!S._ptSheetLoc; renderPhanTho(); if(S._ptSheetLoc) toast('Bấm vào ô dưới tên cột để lọc'); }
